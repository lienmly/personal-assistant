import { db } from "@/lib/db";
import { kindRank } from "@/lib/doc-kinds";

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
 * The Projects surface. Every project, including archived ones — the roster is
 * the complete record, and the status chips filter it.
 *
 * Tier first: "which of these actually matters" is the question the roster is
 * opened with, and status-then-recency answered a different one — an active
 * side project sorted above a main one that had been quiet for a week.
 *
 * `lastTouchedAt` is a real timestamp, not a `@db.Date`, so it formats in local
 * time (CLAUDE.md §6, "Dates are a trap here").
 */
export async function getRoster() {
  const [projects, openMarks] = await Promise.all([
    db.project.findMany({
      orderBy: [
        { priority: "asc" },
        { status: "asc" },
        { lastTouchedAt: "desc" },
      ],
      include: {
        area: { select: { name: true, color: true } },
        _count: { select: { drops: true } },
        // Titles only. The panel lists them and links out to `/docs` to read
        // one — a 440px drawer is not where you read a vision statement, and
        // pulling every body in here would load the whole library to draw a
        // roster.
        docs: { select: { id: true, title: true, kind: true } },
      },
    }),
    db.mark.groupBy({
      by: ["projectId"],
      where: { status: { not: "done" }, projectId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const openByProject = new Map(
    openMarks.map((row) => [row.projectId, row._count._all]),
  );

  return projects.map((project) => {
    const idle = daysSince(project.lastTouchedAt);
    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      status: project.status,
      priority: project.priority,
      cadenceDays: project.cadenceDays,
      areaId: project.areaId,
      areaName: project.area.name,
      areaColor: project.area.color,
      idle,
      touchedLabel:
        idle === 0
          ? "Touched today"
          : `${idle}d since ${dayFormat.format(project.lastTouchedAt)}`,
      // Only an *active* project can drift — same rule as `getMomentum`, and
      // for the same reason: demoting to simmering has to actually silence the
      // warning or the nagging becomes unquittable.
      drifting:
        project.status === "active" &&
        project.cadenceDays !== null &&
        idle > project.cadenceDays,
      openMarks: openByProject.get(project.id) ?? 0,
      drops: project._count.drops,
      docs: [...project.docs].sort(
        (a, b) =>
          kindRank(a.kind) - kindRank(b.kind) || a.title.localeCompare(b.title),
      ),
    };
  });
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
  const [projects, openMarks] = await Promise.all([
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
    db.mark.groupBy({
      by: ["projectId"],
      where: { status: { not: "done" }, projectId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const openByProject = new Map(
    openMarks.map((row) => [row.projectId, row._count._all]),
  );

  return projects
    .map((project) => {
      const idle = daysSince(project.lastTouchedAt);
      return {
        ...project,
        idle,
        openMarks: openByProject.get(project.id) ?? 0,
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
