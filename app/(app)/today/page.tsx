import Link from "next/link";
import { CalendarClock, Radio } from "lucide-react";

import type { AreaView, BoardProjectView } from "@/components/board/types";
import { Agenda } from "@/components/today/agenda";
import { DoneMap } from "@/components/today/done-map";
import { GoingOut } from "@/components/today/going-out";
import { ProjectsCard } from "@/components/today/projects-card";
import type {
  GoingOutView,
  ProjectBoardView,
  TaskReason,
} from "@/components/today/types";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceHeader } from "@/components/ui/surface-header";
import { getAgenda } from "@/lib/calendar";
import { minutesOfDay } from "@/lib/calendar-keys";
import { db } from "@/lib/db";
import { getDormantProjects } from "@/lib/projects";
import { repeatLabel, toTaskView } from "@/lib/task-view";
import { getCompletionMap, getProjectBoards } from "@/lib/today";
import { ensureSeriesSlots, getGoingOutToday } from "@/lib/studio";
import { todayKey } from "@/lib/utils";

export const metadata = { title: "Today · Clan Centurio" };

export const dynamic = "force-dynamic";

// `dueDate` is a `@db.Date` — UTC midnight — so it is formatted in UTC. The
// publish *time* below is a real timestamp and is formatted locally. Two
// different rules, and mixing them is what put "today" on the wrong row once.
const dueFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Today: everything you have on, laid out so you can choose.
 *
 * **Rebuilt project-first on 2026-08-04, and the sprint is gone.** The sprint
 * was a good answer to "what is the one next thing" and the wrong instrument
 * here. It committed you to a fixed set of work a week ahead, then measured you
 * against it daily — and on a week where the baby takes the week, that stops
 * being a plan and becomes a running tally of your shortfall. The screen you
 * open twenty times a day cannot be the one that tells you you're behind.
 *
 * What replaces it is not a smaller list; it is a different unit. Each project
 * gets a card carrying the one line saying what it is aiming at and the few
 * rows most worth seeing, and the choice of what to do is left where it
 * belongs. Two consequences worth stating:
 *
 * - **The old Momentum card is folded in.** A list of every project's
 *   last-touched date sitting beside a list of every project was the same
 *   information twice; it is now a quiet line on each card.
 * - **Progress is shown backwards.** Instead of "3 of 8 done, 2 behind pace",
 *   there is a contribution map of what you actually ticked off. It cannot
 *   report a shortfall, because there is no target to fall short of — the only
 *   thing it can say is what you did.
 *
 * **The Projects roster folded in here on 2026-08-05**, one day later and for
 * the same reason the Momentum card did: it listed every project beside a
 * screen that already listed every project. Creating, editing and archiving a
 * project now happen on the cards below, so this is the only surface those
 * actions have. See `components/today/projects-card.tsx`.
 */
export default async function TodayPage() {
  // Today is the screen that actually gets opened, so it's the honest place to
  // keep the posting cadence materialised — not just the Social Media board.
  await ensureSeriesSlots();

  const today = todayKey();

  const [boards, history, items, agenda, dormant, areas, projects] =
    await Promise.all([
      getProjectBoards(),
      getCompletionMap(),
      getGoingOutToday(),
      getAgenda(today),
      // Both only exist for the settings panel, which moved onto this screen
      // when the Projects roster was folded in (CLAUDE.md §6).
      getDormantProjects(),
      db.area.findMany({
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, color: true },
      }),
      // The task panel's project picker. Same list the Hunt Board and a project
      // page hand it, so a task re-filed from Today lands where it would have
      // landed anywhere else.
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
    ]);

  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const boardViews: ProjectBoardView[] = boards.map((board) => ({
    id: board.id,
    name: board.name,
    slug: board.slug,
    focus: board.focus,
    description: board.description,
    priority: board.priority,
    areaName: board.areaName,
    areaColor: board.areaColor,
    touchedLabel: board.touchedLabel,
    drifting: board.drifting,
    edit: board.edit,
    openTotal: board.openTotal,
    overdue: board.overdue,
    tasks: board.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      link: task.link,
      track: task.track,
      status: task.status,
      dueLabel: task.dueDate
        ? task.due === today
          ? "Today"
          : dueFormat.format(task.dueDate)
        : null,
      reason: task.reason as TaskReason,
      areaColor: task.area.color,
      repeatLabel: repeatLabel(task),
      subtasks: task.subtasks,
      edit: toTaskView(task, today),
    })),
  }));

  const contentViews: GoingOutView[] = items.map((item) => ({
    id: item.id,
    title: item.title,
    stage: item.stage,
    timeLabel: item.publishAt ? timeFormat.format(item.publishAt) : "",
    brandName: item.brand.name,
    brandColor: item.brand.color,
    projectName: item.project?.name ?? null,
    seriesName: item.series?.name ?? null,
    channels: item.channels.map((row) => ({
      id: row.id,
      state: row.state,
      platform: row.channel.platform,
      handle: row.channel.handle,
      label: row.channel.label,
    })),
  }));

  const openTotal = boardViews.reduce((sum, board) => sum + board.openTotal, 0);
  const overdue = boardViews.reduce((sum, board) => sum + board.overdue, 0);
  const outstanding = contentViews.filter((item) =>
    item.channels.some((channel) => channel.state !== "published"),
  ).length;

  return (
    <>
      <SurfaceHeader
        title="Today"
        tagline="Everything you have on. Pick what fits the day."
        meta={dateLabel}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* The one dark tile on the screen (§9's budget of one). It used to be
            the sprint's done-against-committed; it is now simply what you got
            through today. The hero number should be an achievement, not a
            deficit — that swap is most of the point of this rebuild. */}
        <StatTile
          label="Ticked off today"
          value={String(history.todayCount)}
          tone="dark"
          note={
            history.streak > 0
              ? `${history.streak} day${history.streak === 1 ? "" : "s"} in a row`
              : "Whenever you get to it"
          }
        />
        <StatTile
          label="Projects on the go"
          value={String(boardViews.filter((b) => b.slug).length)}
          note={`${openTotal} open task${openTotal === 1 ? "" : "s"}`}
        />
        <StatTile
          label="Social media content"
          value={String(contentViews.length)}
          note={
            contentViews.length === 0
              ? "Nothing scheduled"
              : outstanding === 0
                ? "All posted"
                : `${outstanding} still to post`
          }
        />
        <StatTile
          label="Overdue"
          value={String(overdue)}
          note={overdue === 0 ? "Nothing late" : "Across all projects"}
        />
      </div>

      {/* `grid-cols-1` below `lg` — see the note on the project page's copy of
          this layout: an implicit `auto` track is floored at min-content and
          takes the page sideways with it. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card>
            <CardHeader
              title="Your projects"
              count={`${boardViews.filter((b) => b.slug).length} on the go`}
            />
            <ProjectsCard
              boards={boardViews}
              areas={areas}
              dormant={dormant}
              projects={projects as BoardProjectView[]}
              taskAreas={areas as AreaView[]}
            />
          </Card>

          <Card>
            <CardHeader
              title="Social media content going out today"
              count={`${contentViews.length} ${contentViews.length === 1 ? "item" : "items"}`}
            />
            {contentViews.length > 0 ? (
              <GoingOut items={contentViews} />
            ) : (
              <EmptyState
                icon={Radio}
                title="Nothing publishing today"
                body="Social media content publishing today shows up here with its channels. Tap a channel to mark it posted."
              />
            )}
            <Link
              href="/studio"
              className="mt-3 inline-block text-[12px] text-muted transition-colors duration-(--duration-quick) hover:text-ink"
            >
              Open Social Media →
            </Link>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title="Ticked off" hint="Last 6 months" />
            <DoneMap
              days={history.days}
              weeks={history.weeks}
              streak={history.streak}
              todayList={history.todayList}
            />
          </Card>

          <Card>
            <CardHeader
              title="Agenda"
              count={`${agenda.length} ${agenda.length === 1 ? "event" : "events"}`}
            />
            {agenda.length > 0 ? (
              <Agenda
                items={agenda}
                nowMinutes={minutesOfDay(new Date())}
                dayHref={`/calendar?view=day&date=${today}`}
              />
            ) : (
              <EmptyState
                icon={CalendarClock}
                title="Nothing on today"
                body="Appointments and anything else that happens at a set time. Nothing but you puts something here."
              />
            )}
            <Link
              href={`/calendar?view=day&date=${today}`}
              className="mt-3 inline-block text-[12px] text-muted transition-colors duration-(--duration-quick) hover:text-ink"
            >
              Open the calendar →
            </Link>
          </Card>
        </div>
      </div>
    </>
  );
}
