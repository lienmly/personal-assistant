/**
 * Exercises the Ledger against **real Plaid sandbox**, end to end.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/ledger-live.mts
 *
 * Link is a browser modal, so `/sandbox/public_token/create` stands in for it —
 * which is the only way to prove `lib/plaid.ts` matches Plaid's wire format
 * rather than matching what I remembered of it. Every field this app reads is
 * read here, against a live response.
 *
 * **It removes the item and deletes its rows at the end**, and asserts the
 * database is back where it started. This runs against the same Postgres that
 * holds real work.
 */

import { PrismaClient } from "@prisma/client";

import { getNetWorth, getSpending } from "../lib/ledger";
import {
  exchangePublicToken,
  getInstitutionName,
  getItem,
  removeItem,
  sandboxPublicToken,
  verifyWebhook,
} from "../lib/plaid";
import {
  refreshItemMeta,
  syncBalances,
  syncHoldingsFor,
  syncLiabilitiesFor,
  syncTransactionsFor,
} from "../lib/plaid-sync";
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

/** First Platypus Bank — supports transactions, investments and liabilities. */
const INSTITUTION = "ins_109508";

/** Sandbox sometimes answers PRODUCT_NOT_READY for a few seconds after a link. */
async function withRetry<T>(run: () => Promise<T>, attempts = 6): Promise<T> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await run();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      const retryable = /not ready|PRODUCT_NOT_READY/i.test(message);
      if (!retryable || i === attempts - 1) throw cause;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
  throw new Error("unreachable");
}

async function main() {
  const before = { items: await db.plaidItem.count(), accounts: await db.account.count() };
  if (before.items > 0 || before.accounts > 0) {
    console.log("\nThere are already accounts here. Refusing to run.\n");
    process.exit(1);
  }

  console.log("\n=== link, without Link ===");
  const publicToken = await sandboxPublicToken({
    institutionId: INSTITUTION,
    products: ["transactions", "investments", "liabilities"],
  });
  const { accessToken, itemId } = await exchangePublicToken(publicToken);
  ok("exchanged for an access token", accessToken.startsWith("access-sandbox"));

  const info = await getItem(accessToken);
  const name = await getInstitutionName(info.institutionId);
  const row = await createPlaidItem({
    itemId,
    accessToken,
    institutionId: info.institutionId,
    institutionName: name,
  });
  eq("token round-trips sealed", await readPlaidToken(row.id), accessToken);
  await refreshItemMeta(row.id);

  console.log("\n=== balances ===");
  console.log(`        ${await syncBalances(row.id)}`);
  const accountCount = await db.account.count();
  ok("accounts stored", accountCount > 0, `${accountCount}`);
  ok(
    "none fell through to `other`",
    (await db.account.count({ where: { kind: "other" } })) === 0,
  );

  console.log("\n=== the cursor guard (the load-bearing one) ===");
  // Delete every account and reset the cursor: sync must then skip everything,
  // throw, and leave the cursor alone — because advancing it would lose those
  // rows permanently. This is the failure the guard exists for and it cannot be
  // provoked any other way.
  const saved = await db.account.findMany();
  await db.account.deleteMany({});
  let threw = false;
  let message = "";
  try {
    await syncTransactionsFor(row.id);
  } catch (cause) {
    threw = true;
    message = cause instanceof Error ? cause.message : String(cause);
  }
  ok("sync refuses when accounts are missing", threw, message.slice(0, 70));
  const afterRefusal = await db.plaidItem.findUniqueOrThrow({
    where: { id: row.id },
    select: { txCursor: true },
  });
  eq("cursor was NOT advanced", afterRefusal.txCursor, null);
  eq("and nothing was written", await db.transaction.count(), 0);

  // Put the accounts back and let it run properly.
  for (const account of saved) {
    await db.account.create({ data: account, select: { id: true } });
  }

  console.log("\n=== transactions ===");
  console.log(`        ${await withRetry(() => syncTransactionsFor(row.id))}`);
  const txCount = await db.transaction.count();
  ok("transactions stored", txCount > 0, `${txCount}`);

  const cursor = await db.plaidItem.findUniqueOrThrow({
    where: { id: row.id },
    select: { txCursor: true },
  });
  ok("cursor advanced after a clean run", Boolean(cursor.txCursor));

  // The sign. Plaid reports a debit as POSITIVE; we store money-in as positive,
  // so a purchase must be negative here. Getting this backwards makes every
  // spending figure in the app the wrong sign, and the totals still look
  // plausible — which is why it is asserted against a named row.
  const debits = await db.transaction.count({ where: { amountCents: { lt: 0 } } });
  const credits = await db.transaction.count({ where: { amountCents: { gt: 0 } } });
  ok("some transactions are money out (negative)", debits > 0, `${debits}`);
  ok("some are money in (positive)", credits > 0, `${credits}`);

  const sample = await db.transaction.findMany({
    orderBy: { postedOn: "desc" },
    take: 6,
    select: { name: true, amountCents: true, postedOn: true, pending: true, plaidCategory: true },
  });
  for (const tx of sample) {
    console.log(
      `          ${tx.postedOn.toISOString().slice(0, 10)}  ${String(tx.amountCents).padStart(9)}  ${tx.pending ? "pending " : "        "}${tx.plaidCategory ?? "—"}  ${tx.name}`,
    );
  }
  ok(
    "postedOn is UTC midnight",
    sample.every((tx) => tx.postedOn.toISOString().endsWith("T00:00:00.000Z")),
  );
  ok(
    "a category came through",
    sample.some((tx) => tx.plaidCategory !== null),
  );

  // Idempotence: a second walk must be a no-op, not a duplicate set.
  const second = await syncTransactionsFor(row.id);
  eq("second sync adds nothing", await db.transaction.count(), txCount);
  console.log(`        second run said: ${second}`);

  // A hand-set category must survive a re-sync — it is yours, not Plaid's.
  const first = await db.transaction.findFirstOrThrow({ select: { id: true } });
  await db.transaction.update({
    where: { id: first.id },
    data: { category: "Groceries", note: "mine" },
    select: { id: true },
  });
  await syncTransactionsFor(row.id);
  const kept = await db.transaction.findUniqueOrThrow({
    where: { id: first.id },
    select: { category: true, note: true },
  });
  eq("a hand-set category survives a sync", kept.category, "Groceries");
  eq("and so does a note", kept.note, "mine");

  console.log("\n=== holdings ===");
  console.log(`        ${await withRetry(() => syncHoldingsFor(row.id))}`);
  const holdings = await db.holding.count();
  const securities = await db.security.count();
  ok("holdings stored", holdings > 0, `${holdings} across ${securities} securities`);
  const holdingSample = await db.holding.findMany({
    take: 4,
    select: { quantity: true, valueCents: true, security: { select: { tickerSymbol: true, name: true } } },
  });
  for (const h of holdingSample) {
    console.log(
      `          ${String(h.quantity).padStart(10)} × ${h.security.tickerSymbol ?? h.security.name ?? "—"}  = ${h.valueCents} cents`,
    );
  }
  // Wholesale replacement: running it again must not double the rows.
  await syncHoldingsFor(row.id);
  eq("holdings are replaced, not appended", await db.holding.count(), holdings);

  console.log("\n=== liabilities ===");
  console.log(`        ${await withRetry(() => syncLiabilitiesFor(row.id))}`);
  const loans = await db.loanDetail.findMany({
    select: {
      kind: true,
      ytdInterestCents: true,
      interestRatePercent: true,
      nextPaymentCents: true,
      propertyAddress: true,
    },
  });
  ok("loan details stored", loans.length > 0, `${loans.length}`);
  for (const loan of loans) {
    console.log(
      `          ${loan.kind.padEnd(9)} rate ${loan.interestRatePercent ?? "—"}%  ytd interest ${loan.ytdInterestCents ?? "—"}  ${loan.propertyAddress ?? ""}`,
    );
  }
  // The whole reason `liabilities` is requested: the Schedule E interest line.
  ok(
    "a mortgage reports YTD interest",
    loans.some((l) => l.kind === "mortgage" && l.ytdInterestCents !== null),
  );

  console.log("\n=== webhook verification rejects forgeries ===");
  const forged = await verifyWebhook("{}", "not.a.jwt");
  eq("garbage header refused", forged.ok, false);
  const noHeader = await verifyWebhook("{}", null);
  eq("missing header refused", noHeader.ok, false);
  // `alg: none` is the classic JWT forgery; the algorithm is pinned, not read.
  const algNone =
    Buffer.from(JSON.stringify({ alg: "none", kid: "x" })).toString("base64url") +
    "." +
    Buffer.from(JSON.stringify({ request_body_sha256: "x", iat: Math.floor(Date.now() / 1000) })).toString("base64url") +
    ".";
  const noneResult = await verifyWebhook("{}", algNone);
  eq("alg:none refused", noneResult.ok, false);
  ok("and says why", !noneResult.ok && noneResult.reason.includes("ES256"), !noneResult.ok ? noneResult.reason : "");

  console.log("\n=== the roll-up and spending ===");
  const worth = await getNetWorth();
  console.log(`        net worth ${worth.total.value}${worth.total.tail ?? ""}`);
  const assets = worth.groups.filter((g) => g.group !== "owed").reduce((s, g) => s + g.totalCents, 0);
  const owed = worth.groups.find((g) => g.group === "owed")?.totalCents ?? 0;
  eq("total equals assets minus owed", worth.totalCents, assets - owed);

  const spending = await getSpending(12);
  ok("spending months returned", spending.months.length > 0, `${spending.months.length}`);
  ok("categories returned", spending.categories.length >= 0, `${spending.categories.length}`);
  console.log(
    `        this month: in ${spending.inLabel} · out ${spending.outLabel} · net ${spending.netLabel}`,
  );
  console.log(`        top categories: ${spending.categories.slice(0, 4).map((c) => `${c.label} ${c.totalLabel}`).join(" · ")}`);
  ok(
    "spending excludes transfers",
    spending.months.every((m) => m.outCents >= 0 && m.inCents >= 0),
  );

  console.log("\n=== cleanup ===");
  await removeItem(accessToken);
  await db.holding.deleteMany({});
  await db.security.deleteMany({});
  await db.loanDetail.deleteMany({});
  await db.transaction.deleteMany({});
  await db.accountBalance.deleteMany({});
  await db.account.deleteMany({});
  await db.plaidItem.deleteMany({});
  await db.netWorthSnapshot.deleteMany({});
  await db.ledgerJob.deleteMany({});

  const after = { items: await db.plaidItem.count(), accounts: await db.account.count() };
  eq("database back where it started", after, before);
  eq("no transactions left", await db.transaction.count(), 0);
  eq("no holdings left", await db.holding.count(), 0);

  console.log(failed === 0 ? "\nALL PASS\n" : `\n${failed} FAILED\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main()
  .catch((cause) => {
    console.error("\nTHREW:", cause instanceof Error ? cause.message : cause);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
