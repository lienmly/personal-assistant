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
    include: {
      area: { select: { id: true, name: true, color: true } },
      // The accounts this project runs, in one join rather than a second round
      // trip. Usually one; Forge has none.
      brands: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
          channels: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              platform: true,
              handle: true,
              label: true,
              url: true,
              state: true,
            },
          },
        },
      },
    },
  });
  if (!project) return null;

  const brandIds = project.brands.map((brand) => brand.id);

  const [tasks, items, docs, series, events] = await Promise.all([
    db.task.findMany({
      // Snapshots and checklist items excluded — see `getHuntBoard`. The live
      // recurring row carries the history via its `occurrences` count, and the
      // parent row carries its own checklist.
      where: { projectId: project.id, ...TOP_LEVEL_ONLY },
      orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      select: { ...TASK_VIEW_SELECT, completedAt: true },
    }),
    // Two questions, one query. **What this project publishes** is everything
    // going out of an account it runs — including the items about no project at
    // all, which for Coding Mom are 20 of its 31 and are its entire job. **What
    // is published about it** is anything carrying its id, whoever posts it:
    // Forge's five hardware essays go out of Coding Mom's account, and before
    // this the Forge page was the only place they appeared at all.
    //
    // Asking `projectId` alone was the bug — it showed Coding Mom 3 of 31, and
    // showed Sleepy Cat nothing about the seven accounts it has to build.
    db.contentItem.findMany({
      where: {
        OR: [{ projectId: project.id }, ...(brandIds.length > 0 ? [{ brandId: { in: brandIds } }] : [])],
      },
      orderBy: [{ publishAt: "asc" }, { createdAt: "desc" }],
      // The full item, not a summary of one. A project page's Social media tab
      // opens the same `ContentPanel` Studio does as of 2026-08-28, and a panel
      // handed a thin row would open with an empty script and no destinations —
      // a form that quietly loses what it did not know about. Same shape as a
      // Today project card carrying `edit: TaskView`: the columns ride along on
      // a query that was already running.
      select: {
        id: true,
        title: true,
        notes: true,
        body: true,
        refUrl: true,
        stage: true,
        format: true,
        publishAt: true,
        slotDate: true,
        sourceItemId: true,
        brandId: true,
        projectId: true,
        series: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true, slug: true, color: true } },
        project: { select: { id: true, name: true, slug: true } },
        channels: {
          orderBy: { channel: { sortOrder: "asc" } },
          select: {
            id: true,
            state: true,
            publishedUrl: true,
            channel: {
              select: {
                id: true,
                platform: true,
                handle: true,
                label: true,
              },
            },
          },
        },
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

  // **The own/elsewhere split is no longer computed here.** It used to be two
  // arrays feeding two stacks of cards; since 2026-08-28 the tab is one board
  // with the split as a filter chip, so `ProjectContent` partitions `items` by
  // `project.brands` itself. The rule is unchanged and still exact — a row that
  // matched both arms of the OR above (this project, posted from its own
  // account) is "posted as", so nothing is listed twice.

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
      // Counted over the union, not over `projectId` alone — the Coding Mom
      // project's real workload is the 31 items going out of its account, not
      // the 3 that happen to be *about* audience-building.
      scheduled: items.filter((item) => item.stage !== "published").length,
      published: items.filter((item) => item.stage === "published").length,
      channels: project.brands.reduce((n, b) => n + b.channels.length, 0),
      channelsLive: project.brands.reduce(
        (n, b) => n + b.channels.filter((c) => c.state === "live").length,
        0,
      ),
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
