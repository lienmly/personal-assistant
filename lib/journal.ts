import { db } from "@/lib/db";
import { localDayKey, todayKey } from "@/lib/utils";

/**
 * Reading the journal.
 *
 * **Never selects `JournalPhoto.data`.** A list of twenty entries with four
 * photos each would otherwise pull eighty images into memory to render eighty
 * `<img>` tags that are going to fetch them separately anyway. Only
 * `lib/photo-store.ts` reads bytes; see the note on the model.
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

export type JournalPhotoView = {
  id: string;
  caption: string | null;
  width: number;
  height: number;
};

export type JournalEntryView = {
  id: string;
  /** "YYYY-MM-DD". Still here even though the day it belongs to carries the
   *  same key: it is what the edit composer's date input starts on, and moving
   *  an entry to another day is a legitimate edit. */
  happenedOn: string;
  title: string | null;
  body: string;
  photos: JournalPhotoView[];
  /**
   * When this was written, as a clock time — "14:32" — but **only when it was
   * written on the day it is about**. Otherwise "written 7 Aug".
   *
   * The two dates differ whenever you write up Tuesday on Thursday, which with
   * a baby is most of the time, and a bare "21:04" under a Tuesday heading is a
   * claim that something happened at nine on Tuesday night. It didn't; that is
   * when you got round to typing it. The stamp is only a time when it is
   * genuinely a time of that day.
   */
  timeLabel: string;
  /** True when `timeLabel` is a clock time rather than a later write-up date.
   *  The two read differently and the entry says so. */
  sameDay: boolean;
};

/**
 * One calendar day, with everything written about it.
 *
 * The grouping is the point rather than a tidy-up: a day is the unit you add
 * to. Each header carries its own "+", so a morning and an afternoon are two
 * entries under one date instead of one entry you have to go back and edit —
 * which is what journaling *throughout* a day actually looks like.
 */
export type JournalDayView = {
  /** "YYYY-MM-DD" — the key the composer opened from this day prefills with. */
  key: string;
  dayLabel: string;
  shortLabel: string;
  isToday: boolean;
  entries: JournalEntryView[];
};

const PHOTO_SELECT = {
  id: true,
  caption: true,
  width: true,
  height: true,
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
      photos: { orderBy: { sortOrder: "asc" }, select: PHOTO_SELECT },
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
      happenedOn,
      title: entry.title,
      body: entry.body,
      photos: entry.photos,
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
