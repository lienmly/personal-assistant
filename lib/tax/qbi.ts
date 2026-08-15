import { applyRate } from "@/lib/money";
import type { FederalRules, FilingStatusKey } from "@/lib/tax/rules";

/**
 * §199A — the qualified business income deduction.
 *
 * ## The second apparent circularity, and why there is not one either
 *
 * The deduction is capped at a share of **taxable income**, and taxable income
 * is reduced by the deduction. Statute resolves it: the limitation is measured
 * against taxable income **before** the QBI deduction, minus net capital gain.
 * So this runs after the standard-or-itemized decision and before the final
 * taxable-income figure, and there is no loop. Same shape as §469's MAGI test.
 *
 * ## Whether a rental qualifies at all is a judgement, not a computation
 *
 * QBI needs a §162 trade or business. A single rental may or may not be one, and
 * the answer turns on how regularly and continuously it is operated — which no
 * amount of transaction data settles.
 *
 * Rev. Proc. 2019-38 offers a **safe harbour**: 250 hours of rental services,
 * separate books and records, and contemporaneous logs. This function therefore
 * returns a **checklist result, never a computed yes**. It reports whether the
 * safe harbour *appears* met and says who decides. Asserting that a rental
 * qualifies would be the app making a tax position on your behalf, which is the
 * one thing §6 has refused at every layer.
 */

export type QbiSafeHarbour = {
  hoursRecorded: number | null;
  hoursMet: boolean | null;
  /** Null where the app cannot know — separate books, contemporaneous records. */
  separateBooks: null;
  summary: string;
};

export type QbiResult = {
  qualifiedIncomeCents: number;
  /** 20% of qualified income, before the taxable-income limitation. */
  tentativeCents: number;
  /** The taxable-income cap that actually applied, if it bit. */
  limitCents: number;
  deductionCents: number;
  /** True when income is over the threshold and the W-2/UBIA limits apply —
   *  which this engine does not compute. See `unmodelled`. */
  aboveThreshold: boolean;
  unmodelled: string | null;
  safeHarbour: QbiSafeHarbour;
};

const HOURS_SAFE_HARBOUR = 250;

export function qbiDeduction(input: {
  /** Net rental income treated as qualified. Zero or negative means none. */
  qualifiedIncomeCents: number;
  /** **Before** the QBI deduction. */
  taxableIncomeBeforeQbiCents: number;
  netCapitalGainCents: number;
  filingStatus: FilingStatusKey;
  reSafeHarbourHours: number | null;
  rules: FederalRules;
}): QbiResult | null {
  const { qbi } = input.rules;
  const threshold = qbi.thresholdCents[input.filingStatus];

  if (qbi.rate === null || threshold === null) return null;

  const safeHarbour: QbiSafeHarbour = {
    hoursRecorded: input.reSafeHarbourHours,
    hoursMet:
      input.reSafeHarbourHours === null
        ? null
        : input.reSafeHarbourHours >= HOURS_SAFE_HARBOUR,
    separateBooks: null,
    summary:
      input.reSafeHarbourHours === null
        ? `The Rev. Proc. 2019-38 safe harbour needs ${HOURS_SAFE_HARBOUR} hours of rental services, separate books, and contemporaneous records. No hours have been recorded, so whether it is met is unknown.`
        : input.reSafeHarbourHours >= HOURS_SAFE_HARBOUR
          ? `${input.reSafeHarbourHours} hours recorded, which clears the ${HOURS_SAFE_HARBOUR}-hour test. Separate books and contemporaneous records are the other two conditions, and only you can confirm them.`
          : `${input.reSafeHarbourHours} hours recorded, short of the ${HOURS_SAFE_HARBOUR}-hour test. Whether the rental is a trade or business without the safe harbour is a judgement for your accountant.`,
  };

  const qualified = Math.max(0, input.qualifiedIncomeCents);
  if (qualified === 0) {
    return {
      qualifiedIncomeCents: 0,
      tentativeCents: 0,
      limitCents: 0,
      deductionCents: 0,
      aboveThreshold: false,
      unmodelled: null,
      safeHarbour,
    };
  }

  const tentativeCents = applyRate(qualified, qbi.rate);

  // The limitation: a share of taxable income *less* net capital gain, because
  // gains are already taxed at preferential rates and are not meant to enlarge
  // this deduction.
  const limitBase = Math.max(
    0,
    input.taxableIncomeBeforeQbiCents - Math.max(0, input.netCapitalGainCents),
  );
  const limitCents = applyRate(limitBase, qbi.rate);

  const aboveThreshold = input.taxableIncomeBeforeQbiCents > threshold;

  return {
    qualifiedIncomeCents: qualified,
    tentativeCents,
    limitCents,
    deductionCents: Math.min(tentativeCents, limitCents),
    aboveThreshold,
    // Stated rather than silently approximated. Above the threshold the
    // deduction is additionally limited by W-2 wages paid and the unadjusted
    // basis of qualified property, and a rental with no employees frequently has
    // neither — so the real deduction can be far smaller than this, or nil.
    unmodelled: aboveThreshold
      ? "Taxable income is above the §199A threshold, where the deduction is further limited by W-2 wages paid and the basis of qualified property. Those limits are not modelled here, so this figure is an upper bound."
      : null,
    safeHarbour,
  };
}
