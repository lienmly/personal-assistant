import { moneyLabel } from "@/lib/money";
import type { TaxEstimate } from "@/lib/tax/engine";

/**
 * The strategy catalogue.
 *
 * **Hand-written, in git, and never LLM output.** A hallucinated §179 threshold
 * or an invented election is the highest-consequence false fact this app could
 * produce — worse than a wrong bracket, because a bracket is a number somebody
 * might sanity-check and "you can elect X" is a sentence people act on. A
 * strategy is a predicate plus a sentence, which is code, and code belongs
 * somewhere it can be reviewed.
 *
 * ## Every entry is a question addressed to a third party
 *
 * The field is literally called `question`, every one of them begins "Ask your
 * accountant whether…", and the only action anywhere is **"Mark as raised"**.
 * There is no button that says *Do this*, and that is structural rather than
 * cautious: the difference between "here is something worth asking about" and
 * "here is what you should do" is the difference between a tool and an unlicensed
 * adviser, and the second is not what was asked for.
 *
 * ## `applies` returns three answers, not two
 *
 * `yes` means the facts clearly fit. `maybe` means they are close enough to be
 * worth a conversation — which is most of the useful cases, because the ones
 * that clearly fit you have usually already done. `no` means it is not relevant
 * this year and the entry is not shown.
 *
 * ## What the amount is, and is not
 *
 * `amount` plugs your real figures into the sentence so the question has a size
 * attached. It is **an order of magnitude, not a promise** — every one of these
 * turns on facts the app cannot see, so the number exists to say "worth an hour
 * of somebody's time" rather than "worth exactly this".
 */

export type StrategyVerdict = "yes" | "maybe" | "no";

export type StrategyContext = {
  estimate: TaxEstimate;
  /** Per property, for the strategies that turn on one. */
  properties: {
    label: string;
    basisCents: number | null;
    /** Years since it was placed in service, or null. */
    ageYears: number | null;
    activeParticipation: boolean;
  }[];
  /** Suspended passive losses carried into this year. */
  carryforwardCents: number;
  hsaContributionCents: number;
  /** True when a taxable brokerage exists at all. */
  hasTaxableBrokerage: boolean;
  unrealisedLossCents: number | null;
};

export type Strategy = {
  slug: string;
  title: string;
  /** Always begins "Ask your accountant whether…". */
  question: (context: StrategyContext) => string;
  why: string;
  citation: string;
  applies: (context: StrategyContext) => StrategyVerdict;
  /** Roughly what it might be worth. Null when it cannot be sized. */
  amount?: (context: StrategyContext) => number | null;
};

/** Rentals with a large enough basis to make a cost segregation study pay. */
const COST_SEG_FLOOR_CENTS = 50_000_000;

export const STRATEGIES: Strategy[] = [
  {
    slug: "cost-segregation",
    title: "Cost segregation",
    question: (context) => {
      const property = context.properties.find(
        (item) => (item.basisCents ?? 0) >= COST_SEG_FLOOR_CENTS,
      );
      return `Ask your accountant whether a cost segregation study on ${property?.label ?? "the rental"} would pay for itself — it splits out the parts that depreciate over 5 and 15 years instead of 27.5.`;
    },
    why: "A building depreciates over 27.5 years, but appliances, carpet, fixtures and land improvements inside it do not. A study reclassifies them, pulling deductions forward. It costs a few thousand dollars, so it only pays on a large enough basis — and it is worth much more early in the hold than late.",
    citation: "IRS Cost Segregation Audit Techniques Guide",
    applies: (context) => {
      const big = context.properties.find(
        (item) => (item.basisCents ?? 0) >= COST_SEG_FLOOR_CENTS,
      );
      if (!big) return "no";
      // Pulling deductions forward is worth little if the losses they create
      // cannot be used — which is exactly what suspended losses mean.
      if (context.estimate.passive.suspendedCents > 0) return "maybe";
      if (big.ageYears !== null && big.ageYears > 10) return "maybe";
      return "yes";
    },
    amount: (context) => {
      const big = context.properties.find(
        (item) => (item.basisCents ?? 0) >= COST_SEG_FLOOR_CENTS,
      );
      if (!big?.basisCents) return null;
      // A very rough order of magnitude: studies commonly reclassify 20–30% of
      // basis, and the first-year benefit is a fraction of that.
      return Math.round(big.basisCents * 0.05);
    },
  },

  {
    slug: "real-estate-professional",
    title: "Real-estate professional status",
    question: () =>
      "Ask your accountant whether you could qualify as a real-estate professional, and what it would take to document it.",
    why: "Rental losses are passive by default, so they cannot offset salary. A real-estate professional's rentals are non-passive, which releases them — and also takes rental income out of the net investment income tax. The bar is high: more than half your working time and over 750 hours in real property trades, documented as you go.",
    citation: "IRC §469(c)(7)",
    applies: (context) => {
      // Only worth raising when there is something trapped to release.
      if (context.estimate.passive.suspendedCents === 0) return "no";
      if (context.estimate.passive.suspendedCents > 1_000_000) return "maybe";
      return "no";
    },
    amount: (context) => context.estimate.passive.suspendedCents,
  },

  {
    slug: "qbi-safe-harbour",
    title: "The §199A rental safe harbour",
    question: (context) => {
      const hours = context.estimate.qbi.safeHarbour.hoursRecorded;
      return hours === null
        ? "Ask your accountant whether logging hours on the rentals from now on would be worth it — the §199A safe harbour needs 250 of them, plus separate books and records kept at the time."
        : `Ask your accountant whether the ${hours} hours recorded, plus separate books, would meet the §199A safe harbour.`;
    },
    why: "A 20% deduction on rental profit needs the rental to be a trade or business, which is a judgement. Rev. Proc. 2019-38 offers a safe harbour instead — 250 hours of rental services, separate books, and contemporaneous records. The hours are the part you have to start counting before you need them.",
    citation: "Rev. Proc. 2019-38",
    applies: (context) => {
      // Only relevant when there is rental profit for the deduction to apply to.
      if (context.estimate.qbi.qualifiedIncomeCents <= 0) return "no";
      const hours = context.estimate.qbi.safeHarbour.hoursRecorded;
      if (hours === null) return "maybe";
      if (hours >= 250) return "yes";
      // Close enough that finishing the year deliberately might get there.
      return hours >= 150 ? "maybe" : "no";
    },
    amount: (context) => context.estimate.qbi.deductionCents,
  },

  {
    slug: "bunching-deductions",
    title: "Bunching deductions into alternate years",
    question: () =>
      "Ask your accountant whether pushing next year's charitable giving into this one — or this year's into next — would get you over the standard deduction in one year instead of neither.",
    why: "Itemizing only helps in a year where the total beats the standard deduction. Two years of giving spread evenly can lose to the standard deduction twice; the same money concentrated into one year can beat it once and take the standard deduction in the other.",
    citation: "IRC §63(c)",
    applies: (context) => {
      const { itemizedCents, standardCents } = context.estimate;
      if (itemizedCents === 0) return "no";
      const ratio = itemizedCents / standardCents;
      // Close under, or barely over — either way, timing might change which wins.
      if (ratio >= 0.6 && ratio <= 1.3) return "maybe";
      return "no";
    },
    amount: (context) => {
      const gap = context.estimate.standardCents - context.estimate.itemizedCents;
      return gap > 0 ? gap : null;
    },
  },

  {
    slug: "solo-retirement",
    title: "A solo 401(k) or SEP",
    question: () =>
      "Ask your accountant which self-employed retirement plan fits — a solo 401(k) usually shelters more than a SEP at the same income, and the deadlines differ.",
    why: "Self-employment income can go into a plan that reduces this year's taxable income. Which plan shelters more depends on the income level and whether there are employees, and the deadlines to open one are not the same as the deadlines to fund it.",
    citation: "IRS Publication 560",
    applies: (context) => {
      if (context.estimate.se.totalCents === 0) return "no";
      return "yes";
    },
    amount: (context) => context.estimate.se.netEarningsCents,
  },

  {
    slug: "withholding-vs-quarterlies",
    title: "Withholding instead of quarterly payments",
    question: () =>
      "Ask your accountant whether increasing salary withholding late in the year would cover the shortfall without the underpayment penalty that quarterly payments would still leave.",
    why: "Estimated payments are credited when they are made, so a payment in January does not fix an underpayment from April. Withholding is treated as spread evenly across the year however late it happens — which can repair a shortfall that quarterly payments no longer can.",
    citation: "IRS Publication 505",
    applies: (context) => {
      // Only when there is a genuine gap.
      const owed = context.estimate.balanceCents;
      if (owed <= 0) return "no";
      const paid = context.estimate.withheldCents + context.estimate.estimatedPaidCents;
      const covered = paid / Math.max(1, context.estimate.totalTaxCents);
      return covered < 0.9 ? "yes" : "maybe";
    },
    amount: (context) => Math.max(0, context.estimate.balanceCents),
  },

  {
    slug: "de-minimis-election",
    title: "The de minimis safe harbour election",
    question: () =>
      "Ask your accountant whether making the de minimis safe harbour election would let this year's smaller purchases be expensed rather than depreciated.",
    why: "Without the election, anything that improves a property has to be capitalised and depreciated over years. With it — made annually, on the return — items under a per-item threshold can be deducted in full the year they are bought. It has to be elected in advance of needing it.",
    citation: "Treas. Reg. §1.263(a)-1(f)",
    applies: (context) =>
      context.properties.length > 0 ? "maybe" : "no",
  },

  {
    slug: "tax-loss-harvesting",
    title: "Harvesting losses in the brokerage",
    question: () =>
      "Ask your accountant whether selling the positions that are down would be worth it — realised losses offset realised gains, and up to $3,000 of ordinary income beyond that.",
    why: "A position that has fallen is worth nothing on a tax return until it is sold. Realising the loss offsets gains taken elsewhere, and the excess carries forward indefinitely. The wash-sale rule means the same security cannot be bought back within 30 days on either side.",
    citation: "IRC §1211, §1091",
    applies: (context) => {
      if (!context.hasTaxableBrokerage) return "no";
      if (context.estimate.incomeLines.some((line) => line.key === "longTerm" && line.cents > 0)) {
        return "yes";
      }
      return "maybe";
    },
    amount: (context) => context.unrealisedLossCents,
  },

  {
    slug: "hsa-headroom",
    title: "Filling the HSA",
    question: () =>
      "Ask your accountant whether there is room left in the HSA for this year — it is the one account that goes in untaxed, grows untaxed and comes out untaxed for medical costs.",
    why: "An HSA contribution reduces taxable income like a traditional retirement contribution, and unlike one it is never taxed on the way out when spent on medical expenses. It can be funded up to the filing deadline, so it is one of the few things still adjustable after the year has ended.",
    citation: "IRC §223",
    applies: (context) => {
      // Someone contributing nothing may have no eligible plan at all, which the
      // app cannot see — so it is a question, not a recommendation.
      return context.hsaContributionCents === 0 ? "maybe" : "no";
    },
  },
];

export function strategyBySlug(slug: string): Strategy | undefined {
  return STRATEGIES.find((strategy) => strategy.slug === slug);
}

/** How a surfaced strategy reads, with the user's own figures in it. */
export type SurfacedStrategy = {
  slug: string;
  title: string;
  question: string;
  why: string;
  citation: string;
  verdict: StrategyVerdict;
  amountCents: number | null;
  amountLabel: string | null;
};

export function surfaceStrategies(
  context: StrategyContext,
): SurfacedStrategy[] {
  return STRATEGIES.map((strategy): SurfacedStrategy | null => {
    const verdict = strategy.applies(context);
    if (verdict === "no") return null;

    const amountCents = strategy.amount?.(context) ?? null;

    return {
      slug: strategy.slug,
      title: strategy.title,
      question: strategy.question(context),
      why: strategy.why,
      citation: strategy.citation,
      verdict,
      amountCents,
      amountLabel:
        amountCents !== null && amountCents > 0 ? moneyLabel(amountCents) : null,
    };
  })
    .filter((entry): entry is SurfacedStrategy => entry !== null)
    // A clear fit first, then the maybes — but both are questions, and the
    // ordering is about reading order rather than priority.
    .sort((a, b) => (a.verdict === b.verdict ? 0 : a.verdict === "yes" ? -1 : 1));
}
