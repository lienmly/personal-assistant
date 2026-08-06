import { db } from "@/lib/db";
import { localDayKey, todayKey } from "@/lib/utils";

/**
 * Reading the journal.
 *
 * **Never selects `JournalMedia.data`.** A list of twenty entries with four
 * photos each would otherwise pull eighty images into memory to render eighty
 * `<img>` tags that are going to fetch them separately anyway — and a clip is
 * twenty times the size of a photo, so the same mistake costs twenty times as
 * much now. Only `lib/media-store.ts` reads bytes; see the note on the model.
 */

/** `happenedOn` is a `@db.Date` — UTC midnight standing in for a local calendar
 *  day, so it formats in UTC or it renders a day early west of Greenwich
 *  (CLAUDE.md §6, "Dates are a trap here"). */
const dayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const shortDayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** `createdAt` is a real instant, not a `@db.Date` — so it formats in **local**
 *  time, which is the opposite rule from every other date on this page. Both
 *  rules are CLAUDE.md §6, "Dates are a trap here", and using one where the
 *  other belongs is what renders a stamp hours out. */
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

const writtenFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

export type JournalMediaView = {
  id: string;
  kind: "photo" | "video";
  caption: string | null;
  width: number;
  height: number;
  durationMs: number | null;
};

export type JournalEntryView = {
  id: string;
  title: string | null;
  body: string;
  media: JournalMediaView[];
  /**
   * When this was written, as a clock time — "14:32".
   *
   * Since 2026-08-06 a new entry's day is set from the server's clock and can't
   * be edited, so this and the day heading above it always agree. The "written
   * 7 Aug" branch below survives for **rows written before that**, when the date
   * was a field: a bare "21:04" under a Tuesday heading would be claiming
   * something happened at nine on Tuesday night when in fact that is when it got
   * typed. Three lines to never tell that lie about an old row.
   */
  timeLabel: string;
  /** True when `timeLabel` is a clock time rather than a later write-up date. */
  sameDay: boolean;
};

/**
 * One calendar day, with everything written about it.
 *
 * The grouping is the point rather than a tidy-up: a day is what you add to
 * through the day. A morning and an afternoon are two entries under one date,
 * each stamped with its own time, rather than one entry you go back and extend.
 */
export type JournalDayView = {
  /** "YYYY-MM-DD". */
  key: string;
  dayLabel: string;
  shortLabel: string;
  isToday: boolean;
  entries: JournalEntryView[];
};

const MEDIA_SELECT = {
  id: true,
  kind: true,
  caption: true,
  width: true,
  height: true,
  durationMs: true,
} as const;

export async function getJournal(
  areaId: string,
  today = todayKey(),
): Promise<JournalDayView[]> {
  const entries = await db.journalEntry.findMany({
    where: { areaId },
    // Newest day first, and newest-written first within a day — writing two
    // entries about the same afternoon should read in the order you wrote them,
    // most recent at the top, like everything else on this page.
    orderBy: [{ happenedOn: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      happenedOn: true,
      createdAt: true,
      title: true,
      body: true,
      media: { orderBy: { sortOrder: "asc" }, select: MEDIA_SELECT },
    },
  });

  // The rows arrive already sorted, so one pass groups them and the days come
  // out in the order the query put them in — no second sort, and no Map
  // iteration order to reason about.
  const days: JournalDayView[] = [];

  for (const entry of entries) {
    const happenedOn = entry.happenedOn.toISOString().slice(0, 10);
    const sameDay = localDayKey(entry.createdAt) === happenedOn;

    const view: JournalEntryView = {
      id: entry.id,
      title: entry.title,
      body: entry.body,
      media: entry.media,
      timeLabel: sameDay
        ? timeFormat.format(entry.createdAt)
        : `written ${writtenFormat.format(entry.createdAt)}`,
      sameDay,
    };

    const last = days[days.length - 1];
    if (last && last.key === happenedOn) {
      last.entries.push(view);
    } else {
      days.push({
        key: happenedOn,
        dayLabel: dayFormat.format(entry.happenedOn),
        shortLabel: shortDayFormat.format(entry.happenedOn),
        isToday: happenedOn === today,
        entries: [view],
      });
    }
  }

  return days;
}
