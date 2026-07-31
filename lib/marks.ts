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

/** Band 1 of Today: due today plus anything already overdue. */
export async function getDueMarks(limit = 7) {
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  return db.mark.findMany({
    where: { status: { not: "done" }, dueDate: { lte: endOfDay } },
    select: {
      ...markSelect,
      project: { select: { name: true, slug: true } },
      area: { select: { name: true, color: true } },
    },
    orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }],
    take: limit,
  });
}
