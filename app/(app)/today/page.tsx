import Link from "next/link";
import { CalendarClock, Flag, Radio, TrendingUp } from "lucide-react";

import { Agenda } from "@/components/today/agenda";
import {
  Bandwidth,
  type BandwidthGroupView,
} from "@/components/today/bandwidth";
import { FocusList } from "@/components/today/focus-list";
import { GoingOut } from "@/components/today/going-out";
import { Momentum, type MomentumView } from "@/components/today/momentum";
import type {
  FocusTaskView,
  GoingOutView,
  NextGroupView,
  NextTaskView,
} from "@/components/today/types";
import { UpNext } from "@/components/today/up-next";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceHeader } from "@/components/ui/surface-header";
import { getAgenda } from "@/lib/calendar";
import { minutesOfDay } from "@/lib/calendar-keys";
import { getMomentum } from "@/lib/projects";
import {
  dayKey,
  getActiveSprint,
  getBandwidth,
  getFocus,
  getUpNext,
} from "@/lib/sprints";
import { ensureSeriesSlots, getGoingOutToday } from "@/lib/studio";
import { repeatLabel } from "@/lib/task-view";
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
 * Today: what needs you right now, and nothing else.
 *
 * The screen is built around the sprint (CLAUDE.md §6). Before it existed, the
 * top card was "every task with a due date" — which meant it was either empty
 * or the one project that happened to have due dates, and the *real* answer to
 * "what am I doing today" was sixty rows away on the Hunt Board. Now the top
 * card is the week's commitment, ordered so the first row is the answer, and
 * the backlog is one deliberate click below it.
 */
export default async function TodayPage() {
  // Today is the screen that actually gets opened, so it's the honest place to
  // keep the daily cadence materialised — not just Studio.
  await ensureSeriesSlots();

  const sprint = await getActiveSprint();
  const today = todayKey();

  const [focus, upNext, items, momentum, agenda, bandwidth] = await Promise.all([
    getFocus(sprint?.id ?? null),
    getUpNext(sprint?.id ?? null),
    getGoingOutToday(),
    getMomentum(),
    getAgenda(today),
    getBandwidth(),
  ]);

  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const focusViews: FocusTaskView[] = focus.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    link: task.link,
    track: task.track,
    status: task.status,
    dueLabel: task.dueDate
      ? dayKey(task.dueDate) === today
        ? "Today"
        : dueFormat.format(task.dueDate)
      : null,
    reason: task.reason,
    inSprint: sprint !== null && task.sprintId === sprint.id,
    projectName: task.project?.name ?? null,
    areaColor: task.area.color,
    repeatLabel: repeatLabel(task),
  }));

  const toNextView = (task: {
    id: string;
    title: string;
    track: string | null;
    link: string | null;
  }): NextTaskView => ({
    id: task.id,
    title: task.title,
    track: task.track,
    link: task.link,
  });

  const nextGroups: NextGroupView[] = upNext.groups.map((group) => ({
    projectName: group.projectName,
    color: group.color,
    tasks: group.tasks.map(toNextView),
  }));

  const bandwidthGroups: BandwidthGroupView[] = bandwidth.map((group) => ({
    anchorTitle: group.anchorTitle,
    projectName: group.projectName,
    projectSlug: group.projectSlug,
    color: group.color,
    tasks: group.tasks.map(toNextView),
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

  const momentumViews: MomentumView[] = momentum.map((project) => ({
    id: project.id,
    name: project.name,
    areaName: project.area.name,
    areaColor: project.area.color,
    status: project.status,
    priority: project.priority,
    touchedLabel:
      project.idle === 0
        ? "Today"
        : project.idle === 1
          ? "Yesterday"
          : `${project.idle}d ago`,
    idle: project.idle,
    openTasks: project.openTasks,
    cadenceDays: project.cadenceDays,
    drifting: project.drifting,
  }));

  const drifting = momentumViews.filter((project) => project.drifting).length;
  const late = focusViews.filter((task) => task.reason === "overdue").length;
  const outstanding = contentViews.filter((item) =>
    item.channels.some((channel) => channel.state !== "published"),
  ).length;

  return (
    <>
      <SurfaceHeader
        title="Today"
        tagline="What needs you right now — nothing else."
        meta={dateLabel}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* The one dark tile on the screen. The sprint is the frame everything
            else on Today hangs off, so it gets the single hero treatment the
            reference reserves for the most important number. */}
        <StatTile
          label={sprint ? `Sprint · ${sprint.name}` : "Sprint"}
          value={sprint ? String(sprint.done) : "—"}
          tail={sprint ? `/${sprint.total}` : undefined}
          tone="dark"
          note={
            sprint
              ? sprint.daysLeft < 0
                ? `Ended ${-sprint.daysLeft}d ago — close it out`
                : sprint.daysLeft === 0
                  ? "Last day"
                  : `${sprint.daysLeft} days left`
              : "Nothing committed — plan one on the Hunt Board"
          }
        />
        <StatTile
          label="On the list"
          value={String(focus.total)}
          note={
            late > 0
              ? `${late} overdue`
              : focus.total === 0
                ? "Clear"
                : "Nothing overdue"
          }
        />
        <StatTile
          label="Content going out"
          value={String(contentViews.length)}
          note={
            contentViews.length === 0
              ? "No content scheduled"
              : outstanding === 0
                ? "All posted"
                : `${outstanding} still to post`
          }
        />
        <StatTile
          label="Needs attention"
          value={String(drifting)}
          note={
            drifting === 0
              ? "Nothing drifting"
              : `${drifting === 1 ? "project is" : "projects are"} past cadence`
          }
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card>
            <CardHeader
              title={sprint ? "This sprint" : "Due and overdue"}
              count={`${focus.total} open`}
            />
            {sprint?.goal && (
              <p className="-mt-2 mb-3 text-[13px] leading-relaxed text-muted">
                {sprint.goal}
              </p>
            )}
            {focusViews.length > 0 ? (
              <FocusList
                tasks={focusViews}
                total={focus.total}
                sprintId={sprint?.id ?? null}
              />
            ) : (
              <EmptyState
                icon={Flag}
                title={sprint ? "Sprint's clear" : "No sprint running"}
                body={
                  sprint
                    ? "Everything you committed to this week is done. Have a look at what's next below, or close the sprint out and plan the next one."
                    : "A sprint is the handful of tasks that are actually this week's work. Start one on the Hunt Board and this becomes the only list you need to read."
                }
              />
            )}
            <div className="mt-4 border-t border-line/60 pt-4">
              <UpNext
                groups={nextGroups}
                ideas={upNext.ideas.map(toNextView)}
                backlogTotal={upNext.backlogTotal}
                sprintId={sprint?.id ?? null}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Going out today"
              count={`${contentViews.length} ${contentViews.length === 1 ? "item" : "items"}`}
            />
            {contentViews.length > 0 ? (
              <GoingOut items={contentViews} />
            ) : (
              <EmptyState
                icon={Radio}
                title="Nothing publishing today"
                body="Content publishing today shows up here with its channels. Tap a channel to mark it posted."
              />
            )}
            <Link
              href="/studio"
              className="mt-3 inline-block text-[12px] text-muted transition-colors duration-(--duration-quick) hover:text-ink"
            >
              Open the Content Studio →
            </Link>
          </Card>

          {/* Only on the days a recurring task has already put you inside a
              project — otherwise this card does not exist. See getBandwidth. */}
          {bandwidthGroups.length > 0 && (
            <Card>
              <CardHeader
                title="While you’re in it"
                hint="If you have the bandwidth"
              />
              <Bandwidth
                groups={bandwidthGroups}
                sprintId={sprint?.id ?? null}
              />
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-5">
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
                body="Appointments, standing blocks and anything else that happens at a set time. Add one from the calendar."
              />
            )}
            <Link
              href={`/calendar?view=day&date=${today}`}
              className="mt-3 inline-block text-[12px] text-muted transition-colors duration-(--duration-quick) hover:text-ink"
            >
              Open the calendar →
            </Link>
          </Card>

          <Card>
            <CardHeader title="Momentum" hint="Last touched" />
            {momentumViews.length > 0 ? (
              <Momentum projects={momentumViews} />
            ) : (
              <EmptyState
                icon={TrendingUp}
                title="No projects to track"
                body="Every project's last-touched date lands here, so the quiet ones surface before they drift."
              />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
