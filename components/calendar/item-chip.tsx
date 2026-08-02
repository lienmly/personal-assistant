"use client";

import Link from "next/link";
import { Repeat } from "lucide-react";

import type { CalendarItem } from "@/components/calendar/types";
import { cn } from "@/lib/utils";

/**
 * One row on the grid, whichever of the three sources it came from.
 *
 * The glyph is the whole legend: a **bar** is an event (it occupies time), a
 * **square** is a task due (a thing to finish), a **dot** is a content item going out
 * (an instant). Three shapes rather than three colours, because colour is
 * already spoken for — it carries the *area* (or the brand), which is the other
 * thing you need to read off a cell at a glance. Encoding both in colour would
 * mean neither could be read.
 */
export function ItemGlyph({
  kind,
  color,
  className,
}: {
  kind: CalendarItem["kind"];
  color: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "shrink-0",
        kind === "event"
          ? "h-2.5 w-[3px] rounded-full"
          : kind === "task"
            ? "size-1.5 rounded-[2px]"
            : "size-1.5 rounded-full",
        className,
      )}
      style={{ background: color }}
    />
  );
}

/**
 * Events open the panel; tasks and items link to the surface that owns them.
 *
 * The calendar deliberately isn't an editor for the other two. A task's real
 * context is its project and its track on the Hunt Board, and a content item's is its
 * channel checklist in Studio — reproducing either here would be a second,
 * worse version of a screen that already exists.
 */
export function ItemChip({
  item,
  onOpen,
  compact = false,
}: {
  item: CalendarItem;
  onOpen: (eventId: string) => void;
  /** Month cells are tight — the meta line is dropped there. */
  compact?: boolean;
}) {
  const body = (
    <>
      <ItemGlyph
        kind={item.kind}
        color={item.color}
        className={item.done ? "opacity-40" : undefined}
      />
      <span className="min-w-0 flex-1 truncate">
        {item.timeLabel && (
          <span className="mr-1 tabular-nums text-faint">{item.timeLabel}</span>
        )}
        <span className={cn(item.done && "line-through decoration-faint")}>
          {item.title}
        </span>
        {!compact && item.meta && (
          <span className="ml-1.5 text-faint">{item.meta}</span>
        )}
      </span>
      {item.repeats && (
        <Repeat
          className="size-2.5 shrink-0 text-faint"
          strokeWidth={2.2}
          aria-label="Repeats"
        />
      )}
    </>
  );

  const className = cn(
    "flex w-full items-center gap-1.5 rounded-[7px] px-1.5 py-[3px] text-left text-[11.5px] leading-tight transition-[background-color,transform] duration-(--duration-quick) ease-soft hover:bg-inset active:scale-[0.97]",
    item.done ? "text-faint" : "text-ink",
  );

  if (item.kind === "event") {
    return (
      <button type="button" onClick={() => onOpen(item.sourceId)} className={className}>
        {body}
      </button>
    );
  }

  return (
    <Link href={item.kind === "task" ? "/board" : "/studio"} className={className}>
      {body}
    </Link>
  );
}

/** The key to the three glyphs, shown once under the grid. */
export function Legend({ counts }: { counts: Record<string, number> }) {
  const entries: Array<[CalendarItem["kind"], string]> = [
    ["event", "events"],
    ["task", "tasks due"],
    ["item", "items going out"],
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 pt-3.5 text-[11.5px] text-muted">
      {entries.map(([kind, label]) => (
        <span key={kind} className="flex items-center gap-1.5">
          <ItemGlyph kind={kind} color="var(--color-faint)" />
          <span className="font-medium text-ink">{counts[kind] ?? 0}</span>
          {label}
        </span>
      ))}
      <span className="ml-auto hidden sm:block">
        Colour is the area · tasks and items open their own surface
      </span>
    </div>
  );
}
