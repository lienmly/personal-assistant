"use client";

import { Plus } from "lucide-react";

import { ItemChip } from "@/components/calendar/item-chip";
import type { CalendarItem } from "@/components/calendar/types";
import { monthKey } from "@/lib/calendar-keys";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** How many rows fit a cell before it starts counting instead of listing. */
const VISIBLE = 3;

/**
 * The month, as tiles on a tinted ground rather than a ruled table.
 *
 * A calendar's instinct is hairline borders in both directions, which is the
 * one thing the reference never does — it separates by background contrast. So
 * the cells are `bg-stage` tiles with a gap, sitting on the white card, and the
 * grid reads as structure without a single line being drawn. Days outside the
 * month recede rather than disappearing: a month view that hides them makes the
 * first week look broken.
 */
export function MonthGrid({
  days,
  byDay,
  cursor,
  today,
  onOpen,
  onCreate,
  onZoom,
}: {
  days: string[];
  byDay: Record<string, CalendarItem[]>;
  /** Any day in the month being shown — decides which cells are "outside". */
  cursor: string;
  today: string;
  onOpen: (eventId: string) => void;
  onCreate: (day: string) => void;
  /** Clicking the overflow count items into that single day. */
  onZoom: (day: string) => void;
}) {
  const current = monthKey(cursor);

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((label) => (
          <div
            key={label}
            className="px-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint"
          >
            <span className="sm:hidden">{label[0]}</span>
            <span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, index) => {
          const items = byDay[day] ?? [];
          const outside = monthKey(day) !== current;
          const isToday = day === today;
          const shown = items.slice(0, VISIBLE);
          const hidden = items.length - shown.length;

          return (
            <div
              key={day}
              // Keyed on the day, so the stagger replays when the month
              // changes and not on every re-render. Reading order, ~6ms a cell
              // — 42 cells at the usual 40ms would take a second and a half.
              style={{ animationDelay: `${Math.min(index * 6, 240)}ms` }}
              className={cn(
                "group/cell animate-rise flex min-h-[92px] flex-col rounded-tile p-1.5 transition-colors duration-(--duration-quick) sm:min-h-[116px]",
                outside ? "bg-stage/60" : "bg-stage",
                isToday && "bg-inset",
              )}
            >
              <div className="mb-1 flex items-center justify-between px-1">
                <span
                  className={cn(
                    "grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11.5px] font-semibold tabular-nums",
                    isToday
                      ? "bg-accent text-white"
                      : outside
                        ? "text-faint"
                        : "text-ink",
                  )}
                >
                  {Number(day.slice(8, 10))}
                </span>

                {/* Hover is not an affordance on a phone (CLAUDE.md §9) — so
                    this is visible outright on small screens and revealed on
                    hover only where there's a pointer. */}
                <button
                  type="button"
                  onClick={() => onCreate(day)}
                  aria-label={`New event on ${day}`}
                  className="grid size-5 place-items-center rounded-full text-faint transition-[background-color,color,opacity] duration-(--duration-quick) hover:bg-card hover:text-ink sm:opacity-0 sm:group-hover/cell:opacity-100"
                >
                  <Plus className="size-3" strokeWidth={2.4} />
                </button>
              </div>

              <div className="flex flex-col gap-px">
                {shown.map((item) => (
                  <ItemChip key={item.id} item={item} onOpen={onOpen} compact />
                ))}
                {hidden > 0 && (
                  <button
                    type="button"
                    onClick={() => onZoom(day)}
                    className="px-1.5 py-[3px] text-left text-[11px] font-medium text-muted transition-colors duration-(--duration-quick) hover:text-accent"
                  >
                    +{hidden} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
