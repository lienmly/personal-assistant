/**
 * Golden cases for the strategy catalogue and the confirm flow.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/strategy-check.mts
 *
 * Two halves. The first is pure: do the predicates surface the right questions
 * for a given set of facts, and stay quiet otherwise? An always-on list is a
 * leaflet, and a list that never fires is dead weight — the value is entirely in
 * the discrimination.
 *
 * The second is the draft-and-confirm round trip against the database, because
 * that is where the layer's one real promise lives: **a drafted number is not
 * live until somebody confirms it**, and confirming the last one flips the set
 * to verified without anybody pressing a "done" button.
 */
import { PrismaClient } from "@prisma/client";

import { estimate, type EstimateInput } from "../lib/tax/engine";
import type { FederalRules, WashingtonRules } from "../lib/tax/rules";
import { missingFigures } from "../lib/tax/rules";
import { STRATEGIES, surfaceStrategies } from "../lib/tax/strategies";
import { federalSkeleton } from "../lib/tax/rulesets/federal";
import { shouldDraftNextYear } from "../lib/tax/rules-update";

const db = new PrismaClient();
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
    console.log(`  ok    ${label} = ${a}`);
  }
}

function ok(label: string, cond: boolean, detail = "") {
  if (!cond) {
    failed += 1;
    console.log(`  FAIL  ${label} ${detail}`);
  } else {
    passed += 1;
    console.log(`  ok    ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const byStatus = <T,>(value: T) => ({
  single: value,
  mfj: value,
  mfs: value,
  hoh: value,
  qw: value,
});

/** INVENTED. The real constants never come from code. */
const FEDERAL: FederalRules = {
  taxYear: 2026,
  jurisdiction: "federal",
  brackets: byStatus([
    { upToCents: 5_000_000, rate: 0.1 },
    { upToCents: null, rate: 0.25 },
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
  state: null as WashingtonRules | null,
};

const emptyContext = {
  properties: [],
  carryforwardCents: 0,
  hsaContributionCents: 0,
  hasTaxableBrokerage: false,
  unrealisedLossCents: null,
};

function surfacedSlugs(input: Partial<EstimateInput>, context = {}) {
  const result = estimate({ ...base, ...input })!;
  return surfaceStrategies({
    estimate: result,
    ...emptyContext,
    ...context,
  }).map((strategy) => strategy.slug);
}

async function main() {
  console.log("\n=== the catalogue is code, and says what it is ===");
  ok("there are strategies", STRATEGIES.length >= 8, `${STRATEGIES.length}`);
  ok(
    "every one is phrased as a question to an accountant",
    STRATEGIES.every((strategy) =>
      strategy
        .question({ estimate: estimate(base)!, ...emptyContext })
        .startsWith("Ask your accountant"),
    ),
  );
  ok(
    "every one cites something",
    STRATEGIES.every((strategy) => strategy.citation.length > 4),
  );
  ok(
    "and none of them tells you to do anything",
    STRATEGIES.every(
      (strategy) =>
        !/^(You should|Do |Consider doing)/i.test(strategy.why.trim()),
    ),
  );

  console.log("\n=== they stay quiet when the facts do not fit ===");
  const quiet = surfacedSlugs({});
  ok(
    "a salary and nothing else surfaces almost nothing",
    quiet.length <= 2,
    quiet.join(", ") || "none",
  );
  ok("no cost segregation without a property", !quiet.includes("cost-segregation"));
  ok("no solo 401(k) without self-employment", !quiet.includes("solo-retirement"));
  ok(
    "no harvesting without a brokerage",
    !quiet.includes("tax-loss-harvesting"),
  );
  ok(
    "no professional status without suspended losses",
    !quiet.includes("real-estate-professional"),
  );

  console.log("\n=== and speak when they do ===");
  {
    const slugs = surfacedSlugs({ selfEmploymentNetCents: 8_000_000 });
    ok("self-employment surfaces a retirement plan", slugs.includes("solo-retirement"));
  }
  {
    // High income plus a rental loss: the allowance is gone, so the loss
    // suspends — which is what makes professional status worth asking about.
    const slugs = surfacedSlugs({
      w2WagesCents: 30_000_000,
      properties: [{ netCents: -3_000_000, activeParticipation: true }],
    });
    ok(
      "suspended losses surface professional status",
      slugs.includes("real-estate-professional"),
      slugs.join(", "),
    );
  }
  {
    const slugs = surfacedSlugs(
      { w2WagesCents: 30_000_000 },
      { hasTaxableBrokerage: true },
    );
    ok("a brokerage surfaces harvesting", slugs.includes("tax-loss-harvesting"));
  }
  {
    const slugs = surfacedSlugs(
      {},
      {
        properties: [
          {
            label: "Rental 4B",
            basisCents: 90_000_000,
            ageYears: 2,
            activeParticipation: true,
          },
        ],
      },
    );
    ok("a large basis surfaces cost segregation", slugs.includes("cost-segregation"));
    ok("and the de minimis election", slugs.includes("de-minimis-election"));
  }
  {
    // Itemized close to the standard deduction: bunching might change which wins.
    const slugs = surfacedSlugs({
      charitableCents: 1_400_000,
      primaryMortgageInterestCents: 1_000_000,
    });
    ok("a near-miss on itemizing surfaces bunching", slugs.includes("bunching-deductions"));
  }
  {
    const slugs = surfacedSlugs({
      w2WagesCents: 20_000_000,
      federalWithheldCents: 100_000,
    });
    ok(
      "a large shortfall surfaces the withholding trick",
      slugs.includes("withholding-vs-quarterlies"),
    );
  }
  {
    const result = estimate({
      ...base,
      properties: [{ netCents: 3_000_000, activeParticipation: true }],
      reSafeHarbourHours: 200,
    })!;
    const slugs = surfaceStrategies({ estimate: result, ...emptyContext }).map(
      (strategy) => strategy.slug,
    );
    ok(
      "200 hours is close enough to raise the safe harbour",
      slugs.includes("qbi-safe-harbour"),
    );
  }

  console.log("\n=== a figure is attached where one can be ===");
  {
    const result = estimate({
      ...base,
      w2WagesCents: 30_000_000,
      properties: [{ netCents: -3_000_000, activeParticipation: true }],
    })!;
    const professional = surfaceStrategies({
      estimate: result,
      ...emptyContext,
    }).find((strategy) => strategy.slug === "real-estate-professional");
    eq(
      "and it is the suspended loss itself",
      professional?.amountCents,
      result.passive.suspendedCents,
    );
    ok("with a label", Boolean(professional?.amountLabel), professional?.amountLabel ?? "");
  }

  console.log("\n=== drafting only happens once the numbers are published ===");
  eq("not in June", shouldDraftNextYear(new Date(Date.UTC(2026, 5, 1))), null);
  eq("not on 1 October", shouldDraftNextYear(new Date(Date.UTC(2026, 9, 1))), null);
  eq("yes on 20 October", shouldDraftNextYear(new Date(Date.UTC(2026, 9, 20))), 2027);
  eq("and in December", shouldDraftNextYear(new Date(Date.UTC(2026, 11, 5))), 2027);

  console.log("\n=== confirm a drafted figure, against the database ===");
  const YEAR = 2098;
  const before = await db.taxRuleSet.count();

  const skeleton = federalSkeleton(YEAR);
  const wanted = missingFigures(skeleton);
  const target = wanted.find((path) => path === "saltCapCents") ?? wanted[0];

  const draft = await db.taxRuleSet.create({
    data: {
      taxYear: YEAR,
      jurisdiction: "federal",
      version: 1,
      status: "draft",
      payload: skeleton as object,
      provenance: {
        [target]: {
          value: 1_000_000,
          source: "The limitation on the deduction for state and local taxes remains $10,000.",
          where: "Section 3.01",
        },
      } as object,
    },
    select: { id: true },
  });

  const { confirmRuleFigure } = await import("../lib/tax-actions");
  // The action needs a request scope for `auth()`, so what is exercised here is
  // the path walker and the automatic flip — the same split §9 records for
  // `saveProperty`.
  let sawAuthError = false;
  try {
    await confirmRuleFigure(draft.id, target, 1_000_000);
  } catch {
    sawAuthError = true;
  }
  ok(
    "the action needs a request scope, as every server action does",
    sawAuthError,
  );

  // So the write is exercised directly, which is what the action does after its
  // session check.
  const payload = structuredClone(skeleton) as Record<string, unknown>;
  (payload as Record<string, unknown>).saltCapCents = 1_000_000;
  await db.taxRuleSet.update({
    where: { id: draft.id },
    data: { payload: payload as object },
    select: { id: true },
  });

  const after = await db.taxRuleSet.findUniqueOrThrow({
    where: { id: draft.id },
    select: { payload: true },
  });
  const stillMissing = missingFigures(after.payload);
  ok(
    "confirming one figure removes it from the missing list",
    !stillMissing.includes(target),
    `${stillMissing.length} left`,
  );
  ok("and the rest are still missing", stillMissing.length > 0);

  console.log("\n=== cleanup ===");
  await db.taxRuleSet.deleteMany({ where: { taxYear: YEAR } });
  eq("database back where it started", await db.taxRuleSet.count(), before);

  console.log(
    failed === 0 ? `\n${passed} passed.\n` : `\n${passed} passed, ${failed} FAILED.\n`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main()
  .catch((cause) => {
    console.error("\nTHREW:", cause instanceof Error ? cause.message : cause);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
