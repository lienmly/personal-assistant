import type { DoneTodayView, HeatDay } from "@/components/today/types";
import { cn } from "@/lib/utils";

/**
 * The contribution map — what got ticked off, day by day.
 *
 * A server component: it has no state and no handlers, so shipping it to the
 * browser would buy nothing. The `title` attribute is the whole interaction,
 * which is also why it works on a phone's long-press without a tooltip library.
 *
 * Five levels rather than a continuous scale. On a good day this app records
 * three or four things, not forty, so a linear ramp would leave every cell the
 * same barely-there tint; the buckets are tuned to that range and top out at
 * five. Colour is the accent crimson at four opacities — §9 allows one accent
 * per region, and this is the region.
 */
const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

function level(count: number): string {
  if (count < 0) return "bg-transparent"; // a day that hasn't happened yet
  if (count === 0) return "bg-inset";
  if (count === 1) return "bg-accent/25";
  if (count === 2) return "bg-accent/45";
  if (count <= 4) return "bg-accent/70";
  return "bg-accent";
}

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** A day key back to a label. It becomes UTC midnight when parsed, so it is
 *  formatted in UTC — the same rule as a `@db.Date` (CLAUDE.md §6). */
function label(key: string, count: number): string {
  const when = dayFormat.format(new Date(`${key}T00:00:00Z`));
  if (count < 0) return when;
  return `${count === 0 ? "Nothing" : count} ticked off · ${when}`;
}

export function DoneMap({
  days,
  weeks,
  streak,
  todayList,
}: {
  days: HeatDay[];
  weeks: number;
  streak: number;
  todayList: DoneTodayView[];
}) {
  // Column-major: the array runs Monday-to-Sunday within each week, and
  // `grid-flow-col` with seven explicit rows lays it out without transposing
  // anything by hand.
  return (
    <div>
      <div className="flex gap-1.5">
        {/* Written as a style prop rather than `grid-rows-7`: the row count is
            fixed at seven here, but the columns below are dynamic and have to
            be, so both are declared the same way to stay legible together. */}
        <div
          className="grid shrink-0 gap-[3px] pr-0.5"
          style={{ gridTemplateRows: "repeat(7, 11px)" }}
          aria-hidden="true"
        >
          {DAY_LABELS.map((day, index) => (
            <span
              key={index}
              className="flex h-[11px] items-center text-[9px] leading-none text-faint"
            >
              {day}
            </span>
          ))}
        </div>

        {/* `minmax(0, 1fr)`, never a bare `1fr` — a hand-written track defaults
            to `minmax(auto, 1fr)` and grows past its share (CLAUDE.md §9). */}
        <div
          className="grid min-w-0 flex-1 grid-flow-col gap-[3px]"
          style={{
            gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`,
            gridTemplateRows: "repeat(7, 11px)",
          }}
        >
          {days.map((day) => (
            <span
              key={day.key}
              title={label(day.key, day.count)}
              className={cn("h-[11px] rounded-[3px]", level(day.count))}
            />
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[11px] text-faint">
          {streak > 0
            ? `${streak} day${streak === 1 ? "" : "s"} in a row`
            : "No run going — one thing starts one"}
        </p>
        <div className="flex items-center gap-1" aria-hidden="true">
          <span className="mr-1 text-[10px] text-faint">less</span>
          {[0, 1, 2, 3, 5].map((n) => (
            <span
              key={n}
              className={cn("size-[9px] rounded-[2px]", level(n))}
            />
          ))}
          <span className="ml-1 text-[10px] text-faint">more</span>
        </div>
      </div>

      {todayList.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5 border-t border-line/60 pt-3">
          {todayList.map((task) => (
            <li key={task.id} className="flex items-center gap-2">
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: task.color }}
              />
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted line-through decoration-line">
                {task.title}
              </span>
              {task.projectName && (
                <span className="shrink-0 text-[11px] text-faint">
                  {task.projectName}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
