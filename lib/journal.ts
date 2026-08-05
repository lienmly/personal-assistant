import { db } from "@/lib/db";
import { todayKey } from "@/lib/utils";

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

export type JournalPhotoView = {
  id: string;
  caption: string | null;
  width: number;
  height: number;
};

export type JournalEntryView = {
  id: string;
  happenedOn: string;
  dayLabel: string;
  shortLabel: string;
  isToday: boolean;
  title: string | null;
  body: string;
  photos: JournalPhotoView[];
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
): Promise<JournalEntryView[]> {
  const entries = await db.journalEntry.findMany({
    where: { areaId },
    // Newest day first, and newest-written first within a day — writing two
    // entries about the same afternoon should read in the order you wrote them,
    // most recent at the top, like everything else on this page.
    orderBy: [{ happenedOn: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      happenedOn: true,
      title: true,
      body: true,
      photos: { orderBy: { sortOrder: "asc" }, select: PHOTO_SELECT },
    },
  });

  return entries.map((entry) => {
    const happenedOn = entry.happenedOn.toISOString().slice(0, 10);
    return {
      id: entry.id,
      happenedOn,
      dayLabel: dayFormat.format(entry.happenedOn),
      shortLabel: shortDayFormat.format(entry.happenedOn),
      isToday: happenedOn === today,
      title: entry.title,
      body: entry.body,
      photos: entry.photos,
    };
  });
}
