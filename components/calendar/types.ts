import type { Recurrence } from "@prisma/client";

/** Plain view types — the grid and the panel are client components, so they
 *  must not pull `lib/db` into the bundle. Same rule as studio/, board/ and
 *  today/. */

/** The fourth, `holiday`, has no row behind it — it is computed from the day
 *  key by `lib/holidays.ts`. See there for why that is allowed where a seeded
 *  event is not. */
export type CalendarKind = "event" | "task" | "item" | "holiday";

/**
 * One thing on one day of the grid.
 *
 * Deliberately flat, and deliberately *per day*: a three-day trip is three
 * items, not one item the grid has to work out how to slice. The grid's job is
 * to lay out a day's rows, and every branch it doesn't have to take about
 * spans, timezones or source tables is a branch that can't render the wrong
 * cell.
 */
export type CalendarItem = {
  /** Unique per occurrence — `kind:rowId:day`. A daily nap is a different item
   *  on every day of the week, and React keys have to tell them apart. */
  id: string;
  /** The underlying row, for opening the panel or linking out. */
  sourceId: string;
  kind: CalendarKind;
  title: string;
  /** "YYYY-MM-DD", local. The cell this belongs in. */
  day: string;
  /** All-day items render in the band above the hour grid rather than in it. */
  allDay: boolean;
  /** Minutes from local midnight. Both 0 for all-day items. */
  startMinutes: number;
  endMinutes: number;
  /** Preformatted server-side — formatting dates in the client hydrates wrong.
   *  Null for all-day items and for the continuation days of a span. */
  timeLabel: string | null;
  /** The area's colour, or the brand's for a content item. */
  color: string;
  /** Project name, brand name, or the location — whatever earns the second line. */
  meta: string | null;
  /** A ticked task or a published item. Rendered receded, not hidden. */
  done: boolean;
  /** Where this day sits in a multi-day span, for the rounded-end treatment. */
  span: "single" | "start" | "middle" | "end";
  /** Set on recurring event occurrences, so the grid can show the repeat glyph. */
  repeats: boolean;
};

/** The editable shape of an Event, for the panel. */
export type EventView = {
  id: string;
  title: string;
  notes: string | null;
  location: string | null;
  /** "YYYY-MM-DD" and "HH:mm", split so the two `<input>`s round-trip without
   *  a timezone ever entering the client. */
  startDay: string;
  startTime: string;
  endDay: string;
  endTime: string;
  allDay: boolean;
  recurrence: Recurrence;
  daysOfWeek: number[];
  repeatUntil: string | null;
  areaId: string;
  projectId: string | null;
};

export type CalendarAreaView = {
  id: string;
  slug: string;
  name: string;
  color: string;
};

export type CalendarProjectView = {
  id: string;
  name: string;
  areaId: string;
};
