import { applyRate } from "@/lib/money";
import type { WashingtonRules } from "@/lib/tax/rules";

/**
 * Washington's state tax, which is almost nothing and not quite nothing.
 *
 * **There is no personal income tax**, so a salary, self-employment profit,
 * interest, dividends and — this is the one that matters here — **rental income
 * are all untaxed by the state.** That removes at a stroke everything
 * California's module existed to model: no state brackets, no separate
 * depreciation basis, no state passive-loss bookkeeping, no exemption credits.
 *
 * What remains is a **7% tax on long-term capital gains** above a standard
 * deduction. It is easy to forget precisely because the state is famous for
 * having no income tax, and it only appears in a year with a large stock sale.
 *
 * **Real estate is exempt outright**, which is worth stating plainly: selling
 * the rental does not trigger this, however large the gain. So does anything
 * held in a retirement account. Both of those are the assumptions most likely to
 * be got wrong in the one year they matter.
 */

export type WashingtonEstimate = {
  /** Long-term gain the state can reach — after removing what it cannot. */
  taxableGainCents: number;
  /** What was excluded, and why, so the zero is explicable. */
  exclusions: { label: string; cents: number }[];
  standardDeductionCents: number;
  charitableDeductionCents: number;
  capitalGainsTaxCents: number;
  totalCents: number;
  /** Said on the tab, because "no state tax" is a claim worth showing working
   *  for rather than asserting. */
  notes: string[];
};

export function washingtonEstimate(input: {
  /** Federal long-term capital gain, from securities and anything else. */
  longTermGainCents: number;
  /** The part of that gain that came from real estate — exempt outright. */
  realEstateGainCents: number;
  /** Charitable giving, which has its own deduction against this tax. */
  charitableCents: number;
  rules: WashingtonRules;
}): WashingtonEstimate | null {
  const { rules } = input;

  const notes: string[] = [
    "Washington has no personal income tax, so salary, self-employment, interest, dividends and rental income are not taxed by the state.",
  ];

  const exclusions: { label: string; cents: number }[] = [];

  if (!rules.hasCapitalGainsTax) {
    return {
      taxableGainCents: 0,
      exclusions,
      standardDeductionCents: 0,
      charitableDeductionCents: 0,
      capitalGainsTaxCents: 0,
      totalCents: 0,
      notes,
    };
  }

  // Real estate is exempt outright — including the rental, however large the
  // gain. This is the exemption most likely to be assumed the wrong way round.
  const realEstate = Math.max(0, input.realEstateGainCents);
  if (realEstate > 0) {
    exclusions.push({ label: "Gain from real estate, which is exempt", cents: realEstate });
  }

  const reachable = Math.max(0, input.longTermGainCents - realEstate);

  if (reachable === 0) {
    notes.push(
      "There is no long-term gain from securities this year, so the capital gains tax does not apply.",
    );
    return {
      taxableGainCents: 0,
      exclusions,
      standardDeductionCents: 0,
      charitableDeductionCents: 0,
      capitalGainsTaxCents: 0,
      totalCents: 0,
      notes,
    };
  }

  const { rate, standardDeductionCents, charitableFloorCents, charitableCapCents } =
    rules.capitalGains;

  // The rule every module here follows: an unconfirmed constant computes
  // nothing rather than something smaller.
  if (rate === null || standardDeductionCents === null) return null;

  let charitableDeductionCents = 0;
  if (charitableFloorCents !== null && charitableCapCents !== null) {
    const over = Math.max(0, input.charitableCents - charitableFloorCents);
    charitableDeductionCents = Math.min(over, charitableCapCents);
  } else if (charitableFloorCents !== null || charitableCapCents !== null) {
    // One half confirmed and not the other is an incomplete rule set, not a
    // reason to skip the deduction.
    return null;
  }

  const taxableGainCents = Math.max(
    0,
    reachable - standardDeductionCents - charitableDeductionCents,
  );

  const capitalGainsTaxCents = applyRate(taxableGainCents, rate);

  if (capitalGainsTaxCents === 0 && reachable > 0) {
    notes.push(
      "The long-term gain is below Washington's standard deduction for the capital gains tax, so none is due.",
    );
  }

  return {
    taxableGainCents,
    exclusions,
    standardDeductionCents,
    charitableDeductionCents,
    capitalGainsTaxCents,
    totalCents: capitalGainsTaxCents,
    notes,
  };
}
