/**
 * Pure calendar-day arithmetic. **No `lib/db` import** — the same rule as
 * `lib/tracks.ts`, because the grid and the event panel are client bundles and
 * pulling Prisma into one is a build error.
 *
 * Everything here works on "YYYY-MM-DD" strings rather than `Date` objects, and
 * that is load-bearing rather than stylistic. A calendar is a grid of *local
 * calendar days*, and a `Date` is an instant; the moment you do day arithmetic
 * by adding 86,400,000 milliseconds you have a grid that loses or repeats a day
 * twice a year at the DST boundary. Adding days in UTC — which has no DST — and
 * only ever reading back the date part is immune to that.
 */

export type CalendarView = "month" | "week" | "day";

export function isCalendarView(value: string | undefined): value is CalendarView {
  return value === "month" || value === "week" || value === "day";
}

/** "2026-08-01" → [2026, 8, 1]. */
function parts(key: string): [number, number, number] {
  const [year, month, day] = key.split("-").map(Number);
  return [year, month, day];
}

/** A key as UTC midnight — the pivot every operation below goes through. */
export function keyToUtc(key: string): Date {
  const [year, month, day] = parts(key);
  return new Date(Date.UTC(year, month - 1, day));
}

function utcToKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(key: string, days: number): string {
  const date = keyToUtc(key);
  date.setUTCDate(date.getUTCDate() + days);
  return utcToKey(date);
}

export function addMonths(key: string, months: number): string {
  const [year, month, day] = parts(key);
  // Clamp rather than overflow: "31 Jan" plus a month is 28 Feb, not 3 March.
  // Date's own rollover would silently skip February entirely when paging a
  // month view forward from the 31st.
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return utcToKey(target);
}

/** ISO weekday, 1 = Monday … 7 = Sunday. Matches `Series.daysOfWeek`. */
export function isoDay(key: string): number {
  const day = keyToUtc(key).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Day of the month, 1–31. */
export function dayOfMonth(key: string): number {
  return parts(key)[2];
}

/** "2026-08" — used to grey out the leading/trailing days of a month grid. */
export function monthKey(key: string): string {
  return key.slice(0, 7);
}

/** Back up to the Monday of this key's week. */
export function startOfWeek(key: string): string {
  return addDays(key, -(isoDay(key) - 1));
}

export function startOfMonth(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

export function endOfMonth(key: string): string {
  const [year, month] = parts(key);
  return utcToKey(new Date(Date.UTC(year, month, 0)));
}

/**
 * The days a view covers, in order.
 *
 * The month grid runs Monday-to-Sunday and is padded out to whole weeks at both
 * ends, so it is always a clean 7-column grid — 35 or 42 cells depending on how
 * the month falls, never a ragged first row.
 */
export function viewDays(view: CalendarView, cursor: string): string[] {
  if (view === "day") return [cursor];

  const from =
    view === "week" ? startOfWeek(cursor) : startOfWeek(startOfMonth(cursor));
  const to =
    view === "week" ? addDays(from, 6) : endOfMonth(cursor);
  const last = view === "week" ? to : addDays(startOfWeek(to), 6);

  const days: string[] = [];
  for (let day = from; day <= last; day = addDays(day, 1)) days.push(day);
  return days;
}

/** Where the previous / next button lands for each view. */
export function shiftCursor(
  view: CalendarView,
  cursor: string,
  direction: 1 | -1,
): string {
  if (view === "month") return addMonths(cursor, direction);
  return addDays(cursor, direction * (view === "week" ? 7 : 1));
}

/** Minutes from local midnight — the unit the hour grid positions blocks in. */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function timeLabel(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
