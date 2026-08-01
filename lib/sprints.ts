import { db } from "@/lib/db";
import { todayKey } from "@/lib/utils";

/**
 * The sprint layer. Everything here exists to answer one question — "what am I
 * working on right now" — without the answer being "here are sixty marks".
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
    include: { _count: { select: { marks: true } } },
  });
  if (!sprint) return null;

  const done = await db.mark.count({
    where: { sprintId: sprint.id, status: "done" },
  });

  const today = todayKey();
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
    total: sprint._count.marks,
  };
}

export type FocusReason = "doing" | "overdue" | "today" | "sprint";

/**
 * Section 1 of Today, rewritten around the sprint.
 *
 * It is the union of two sets, not one: the sprint's open marks, *and* anything
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

  const marks = await db.mark.findMany({
    where: {
      status: { not: "done" },
      OR: [
        ...(sprintId ? [{ sprintId }] : []),
        { dueDate: { lte: endOfToday } },
      ],
    },
    select: focusSelect,
    orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }],
  });

  const ranked = marks
    .map((mark) => {
      const due = mark.dueDate ? dayKey(mark.dueDate) : null;
      const reason: FocusReason =
        mark.status === "doing"
          ? "doing"
          : due !== null && due < today
            ? "overdue"
            : due === today
              ? "today"
              : "sprint";
      return { ...mark, reason };
    })
    .sort(
      (a, b) =>
        RANK[a.reason] - RANK[b.reason] ||
        (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity) ||
        a.sortOrder - b.sortOrder,
    );

  return { marks: ranked.slice(0, limit), total: ranked.length };
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
 * the next few marks from each `main` project (the pending work you'd pick up
 * anyway), and the Experiments track across everything (the things you wanted
 * to try and never got to). Anything else is a trip to the Hunt Board, which is
 * a decision rather than an interruption.
 */
export async function getUpNext(sprintId: string | null, perProject = 3) {
  const [pending, ideas] = await Promise.all([
    db.mark.findMany({
      where: {
        status: "open",
        sprintId: null,
        track: { not: "Experiments" },
        project: { priority: "main", status: { in: ["active", "simmering"] } },
      },
      select: focusSelect,
      orderBy: [{ project: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    }),
    db.mark.findMany({
      where: { status: "open", sprintId: null, track: "Experiments" },
      select: focusSelect,
      orderBy: [{ createdAt: "desc" }],
      take: 5,
    }),
  ]);

  // Per-project caps have to happen here — Postgres can do it with a window
  // function but Prisma's query builder can't, and the list is small enough
  // that a LIMIT per group would be more machinery than it saves.
  const byProject = new Map<string, typeof pending>();
  for (const mark of pending) {
    const key = mark.project?.id ?? "none";
    const bucket = byProject.get(key);
    if (bucket) {
      if (bucket.length < perProject) bucket.push(mark);
    } else {
      byProject.set(key, [mark]);
    }
  }

  return {
    groups: [...byProject.values()].map((marks) => ({
      projectName: marks[0].project?.name ?? "One-offs",
      color: marks[0].area.color,
      marks,
    })),
    ideas,
    // What "everything else" adds up to, so the link to the Hunt Board can be
    // honest about how much it is hiding instead of pretending it's a detour.
    backlogTotal: await db.mark.count({
      where: {
        status: { not: "done" },
        ...(sprintId ? { sprintId: null } : {}),
      },
    }),
  };
}

