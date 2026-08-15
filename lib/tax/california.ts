import { applyRate } from "@/lib/money";
import {
  type CaliforniaRules,
  type FilingStatusKey,
  taxOnOrdinary,
} from "@/lib/tax/rules";

/**
 * California, which is a different tax rather than a percentage of the federal
 * one.
 *
 * Four differences the engine actually models, and they all pull the same way —
 * **California taxable income is usually higher than federal**:
 *
 * 1. **No QBI deduction at all.** Whatever §199A gave back federally is added
 *    straight back on.
 * 2. **No bonus depreciation and a far smaller §179 cap**, so the depreciation
 *    taken federally is often larger than California allows — and the
 *    *difference* is an addition. This is why `DepreciableAsset` carries a
 *    second method rather than one.
 * 3. **Long-term gains are ordinary income.** There is no preferential rate.
 * 4. **Exemption credits, not exemptions.** They come off the tax rather than
 *    off income, which is why they cannot be folded into the deduction.
 *
 * Plus the Mental Health Services Act surcharge above $1m.
 *
 * **What is deliberately not modelled** is California's separate passive-loss
 * bookkeeping. CA tracks suspended losses on its own basis — different
 * depreciation means a different loss — and reproducing that properly means a
 * parallel §469 calculation with its own carryforward table. The engine says so
 * rather than quietly using the federal figure, which would be wrong in a
 * direction nobody could see.
 */

export type CaliforniaEstimate = {
  adjustedAgiCents: number;
  additions: { label: string; cents: number }[];
  deductionCents: number;
  taxableIncomeCents: number;
  taxCents: number;
  exemptionCreditCents: number;
  surchargeCents: number;
  totalCents: number;
  unmodelled: string[];
};

export function californiaEstimate(input: {
  federalAgiCents: number;
  /** Added back — California has no §199A. */
  qbiDeductionCents: number;
  /** Federal depreciation minus what California allows, where they differ. */
  depreciationDifferenceCents: number;
  /** Federal long-term gain, which California taxes as ordinary income. It is
   *  already inside AGI, so this is only used to explain the difference. */
  longTermGainCents: number;
  filingStatus: FilingStatusKey;
  dependents: number;
  itemizedCents: number;
  rules: CaliforniaRules;
}): CaliforniaEstimate | null {
  const { rules } = input;

  const standard = rules.standardDeduction[input.filingStatus];
  const exemption = rules.exemptionCreditCents[input.filingStatus];
  if (standard === null || exemption === null) return null;

  const additions: { label: string; cents: number }[] = [];

  if (!rules.hasQbi && input.qbiDeductionCents > 0) {
    additions.push({
      label: "No QBI deduction in California",
      cents: input.qbiDeductionCents,
    });
  }
  if (input.depreciationDifferenceCents > 0) {
    additions.push({
      label: "Depreciation California does not allow",
      cents: input.depreciationDifferenceCents,
    });
  }

  const adjustedAgiCents =
    input.federalAgiCents +
    additions.reduce((sum, addition) => sum + addition.cents, 0);

  // California itemized deductions differ from federal — most obviously it has
  // no SALT cap — but reproducing Schedule CA properly is a form of its own, so
  // the larger of the two is used and the difference is declared.
  const deductionCents = Math.max(standard, input.itemizedCents);
  const taxableIncomeCents = Math.max(0, adjustedAgiCents - deductionCents);

  const bracketTax = taxOnOrdinary(
    taxableIncomeCents,
    rules.brackets[input.filingStatus],
  );
  if (bracketTax === null) return null;

  const dependentCredit = rules.dependentExemptionCreditCents ?? 0;
  const exemptionCreditCents = exemption + dependentCredit * input.dependents;

  let surchargeCents = 0;
  const { rate, thresholdCents } = rules.mentalHealthSurcharge;
  if (rate !== null && thresholdCents !== null) {
    surchargeCents = applyRate(
      Math.max(0, taxableIncomeCents - thresholdCents),
      rate,
    );
  } else if (rate !== null || thresholdCents !== null) {
    return null;
  }

  const unmodelled: string[] = [
    "California tracks suspended passive losses on its own basis, because its depreciation differs — that separate bookkeeping is not reproduced here.",
  ];
  if (input.itemizedCents > standard) {
    unmodelled.push(
      "California itemized deductions are not identical to federal ones — it has no SALT cap, for instance — so the federal figure is used here and the real deduction is likely larger.",
    );
  }
  if (input.longTermGainCents > 0) {
    unmodelled.push(
      "California taxes long-term gains as ordinary income, which is why its bill can be higher than the federal rate suggests.",
    );
  }

  const totalCents = Math.max(0, bracketTax - exemptionCreditCents) + surchargeCents;

  return {
    adjustedAgiCents,
    additions,
    deductionCents,
    taxableIncomeCents,
    taxCents: bracketTax,
    exemptionCreditCents,
    surchargeCents,
    totalCents,
    unmodelled,
  };
}
