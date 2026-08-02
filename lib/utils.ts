/**
 * Any instant as "YYYY-MM-DD" in the *local* calendar, not UTC.
 *
 * `date.toISOString().slice(0, 10)` is the obvious version and it is wrong:
 * east of Greenwich it returns yesterday for most of the evening, which put the
 * "today" chip on the wrong row of the batch composer. `@db.Date` columns are
 * stored at UTC midnight keyed on the local day (see `dateKey` in lib/studio.ts),
 * so this is the string they must be compared against.
 *
 * The calendar (Phase 4) leans on this hard: every item on the grid — an event
 * occurrence, a task's due date, a content item's publish time — is placed by reducing
 * it to one of these keys. Three sources with three different date conventions
 * agreeing on which *cell* they land in is the whole trick.
 */
export function localDayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today's local day key. */
export function todayKey(now: Date = new Date()): string {
  return localDayKey(now);
}

/**
 * "Coding Mom" → "coding-mom". Lives here rather than next to one of its
 * callers because `prisma/seed.ts` upserts on `slug`, so the app and the seed
 * have to agree on the spelling — a project created in the UI and then named
 * in the seed must resolve to the *same* row, not two.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Tiny classname joiner. Swap for clsx + tailwind-merge if we ever need
 *  conflict resolution; today we don't. */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
