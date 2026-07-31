import Link from "next/link";
import { CalendarClock, Radio, Swords, TrendingUp } from "lucide-react";

import { DueMarks } from "@/components/today/due-marks";
import { GoingOut } from "@/components/today/going-out";
import { Momentum, type MomentumView } from "@/components/today/momentum";
import type { DueMarkView, GoingOutView } from "@/components/today/types";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceHeader } from "@/components/ui/surface-header";
import { getDueMarks, getProjectCounts } from "@/lib/marks";
import { getMomentum } from "@/lib/projects";
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
 * The four sections from CLAUDE.md §6, in priority order: what's due, what
 * ships today, what's scheduled, and which projects are drifting.
 */
export default async function TodayPage() {
  // Today is the screen that actually gets opened, so it's the honest place to
  // keep the daily cadence materialised — not just Studio.
  await ensureSeriesSlots();

  const [{ marks, total }, drops, counts, momentum] = await Promise.all([
    getDueMarks(),
    getGoingOutToday(),
    getProjectCounts(),
    getMomentum(),
  ]);

  const today = todayKey();

  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const markViews: DueMarkView[] = marks.map((mark) => {
    const due = mark.dueDate!.toISOString().slice(0, 10);
    return {
      id: mark.id,
      title: mark.title,
      link: mark.link,
      track: mark.track,
      dueLabel: due === today ? "Today" : dueFormat.format(mark.dueDate!),
      overdue: due < today,
      projectName: mark.project?.name ?? null,
      areaColor: mark.area.color,
    };
  });

  const dropViews: GoingOutView[] = drops.map((drop) => ({
    id: drop.id,
    title: drop.title,
    stage: drop.stage,
    timeLabel: drop.publishAt ? timeFormat.format(drop.publishAt) : "",
    brandName: drop.brand.name,
    brandColor: drop.brand.color,
    projectName: drop.project?.name ?? null,
    seriesName: drop.series?.name ?? null,
    channels: drop.channels.map((row) => ({
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
    touchedLabel:
      project.idle === 0
        ? "Today"
        : project.idle === 1
          ? "Yesterday"
          : `${project.idle}d ago`,
    idle: project.idle,
    openMarks: project.openMarks,
    cadenceDays: project.cadenceDays,
    drifting: project.drifting,
  }));

  const drifting = momentumViews.filter((project) => project.drifting).length;
  const overdue = markViews.filter((mark) => mark.overdue).length;
  const outstanding = dropViews.filter((drop) =>
    drop.channels.some((channel) => channel.state !== "published"),
  ).length;

  return (
    <>
      <SurfaceHeader
        title="Today"
        tagline="What needs you right now — nothing else."
        meta={dateLabel}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Marks due"
          value={String(total)}
          note={
            overdue > 0
              ? `${overdue} overdue`
              : total > 0
                ? "All due today"
                : "Nothing overdue"
          }
        />
        <StatTile
          label="Drops going out"
          value={String(dropViews.length)}
          note={
            dropViews.length === 0
              ? "No content scheduled"
              : outstanding === 0
                ? "All posted"
                : `${outstanding} still to post`
          }
        />
        <StatTile
          label="Active projects"
          value={String(counts.active)}
          note={`${counts.openMarks} open marks`}
        />
        <StatTile
          label="Needs attention"
          value={String(drifting)}
          tone="dark"
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
              title="Marks due"
              count={`${total} due`}
            />
            {markViews.length > 0 ? (
              <DueMarks marks={markViews} total={total} />
            ) : (
              <EmptyState
                icon={Swords}
                title="Nothing due"
                body="Marks due today and anything overdue collect here. Give a mark a due date on the Hunt Board and it will show up."
              />
            )}
          </Card>

          <Card>
            <CardHeader
              title="Going out today"
              count={`${dropViews.length} ${dropViews.length === 1 ? "drop" : "drops"}`}
            />
            {dropViews.length > 0 ? (
              <GoingOut drops={dropViews} />
            ) : (
              <EmptyState
                icon={Radio}
                title="Nothing publishing today"
                body="Drops with today's publish time show up here with their channels. Tap a channel to mark it posted."
              />
            )}
            <Link
              href="/studio"
              className="mt-3 inline-block text-[12px] text-muted transition-colors duration-(--duration-quick) hover:text-ink"
            >
              Open Studio →
            </Link>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title="Agenda" hint="Today" />
            <EmptyState
              icon={CalendarClock}
              title="No events yet"
              body="Calendar events — including the baby's routine — will sit on this timeline."
              phase="Phase 4"
            />
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
