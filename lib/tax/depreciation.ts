import type { DepreciationMethod } from "@prisma/client";

/**
 * Depreciation, as arithmetic.
 *
 * **Pure, and nothing is stored.** `DepreciableAsset` deliberately holds no
 * schedule: a stored schedule is a cache that goes stale the instant a basis is
 * corrected, and a basis *is* corrected, because it gets assembled from a
 * closing statement nobody reads twice. Recomputing costs nothing.
 *
 * Client-safe: no Prisma runtime import, no database.
 *
 * ## The conventions, and why they are not a detail
 *
 * **Residential rental property is 27.5-year straight line, mid-month.** The
 * mid-month convention treats the property as placed in service in the *middle*
 * of whatever month it actually was — so a house available to rent on 2 August
 * and one available on 30 August get identical first-year deductions, and both
 * get 4.5 months rather than 5 or 4.
 *
 * That is why `Property.placedInServiceOn` is **the date it was first available
 * to rent** and emphatically not the purchase date. Buying in June and finishing
 * the work in September is a three-month difference in the first year's
 * deduction, and it is the kind of error that survives for 27 years because
 * nothing downstream contradicts it.
 *
 * **Personal property — appliances, carpet, furniture — is 5-year MACRS with a
 * half-year convention**, which is a different shape entirely: declining balance
 * at 200%, switching to straight line when that becomes better, and a half year
 * in both the first year and the last. The tables below are the standard IRS
 * percentages for that combination, and they are *derived*, not looked up: the
 * declining-balance formula produces them exactly, which is why they can live in
 * code while a bracket rate cannot.
 */

/** Years, by method. Null where the method has no life of its own. */
const LIFE_YEARS: Partial<Record<DepreciationMethod, number>> = {
  sl_27_5_mid_month: 27.5,
  sl_39_mid_month: 39,
  macrs_5_hy: 5,
  macrs_15_hy: 15,
};

export function isMidMonth(method: DepreciationMethod): boolean {
  return method === "sl_27_5_mid_month" || method === "sl_39_mid_month";
}

/**
 * The share of a full year's straight-line deduction allowed in the year the
 * asset is placed in service, under the mid-month convention.
 *
 * `month` is 1–12. January gives 11.5/12, December gives 0.5/12.
 */
export function midMonthFactor(month: number): number {
  const clamped = Math.min(12, Math.max(1, Math.round(month)));
  return (12 - clamped + 0.5) / 12;
}

/**
 * MACRS 200% declining balance with a half-year convention, derived rather than
 * transcribed.
 *
 * The IRS publishes these as a table; producing them from the formula means
 * there is no table to mistype, and the result is checkable against Publication
 * 946 by anyone who wants to. Returns the fraction of basis deductible in each
 * year, longest-lived first.
 */
function decliningBalanceHalfYear(life: number, rateFactor = 2): number[] {
  const years = life + 1; // the half-year convention spreads over one extra year
  const shares: number[] = [];
  let remaining = 1;

  for (let year = 0; year < years; year += 1) {
    const declining = (remaining * rateFactor) / life;
    // Straight line over what is left of the life, from this point on.
    const yearsLeft = life - Math.max(0, year - 0.5);
    const straight = yearsLeft > 0 ? remaining / yearsLeft : remaining;

    let share = Math.max(declining, straight);
    // Half a year in the first year and, by consequence, in the last.
    if (year === 0) share = declining / 2;
    if (share > remaining) share = remaining;

    shares.push(share);
    remaining -= share;
    if (remaining <= 1e-9) break;
  }

  return shares;
}

const MACRS_5 = decliningBalanceHalfYear(5);
const MACRS_15 = decliningBalanceHalfYear(15, 1.5);

/**
 * What this asset deducts in `taxYear`, in cents.
 *
 * Returns `0` for a year before it was placed in service or after it is fully
 * written off, and for `land`, which never depreciates. Returns `null` only when
 * a method needs a rule-set figure that is missing — the one case where the
 * honest answer is "not computed".
 */
export function annualDepreciation(
  asset: {
    basisCents: number;
    placedInServiceOn: Date;
    method: DepreciationMethod;
    disposedOn?: Date | null;
  },
  taxYear: number,
  rules?: { bonusDepreciationRate: number | null; section179LimitCents: number | null },
): number | null {
  if (asset.method === "land") return 0;
  if (asset.basisCents <= 0) return 0;

  // `placedInServiceOn` is `@db.Date` — UTC midnight standing in for a local
  // calendar day, so it is read in UTC (§6).
  const startYear = asset.placedInServiceOn.getUTCFullYear();
  const startMonth = asset.placedInServiceOn.getUTCMonth() + 1;

  if (taxYear < startYear) return 0;
  if (asset.disposedOn && taxYear > asset.disposedOn.getUTCFullYear()) return 0;

  if (asset.method === "bonus") {
    if (!rules || rules.bonusDepreciationRate === null) return null;
    // Bonus is taken entirely in the first year, and nothing after it.
    return taxYear === startYear
      ? Math.round(asset.basisCents * rules.bonusDepreciationRate)
      : 0;
  }

  if (asset.method === "section_179") {
    if (!rules || rules.section179LimitCents === null) return null;
    return taxYear === startYear
      ? Math.min(asset.basisCents, rules.section179LimitCents)
      : 0;
  }

  const life = LIFE_YEARS[asset.method];
  if (!life) return null;

  const index = taxYear - startYear;

  if (isMidMonth(asset.method)) {
    const full = asset.basisCents / life;
    const firstYearShare = midMonthFactor(startMonth);

    if (index === 0) return Math.round(full * firstYearShare);

    // **How many complete years follow depends on the start month**, and
    // hardcoding it is wrong in a way that is easy to miss: the life is 27.5
    // years measured from the middle of the placed-in-service month, so what
    // remains after the first partial year is `life − firstYearShare`, and only
    // the whole part of that is taken at the full rate.
    //
    // A property first rented in **January** takes 11.5 months in year one, so
    // 26 full years follow and the tail lands in year 27. One first rented in
    // **August** takes 4.5 months, so 27 full years follow and the tail lands in
    // year 28. Getting this wrong produced a "final" year *larger* than a full
    // one — caught by `scripts/tax-check.mts` asserting the tail is a partial.
    const remaining = life - firstYearShare;
    const fullYears = Math.floor(remaining);

    if (index <= fullYears) return Math.round(full);

    if (index === fullYears + 1) {
      // Whatever is left, so the asset depreciates to exactly its basis and
      // never a cent more.
      const taken = full * firstYearShare + full * fullYears;
      return Math.max(0, Math.round(asset.basisCents - taken));
    }

    return 0;
  }

  const table = asset.method === "macrs_5_hy" ? MACRS_5 : MACRS_15;
  const share = table[index];
  return share === undefined ? 0 : Math.round(asset.basisCents * share);
}

/** Everything deducted up to and including `taxYear`. */
export function accumulatedThrough(
  asset: {
    basisCents: number;
    placedInServiceOn: Date;
    method: DepreciationMethod;
    disposedOn?: Date | null;
  },
  taxYear: number,
  rules?: { bonusDepreciationRate: number | null; section179LimitCents: number | null },
): number | null {
  const start = asset.placedInServiceOn.getUTCFullYear();
  let total = 0;

  for (let year = start; year <= taxYear; year += 1) {
    const amount = annualDepreciation(asset, year, rules);
    if (amount === null) return null;
    total += amount;
  }

  return Math.min(total, asset.basisCents);
}

export function remainingBasis(
  asset: {
    basisCents: number;
    placedInServiceOn: Date;
    method: DepreciationMethod;
    disposedOn?: Date | null;
  },
  taxYear: number,
  rules?: { bonusDepreciationRate: number | null; section179LimitCents: number | null },
): number | null {
  const taken = accumulatedThrough(asset, taxYear, rules);
  return taken === null ? null : asset.basisCents - taken;
}

/**
 * The building's depreciable basis: what was paid, plus closing costs, **less
 * the land**.
 *
 * Returns `null` without the land allocation, and that refusal is the whole
 * point. Land does not depreciate, so guessing the split guesses the deduction —
 * and the difference between a 15% and a 30% land allocation on a $985,000
 * property is about $2,700 a year, every year, in a figure that looks exactly as
 * authoritative either way.
 */
export function buildingBasisCents(property: {
  purchasePriceCents: number;
  closingCostsCents: number;
  landAllocationBasisPoints: number | null;
}): number | null {
  if (property.landAllocationBasisPoints === null) return null;

  const total = property.purchasePriceCents + property.closingCostsCents;
  const land = Math.round((total * property.landAllocationBasisPoints) / 10_000);
  return Math.max(0, total - land);
}
