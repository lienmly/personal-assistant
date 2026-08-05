import { db } from "@/lib/db";
import { TOP_LEVEL_ONLY } from "@/lib/task-view";

/** Whole days since a timestamp. Shared so Today and Projects can't disagree
 *  about what "3d since" means. */
export function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

/**
 * The projects that are *not* what you have on: paused and archived.
 *
 * This is what is left of the Projects roster, which was folded into Today on
 * 2026-08-05 (CLAUDE.md §6). The roster listed every project with its counts
 * and its last-touched date — which, once Today became project-first, was the
 * same list of the same projects a second time. What did not survive the fold
 * is the only part worth keeping: `getProjectBoards` shows `active` and
 * `simmering` only, so without this query an archived project is unreachable
 * and un-archiving it is impossible from the app at all.
 *
 * `lastTouchedAt` is a real timestamp, not a `@db.Date`, so it formats in local
 * time (CLAUDE.md §6, "Dates are a trap here").
 */
export async function getDormantProjects() {
  const projects = await db.project.findMany({
    where: { status: { in: ["paused", "archived"] } },
    orderBy: [{ status: "asc" }, { lastTouchedAt: "desc" }],
    select: {
      id: true,
      name: true,
      description: true,
      focus: true,
      status: true,
      priority: true,
      cadenceDays: true,
      areaId: true,
      lastTouchedAt: true,
      area: { select: { color: true } },
    },
  });

  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    description: project.description,
    focus: project.focus,
    status: project.status,
    priority: project.priority,
    cadenceDays: project.cadenceDays,
    areaId: project.areaId,
    areaColor: project.area.color,
    touchedLabel: `${dayFormat.format(project.lastTouchedAt)}`,
  }));
}

/**
 * Section 4 of Today: the answer to "which projects am I actually following?"
 *
 * Sorted drifting-first, then most-recently-touched. CLAUDE.md §6 says "newest
 * first", which is right for the Projects roster — but on Today the whole point
 * is that a quiet project surfaces itself, and newest-first buries it at the
 * bottom, which is exactly where you stop reading.
 *
 * Archived and paused projects are excluded: a paused project isn't drifting,
 * it's parked, and nagging about it is how a dashboard starts generating guilt
 * instead of removing it.
 */
export async function getMomentum() {
  const [projects, openTasks] = await Promise.all([
    db.project.findMany({
      where: { status: { in: ["active", "simmering"] } },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        priority: true,
        cadenceDays: true,
        lastTouchedAt: true,
        area: { select: { name: true, color: true } },
      },
    }),
    db.task.groupBy({
      by: ["projectId"],
      // `recurringId: null` excludes the completed snapshots a recurring task
      // leaves behind — they are history, not open work, and counting them
      // would make a daily habit look like thirty tasks. `parentId: null`
      // excludes checklist items for the mirror reason: a job done in four
      // places is one open task, not five.
      where: {
        status: { not: "done" },
        projectId: { not: null },
        ...TOP_LEVEL_ONLY,
      },
      _count: { _all: true },
    }),
  ]);

  const openByProject = new Map(
    openTasks.map((row) => [row.projectId, row._count._all]),
  );

  return projects
    .map((project) => {
      const idle = daysSince(project.lastTouchedAt);
      return {
        ...project,
        idle,
        openTasks: openByProject.get(project.id) ?? 0,
        // Only an *active* project can drift. Demoting to simmering is the
        // whole escape hatch — if the warning survived it, "let it simmer"
        // would relieve nothing and the nagging would be unquittable, which is
        // precisely the guilt this section is designed not to generate.
        drifting:
          project.status === "active" &&
          project.cadenceDays !== null &&
          idle > project.cadenceDays,
      };
    })
    .sort(
      (a, b) =>
        Number(b.drifting) - Number(a.drifting) ||
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        b.lastTouchedAt.getTime() - a.lastTouchedAt.getTime(),
    );
}

/** Drifting still wins — a drifting side project is a real signal — but below
 *  that the main projects lead, because "how are my two big things doing" is
 *  the question this card is actually being asked. */
const PRIORITY_RANK: Record<string, number> = { main: 0, side: 1, later: 2 };
