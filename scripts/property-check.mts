/**
 * Layer 3, against the real database.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/property-check.mts
 *
 * **A `"use server"` module cannot be called from a script.** Every action in
 * `lib/property-actions.ts` starts with `auth()`, which reads `next/headers` and
 * throws outside a request scope. That is a real limit and it is why the field
 * parsing and the delete guard live in `lib/property-rules.ts` — the two places
 * bugs actually are, extracted so they can be exercised here. What is left in
 * the action is the auth check and the database call, which is thin enough to
 * read.
 *
 * The rest of this file is the read path against real rows, and it removes
 * everything it makes.
 */
import { PrismaClient } from "@prisma/client";

import { getNetWorth } from "../lib/ledger";
import { getLoanCandidates, getProperties } from "../lib/property";
import {
  depreciationBlocker,
  parseBasisPoints,
  parseDateOnly,
  parseDomain,
  parseMoneyField,
  propertyDeleteBlocker,
} from "../lib/property-rules";

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

const MARK = "smoke-prop";

async function main() {
  console.log("\n=== field parsing ===");
  eq("a formatted price", parseMoneyField("$985,000"), 98_500_000);
  eq("with cents", parseMoneyField("985,000.50"), 98_500_050);
  eq("blank is null, not zero", parseMoneyField(""), null);
  eq("nonsense is null", parseMoneyField("about a million"), null);

  eq("a percentage", parseBasisPoints("20"), 2000);
  eq("with a decimal", parseBasisPoints("20.5"), 2050);
  eq("with a sign", parseBasisPoints("20%"), 2000);
  // Not clamped. 140% is a typo, and silently storing 100% would produce a
  // depreciation figure that is confidently wrong.
  eq("over 100 is refused, not clamped", parseBasisPoints("140"), null);
  eq("negative is refused", parseBasisPoints("-5"), null);

  eq("a date lands on UTC midnight", parseDateOnly("2019-06-14")?.toISOString(), "2019-06-14T00:00:00.000Z");
  eq("a bad date is null", parseDateOnly("not-a-date"), null);

  eq("a pasted URL becomes a domain", parseDomain("https://brightproperty.com/owners"), "brightproperty.com");
  eq("already bare", parseDomain("BrightProperty.com"), "brightproperty.com");
  eq("blank is null", parseDomain(""), null);

  console.log("\n=== the delete guard ===");
  eq("empty property deletes", propertyDeleteBlocker({ transactions: 0, leases: 0, valuations: 0 }), null);
  // Two automatic valuations must not make a mistyped address undeletable.
  eq("two valuations still delete", propertyDeleteBlocker({ transactions: 0, leases: 0, valuations: 2 }), null);
  ok(
    "a lease blocks and is named",
    (propertyDeleteBlocker({ transactions: 0, leases: 1, valuations: 0 }) ?? "").includes("1 lease"),
  );
  ok(
    "claimed transactions block and are named",
    (propertyDeleteBlocker({ transactions: 9, leases: 0, valuations: 0 }) ?? "").includes("9 claimed transactions"),
  );
  ok(
    "and it points at Archive rather than just refusing",
    (propertyDeleteBlocker({ transactions: 1, leases: 1, valuations: 0 }) ?? "").includes("sold"),
  );

  console.log("\n=== the depreciation blocker ===");
  eq("both present", depreciationBlocker({ landAllocationBasisPoints: 2000, placedInServiceOn: new Date() }), null);
  ok(
    "no land split",
    (depreciationBlocker({ landAllocationBasisPoints: null, placedInServiceOn: new Date() }) ?? "").includes("assessor"),
  );
  ok(
    "no date",
    (depreciationBlocker({ landAllocationBasisPoints: 2000, placedInServiceOn: null }) ?? "").includes("available to rent"),
  );
  ok(
    "neither",
    (depreciationBlocker({ landAllocationBasisPoints: null, placedInServiceOn: null }) ?? "").includes("and"),
  );

  const before = {
    properties: await db.property.count(),
    accounts: await db.account.count(),
  };
  console.log("\n=== the read path ===", before);
  if (before.properties > 0) {
    console.log("Properties already exist. Skipping the database half.");
    process.exit(failed === 0 ? 0 : 1);
  }

  const area = await db.area.findUnique({ where: { slug: "home" }, select: { id: true } });
  const property = await db.property.create({
    data: {
      slug: `${MARK}-4b`,
      label: "Smoke Rental 4B",
      addressLine: "1247 Willow Street",
      city: "Los Angeles",
      state: "CA",
      postalCode: "90042",
      purchasePriceCents: 98_500_000,
      closingCostsCents: 1_840_000,
      purchasedOn: new Date(Date.UTC(2019, 5, 14)),
      landAllocationBasisPoints: 2000,
      placedInServiceOn: new Date(Date.UTC(2019, 7, 1)),
      areaId: area?.id ?? null,
    },
    select: { id: true },
  });

  let views = await getProperties(12);
  eq("one property", views.length, 1);
  // The rule this whole layer turns on: a property with no valuation is worth
  // nothing here, never its purchase price. A house bought in 2019 is not worth
  // what it cost, and quietly saying it is would be a number nobody gave us.
  eq("value is null, not the purchase price", views[0].valueCents, null);
  eq("so equity is null too", views[0].equityCents, null);
  eq("basis = price + closing costs", views[0].basisCents, 100_340_000);
  eq("depreciation is unblocked", views[0].depreciationBlocker, null);
  eq("and it adds nothing to net worth", (await getNetWorth()).propertyCents, 0);

  console.log("\n=== valuation, mortgage, lease ===");
  await db.property.update({
    where: { id: property.id },
    data: {
      valueCents: 118_000_000,
      valueLowCents: 112_000_000,
      valueHighCents: 124_000_000,
      rentEstimateCents: 480_000,
      valuationAt: new Date(),
      valuationSource: "test",
    },
    select: { id: true },
  });

  const mortgage = await db.account.create({
    data: {
      plaidAccountId: `${MARK}-mortgage`,
      name: "Test Mortgage",
      kind: "mortgage",
      plaidType: "loan",
      plaidSubtype: "mortgage",
      currentCents: 62_000_000,
      balanceAt: new Date(),
    },
    select: { id: true },
  });
  await db.loanDetail.create({
    data: {
      accountId: mortgage.id,
      kind: "mortgage",
      ytdInterestCents: 1_230_040,
      interestRatePercent: 3.99,
      propertyAddress: "1247 Willow Street, Los Angeles, CA, 90042",
      refreshedAt: new Date(),
    },
    select: { id: true },
  });

  console.log("\n=== the loan is suggested, never assigned ===");
  const candidates = await getLoanCandidates({
    addressLine: "1247 Willow Street",
    postalCode: "90042",
  });
  eq("the unattached mortgage is a candidate", candidates.length, 1);
  ok("and scores on the address", candidates[0].score > 0, `score ${candidates[0].score.toFixed(2)}`);
  eq("but nothing is attached", await db.propertyLoan.count(), 0);

  await db.propertyLoan.create({
    data: { propertyId: property.id, accountId: mortgage.id, label: "Test Mortgage" },
    select: { id: true },
  });
  eq("once linked it stops being a candidate", (await getLoanCandidates(null)).length, 0);

  await db.lease.create({
    data: {
      propertyId: property.id,
      monthlyRentCents: 420_000,
      startsOn: new Date(Date.UTC(2025, 0, 1)),
      tenantName: "A Tenant",
    },
    select: { id: true },
  });

  views = await getProperties(12);
  const view = views[0];
  eq("equity = value minus owed", view.equityCents, 56_000_000);
  eq("owed comes from the linked account", view.owedCents, 62_000_000);
  eq("the range is shown, not just a point", view.valueRangeLabel, "$1,120,000.00 – $1,240,000.00");
  eq("YTD interest surfaced", view.loans[0].ytdInterestLabel, "$12,300.40");
  eq("the loan reads as live, not by hand", view.loans[0].live, true);
  eq("rent recorded", view.monthlyRentLabel, "$4,200.00");
  eq("market rent is above the lease", view.rentGapLabel, "+$600.00");
  eq("cap rate", view.capRateLabel, "4.3%");

  const worth = await getNetWorth();
  eq("net worth counts the valuation", worth.propertyCents, 118_000_000);
  eq("the mortgage is owed", worth.liabilitiesCents, 62_000_000);
  eq("net = value minus mortgage", worth.totalCents, 56_000_000);

  console.log("\n=== cleanup ===");
  await db.lease.deleteMany({ where: { propertyId: property.id } });
  await db.propertyLoan.deleteMany({ where: { propertyId: property.id } });
  await db.property.deleteMany({ where: { slug: { startsWith: MARK } } });
  await db.loanDetail.deleteMany({});
  await db.account.deleteMany({ where: { plaidAccountId: { startsWith: MARK } } });
  await db.netWorthSnapshot.deleteMany({});
  await db.ledgerJob.deleteMany({});

  const after = {
    properties: await db.property.count(),
    accounts: await db.account.count(),
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
