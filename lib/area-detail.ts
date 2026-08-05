import { db } from "@/lib/db";
import { TASK_VIEW_SELECT, TOP_LEVEL_ONLY, toTaskView } from "@/lib/task-view";

/**
 * Everything one area is, on one page — `/areas/[slug]`.
 *
 * Areas were a filter and a colour for five phases: something a Task carried, a
 * heading in the sidebar tree, the thing that tinted an event. Nothing you could
 * *open*. That was fine while every area's contents were projects, because a
 * project has a page and the area was just the folder above it.
 *
 * The Baby area broke it (2026-08-05). It has no projects by design — caring for
 * a four-month-old is not a backlog (CLAUDE.md §6) — and yet it has a journal, a
 * vision worth writing down, and the occasional real task. All three had nowhere
 * to live, because every home in this app hung off a Project.
 *
 * So this is deliberately shaped like `getProjectDetail`: same tab pattern, same
 * one-query-per-section, and the docs tab is literally the same component. An
 * area page is *not* a nav surface (§6 — never one nav item per area); it is
 * reached from the sidebar tree, exactly the way a project page is.
 */
export async function getAreaDetail(slug: string) {
  const area = await db.area.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, color: true },
  });
  if (!area) return null;

  const [projects, tasks, docs, entryCount] = await Promise.all([
    db.project.findMany({
      where: { areaId: area.id, status: { in: ["active", "simmering"] } },
      orderBy: [{ priority: "asc" }, { sortOrder: "asc" }],
      select: { id: true, slug: true, name: true, focus: true },
    }),
    db.task.findMany({
      // Snapshots and checklist items excluded, the same filter every list of
      // *open* work carries — see `getHuntBoard`. Without the first a daily
      // habit appears once per occurrence; without the second its steps appear
      // beside it as tasks of their own.
      where: { areaId: area.id, ...TOP_LEVEL_ONLY },
      orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        ...TASK_VIEW_SELECT,
        completedAt: true,
        project: { select: { name: true, slug: true } },
      },
    }),
    db.doc.findMany({
      where: { areaId: area.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    db.journalEntry.count({ where: { areaId: area.id } }),
  ]);

  const open = tasks.filter((task) => task.status !== "done");

  return {
    area,
    projects,
    docs,
    entryCount,
    openCount: open.length,
    tasks: tasks.map((task) => ({
      ...toTaskView(task),
      projectName: task.project?.name ?? null,
      projectSlug: task.project?.slug ?? null,
    })),
  };
}

export type AreaDetail = NonNullable<Awaited<ReturnType<typeof getAreaDetail>>>;
