import type { Bracket, ByStatus, FederalRules, Figure } from "@/lib/tax/rules";

/**
 * The federal rule set — **structure only.**
 *
 * Every numeric leaf below is `null`, and that is the point of the file rather
 * than an unfinished state. See `lib/tax/rules.ts` for the full argument; the
 * short version is that a tax constant recalled from memory is indistinguishable
 * from a correct one until it costs you money, so nothing here is filled in
 * until it has been read off the published source and confirmed.
 *
 * `sourceLabel` names the document each group comes from, so confirming is
 * looking one thing up rather than searching for it:
 *
 * - **Brackets, standard deduction, QBI thresholds, §179 limits, NIIT, the
 *   §469 allowance** — the IRS annual inflation-adjustment Revenue Procedure
 *   (e.g. Rev. Proc. 2024-40 for tax year 2025).
 * - **The standard mileage rate** — its own IRS Notice, published separately in
 *   December.
 * - **SE tax rates and the wage base** — SSA's annual COLA fact sheet.
 *
 * Layer 7 automates the *fetching* of these into a draft, with the sentence each
 * number came from attached. It does not automate the confirming.
 */

const noBrackets = (): Bracket[] => [];

function byStatus<T>(value: T): ByStatus<T> {
  return { single: value, mfj: value, mfs: value, hoh: value, qw: value };
}

const nothing: Figure = null;

export function federalSkeleton(taxYear: number): FederalRules {
  return {
    taxYear,
    jurisdiction: "federal",

    brackets: {
      single: noBrackets(),
      mfj: noBrackets(),
      mfs: noBrackets(),
      hoh: noBrackets(),
      qw: noBrackets(),
    },
    standardDeduction: byStatus(nothing),
    additionalStandardDeduction: { age65: nothing, blind: nothing },

    ltcgBrackets: {
      single: noBrackets(),
      mfj: noBrackets(),
      mfs: noBrackets(),
      hoh: noBrackets(),
      qw: noBrackets(),
    },

    seTax: {
      oasdiRate: nothing,
      medicareRate: nothing,
      wageBaseCents: nothing,
      additionalMedicareRate: nothing,
      additionalMedicareThreshold: byStatus(nothing),
      netEarningsFactor: nothing,
    },

    niit: { rate: nothing, threshold: byStatus(nothing) },

    pal469: {
      specialAllowanceCents: nothing,
      phaseoutStartMagiCents: byStatus(nothing),
      phaseoutRate: nothing,
    },

    qbi: {
      rate: nothing,
      thresholdCents: byStatus(nothing),
      phaseInRangeCents: byStatus(nothing),
      wageLimitRate: nothing,
      wageUbiaRate: nothing,
      ubiaRate: nothing,
    },

    saltCapCents: nothing,
    deMinimisSafeHarbourCents: nothing,
    standardMileageCents: nothing,
    section179LimitCents: nothing,
    section179PhaseoutCents: nothing,
    bonusDepreciationRate: nothing,

    estimatedSafeHarbour: {
      currentYearRate: nothing,
      priorYearRate: nothing,
      priorYearHighAgiRate: nothing,
      highAgiThresholdCents: nothing,
    },
  };
}

/** Where each group of numbers is published, shown beside the field when
 *  confirming it. Grouped by the dotted-path prefix `missingFigures` returns. */
export const FEDERAL_SOURCES: { prefix: string; label: string; url: string }[] = [
  {
    prefix: "brackets",
    label: "IRS annual inflation-adjustment Revenue Procedure",
    url: "https://www.irs.gov/pub/irs-drop/",
  },
  {
    prefix: "standardDeduction",
    label: "IRS annual inflation-adjustment Revenue Procedure",
    url: "https://www.irs.gov/pub/irs-drop/",
  },
  {
    prefix: "ltcgBrackets",
    label: "IRS annual inflation-adjustment Revenue Procedure",
    url: "https://www.irs.gov/pub/irs-drop/",
  },
  {
    prefix: "seTax",
    label: "SSA annual COLA fact sheet, and IRS Schedule SE instructions",
    url: "https://www.ssa.gov/cola/",
  },
  {
    prefix: "niit",
    label: "IRS Form 8960 instructions — thresholds are not inflation-adjusted",
    url: "https://www.irs.gov/forms-pubs/about-form-8960",
  },
  {
    prefix: "pal469",
    label: "IRS Publication 925 — the $25,000 allowance is not inflation-adjusted",
    url: "https://www.irs.gov/publications/p925",
  },
  {
    prefix: "qbi",
    label: "IRS annual inflation-adjustment Revenue Procedure, and Form 8995-A",
    url: "https://www.irs.gov/forms-pubs/about-form-8995-a",
  },
  {
    prefix: "saltCap",
    label: "Current law — check it has not changed for this year",
    url: "https://www.irs.gov/publications/p17",
  },
  {
    prefix: "standardMileage",
    label: "IRS standard mileage Notice, published each December",
    url: "https://www.irs.gov/tax-professionals/standard-mileage-rates",
  },
  {
    prefix: "section179",
    label: "IRS annual inflation-adjustment Revenue Procedure",
    url: "https://www.irs.gov/publications/p946",
  },
  {
    prefix: "bonusDepreciation",
    label: "IRS Publication 946 — this rate has been changing year to year",
    url: "https://www.irs.gov/publications/p946",
  },
  {
    prefix: "deMinimis",
    label: "Treas. Reg. §1.263(a)-1(f) — the de minimis safe harbour election",
    url: "https://www.irs.gov/businesses/small-businesses-self-employed/tangible-property-final-regulations",
  },
  {
    prefix: "estimatedSafeHarbour",
    label: "IRS Publication 505",
    url: "https://www.irs.gov/publications/p505",
  },
];
