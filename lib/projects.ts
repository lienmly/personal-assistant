import { db } from "@/lib/db";

/** Whole days since a timestamp. Shared so Today and Projects can't disagree
 *  about what "3d since" means. */
export function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
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
        b.lastTouchedAt.getTime() - a.lastTouchedAt.getTime(),
    );
}
