import { CalendarSurface } from "@/components/calendar/calendar-surface";
import { SurfaceHeader } from "@/components/ui/surface-header";
import { getCalendar, getCalendarMeta } from "@/lib/calendar";
import {
  type CalendarView,
  isCalendarView,
  minutesOfDay,
  viewDays,
} from "@/lib/calendar-keys";
import { todayKey } from "@/lib/utils";

export const metadata = { title: "Calendar · Clan Centurio" };

export const dynamic = "force-dynamic";

/**
 * All three date formatters run in **UTC**, and that is not the usual rule.
 *
 * They are never handed a real timestamp — only a day key turned into UTC
 * midnight by `asUtc`. Formatting that in local time west of Greenwich renders
 * the previous day, which is the same class of bug CLAUDE.md §6 documents for
 * `@db.Date` columns. The key already *is* the local day; UTC is simply how it
 * gets read back out.
 */
const monthLabel = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dayLabel = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  timeZone: "UTC",
});
const fullDayLabel = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

function asUtc(key: string): Date {
  return new Date(`${key}T00:00:00Z`);
}

/**
 * The Calendar surface. Time, with everything else layered onto it.
 *
 * The grid is hand-built rather than a calendar library (§8, resolved in Phase
 * 4). Month, week and day are a CSS grid and some day arithmetic; a library
 * would have arrived with its own DOM and its own stylesheet to override, and
 * this design — borderless, very round, tiles on a tinted ground — is exactly
 * the kind that gets fought rather than configured. Same reasoning that
 * deferred shadcn in Phase 1.
 *
 * View and cursor come from the query string, so every date computation and
 * every label stays on the server and the whole surface is one render.
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const today = todayKey();
  const requested = one("view");
  const view: CalendarView = isCalendarView(requested) ? requested : "month";
  // A malformed ?date= falls back to today rather than throwing — the URL is
  // hand-editable by design, and a bad one shouldn't cost you the screen.
  const raw = one("date");
  const cursor = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today;
  const areaSlug = one("area") ?? null;

  const days = viewDays(view, cursor);

  const [{ byDay, events, counts }, { areas, projects }] = await Promise.all([
    getCalendar(days, { areaSlug }),
    getCalendarMeta(),
  ]);

  const dayLabels: Record<string, string> = {};
  for (const day of days) dayLabels[day] = dayLabel.format(asUtc(day));

  const periodLabel =
    view === "day"
      ? fullDayLabel.format(asUtc(cursor))
      : view === "week"
        ? `${dayLabel.format(asUtc(days[0]))} – ${dayLabel.format(
            asUtc(days[days.length - 1]),
          )} · ${monthLabel.format(asUtc(days[days.length - 1]))}`
        : monthLabel.format(asUtc(cursor));

  return (
    <>
      <SurfaceHeader
        title="Calendar"
        tagline="Events, mark due dates and drop publish times layered on one timeline."
        meta={periodLabel}
      />

      <CalendarSurface
        view={view}
        cursor={cursor}
        areaSlug={areaSlug}
        days={days}
        byDay={byDay}
        events={events}
        counts={counts}
        today={today}
        // Only meaningful when today is on screen; the grid skips the marker
        // otherwise. Computed here so the client never formats a time itself.
        nowMinutes={days.includes(today) ? minutesOfDay(new Date()) : null}
        dayLabels={dayLabels}
        areas={areas}
        projects={projects}
      />
    </>
  );
}
