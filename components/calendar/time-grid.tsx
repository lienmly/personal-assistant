"use client";

import { useMemo } from "react";
import { Plus } from "lucide-react";

import { ItemChip } from "@/components/calendar/item-chip";
import type { CalendarItem } from "@/components/calendar/types";
import { cn } from "@/lib/utils";

const HOUR_PX = 54;
const PX_PER_MINUTE = HOUR_PX / 60;
/** The hours shown when nothing forces a wider range. Early enough for a 7am
 *  feed, late enough for an 18:00 item and an evening one after it. */
const DEFAULT_FROM = 7;
const DEFAULT_TO = 22;

/**
 * Lay overlapping blocks side by side.
 *
 * Without this a 07:00 feed and a 07:00 stand-up are drawn on top of each
 * other and the calendar silently shows one of them. Clusters of mutually
 * overlapping items get split into lanes, greedily, first-fit — the standard
 * approach, and it degrades gracefully: the common case of nothing overlapping
 * costs one lane and full width.
 */
function laneOut(items: CalendarItem[]) {
  const sorted = [...items].sort(
    (a, b) => a.startMinutes - b.startMinutes || b.endMinutes - a.endMinutes,
  );
  const placed: Array<{ item: CalendarItem; lane: number; lanes: number }> = [];

  let cluster: typeof placed = [];
  let clusterEnd = -1;

  const flush = () => {
    const lanes = cluster.reduce((max, entry) => Math.max(max, entry.lane + 1), 0);
    for (const entry of cluster) entry.lanes = lanes;
    placed.push(...cluster);
    cluster = [];
    clusterEnd = -1;
  };

  for (const item of sorted) {
    // A gap means the previous cluster is closed — its lane count is final and
    // shouldn't be inherited by whatever comes after it.
    if (item.startMinutes >= clusterEnd && cluster.length > 0) flush();

    const taken = new Set(
      cluster
        .filter((entry) => entry.item.endMinutes > item.startMinutes)
        .map((entry) => entry.lane),
    );
    let lane = 0;
    while (taken.has(lane)) lane += 1;

    cluster.push({ item, lane, lanes: lane + 1 });
    clusterEnd = Math.max(clusterEnd, item.endMinutes);
  }
  if (cluster.length > 0) flush();

  return placed;
}

/**
 * Week and day, on an hour grid.
 *
 * The one place in the app that draws rules — an hour grid without them isn't
 * legible, and CLAUDE.md §9 allows a border where contrast genuinely can't do
 * the job. They are kept to `border-line/50` so the grid reads as a texture
 * rather than a table.
 *
 * All-day items sit in a band *above* the hours rather than as 24-hour blocks
 * inside it. A task due today has no time; giving it one would fill the column
 * and bury everything that does.
 */
export function TimeGrid({
  days,
  byDay,
  today,
  nowMinutes,
  dayLabels,
  onOpen,
  onCreate,
}: {
  days: string[];
  byDay: Record<string, CalendarItem[]>;
  today: string;
  /** Minutes past local midnight, computed server-side. Null when today isn't
   *  in view, so the marker simply isn't drawn. */
  nowMinutes: number | null;
  /** Preformatted per day — "Mon 4" — because formatting in the client
   *  hydrates wrong. */
  dayLabels: Record<string, string>;
  onOpen: (eventId: string) => void;
  onCreate: (day: string) => void;
}) {
  const { from, to } = useMemo(() => {
    let min = DEFAULT_FROM;
    let max = DEFAULT_TO;
    for (const day of days) {
      for (const item of byDay[day] ?? []) {
        if (item.allDay) continue;
        min = Math.min(min, Math.floor(item.startMinutes / 60));
        max = Math.max(max, Math.ceil(item.endMinutes / 60));
      }
    }
    return { from: Math.max(0, min), to: Math.min(24, Math.max(max, min + 1)) };
  }, [days, byDay]);

  const hours = Array.from({ length: to - from }, (_, index) => from + index);
  const bodyHeight = hours.length * HOUR_PX;
  const offset = (minutes: number) => (minutes - from * 60) * PX_PER_MINUTE;

  const anyAllDay = days.some((day) =>
    (byDay[day] ?? []).some((item) => item.allDay),
  );

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div className={cn("min-w-full", days.length > 1 && "min-w-[720px]")}>
        {/* Day headers */}
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `3.25rem repeat(${days.length}, minmax(0, 1fr))` }}
        >
          <div />
          {days.map((day) => {
            const isToday = day === today;
            const [weekday, date] = (dayLabels[day] ?? "").split(" ");
            return (
              <div
                key={day}
                className={cn(
                  "flex items-baseline gap-1.5 rounded-tile px-2.5 py-2",
                  isToday ? "bg-inset" : "bg-stage",
                )}
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                  {weekday}
                </span>
                <span
                  className={cn(
                    "text-[15px] font-semibold tabular-nums tracking-tight",
                    isToday ? "text-accent" : "text-ink",
                  )}
                >
                  {date}
                </span>
              </div>
            );
          })}
        </div>

        {/* All-day band — only present when something is in it. */}
        {anyAllDay && (
          <div
            className="mt-1.5 grid gap-1.5"
            style={{ gridTemplateColumns: `3.25rem repeat(${days.length}, minmax(0, 1fr))` }}
          >
            <div className="pt-1 text-right text-[10.5px] font-medium uppercase tracking-[0.06em] text-faint">
              All day
            </div>
            {days.map((day) => (
              <div key={day} className="flex flex-col gap-px rounded-tile bg-stage p-1">
                {(byDay[day] ?? [])
                  .filter((item) => item.allDay)
                  .map((item) => (
                    <ItemChip key={item.id} item={item} onOpen={onOpen} compact />
                  ))}
              </div>
            ))}
          </div>
        )}

        {/* Hour body */}
        <div
          className="mt-1.5 grid gap-1.5"
          style={{ gridTemplateColumns: `3.25rem repeat(${days.length}, minmax(0, 1fr))` }}
        >
          <div className="relative" style={{ height: bodyHeight }}>
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-[10.5px] tabular-nums text-faint"
                style={{ top: offset(hour * 60) }}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {days.map((day) => {
            const timed = (byDay[day] ?? []).filter((item) => !item.allDay);
            const blocks = laneOut(timed);
            const isToday = day === today;

            return (
              <div
                key={day}
                className={cn(
                  "group/col relative overflow-hidden rounded-tile",
                  isToday ? "bg-inset/70" : "bg-stage",
                )}
                style={{ height: bodyHeight }}
              >
                {hours.map((hour, index) => (
                  <div
                    key={hour}
                    className={cn(
                      "absolute inset-x-0 border-t border-line/50",
                      index === 0 && "border-transparent",
                    )}
                    style={{ top: offset(hour * 60) }}
                  />
                ))}

                {isToday && nowMinutes !== null && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                    style={{ top: offset(nowMinutes) }}
                  >
                    <span className="size-1.5 shrink-0 rounded-full bg-accent" />
                    <span className="h-px flex-1 bg-accent/60" />
                  </div>
                )}

                {blocks.map(({ item, lane, lanes }) => {
                  const top = offset(item.startMinutes);
                  const height = Math.max(
                    20,
                    (item.endMinutes - item.startMinutes) * PX_PER_MINUTE - 2,
                  );
                  const width = `calc((100% - 0.5rem) / ${lanes})`;

                  const content = (
                    <>
                      <span
                        aria-hidden
                        className="absolute inset-y-1 left-1 w-[3px] rounded-full"
                        style={{ background: item.color }}
                      />
                      <span className="block truncate pl-2.5 text-[11.5px] font-medium leading-tight">
                        {item.title}
                      </span>
                      {height > 30 && (
                        <span className="block truncate pl-2.5 text-[10.5px] leading-tight text-muted">
                          {item.timeLabel}
                          {item.meta ? ` · ${item.meta}` : ""}
                        </span>
                      )}
                    </>
                  );

                  return (
                    <div
                      key={item.id}
                      className="absolute z-10"
                      style={{
                        top,
                        height,
                        left: `calc(0.25rem + ${lane} * ${width})`,
                        width,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          item.kind === "event" ? onOpen(item.sourceId) : undefined
                        }
                        className={cn(
                          "relative size-full overflow-hidden rounded-[10px] py-1 pr-1.5 text-left transition-[transform,box-shadow] duration-(--duration-base) ease-soft hover:-translate-y-px hover:shadow-card active:scale-[0.98]",
                          item.done ? "opacity-55" : "",
                        )}
                        style={{
                          background: `color-mix(in srgb, ${item.color} 13%, var(--color-card))`,
                        }}
                      >
                        {content}
                      </button>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => onCreate(day)}
                  aria-label={`New event on ${day}`}
                  className="absolute bottom-2 right-2 z-30 grid size-6 place-items-center rounded-full bg-card text-muted shadow-card transition-[color,opacity,transform] duration-(--duration-quick) hover:text-ink active:scale-90 sm:opacity-0 sm:group-hover/col:opacity-100"
                >
                  <Plus className="size-3.5" strokeWidth={2.2} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
