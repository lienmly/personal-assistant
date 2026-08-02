import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Radio, Repeat } from "lucide-react";

import type { AreaView, BoardProjectView, TaskView } from "@/components/board/types";
import { ProjectDocs, type DocView } from "@/components/projects/project-docs";
import { ProjectTasks } from "@/components/projects/project-tasks";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { Markdown } from "@/components/ui/markdown";
import { db } from "@/lib/db";
import { getProjectDetail } from "@/lib/project-detail";
import { getActiveSprint } from "@/lib/sprints";
import { toTaskView } from "@/lib/task-view";
import { cn, todayKey } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** `dueDate` is a `@db.Date` — UTC midnight standing in for a local day — so it
 *  formats in UTC. `publishAt` and `updatedAt` are real instants and format
 *  local. Both rules are CLAUDE.md §6; getting them the same way round is what
 *  makes a date render a day early. */
const stampFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const TABS = ["overview", "tasks", "content", "docs"] as const;
type Tab = (typeof TABS)[number];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await db.project.findUnique({
    where: { slug },
    select: { name: true },
  });
  return { title: `${project?.name ?? "Project"} · Clan Centurio` };
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);

  const [detail, sprint, projects, areas] = await Promise.all([
    getProjectDetail(slug),
    getActiveSprint(),
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

  if (!detail) notFound();

  const { project, tasks, items, docs, series, events, stats } = detail;
  const tab: Tab = TABS.includes(query.tab as Tab) ? (query.tab as Tab) : "overview";
  const today = todayKey();

  const taskViews: TaskView[] = tasks.map((task) => toTaskView(task, today));

  const docViews: DocView[] = docs.map((doc) => ({
    id: doc.id,
    slug: doc.slug,
    title: doc.title,
    body: doc.body,
    updatedLabel: `Edited ${stampFormat.format(doc.updatedAt)}`,
  }));

  const self: BoardProjectView = {
    id: project.id,
    name: project.name,
    slug: project.slug,
    status: project.status,
    priority: project.priority,
    areaId: project.areaId,
    area: project.area,
  };

  // The panel's project picker has to contain *this* project even when it is
  // archived — otherwise editing a task on an archived project silently
  // re-files it somewhere else on save.
  const panelProjects = projects.some((row) => row.id === project.id)
    ? projects
    : [self, ...projects];

  const nextTasks = taskViews
    .filter((task) => task.status !== "done")
    .slice(0, 5);
  const upcoming = items
    .filter((item) => item.stage !== "published")
    .slice(0, 5);

  return (
    <>
      <Link
        href="/projects"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors duration-(--duration-quick) hover:text-ink"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2} />
        Projects
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <span
              className="size-2 rounded-full"
              style={{ background: project.area.color }}
            />
            <span className="text-[12.5px] text-muted">
              {project.area.name}
            </span>
          </div>
          <h1 className="text-[30px] font-semibold leading-none tracking-tight text-ink md:text-[38px]">
            {project.name}
          </h1>
          {project.description && (
            <p className="mt-2.5 max-w-2xl text-sm text-muted">
              {project.description}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-card px-3 py-1.5 text-[12.5px] text-muted shadow-card">
            {project.priority === "main"
              ? "Main"
              : project.priority === "side"
                ? "Side"
                : "Later"}
          </span>
          <span
            className={cn(
              "rounded-full px-3 py-1.5 text-[12.5px] shadow-card",
              stats.drifting
                ? "bg-accent-soft text-accent"
                : "bg-card text-muted",
            )}
          >
            {stats.drifting
              ? `Drifting · ${stats.idle}d`
              : project.status[0].toUpperCase() + project.status.slice(1)}
          </span>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* The one dark tile on this screen (CLAUDE.md §9's black budget). Open
            work is what a project page is opened to find out. */}
        <StatTile
          label="Open"
          value={String(stats.open)}
          tail={stats.done > 0 ? ` /${stats.open + stats.done}` : undefined}
          tone="dark"
          note={
            stats.overdue > 0
              ? `${stats.overdue} overdue`
              : stats.inSprint > 0
                ? `${stats.inSprint} in this sprint`
                : "Nothing overdue"
          }
        />
        <StatTile
          label="Content"
          value={String(stats.scheduled)}
          note={
            stats.published > 0
              ? `${stats.published} published`
              : "Nothing published yet"
          }
        />
        <StatTile
          label="Docs"
          value={String(stats.docs)}
          note={stats.docs === 0 ? "Nothing written" : "On this project"}
        />
        <StatTile
          label="Last touched"
          value={stats.idle === 0 ? "Today" : `${stats.idle}d`}
          note={
            project.cadenceDays
              ? `Cadence every ${project.cadenceDays}d`
              : "No cadence set"
          }
        />
      </div>

      {/* A segmented control, filled-black for the selection — the one place
          the reference uses black at this size, and small enough not to
          compete with the hero tile above. */}
      <nav className="mb-5 flex flex-wrap gap-1.5 rounded-chip bg-inset p-1 sm:w-fit">
        {TABS.map((name) => (
          <Link
            key={name}
            href={`/projects/${project.slug}${name === "overview" ? "" : `?tab=${name}`}`}
            className={cn(
              "rounded-chip px-4 py-2 text-[13px] capitalize transition-[background-color,color] duration-(--duration-base) ease-soft",
              name === tab
                ? "bg-obsidian font-medium text-white"
                : "text-muted hover:text-ink",
            )}
          >
            {name}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="flex flex-col gap-5 lg:col-span-2">
            <Card>
              <CardHeader title="Next up" count={`${stats.open} open`} />
              {nextTasks.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {nextTasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center gap-3 rounded-tile bg-inset px-3.5 py-2.5"
                    >
                      {task.track && (
                        <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-[11px] text-muted">
                          {task.track}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                        {task.title}
                      </span>
                      {task.dueLabel && (
                        <span
                          className={cn(
                            "shrink-0 text-[11.5px]",
                            task.overdue ? "text-accent" : "text-faint",
                          )}
                        >
                          {task.dueLabel}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-tile bg-inset px-4 py-6 text-center text-[13px] text-muted">
                  Nothing open. Add the next thing on the Tasks tab.
                </p>
              )}
              {stats.open > nextTasks.length && (
                <Link
                  href={`/projects/${project.slug}?tab=tasks`}
                  className="mt-3 inline-block text-[12.5px] text-muted hover:text-accent"
                >
                  {`All ${stats.open} tasks →`}
                </Link>
              )}
            </Card>

            {docViews.length > 0 && (
              <Card>
                <CardHeader
                  title={docViews[0].title}
                  hint={docViews[0].updatedLabel}
                />
                <Markdown source={docViews[0].body} skipLeadingHeading />
                <Link
                  href={`/projects/${project.slug}?tab=docs`}
                  className="mt-4 inline-block text-[12.5px] text-muted hover:text-accent"
                >
                  {docViews.length === 1
                    ? "Edit this doc →"
                    : `All ${docViews.length} docs →`}
                </Link>
              </Card>
            )}
          </div>

          <div className="flex flex-col gap-5">
            <Card>
              <CardHeader title="Coming up" />
              {upcoming.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {upcoming.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-2.5 rounded-tile bg-inset px-3.5 py-2.5"
                    >
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: item.brand.color }}
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                        {item.title || item.series?.name || "Empty slot"}
                      </span>
                      {item.publishAt && (
                        <span className="shrink-0 text-[11.5px] text-faint">
                          {stampFormat.format(item.publishAt)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-tile bg-inset px-4 py-6 text-center text-[13px] text-muted">
                  No content queued for this project.
                </p>
              )}
            </Card>

            {(series.length > 0 || events.length > 0) && (
              <Card>
                <CardHeader title="Standing" />
                <ul className="flex flex-col gap-1.5">
                  {series.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center gap-2.5 rounded-tile bg-inset px-3.5 py-2.5"
                    >
                      <Repeat className="size-3.5 shrink-0 text-faint" strokeWidth={2} />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                        {row.name}
                      </span>
                      <span className="shrink-0 text-[11.5px] text-faint">
                        {row.cadence}
                        {row.timeOfDay ? ` · ${row.timeOfDay}` : ""}
                      </span>
                    </li>
                  ))}
                  {events.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center gap-2.5 rounded-tile bg-inset px-3.5 py-2.5"
                    >
                      <CalendarDays className="size-3.5 shrink-0 text-faint" strokeWidth={2} />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                        {row.title}
                      </span>
                      <span className="shrink-0 text-[11.5px] text-faint">
                        {row.recurrence === "none"
                          ? stampFormat.format(row.start)
                          : row.recurrence}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === "tasks" && (
        <Card>
          <ProjectTasks
            tasks={taskViews}
            project={self}
            projects={panelProjects}
            areas={areas as AreaView[]}
            sprint={sprint}
          />
        </Card>
      )}

      {tab === "content" && (
        <Card>
          <CardHeader
            title="Content"
            count={`${items.length} ${items.length === 1 ? "item" : "items"}`}
          />
          {items.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {items.map((item, index) => (
                <li
                  key={item.id}
                  className="flex animate-rise items-center gap-3 rounded-tile bg-inset px-3.5 py-2.5"
                  style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: item.brand.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                    {item.title || item.series?.name || "Empty slot"}
                  </span>
                  <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-[11px] text-muted">
                    {item.stage}
                  </span>
                  {item.publishAt && (
                    <span className="hidden shrink-0 text-[11.5px] text-faint sm:block">
                      {stampFormat.format(item.publishAt)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-tile bg-inset px-6 py-10 text-center">
              <span className="mb-3 grid size-10 place-items-center rounded-full bg-card text-faint shadow-card">
                <Radio className="size-4.5" strokeWidth={1.8} />
              </span>
              <p className="text-sm font-medium text-ink">No content yet</p>
              <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-muted">
                Content carrying this project shows up here, whichever brand
                publishes it.
              </p>
            </div>
          )}
          <Link
            href="/studio"
            className="mt-4 inline-block text-[12.5px] text-muted hover:text-accent"
          >
            Open the Content Studio →
          </Link>
        </Card>
      )}

      {tab === "docs" && (
        <Card>
          <ProjectDocs projectId={project.id} docs={docViews} />
        </Card>
      )}
    </>
  );
}
