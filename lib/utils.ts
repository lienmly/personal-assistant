/**
 * Today as "YYYY-MM-DD" in the *local* calendar, not UTC.
 *
 * `new Date().toISOString().slice(0, 10)` is the obvious version and it is
 * wrong: east of Greenwich it returns yesterday for most of the evening, which
 * put the "today" chip on the wrong row of the batch composer. `@db.Date`
 * columns are stored at UTC midnight keyed on the local day (see `dateKey` in
 * lib/studio.ts), so this is the string they must be compared against.
 */
export function todayKey(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
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
