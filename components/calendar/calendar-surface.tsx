"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { EventPanel } from "@/components/calendar/event-panel";
import { Legend } from "@/components/calendar/item-chip";
import { MonthGrid } from "@/components/calendar/month-grid";
import { TimeGrid } from "@/components/calendar/time-grid";
import type {
  CalendarAreaView,
  CalendarItem,
  CalendarKind,
  CalendarProjectView,
  EventView,
} from "@/components/calendar/types";
import { EmptyState } from "@/components/ui/empty-state";
import { type CalendarView, shiftCursor } from "@/lib/calendar-keys";
import { cn } from "@/lib/utils";

const VIEWS: CalendarView[] = ["month", "week", "day"];

/**
 * The Calendar surface: toolbar, grid, panel.
 *
 * View and cursor live in the **URL**, not in component state. That keeps the
 * whole thing a server render — the day arithmetic, the queries and every date
 * label stay on the server, where they can't hydrate differently from how they
 * were sent — and it makes "the week of the 4th" a link you can go back to.
 * The only state here is which panel is open.
 */
export function CalendarSurface({
  view,
  cursor,
  areaSlug,
  days,
  byDay,
  events,
  counts,
  today,
  nowMinutes,
  dayLabels,
  areas,
  projects,
}: {
  view: CalendarView;
  cursor: string;
  areaSlug: string | null;
  days: string[];
  byDay: Record<string, CalendarItem[]>;
  events: Record<string, EventView>;
  counts: Record<CalendarKind, number>;
  today: string;
  nowMinutes: number | null;
  dayLabels: Record<string, string>;
  areas: CalendarAreaView[];
  projects: CalendarProjectView[];
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<
    { event: EventView | null; day: string } | null
  >(null);

  const href = (next: {
    view?: CalendarView;
    cursor?: string;
    area?: string | null;
  }) => {
    const params = new URLSearchParams();
    params.set("view", next.view ?? view);
    params.set("date", next.cursor ?? cursor);
    const area = next.area === undefined ? areaSlug : next.area;
    if (area) params.set("area", area);
    return `/calendar?${params.toString()}`;
  };

  const openEvent = (eventId: string) => {
    const event = events[eventId];
    if (event) setPanel({ event, day: event.startDay });
  };

  const total = counts.event + counts.mark + counts.drop;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Paging. `shiftCursor` knows a month steps by months and a week by
            seven days, so the same two buttons serve all three views. */}
        <div className="flex items-center gap-1 rounded-full bg-card p-1 shadow-card">
          <Link
            href={href({ cursor: shiftCursor(view, cursor, -1) })}
            aria-label="Previous"
            className="grid size-8 place-items-center rounded-full text-muted transition-[background-color,color,transform] duration-(--duration-base) ease-soft hover:bg-inset hover:text-ink active:scale-90"
          >
            <ChevronLeft className="size-4" strokeWidth={2.2} />
          </Link>
          <Link
            href={href({ cursor: today })}
            className="rounded-full px-3 py-1.5 text-[13px] font-medium text-ink transition-colors duration-(--duration-quick) hover:bg-inset"
          >
            Today
          </Link>
          <Link
            href={href({ cursor: shiftCursor(view, cursor, 1) })}
            aria-label="Next"
            className="grid size-8 place-items-center rounded-full text-muted transition-[background-color,color,transform] duration-(--duration-base) ease-soft hover:bg-inset hover:text-ink active:scale-90"
          >
            <ChevronRight className="size-4" strokeWidth={2.2} />
          </Link>
        </div>

        {/* The screen's one black element — a segmented control needs a filled
            state, and §9 names it as the exception. Nothing else here is dark. */}
        <div className="flex items-center gap-1 rounded-full bg-inset p-1">
          {VIEWS.map((option) => (
            <Link
              key={option}
              href={href({ view: option })}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[13px] capitalize transition-[background-color,color,transform] duration-(--duration-base) ease-soft active:scale-[0.97]",
                option === view
                  ? "bg-obsidian font-medium text-white"
                  : "text-muted hover:text-ink",
              )}
            >
              {option}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-inset p-1">
            <Link
              href={href({ area: null })}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12.5px] transition-[background-color,color] duration-(--duration-quick)",
                areaSlug === null
                  ? "bg-card font-medium text-ink shadow-card"
                  : "text-muted hover:text-ink",
              )}
            >
              All areas
            </Link>
            {areas.map((area) => (
              <Link
                key={area.id}
                href={href({ area: area.slug })}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] transition-[background-color,color] duration-(--duration-quick)",
                  areaSlug === area.slug
                    ? "bg-card font-medium text-ink shadow-card"
                    : "text-muted hover:text-ink",
                )}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: area.color }}
                />
                {area.name}
              </Link>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setPanel({
                event: null,
                // A new event lands on the day you're looking at — today when
                // that's on screen, otherwise the first day of the window.
                day: days.includes(today) ? today : days[0],
              })
            }
            className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-[13px] font-medium text-white transition-[background-color,transform] duration-(--duration-base) ease-soft hover:bg-accent-hover active:scale-[0.97]"
          >
            <Plus className="size-3.5" strokeWidth={2.4} />
            New event
          </button>
        </div>
      </div>

      <section className="animate-rise rounded-card bg-card p-4 shadow-card">
        {view === "month" ? (
          <MonthGrid
            days={days}
            byDay={byDay}
            cursor={cursor}
            today={today}
            onOpen={openEvent}
            onCreate={(day) => setPanel({ event: null, day })}
            onZoom={(day) => router.push(href({ view: "day", cursor: day }))}
          />
        ) : (
          <TimeGrid
            days={days}
            byDay={byDay}
            today={today}
            nowMinutes={nowMinutes}
            dayLabels={dayLabels}
            onOpen={openEvent}
            onCreate={(day) => setPanel({ event: null, day })}
          />
        )}

        {total === 0 && view !== "month" && (
          <EmptyState
            icon={CalendarDays}
            title="Nothing on"
            body="Events you add land here alongside mark due dates and the drops going out that day."
            className="mt-4 py-10"
          />
        )}

        <Legend counts={counts} />
      </section>

      {panel && (
        <EventPanel
          event={panel.event}
          areas={areas}
          projects={projects}
          defaultDay={panel.day}
          onClose={() => setPanel(null)}
        />
      )}
    </>
  );
}
