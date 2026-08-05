import { db } from "@/lib/db";
import { daysSince } from "@/lib/projects";
import { TASK_VIEW_SELECT, TOP_LEVEL_ONLY } from "@/lib/task-view";
import { todayKey } from "@/lib/utils";

/**
 * Everything one project is, on one page.
 *
 * The roster answers "which of these matters"; this answers "what *is* this
 * one" — its tasks, the content it's producing, and the writing about it. Docs
 * used to live in `/docs/*.md`, one folder away from the work they describe and
 * a git commit away from being edited; a project page is where they were always
 * being looked for.
 *
 * One query per section rather than one nested `include`: the tasks want a
 * different ordering from the content, the content wants its channels, and
 * Postgres runs these five in parallel far more happily than it runs one
 * six-way join.
 */
export async function getProjectDetail(slug: string) {
  const project = await db.project.findUnique({
    where: { slug },
    include: { area: { select: { id: true, name: true, color: true } } },
  });
  if (!project) return null;

  const [tasks, items, docs, series, events] = await Promise.all([
    db.task.findMany({
      // Snapshots and checklist items excluded — see `getHuntBoard`. The live
      // recurring row carries the history via its `occurrences` count, and the
      // parent row carries its own checklist.
      where: { projectId: project.id, ...TOP_LEVEL_ONLY },
      orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      select: { ...TASK_VIEW_SELECT, completedAt: true },
    }),
    db.contentItem.findMany({
      where: { projectId: project.id },
      orderBy: [{ publishAt: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        stage: true,
        format: true,
        publishAt: true,
        series: { select: { name: true } },
        brand: { select: { name: true, color: true } },
      },
    }),
    db.doc.findMany({
      where: { projectId: project.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    db.series.findMany({
      where: { projectId: project.id, isActive: true },
      select: { id: true, name: true, cadence: true, timeOfDay: true },
    }),
    db.event.findMany({
      where: { projectId: project.id },
      orderBy: { start: "asc" },
      select: { id: true, title: true, start: true, recurrence: true },
    }),
  ]);

  const today = todayKey();
  const open = tasks.filter((task) => task.status !== "done");
  const idle = daysSince(project.lastTouchedAt);

  return {
    project,
    tasks,
    items,
    docs,
    series,
    events,
    stats: {
      open: open.length,
      done: tasks.length - open.length,
      overdue: open.filter(
        (task) =>
          task.dueDate !== null &&
          task.dueDate.toISOString().slice(0, 10) < today,
      ).length,
      scheduled: items.filter((item) => item.stage !== "published").length,
      published: items.filter((item) => item.stage === "published").length,
      docs: docs.length,
      idle,
      // Same rule as the roster and Today: only an `active` project can drift,
      // or "let it simmer" would relieve nothing.
      drifting:
        project.status === "active" &&
        project.cadenceDays !== null &&
        idle > project.cadenceDays,
    },
  };
}

/** Slugs for `generateStaticParams`-shaped uses and for the roster's links. */
export async function getProjectSlugs() {
  return (
    await db.project.findMany({ select: { slug: true } })
  ).map((row) => row.slug);
}
