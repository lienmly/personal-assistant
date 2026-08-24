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
 * (an instant), and a **diamond** is a holiday (a fact about the day, belonging
 * to nobody). Four shapes rather than four colours, because colour is
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
            : kind === "holiday"
              ? "size-1.5 rotate-45 rounded-[1px]"
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

  // A holiday goes nowhere, because there is nothing behind it to open — no
  // row, nothing to edit, nothing owed. It reads as a label on the day, which
  // is what it is.
  if (item.kind === "holiday") {
    return <span className={cn(className, "text-muted")}>{body}</span>;
  }

  return (
    <Link href={item.kind === "task" ? "/board" : "/studio"} className={className}>
      {body}
    </Link>
  );
}

/**
 * The key to the three glyphs — and the control that shows or hides each one.
 *
 * The legend was already naming the three sources and counting them, so it is
 * the one place a layer switch can live without adding a control to the
 * toolbar: you read "37 social media content", and the thing that told you is
 * the thing you press. A hidden layer keeps its real count for exactly that reason
 * (see the note in `parseLayers`) — it has to be able to advertise itself.
 *
 * Deliberately quiet. No accent: §9 gives the screen one crimson element and
 * the "New event" button has it, and a legend that shouted would compete with
 * the grid it explains. On/off is carried by a filled pill and by opacity,
 * which is the same contrast-not-borders rule the cards use.
 */
export function Legend({
  counts,
  layers,
  hrefFor,
}: {
  counts: Record<string, number>;
  layers: CalendarItem["kind"][];
  /** This same view with that one layer flipped. */
  hrefFor: (kind: CalendarItem["kind"]) => string;
}) {
  const entries: Array<[CalendarItem["kind"], string]> = [
    ["event", "events"],
    ["holiday", "holidays"],
    ["task", "tasks due"],
    ["item", "social media content"],
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5 pt-3 text-[11.5px] text-muted">
      {entries.map(([kind, label]) => {
        const shown = layers.includes(kind);
        return (
          <Link
            key={kind}
            href={hrefFor(kind)}
            scroll={false}
            aria-pressed={shown}
            title={`${shown ? "Hide" : "Show"} ${label}`}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-[background-color,color,opacity,transform] duration-(--duration-quick) ease-soft active:scale-[0.97]",
              shown
                ? "bg-inset text-muted"
                : "opacity-45 hover:bg-inset hover:opacity-100",
            )}
          >
            <ItemGlyph kind={kind} color="var(--color-faint)" />
            <span className={cn("font-medium", shown ? "text-ink" : "text-muted")}>
              {counts[kind] ?? 0}
            </span>
            {label}
          </Link>
        );
      })}
      <span className="ml-auto hidden pr-1 sm:block">
        Colour is the area · tap a layer to show or hide it
      </span>
    </div>
  );
}
