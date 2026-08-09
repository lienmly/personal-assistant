import { db } from "@/lib/db";
import { saveEvent } from "@/lib/event-actions";
import { saveJournalEntry } from "@/lib/journal-actions";
import { saveProject } from "@/lib/project-actions";
import { saveContentItem } from "@/lib/studio-actions";
import { addSubtask, saveTask, setTaskStatus } from "@/lib/task-actions";
import { todayKey } from "@/lib/utils";

import type { ToolSchema } from "@/lib/montblanc/deepseek";
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
        "Record something that ALREADY HAPPENED, in an area's journal — a milestone, a memory, how a day went. It always lands on today; there is no back-dating. Never use this for anything owed.",
      parameters: {
        type: "object",
        properties: {
          areaSlug: {
            type: "string",
            description: "Usually 'baby'.",
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
        required: ["areaSlug", "body"],
      },
    },
  },
  async run(args) {
    const areaSlug = text(args, "areaSlug");
    const area = await findArea(areaSlug);
    if (!area) return unknown("area", areaSlug);

    const body = text(args, "body");
    if (!body) return { summary: "FAILED: needs something to say.", events: [] };

    const id = await saveJournalEntry(
      form({ areaId: area.id, body, title: text(args, "title") }),
    );

    return {
      summary: `Wrote a journal entry (id ${id}) in the ${area.name} area, dated today.`,
      events: receiptEvent({
        kind: "journalEntry",
        id,
        label: text(args, "title") ?? body.slice(0, 60),
        where: `${area.name} · ${todayKey()}`,
        href: `/areas/${area.slug}`,
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

export const TOOLS: Record<string, Tool> = {
  create_task: createTask,
  create_content_item: createContentItem,
  create_project: createProject,
  create_event: createEvent,
  create_journal_entry: createJournalEntry,
  find_tasks: findTasks,
  complete_task: completeTask,
  navigate,
};

export const TOOL_SCHEMAS: ToolSchema[] = Object.values(TOOLS).map(
  (tool) => tool.schema,
);
