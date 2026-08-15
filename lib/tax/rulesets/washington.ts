import type { Figure, WashingtonRules } from "@/lib/tax/rules";

/**
 * Washington — **structure only**, same as the federal skeleton.
 *
 * Washington is a much shorter file than California was, and for a reason worth
 * stating rather than leaving as an absence: **there is no personal income
 * tax.** No brackets, no standard deduction, no exemption credits, no state
 * withholding on a salary, and no separate state depreciation basis — which
 * removes the whole class of federal/state divergence that made California's
 * module the size it was.
 *
 * What Washington *does* have on an individual is a **7% tax on long-term
 * capital gains** above a standard deduction, enacted in 2021 and upheld in
 * 2023. It is easy to forget precisely because the state is famous for having no
 * income tax, and it only bites in a year with a large stock sale — which is
 * exactly the year you would want warning.
 *
 * `hasIncomeTax: false` is a **standing fact**, not a figure to look up, so it
 * ships with a value — the same treatment California's non-conformity booleans
 * got. Every number is `null` and stays that way until confirmed against the
 * Department of Revenue's page.
 */

const nothing: Figure = null;

export function washingtonSkeleton(taxYear: number): WashingtonRules {
  return {
    taxYear,
    jurisdiction: "wa",

    // Standing facts about Washington, not figures. Worth an annual glance —
    // legislatures change these — but they have a defensible default in a way a
    // rate does not.
    hasIncomeTax: false,
    hasCapitalGainsTax: true,

    capitalGains: {
      rate: nothing,
      /** The amount of long-term gain excluded before the rate applies.
       *  Indexed annually, so it moves. */
      standardDeductionCents: nothing,
      /** The charitable deduction against this tax has both a floor (giving
       *  below it does not count) and a cap. */
      charitableFloorCents: nothing,
      charitableCapCents: nothing,
    },
  };
}

export const WASHINGTON_SOURCES: { prefix: string; label: string; url: string }[] =
  [
    {
      prefix: "capitalGains",
      label:
        "Washington DOR — capital gains tax. The standard deduction is indexed annually, so check the year.",
      url: "https://dor.wa.gov/taxes-rates/other-taxes/capital-gains-tax",
    },
  ];

/**
 * What the Washington capital gains tax does **not** reach.
 *
 * Listed here rather than left implicit because the first exemption is the one
 * that matters most to this app: **real estate is exempt outright.** Selling the
 * rental does not trigger this tax, however large the gain — which is exactly
 * the assumption somebody would get wrong in the year it mattered.
 */
export const WA_CAPITAL_GAINS_EXEMPTIONS = [
  "Real estate — including the rental, however large the gain",
  "Assets held in a retirement account",
  "Interests in a qualified family-owned small business",
  "Livestock, timber and timberland, and commercial fishing privileges",
  "Goodwill from the sale of a franchised auto dealership",
];
