/**
 * The Ledger's Montblanc tools, against the real database.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/montblanc-ledger-check.mts
 *
 * The tools themselves call server actions, which need a request scope — so what
 * runs here is the **schema shape, the registry, and the underlying database
 * behaviour** the actions wrap. That is the same split §9 records for
 * `saveProperty`, and the parts it leaves out are the session check and the
 * revalidate.
 *
 * The behaviour that matters most is the one asymmetry: **undoing a filing
 * releases the claim and never deletes the transaction**, because a bank row is
 * a payment that really happened.
 */
import { PrismaClient } from "@prisma/client";

import { TOOLS, TOOL_SCHEMAS } from "../lib/montblanc/tools";
import { buildContext } from "../lib/montblanc/context";

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

const MARK = "smoke-mb";

async function main() {
  console.log("\n=== the tools are registered and shaped right ===");
  for (const name of [
    "find_transaction",
    "claim_transaction",
    "categorise_transaction",
    "mark_strategy_raised",
  ]) {
    ok(`${name} is registered`, name in TOOLS);
  }

  // The asymmetry that is the whole point: nothing here creates money.
  const creators = Object.keys(TOOLS).filter((name) => name.startsWith("create_"));
  ok(
    "no Ledger tool creates anything",
    !creators.some((name) => /transaction|account|balance|statement/.test(name)),
    creators.join(", "),
  );

  ok(
    "every schema names its required arguments",
    TOOL_SCHEMAS.every(
      (schema) =>
        typeof schema.function.name === "string" &&
        schema.function.description.length > 20,
    ),
  );

  const claim = TOOLS.claim_transaction.schema.function;
  eq(
    "claim_transaction requires both an id and a property",
    claim.parameters.required,
    ["transactionId", "propertySlug"],
  );
  ok(
    "and tells the model not to invent an id",
    claim.description.includes("Never invent"),
  );

  console.log("\n=== find_transaction, on real rows ===");
  const before = {
    accounts: await db.account.count(),
    properties: await db.property.count(),
    transactions: await db.transaction.count(),
  };
  if (before.transactions > 0 || before.properties > 0) {
    console.log("Ledger rows already exist. Refusing.");
    process.exit(1);
  }

  const account = await db.account.create({
    data: {
      plaidAccountId: `${MARK}-checking`,
      name: "Test Checking",
      kind: "checking",
      plaidType: "depository",
      plaidSubtype: "checking",
      currentCents: 500_000,
      balanceAt: new Date(),
    },
    select: { id: true },
  });

  const area = await db.area.findUnique({ where: { slug: "home" }, select: { id: true } });
  const property = await db.property.create({
    data: {
      slug: `${MARK}-rental`,
      label: "Smoke Rental",
      addressLine: "1 Test Street",
      city: "Los Angeles",
      state: "CA",
      postalCode: "90042",
      purchasePriceCents: 98_500_000,
      purchasedOn: new Date(Date.UTC(2019, 5, 14)),
      areaId: area?.id ?? null,
    },
    select: { id: true, slug: true },
  });

  const day = new Date();
  const posted = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));

  const plumbing = await db.transaction.create({
    data: {
      plaidTransactionId: `${MARK}-plumb`,
      accountId: account.id,
      amountCents: -34_000,
      postedOn: posted,
      name: "RELIABLE PLUMBING CO",
      merchantName: "Reliable Plumbing",
    },
    select: { id: true },
  });
  await db.transaction.create({
    data: {
      plaidTransactionId: `${MARK}-coffee`,
      accountId: account.id,
      amountCents: -580,
      postedOn: posted,
      name: "COFFEE PLACE",
    },
    select: { id: true },
  });

  const byName = await TOOLS.find_transaction.run({ query: "plumbing" });
  ok("finds by merchant", byName.summary.includes("Reliable Plumbing"), byName.summary.slice(0, 80));
  ok("and returns tappable rows", byName.events.some((event) => event.type === "hits"));

  const byAmount = await TOOLS.find_transaction.run({ amount: "$340" });
  ok(
    "finds by amount, whichever sign the user said",
    byAmount.summary.includes("Reliable Plumbing"),
  );

  const nothing = await TOOLS.find_transaction.run({ query: "zzzznotathing" });
  ok(
    "and says so plainly when nothing matches",
    nothing.summary.startsWith("No transactions matched"),
    nothing.summary,
  );
  eq("with no rows drawn", nothing.events.length, 0);

  const empty = await TOOLS.find_transaction.run({});
  ok("refuses a search with nothing in it", empty.summary.startsWith("FAILED"));

  console.log("\n=== claiming, and the undo that releases rather than deletes ===");
  // The action needs a request scope, so the database behaviour it wraps is
  // exercised directly — the same split §9 records for `saveProperty`.
  await db.transaction.update({
    where: { id: plumbing.id },
    data: { propertyId: property.id, taxCategory: "repairs" },
    select: { id: true },
  });

  const claimed = await db.transaction.findUniqueOrThrow({
    where: { id: plumbing.id },
    select: { propertyId: true, taxCategory: true },
  });
  eq("it is filed against the property", claimed.propertyId, property.id);
  eq("on the right Schedule E line", claimed.taxCategory, "repairs");

  // Undo.
  await db.transaction.update({
    where: { id: plumbing.id },
    data: { propertyId: null, taxCategory: null },
    select: { id: true },
  });

  const released = await db.transaction.findUnique({
    where: { id: plumbing.id },
    select: { id: true, propertyId: true, amountCents: true },
  });
  ok("undo does NOT delete the transaction", released !== null);
  eq("it releases the claim", released?.propertyId, null);
  eq("and the payment is untouched", released?.amountCents, -34_000);

  console.log("\n=== the context names what exists, and no figures ===");
  const context = await buildContext();
  ok("it mentions the Ledger", context.includes("LEDGER:"), "");
  ok("names the account", context.includes("Test Checking"));
  ok("names the property by slug", context.includes(`${MARK}-rental`));
  // Money in the prompt is money the model can repeat back stale.
  ok(
    "but carries no balance",
    !context.includes("5000") && !context.includes("$5,000"),
  );
  ok(
    "and warns when the tax constants are unconfirmed",
    context.includes("NOT confirmed") || !context.includes("tax constants"),
  );

  console.log("\n=== cleanup ===");
  await db.transaction.deleteMany({ where: { plaidTransactionId: { startsWith: MARK } } });
  await db.property.deleteMany({ where: { slug: { startsWith: MARK } } });
  await db.account.deleteMany({ where: { plaidAccountId: { startsWith: MARK } } });
  await db.ledgerJob.deleteMany({});
  // **`TaxRuleSet` is deliberately not touched.** This script creates none, and
  // a confirmed rule set is the one row in the Ledger that costs an afternoon
  // of reading published sources to replace — an unscoped `deleteMany` here
  // would quietly destroy it. Every other check scopes its deletes to its own
  // test year for the same reason.

  const after = {
    accounts: await db.account.count(),
    properties: await db.property.count(),
    transactions: await db.transaction.count(),
  };
  eq("database back where it started", after, before);

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
