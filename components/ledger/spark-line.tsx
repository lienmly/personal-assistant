import type { NetWorthSeriesView } from "@/lib/ledger";

/**
 * Net worth over time.
 *
 * **Hand-built SVG, and a server component** — CLAUDE.md §8's charting decision.
 * The three things every library fails on are all visible here: it is painted
 * entirely through `currentColor` and the tokens, so it inverts with the theme
 * for free; it has a fixed `viewBox` with `preserveAspectRatio="none"`, so it is
 * responsive without measuring anything; and having nothing to measure is what
 * keeps it off the client, which in turn keeps `Intl` out of the bundle.
 *
 * Two details that are not decoration:
 *
 * **Carried points are drawn dashed.** A snapshot exists only for a day the
 * Ledger was opened, so a gap is a day nobody looked — not a day the number was
 * flat. Drawing the two identically would make the chart assert a measurement it
 * never took, which is the oldest rule in this file. The dashed overlay is a
 * second path over the same geometry, so the line stays continuous while saying
 * which parts of it are inference.
 *
 * **The baseline is the minimum, not zero.** Net worth is a large number that
 * moves by a small fraction, so a zero baseline draws a flat line at the top of
 * the box and hides everything worth seeing. The axis labels say what the range
 * is, which is the honest way to have it both ways.
 */

const WIDTH = 600;
const HEIGHT = 140;
const PAD = 4;

export function SparkLine({ series }: { series: NetWorthSeriesView }) {
  const { points, minCents, maxCents } = series;
  if (points.length < 2) return null;

  // A flat series would divide by zero; give it a nominal range so the line
  // renders down the middle rather than at an edge.
  const span = maxCents - minCents || Math.max(Math.abs(maxCents), 100);
  const floor = maxCents - minCents === 0 ? minCents - span / 2 : minCents;

  const x = (index: number) =>
    PAD + (index / (points.length - 1)) * (WIDTH - PAD * 2);
  const y = (cents: number) =>
    HEIGHT - PAD - ((cents - floor) / span) * (HEIGHT - PAD * 2);

  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(2)},${y(point.totalCents).toFixed(2)}`)
    .join(" ");

  const area = `${line} L${x(points.length - 1).toFixed(2)},${HEIGHT} L${x(0).toFixed(2)},${HEIGHT} Z`;

  // One segment per run of carried days, so the dashes sit only where the data
  // is inferred rather than over the whole line.
  const carriedRuns: string[] = [];
  let run: number[] = [];
  points.forEach((point, index) => {
    if (point.carried) {
      if (run.length === 0 && index > 0) run.push(index - 1);
      run.push(index);
    } else if (run.length > 0) {
      run.push(index);
      carriedRuns.push(
        run
          .map((i, position) => `${position === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(points[i].totalCents).toFixed(2)}`)
          .join(" "),
      );
      run = [];
    }
  });
  if (run.length > 1) {
    carriedRuns.push(
      run
        .map((i, position) => `${position === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(points[i].totalCents).toFixed(2)}`)
        .join(" "),
    );
  }

  const rising = (series.changeCents ?? 0) >= 0;

  return (
    <figure className="animate-rise m-0">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className={`h-32 w-full ${rising ? "text-good" : "text-bad"}`}
        role="img"
        aria-label={`Net worth from ${series.firstLabel} to ${series.lastLabel}${series.changeLabel ? `, ${series.changeLabel}` : ""}`}
      >
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={area} fill="url(#spark-fill)" />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {carriedRuns.map((segment, index) => (
          <path
            key={index}
            d={segment}
            fill="none"
            stroke="var(--color-stage)"
            strokeWidth="2"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      <figcaption className="mt-2 flex items-center justify-between text-xs text-faint">
        <span>{series.firstLabel}</span>
        {points.some((point) => point.carried) && (
          <span className="text-faint">
            dashes are days the Ledger was not opened
          </span>
        )}
        <span>{series.lastLabel}</span>
      </figcaption>
    </figure>
  );
}
