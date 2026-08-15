import { db } from "@/lib/db";
import { saveEvent } from "@/lib/event-actions";
import {
  categoriseTransaction,
  claimTransactionForProperty,
} from "@/lib/ledger-actions";
import { centsFromText, signedMoneyLabel } from "@/lib/money";
import { SCHEDULE_E_LINES } from "@/lib/statement-rules";
import { setStrategyState } from "@/lib/tax-actions";
import { strategyBySlug } from "@/lib/tax/strategies";
import { saveJournalEntry } from "@/lib/journal-actions";
import { saveProject } from "@/lib/project-actions";
import { saveContentItem } from "@/lib/studio-actions";
import { addSubtask, saveTask, setTaskStatus } from "@/lib/task-actions";
import { todayKey } from "@/lib/utils";

import type { ToolSchema } from "@/lib/deepseek";
import type { Hit, MontblancEvent, Receipt } from "@/lib/montblanc/types";

/**
 * What Montblanc can do.
 *
 * **Every write goes through the same server action the UI's own form calls.**
 * That is the load-bearing decision in this file and it was chosen over the
 * obvious alternative — talking to Prisma directly, which is shorter — because
 * the invariants live in those actions and nowhere else: a task's area is taken
 * from its project so the two can never disagree, a recurring task with no due
 * date gets its first occurrence inferred rather than becoming a rule that never
 * fires, a project's slug is minted once and never follows a rename, a journal
 * entry's day comes from the server's clock. Reimplementing any of that here
 * would mean the app has two ways to create a task and only one of them is
 * right. It also means a rule added to `saveTask` next month applies to
 * Montblanc without anyone remembering to come back here.
 *
 * The cost is that arguments are marshalled into `FormData`, which reads oddly
 * for a machine-to-machine call. It is the cheaper half of the trade.
 */

export type ToolOutcome = {
  /** What the model is told happened. Terse: it is spending tokens. */
  summary: string;
  /** What the drawer draws. */
  events: MontblancEvent[];
};

type Tool = {
  schema: ToolSchema;
  /** What the drawer shows while this runs. */
  step: string;
  run: (args: Record<string, unknown>) => Promise<ToolOutcome>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Argument reading — the model is not a form, so nothing here is trusted
// ─────────────────────────────────────────────────────────────────────────────

function text(args: Record<string, unknown>, key: string): string | null {
  const value = args[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function list(args: Record<string, unknown>, key: string): string[] {
  const value = args[key];
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function flag(args: Record<string, unknown>, key: string): boolean {
  return args[key] === true || args[key] === "true";
}

/**
 * A date argument, or nothing.
 *
 * Silently dropping a malformed one is right: the model has been told not to
 * invent due dates at all, so anything that arrives here and is not a real
 * `YYYY-MM-DD` is a hallucination rather than a typo, and a task with no date is
 * a great deal better than a task dated 2026-13-45 or "next Friday".
 */
function day(args: Record<string, unknown>, key: string): string | null {
  const value = text(args, key);
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  return value;
}

function time(args: Record<string, unknown>, key: string): string | null {
  const value = text(args, key);
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  return value;
}

function form(entries: Record<string, string | null | undefined>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (value !== null && value !== undefined) data.set(key, value);
  }
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolving what the model named
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Slug first, then name, case-insensitively.
 *
 * The context block hands the model exact slugs, so the slug branch is the one
 * that fires. The name branch is there because models reach for the label they
 * were shown in the same breath — "Sleepy Cat" rather than `sleepy-cat` — and
 * failing a write over that would be a bad reason to fail a write.
 */
async function findProject(slug: string | null) {
  if (!slug) return null;
  return db.project.findFirst({
    where: {
      OR: [
        { slug: slug.toLowerCase() },
        { name: { equals: slug, mode: "insensitive" } },
      ],
    },
    select: { id: true, slug: true, name: true, areaId: true },
  });
}

async function findArea(slug: string | null) {
  if (!slug) return null;
  return db.area.findFirst({
    where: {
      OR: [
        { slug: slug.toLowerCase() },
        { name: { equals: slug, mode: "insensitive" } },
      ],
    },
    select: { id: true, slug: true, name: true },
  });
}

async function findBrand(slug: string | null) {
  if (!slug) return null;
  return db.brand.findFirst({
    where: {
      OR: [
        { slug: slug.toLowerCase() },
        { name: { equals: slug, mode: "insensitive" } },
      ],
    },
    select: { id: true, slug: true, name: true, projectId: true },
  });
}

/** Refusing beats filing it somewhere near — CLAUDE.md §6, all of it. */
function unknown(kind: string, named: string | null): ToolOutcome {
  const what = named ? `"${named}"` : "nothing";
  return {
    summary: `FAILED: no ${kind} called ${what}. Tell the user which ${kind}s exist and ask which they meant. Do not retry with a different one.`,
    events: [],
  };
}

function receiptEvent(receipt: Receipt): MontblancEvent[] {
  return [{ type: "receipt", receipt }];
}

// ─────────────────────────────────────────────────────────────────────────────
// The tools
// ─────────────────────────────────────────────────────────────────────────────

const createTask: Tool = {
  step: "Writing it down",
  schema: {
    type: "function",
    function: {
      name: "create_task",
      description:
        "Add a task — a bug, a chore, an idea, an admin job, anything owed. This is the default for almost everything. Leave dueDate out unless the user actually named a deadline.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description:
              "The task, in the user's own words, tidied into a sentence. Do not embellish.",
          },
          projectSlug: {
            type: "string",
            description:
              "Which project it belongs to. Omit entirely if it is not obvious — a task with no project is normal and shows on Today under One-offs.",
          },
          areaSlug: {
            type: "string",
            description:
              "Only when there is no project. Defaults to the first area.",
          },
          track: {
            type: "string",
            description:
              "The workstream, e.g. Build, Art, Ship, Setup, Marketing, Content, Experiments. Omit if none obviously fits.",
          },
          dueDate: {
            type: "string",
            description:
              "YYYY-MM-DD. ONLY if the user named a deadline. Never inferred, never a default.",
          },
          notes: {
            type: "string",
            description:
              "Extra detail the user actually gave. Never invented.",
          },
          link: { type: "string", description: "A URL the user pasted." },
          steps: {
            type: "array",
            items: { type: "string" },
            description:
              "A checklist, when the job is one thing done in several places (e.g. one step per account). Omit for ordinary tasks.",
          },
          recurrence: {
            type: "string",
            enum: ["none", "daily", "weekdays", "weekly", "monthly"],
            description:
              "Only when the user said it repeats. The first occurrence is worked out for you.",
          },
          daysOfWeek: {
            type: "array",
            items: { type: "integer" },
            description:
              "With recurrence 'weekly': 1=Monday … 7=Sunday.",
          },
        },
        required: ["title"],
      },
    },
  },
  async run(args) {
    const title = text(args, "title");
    if (!title) return { summary: "FAILED: a task needs a title.", events: [] };

    const projectSlug = text(args, "projectSlug");
    const project = await findProject(projectSlug);
    if (projectSlug && !project) return unknown("project", projectSlug);

    let areaId = project?.areaId ?? null;
    if (!areaId) {
      const named = await findArea(text(args, "areaSlug"));
      areaId =
        named?.id ??
        (await db.area.findFirstOrThrow({ orderBy: { sortOrder: "asc" } })).id;
    }

    const recurrence = text(args, "recurrence") ?? "none";
    const body = form({
      title,
      notes: text(args, "notes"),
      link: text(args, "link"),
      track: text(args, "track"),
      dueDate: day(args, "dueDate"),
      projectId: project?.id ?? null,
      areaId,
      // `saveTask` only reads recurrence when the key is present, so a
      // non-repeating task must not set it at all.
      ...(recurrence !== "none" ? { recurrence } : {}),
    });

    if (recurrence !== "none") {
      for (const dayNumber of (args.daysOfWeek as unknown[] | undefined) ?? []) {
        const parsed = Number(dayNumber);
        if (parsed >= 1 && parsed <= 7) body.append("daysOfWeek", String(parsed));
      }
    }

    const id = await saveTask(body);

    const steps = list(args, "steps");
    for (const step of steps) await addSubtask(id, step);

    const track = text(args, "track");
    const where = [project?.name ?? "One-offs", track].filter(Boolean).join(" · ");

    return {
      summary: `Created task "${title}" (id ${id})${steps.length > 0 ? ` with ${steps.length} steps` : ""} under ${where}.`,
      events: receiptEvent({
        kind: "task",
        id,
        label: title,
        where,
        href: project ? `/projects/${project.slug}?tab=tasks` : "/board",
      }),
    };
  },
};

const createContentItem: Tool = {
  step: "Filing it in Social Media",
  schema: {
    type: "function",
    function: {
      name: "create_content_item",
      description:
        "Add a post, video, essay or content idea to the Social Media board. It lands at the 'idea' stage. Needs a brand (whose voice is speaking); the project (what it is about) is separate and often absent.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "The idea, in one line." },
          brandSlug: {
            type: "string",
            description: "Whose account this goes out from.",
          },
          projectSlug: {
            type: "string",
            description:
              "What it is ABOUT, if anything. A personal story is about no project — omit it rather than guessing.",
          },
          format: {
            type: "string",
            enum: ["short_video", "article", "text_post", "image"],
            description: "Defaults to short_video.",
          },
          notes: { type: "string", description: "Detail the user gave." },
          refUrl: {
            type: "string",
            description: "A post they want to copy the format of.",
          },
        },
        required: ["title", "brandSlug"],
      },
    },
  },
  async run(args) {
    const title = text(args, "title");
    if (!title) return { summary: "FAILED: needs a title.", events: [] };

    const brandSlug = text(args, "brandSlug");
    const brand = await findBrand(brandSlug);
    if (!brand) return unknown("brand", brandSlug);

    const projectSlug = text(args, "projectSlug");
    const project = await findProject(projectSlug);
    if (projectSlug && !project) return unknown("project", projectSlug);

    const id = await saveContentItem(
      form({
        title,
        brandId: brand.id,
        // Deliberately *not* defaulted from `brand.projectId`. The composer does
        // that for a human who can see the field change and correct it; here
        // nobody sees it, and §6's rule is that the link is a default and never
        // a constraint. An item about nothing is a normal item.
        projectId: project?.id ?? null,
        notes: text(args, "notes"),
        refUrl: text(args, "refUrl"),
        format: text(args, "format") ?? "short_video",
        stage: "idea",
      }),
    );

    const where = [brand.name, project?.name].filter(Boolean).join(" · ");
    return {
      summary: `Created content item "${title}" (id ${id}) under ${where}, at the idea stage.`,
      events: receiptEvent({
        kind: "contentItem",
        id,
        label: title,
        where,
        href: "/studio",
      }),
    };
  },
};

const createProject: Tool = {
  step: "Starting the project",
  schema: {
    type: "function",
    function: {
      name: "create_project",
      description:
        "Start a new project. Only when the user explicitly wants one — a passing idea is a task, not a project.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          areaSlug: { type: "string", description: "Which life area it sits in." },
          description: {
            type: "string",
            description: "What it IS, in one line. Only if the user said.",
          },
          focus: {
            type: "string",
            description:
              "What it is aiming at RIGHT NOW. Only if the user said.",
          },
          priority: {
            type: "string",
            enum: ["main", "side", "later"],
            description: "Defaults to side.",
          },
        },
        required: ["name", "areaSlug"],
      },
    },
  },
  async run(args) {
    const name = text(args, "name");
    if (!name) return { summary: "FAILED: needs a name.", events: [] };

    const areaSlug = text(args, "areaSlug");
    const area = await findArea(areaSlug);
    if (!area) return unknown("area", areaSlug);

    const id = await saveProject(
      form({
        name,
        areaId: area.id,
        description: text(args, "description"),
        focus: text(args, "focus"),
        priority: text(args, "priority") ?? "side",
        status: "active",
      }),
    );

    const created = await db.project.findUniqueOrThrow({
      where: { id },
      select: { slug: true },
    });

    return {
      summary: `Created project "${name}" (slug ${created.slug}) in the ${area.name} area.`,
      events: receiptEvent({
        kind: "project",
        id,
        label: name,
        where: area.name,
        href: `/projects/${created.slug}`,
      }),
    };
  },
};

const createEvent: Tool = {
  step: "Putting it on the calendar",
  schema: {
    type: "function",
    function: {
      name: "create_event",
      description:
        "Put something on the calendar. ONLY for things that happen at a time — an appointment, a booking, a trip, a launch week. Something the user OWES is a task, even when it has a date.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          startDay: { type: "string", description: "YYYY-MM-DD." },
          endDay: {
            type: "string",
            description: "YYYY-MM-DD. Omit for a single day.",
          },
          startTime: { type: "string", description: "HH:MM, 24-hour." },
          endTime: { type: "string", description: "HH:MM, 24-hour." },
          allDay: { type: "boolean" },
          areaSlug: { type: "string" },
          projectSlug: {
            type: "string",
            description: "Its area wins over areaSlug when both are given.",
          },
          location: { type: "string" },
          notes: { type: "string" },
        },
        required: ["title", "startDay"],
      },
    },
  },
  async run(args) {
    const title = text(args, "title");
    const startDay = day(args, "startDay");
    if (!title || !startDay) {
      return { summary: "FAILED: an event needs a title and a real date.", events: [] };
    }

    const projectSlug = text(args, "projectSlug");
    const project = await findProject(projectSlug);
    if (projectSlug && !project) return unknown("project", projectSlug);

    let areaId = project?.areaId ?? null;
    if (!areaId) {
      const areaSlug = text(args, "areaSlug");
      const area = await findArea(areaSlug);
      if (areaSlug && !area) return unknown("area", areaSlug);
      areaId =
        area?.id ??
        (await db.area.findFirstOrThrow({ orderBy: { sortOrder: "asc" } })).id;
    }

    const startTime = time(args, "startTime");
    const allDay = flag(args, "allDay") || !startTime;

    const id = await saveEvent(
      form({
        title,
        startDay,
        endDay: day(args, "endDay") ?? startDay,
        startTime,
        endTime: time(args, "endTime"),
        allDay: allDay ? "true" : "false",
        areaId,
        projectId: project?.id ?? null,
        location: text(args, "location"),
        notes: text(args, "notes"),
      }),
    );

    const when = allDay ? startDay : `${startDay} ${startTime}`;
    return {
      summary: `Created event "${title}" (id ${id}) on ${when}.`,
      events: receiptEvent({
        kind: "event",
        id,
        label: title,
        where: when,
        href: `/calendar?view=day&cursor=${startDay}`,
      }),
    };
  },
};

const createJournalEntry: Tool = {
  step: "Writing it in the journal",
  schema: {
    type: "function",
    function: {
      name: "create_journal_entry",
      description:
        "Record something that ALREADY HAPPENED — a milestone, a memory, how a day went, or what changed on a project (a devlog). It always lands on today; there is no back-dating. Never use this for anything owed. Give EITHER areaSlug OR projectSlug, never both: a project's journal is its devlog, an area's is everything else.",
      parameters: {
        type: "object",
        properties: {
          areaSlug: {
            type: "string",
            description: "Usually 'baby'. Omit if projectSlug is given.",
          },
          projectSlug: {
            type: "string",
            description:
              "The project this is a devlog entry for. Omit if areaSlug is given.",
          },
          body: {
            type: "string",
            description: "What happened, in the user's own words.",
          },
          title: {
            type: "string",
            description: "A short headline. Optional.",
          },
        },
        required: ["body"],
      },
    },
  },
  async run(args) {
    const areaSlug = text(args, "areaSlug");
    const projectSlug = text(args, "projectSlug");

    if (areaSlug && projectSlug)
      return {
        summary:
          "FAILED: an entry belongs to an area or a project, not both. Ask the user which one.",
        events: [],
      };
    if (!areaSlug && !projectSlug)
      return {
        summary:
          "FAILED: needs an area or a project to file this under. Ask which.",
        events: [],
      };

    // Resolved to whichever the model named, then handed to the same server
    // action the composer submits to — which is where the exactly-one-of rule
    // actually lives, so this cannot get past it by asking nicely.
    const owner = projectSlug
      ? await findProject(projectSlug)
      : await findArea(areaSlug);
    if (!owner)
      return unknown(projectSlug ? "project" : "area", projectSlug ?? areaSlug);

    const body = text(args, "body");
    if (!body) return { summary: "FAILED: needs something to say.", events: [] };

    const result = await saveJournalEntry(
      form({
        ...(projectSlug ? { projectId: owner.id } : { areaId: owner.id }),
        body,
        title: text(args, "title"),
      }),
    );
    // The action refuses in the same words the composer would show. Handed back
    // as a FAILED summary rather than retried, per the rule the other tools
    // follow: nothing that fails is quietly attempted a second way.
    if (!result.ok) return { summary: `FAILED: ${result.message}`, events: [] };
    const id = result.id;

    const href = projectSlug
      ? `/projects/${owner.slug}?tab=journal`
      : `/areas/${owner.slug}`;

    return {
      summary: `Wrote a journal entry (id ${id}) on ${owner.name}, dated today.`,
      events: receiptEvent({
        kind: "journalEntry",
        id,
        label: text(args, "title") ?? body.slice(0, 60),
        where: `${owner.name} · ${todayKey()}`,
        href,
      }),
    };
  },
};

const findTasks: Tool = {
  step: "Looking",
  schema: {
    type: "function",
    function: {
      name: "find_tasks",
      description:
        "Look up open tasks — by words in the title, by project, or just what is overdue. Use before complete_task, since that needs an id.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Words to match in the title. Omit to list everything matching the other filters.",
          },
          projectSlug: { type: "string" },
          overdue: {
            type: "boolean",
            description: "Only tasks due today or earlier.",
          },
          status: {
            type: "string",
            enum: ["open", "doing", "done"],
            description: "Defaults to open and doing together.",
          },
        },
      },
    },
  },
  async run(args) {
    const query = text(args, "query");
    const projectSlug = text(args, "projectSlug");
    const project = await findProject(projectSlug);
    if (projectSlug && !project) return unknown("project", projectSlug);

    const status = text(args, "status");

    const rows = await db.task.findMany({
      where: {
        // Snapshots of a recurring task and checklist steps are not tasks you
        // pick from a list — §6, `TOP_LEVEL_ONLY`. Without this a daily habit
        // comes back thirty times.
        recurringId: null,
        parentId: null,
        ...(query ? { title: { contains: query, mode: "insensitive" } } : {}),
        ...(project ? { projectId: project.id } : {}),
        ...(status
          ? { status: status as "open" | "doing" | "done" }
          : { status: { in: ["open", "doing"] } }),
        ...(flag(args, "overdue")
          ? { dueDate: { lte: new Date(`${todayKey()}T00:00:00.000Z`) } }
          : {}),
      },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      take: 12,
      select: {
        id: true,
        title: true,
        track: true,
        status: true,
        dueDate: true,
        project: { select: { name: true, slug: true } },
      },
    });

    if (rows.length === 0) {
      return { summary: "No tasks matched.", events: [] };
    }

    const today = todayKey();
    const hits: Hit[] = rows.map((row) => {
      const due = row.dueDate?.toISOString().slice(0, 10) ?? null;
      const note = [
        row.status === "doing" ? "Doing" : null,
        due ? (due < today ? `Overdue · ${due}` : `Due ${due}`) : null,
      ]
        .filter(Boolean)
        .join(" · ");

      return {
        id: row.id,
        title: row.title,
        where: [row.project?.name ?? "One-offs", row.track].filter(Boolean).join(" · "),
        href: row.project ? `/projects/${row.project.slug}?tab=tasks` : "/board",
        note: note || null,
      };
    });

    return {
      summary: `Found ${rows.length}:\n${hits.map((hit) => `- ${hit.title} [id ${hit.id}] (${hit.where}${hit.note ? `, ${hit.note}` : ""})`).join("\n")}`,
      events: [{ type: "hits", title: `${rows.length} found`, hits }],
    };
  },
};

const completeTask: Tool = {
  step: "Ticking it off",
  schema: {
    type: "function",
    function: {
      name: "complete_task",
      description:
        "Tick a task off. Needs the id from find_tasks. If more than one task matched, ask which rather than guessing.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
        },
        required: ["taskId"],
      },
    },
  },
  async run(args) {
    const taskId = text(args, "taskId");
    if (!taskId) return { summary: "FAILED: needs a task id.", events: [] };

    const task = await db.task.findUnique({
      where: { id: taskId },
      select: {
        title: true,
        recurrence: true,
        project: { select: { name: true, slug: true } },
      },
    });
    if (!task) {
      return {
        summary: "FAILED: no task with that id. Run find_tasks again.",
        events: [],
      };
    }

    await setTaskStatus(taskId, "done");

    const repeated = task.recurrence !== "none";
    return {
      summary: `Ticked off "${task.title}".${repeated ? " It repeats, so it has advanced to its next date rather than closing." : ""}`,
      events: [
        {
          type: "hits",
          title: repeated ? "Done — and re-armed for next time" : "Done",
          hits: [
            {
              id: taskId,
              title: task.title,
              where: task.project?.name ?? "One-offs",
              href: task.project
                ? `/projects/${task.project.slug}?tab=tasks`
                : "/board",
              note: null,
            },
          ],
        },
      ],
    };
  },
};

/**
 * The half of the ask that is not about writing anything: "I forget where
 * things are." This does not fetch — it hands the drawer a route and lets the
 * client push it, so the answer to "where do I put a bug" is arriving on the
 * page rather than being told about it.
 */
const navigate: Tool = {
  step: "Taking you there",
  schema: {
    type: "function",
    function: {
      name: "navigate",
      description:
        "Take the user to a screen. Use when they ask where something lives or to be shown something.",
      parameters: {
        type: "object",
        properties: {
          href: {
            type: "string",
            description: [
              "One of: /today, /board, /calendar (add ?view=week|day&cursor=YYYY-MM-DD),",
              "/studio, /studio/batch, /studio/channels,",
              "/projects/<project-slug> (add ?tab=tasks|content|docs),",
              "/areas/<area-slug> (add ?tab=docs|tasks).",
            ].join(" "),
          },
          label: {
            type: "string",
            description: "What to call it, e.g. 'the Hunt Board'.",
          },
        },
        required: ["href", "label"],
      },
    },
  },
  async run(args) {
    const href = text(args, "href");
    const label = text(args, "label") ?? "there";
    // Same-origin only, and never a protocol. An absolute URL here would be the
    // one place in this app a model's output could aim the browser off-site.
    if (!href || !href.startsWith("/") || href.startsWith("//")) {
      return { summary: "FAILED: not a route inside the app.", events: [] };
    }
    return {
      summary: `Navigating to ${href}. Say one short sentence confirming it.`,
      events: [{ type: "navigate", href, label }],
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// The Ledger — Phase 6, Layer 8
//
// **Nothing here creates money.** Every other surface's tools make rows;
// these do not, and that asymmetry is the point. Balances and transactions come
// from a bank, statements come from email, and a tax constant comes from a
// published source that a person confirms. There is nothing on this surface that
// a sentence ought to be able to invent — so what a command bar is actually
// useful for here is the small tedious act of **filing**: "that $340 was a
// plumbing repair for the rental", said while you are looking at the charge on
// your phone rather than after navigating to the Property tab.
//
// The one write is `claim_transaction`, and its receipt undoes by *releasing*
// the claim rather than deleting anything — a bank row is a payment that really
// happened.
// ─────────────────────────────────────────────────────────────────────────────

const findTransaction: Tool = {
  step: "Looking through the transactions",
  schema: {
    type: "function",
    function: {
      name: "find_transaction",
      description:
        "Search recent bank transactions by merchant, description or amount. Use this before claiming or categorising one, so the user can see which row you mean.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Part of the merchant name or description. Case-insensitive.",
          },
          amount: {
            type: "string",
            description:
              "The amount as the user said it, e.g. '340' or '$340.50'. Matches either direction of money.",
          },
          days: {
            type: "integer",
            description: "How far back to look. Defaults to 90.",
          },
        },
        required: [],
      },
    },
  },
  async run(args) {
    const query = text(args, "query");
    const amountText = text(args, "amount");
    const amountCents = amountText ? centsFromText(amountText) : null;
    const days = Math.min(730, Math.max(1, Number(args.days) || 90));

    if (!query && amountCents === null) {
      return {
        summary: "FAILED: needs something to search for — a merchant or an amount.",
        events: [],
      };
    }

    const since = new Date(Date.now() - days * 86_400_000);

    const rows = await db.transaction.findMany({
      where: {
        postedOn: { gte: since },
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { merchantName: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
        // Amounts are matched on magnitude, because the user says "the $340
        // charge" without meaning a sign.
        ...(amountCents !== null
          ? {
              OR: [
                { amountCents: Math.abs(amountCents) },
                { amountCents: -Math.abs(amountCents) },
              ],
            }
          : {}),
      },
      orderBy: { postedOn: "desc" },
      take: 8,
      select: {
        id: true,
        name: true,
        merchantName: true,
        amountCents: true,
        postedOn: true,
        account: { select: { name: true } },
        property: { select: { label: true } },
      },
    });

    if (rows.length === 0) {
      return {
        summary: `No transactions matched in the last ${days} days. Say so; do not guess at a different search.`,
        events: [],
      };
    }

    const hits: Hit[] = rows.map((row) => ({
      id: row.id,
      title: row.merchantName ?? row.name,
      where: row.account.name,
      href: "/ledger?tab=accounts",
      note: `${signedMoneyLabel(row.amountCents)} · ${row.postedOn.toISOString().slice(0, 10)}${row.property ? ` · filed under ${row.property.label}` : ""}`,
    }));

    return {
      summary: `Found ${rows.length}: ${rows
        .map(
          (row) =>
            `${row.merchantName ?? row.name} ${signedMoneyLabel(row.amountCents)} on ${row.postedOn.toISOString().slice(0, 10)} (id ${row.id})${row.property ? ` [already filed under ${row.property.label}]` : ""}`,
        )
        .join("; ")}`,
      events: [{ type: "hits", title: "Transactions", hits }],
    };
  },
};

const claimTransaction: Tool = {
  step: "Filing it against the property",
  schema: {
    type: "function",
    function: {
      name: "claim_transaction",
      description:
        "File a bank transaction against a rental property so it lands on that property's Schedule E. Call find_transaction first and use the id it returned. Never invent an id.",
      parameters: {
        type: "object",
        properties: {
          transactionId: {
            type: "string",
            description: "The id from find_transaction. Required.",
          },
          propertySlug: {
            type: "string",
            description: "Which property, from the PROPERTIES list. Required.",
          },
          taxCategory: {
            type: "string",
            description:
              "Which Schedule E line it belongs on: repairs, insurance, taxes, utilities, management_fees, commissions, supplies, advertising, auto_travel, cleaning_maintenance, legal_professional, other. Omit if genuinely unclear — a human can set it.",
          },
        },
        required: ["transactionId", "propertySlug"],
      },
    },
  },
  async run(args) {
    const transactionId = text(args, "transactionId");
    const propertySlug = text(args, "propertySlug");
    if (!transactionId || !propertySlug) {
      return {
        summary: "FAILED: needs both a transaction id and a property.",
        events: [],
      };
    }

    const property = await db.property.findFirst({
      where: {
        OR: [
          { slug: propertySlug },
          { label: { equals: propertySlug, mode: "insensitive" } },
        ],
      },
      select: { id: true, slug: true, label: true },
    });
    if (!property) return unknown("property", propertySlug);

    const category = text(args, "taxCategory");
    const taxCategory =
      category && (SCHEDULE_E_LINES as readonly string[]).includes(category)
        ? category
        : null;

    const result = await claimTransactionForProperty({
      transactionId,
      propertyId: property.id,
      taxCategory,
    });

    if (!result.ok) {
      return { summary: `FAILED: ${result.message}`, events: [] };
    }

    return {
      summary: `Filed "${result.label}" against ${result.where}${taxCategory ? ` as ${taxCategory}` : " with no Schedule E line yet"}.`,
      events: receiptEvent({
        kind: "transactionClaim",
        id: transactionId,
        label: result.label,
        where: `${result.where}${taxCategory ? ` · ${taxCategory}` : ""}`,
        href: "/ledger?tab=property",
      }),
    };
  },
};

const categoriseTransactionTool: Tool = {
  step: "Categorising it",
  schema: {
    type: "function",
    function: {
      name: "categorise_transaction",
      description:
        "Give a transaction a spending category of your own — 'Groceries', 'Childcare'. This is separate from the tax category and is never overwritten by a bank sync. Call find_transaction first.",
      parameters: {
        type: "object",
        properties: {
          transactionId: { type: "string", description: "The id from find_transaction." },
          category: {
            type: "string",
            description: "The category, in the user's own words. Free text.",
          },
        },
        required: ["transactionId", "category"],
      },
    },
  },
  async run(args) {
    const transactionId = text(args, "transactionId");
    const category = text(args, "category");
    if (!transactionId || !category) {
      return { summary: "FAILED: needs a transaction id and a category.", events: [] };
    }

    const result = await categoriseTransaction(transactionId, category);
    if (!result.ok) return { summary: `FAILED: ${result.message}`, events: [] };

    return {
      summary: `Categorised "${result.label}" as ${category}.`,
      events: [],
    };
  },
};

const markStrategyRaised: Tool = {
  step: "Noting it down",
  schema: {
    type: "function",
    function: {
      name: "mark_strategy_raised",
      description:
        "Record what the user decided about a tax strategy they were shown — that they raised it with their accountant, are doing it, have done it, or are leaving it this year.",
      parameters: {
        type: "object",
        properties: {
          slug: {
            type: "string",
            description:
              "The strategy: cost-segregation, real-estate-professional, qbi-safe-harbour, bunching-deductions, solo-retirement, withholding-vs-quarterlies, de-minimis-election, tax-loss-harvesting, hsa-headroom.",
          },
          state: {
            type: "string",
            enum: ["raised", "doing", "done", "declined"],
            description: "What the user said they had done about it.",
          },
          taxYear: {
            type: "integer",
            description: "Defaults to the current year.",
          },
        },
        required: ["slug", "state"],
      },
    },
  },
  async run(args) {
    const slug = text(args, "slug");
    const state = text(args, "state");
    if (!slug || !state) {
      return { summary: "FAILED: needs a strategy and a state.", events: [] };
    }
    if (!strategyBySlug(slug)) return unknown("strategy", slug);

    const taxYear = Number(args.taxYear) || new Date().getUTCFullYear();

    const result = await setStrategyState(taxYear, slug, state, null);
    if (!result.ok) return { summary: `FAILED: ${result.message}`, events: [] };

    return {
      summary: `Recorded ${slug} as ${state} for ${taxYear}.`,
      events: [],
    };
  },
};

export const TOOLS: Record<string, Tool> = {
  create_task: createTask,
  create_content_item: createContentItem,
  create_project: createProject,
  create_event: createEvent,
  create_journal_entry: createJournalEntry,
  find_tasks: findTasks,
  complete_task: completeTask,
  navigate,

  // The Ledger. Note what is absent: nothing that creates money.
  find_transaction: findTransaction,
  claim_transaction: claimTransaction,
  categorise_transaction: categoriseTransactionTool,
  mark_strategy_raised: markStrategyRaised,
};

export const TOOL_SCHEMAS: ToolSchema[] = Object.values(TOOLS).map(
  (tool) => tool.schema,
);
