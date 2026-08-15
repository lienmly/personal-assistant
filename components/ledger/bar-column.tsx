import type { MonthView } from "@/lib/ledger";
import { cn } from "@/lib/utils";

/**
 * Money in and money out, by month.
 *
 * The third of §8's three shapes, and like the composition bar it turns out not
 * to want SVG: twelve pairs of bars whose heights are percentages is a **layout**
 * rather than geometry, and expressing it as flex keeps it responsive, keeps it
 * a server component, and paints it through the tokens with no `fill` attribute
 * anywhere. `components/today/done-map.tsx` is the same call a year earlier.
 *
 * **Both bars share one scale.** Drawing income and spending against separate
 * maxima would make a $400 month and a $9,000 month the same height, which is
 * the one comparison the chart exists to support.
 *
 * `<title>` is the whole interaction — no tooltip library, and it works on a
 * phone's long-press, which is what the contribution grid established.
 */
export function BarColumn({ months }: { months: MonthView[] }) {
  const peak = Math.max(
    1,
    ...months.map((month) => Math.max(month.inCents, month.outCents)),
  );

  return (
    <div className="animate-rise">
      <div className="flex items-end gap-1.5 sm:gap-2.5">
        {months.map((month) => {
          const isCurrent = month === months[months.length - 1];
          return (
            <div
              key={month.key}
              className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
            >
              <div className="flex h-24 w-full items-end justify-center gap-[2px]">
                <div
                  className="w-1/2 rounded-t-[3px] bg-good/70"
                  style={{
                    height: `${Math.max(month.inCents === 0 ? 0 : 2, (month.inCents / peak) * 100)}%`,
                  }}
                >
                  <title>{`${month.label} in`}</title>
                </div>
                <div
                  className="w-1/2 rounded-t-[3px] bg-ink/45"
                  style={{
                    height: `${Math.max(month.outCents === 0 ? 0 : 2, (month.outCents / peak) * 100)}%`,
                  }}
                >
                  <title>{`${month.label} out`}</title>
                </div>
              </div>
              <span
                className={cn(
                  "truncate text-[11px]",
                  isCurrent ? "font-medium text-ink" : "text-faint",
                )}
                title={`${month.label} — in and out, net ${month.netLabel}`}
              >
                {month.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-good/70" />
          In
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-ink/45" />
          Out
        </span>
        <span className="text-faint">Transfers between your own accounts are left out</span>
      </div>
    </div>
  );
}
