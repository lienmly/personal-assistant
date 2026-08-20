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

/**
 * Whose journal this is — an Area **or** a Project, exactly one.
 *
 * A union rather than two optional fields, so "both" and "neither" are
 * unspellable rather than merely rejected. Same shape as `DocOwner`, and it
 * spreads straight into a Prisma `where` because each arm is already a column.
 */
export type JournalOwner = { areaId: string } | { projectId: string };

/**
 * Where an entry is filed, printed on the entry itself.
 *
 * **Only ever present on the global journal.** On an area or a project page
 * every entry has the same owner, so printing it on all of them says nothing and
 * costs a line of chrome per row. On `/journal` the days mix sources — a morning
 * about the baby and an afternoon about Sleepy Cat under one Tuesday — and
 * without this the thread reads as one undifferentiated stream.
 */
export type JournalEntryOwner = {
  kind: "area" | "project";
  name: string;
  href: string;
  /** A project borrows its area's colour, the way every other surface colours
   *  one. Area *is* the colour in this app; a project does not have its own. */
  color: string;
};

/**
 * An owner the global composer can file into, as one string.
 *
 * `value` is `"area:<id>"` or `"project:<id>"` because a `<select>` holds one
 * value and the two columns are mutually exclusive — the union in
 * `lib/journal-actions.ts` unpacks it back into exactly one of them.
 */
export type JournalOwnerOption = {
  value: string;
  label: string;
  kind: "area" | "project";
  color: string;
};

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
  /** Set by `getGlobalJournal` only — see `JournalEntryOwner`. */
  owner?: JournalEntryOwner;
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

/** Today's day, formatted the same way as one that came out of the database.
 *  A `@db.Date` is UTC midnight standing in for a local day, so a key turned
 *  back into a `Date` is built in UTC and formatted in UTC — the same rule, in
 *  the same direction, as every other date on this page. */
function emptyDay(key: string): JournalDayView {
  const date = new Date(`${key}T00:00:00.000Z`);
  return {
    key,
    dayLabel: dayFormat.format(date),
    shortLabel: shortDayFormat.format(date),
    isToday: true,
    entries: [],
  };
}

const MEDIA_SELECT = {
  id: true,
  kind: true,
  caption: true,
  width: true,
  height: true,
  durationMs: true,
} as const;

/** The columns both journals read. Kept as one object so the owned journal and
 *  the global one cannot drift into selecting different things — and so neither
 *  of them can ever reach `JournalMedia.data` by accident. */
const ENTRY_SELECT = {
  id: true,
  happenedOn: true,
  createdAt: true,
  title: true,
  body: true,
  media: { orderBy: { sortOrder: "asc" }, select: MEDIA_SELECT },
} as const;

type EntryRow = {
  id: string;
  happenedOn: Date;
  createdAt: Date;
  title: string | null;
  body: string;
  media: JournalMediaView[];
};

/**
 * Rows — already ordered newest-day-first, oldest-written-first within a day —
 * grouped into the days they belong to.
 *
 * One pass, because the query has already done the sorting: the days come out in
 * the order the database put them in, so there is no second sort and no Map
 * iteration order to reason about.
 *
 * `ownerOf` is how the global journal stamps each entry with where it is filed.
 * The owned journal passes nothing, and the field stays absent rather than being
 * set to the one owner every row already shares.
 */
function groupDays<T extends EntryRow>(
  rows: T[],
  today: string,
  ownerOf?: (row: T) => JournalEntryOwner,
): JournalDayView[] {
  const days: JournalDayView[] = [];

  for (const row of rows) {
    const happenedOn = row.happenedOn.toISOString().slice(0, 10);
    const sameDay = localDayKey(row.createdAt) === happenedOn;

    const view: JournalEntryView = {
      id: row.id,
      title: row.title,
      body: row.body,
      media: row.media,
      timeLabel: sameDay
        ? timeFormat.format(row.createdAt)
        : `written ${writtenFormat.format(row.createdAt)}`,
      sameDay,
      owner: ownerOf?.(row),
    };

    const last = days[days.length - 1];
    if (last && last.key === happenedOn) {
      last.entries.push(view);
    } else {
      days.push({
        key: happenedOn,
        dayLabel: dayFormat.format(row.happenedOn),
        shortLabel: shortDayFormat.format(row.happenedOn),
        isToday: happenedOn === today,
        entries: [view],
      });
    }
  }

  // **Today is always the first day, whether or not anything is written in it
  // yet.** The composer lives at the foot of today's flow rather than floating
  // above the whole page, so today has to be a place before it is a record —
  // otherwise the one day you can actually write into is the one day with no
  // heading to write under. An empty group is what an unwritten day looks like.
  if (days[0]?.key !== today) days.unshift(emptyDay(today));

  return days;
}

export async function getJournal(
  owner: JournalOwner,
  today = todayKey(),
): Promise<JournalDayView[]> {
  const entries = await db.journalEntry.findMany({
    where: owner,
    // **Newest day first, but oldest-written first *within* a day** — the two
    // directions are deliberate and they are not in conflict. The list of days
    // is a list, and a list of days is read newest-first like everything else
    // here. A day is not a list: it is one train of thought from morning to
    // night, and a train of thought read bottom-up is not one. So the entries
    // under a heading run in the order they were written, and the composer sits
    // at the *end* of today, which is where the next one goes.
    orderBy: [{ happenedOn: "desc" }, { createdAt: "asc" }],
    select: ENTRY_SELECT,
  });

  return groupDays(entries, today);
}

/**
 * How many entries the global journal reads back.
 *
 * An area's journal is bounded by how much you write about one area; the global
 * one is bounded by nothing, and it is the surface you open most often of the
 * three. A cap is a cap and it will one day cut a day in half — which is why it
 * is generous, and why the page says so at the foot of the list rather than
 * ending on a silently truncated Tuesday. Paging earns its keep the day this
 * number is genuinely reached.
 */
export const GLOBAL_JOURNAL_LIMIT = 400;

/** A project borrows its area's colour — see `JournalEntryOwner`. */
const GLOBAL_ENTRY_SELECT = {
  ...ENTRY_SELECT,
  area: { select: { slug: true, name: true, color: true } },
  project: {
    select: { slug: true, name: true, area: { select: { color: true } } },
  },
} as const;

type GlobalRow = EntryRow & {
  area: { slug: string; name: string; color: string } | null;
  project: { slug: string; name: string; area: { color: string } } | null;
};

function ownerOfRow(row: GlobalRow): JournalEntryOwner {
  if (row.project) {
    return {
      kind: "project",
      name: row.project.name,
      href: `/projects/${row.project.slug}`,
      color: row.project.area.color,
    };
  }
  if (row.area) {
    return {
      kind: "area",
      name: row.area.name,
      href: `/areas/${row.area.slug}`,
      color: row.area.color,
    };
  }
  // Both relations cascade, so a row with neither cannot survive a delete of
  // either — the same unreachable case `pathFor` throws on.
  throw new Error("An orphaned journal entry — this should be unreachable");
}

/**
 * Every journal, on one thread.
 *
 * The area and project journals are the same noun kept in different rooms, and
 * the thing you actually want to read back is *the day* — what happened on
 * Tuesday, not what happened on Tuesday about the baby. So this is the same
 * grouping as `getJournal`, over every owner at once, with each entry stamped
 * with where it is filed.
 *
 * **`areaId` narrows to an area *and its projects*.** Filtering to "Work" and
 * then not seeing the Sleepy Cat devlog you wrote that morning would be the
 * filter lying: on every other surface an area contains its projects, and a
 * filter that means something different here is a filter you have to remember
 * the rules for.
 */
export async function getGlobalJournal(
  { areaId }: { areaId?: string } = {},
  today = todayKey(),
): Promise<JournalDayView[]> {
  const entries = await db.journalEntry.findMany({
    where: areaId ? { OR: [{ areaId }, { project: { areaId } }] } : undefined,
    orderBy: [{ happenedOn: "desc" }, { createdAt: "asc" }],
    take: GLOBAL_JOURNAL_LIMIT,
    select: GLOBAL_ENTRY_SELECT,
  });

  return groupDays(entries, today, ownerOfRow);
}

/**
 * Everywhere an entry can be filed, for the global composer's picker.
 *
 * Archived projects are left out: they are somewhere you *put* things, not
 * somewhere you are still writing from, and every one of them in the list is a
 * row between you and the two you actually use. Their existing entries still
 * read back on the thread — this governs where a new one can go, not what is
 * shown.
 */
export async function getJournalOwners(): Promise<JournalOwnerOption[]> {
  const areas = await db.area.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      color: true,
      projects: {
        where: { status: { in: ["active", "simmering"] } },
        orderBy: [{ priority: "asc" }, { sortOrder: "asc" }],
        select: { id: true, name: true },
      },
    },
  });

  const options: JournalOwnerOption[] = [];

  for (const area of areas) {
    options.push({
      value: `area:${area.id}`,
      label: area.name,
      kind: "area",
      color: area.color,
    });
    for (const project of area.projects) {
      options.push({
        value: `project:${project.id}`,
        // Qualified by its area, because two areas can hold a "Setup" or a
        // "Notes" and an unqualified list of twenty projects is a list you have
        // to already know your way around.
        label: `${area.name} · ${project.name}`,
        kind: "project",
        color: area.color,
      });
    }
  }

  return options;
}

/**
 * Where the last entry went, as an option value — the global composer's default.
 *
 * You journal about the same thing repeatedly, in runs: five entries about the
 * baby, then a week of devlog. Defaulting to the last owner makes the common
 * case no taps, and the alternative — defaulting to the first area in
 * `sortOrder` — is how an afternoon about Sleepy Cat ends up filed under Work
 * because the picker was already sitting on it.
 */
export async function getLastJournalOwner(): Promise<string | null> {
  const last = await db.journalEntry.findFirst({
    orderBy: { createdAt: "desc" },
    select: { areaId: true, projectId: true },
  });

  if (!last) return null;
  if (last.projectId) return `project:${last.projectId}`;
  if (last.areaId) return `area:${last.areaId}`;
  return null;
}
