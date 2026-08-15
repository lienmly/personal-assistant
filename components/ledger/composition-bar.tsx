import type { NetWorthView } from "@/components/ledger/types";
import type { NetWorthGroup } from "@/lib/ledger-rules";
import { cn } from "@/lib/utils";

/**
 * What the net worth is *made of*, as one bar.
 *
 * **Flex percentages, not SVG.** The Ledger's other two charts need path
 * geometry against a fixed `viewBox`; a stacked bar does not — it is four
 * widths that add to 100%, and expressing that as CSS makes it responsive for
 * free, keeps it a server component, and lets it be painted straight through
 * the tokens rather than through a `fill` attribute. Reaching for SVG here would
 * be the charting-library mistake in miniature: bringing geometry to a problem
 * that is a layout.
 *
 * **The segments are an opacity ramp of `--color-ink`, and that is a budget
 * decision.** §9 allows one crimson accent per region and one black element per
 * screen; four categorical colours would blow both, and a chart that invents its
 * own palette is exactly what §11 means by a hex being a bug in two themes. A
 * ramp reads as one quantity divided up — which is what this is — and it
 * inverts correctly in the dark theme without a second set of values.
 *
 * Owed is the exception and is `--color-bad`, because it is not a slice of the
 * total: it is subtracted from it. Drawing it in the same ramp would say it was
 * part of what you have.
 */

const SEGMENT_TONE: Record<NetWorthGroup, string> = {
  liquid: "bg-ink",
  invested: "bg-ink/70",
  retirement: "bg-ink/45",
  property: "bg-ink/25",
  owed: "bg-bad",
};

export function CompositionBar({ worth }: { worth: NetWorthView }) {
  const assetGroups = worth.groups.filter(
    (group) => group.group !== "owed" && group.totalCents > 0,
  );

  const assetsCents = worth.assetsCents;
  if (assetsCents <= 0) return null;

  // Owed is drawn on the same axis as the assets, so a mortgage that is most of
  // what you own reads as most of the bar. Scaling it to its own width would
  // make every debt look equally large, which is the one thing this bar is for.
  const owedFraction = Math.min(1, worth.liabilitiesCents / assetsCents);

  return (
    <div className="animate-rise">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-inset">
        {assetGroups.map((group) => (
          <div
            key={group.group}
            className={cn(SEGMENT_TONE[group.group], "h-full")}
            style={{ width: `${(group.totalCents / assetsCents) * 100}%` }}
            // The whole interaction, exactly as the contribution grid on Today
            // does it — and the reason it works on a phone's long-press without
            // a tooltip library.
            title={`${group.label} — ${group.totalLabel}`}
          />
        ))}
      </div>

      {worth.liabilitiesCents > 0 && (
        <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="h-full rounded-full bg-bad"
            style={{ width: `${owedFraction * 100}%` }}
            title={`Owed — ${worth.liabilitiesLabel}`}
          />
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {[...assetGroups, ...worth.groups.filter((g) => g.group === "owed" && g.totalCents > 0)].map(
          (group) => (
            <span
              key={group.group}
              className="inline-flex items-center gap-1.5 text-[12.5px] text-muted"
            >
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  SEGMENT_TONE[group.group],
                )}
              />
              {group.label}
              <span className="text-faint">{group.totalLabel}</span>
            </span>
          ),
        )}
      </div>
    </div>
  );
}
