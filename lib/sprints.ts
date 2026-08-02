import { addDays, startOfWeek } from "@/lib/calendar-keys";
import { db } from "@/lib/db";
import { todayKey } from "@/lib/utils";

/**
 * The sprint layer. Everything here exists to answer one question — "what am I
 * working on right now" — without the answer being "here are sixty tasks".
 *
 * The Hunt Board is the complete list and always will be. This module is the
 * committed subset that Today reads from, plus the two escape hatches for when
 * that subset runs out: the backlog of the `main` projects, and the ideas.
 */

const focusSelect = {
  id: true,
  title: true,
  notes: true,
  link: true,
  track: true,
  status: true,
  dueDate: true,
  sortOrder: true,
  sprintId: true,
  recurrence: true,
  daysOfWeek: true,
  project: { select: { id: true, name: true, slug: true } },
  area: { select: { name: true, color: true } },
} as const;

/** Whole days from today to a `@db.Date`, counted in the calendar rather than
 *  in milliseconds — 23:30 to 00:30 is one day apart, not zero. */
function daysBetweenKeys(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}

/** `@db.Date` → "YYYY-MM-DD". Read in UTC because that is where Prisma puts
 *  the local calendar day it stands for (CLAUDE.md §6). */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type SprintSummary = {
  id: string;
  name: string;
  goal: string | null;
  /** "YYYY-MM-DD", so the date inputs round-trip without a timezone. */
  startsOn: string;
  endsOn: string;
  /** Which day of the sprint today is, 1-based. Clamped into the window. */
  dayNumber: number;
  totalDays: number;
  /** Negative once the sprint is over its end date. */
  daysLeft: number;
  done: number;
  total: number;
};

export async function getActiveSprint(): Promise<SprintSummary | null> {
  const sprint = await db.sprint.findFirst({
    where: { status: "active" },
    orderBy: { startsOn: "desc" },
  });
  if (!sprint) return null;

  const today = todayKey();

  /**
   * Progress has to special-case recurring tasks, and the alternatives are
   * both wrong. A recurring row never *stays* done — ticking it re-arms it for
   * its next day — so counting `status: "done"` reports it as outstanding all
   * week however many times you did it. Counting its completed snapshots
   * instead makes `done` climb past `total`, because two Wednesdays and a
   * Sunday are three completions of one commitment.
   *
   * So: the sprint's members are the live rows (`recurringId: null`), and a
   * recurring one counts as done once it has fired *inside the sprint window*.
   */
  const members = await db.task.findMany({
    where: { sprintId: sprint.id, recurringId: null },
    select: {
      status: true,
      recurrence: true,
      _count: {
        select: {
          occurrences: { where: { completedAt: { gte: sprint.startsOn } } },
        },
      },
    },
  });

  const done = members.filter(
    (task) =>
      task.status === "done" ||
      (task.recurrence !== "none" && task._count.occurrences > 0),
  ).length;

  const startsOn = dayKey(sprint.startsOn);
  const endsOn = dayKey(sprint.endsOn);
  const totalDays = daysBetweenKeys(startsOn, endsOn) + 1;

  return {
    id: sprint.id,
    name: sprint.name,
    goal: sprint.goal,
    startsOn,
    endsOn,
    totalDays,
    dayNumber: Math.min(
      Math.max(daysBetweenKeys(startsOn, today) + 1, 1),
      totalDays,
    ),
    daysLeft: daysBetweenKeys(today, endsOn),
    done,
    total: members.length,
  };
}

export type FocusReason = "doing" | "overdue" | "today" | "sprint";

/**
 * Section 1 of Today, rewritten around the sprint.
 *
 * It is the union of two sets, not one: the sprint's open tasks, *and* anything
 * due today or overdue whether or not it made the sprint. A due date is a
 * promise to the outside world — "the TikTok account has to exist before the
 * warm-up week starts" doesn't stop being true because sprint planning missed
 * it — so it appears here regardless, flagged, and can be pulled into the
 * sprint in one tap.
 *
 * The ordering is the whole value of the screen: what you already started, then
 * what is late, then what is due, then the rest of the commitment.
 */
export async function getFocus(sprintId: string | null, limit = 8) {
  const today = todayKey();
  const endOfToday = new Date(`${today}T23:59:59.999Z`);

  const tasks = await db.task.findMany({
    where: {
      status: { not: "done" },
      // Snapshots are completed by definition, but be explicit: a recurring
      // task is represented here by its one live row.
      recurringId: null,
      OR: [
        ...(sprintId ? [{ sprintId }] : []),
        { dueDate: { lte: endOfToday } },
      ],
    },
    select: focusSelect,
    orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }],
  });

  const ranked = tasks
    .map((task) => {
      const due = task.dueDate ? dayKey(task.dueDate) : null;
      const reason: FocusReason =
        task.status === "doing"
          ? "doing"
          : due !== null && due < today
            ? "overdue"
            : due === today
              ? "today"
              : "sprint";
      return { ...task, reason };
    })
    .sort(
      (a, b) =>
        RANK[a.reason] - RANK[b.reason] ||
        (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity) ||
        a.sortOrder - b.sortOrder,
    );

  return { tasks: ranked.slice(0, limit), total: ranked.length };
}

const RANK: Record<FocusReason, number> = {
  doing: 0,
  overdue: 1,
  today: 2,
  sprint: 3,
};

/**
 * "I've run out of sprint — now what."
 *
 * Deliberately not the whole backlog. Two small, differently-shaped answers:
 * the next few tasks from each `main` project (the pending work you'd pick up
 * anyway), and the Experiments track across everything (the things you wanted
 * to try and never got to). Anything else is a trip to the Hunt Board, which is
 * a decision rather than an interruption.
 */
export async function getUpNext(sprintId: string | null, perProject = 3) {
  const [pending, ideas] = await Promise.all([
    db.task.findMany({
      where: {
        status: "open",
        sprintId: null,
        recurringId: null,
        track: { not: "Experiments" },
        project: { priority: "main", status: { in: ["active", "simmering"] } },
      },
      select: focusSelect,
      orderBy: [{ project: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    }),
    db.task.findMany({
      where: {
        status: "open",
        sprintId: null,
        track: "Experiments",
        recurringId: null,
      },
      select: focusSelect,
      orderBy: [{ createdAt: "desc" }],
      take: 5,
    }),
  ]);

  // Per-project caps have to happen here — Postgres can do it with a window
  // function but Prisma's query builder can't, and the list is small enough
  // that a LIMIT per group would be more machinery than it saves.
  const byProject = new Map<string, typeof pending>();
  for (const task of pending) {
    const key = task.project?.id ?? "none";
    const bucket = byProject.get(key);
    if (bucket) {
      if (bucket.length < perProject) bucket.push(task);
    } else {
      byProject.set(key, [task]);
    }
  }

  return {
    groups: [...byProject.values()].map((tasks) => ({
      projectName: tasks[0].project?.name ?? "One-offs",
      color: tasks[0].area.color,
      tasks,
    })),
    ideas,
    // What "everything else" adds up to, so the link to the Hunt Board can be
    // honest about how much it is hiding instead of pretending it's a detour.
    backlogTotal: await db.task.count({
      where: {
        status: { not: "done" },
        recurringId: null,
        ...(sprintId ? { sprintId: null } : {}),
      },
    }),
  };
}


/**
 * "While you're in it" — the other work on a project you are already inside
 * today.
 *
 * Utaitai is the case this exists for. Its content is produced in two sittings
 * a week (Wednesday and Sunday), and those are the only two days the project
 * reliably gets opened at all. Everything else on it — ship the mobile builds,
 * talk to users, try a new format — is `side`-tier maintenance that no sprint
 * is ever going to claim, so without this it simply never surfaces.
 *
 * Keyed on a *recurring* task due today rather than on the weekday, because the
 * schedule is data: re-tick the batch task to Tuesday and Friday and this
 * follows, with nothing to keep in step.
 *
 * The tasks offered are deliberately not from the sprint — the sprint is
 * already the card above this one. These are the backlog rows that are cheap
 * *right now* because the context is loaded, and no other moment makes them
 * cheap.
 */
export async function getBandwidth(perProject = 3) {
  const today = todayKey();

  const anchors = await db.task.findMany({
    where: {
      status: { not: "done" },
      recurringId: null,
      // Weekly and monthly only. A *daily* habit does not create a special
      // context — anchoring on one would put this card on the screen every
      // single day, which is how it becomes wallpaper. The projects behind a
      // daily task are surfaced by "Next up" instead, which is what that is
      // for. What this card is about is the periodic *sitting*: the twice-a-
      // week batch, where the project is open in front of you and the backlog
      // is briefly cheap.
      recurrence: { in: ["weekly", "monthly"] },
      dueDate: { lte: new Date(`${today}T23:59:59.999Z`) },
      projectId: { not: null },
    },
    select: {
      id: true,
      title: true,
      project: { select: { id: true, name: true, slug: true } },
      area: { select: { color: true } },
    },
  });

  if (anchors.length === 0) return [];

  // One entry per project even if two of its recurring tasks land today —
  // "while you're in Utaitai" is true once, not twice.
  const byProject = new Map<string, (typeof anchors)[number]>();
  for (const anchor of anchors) {
    if (anchor.project && !byProject.has(anchor.project.id)) {
      byProject.set(anchor.project.id, anchor);
    }
  }

  const groups = await Promise.all(
    [...byProject.values()].map(async (anchor) => {
      const tasks = await db.task.findMany({
        where: {
          projectId: anchor.project!.id,
          status: "open",
          recurringId: null,
          recurrence: "none",
          sprintId: null,
        },
        select: focusSelect,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: perProject,
      });

      return {
        anchorTitle: anchor.title,
        projectName: anchor.project!.name,
        projectSlug: anchor.project!.slug,
        color: anchor.area.color,
        tasks,
      };
    }),
  );

  // A project whose backlog is empty has nothing to offer, and an empty
  // heading is worse than no card.
  return groups.filter((group) => group.tasks.length > 0);
}

/**
 * Roll the sprint over when its week has run out.
 *
 * A sprint that has to be closed and re-created by hand stops happening within
 * a fortnight, and what is left behind is worse than no sprint at all: Today
 * keeps rendering last week's commitment as though it were this week's, so the
 * one screen that is supposed to answer "what now" quietly starts lying.
 *
 * Called on render from Today, the same way `ensureSeriesSlots` is — this app
 * has no scheduler and does not need one, because the rollover only has to have
 * happened by the time someone looks.
 *
 * The leftovers go back to the **backlog**, not into the new sprint. Rolling
 * them forward is how a sprint becomes a second, permanent to-do list: the
 * unfinished accumulate, next week starts full, and the commitment stops
 * meaning anything (CLAUDE.md §6). Finished tasks keep their `sprintId` — that
 * is the record of what the week actually produced.
 */
export type Rollover = {
  closedName: string;
  /** Unfinished tasks handed back to the backlog. */
  carried: number;
  done: number;
} | null;

export async function ensureActiveSprint(): Promise<Rollover> {
  const today = todayKey();

  const active = await db.sprint.findFirst({
    where: { status: "active" },
    orderBy: { startsOn: "desc" },
  });

  if (active && dayKey(active.endsOn) >= today) return null;

  // Monday-to-Sunday around today. `startOfWeek` does the arithmetic on day
  // strings via UTC, so this doesn't lose or gain a day at a DST boundary.
  const startsOn = startOfWeek(today);
  let endsOn = addDays(startsOn, 6);

  // ...except when that leaves almost no week. Rolling over on a Saturday or
  // Sunday would otherwise mint a sprint with one or two days in it: you plan
  // eight things, and on Monday morning all eight go straight back to the
  // backlog having never been reachable. A stub sprint is worse than a long
  // one, so a rollover this late runs through the *following* Sunday.
  if (daysBetweenKeys(today, endsOn) < 2) endsOn = addDays(endsOn, 7);

  return db.$transaction(async (tx) => {
    let closedName = "";
    let carried = 0;
    let done = 0;

    if (active) {
      done = await tx.task.count({
        where: { sprintId: active.id, status: "done", recurringId: null },
      });
      const released = await tx.task.updateMany({
        where: { sprintId: active.id, status: { not: "done" } },
        data: { sprintId: null },
      });
      carried = released.count;

      await tx.sprint.update({
        where: { id: active.id },
        data: { status: "done", closedAt: new Date() },
      });
      closedName = active.name;
    }

    // Numbered off the total rather than off the last name — "Week 12" parsed
    // out of a sprint you renamed to "Launch week" is a crash waiting to
    // happen, and the count is the thing that is actually monotonic.
    const number = (await tx.sprint.count()) + 1;

    await tx.sprint.create({
      data: {
        name: `Week ${number}`,
        startsOn: new Date(`${startsOn}T00:00:00.000Z`),
        endsOn: new Date(`${endsOn}T00:00:00.000Z`),
        status: "active",
      },
    });

    return active ? { closedName, carried, done } : null;
  });
}

/**
 * What to put in an empty sprint.
 *
 * An auto-created sprint arrives empty, and "plan it" with no starting point is
 * the same blank page the Hunt Board already is — which is the thing the sprint
 * was invented to avoid. So the banner comes with an answer already filled in,
 * in the order a week actually earns:
 *
 * 1. Anything overdue. A due date is a promise to the outside world and it did
 *    not stop being true because last week ended.
 * 2. Anything due inside this sprint's window.
 * 3. The next few rows from each `main` project, to fill out the rest.
 *
 * Capped, because a "suggested" sprint of thirty is not a suggestion.
 */
export async function getSprintSuggestion(sprint: SprintSummary, limit = 8) {
  const today = todayKey();

  const [dated, pending] = await Promise.all([
    db.task.findMany({
      where: {
        status: { not: "done" },
        sprintId: null,
        recurringId: null,
        dueDate: { lte: new Date(`${sprint.endsOn}T23:59:59.999Z`) },
      },
      select: focusSelect,
      orderBy: [{ dueDate: "asc" }],
    }),
    db.task.findMany({
      where: {
        status: "open",
        sprintId: null,
        recurringId: null,
        project: { priority: "main", status: "active" },
      },
      select: focusSelect,
      orderBy: [{ project: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      take: limit * 2,
    }),
  ]);

  const seen = new Set(dated.map((task) => task.id));
  const picked = [
    ...dated,
    ...pending.filter((task) => !seen.has(task.id)),
  ].slice(0, limit);

  return picked.map((task) => ({
    ...task,
    overdue: task.dueDate !== null && dayKey(task.dueDate) < today,
  }));
}
