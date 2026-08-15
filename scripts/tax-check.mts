/**
 * Golden cases for the tax arithmetic.
 *
 *   npx tsx scripts/tax-check.mts
 *
 * No network and no database — these are pure functions, which is the whole
 * reason `DepreciableAsset` stores no schedule.
 *
 * Everything here is checkable against a published source, and that is the
 * point: the depreciation conventions and the bracket-stacking rule are
 * *arithmetic* defined by statute, so they can live in code. The **rates and
 * thresholds** cannot, and do not — `lib/tax/rulesets/*` ships every numeric
 * leaf `null` (see `lib/tax/rules.ts`). The bracket tables used below are
 * invented for the test and named as such.
 */

import {
  annualDepreciation,
  accumulatedThrough,
  buildingBasisCents,
  midMonthFactor,
} from "../lib/tax/depreciation";
import {
  missingFigures,
  taxOnOrdinary,
  taxOnPreferential,
} from "../lib/tax/rules";
import { federalSkeleton } from "../lib/tax/rulesets/federal";
import { californiaSkeleton } from "../lib/tax/rulesets/california";

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

function near(label: string, actual: number, expected: number, tolerance = 1) {
  if (Math.abs(actual - expected) > tolerance) {
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

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

section("the rule sets ship empty — this is the point, not an omission");
{
  const federal = federalSkeleton(2026);
  const missing = missingFigures(federal);
  ok("federal has figures to confirm", missing.length > 20, `${missing.length}`);
  ok(
    "including the standard deduction",
    missing.some((path) => path.startsWith("standardDeduction")),
  );
  ok(
    "and the SE wage base",
    missing.some((path) => path.includes("wageBaseCents")),
  );
  ok(
    "and the §469 allowance",
    missing.some((path) => path.includes("specialAllowanceCents")),
  );

  const ca = californiaSkeleton(2026);
  const caMissing = missingFigures(ca);
  ok("California too", caMissing.length > 5, `${caMissing.length}`);
  // Booleans are standing facts about non-conformity, not figures to look up.
  ok(
    "but its conformity booleans are not 'missing'",
    !caMissing.some((path) => path.includes("conformsTo")),
  );
  eq("California has no QBI", ca.hasQbi, false);
  eq("and does not conform to bonus", ca.conformsToBonus, false);
}

section("mid-month convention");
// A house available on 2 August and one available on 30 August get the same
// first year: 4.5 months. That is the convention, and it is why
// `placedInServiceOn` is the date it was first RENTABLE, not the purchase date.
eq("January", midMonthFactor(1), 11.5 / 12);
eq("August", midMonthFactor(8), 4.5 / 12);
eq("December", midMonthFactor(12), 0.5 / 12);

section("27.5-year residential, straight line, mid-month");
{
  // $788,000 building basis. A full year is $28,654.55.
  const asset = {
    basisCents: 78_800_000,
    placedInServiceOn: utc(2019, 8, 1),
    method: "sl_27_5_mid_month" as const,
  };

  const full = 78_800_000 / 27.5;
  near("a middle year is the full amount", annualDepreciation(asset, 2021)!, Math.round(full));
  // First year: 4.5/12 of a full year.
  near("the first year is 4.5 months", annualDepreciation(asset, 2019)!, Math.round(full * (4.5 / 12)));
  eq("nothing before it was in service", annualDepreciation(asset, 2018), 0);

  // The tail. Without it the last partial year silently vanishes and the
  // property is never fully depreciated.
  //
  // **August takes 4.5 months in year one, so 27 full years follow and the tail
  // lands in year 28.** Hardcoding the number of full years produced a "final"
  // year *larger* than a full one — which is what this assertion caught.
  const tail = annualDepreciation(asset, 2019 + 28)!;
  ok("there is a final partial year", tail > 0 && tail < Math.round(full), `${tail}`);
  eq("the year before it is still full", annualDepreciation(asset, 2019 + 27), Math.round(full));
  eq("and nothing after it", annualDepreciation(asset, 2019 + 29), 0);

  // The whole basis, and no more.
  const total = accumulatedThrough(asset, 2019 + 29)!;
  near("it depreciates to exactly the basis", total, 78_800_000, 2);
}

{
  // **January is the case that proves the month matters.** 11.5 months in year
  // one leaves 26.5417 years, so only 26 full years follow and the tail is in
  // year 27 — one year earlier than the August property above.
  const january = {
    basisCents: 78_800_000,
    placedInServiceOn: utc(2019, 1, 10),
    method: "sl_27_5_mid_month" as const,
  };
  const full = 78_800_000 / 27.5;

  near("January year one is 11.5 months", annualDepreciation(january, 2019)!, Math.round(full * (11.5 / 12)));
  eq("year 26 is still full", annualDepreciation(january, 2019 + 26), Math.round(full));
  const tail = annualDepreciation(january, 2019 + 27)!;
  ok("the tail is a year earlier than August's", tail > 0 && tail < Math.round(full), `${tail}`);
  eq("and nothing after", annualDepreciation(january, 2019 + 28), 0);
  near("still exactly the basis", accumulatedThrough(january, 2019 + 28)!, 78_800_000, 2);
}

{
  // 39-year non-residential uses the same convention, so it should follow the
  // same shape without a second code path.
  const commercial = {
    basisCents: 39_000_000,
    placedInServiceOn: utc(2020, 6, 1),
    method: "sl_39_mid_month" as const,
  };
  near("a full year is basis/39", annualDepreciation(commercial, 2022)!, Math.round(39_000_000 / 39));
  near("and it totals the basis", accumulatedThrough(commercial, 2020 + 40)!, 39_000_000, 2);
}

section("5-year MACRS, half-year convention");
{
  // An appliance. The published first-year figure is 20.00% and the second is
  // 32.00% — derived here from the declining-balance formula rather than typed
  // in, so there is no table to mistype.
  const asset = {
    basisCents: 500_000,
    placedInServiceOn: utc(2026, 3, 15),
    method: "macrs_5_hy" as const,
  };
  near("year 1 is 20%", annualDepreciation(asset, 2026)!, 100_000, 200);
  near("year 2 is 32%", annualDepreciation(asset, 2027)!, 160_000, 200);
  near("year 3 is 19.2%", annualDepreciation(asset, 2028)!, 96_000, 200);
  // Six years for a five-year life, because of the half-year convention.
  ok("it runs into a sixth year", annualDepreciation(asset, 2031)! > 0);
  eq("and stops after that", annualDepreciation(asset, 2032), 0);
  near("totalling the basis", accumulatedThrough(asset, 2032)!, 500_000, 2);
}

section("land never depreciates");
eq(
  "land is zero, always",
  annualDepreciation(
    { basisCents: 20_000_000, placedInServiceOn: utc(2019, 1, 1), method: "land" },
    2026,
  ),
  0,
);

section("methods needing a rule-set figure refuse without one");
{
  const bonus = {
    basisCents: 500_000,
    placedInServiceOn: utc(2026, 3, 1),
    method: "bonus" as const,
  };
  // Null, not zero and not a default. An unconfirmed rate produces no number.
  eq("bonus with no rules is not computed", annualDepreciation(bonus, 2026), null);
  eq(
    "bonus with an unconfirmed rate is not computed",
    annualDepreciation(bonus, 2026, { bonusDepreciationRate: null, section179LimitCents: null }),
    null,
  );
  eq(
    "bonus with a confirmed rate computes",
    annualDepreciation(bonus, 2026, { bonusDepreciationRate: 0.4, section179LimitCents: null }),
    200_000,
  );
}

section("the building basis refuses without the land split");
{
  const property = {
    purchasePriceCents: 98_500_000,
    closingCostsCents: 1_840_000,
    landAllocationBasisPoints: null,
  };
  // The refusal that matters most in the whole engine. The difference between a
  // 15% and a 30% land allocation on this property is about $2,700 a year, in a
  // figure that looks equally authoritative either way.
  eq("no split, no basis", buildingBasisCents(property), null);
  eq(
    "20% land",
    buildingBasisCents({ ...property, landAllocationBasisPoints: 2000 }),
    Math.round(100_340_000 * 0.8),
  );
  eq(
    "30% land is a different answer",
    buildingBasisCents({ ...property, landAllocationBasisPoints: 3000 }),
    Math.round(100_340_000 * 0.7),
  );
}

section("brackets (invented rates — the real ones are never in code)");
{
  // 10% to $10,000, 20% to $50,000, 30% above.
  const brackets = [
    { upToCents: 1_000_000, rate: 0.1 },
    { upToCents: 5_000_000, rate: 0.2 },
    { upToCents: null, rate: 0.3 },
  ];

  eq("zero income", taxOnOrdinary(0, brackets), 0);
  eq("inside the first band", taxOnOrdinary(500_000, brackets), 50_000);
  eq("exactly at a boundary", taxOnOrdinary(1_000_000, brackets), 100_000);
  // $100 + $8,000 = marginal, not average.
  eq("into the second band", taxOnOrdinary(5_000_000, brackets), 100_000 + 800_000);
  eq("into the top band", taxOnOrdinary(6_000_000, brackets), 100_000 + 800_000 + 300_000);

  // An incomplete table produces no number rather than a smaller one.
  eq(
    "an unconfirmed rate is not computed",
    taxOnOrdinary(2_000_000, [{ upToCents: null, rate: null }]),
    null,
  );
  eq("an empty table is not computed", taxOnOrdinary(100, []), null);
}

section("preferential rates stack on top of ordinary income");
{
  // 0% to $40,000, 15% to $400,000, 20% above.
  const ltcg = [
    { upToCents: 4_000_000, rate: 0 },
    { upToCents: 40_000_000, rate: 0.15 },
    { upToCents: null, rate: 0.2 },
  ];

  // This is the part people get wrong. The same $30,000 gain is taxed
  // differently depending on what sits underneath it.
  eq(
    "a gain that fits entirely in the 0% band",
    taxOnPreferential(3_000_000, 0, ltcg),
    0,
  );
  eq(
    "the same gain on top of $30,000 of ordinary income straddles two bands",
    taxOnPreferential(3_000_000, 3_000_000, ltcg),
    // $10,000 at 0%, $20,000 at 15%
    Math.round(2_000_000 * 0.15),
  );
  eq(
    "and on top of $500,000 it is all at the top rate",
    taxOnPreferential(3_000_000, 50_000_000, ltcg),
    Math.round(3_000_000 * 0.2),
  );
  eq("no gain, no tax", taxOnPreferential(0, 5_000_000, ltcg), 0);
}

console.log(
  failed === 0 ? `\n${passed} passed.\n` : `\n${passed} passed, ${failed} FAILED.\n`,
);
process.exit(failed === 0 ? 0 : 1);
