import { moneyLabel, signedMoneyLabel } from "@/lib/money";
import { washingtonEstimate, type WashingtonEstimate } from "@/lib/tax/washington";
import { niit, type NiitResult } from "@/lib/tax/niit";
import { applyPassiveLimits, type PassiveResult } from "@/lib/tax/passive";
import { qbiDeduction, type QbiResult } from "@/lib/tax/qbi";
import {
  type FederalRules,
  type FilingStatusKey,
  type WashingtonRules,
  taxOnOrdinary,
  taxOnPreferential,
} from "@/lib/tax/rules";
import { selfEmploymentTax, type SelfEmploymentTax } from "@/lib/tax/se-tax";

/**
 * The estimate, assembled in the order statute requires.
 *
 * **The ordering is the design.** Two steps look circular and are not, and the
 * obvious fix for either — iterate to a fixed point — would produce a different
 * and wrong answer:
 *
 * - **§469's phase-out tests a MAGI computed *without* the passive loss.** So
 *   the allowance is settled before AGI is final, not alongside it.
 * - **§199A's limitation is measured against taxable income *before* the QBI
 *   deduction.** So it runs after the standard-or-itemized decision and before
 *   the final taxable figure.
 *
 * Self-employment tax comes before AGI for the same family of reason: half of it
 * is an above-the-line deduction, so AGI depends on it and it does not depend on
 * AGI.
 *
 * **Every step returns `null` rather than a default when a rule figure is
 * unconfirmed**, and a `null` anywhere makes the whole estimate `null`. See
 * `lib/tax/rules.ts`: a tax number that is 4% wrong looks exactly like one that
 * is right.
 */

export type EstimateLine = {
  key: string;
  label: string;
  cents: number;
  label_?: never;
  /** A sentence, where the figure needs one. Never a form-line number. */
  note?: string;
};

export type TaxEstimate = {
  taxYear: number;
  filingStatus: FilingStatusKey;

  grossIncomeCents: number;
  incomeLines: EstimateLine[];

  se: SelfEmploymentTax;
  passive: PassiveResult;

  aboveTheLineCents: number;
  agiCents: number;
  /** The MAGI the §469 phase-out was tested against — without the passive loss. */
  magiForPalCents: number;

  deductionCents: number;
  usedItemized: boolean;
  itemizedCents: number;
  standardCents: number;

  taxableIncomeBeforeQbiCents: number;
  qbi: QbiResult;
  taxableIncomeCents: number;

  ordinaryTaxCents: number;
  preferentialTaxCents: number;
  federalBeforeCreditsCents: number;

  niit: NiitResult;
  federalTotalCents: number;

  state: WashingtonEstimate | null;

  withheldCents: number;
  estimatedPaidCents: number;
  /** Positive means owed, negative means a refund. */
  balanceCents: number;

  totalTaxCents: number;
  effectiveRate: number;

  /** Everything the engine deliberately does not model, for this return. */
  unmodelled: string[];
};

export type EstimateInput = {
  taxYear: number;
  filingStatus: FilingStatusKey;
  dependents: number;

  w2WagesCents: number;
  selfEmploymentNetCents: number;
  interestIncomeCents: number;
  ordinaryDividendsCents: number;
  qualifiedDividendsCents: number;
  shortTermGainCents: number;
  longTermGainCents: number;

  /** Per property, net Schedule E and whether actively participated in. */
  properties: { netCents: number; activeParticipation: boolean }[];
  passiveCarryforwardCents: number;
  /** Of the long-term gain, how much came from selling real estate.
   *  Washington exempts it outright, so it has to be told apart. */
  realEstateGainCents: number;

  hsaContributionCents: number;
  traditionalRetirementCents: number;
  studentLoanInterestCents: number;

  charitableCents: number;
  primaryMortgageInterestCents: number;
  primaryPropertyTaxCents: number;
  stateIncomeTaxPaidCents: number;
  /** Sales tax paid. In a state with no income tax this is the SALT election
   *  you would actually make — see the note where it is used. */
  salesTaxPaidCents: number;

  federalWithheldCents: number;
  stateWithheldCents: number;
  estimatedPaidCents: number;

  reSafeHarbourHours: number | null;
  realEstateProfessional: boolean;

  federal: FederalRules;
  state: WashingtonRules | null;
};

export function estimate(input: EstimateInput): TaxEstimate | null {
  const { federal } = input;

  // ── 1. Gross income ───────────────────────────────────────────────────────
  const incomeLines: EstimateLine[] = [
    { key: "wages", label: "Salary", cents: input.w2WagesCents },
    { key: "se", label: "Self-employment", cents: input.selfEmploymentNetCents },
    { key: "interest", label: "Interest", cents: input.interestIncomeCents },
    { key: "dividends", label: "Dividends", cents: input.ordinaryDividendsCents },
    { key: "shortTerm", label: "Short-term gains", cents: input.shortTermGainCents },
    { key: "longTerm", label: "Long-term gains", cents: input.longTermGainCents },
  ].filter((line) => line.cents !== 0);

  const grossBeforeRentals = incomeLines.reduce(
    (sum, line) => sum + line.cents,
    0,
  );

  // ── 2–3. Schedule E and depreciation happen upstream, in `scheduleEFor`. ──

  // ── 4. Self-employment tax, before AGI ────────────────────────────────────
  const se = selfEmploymentTax({
    netProfitCents: input.selfEmploymentNetCents,
    w2WagesCents: input.w2WagesCents,
    filingStatus: input.filingStatus,
    rules: federal,
  });
  if (!se) return null;

  const aboveTheLineCents =
    se.deductibleHalfCents +
    input.hsaContributionCents +
    input.traditionalRetirementCents +
    input.studentLoanInterestCents;

  // ── 5–6. §469, tested against a MAGI that excludes the passive loss ───────
  const magiForPalCents = grossBeforeRentals - aboveTheLineCents;

  const passive = applyPassiveLimits({
    properties: input.properties,
    magiCents: magiForPalCents,
    filingStatus: input.filingStatus,
    carryforwardCents: input.passiveCarryforwardCents,
    rules: federal,
  });
  if (!passive) return null;

  const agiCents = magiForPalCents + passive.allowedCents;

  // ── 7. Standard or itemized ───────────────────────────────────────────────
  const standardCents = federal.standardDeduction[input.filingStatus];
  if (standardCents === null) return null;

  // **State and local tax is income *or* sales, never both, plus property.**
  // That election barely matters in a state with an income tax, where income tax
  // always wins. In Washington it is the whole of the deduction: state income
  // tax is zero by construction, so sales tax is what goes on Schedule A, and
  // treating it as zero would understate the itemized total by thousands.
  const electedCents = Math.max(
    input.stateIncomeTaxPaidCents,
    input.salesTaxPaidCents,
  );
  const saltPaid = input.primaryPropertyTaxCents + electedCents;
  const saltCents =
    federal.saltCapCents === null
      ? null
      : Math.min(saltPaid, federal.saltCapCents);
  if (saltCents === null) return null;

  const itemizedCents =
    saltCents + input.primaryMortgageInterestCents + input.charitableCents;

  const usedItemized = itemizedCents > standardCents;
  const deductionCents = usedItemized ? itemizedCents : standardCents;

  // ── 8. §199A, against taxable income *before* the deduction ───────────────
  const taxableIncomeBeforeQbiCents = Math.max(0, agiCents - deductionCents);

  const netCapitalGainCents = Math.max(
    0,
    input.longTermGainCents + input.qualifiedDividendsCents,
  );

  // Only rental profit is treated as qualified, and only when it is profit. A
  // loss produces no deduction and is not carried here — that is `qbi_loss` in
  // `TaxCarryforward`, which Layer 7 writes.
  const rentalProfit = Math.max(0, passive.allowedCents);

  const qbi = qbiDeduction({
    qualifiedIncomeCents: rentalProfit,
    taxableIncomeBeforeQbiCents,
    netCapitalGainCents,
    filingStatus: input.filingStatus,
    reSafeHarbourHours: input.reSafeHarbourHours,
    rules: federal,
  });
  if (!qbi) return null;

  const taxableIncomeCents = Math.max(
    0,
    taxableIncomeBeforeQbiCents - qbi.deductionCents,
  );

  // ── 9. Ordinary brackets, then preferential rates stacked on top ──────────
  const ordinaryPortion = Math.max(0, taxableIncomeCents - netCapitalGainCents);

  const ordinaryTaxCents = taxOnOrdinary(
    ordinaryPortion,
    federal.brackets[input.filingStatus],
  );
  if (ordinaryTaxCents === null) return null;

  const preferentialTaxCents = taxOnPreferential(
    Math.min(netCapitalGainCents, taxableIncomeCents),
    ordinaryPortion,
    federal.ltcgBrackets[input.filingStatus],
  );
  if (preferentialTaxCents === null) return null;

  const federalBeforeCreditsCents = ordinaryTaxCents + preferentialTaxCents;

  // ── 10. NIIT ──────────────────────────────────────────────────────────────
  // Rental income is investment income unless the taxpayer is a real-estate
  // professional for whom it is non-passive — a determination only a person can
  // make, so it is read rather than inferred.
  const rentalInvestmentIncome = input.realEstateProfessional
    ? 0
    : Math.max(0, passive.allowedCents);

  const niitResult = niit({
    netInvestmentIncomeCents:
      input.interestIncomeCents +
      input.ordinaryDividendsCents +
      input.shortTermGainCents +
      input.longTermGainCents +
      rentalInvestmentIncome,
    magiCents: agiCents,
    filingStatus: input.filingStatus,
    rules: federal,
  });
  if (!niitResult) return null;

  const federalTotalCents =
    federalBeforeCreditsCents + se.totalCents + niitResult.taxCents;

  // ── 11. The state ─────────────────────────────────────────────────────────
  // Washington has no personal income tax, so nothing above this line has a
  // state counterpart — no state brackets, no separate depreciation basis, no
  // state passive-loss bookkeeping. What it does have is a tax on long-term
  // capital gains, and **real estate is exempt from it**, which is why the
  // rental's gain is passed separately rather than being inferred.
  const state = input.state
    ? washingtonEstimate({
        longTermGainCents: input.longTermGainCents,
        realEstateGainCents: input.realEstateGainCents,
        charitableCents: input.charitableCents,
        rules: input.state,
      })
    : null;

  // A state rule set that exists but cannot be computed is a failure, not a
  // reason to quietly report federal-only.
  if (input.state && !state) return null;

  // ── 12. Payments ──────────────────────────────────────────────────────────
  const withheldCents = input.federalWithheldCents + input.stateWithheldCents;
  const totalTaxCents = federalTotalCents + (state?.totalCents ?? 0);
  const balanceCents =
    totalTaxCents - withheldCents - input.estimatedPaidCents;

  const grossIncomeCents = grossBeforeRentals + passive.netCents;

  const unmodelled: string[] = [
    ...(qbi.unmodelled ? [qbi.unmodelled] : []),
    ...(state?.notes ?? []),
  ];

  return {
    taxYear: input.taxYear,
    filingStatus: input.filingStatus,

    grossIncomeCents,
    incomeLines,

    se,
    passive,

    aboveTheLineCents,
    agiCents,
    magiForPalCents,

    deductionCents,
    usedItemized,
    itemizedCents,
    standardCents,

    taxableIncomeBeforeQbiCents,
    qbi,
    taxableIncomeCents,

    ordinaryTaxCents,
    preferentialTaxCents,
    federalBeforeCreditsCents,

    niit: niitResult,
    federalTotalCents,

    state,

    withheldCents,
    estimatedPaidCents: input.estimatedPaidCents,
    balanceCents,

    totalTaxCents,
    effectiveRate:
      grossIncomeCents > 0 ? totalTaxCents / grossIncomeCents : 0,

    unmodelled,
  };
}

/** Preformatted for the tab — every figure leaves the server as a string. */
export function estimateLabels(result: TaxEstimate) {
  return {
    totalTaxLabel: moneyLabel(result.totalTaxCents),
    federalLabel: moneyLabel(result.federalTotalCents),
    stateLabel: moneyLabel(result.state?.totalCents ?? 0),
    agiLabel: moneyLabel(result.agiCents),
    taxableLabel: moneyLabel(result.taxableIncomeCents),
    deductionLabel: moneyLabel(result.deductionCents),
    seLabel: moneyLabel(result.se.totalCents),
    niitLabel: moneyLabel(result.niit.taxCents),
    qbiLabel: moneyLabel(result.qbi.deductionCents),
    withheldLabel: moneyLabel(result.withheldCents + result.estimatedPaidCents),
    balanceLabel: signedMoneyLabel(-result.balanceCents),
    effectiveRateLabel: `${(result.effectiveRate * 100).toFixed(1)}%`,
    passiveAllowedLabel: signedMoneyLabel(result.passive.allowedCents),
    passiveSuspendedLabel: moneyLabel(result.passive.suspendedCents),
  };
}
