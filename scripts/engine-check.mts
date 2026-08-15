/**
 * Golden cases for the tax estimate pipeline.
 *
 *   npx tsx scripts/engine-check.mts
 *
 * **Every rate below is invented**, and named as such. The real ones live in
 * `TaxRuleSet` rows and ship `null` (see `lib/tax/rules.ts`) — so what is tested
 * here is the *arithmetic and the ordering*, which are defined by statute, and
 * never the constants, which are not.
 *
 * The two cases that matter most are the ones that look circular and are not:
 * §469's phase-out is tested against a MAGI computed **without** the passive
 * loss, and §199A's limit is measured against taxable income **before** the QBI
 * deduction. Both are asserted directly, because the obvious "fix" — iterating
 * to a fixed point — produces a different and wrong answer that nothing else
 * would catch.
 */

import { estimate, type EstimateInput } from "../lib/tax/engine";
import { niit } from "../lib/tax/niit";
import { applyPassiveLimits } from "../lib/tax/passive";
import { qbiDeduction } from "../lib/tax/qbi";
import type { FederalRules, WashingtonRules } from "../lib/tax/rules";
import { selfEmploymentTax } from "../lib/tax/se-tax";

let failed = 0;
let passed = 0;

function eq(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failed += 1;
    console.log(`  FAIL  ${label}\n        got  ${a}\n        want ${e}`);
  } else {
    passed += 1;
  }
}

function near(label: string, actual: number, expected: number, tol = 2) {
  if (Math.abs(actual - expected) > tol) {
    failed += 1;
    console.log(`  FAIL  ${label}\n        got  ${actual}\n        want ~${expected}`);
  } else {
    passed += 1;
  }
}

function ok(label: string, cond: boolean, detail = "") {
  if (!cond) {
    failed += 1;
    console.log(`  FAIL  ${label} ${detail}`);
  } else {
    passed += 1;
  }
}

function section(name: string) {
  console.log(`\n${name}`);
}

const byStatus = <T,>(value: T) => ({
  single: value,
  mfj: value,
  mfs: value,
  hoh: value,
  qw: value,
});

/** INVENTED RATES. Round numbers so the expected values are checkable by hand. */
const FEDERAL: FederalRules = {
  taxYear: 2026,
  jurisdiction: "federal",
  brackets: byStatus([
    { upToCents: 5_000_000, rate: 0.1 },
    { upToCents: 20_000_000, rate: 0.2 },
    { upToCents: null, rate: 0.3 },
  ]),
  standardDeduction: byStatus(3_000_000),
  additionalStandardDeduction: { age65: 0, blind: 0 },
  ltcgBrackets: byStatus([
    { upToCents: 10_000_000, rate: 0 },
    { upToCents: null, rate: 0.15 },
  ]),
  seTax: {
    oasdiRate: 0.124,
    medicareRate: 0.029,
    wageBaseCents: 16_000_000,
    additionalMedicareRate: 0.009,
    additionalMedicareThreshold: byStatus(20_000_000),
    netEarningsFactor: 0.9235,
  },
  niit: { rate: 0.038, threshold: byStatus(20_000_000) },
  pal469: {
    specialAllowanceCents: 2_500_000,
    phaseoutStartMagiCents: byStatus(10_000_000),
    phaseoutRate: 0.5,
  },
  qbi: {
    rate: 0.2,
    thresholdCents: byStatus(19_000_000),
    phaseInRangeCents: byStatus(5_000_000),
    wageLimitRate: 0.5,
    wageUbiaRate: 0.25,
    ubiaRate: 0.025,
  },
  saltCapCents: 1_000_000,
  deMinimisSafeHarbourCents: 250_000,
  standardMileageCents: 67,
  section179LimitCents: 100_000_000,
  section179PhaseoutCents: 300_000_000,
  bonusDepreciationRate: 0.4,
  estimatedSafeHarbour: {
    currentYearRate: 0.9,
    priorYearRate: 1.0,
    priorYearHighAgiRate: 1.1,
    highAgiThresholdCents: 15_000_000,
  },
};

/** INVENTED. Washington has no income tax; what it has is a capital gains tax. */
const WASHINGTON: WashingtonRules = {
  taxYear: 2026,
  jurisdiction: "wa",
  hasIncomeTax: false,
  hasCapitalGainsTax: true,
  capitalGains: {
    rate: 0.07,
    standardDeductionCents: 27_000_000,
    charitableFloorCents: 2_700_000,
    charitableCapCents: 10_000_000,
  },
};

section("self-employment tax");
{
  const result = selfEmploymentTax({
    netProfitCents: 10_000_000,
    w2WagesCents: 0,
    filingStatus: "single",
    rules: FEDERAL,
  })!;
  near("net earnings are 92.35% of profit", result.netEarningsCents, 9_235_000);
  near("OASDI", result.oasdiCents, Math.round(9_235_000 * 0.124));
  near("Medicare", result.medicareCents, Math.round(9_235_000 * 0.029));
  eq("no additional Medicare below the threshold", result.additionalMedicareCents, 0);
  near(
    "half of it is deductible",
    result.deductibleHalfCents,
    Math.round((result.oasdiCents + result.medicareCents) / 2),
  );
}
{
  // The step people miss: wages consume the OASDI wage base first. With
  // $150,000 of salary against a $160,000 base, only $10,000 of room is left.
  const result = selfEmploymentTax({
    netProfitCents: 10_000_000,
    w2WagesCents: 15_000_000,
    filingStatus: "single",
    rules: FEDERAL,
  })!;
  near("wages eat the wage base first", result.oasdiCents, Math.round(1_000_000 * 0.124));
  ok(
    "so OASDI is far smaller than on the same profit alone",
    result.oasdiCents < Math.round(9_235_000 * 0.124) / 5,
  );
  near("Medicare is unaffected — no ceiling", result.medicareCents, Math.round(9_235_000 * 0.029));
}
{
  const missing: FederalRules = {
    ...FEDERAL,
    seTax: { ...FEDERAL.seTax, wageBaseCents: null },
  };
  eq(
    "an unconfirmed wage base computes nothing",
    selfEmploymentTax({
      netProfitCents: 10_000_000,
      w2WagesCents: 0,
      filingStatus: "single",
      rules: missing,
    }),
    null,
  );
}

section("§469 — the phase-out, and the loss that survives it");
{
  // MAGI $80,000, below the $100,000 phase-out start: the whole allowance.
  const result = applyPassiveLimits({
    properties: [{ netCents: -1_500_000, activeParticipation: true }],
    magiCents: 8_000_000,
    filingStatus: "single",
    carryforwardCents: 0,
    rules: FEDERAL,
  })!;
  eq("the whole loss is allowed", result.allowedCents, -1_500_000);
  eq("nothing suspends", result.suspendedCents, 0);
}
{
  // MAGI $130,000 — $30,000 over, so the allowance halves to $10,000.
  const result = applyPassiveLimits({
    properties: [{ netCents: -2_000_000, activeParticipation: true }],
    magiCents: 13_000_000,
    filingStatus: "single",
    carryforwardCents: 0,
    rules: FEDERAL,
  })!;
  eq("the allowance is reduced 50c per dollar", result.allowanceCents, 1_000_000);
  eq("only that much is allowed", result.allowedCents, -1_000_000);
  eq("and the rest suspends rather than vanishing", result.suspendedCents, 1_000_000);
}
{
  // MAGI $150,000 — the allowance is gone entirely.
  const result = applyPassiveLimits({
    properties: [{ netCents: -2_000_000, activeParticipation: true }],
    magiCents: 15_000_000,
    filingStatus: "single",
    carryforwardCents: 0,
    rules: FEDERAL,
  })!;
  eq("no allowance left", result.allowanceCents, 0);
  eq("nothing is deductible", result.allowedCents, 0);
  eq("the whole loss suspends", result.suspendedCents, 2_000_000);
}
{
  const result = applyPassiveLimits({
    properties: [{ netCents: -2_000_000, activeParticipation: false }],
    magiCents: 5_000_000,
    filingStatus: "single",
    carryforwardCents: 0,
    rules: FEDERAL,
  })!;
  eq("without active participation, nothing is allowed", result.allowedCents, 0);
  eq("whatever the income", result.suspendedCents, 2_000_000);
}
{
  // Profit uses up carried-forward losses first.
  const result = applyPassiveLimits({
    properties: [{ netCents: 3_000_000, activeParticipation: true }],
    magiCents: 8_000_000,
    filingStatus: "single",
    carryforwardCents: 1_000_000,
    rules: FEDERAL,
  })!;
  eq("suspended losses offset a profit", result.allowedCents, 2_000_000);
}

section("NIIT — the lesser of two figures");
{
  // $50,000 of investment income but only $10,000 over the threshold.
  const result = niit({
    netInvestmentIncomeCents: 5_000_000,
    magiCents: 21_000_000,
    filingStatus: "single",
    rules: FEDERAL,
  })!;
  eq("the base is the overage, not the portfolio", result.baseCents, 1_000_000);
  near("3.8% of it", result.taxCents, Math.round(1_000_000 * 0.038));
}
{
  const result = niit({
    netInvestmentIncomeCents: 500_000,
    magiCents: 30_000_000,
    filingStatus: "single",
    rules: FEDERAL,
  })!;
  eq("and the other way round", result.baseCents, 500_000);
}
{
  const result = niit({
    netInvestmentIncomeCents: 5_000_000,
    magiCents: 10_000_000,
    filingStatus: "single",
    rules: FEDERAL,
  })!;
  eq("below the threshold there is none", result.taxCents, 0);
}

section("§199A — a checklist, never a computed yes");
{
  const result = qbiDeduction({
    qualifiedIncomeCents: 2_000_000,
    taxableIncomeBeforeQbiCents: 10_000_000,
    netCapitalGainCents: 0,
    filingStatus: "single",
    reSafeHarbourHours: null,
    rules: FEDERAL,
  })!;
  eq("20% of qualified income", result.deductionCents, 400_000);
  eq("the safe harbour is unknown without hours", result.safeHarbour.hoursMet, null);
  eq("and separate books are never inferred", result.safeHarbour.separateBooks, null);
}
{
  const result = qbiDeduction({
    qualifiedIncomeCents: 2_000_000,
    taxableIncomeBeforeQbiCents: 10_000_000,
    netCapitalGainCents: 0,
    filingStatus: "single",
    reSafeHarbourHours: 300,
    rules: FEDERAL,
  })!;
  eq("300 hours clears the hours test", result.safeHarbour.hoursMet, true);
  ok(
    "but the summary still says who decides",
    result.safeHarbour.summary.includes("only you can confirm"),
  );
}
{
  // The limitation biting: taxable income less capital gain is smaller than QBI.
  const result = qbiDeduction({
    qualifiedIncomeCents: 5_000_000,
    taxableIncomeBeforeQbiCents: 6_000_000,
    netCapitalGainCents: 4_000_000,
    filingStatus: "single",
    reSafeHarbourHours: null,
    rules: FEDERAL,
  })!;
  // 20% of (6,000,000 − 4,000,000) = 400,000, below 20% of 5,000,000.
  eq("capped by taxable income less capital gain", result.deductionCents, 400_000);
}
{
  const result = qbiDeduction({
    qualifiedIncomeCents: 2_000_000,
    taxableIncomeBeforeQbiCents: 25_000_000,
    netCapitalGainCents: 0,
    filingStatus: "single",
    reSafeHarbourHours: null,
    rules: FEDERAL,
  })!;
  eq("above the threshold it says so", result.aboveThreshold, true);
  ok(
    "and declares the W-2/UBIA limits are not modelled",
    (result.unmodelled ?? "").includes("upper bound"),
  );
}

section("the pipeline — ordering that looks circular and is not");

const base: EstimateInput = {
  taxYear: 2026,
  filingStatus: "single",
  dependents: 0,
  w2WagesCents: 12_000_000,
  selfEmploymentNetCents: 0,
  interestIncomeCents: 0,
  ordinaryDividendsCents: 0,
  qualifiedDividendsCents: 0,
  shortTermGainCents: 0,
  longTermGainCents: 0,
  properties: [],
  passiveCarryforwardCents: 0,
  realEstateGainCents: 0,
  hsaContributionCents: 0,
  traditionalRetirementCents: 0,
  studentLoanInterestCents: 0,
  charitableCents: 0,
  primaryMortgageInterestCents: 0,
  primaryPropertyTaxCents: 0,
  stateIncomeTaxPaidCents: 0,
  salesTaxPaidCents: 0,
  federalWithheldCents: 0,
  stateWithheldCents: 0,
  estimatedPaidCents: 0,
  reSafeHarbourHours: null,
  realEstateProfessional: false,
  federal: FEDERAL,
  state: null,
};

{
  const result = estimate(base)!;
  eq("AGI with nothing above the line", result.agiCents, 12_000_000);
  eq("standard deduction wins", result.usedItemized, false);
  eq("taxable income", result.taxableIncomeCents, 9_000_000);
  // $50,000 at 10% + $40,000 at 20% = $5,000 + $8,000
  eq("ordinary tax is marginal", result.ordinaryTaxCents, 500_000 + 800_000);
}

{
  // **§469's MAGI excludes the passive loss.** With a $20,000 loss and MAGI of
  // $120,000, the allowance is reduced by half of $20,000 over the start — to
  // $15,000 — so $15,000 is allowed and $5,000 suspends. If the loss were
  // (wrongly) inside the MAGI, MAGI would be $100,000, the allowance would be
  // the full $25,000, and the whole loss would deduct. That is the difference
  // this assertion protects.
  const result = estimate({
    ...base,
    w2WagesCents: 12_000_000,
    properties: [{ netCents: -2_000_000, activeParticipation: true }],
  })!;
  eq("MAGI for the phase-out excludes the loss", result.magiForPalCents, 12_000_000);
  eq("so the allowance is reduced", result.passive.allowanceCents, 1_500_000);
  eq("and part of the loss suspends", result.passive.suspendedCents, 500_000);
  eq("AGI is reduced only by what was allowed", result.agiCents, 10_500_000);
}

{
  // **§199A is limited by taxable income BEFORE the deduction.** Qualified
  // income $30,000 → tentative $6,000. Taxable before QBI is $10,000, so the
  // cap is $2,000. Iterating would shrink taxable income and then the cap, and
  // converge somewhere lower — a different, wrong answer.
  const result = estimate({
    ...base,
    w2WagesCents: 1_000_000,
    properties: [{ netCents: 3_000_000, activeParticipation: true }],
  })!;
  eq("taxable before QBI", result.taxableIncomeBeforeQbiCents, 1_000_000);
  eq("the cap is 20% of that", result.qbi.limitCents, 200_000);
  eq("tentative was larger", result.qbi.tentativeCents, 600_000);
  eq("so the cap applies", result.qbi.deductionCents, 200_000);
  eq("taxable income after", result.taxableIncomeCents, 800_000);
}

{
  // Preferential rates stack. $60,000 ordinary + $80,000 long-term.
  const result = estimate({
    ...base,
    w2WagesCents: 9_000_000,
    longTermGainCents: 8_000_000,
  })!;
  // Taxable = 17,000,000 − 3,000,000 = 14,000,000; gain 8,000,000 sits on top
  // of 6,000,000 of ordinary income. 0% band runs to 10,000,000, so 4,000,000
  // of the gain is free and 4,000,000 is at 15%.
  eq("ordinary portion", result.taxableIncomeCents - 8_000_000, 6_000_000);
  eq("the gain straddles the bands", result.preferentialTaxCents, Math.round(4_000_000 * 0.15));
}

{
  // No income tax, so a salary alone owes the state nothing at all.
  const result = estimate({ ...base, w2WagesCents: 12_000_000, state: WASHINGTON })!;
  ok("Washington is computed", result.state !== null);
  eq("and a salary owes it nothing", result.state!.totalCents, 0);
  eq("so the total is federal only", result.totalTaxCents, result.federalTotalCents);
  ok(
    "it says why rather than just showing zero",
    result.state!.notes.some((note) => note.includes("no personal income tax")),
  );
}

{
  // A large long-term gain from securities: over the $270,000 deduction by
  // $130,000, at 7%.
  const result = estimate({
    ...base,
    w2WagesCents: 12_000_000,
    longTermGainCents: 40_000_000,
    state: WASHINGTON,
  })!;
  eq("the gain above the deduction is taxed", result.state!.taxableGainCents, 13_000_000);
  eq("at 7%", result.state!.capitalGainsTaxCents, Math.round(13_000_000 * 0.07));
  ok("and it reaches the total", result.totalTaxCents > result.federalTotalCents);
}

{
  // **Real estate is exempt outright.** The same gain, from selling the rental,
  // owes Washington nothing — the assumption most likely to be got backwards.
  const result = estimate({
    ...base,
    w2WagesCents: 12_000_000,
    longTermGainCents: 40_000_000,
    realEstateGainCents: 40_000_000,
    state: WASHINGTON,
  })!;
  eq("selling the rental is exempt", result.state!.capitalGainsTaxCents, 0);
  ok(
    "and the exemption is named rather than silent",
    result.state!.exclusions.some((item) => item.label.includes("real estate")),
  );
}

{
  // Below the deduction, nothing is due.
  const result = estimate({
    ...base,
    w2WagesCents: 12_000_000,
    longTermGainCents: 10_000_000,
    state: WASHINGTON,
  })!;
  eq("a small gain owes nothing", result.state!.capitalGainsTaxCents, 0);
}

{
  // **The SALT election.** With no state income tax, sales tax is what goes on
  // Schedule A — and treating it as zero understates the itemized total.
  const withSales = estimate({
    ...base,
    w2WagesCents: 20_000_000,
    salesTaxPaidCents: 300_000,
    primaryPropertyTaxCents: 400_000,
    primaryMortgageInterestCents: 2_500_000,
  })!;
  const withoutSales = estimate({
    ...base,
    w2WagesCents: 20_000_000,
    primaryPropertyTaxCents: 400_000,
    primaryMortgageInterestCents: 2_500_000,
  })!;
  ok(
    "sales tax raises the itemized deduction",
    withSales.itemizedCents > withoutSales.itemizedCents,
    `${withSales.itemizedCents} vs ${withoutSales.itemizedCents}`,
  );
  eq("by exactly the sales tax", withSales.itemizedCents - withoutSales.itemizedCents, 300_000);
}

{
  // Income tax and sales tax are an election, never a sum.
  const result = estimate({
    ...base,
    w2WagesCents: 20_000_000,
    stateIncomeTaxPaidCents: 500_000,
    salesTaxPaidCents: 300_000,
    primaryPropertyTaxCents: 100_000,
  })!;
  // The larger of 500,000 and 300,000, plus 100,000 property — not 900,000.
  eq("the larger is elected, not both added", result.itemizedCents, 600_000);
}

{
  // An unconfirmed figure anywhere makes the whole estimate refuse.
  const broken: FederalRules = { ...FEDERAL, standardDeduction: byStatus(null) };
  eq("one missing constant, no estimate", estimate({ ...base, federal: broken }), null);
}

{
  // A California rule set that exists but cannot compute is a failure, not a
  // quiet fallback to federal-only.
  const brokenState: WashingtonRules = {
    ...WASHINGTON,
    capitalGains: { ...WASHINGTON.capitalGains, rate: null },
  };
  eq(
    "a broken state set refuses rather than reporting federal alone",
    estimate({ ...base, longTermGainCents: 40_000_000, state: brokenState }),
    null,
  );
}

{
  // The SALT cap.
  const result = estimate({
    ...base,
    w2WagesCents: 20_000_000,
    primaryPropertyTaxCents: 1_500_000,
    stateIncomeTaxPaidCents: 2_000_000,
    primaryMortgageInterestCents: 2_500_000,
  })!;
  // SALT of 35,000 capped at 10,000, plus 25,000 of interest = 35,000 itemized.
  eq("SALT is capped", result.itemizedCents, 1_000_000 + 2_500_000);
  eq("and itemizing wins here", result.usedItemized, true);
}

{
  // A real-estate professional's rental income is not investment income.
  const withRental = { ...base, w2WagesCents: 25_000_000, properties: [{ netCents: 2_000_000, activeParticipation: true }] };
  const passive = estimate(withRental)!;
  const professional = estimate({ ...withRental, realEstateProfessional: true })!;
  ok(
    "rental profit is investment income by default",
    passive.niit.netInvestmentIncomeCents > professional.niit.netInvestmentIncomeCents,
  );
  eq(
    "but not for a real-estate professional",
    professional.niit.netInvestmentIncomeCents,
    0,
  );
}

console.log(
  failed === 0 ? `\n${passed} passed.\n` : `\n${passed} passed, ${failed} FAILED.\n`,
);
process.exit(failed === 0 ? 0 : 1);
