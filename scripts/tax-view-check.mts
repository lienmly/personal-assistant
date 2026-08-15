/**
 * The tax layer against the real database.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/tax-view-check.mts
 *
 * What this exercises that the pure golden cases cannot: the **refusals in
 * context**. An empty rule set blocks the estimate; a confirmed one unblocks it;
 * a property with no land split blocks it again for a different reason. Those
 * are the behaviours the whole layer is built around, and each of them is a
 * path through `getTaxView` rather than through a function.
 *
 * It removes everything it makes.
 */
import { PrismaClient } from "@prisma/client";

import { getTaxView } from "../lib/tax";
import { federalSkeleton } from "../lib/tax/rulesets/federal";
import { washingtonSkeleton } from "../lib/tax/rulesets/washington";

const db = new PrismaClient();
let failed = 0;

function eq(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failed += 1;
    console.log(`  FAIL  ${label}\n        got  ${a}\n        want ${e}`);
  } else {
    console.log(`  ok    ${label} = ${a}`);
  }
}

function ok(label: string, cond: boolean, detail = "") {
  if (!cond) {
    failed += 1;
    console.log(`  FAIL  ${label} ${detail}`);
  } else {
    console.log(`  ok    ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const YEAR = 2099; // far enough out that it cannot collide with real data
const MARK = "smoke-tax";

/**
 * Fills a skeleton with invented values so the "confirmed" path can be
 * exercised. **The real numbers never come from code** — see `lib/tax/rules.ts`.
 *
 * Bracket tables get a plausible two-band shape rather than being left empty,
 * because an empty table is itself a missing figure: it passes a naive
 * null-check and then cannot tax anything. That disagreement is what this script
 * caught.
 */
function fillSkeleton(payload: unknown, key = ""): unknown {
  if (Array.isArray(payload) && payload.length === 0) {
    return [
      { upToCents: 5_000_000, rate: key.includes("ltcg") ? 0 : 0.1 },
      { upToCents: null, rate: key.includes("ltcg") ? 0.15 : 0.25 },
    ];
  }
  if (payload === null) return 1;
  if (Array.isArray(payload)) return payload.map((item) => fillSkeleton(item, key));
  if (typeof payload === "object") {
    const out: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(payload as Record<string, unknown>)) {
      out[name] = fillSkeleton(value, `${key}.${name}`);
    }
    return out;
  }
  return payload;
}

async function main() {
  const before = {
    rules: await db.taxRuleSet.count(),
    profiles: await db.taxProfile.count(),
    properties: await db.property.count(),
  };
  console.log("\n=== before ===", before);
  if (before.properties > 0) {
    console.log("Properties already exist. Refusing.");
    process.exit(1);
  }

  console.log("\n=== an empty year creates skeletons and refuses to compute ===");
  let view = await getTaxView(YEAR);
  eq("federal is a draft", view.federal.status, "draft");
  ok("with figures to confirm", view.federal.missingCount > 20, `${view.federal.missingCount}`);
  eq("so it is not usable", view.federal.usable, false);
  eq("nothing is estimated", view.estimate, null);
  ok("and it says why", (view.blocker ?? "").includes("have not been confirmed"), view.blocker ?? "");
  eq("no profile yet", view.hasProfile, false);

  console.log("\n=== confirming the constants is not enough on its own ===");
  await db.taxRuleSet.updateMany({
    where: { taxYear: YEAR, jurisdiction: "federal" },
    data: {
      payload: fillSkeleton(federalSkeleton(YEAR)) as object,
      status: "verified",
      verifiedAt: new Date(),
    },
  });
  await db.taxRuleSet.updateMany({
    where: { taxYear: YEAR, jurisdiction: "wa" },
    data: {
      payload: fillSkeleton(washingtonSkeleton(YEAR)) as object,
      status: "verified",
      verifiedAt: new Date(),
    },
  });

  view = await getTaxView(YEAR);
  eq("federal is now usable", view.federal.usable, true);
  eq("nothing missing", view.federal.missingCount, 0);
  eq("but still no estimate", view.estimate, null);
  ok(
    "because the answers only a person has are missing",
    (view.estimateBlocker ?? "").includes("filing status"),
    view.estimateBlocker ?? "",
  );

  console.log("\n=== with a profile, it computes ===");
  await db.taxProfile.create({
    data: {
      taxYear: YEAR,
      filingStatus: "single",
      w2WagesCents: 12_000_000,
      federalWithheldCents: 1_500_000,
      stateWithheldCents: 300_000,
    },
    select: { id: true },
  });

  view = await getTaxView(YEAR);
  ok("an estimate exists", view.estimate !== null, view.estimateBlocker ?? "");
  ok("with labels", view.labels !== null);
  eq("and it is not flagged as draft", view.usingDraftRules, false);
  if (view.estimate) {
    console.log(
      `        total ${view.labels!.totalTaxLabel} · effective ${view.labels!.effectiveRateLabel} · balance ${view.labels!.balanceLabel}`,
    );
    ok("AGI is positive", view.estimate.agiCents > 0, `${view.estimate.agiCents}`);
  }

  console.log("\n=== a property with no land split blocks the whole estimate ===");
  const area = await db.area.findUnique({ where: { slug: "home" }, select: { id: true } });
  const property = await db.property.create({
    data: {
      slug: `${MARK}-4b`,
      label: "Smoke Rental",
      addressLine: "1 Test Street",
      city: "Los Angeles",
      state: "CA",
      postalCode: "90042",
      purchasePriceCents: 98_500_000,
      purchasedOn: new Date(Date.UTC(YEAR - 2, 5, 14)),
      // Deliberately absent.
      landAllocationBasisPoints: null,
      // Inside the 27.5-year life of the test year, or depreciation is
      // correctly zero and the assertion below tests nothing.
      placedInServiceOn: new Date(Date.UTC(YEAR - 2, 7, 1)),
      areaId: area?.id ?? null,
    },
    select: { id: true },
  });

  view = await getTaxView(YEAR);
  eq("a Schedule E appears", view.scheduleEs.length, 1);
  eq("its net is not computed", view.scheduleEs[0].netCents, null);
  ok(
    "and it names the land split",
    (view.scheduleEs[0].depreciationBlocker ?? "").includes("land"),
    view.scheduleEs[0].depreciationBlocker ?? "",
  );
  // The important one: an incomplete Schedule E must take the whole estimate
  // down, because the rental's net feeds AGI and a missing depreciation line
  // would silently overstate it.
  eq("the estimate is withdrawn", view.estimate, null);
  ok(
    "and says which property",
    (view.estimateBlocker ?? "").includes("Smoke Rental"),
    view.estimateBlocker ?? "",
  );

  console.log("\n=== supplying the split restores it ===");
  await db.property.update({
    where: { id: property.id },
    data: { landAllocationBasisPoints: 2000 },
    select: { id: true },
  });

  view = await getTaxView(YEAR);
  ok("depreciation now computes", view.scheduleEs[0].depreciationCents !== null);
  ok("the Schedule E has a net", view.scheduleEs[0].netCents !== null);
  ok("and the estimate is back", view.estimate !== null, view.estimateBlocker ?? "");
  if (view.estimate) {
    // No accepted statements, so the rental is a pure loss — depreciation only.
    ok(
      "the rental shows a loss, being depreciation with no income yet",
      view.estimate.passive.netCents < 0,
      `${view.estimate.passive.netCents}`,
    );
    ok(
      "and §469 has something to say about it",
      view.estimate.passive.reason.length > 0,
      view.estimate.passive.reason,
    );
  }

  console.log("\n=== a draft rule set is used but badged ===");
  await db.taxRuleSet.updateMany({
    where: { taxYear: YEAR, jurisdiction: "federal" },
    data: { status: "draft" },
  });
  view = await getTaxView(YEAR);
  eq("still computes", view.estimate !== null, true);
  eq("but every figure is badged", view.usingDraftRules, true);

  console.log("\n=== cleanup ===");
  await db.property.deleteMany({ where: { slug: { startsWith: MARK } } });
  await db.taxProfile.deleteMany({ where: { taxYear: YEAR } });
  await db.taxRuleSet.deleteMany({ where: { taxYear: YEAR } });

  const after = {
    rules: await db.taxRuleSet.count(),
    profiles: await db.taxProfile.count(),
    properties: await db.property.count(),
  };
  eq("database back where it started", after, before);

  console.log(failed === 0 ? "\nALL PASS\n" : `\n${failed} FAILED\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main()
  .catch((cause) => {
    console.error("\nTHREW:", cause instanceof Error ? cause.message : cause);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
