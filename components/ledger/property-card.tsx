import Link from "next/link";
import { Building2, Info, TrendingUp } from "lucide-react";

import type { PropertyView } from "@/lib/property";
import { cn } from "@/lib/utils";

/**
 * One property.
 *
 * The design problem here is that this card mixes figures of **three different
 * kinds** and must not let them blur into one confident number:
 *
 * - the **value** is an estimate, with real error bars, so it is shown with its
 *   range and the date it was taken;
 * - the **debt** is a statement from the servicer, exact;
 * - the **cash flow** is bank transactions, exact but only over what has been
 *   claimed for this property, which the card says out loud.
 *
 * Equity is the one derived figure and it inherits the estimate's uncertainty —
 * so it is shown, because it is the number people actually want, and it is
 * shown *next to* the range rather than on its own.
 */
export function PropertyCard({
  property,
  index,
}: {
  property: PropertyView;
  index: number;
}) {
  const owedFraction =
    property.valueCents && property.valueCents > 0
      ? Math.min(1, property.owedCents / property.valueCents)
      : 0;

  return (
    <section
      className="animate-rise rounded-card bg-card p-5 shadow-card"
      style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2">
            {property.areaColor && (
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: property.areaColor }}
              />
            )}
            <span className="text-[12.5px] text-muted">
              {property.statusLabel}
              {property.managerName ? ` · ${property.managerName}` : ""}
            </span>
          </div>
          <h3 className="text-[19px] font-semibold leading-tight tracking-tight text-ink">
            {property.label}
          </h3>
          <p className="mt-1 text-[13px] text-muted">{property.addressLabel}</p>
        </div>

        {property.projectSlug && (
          <Link
            href={`/projects/${property.projectSlug}`}
            className="shrink-0 rounded-chip bg-inset px-3 py-1.5 text-[12.5px] text-muted transition-colors duration-(--duration-quick) hover:text-ink active:scale-[0.97]"
          >
            Tasks & docs →
          </Link>
        )}
      </div>

      {/* Value against debt, on one axis, so a property that is mostly mortgage
          reads as mostly mortgage. */}
      {property.valueCents !== null ? (
        <div className="mb-4">
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[24px] font-semibold leading-none tracking-tight text-ink">
              {property.value?.value}
              <span className="numeral-tail">{property.value?.tail}</span>
            </span>
            <span className="text-[12.5px] text-faint">
              {property.valueRangeLabel ?? property.valuationAgeLabel}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-inset">
            <div
              className="h-full rounded-full bg-bad"
              style={{ width: `${owedFraction * 100}%` }}
              title={`Owed ${property.owedLabel}`}
            />
          </div>
          <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-[12.5px]">
            <span className="text-bad">{property.owedLabel} owed</span>
            {property.equityLabel && (
              <span className="text-ink">{property.equityLabel} equity</span>
            )}
          </div>
          {property.valueRangeLabel && property.valuationAgeLabel && (
            <p className="mt-1.5 text-xs text-faint">
              {property.valuationAgeLabel} · an estimate, not an appraisal
            </p>
          )}
        </div>
      ) : (
        <div className="mb-4 rounded-tile bg-inset px-4 py-3">
          <p className="text-[13px] text-muted">
            No valuation yet. Bought for {property.purchasePriceLabel} on{" "}
            {property.purchasedLabel} —{" "}
            <span className="text-faint">
              which is deliberately not used as the current value.
            </span>
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure
          label="Rent"
          value={property.monthlyRentLabel ?? "—"}
          note={
            property.rentGapLabel && property.rentGapCents
              ? `market ${property.rentGapCents > 0 ? "above" : "below"} by ${property.rentGapLabel.replace(/^[+−]/, "")}`
              : property.rentEstimateLabel
                ? `market ${property.rentEstimateLabel}`
                : "no lease recorded"
          }
          tone={
            property.rentGapCents !== null && property.rentGapCents > 20_000
              ? "warn"
              : "plain"
          }
        />
        <Figure
          label="Cash flow"
          value={property.cashFlowNetLabel}
          note={
            property.transactionCount === 0
              ? "nothing claimed yet"
              : `${property.transactionCount} claimed, 12 months`
          }
          tone={property.cashFlowNetCents < 0 ? "bad" : "good"}
        />
        <Figure
          label="Cap rate"
          value={property.capRateLabel ?? "—"}
          note={property.capRateLabel ? "rent ÷ value" : "needs a lease"}
        />
        <Figure
          label="Basis"
          value={property.basisLabel}
          note="price + closing costs"
        />
      </div>

      {property.loans.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5">
          {property.loans.map((loan) => (
            <li
              key={loan.id}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-tile bg-inset px-3.5 py-2.5 text-[13px]"
            >
              <span className="text-ink">
                {loan.label}
                {loan.ratePercent !== null && (
                  <span className="ml-1.5 text-faint">
                    {Number(loan.ratePercent.toFixed(3))}%
                  </span>
                )}
              </span>
              <span className="flex flex-wrap items-baseline gap-2 text-muted">
                {loan.ytdInterestLabel && (
                  <span
                    className="text-faint"
                    title="Year-to-date interest, straight from the servicer — this is the Schedule E line"
                  >
                    {loan.ytdInterestLabel} interest YTD
                  </span>
                )}
                <span className="tabular-nums text-ink">{loan.balanceLabel}</span>
                {!loan.live && (
                  <span className="text-warn" title={loan.asOfLabel ?? undefined}>
                    by hand
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Stated as what is missing, not as an error — Layer 5 refuses to
          estimate depreciation without it, and the refusal is the feature. */}
      {property.depreciationBlocker && (
        <p className="mt-4 flex items-start gap-2 rounded-tile bg-warn-soft px-3.5 py-2.5 text-[12.5px] text-warn">
          <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
          <span>
            <strong className="font-medium">Depreciation is not computed.</strong>{" "}
            {property.depreciationBlocker}. A guess here is wrong by thousands a
            year and looks exactly like a real figure.
          </span>
        </p>
      )}
    </section>
  );
}

function Figure({
  label,
  value,
  note,
  tone = "plain",
}: {
  label: string;
  value: string;
  note: string;
  tone?: "plain" | "good" | "bad" | "warn";
}) {
  return (
    <div className="rounded-tile bg-inset px-3.5 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={cn(
          "mt-1 text-[16px] font-semibold leading-none tracking-tight tabular-nums",
          tone === "bad" && "text-bad",
          tone === "good" && "text-good",
          tone === "warn" && "text-warn",
          tone === "plain" && "text-ink",
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[11px] leading-tight text-faint">{note}</p>
    </div>
  );
}

/** The empty state for the Property tab — it has to say what the thing is for,
 *  because everything else on this surface fills itself in and this one does
 *  not: an address is the one fact no bank can supply. */
export function NoProperties() {
  return (
    <div className="flex flex-col items-center justify-center rounded-tile bg-inset px-6 py-10 text-center">
      <span className="mb-3 grid size-10 place-items-center rounded-full bg-card text-faint shadow-card">
        <Building2 className="size-4.5" strokeWidth={1.8} />
      </span>
      <p className="text-sm font-medium text-ink">No properties yet</p>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">
        Add the address and the app takes it from there — the value and market
        rent refresh themselves each month, the mortgage attaches to its account,
        and the owner statements are read out of your email.
      </p>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-faint">
        <TrendingUp className="size-3.5" strokeWidth={1.8} />
        Adding one also creates a project for its tasks, docs and journal
      </p>
    </div>
  );
}
