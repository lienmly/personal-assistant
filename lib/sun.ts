/**
 * Sunrise and sunset, from the NOAA solar-position equations.
 *
 * Client-safe on purpose — no Prisma import, no server-only API — because the
 * theme switch runs in the browser against the browser's own clock and the
 * browser's own idea of where it is. Same rule `lib/tracks.ts` and
 * `lib/calendar-keys.ts` follow.
 *
 * Accurate to about a minute, which is roughly a thousand times more precision
 * than "make the dashboard dark in the evening" needs. It is here rather than a
 * dependency because it is forty lines of arithmetic and the alternative was a
 * package that would need updating forever.
 *
 * Everything inside works in epoch milliseconds and UTC days. That is the same
 * trick `lib/calendar-keys.ts` uses and for the same reason: UTC has no DST, so
 * a day is always exactly 86,400,000 ms and the arithmetic cannot lose or
 * repeat an hour twice a year. Local time only ever enters at the edges, when a
 * caller formats one of these instants for reading.
 */

export type Coords = { lat: number; lon: number };

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const MS_PER_DAY = 86_400_000;
const MS_PER_MINUTE = 60_000;

/**
 * "Official" sunrise/sunset — the sun's centre 0.833° below the horizon, which
 * allows for atmospheric refraction plus the sun's own radius. This is the
 * figure almanacs and weather apps quote, so the switch happens when the
 * outside world agrees the sun has gone.
 */
const ZENITH = 90.833;

function mod360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Start of the UTC day containing an instant. */
function utcDayStart(ms: number): number {
  return Math.floor(ms / MS_PER_DAY) * MS_PER_DAY;
}

type DaySun = {
  sunrise: number | null;
  sunset: number | null;
  /** True when the sun stays up all day rather than staying down — the two
   *  polar cases both yield no crossings, and they mean opposite things. */
  midnightSun: boolean;
};

/**
 * Sunrise and sunset for one UTC day, as epoch ms.
 *
 * Both are null inside the polar circles for part of the year, where the sun
 * does not cross the horizon at all. `midnightSun` says which way.
 */
function sunForUtcDay(dayStart: number, at: Coords): DaySun {
  // Julian centuries at 12:00 UTC of this day. JD counts from noon, so the
  // day's midpoint — which is what the series below is expanded around — is
  // the midnight figure plus half a day.
  const jd = dayStart / MS_PER_DAY + 2440587.5;
  const t = (jd + 0.5 - 2451545) / 36525;

  const meanLong = mod360(280.46646 + t * (36000.76983 + t * 0.0003032));
  const meanAnom = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);

  // Equation of the centre: the correction from a circular orbit to the real
  // elliptical one.
  const centre =
    Math.sin(meanAnom * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * meanAnom * RAD) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * meanAnom * RAD) * 0.000289;

  const trueLong = meanLong + centre;
  const apparentLong =
    trueLong - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * t) * RAD);

  const meanObliquity =
    23 +
    (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliquity =
    meanObliquity + 0.00256 * Math.cos((125.04 - 1934.136 * t) * RAD);

  const declination =
    Math.asin(Math.sin(obliquity * RAD) * Math.sin(apparentLong * RAD)) * DEG;

  // Equation of time, in minutes — the gap between clock noon and solar noon.
  const varY = Math.tan((obliquity / 2) * RAD) ** 2;
  const equationOfTime =
    4 *
    DEG *
    (varY * Math.sin(2 * meanLong * RAD) -
      2 * eccentricity * Math.sin(meanAnom * RAD) +
      4 *
        eccentricity *
        varY *
        Math.sin(meanAnom * RAD) *
        Math.cos(2 * meanLong * RAD) -
      0.5 * varY * varY * Math.sin(4 * meanLong * RAD) -
      1.25 * eccentricity * eccentricity * Math.sin(2 * meanAnom * RAD));

  // Solar noon at this longitude, as minutes from 00:00 UTC.
  const solarNoon = 720 - 4 * at.lon - equationOfTime;

  const cosHourAngle =
    Math.cos(ZENITH * RAD) /
      (Math.cos(at.lat * RAD) * Math.cos(declination * RAD)) -
    Math.tan(at.lat * RAD) * Math.tan(declination * RAD);

  // No solution: the sun never reaches the horizon today. Above +1 it never
  // climbs to it (polar night); below −1 it never falls to it (midnight sun).
  if (cosHourAngle > 1 || cosHourAngle < -1) {
    return { sunrise: null, sunset: null, midnightSun: cosHourAngle < -1 };
  }

  const halfDayMinutes = Math.acos(cosHourAngle) * DEG * 4;

  return {
    sunrise: dayStart + (solarNoon - halfDayMinutes) * MS_PER_MINUTE,
    sunset: dayStart + (solarNoon + halfDayMinutes) * MS_PER_MINUTE,
    midnightSun: false,
  };
}

export type SolarState = {
  /** Whether the sun is currently below the horizon. */
  night: boolean;
  /** When that stops being true — the instant to re-evaluate at. */
  next: Date;
  /** The next crossing's kind, for labelling. */
  nextKind: "sunrise" | "sunset";
};

/**
 * Is the sun down where `at` is, and when does that change?
 *
 * Three UTC days are considered rather than one, because a *local* evening can
 * sit either side of a UTC midnight depending on longitude: from California a
 * sunset at 19:52 local is 02:52 the next UTC day. Collecting the crossings
 * from yesterday, today and tomorrow and then simply asking which one was most
 * recent sidesteps that entirely — there is no timezone reasoning to get wrong,
 * only a sorted list of instants.
 */
export function solarState(now: Date, at: Coords): SolarState {
  const nowMs = now.getTime();
  const today = utcDayStart(nowMs);

  const crossings: { at: number; kind: "sunrise" | "sunset" }[] = [];
  let midnightSun = false;

  for (let offset = -1; offset <= 1; offset += 1) {
    const day = sunForUtcDay(today + offset * MS_PER_DAY, at);
    if (day.sunrise !== null) crossings.push({ at: day.sunrise, kind: "sunrise" });
    if (day.sunset !== null) crossings.push({ at: day.sunset, kind: "sunset" });
    if (offset === 0) midnightSun = day.midnightSun;
  }

  crossings.sort((a, b) => a.at - b.at);

  const previous = crossings.filter((c) => c.at <= nowMs).pop();
  const upcoming = crossings.find((c) => c.at > nowMs);

  // Inside a polar circle in high summer or deep winter there is no crossing
  // within the window. The state is then whichever of the two extremes applies,
  // and the honest "next" is simply to look again in an hour: the answer will
  // hold for weeks, and re-checking cheaply is better than computing when the
  // polar night ends.
  if (!previous || !upcoming) {
    return {
      night: !midnightSun,
      next: new Date(nowMs + 60 * MS_PER_MINUTE),
      nextKind: midnightSun ? "sunset" : "sunrise",
    };
  }

  return {
    night: previous.kind === "sunset",
    next: new Date(upcoming.at),
    nextKind: upcoming.kind,
  };
}
