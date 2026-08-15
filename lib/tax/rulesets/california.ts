import type { ByStatus, CaliforniaRules, Figure } from "@/lib/tax/rules";

/**
 * California — **structure only**, same as the federal skeleton and for the same
 * reason.
 *
 * The three booleans are not `null`, and that is deliberate: they are not
 * *figures* to be looked up but **standing facts about California's
 * non-conformity**, which is why `DepreciableAsset` carries a second method at
 * all. They still want checking once a year — conformity is a thing legislatures
 * change — but they have a defensible default in a way that a bracket does not.
 *
 * Sources: the FTB's annual tax rate schedules for brackets, standard deduction
 * and exemption credits; FTB Publication 1001 for the depreciation differences.
 */

function byStatus<T>(value: T): ByStatus<T> {
  return { single: value, mfj: value, mfs: value, hoh: value, qw: value };
}

const nothing: Figure = null;

export function californiaSkeleton(taxYear: number): CaliforniaRules {
  return {
    taxYear,
    jurisdiction: "ca",

    brackets: {
      single: [],
      mfj: [],
      mfs: [],
      hoh: [],
      qw: [],
    },
    standardDeduction: byStatus(nothing),
    exemptionCreditCents: byStatus(nothing),
    dependentExemptionCreditCents: nothing,

    mentalHealthSurcharge: { rate: nothing, thresholdCents: nothing },

    // Standing facts rather than figures. California has not conformed to
    // federal bonus depreciation since it was introduced, caps §179 far below
    // the federal limit, and has no QBI deduction at all — which is why a
    // property's federal and CA depreciation differ, and why that difference is
    // itself a line on the CA return.
    conformsToBonus: false,
    conformsToSection179: false,
    section179LimitCents: nothing,
    hasQbi: false,

    standardMileageCents: nothing,
  };
}

export const CALIFORNIA_SOURCES: { prefix: string; label: string; url: string }[] =
  [
    {
      prefix: "brackets",
      label: "FTB annual tax rate schedules",
      url: "https://www.ftb.ca.gov/forms/",
    },
    {
      prefix: "standardDeduction",
      label: "FTB annual tax rate schedules",
      url: "https://www.ftb.ca.gov/forms/",
    },
    {
      prefix: "exemptionCredit",
      label: "FTB annual tax rate schedules — a credit, not a deduction",
      url: "https://www.ftb.ca.gov/forms/",
    },
    {
      prefix: "dependentExemptionCredit",
      label: "FTB annual tax rate schedules",
      url: "https://www.ftb.ca.gov/forms/",
    },
    {
      prefix: "mentalHealthSurcharge",
      label: "Mental Health Services Act — 1% above $1,000,000",
      url: "https://www.ftb.ca.gov/",
    },
    {
      prefix: "section179Limit",
      label: "FTB Publication 1001 — California's own §179 cap",
      url: "https://www.ftb.ca.gov/forms/misc/1001.html",
    },
    {
      prefix: "standardMileage",
      label: "California follows the federal rate",
      url: "https://www.irs.gov/tax-professionals/standard-mileage-rates",
    },
  ];
