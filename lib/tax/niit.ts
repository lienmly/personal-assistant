import { applyRate } from "@/lib/money";
import type { FederalRules, FilingStatusKey } from "@/lib/tax/rules";

/**
 * The Net Investment Income Tax — 3.8% of the **lesser** of two figures.
 *
 * The lesser-of rule is the whole of it and it is easy to get backwards:
 * the charge is on the smaller of net investment income and the amount by which
 * MAGI exceeds the threshold. So somebody just over the threshold with a large
 * portfolio pays on the small overage, not on the portfolio.
 *
 * The thresholds are **not inflation adjusted** — they have been the same since
 * 2013 — which is worth knowing when confirming them, because the annual Revenue
 * Procedure will not mention them and their absence is not evidence they
 * changed.
 *
 * **Rental income counts as net investment income** unless the taxpayer is a
 * real-estate professional for whom the activity is non-passive. That is a
 * determination only a person can make, so it is `TaxProfile.realEstateProfessional`
 * and the engine reads it rather than inferring it.
 */

export type NiitResult = {
  netInvestmentIncomeCents: number;
  overThresholdCents: number;
  /** The smaller of the two — what the rate is actually applied to. */
  baseCents: number;
  taxCents: number;
};

export function niit(input: {
  netInvestmentIncomeCents: number;
  magiCents: number;
  filingStatus: FilingStatusKey;
  rules: FederalRules;
}): NiitResult | null {
  const threshold = input.rules.niit.threshold[input.filingStatus];
  if (input.rules.niit.rate === null || threshold === null) return null;

  const investment = Math.max(0, input.netInvestmentIncomeCents);
  const overThresholdCents = Math.max(0, input.magiCents - threshold);
  const baseCents = Math.min(investment, overThresholdCents);

  return {
    netInvestmentIncomeCents: investment,
    overThresholdCents,
    baseCents,
    taxCents: applyRate(baseCents, input.rules.niit.rate),
  };
}
