/**
 * US and Vietnamese holidays, **computed rather than stored**.
 *
 * Nothing here is an `Event` row, and that is the point. CLAUDE.md §6 has said
 * since 2026-08-03 that *nothing but you creates an event* — a row you did not
 * write costs you a stop, a re-read and a decision about whether it was yours.
 * A public holiday escapes that rule for the same reason a weekend does: it is
 * **not a claim about your life**. Nobody is asserting you are doing anything on
 * Tết; the app is saying what day it is. So a holiday is derived from the day
 * key the way "Monday" is, on a layer you can switch off, and it can never be
 * edited, ticked, dragged or deleted — there is no row to delete.
 *
 * That also settles the accuracy question CLAUDE.md keeps arriving at ("an
 * unverified date is a note, not a due date"). Every date below is either a
 * fixed calendar rule (4 July), an ordinal weekday rule (fourth Thursday of
 * November) or an astronomical one (the lunar calendar, Easter's computus).
 * None of them is transcribed from memory, and all of them are checkable by
 * anyone against the rule that produced them.
 *
 * **No `lib/db` import** — the same rule as `lib/calendar-keys.ts`, and for the
 * same reason: this is pure arithmetic over day keys.
 */

import { addDays } from "@/lib/calendar-keys";

export type HolidayRegion = "us" | "vn";

export type Holiday = {
  /** "YYYY-MM-DD", the local calendar day it falls on. */
  key: string;
  name: string;
  region: HolidayRegion;
  /** The second line: the region, plus the federal observance where it moves. */
  meta: string;
};

export const REGION_LABEL: Record<HolidayRegion, string> = {
  us: "US holiday",
  vn: "Việt Nam",
};

function key(year: number, month: number, day: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Day of the week for a day key, 0 = Sunday. Via UTC, which has no DST. */
function weekday(dayKey: string): number {
  return new Date(`${dayKey}T00:00:00Z`).getUTCDay();
}

/** The `n`th `wd` (0 = Sunday) of a month — nth(2026, 11, 4, 4) is
 *  Thanksgiving. `n` of -1 means the last one in the month. */
function nth(year: number, month: number, wd: number, n: number): string {
  if (n < 0) {
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const lastKey = key(year, month, last);
    return addDays(lastKey, -((weekday(lastKey) - wd + 7) % 7));
  }
  const first = key(year, month, 1);
  const offset = (wd - weekday(first) + 7) % 7;
  return addDays(first, offset + (n - 1) * 7);
}

/**
 * Where a fixed-date federal holiday is actually taken.
 *
 * Saturday moves to the Friday before, Sunday to the Monday after. Reported as
 * a note on the real date rather than as a second row: 4 July is 4 July, and
 * duplicating it would make the count say the holiday happens twice.
 */
function observed(dayKey: string): string | null {
  const wd = weekday(dayKey);
  if (wd === 6) return addDays(dayKey, -1);
  if (wd === 0) return addDays(dayKey, 1);
  return null;
}

const OBSERVED_LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function usFixed(year: number, month: number, day: number, name: string): Holiday {
  const dayKey = key(year, month, day);
  const shifted = observed(dayKey);
  return {
    key: dayKey,
    name,
    region: "us",
    meta: shifted
      ? `${REGION_LABEL.us} · observed ${OBSERVED_LABEL.format(new Date(`${shifted}T00:00:00Z`))}`
      : REGION_LABEL.us,
  };
}

function us(dayKey: string, name: string): Holiday {
  return { key: dayKey, name, region: "us", meta: REGION_LABEL.us };
}

/** Gregorian Easter Sunday — the computus, which is a published algorithm
 *  rather than a table anyone has to keep up to date. */
function easter(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return key(year, month, day);
}

/**
 * The eleven federal holidays, plus the handful of days a household actually
 * marks. Nothing commercial, nothing that needs a note to explain why it is
 * there.
 */
function usHolidays(year: number): Holiday[] {
  return [
    usFixed(year, 1, 1, "New Year's Day"),
    us(nth(year, 1, 1, 3), "Martin Luther King Jr. Day"),
    us(key(year, 2, 14), "Valentine's Day"),
    us(nth(year, 2, 1, 3), "Presidents' Day"),
    us(easter(year), "Easter Sunday"),
    us(nth(year, 5, 0, 2), "Mother's Day"),
    us(nth(year, 5, 1, -1), "Memorial Day"),
    us(nth(year, 6, 0, 3), "Father's Day"),
    usFixed(year, 6, 19, "Juneteenth"),
    usFixed(year, 7, 4, "Independence Day"),
    us(nth(year, 9, 1, 1), "Labor Day"),
    us(nth(year, 10, 1, 2), "Indigenous Peoples' / Columbus Day"),
    us(key(year, 10, 31), "Halloween"),
    usFixed(year, 11, 11, "Veterans Day"),
    us(nth(year, 11, 4, 4), "Thanksgiving"),
    us(key(year, 12, 24), "Christmas Eve"),
    usFixed(year, 12, 25, "Christmas Day"),
    us(key(year, 12, 31), "New Year's Eve"),
  ];
}

/* ------------------------------------------------------------------ *
 * The Vietnamese lunar calendar.
 *
 * Hồ Ngọc Đức's algorithm, which is the reference implementation the
 * printed Vietnamese calendars agree with: astronomical new moons and
 * solar longitudes, resolved in **UTC+7**, because a lunar day begins at
 * midnight *in Vietnam* and computing it in any other zone lands a
 * holiday a day out roughly one year in three.
 * ------------------------------------------------------------------ */

const VN_TZ = 7;

function jdFromDate(day: number, month: number, year: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  const jd =
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045;
  if (jd < 2299161) {
    return (
      day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083
    );
  }
  return jd;
}

function jdToKey(jd: number): string {
  let a: number;
  let b: number;
  let c: number;
  if (jd > 2299160) {
    a = jd + 32044;
    b = Math.floor((4 * a + 3) / 146097);
    c = a - Math.floor((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return key(
    b * 100 + d - 4800 + Math.floor(m / 10),
    m + 3 - 12 * Math.floor(m / 10),
    e - Math.floor((153 * m + 2) / 5) + 1,
  );
}

/** Julian day of the `k`th new moon since 1900-01-01, in universal time. */
function newMoon(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = Math.PI / 180;
  let jd1 =
    2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let c1 =
    (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  c1 -= 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  c1 -= 0.0004 * Math.sin(dr * 3 * Mpr);
  c1 += 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  c1 -= 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  c1 -= 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  c1 += 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltat =
    T < -11
      ? 0.001 +
        0.000839 * T +
        0.0002261 * T2 -
        0.00000845 * T3 -
        0.000000081 * T * T3
      : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return jd1 + c1 - deltat;
}

/** The sun's ecliptic longitude, in radians, at a Julian day. */
function sunLongitude(jdn: number): number {
  const T = (jdn - 2451545.0) / 36525;
  const T2 = T * T;
  const dr = Math.PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let dl = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  dl +=
    (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) +
    0.00029 * Math.sin(dr * 3 * M);
  let l = (L0 + dl) * dr;
  l -= Math.PI * 2 * Math.floor(l / (Math.PI * 2));
  return l;
}

/** Which 30° sector of the zodiac the sun is in on a local day — the test that
 *  decides which lunar month is the eleventh, and which is a leap. */
function sunSector(dayNumber: number): number {
  return Math.floor((sunLongitude(dayNumber - 0.5 - VN_TZ / 24) / Math.PI) * 6);
}

function newMoonDay(k: number): number {
  return Math.floor(newMoon(k) + 0.5 + VN_TZ / 24);
}

/** The Julian day the 11th lunar month of `year` starts — the anchor the whole
 *  conversion hangs off, because it is the month containing the solstice. */
function lunarMonth11(year: number): number {
  const off = jdFromDate(31, 12, year) - 2415021;
  const k = Math.floor(off / 29.530588853);
  const nm = newMoonDay(k);
  return sunSector(nm) >= 9 ? newMoonDay(k - 1) : nm;
}

/** How many months after the 11th the leap month falls, in a 13-month year. */
function leapMonthOffset(a11: number): number {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let i = 1;
  let last: number;
  let arc = sunSector(newMoonDay(k + i));
  do {
    last = arc;
    i += 1;
    arc = sunSector(newMoonDay(k + i));
  } while (arc !== last && i < 14);
  return i - 1;
}

/** A lunar date → the day key it falls on. Never a leap month: every holiday
 *  here is in an ordinary one, and asking for a leap date that does not exist
 *  is a question none of them raise. */
function lunarToKey(day: number, month: number, year: number): string {
  const a11 = month < 11 ? lunarMonth11(year - 1) : lunarMonth11(year);
  const b11 = month < 11 ? lunarMonth11(year) : lunarMonth11(year + 1);
  const k = Math.floor(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = month - 11;
  if (off < 0) off += 12;
  if (b11 - a11 > 365) {
    const leapOff = leapMonthOffset(a11);
    if (off >= leapOff) off += 1;
  }
  return jdToKey(newMoonDay(k + off) + day - 1);
}

function vn(dayKey: string, name: string): Holiday {
  return { key: dayKey, name, region: "vn", meta: REGION_LABEL.vn };
}

/**
 * The six public holidays, plus the lunar days a family keeps.
 *
 * Tết is four rows — the eve and the first three days — because that is how it
 * is actually lived and how the country's leave is actually granted; one row
 * saying "Tết" against a week nobody is working would be the calendar being
 * tidier than the truth.
 */
function vnHolidays(year: number): Holiday[] {
  const tet = lunarToKey(1, 1, year);
  return [
    vn(key(year, 1, 1), "Tết Dương lịch · New Year's Day"),
    vn(lunarToKey(23, 12, year - 1), "Ông Công Ông Táo"),
    vn(addDays(tet, -1), "Giao thừa · Tết Eve"),
    vn(tet, "Tết Nguyên Đán · Mùng 1"),
    vn(addDays(tet, 1), "Mùng 2 Tết"),
    vn(addDays(tet, 2), "Mùng 3 Tết"),
    vn(lunarToKey(15, 1, year), "Rằm tháng Giêng"),
    vn(lunarToKey(10, 3, year), "Giỗ Tổ Hùng Vương"),
    vn(key(year, 4, 30), "Ngày Giải phóng miền Nam"),
    vn(key(year, 5, 1), "Ngày Quốc tế Lao động"),
    vn(lunarToKey(5, 5, year), "Tết Đoan Ngọ"),
    vn(lunarToKey(15, 7, year), "Lễ Vu Lan"),
    vn(lunarToKey(15, 8, year), "Tết Trung Thu"),
    vn(key(year, 9, 2), "Quốc khánh · National Day"),
  ];
}

/**
 * Every holiday landing on the given days.
 *
 * Computed a whole year at a time and then filtered, because the rules are
 * per-year and a window can straddle two — and because a year's worth is under
 * forty rows of arithmetic, which is cheaper than working out which rules could
 * possibly reach a six-week grid.
 */
export function holidaysOn(days: string[]): Holiday[] {
  if (days.length === 0) return [];
  const wanted = new Set(days);
  const years = new Set<number>();
  for (const day of days) years.add(Number(day.slice(0, 4)));

  const out: Holiday[] = [];
  for (const year of years) {
    for (const holiday of [...usHolidays(year), ...vnHolidays(year)]) {
      if (wanted.has(holiday.key)) out.push(holiday);
    }
  }
  return out;
}
