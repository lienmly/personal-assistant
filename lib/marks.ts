import { db } from "@/lib/db";

const markSelect = {
  id: true,
  title: true,
  notes: true,
  link: true,
  track: true,
  status: true,
  dueDate: true,
  sortOrder: true,
  createdAt: true,
  projectId: true,
  areaId: true,
} as const;

export type MarkRow = Awaited<ReturnType<typeof getHuntBoard>>["marks"][number];

/**
 * Everything the Hunt Board needs. Done marks are capped to the recent past —
 * the board is for planning, and an unbounded completed list would bury it.
 */
export async function getHuntBoard() {
  const since = new Date();
  since.setDate(since.getDate() - 14);

  const [marks, projects, areas] = await Promise.all([
    db.mark.findMany({
      where: {
        OR: [
          { status: { not: "done" } },
          { completedAt: { gte: since } },
        ],
      },
      select: markSelect,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    db.project.findMany({
      where: { status: { in: ["active", "simmering"] } },
      orderBy: [{ sortOrder: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        areaId: true,
        area: { select: { id: true, name: true, color: true } },
      },
    }),
    db.area.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, color: true },
    }),
  ]);

  return { marks, projects, areas };
}

/**
 * Section 1 of Today: due today plus anything already overdue.
 *
 * Capped, and the caller is told the true total — an unbounded list of every
 * overdue thing is the fastest way to make the screen you open twenty times a
 * day feel like a place to avoid.
 */
export async function getDueMarks(limit = 7) {
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const where = {
    status: { not: "done" as const },
    dueDate: { lte: endOfDay },
  };

  const [marks, total] = await Promise.all([
    db.mark.findMany({
      where,
      select: {
        ...markSelect,
        project: { select: { name: true, slug: true } },
        area: { select: { name: true, color: true } },
      },
      orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }],
      take: limit,
    }),
    db.mark.count({ where }),
  ]);

  return { marks, total };
}

/** Section 4's raw material, and the "active projects" tile. */
export async function getProjectCounts() {
  const [active, openMarks] = await Promise.all([
    db.project.count({ where: { status: "active" } }),
    db.mark.count({ where: { status: { not: "done" } } }),
  ]);
  return { active, openMarks };
}
