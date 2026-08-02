import Link from "next/link";
import { Repeat } from "lucide-react";

import type { CalendarItem } from "@/components/calendar/types";
import { cn } from "@/lib/utils";

/**
 * Section 3 of Today: what's on the clock, as opposed to what's on the list.
 *
 * Events only. The tasks are the focus list two cards up and the items have
 * their own card in between, so replaying either here would put the same row on
 * one screen three times — which is how a dashboard stops being read.
 *
 * A server component, unlike the rest of Today: there is nothing to tick. An
 * event isn't done, it just happens, and the only interaction is going to the
 * calendar to change it.
 */
export function Agenda({
  items,
  nowMinutes,
  dayHref,
}: {
  items: CalendarItem[];
  /** Minutes past local midnight, from the server. Anything already finished
   *  recedes rather than disappearing — "the 9am is done" is information. */
  nowMinutes: number;
  dayHref: string;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item, index) => {
        const past = !item.allDay && item.endMinutes <= nowMinutes;
        const now =
          !item.allDay &&
          item.startMinutes <= nowMinutes &&
          item.endMinutes > nowMinutes;

        return (
          <li
            key={item.id}
            className="animate-rise"
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <Link
              href={dayHref}
              className={cn(
                "flex items-start gap-2.5 rounded-tile px-2 py-2 transition-[background-color,transform] duration-(--duration-quick) ease-soft hover:bg-inset active:scale-[0.985]",
                past && "opacity-50",
              )}
            >
              <span className="w-10 shrink-0 pt-px text-[11.5px] font-medium tabular-nums text-muted">
                {item.allDay ? "All day" : item.timeLabel}
              </span>

              <span
                aria-hidden
                className="mt-1 h-3.5 w-[3px] shrink-0 rounded-full"
                style={{ background: item.color }}
              />

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-medium text-ink">
                    {item.title}
                  </span>
                  {item.repeats && (
                    <Repeat
                      className="size-3 shrink-0 text-faint"
                      strokeWidth={2.2}
                      aria-label="Repeats"
                    />
                  )}
                </span>
                {item.meta && (
                  <span className="mt-0.5 block truncate text-[12px] text-muted">
                    {item.meta}
                  </span>
                )}
              </span>

              {/* The one thing on this card worth an accent: what's happening
                  right now. Everything else is a time and a name. */}
              {now && (
                <span className="mt-0.5 shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-accent">
                  Now
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
