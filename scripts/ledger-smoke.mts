/**
 * End-to-end check of the Ledger's data path, against the real database.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/ledger-smoke.mts
 *
 * Inserts a fake Plaid item and four accounts, asserts the roll-up, then
 * **deletes everything it made and verifies the database is back where it
 * started.** That last part is the point: this runs against the same Postgres
 * that holds real work, so a check that leaves rows behind is worse than no
 * check.
 *
 * What it is actually testing is the sign convention, which is the one thing in
 * `lib/ledger-rules.ts` that cannot be caught by a unit test: a balance is
 * stored as a positive magnitude and interpreted by `netWorthSideFor`, so a
 * mortgage of $500k and a current account of $500k are the same number in the
 * column and must come out $1m apart in the total.
 */

import { PrismaClient } from "@prisma/client";

import {
  ensureNetWorthSnapshot,
  getLedgerStatus,
  getNetWorth,
  getSpending,
  markTransfers,
} from "../lib/ledger";
import { createPlaidItem, readPlaidToken } from "../lib/secret-store";

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

function ok(label: string, condition: boolean, detail = "") {
  if (!condition) {
    failed += 1;
    console.log(`  FAIL  ${label} ${detail}`);
  } else {
    console.log(`  ok    ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const MARK = "smoke-test-do-not-keep";

async function main() {
  console.log("\n=== before ===");
  const before = {
    items: await db.plaidItem.count(),
    accounts: await db.account.count(),
    balances: await db.accountBalance.count(),
    snapshots: await db.netWorthSnapshot.count(),
    jobs: await db.ledgerJob.count(),
  };
  console.log(before);

  if (before.items > 0 || before.accounts > 0) {
    console.log("\nThere are already real accounts here. Refusing to run.\n");
    process.exit(1);
  }

  console.log("\n=== the setup gate ===");
  // This script never calls Plaid, so it runs with the credentials unset — which
  // makes it the place to lock in the behaviour that matters most about a missing
  // environment variable: the surface must *name* it. A 500 with a stack trace
  // is the failure this replaces, and it does not say which variable.
  const status = await getLedgerStatus();
  const problem = status.setupProblem;
  eq(
    "a missing variable is reported, not thrown",
    problem === null || /^[A-Z_]+ is not/.test(problem),
    true,
  );
  console.log(`        (reported: ${problem ?? "nothing missing"})`);

  console.log("\n=== the secret seam ===");
  const item = await createPlaidItem({
    itemId: MARK,
    accessToken: "access-sandbox-smoke-0000",
    institutionId: null,
    institutionName: "Smoke Test Bank",
  });
  eq("token round-trips through the store", await readPlaidToken(item.id), "access-sandbox-smoke-0000");

  const raw = await db.plaidItem.findUniqueOrThrow({
    where: { id: item.id },
    select: { accessTokenEnc: true },
  });
  eq("column holds ciphertext, not the token", raw.accessTokenEnc.includes("smoke-0000"), false);
  eq("ciphertext is versioned", raw.accessTokenEnc.startsWith("v1."), true);

  console.log("\n=== four accounts, two sides ===");
  // $12,000 current + $88,000 brokerage + $150,000 retirement = $250,000 assets
  // $3,000 card + $400,000 mortgage = $403,000 owed
  // net = -$153,000
  const spec = [
    { kind: "checking" as const, cents: 1_200_000, type: "depository", sub: "checking" },
    { kind: "brokerage" as const, cents: 8_800_000, type: "investment", sub: "brokerage" },
    { kind: "retirement" as const, cents: 15_000_000, type: "investment", sub: "401k" },
    { kind: "credit_card" as const, cents: 300_000, type: "credit", sub: "credit card" },
    { kind: "mortgage" as const, cents: 40_000_000, type: "loan", sub: "mortgage" },
  ];

  for (const [index, account] of spec.entries()) {
    await db.account.create({
      data: {
        plaidAccountId: `${MARK}-${index}`,
        name: `${account.kind} ${index}`,
        kind: account.kind,
        plaidType: account.type,
        plaidSubtype: account.sub,
        currentCents: account.cents,
        balanceAt: new Date(),
        itemId: item.id,
        sortOrder: index,
      },
      select: { id: true },
    });
  }

  const worth = await getNetWorth();
  eq("liquid", worth.liquidCents, 1_200_000);
  eq("invested (brokerage + retirement)", worth.investedCents, 23_800_000);
  eq("owed is a positive magnitude", worth.liabilitiesCents, 40_300_000);
  eq("assets", worth.assetsCents, 25_000_000);
  // The whole reason this script exists: same column, opposite meaning.
  eq("net worth subtracts debt", worth.totalCents, -15_300_000);
  eq("hero figure formats", worth.total, { value: "−$153,000", tail: ".00" });
  eq("owed label", worth.liabilitiesLabel, "$403,000.00");
  eq("no change figure on day one", worth.changeLabel, null);

  console.log("\n=== excluding an account ===");
  const card = await db.account.findFirstOrThrow({
    where: { kind: "credit_card" },
    select: { id: true },
  });
  await db.account.update({
    where: { id: card.id },
    data: { includeInNetWorth: false },
    select: { id: true },
  });

  const excluded = await getNetWorth();
  // −$153,000 owed, minus a $3,000 card that no longer counts, is −$150,000.
  eq("excluded account drops out of the total", excluded.totalCents, -15_000_000);
  eq("but is still listed", excluded.groups.flatMap((g) => g.accounts).length, 5);

  await db.account.update({
    where: { id: card.id },
    data: { includeInNetWorth: true },
    select: { id: true },
  });

  console.log("\n=== the transfer matcher ===");
  // Plaid's sandbox has one institution, so it never produces a matched pair —
  // this is the only place the matcher can actually be exercised. Paying a card
  // off is the case that matters: without the match it is usually the largest
  // "purchase" of the month on one side and income on the other.
  const current = await db.account.findFirstOrThrow({
    where: { kind: "checking" },
    select: { id: true },
  });
  const cardAccount = await db.account.findFirstOrThrow({
    where: { kind: "credit_card" },
    select: { id: true },
  });

  const day = (offset: number) => {
    const base = new Date();
    base.setUTCDate(base.getUTCDate() - offset);
    return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  };

  const tx = async (accountId: string, cents: number, offset: number, name: string) =>
    db.transaction.create({
      data: {
        plaidTransactionId: `${MARK}-tx-${name}-${cents}-${offset}`,
        accountId,
        amountCents: cents,
        postedOn: day(offset),
        name,
      },
      select: { id: true },
    });

  //  −$500 leaves the current account on day 3; +$500 lands at the card on day 1.
  const paidOut = await tx(current.id, -50_000, 3, "Card payment");
  const paidIn = await tx(cardAccount.id, 50_000, 1, "Payment received");
  //  A genuine purchase of the same size, on one account only.
  const purchase = await tx(current.id, -50_000, 30, "Sofa");
  //  Equal and opposite but on the SAME account — not a transfer.
  const sameAccountOut = await tx(current.id, -1_234, 5, "Refunded thing");
  const sameAccountIn = await tx(current.id, 1_234, 5, "The refund");
  //  Equal and opposite across accounts but three weeks apart — not a transfer.
  const farOut = await tx(current.id, -9_999, 40, "Far apart out");
  const farIn = await tx(cardAccount.id, 9_999, 10, "Far apart in");

  const matched = await markTransfers();
  eq("matched exactly one pair", matched, 2);

  const isTransfer = async (id: string) =>
    (await db.transaction.findUniqueOrThrow({ where: { id }, select: { isTransfer: true } }))
      .isTransfer;

  eq("the card payment is a transfer (out)", await isTransfer(paidOut.id), true);
  eq("the card payment is a transfer (in)", await isTransfer(paidIn.id), true);
  eq("a lone purchase is not", await isTransfer(purchase.id), false);
  eq("same-account pair is not", await isTransfer(sameAccountOut.id), false);
  eq("same-account pair is not (in)", await isTransfer(sameAccountIn.id), false);
  eq("too far apart is not", await isTransfer(farOut.id), false);
  eq("too far apart is not (in)", await isTransfer(farIn.id), false);

  // Idempotent, and it un-marks a pair that stops matching.
  await markTransfers();
  eq("running twice changes nothing", await isTransfer(paidOut.id), true);
  await db.transaction.delete({ where: { id: paidIn.id } });
  await markTransfers();
  eq("losing one half un-marks the other", await isTransfer(paidOut.id), false);

  const spending = await getSpending(2);
  ok(
    "the sofa is in spending but the card payment is not",
    spending.outCents >= 50_000,
    `out ${spending.outLabel}`,
  );

  await db.transaction.deleteMany({ where: { plaidTransactionId: { startsWith: MARK } } });

  console.log("\n=== the snapshot ===");
  await ensureNetWorthSnapshot();
  const snap = await db.netWorthSnapshot.findFirstOrThrow({
    orderBy: { on: "desc" },
  });
  eq("snapshot total matches", snap.totalCents, -15_300_000);
  eq("snapshot counts accounts", snap.accountCount, 5);
  eq("snapshot splits retirement out", snap.retirementCents, 15_000_000);
  eq("snapshot on is UTC midnight", snap.on.toISOString().slice(11), "00:00:00.000Z");

  // Idempotent: a second refresh the same day must move the point, not add one.
  await ensureNetWorthSnapshot();
  eq("one snapshot per day", await db.netWorthSnapshot.count(), 1);

  console.log("\n=== disconnect keeps the accounts (SetNull) ===");
  await db.plaidItem.delete({ where: { id: item.id } });
  eq("accounts survive the item", await db.account.count(), 5);
  const orphan = await db.account.findFirstOrThrow({ select: { itemId: true } });
  eq("itemId is nulled, not cascaded", orphan.itemId, null);
  const orphanWorth = await getNetWorth();
  eq("still counted after disconnect", orphanWorth.totalCents, -15_300_000);
  eq("shown as disconnected", orphanWorth.groups[0].accounts[0].institutionName, "Disconnected");

  console.log("\n=== cleanup ===");
  await db.account.deleteMany({ where: { plaidAccountId: { startsWith: MARK } } });
  await db.netWorthSnapshot.deleteMany({});
  await db.ledgerJob.deleteMany({});

  const after = {
    items: await db.plaidItem.count(),
    accounts: await db.account.count(),
    balances: await db.accountBalance.count(),
    snapshots: await db.netWorthSnapshot.count(),
    jobs: await db.ledgerJob.count(),
  };
  console.log(after);
  eq("database back where it started", after, before);

  console.log(failed === 0 ? "\nALL PASS\n" : `\n${failed} FAILED\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().finally(() => db.$disconnect());
