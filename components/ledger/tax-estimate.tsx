import { EstimateFigure } from "@/components/ledger/estimate-figure";
import type { TaxView } from "@/lib/tax";
import { moneyLabel, signedMoneyLabel } from "@/lib/money";

/**
 * The estimate, when there is one.
 *
 * Every figure goes through `EstimateFigure`, so the caveat is on the number
 * rather than on the page — and **no figure is ever labelled as a form line.**
 * The labels are sentences, because a number that looks like a return invites
 * being copied onto one.
 *
 * The order follows the pipeline rather than a form: what came in, what the
 * rentals did, what is deductible, what is owed. That is the order the
 * arithmetic actually happens in, and it is the order the reasoning reads in.
 */
export function TaxEstimateView({ tax }: { tax: TaxView }) {
  const { estimate: result, labels } = tax;
  if (!result || !labels) return null;

  const draft = tax.usingDraftRules;
  const owed = result.balanceCents > 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-tile bg-obsidian px-5 py-4 text-white">
          <p className="text-[13px] text-white/60">Estimated total tax</p>
          <p className="mt-1.5 flex items-baseline gap-1.5 text-[28px] font-semibold leading-none tracking-tight tabular-nums">
            {labels.totalTaxLabel}
            <span className="text-[10px] font-normal text-white/40">est.</span>
          </p>
          <p className="mt-2 text-xs text-white/50">
            {tax.taxYear} · federal and California
            {draft && " · draft rules"}
          </p>
        </div>

        <div className="rounded-tile bg-card px-5 py-4 shadow-card">
          <EstimateFigure
            label="Effective rate"
            value={labels.effectiveRateLabel}
            note="Total tax over everything that came in"
            draft={draft}
            size="hero"
          />
        </div>

        <div className="rounded-tile bg-card px-5 py-4 shadow-card">
          <EstimateFigure
            label="Withheld and paid"
            value={labels.withheldLabel}
            note="Salary withholding plus anything paid in"
            size="hero"
          />
        </div>

        <div className="rounded-tile bg-card px-5 py-4 shadow-card">
          <EstimateFigure
            label={owed ? "Still to pay" : "Refund"}
            value={moneyLabel(Math.abs(result.balanceCents))}
            note={
              owed
                ? "The gap between what is owed and what has gone in"
                : "More has gone in than is owed"
            }
            // The one figure on this screen whose sign is the point (§8).
            tone={owed ? "bad" : "good"}
            draft={draft}
            size="hero"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-card bg-card p-5 shadow-card">
          <h3 className="mb-4 text-[15px] font-semibold tracking-tight text-ink">
            What came in
          </h3>
          <div className="flex flex-col gap-3.5">
            {result.incomeLines.map((line) => (
              <EstimateFigure
                key={line.key}
                label={line.label}
                value={moneyLabel(line.cents)}
              />
            ))}
            <EstimateFigure
              label="What the rentals did, after depreciation"
              value={signedMoneyLabel(result.passive.netCents)}
              note={result.passive.reason}
              tone={result.passive.netCents < 0 ? "bad" : "good"}
              draft={draft}
            />
            {result.passive.suspendedCents > 0 && (
              <EstimateFigure
                label="Rental loss carried to a later year"
                value={moneyLabel(result.passive.suspendedCents)}
                note="Not lost — it offsets rental profit later, or is released when the property is sold."
                draft={draft}
              />
            )}
          </div>
        </section>

        <section className="rounded-card bg-card p-5 shadow-card">
          <h3 className="mb-4 text-[15px] font-semibold tracking-tight text-ink">
            What comes off
          </h3>
          <div className="flex flex-col gap-3.5">
            <EstimateFigure
              label="Income after adjustments"
              value={labels.agiLabel}
              from="Everything in, less the above-the-line deductions and whatever rental loss was allowed"
              draft={draft}
            />
            <EstimateFigure
              label={
                result.usedItemized
                  ? "Itemized deductions"
                  : "Standard deduction"
              }
              value={labels.deductionLabel}
              note={
                result.usedItemized
                  ? `Larger than the standard ${moneyLabel(result.standardCents)}`
                  : `Larger than itemizing, which came to ${moneyLabel(result.itemizedCents)}`
              }
              draft={draft}
            />
            {result.qbi.deductionCents > 0 && (
              <EstimateFigure
                label="Qualified business income deduction"
                value={labels.qbiLabel}
                note={result.qbi.unmodelled ?? result.qbi.safeHarbour.summary}
                draft={draft}
              />
            )}
            <EstimateFigure
              label="Income the rates apply to"
              value={labels.taxableLabel}
              draft={draft}
            />
          </div>
        </section>
      </div>

      <section className="rounded-card bg-card p-5 shadow-card">
        <h3 className="mb-4 text-[15px] font-semibold tracking-tight text-ink">
          What is owed
        </h3>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <EstimateFigure
            label="Federal income tax"
            value={moneyLabel(result.federalBeforeCreditsCents)}
            note="Ordinary rates, with any long-term gains stacked on top"
            draft={draft}
          />
          <EstimateFigure
            label="Self-employment tax"
            value={labels.seLabel}
            note={
              result.se.totalCents === 0
                ? "None"
                : "Social Security and Medicare on self-employed earnings"
            }
            draft={draft}
          />
          <EstimateFigure
            label="Net investment income tax"
            value={labels.niitLabel}
            note={
              result.niit.taxCents === 0
                ? "Below the threshold"
                : "3.8% of the smaller of investment income and the amount over the threshold"
            }
            draft={draft}
          />
          <EstimateFigure
            label="California"
            value={tax.california.usable ? labels.californiaLabel : null}
            note={
              tax.california.usable
                ? "Its own brackets, with no QBI deduction and gains taxed as ordinary income"
                : "California's constants have not been confirmed"
            }
            draft={draft}
          />
        </div>
      </section>

      {result.unmodelled.length > 0 && (
        <section className="rounded-card bg-card p-5 shadow-card">
          <h3 className="mb-3 text-[15px] font-semibold tracking-tight text-ink">
            Where this estimate is deliberately incomplete
          </h3>
          <ul className="flex flex-col gap-2">
            {result.unmodelled.map((note) => (
              <li
                key={note}
                className="flex gap-2 text-[13px] leading-relaxed text-muted"
              >
                <span className="text-faint">·</span>
                {note}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
