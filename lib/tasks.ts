import { db } from "@/lib/db";

const taskSelect = {
  id: true,
  title: true,
  notes: true,
  link: true,
  track: true,
  status: true,
  dueDate: true,
  sortOrder: true,
  createdAt: true,
  sprintId: true,
  projectId: true,
  areaId: true,
} as const;

export type TaskRow = Awaited<ReturnType<typeof getHuntBoard>>["tasks"][number];

/**
 * Everything the Hunt Board needs. Done tasks are capped to the recent past —
 * the board is for planning, and an unbounded completed list would bury it.
 *
 * Projects come back ordered by `priority` first: Postgres sorts an enum by its
 * declaration order, and `ProjectPriority` is declared main → side → later
 * precisely so this line needs no CASE statement. The board leans on that to
 * decide which sections open expanded.
 */
export async function getHuntBoard() {
  const since = new Date();
  since.setDate(since.getDate() - 14);

  const [tasks, projects, areas] = await Promise.all([
    db.task.findMany({
      where: {
        OR: [
          { status: { not: "done" } },
          { completedAt: { gte: since } },
        ],
      },
      select: taskSelect,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    db.project.findMany({
      where: { status: { in: ["active", "simmering"] } },
      orderBy: [{ priority: "asc" }, { sortOrder: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        priority: true,
        areaId: true,
        area: { select: { id: true, name: true, color: true } },
      },
    }),
    db.area.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, color: true },
    }),
  ]);

  return { tasks, projects, areas };
}
