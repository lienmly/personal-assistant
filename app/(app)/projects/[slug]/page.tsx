import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Repeat } from "lucide-react";

import { Journal } from "@/components/areas/journal";
import type { AreaView, BoardProjectView, TaskView } from "@/components/board/types";
import { DocsTab, type DocView } from "@/components/docs/docs-tab";
import { NextUp } from "@/components/projects/next-up";
import { ProjectContent } from "@/components/projects/project-content";
import type {
  BrandView,
  ContentView,
  ProjectView,
} from "@/components/studio/types";
import { TaskList } from "@/components/tasks/task-list";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { Markdown } from "@/components/ui/markdown";
import { db } from "@/lib/db";
import { getJournal } from "@/lib/journal";
import { getProjectDetail } from "@/lib/project-detail";
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

const TABS = ["overview", "tasks", "content", "journal", "docs"] as const;
type Tab = (typeof TABS)[number];

/** The tab's label, where it differs from its slug. The slug stays "content"
 *  because it is in the URL and a rename would break every link already
 *  bookmarked; the label says "Social media", which is what it holds. */
const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  tasks: "Tasks",
  content: "Social media",
  journal: "Journal",
  docs: "Docs",
};

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

  const [detail, projects, areas, allBrands] = await Promise.all([
    getProjectDetail(slug),
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
    // Every brand, not just this project's — the content panel can re-file an
    // item onto any of them, and a picker missing the brand an item already
    // carries would silently move it on the first save.
    db.brand.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
        projectId: true,
        channels: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            platform: true,
            handle: true,
            label: true,
            state: true,
          },
        },
      },
    }),
  ]);

  if (!detail) notFound();

  const { project, tasks, items, docs, series, events, stats } = detail;
  const tab: Tab = TABS.includes(query.tab as Tab) ? (query.tab as Tab) : "overview";
  const today = todayKey();

  // Only the active tab's heavy read runs, the same rule the area page follows.
  // The journal pulls every entry and its media metadata for this project, which
  // is the one query here that grows without bound — no reason to run it to
  // render Overview. It waits on `detail` because it needs the project's id, so
  // it is a second round trip rather than a fifth parallel one; that costs one
  // query's latency on one tab, and nothing at all on the other four.
  const days =
    tab === "journal" ? await getJournal({ projectId: project.id }, today) : [];

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

  const brandViews: BrandView[] = allBrands.map((brand) => ({
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    color: brand.color,
    projectId: brand.projectId,
    channels: brand.channels,
  }));
  const ownBrandIds = new Set(project.brands.map((brand) => brand.id));
  const ownBrandViews = brandViews.filter((brand) => ownBrandIds.has(brand.id));

  // The Social media tab hands whole items to the same panel Studio opens, so
  // the mapping is the same one `app/(app)/studio/page.tsx` does — dates
  // formatted here rather than in the client, because Node's ICU and the
  // browser's disagree on separators and a date formatted on both sides is a
  // hydration mismatch (CLAUDE.md, `ContentView.publishLabel`).
  const todayLabel = new Date().toDateString();
  const contentViews: ContentView[] = items.map((item) => ({
    id: item.id,
    title: item.title,
    notes: item.notes,
    body: item.body,
    refUrl: item.refUrl,
    format: item.format,
    stage: item.stage,
    publishAt: item.publishAt?.toISOString() ?? null,
    slotDate: item.slotDate?.toISOString().slice(0, 10) ?? null,
    publishLabel: item.publishAt ? stampFormat.format(item.publishAt) : null,
    isToday: item.publishAt?.toDateString() === todayLabel,
    brand: item.brand,
    project: item.project,
    series: item.series,
    sourceItemId: item.sourceItemId,
    channels: item.channels,
  }));

  const nextTasks = taskViews
    .filter((task) => task.status !== "done")
    .slice(0, 5);
  const upcoming = items
    .filter((item) => item.stage !== "published")
    .slice(0, 5);

  return (
    <>
      {/* Back to Today, not to a roster — the roster was folded into Today on
          2026-08-05 and `/projects` no longer resolves. Today's project cards
          are what links here in the first place. */}
      <Link
        href="/today"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors duration-(--duration-quick) hover:text-ink"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2} />
        Today
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
          {/* The focal point, set apart from the description rather than run
              together with it: one says what this is, the other says what it
              is *for* right now, and they are only useful when you can tell
              which is which at a glance. Same line Today leads each project
              card with. */}
          {project.focus && (
            <p className="mt-3 max-w-2xl border-l-2 border-accent/40 pl-3 text-sm leading-relaxed text-ink">
              {project.focus}
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
            stats.overdue > 0 ? `${stats.overdue} overdue` : "Nothing overdue"
          }
        />
        {/* The note says accounts rather than published where there are any:
            Sleepy Cat has seven channels and no posts, and "Nothing published
            yet" was the whole story it could tell about its own presence. */}
        <StatTile
          label="Social media"
          value={String(stats.scheduled)}
          note={
            stats.channels > 0
              ? `${stats.channels} accounts · ${stats.channelsLive} live`
              : stats.published > 0
                ? `${stats.published} published`
                : "No accounts of its own"
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
              "rounded-chip px-4 py-2 text-[13px] transition-[background-color,color] duration-(--duration-base) ease-soft",
              name === tab
                ? "bg-obsidian font-medium text-white"
                : "text-muted hover:text-ink",
            )}
          >
            {TAB_LABELS[name]}
          </Link>
        ))}
      </nav>

      {/* `grid-cols-1` below is load-bearing, not decoration. A bare `grid`
          gets an *implicit* column sized `auto`, whose floor is the content's
          min-content width — so one long word or a wide card pushes the track
          past the container and the whole page scrolls sideways on a phone.
          Tailwind's `grid-cols-1` is `repeat(1, minmax(0, 1fr))`, which is the
          same `minmax(0, 1fr)` rule §9 records for hand-written templates. */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="flex flex-col gap-5 lg:col-span-2">
            <Card>
              <CardHeader title="Next up" count={`${stats.open} open`} />
              {nextTasks.length > 0 ? (
                <NextUp
                  tasks={nextTasks}
                  projects={panelProjects}
                  areas={areas as AreaView[]}
                />
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
                  No social media content queued for this project.
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
          <TaskList
            tasks={taskViews}
            defaults={{ projectId: project.id }}
            projects={panelProjects}
            areas={areas as AreaView[]}
          />
        </Card>
      )}

      {/* Two questions, deliberately kept apart — and now two chips over one
          board rather than two stacks of cards. "Posted as" is what this
          project's own accounts publish; "covered elsewhere" is what other
          people's accounts say about it. They still partition the rows exactly,
          so nothing is listed twice. See `ProjectContent`. */}
      {tab === "content" && (
        <ProjectContent
          project={{ id: project.id, name: project.name }}
          ownBrands={ownBrandViews}
          items={contentViews}
          brands={brandViews}
          projects={panelProjects as ProjectView[]}
        />
      )}

      {/* The devlog. Same component as the Baby area's journal, and the same
          noun: something that already happened, as opposed to the four tabs
          around it, which are all things that are owed or going out. A project
          keeps one for the reason an area does — "the level order finally
          reads" is worth having written down on the day it became true, and it
          is not a task, an event or a post. */}
      {tab === "journal" && (
        <Journal
          filing={{ fixed: { projectId: project.id } }}
          ownerName={project.name}
          days={days}
        />
      )}

      {tab === "docs" && (
        <Card>
          <DocsTab owner={{ projectId: project.id }} docs={docViews} />
        </Card>
      )}
    </>
  );
}
