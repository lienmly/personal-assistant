import type { Event } from "@prisma/client";

import type {
  CalendarItem,
  CalendarKind,
  EventView,
} from "@/components/calendar/types";
import {
  dayOfMonth,
  isoDay,
  keyToUtc,
  minutesOfDay,
  timeLabel,
} from "@/lib/calendar-keys";
import { db } from "@/lib/db";
import { localDayKey } from "@/lib/utils";

/**
 * The calendar layer: one grid, three sources.
 *
 * Only Events are *stored* for the calendar. A Mark's due date and a Drop's
 * publish time are layered on at read time rather than copied into event rows —
 * a due date belongs to the Mark, and duplicating it into a second table gives
 * it two places to be wrong and a synchronisation job nobody will write.
 *
 * The three sources keep their dates in three different conventions
 * (`Event.start` is a real timestamp, `Mark.dueDate` is a `@db.Date` at UTC
 * midnight, `Drop.publishAt` is a real timestamp), which is exactly the trap
 * CLAUDE.md §6 warns about. Everything here therefore reduces each one to a
 * *local day key* the moment it is read, and the grid only ever sees keys. Three
 * conventions agreeing on which cell they land in is the whole trick.
 */

const MINUTES_IN_DAY = 1440;

/** Local midnight opening the day, and the last instant closing it. A window
 *  built any other way drops the evening's drops in a negative-offset zone. */
function localStart(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function localEnd(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

/** `@db.Date` → "YYYY-MM-DD". Read in UTC, because that is where Prisma puts
 *  the local calendar day it stands for. Same rule as `dayKey` in lib/sprints. */
function dateOnlyKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Does a recurring event fire on this day?
 *
 * `weekly` with no `daysOfWeek` falls back to the weekday the event itself
 * starts on, so "repeats weekly" does the obvious thing without the panel
 * having to force a checkbox choice.
 *
 * `monthly` matches the day-of-month and therefore simply doesn't fire in a
 * month that is too short — an event on the 31st skips February. That is the
 * documented cost of not carrying an RRULE engine, and it is the right trade
 * for a calendar whose recurring rows are naps and a weekly call.
 */
function fires(event: Event, day: string, startDay: string): boolean {
  switch (event.recurrence) {
    case "daily":
      return true;
    case "weekdays":
      return isoDay(day) <= 5;
    case "weekly": {
      const days =
        event.daysOfWeek.length > 0 ? event.daysOfWeek : [isoDay(startDay)];
      return days.includes(isoDay(day));
    }
    case "monthly":
      return dayOfMonth(day) === dayOfMonth(startDay);
    default:
      return false;
  }
}

type EventRow = Event & {
  area: { name: string; color: string };
  project: { name: string } | null;
};

/**
 * Expand one Event into the items it contributes to the window.
 *
 * Non-recurring events walk their own start→end days, so a three-day trip
 * appears on all three with the ends rounded. Recurring occurrences are placed
 * on the day they fire and clipped to it; a recurring event that crosses
 * midnight shows on its start day only, which is a limitation worth having
 * rather than the machinery to avoid.
 */
function expandEvent(event: EventRow, days: string[]): CalendarItem[] {
  const startDay = localDayKey(event.start);
  const untilDay = event.repeatUntil ? dateOnlyKey(event.repeatUntil) : null;
  const color = event.area.color;
  const meta = event.project?.name ?? event.location ?? null;
  const repeats = event.recurrence !== "none";

  const item = (
    day: string,
    startMinutes: number,
    endMinutes: number,
    span: CalendarItem["span"],
  ): CalendarItem => ({
    id: `event:${event.id}:${day}`,
    sourceId: event.id,
    kind: "event",
    title: event.title,
    day,
    allDay: event.allDay,
    startMinutes,
    endMinutes,
    // Only the day a span *starts* carries the time; a continuation row reading
    // "09:00" would be claiming the thing begins again each morning.
    timeLabel:
      event.allDay || span === "middle" || span === "end"
        ? null
        : timeLabel(event.start),
    color,
    meta,
    done: false,
    span,
    repeats,
  });

  if (!repeats) {
    const endDay = localDayKey(event.end);
    const items: CalendarItem[] = [];
    for (const day of days) {
      if (day < startDay || day > endDay) continue;
      const first = day === startDay;
      const last = day === endDay;
      const span: CalendarItem["span"] =
        first && last ? "single" : first ? "start" : last ? "end" : "middle";
      const from = event.allDay || !first ? 0 : minutesOfDay(event.start);
      const to = event.allDay || !last ? MINUTES_IN_DAY : minutesOfDay(event.end);
      items.push(item(day, from, to, span));
    }
    return items;
  }

  const durationMinutes = Math.max(
    1,
    Math.round((event.end.getTime() - event.start.getTime()) / 60_000),
  );
  const from = event.allDay ? 0 : minutesOfDay(event.start);

  return days
    .filter(
      (day) =>
        day >= startDay &&
        (untilDay === null || day <= untilDay) &&
        fires(event, day, startDay),
    )
    .map((day) =>
      item(
        day,
        from,
        event.allDay
          ? MINUTES_IN_DAY
          : Math.min(from + durationMinutes, MINUTES_IN_DAY),
        "single",
      ),
    );
}

/**
 * The editable row behind an occurrence.
 *
 * Note what this means: opening any occurrence of a recurring event edits the
 * *rule*, because that is the only thing stored. Changing Tuesday's nap changes
 * every nap. That is the honest consequence of `Recurrence` carrying no
 * exceptions (see the enum's note in the schema), and the panel says so out
 * loud rather than letting the save quietly do more than expected.
 */
function toEventView(event: EventRow): EventView {
  return {
    id: event.id,
    title: event.title,
    notes: event.notes,
    location: event.location,
    startDay: localDayKey(event.start),
    endDay: localDayKey(event.end),
    // An all-day row's stored times are 00:00 and 23:59:59.999, which are not
    // useful defaults the moment "all day" is unticked. Offer a working day
    // instead, so the toggle produces something sane rather than a 24-hour block.
    startTime: event.allDay ? "09:00" : timeLabel(event.start),
    endTime: event.allDay ? "10:00" : timeLabel(event.end),
    allDay: event.allDay,
    recurrence: event.recurrence,
    daysOfWeek: event.daysOfWeek,
    repeatUntil: event.repeatUntil ? dateOnlyKey(event.repeatUntil) : null,
    areaId: event.areaId,
    projectId: event.projectId,
  };
}

export type CalendarData = {
  /** Keyed by local day. Every day in the window has an entry, possibly empty,
   *  so the grid never has to guard for undefined. */
  byDay: Record<string, CalendarItem[]>;
  /** The template rows behind the occurrences, keyed by id — what the panel
   *  opens when an event chip is clicked. */
  events: Record<string, EventView>;
  counts: Record<CalendarKind, number>;
};

/**
 * Everything landing on the given days, already bucketed and sorted.
 *
 * `kinds` exists for Today's Agenda card, which wants events only — the marks
 * are already the focus list two cards above it and the drops have their own
 * card between them, so replaying either there would be the same row three
 * times on one screen.
 */
export async function getCalendar(
  days: string[],
  options: { areaSlug?: string | null; kinds?: CalendarKind[] } = {},
): Promise<CalendarData> {
  const kinds = options.kinds ?? ["event", "mark", "drop"];
  const wanted = new Set(kinds);

  const first = days[0];
  const last = days[days.length - 1];
  const rangeStart = localStart(first);
  const rangeEnd = localEnd(last);
  const areaWhere = options.areaSlug ? { area: { slug: options.areaSlug } } : {};

  const [events, marks, drops] = await Promise.all([
    wanted.has("event")
      ? db.event.findMany({
          where: {
            ...areaWhere,
            OR: [
              // Fixed events only matter if they overlap the window at all.
              {
                recurrence: "none",
                start: { lte: rangeEnd },
                end: { gte: rangeStart },
              },
              // A recurring one has to be considered whenever its rule could
              // still be producing occurrences, however long ago it started.
              {
                recurrence: { not: "none" },
                start: { lte: rangeEnd },
                OR: [
                  { repeatUntil: null },
                  { repeatUntil: { gte: keyToUtc(first) } },
                ],
              },
            ],
          },
          include: {
            area: { select: { name: true, color: true } },
            project: { select: { name: true } },
          },
        })
      : [],

    wanted.has("mark")
      ? db.mark.findMany({
          where: {
            ...areaWhere,
            dueDate: { gte: keyToUtc(first), lte: keyToUtc(last) },
          },
          select: {
            id: true,
            title: true,
            track: true,
            status: true,
            dueDate: true,
            area: { select: { name: true, color: true } },
            project: { select: { name: true } },
          },
        })
      : [],

    wanted.has("drop")
      ? db.drop.findMany({
          where: {
            publishAt: { gte: rangeStart, lte: rangeEnd },
            ...(options.areaSlug
              ? { project: { area: { slug: options.areaSlug } } }
              : {}),
          },
          select: {
            id: true,
            title: true,
            stage: true,
            publishAt: true,
            brand: { select: { name: true, color: true } },
            project: { select: { name: true } },
            series: { select: { name: true } },
          },
        })
      : [],
  ]);

  const byDay: Record<string, CalendarItem[]> = {};
  for (const day of days) byDay[day] = [];

  const push = (item: CalendarItem) => {
    byDay[item.day]?.push(item);
  };

  for (const event of events) {
    for (const item of expandEvent(event, days)) push(item);
  }

  for (const mark of marks) {
    if (!mark.dueDate) continue;
    push({
      id: `mark:${mark.id}`,
      sourceId: mark.id,
      kind: "mark",
      title: mark.title,
      // The `@db.Date` read in UTC *is* the local day it stands for.
      day: dateOnlyKey(mark.dueDate),
      allDay: true,
      startMinutes: 0,
      endMinutes: 0,
      timeLabel: null,
      color: mark.area.color,
      meta: mark.project?.name ?? mark.track ?? null,
      done: mark.status === "done",
      span: "single",
      repeats: false,
    });
  }

  for (const drop of drops) {
    if (!drop.publishAt) continue;
    const at = drop.publishAt;
    const startMinutes = minutesOfDay(at);
    push({
      id: `drop:${drop.id}`,
      sourceId: drop.id,
      kind: "drop",
      // An unfilled series slot has no title yet and still means something
      // real — "a short goes out at 18:00". Naming it after its series says
      // that; an empty row says the calendar is broken.
      title: drop.title || `${drop.series?.name ?? drop.brand.name} slot`,
      day: localDayKey(at),
      allDay: false,
      startMinutes,
      // A publish time is an instant, not a block. Half an hour is purely so
      // the hour grid has something with height to draw.
      endMinutes: Math.min(startMinutes + 30, MINUTES_IN_DAY),
      timeLabel: timeLabel(at),
      color: drop.brand.color,
      meta: drop.project?.name ?? drop.brand.name,
      done: drop.stage === "published",
      span: "single",
      repeats: false,
    });
  }

  for (const day of days) {
    byDay[day].sort(
      (a, b) =>
        Number(b.allDay) - Number(a.allDay) ||
        a.startMinutes - b.startMinutes ||
        a.title.localeCompare(b.title),
    );
  }

  const counts: Record<CalendarKind, number> = { event: 0, mark: 0, drop: 0 };
  for (const day of days) {
    for (const item of byDay[day]) counts[item.kind] += 1;
  }

  const views: Record<string, EventView> = {};
  for (const event of events) views[event.id] = toEventView(event);

  return { byDay, events: views, counts };
}

/**
 * Section 3 of Today. Events only — see `getCalendar`'s `kinds` note.
 *
 * Returns the day's events in time order with the all-day ones first, which is
 * how a day actually reads: the things that are true all day, then the things
 * that happen at a time.
 */
export async function getAgenda(day: string): Promise<CalendarItem[]> {
  const { byDay } = await getCalendar([day], { kinds: ["event"] });
  return byDay[day] ?? [];
}

/** The area filter row, and the projects an event can be attached to. */
export async function getCalendarMeta() {
  const [areas, projects] = await Promise.all([
    db.area.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, slug: true, name: true, color: true },
    }),
    db.project.findMany({
      where: { status: { in: ["active", "simmering"] } },
      orderBy: [{ priority: "asc" }, { sortOrder: "asc" }],
      select: { id: true, name: true, areaId: true },
    }),
  ]);
  return { areas, projects };
}
