import { CalendarClock, Radio, Swords, TrendingUp } from "lucide-react";

import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceHeader } from "@/components/ui/surface-header";

export const metadata = { title: "Today · Clan Centurio" };

/**
 * The four bands from CLAUDE.md §6, in priority order: what's due, what ships
 * today, what's scheduled, and which projects are drifting.
 */
export default function TodayPage() {
  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <>
      <SurfaceHeader
        title="Today"
        tagline="What needs you right now — nothing else."
        meta={dateLabel}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Marks due" value="0" note="Nothing overdue" />
        <StatTile label="Drops going out" value="0" note="No content scheduled" />
        <StatTile label="Active projects" value="0" note="Add your first" />
        <StatTile
          label="Needs attention"
          value="—"
          tone="dark"
          note="Drift warnings land in Phase 2"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card>
            <CardHeader title="Marks due" count="0 open" />
            <EmptyState
              icon={Swords}
              title="No marks on the board"
              body="Tasks due today and anything overdue will collect here, newest hunts first."
              phase="Phase 2"
            />
          </Card>

          <Card>
            <CardHeader title="Going out today" count="0 drops" />
            <EmptyState
              icon={Radio}
              title="Nothing publishing today"
              body="Content scheduled across YouTube, TikTok, Instagram and X shows up here with its channels."
              phase="Phase 3"
            />
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
            <EmptyState
              icon={TrendingUp}
              title="No projects to track"
              body="Every project's last-touched date lands here, so the quiet ones surface before they drift."
              phase="Phase 2"
            />
          </Card>
        </div>
      </div>
    </>
  );
}
