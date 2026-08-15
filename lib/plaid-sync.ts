import { db } from "@/lib/db";
import { markTransfers } from "@/lib/ledger";
import { kindFromPlaid } from "@/lib/ledger-rules";
import {
  PlaidError,
  getBalances,
  getHoldings,
  getInstitutionName,
  getItem,
  getLiabilities,
  syncTransactions,
  type PlaidAccount,
  type PlaidTransaction,
} from "@/lib/plaid";
import { readPlaidToken } from "@/lib/secret-store";

/**
 * Plaid in, database out.
 *
 * The boundary where every convention in `lib/ledger-rules.ts` is applied
 * exactly once. Nothing downstream of this file knows that Plaid exists, and
 * nothing upstream of it knows what an `AccountKind` is — which is what makes
 * "swap the aggregator" a rewrite of two files rather than a search across the
 * app.
 *
 * Every function here is **idempotent**. They are called from a job runner with
 * retries, from a webhook that Plaid may deliver twice, and from a page load
 * that may race another tab, so running one twice must be indistinguishable from
 * running it once.
 */

/** Today as a *local* calendar day pushed to UTC midnight, for `@db.Date`.
 *  Same rule and same shape as `todayAsDate` in `lib/journal-actions.ts` —
 *  CLAUDE.md §6, "Dates are a trap here". */
function todayAsDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/**
 * Record what Plaid says about an item's health.
 *
 * Called after every failure as well as on the webhook, because an item that has
 * gone bad mid-sync must show up on the connections page rather than only in a
 * job's `error` column. `login_required` is the one state a human has to fix in
 * person, and the sync strip reads this to say so.
 */
export async function markItemStatus(
  itemRowId: string,
  status: string,
  detail: string | null,
): Promise<void> {
  await db.plaidItem.update({
    where: { id: itemRowId },
    data: { status, statusDetail: detail },
    select: { id: true },
  });
}

/** Plaid's error codes → the item states the connections page renders.
 *  Anything unrecognised stays `good`, because a transient network failure is
 *  not a broken credential and marking it as one sends you to re-link a bank
 *  that was fine. */
function statusForError(code: string): string | null {
  switch (code) {
    case "ITEM_LOGIN_REQUIRED":
      return "login_required";
    case "PENDING_EXPIRATION":
    case "PENDING_DISCONNECT":
      return "pending_expiration";
    case "USER_PERMISSION_REVOKED":
    case "USER_ACCOUNT_REVOKED":
      return "revoked";
    case "ITEM_NOT_FOUND":
      return "removed";
    default:
      return null;
  }
}

/**
 * Run a Plaid call and translate a credential failure into an item status.
 *
 * The alternative — letting a `PlaidError` escape to the job runner — records
 * the failure in the job log, which nobody reads, and leaves the item saying
 * `good` on the one page that exists to tell you a bank needs attention.
 */
async function withItemStatus<T>(
  itemRowId: string,
  run: () => Promise<T>,
): Promise<T> {
  try {
    const result = await run();
    await db.plaidItem.update({
      where: { id: itemRowId },
      data: { status: "good", statusDetail: null },
      select: { id: true },
    });
    return result;
  } catch (cause) {
    if (cause instanceof PlaidError) {
      const status = statusForError(cause.code);
      if (status) await markItemStatus(itemRowId, status, cause.message);
    }
    throw cause;
  }
}

/**
 * Write Plaid's account list into `Account`, and today's figures into
 * `AccountBalance`.
 *
 * Two things happen here that are easy to get wrong:
 *
 * **`kind` is set on create only.** Re-deriving it on every sync would undo a
 * hand correction the next time the job ran, and the whole reason the raw
 * `plaidType`/`plaidSubtype` pair is stored is so a mapping fix can be applied
 * deliberately, as a re-derive, rather than silently every fifteen minutes. The
 * same rule the seed's `update: {}` follows for a project's tier (§6, "The
 * roster is the editor"): once a column is editable in the app, it is a
 * decision.
 *
 * **The balance row is upserted on `[accountId, on]`, not created.** Syncing
 * twice in a day is normal — a webhook, then a page load — and the honest
 * meaning of the column is "what it was when last seen today", so the second
 * write replaces the first instead of failing or accumulating.
 */
export async function syncBalances(itemRowId: string): Promise<string> {
  const token = await readPlaidToken(itemRowId);
  if (!token) throw new Error("No such Plaid item.");

  const accounts = await withItemStatus(itemRowId, () => getBalances(token));
  const on = todayAsDate();

  for (const [index, account] of accounts.entries()) {
    await upsertAccount(itemRowId, account, index);
  }

  const rows = await db.account.findMany({
    where: { itemId: itemRowId },
    select: { id: true, currentCents: true },
  });

  for (const row of rows) {
    if (row.currentCents === null) continue;
    await db.accountBalance.upsert({
      where: { accountId_on: { accountId: row.id, on } },
      update: { currentCents: row.currentCents },
      create: { accountId: row.id, on, currentCents: row.currentCents },
      select: { id: true },
    });
  }

  await db.plaidItem.update({
    where: { id: itemRowId },
    data: { lastSyncedAt: new Date() },
    select: { id: true },
  });

  return `Refreshed ${accounts.length} ${accounts.length === 1 ? "account" : "accounts"}.`;
}

async function upsertAccount(
  itemRowId: string,
  account: PlaidAccount,
  sortOrder: number,
): Promise<void> {
  const shared = {
    name: account.name,
    officialName: account.officialName,
    mask: account.mask,
    plaidType: account.type,
    plaidSubtype: account.subtype,
    currency: account.currency,
    currentCents: account.currentCents,
    availableCents: account.availableCents,
    limitCents: account.limitCents,
    balanceAt: new Date(),
    itemId: itemRowId,
  };

  await db.account.upsert({
    where: { plaidAccountId: account.accountId },
    update: shared,
    create: {
      ...shared,
      plaidAccountId: account.accountId,
      kind: kindFromPlaid(account.type, account.subtype),
      sortOrder,
    },
    select: { id: true },
  });
}

/** "YYYY-MM-DD" → UTC midnight, for a `@db.Date`. Plaid sends bare dates in the
 *  institution's own timezone; they stand for a calendar day, so they take the
 *  same treatment as `Task.dueDate` (CLAUDE.md §6). */
function dateOnly(value: string | null): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Walk `/transactions/sync` to the end of its cursor.
 *
 * Three things here are not obvious and each is a way the numbers go wrong:
 *
 * 1. **The cursor is saved only after the whole walk succeeds.** Saving per page
 *    would look more robust and is the opposite: a failure halfway through would
 *    leave the cursor advanced past transactions that were never written, and
 *    because sync only ever reports *changes*, those rows would never be offered
 *    again. Re-fetching a page is cheap; a permanently missing week is not.
 * 2. **A transaction whose account is unknown is skipped, not created.** A
 *    holding account arrives from `/accounts/balance/get`, and if sync runs
 *    first Plaid can mention an account this app has never seen. Inventing an
 *    `Account` row from a transaction would give it no kind and no balance, and
 *    it would sit in the net worth as a zero.
 * 3. **`removed` is a real delete.** Plaid removes a transaction when the
 *    institution retracts it; leaving it would keep a purchase that did not
 *    happen in every total that follows.
 */
export async function syncTransactionsFor(itemRowId: string): Promise<string> {
  const token = await readPlaidToken(itemRowId);
  if (!token) throw new Error("No such Plaid item.");

  const item = await db.plaidItem.findUniqueOrThrow({
    where: { id: itemRowId },
    select: { txCursor: true },
  });

  let cursor = item.txCursor;
  let added = 0;
  let modified = 0;
  let removed = 0;
  let skipped = 0;
  // Sync can, in principle, page forever if a cursor never advances. Bounded so
  // a bug at Plaid's end costs a truncated sync rather than a hung job.
  let pages = 0;

  await withItemStatus(itemRowId, async () => {
    for (;;) {
      const page = await syncTransactions(token, cursor);

      for (const tx of [...page.added, ...page.modified]) {
        const written = await writeTransaction(tx);
        if (written === "added") added += 1;
        else if (written === "modified") modified += 1;
        else skipped += 1;
      }

      if (page.removed.length > 0) {
        const result = await db.transaction.deleteMany({
          where: { plaidTransactionId: { in: page.removed } },
        });
        removed += result.count;
      }

      cursor = page.cursor;
      pages += 1;
      if (!page.hasMore || pages >= 50) break;
    }
  });

  // **The cursor is not advanced if anything was skipped**, and this is the
  // load-bearing line in the whole file.
  //
  // A transaction is skipped when its account has not been seen yet — the
  // balance refresh creates `Account` rows, and on a brand-new item the two jobs
  // are queued together. Insertion order is *not* a guarantee: `drain` orders by
  // `runAfter`, and jobs enqueued in the same millisecond share one. So sync can
  // genuinely run first.
  //
  // Advancing the cursor anyway is unrecoverable. `/transactions/sync` only ever
  // reports what *changed*, so a row skipped once is never offered again — a
  // permanently missing week that nothing in the app could detect, in the data
  // the tax figures are computed from. Throwing instead leaves the cursor where
  // it was; the job retries with backoff, the balance refresh has run by then,
  // and Plaid re-offers every row.
  if (skipped > 0) {
    throw new Error(
      `${skipped} ${skipped === 1 ? "transaction belongs" : "transactions belong"} to an account that has not synced yet. Leaving the cursor where it was so they are offered again.`,
    );
  }

  await db.plaidItem.update({
    where: { id: itemRowId },
    data: { txCursor: cursor, lastSyncedAt: new Date() },
    select: { id: true },
  });

  await dropSupersededPending();

  // Re-run over the whole recent window rather than only the new rows: a
  // transfer's two halves usually arrive on different days and often from
  // different institutions, so the match for a row written last week may only
  // become possible now.
  await markTransfers();

  const parts = [
    added > 0 ? `${added} new` : null,
    modified > 0 ? `${modified} updated` : null,
    removed > 0 ? `${removed} removed` : null,
  ].filter(Boolean);

  return parts.length > 0
    ? `Synced ${parts.join(", ")}.`
    : "Nothing new to sync.";
}

async function writeTransaction(
  tx: PlaidTransaction,
): Promise<"added" | "modified" | "skipped"> {
  const account = await db.account.findUnique({
    where: { plaidAccountId: tx.accountId },
    select: { id: true },
  });
  // See rule 2 above: an account we have not seen yet is skipped. The next
  // balance refresh creates it, and the next sync — which re-offers nothing —
  // is why `plaid_balances` is queued *before* `plaid_sync` on a new item.
  if (!account) return "skipped";

  const postedOn = dateOnly(tx.postedOn);
  if (!postedOn) return "skipped";

  const shared = {
    accountId: account.id,
    amountCents: tx.amountCents,
    postedOn,
    authorizedOn: dateOnly(tx.authorizedOn),
    pending: tx.pending,
    pendingPlaidId: tx.pendingPlaidId,
    name: tx.name,
    merchantName: tx.merchantName,
    website: tx.website,
    plaidCategory: tx.category,
    plaidCategoryDetail: tx.categoryDetail,
  };

  const existing = await db.transaction.findUnique({
    where: { plaidTransactionId: tx.transactionId },
    select: { id: true },
  });

  await db.transaction.upsert({
    where: { plaidTransactionId: tx.transactionId },
    // `category` and `note` are deliberately absent from the update: they are
    // *yours*, and a re-sync must not overwrite a category you set by hand. Same
    // rule as `Account.kind` and as the seed's `update: {}` (§6).
    update: shared,
    create: { ...shared, plaidTransactionId: tx.transactionId },
    select: { id: true },
  });

  return existing ? "modified" : "added";
}

/**
 * Delete the pending row that a posted transaction replaces.
 *
 * When a pending charge posts, Plaid issues a **new** transaction with a new id
 * and points `pending_transaction_id` at the old one — it does not modify the
 * original. Left alone, both sit in the ledger and every total counts the
 * purchase twice, which is the single most common way a spending figure goes
 * wrong and is invisible unless you go looking for the pair.
 */
async function dropSupersededPending(): Promise<void> {
  const superseded = await db.transaction.findMany({
    where: { pending: false, pendingPlaidId: { not: null } },
    select: { pendingPlaidId: true },
  });

  const ids = superseded
    .map((row) => row.pendingPlaidId)
    .filter((id): id is string => id !== null);

  if (ids.length === 0) return;

  await db.transaction.deleteMany({
    where: { plaidTransactionId: { in: ids }, pending: true },
  });
}

/**
 * Positions, replaced wholesale.
 *
 * A holding is a *present fact*, not a log: Plaid returns the current position
 * set, so anything it did not return has been sold. Upserting without the delete
 * would leave a sold stock quietly in the net worth forever.
 */
export async function syncHoldingsFor(itemRowId: string): Promise<string> {
  const token = await readPlaidToken(itemRowId);
  if (!token) throw new Error("No such Plaid item.");

  const { securities, holdings, accounts } = await withItemStatus(
    itemRowId,
    () => getHoldings(token),
  );

  // Investment accounts can arrive here that the balance call did not return.
  for (const [index, account] of accounts.entries()) {
    await upsertAccount(itemRowId, account, index);
  }

  const securityIdByPlaidId = new Map<string, string>();
  for (const security of securities) {
    const row = await db.security.upsert({
      where: { plaidSecurityId: security.securityId },
      update: {
        tickerSymbol: security.tickerSymbol,
        name: security.name,
        type: security.type,
        closePriceCents: security.closePriceCents,
        closePriceOn: dateOnly(security.closePriceOn),
        isCashEquivalent: security.isCashEquivalent,
      },
      create: {
        plaidSecurityId: security.securityId,
        tickerSymbol: security.tickerSymbol,
        name: security.name,
        type: security.type,
        closePriceCents: security.closePriceCents,
        closePriceOn: dateOnly(security.closePriceOn),
        isCashEquivalent: security.isCashEquivalent,
      },
      select: { id: true },
    });
    securityIdByPlaidId.set(security.securityId, row.id);
  }

  const asOf = new Date();
  const touched: string[] = [];
  const accountIds = new Set<string>();

  for (const holding of holdings) {
    const account = await db.account.findUnique({
      where: { plaidAccountId: holding.accountId },
      select: { id: true },
    });
    const securityId = securityIdByPlaidId.get(holding.securityId);
    if (!account || !securityId) continue;

    accountIds.add(account.id);

    const row = await db.holding.upsert({
      where: {
        accountId_securityId: { accountId: account.id, securityId },
      },
      update: {
        quantity: holding.quantity,
        costBasisCents: holding.costBasisCents,
        priceCents: holding.priceCents,
        valueCents: holding.valueCents,
        asOf,
      },
      create: {
        accountId: account.id,
        securityId,
        quantity: holding.quantity,
        costBasisCents: holding.costBasisCents,
        priceCents: holding.priceCents,
        valueCents: holding.valueCents,
        asOf,
      },
      select: { id: true },
    });
    touched.push(row.id);
  }

  // Only within the accounts this sync actually reported on — deleting across
  // every account would wipe the positions of an item that was not synced.
  if (accountIds.size > 0) {
    await db.holding.deleteMany({
      where: {
        accountId: { in: [...accountIds] },
        id: { notIn: touched.length > 0 ? touched : ["-"] },
      },
    });
  }

  return `Refreshed ${touched.length} ${touched.length === 1 ? "holding" : "holdings"}.`;
}

/** Loan details, including the mortgage-interest figure the Schedule E needs. */
export async function syncLiabilitiesFor(itemRowId: string): Promise<string> {
  const token = await readPlaidToken(itemRowId);
  if (!token) throw new Error("No such Plaid item.");

  const loans = await withItemStatus(itemRowId, () => getLiabilities(token));
  const refreshedAt = new Date();
  let written = 0;

  for (const loan of loans) {
    const account = await db.account.findUnique({
      where: { plaidAccountId: loan.accountId },
      select: { id: true },
    });
    if (!account) continue;

    const shared = {
      kind: loan.kind,
      originationOn: dateOnly(loan.originationOn),
      originationPrincipalCents: loan.originationPrincipalCents,
      interestRatePercent: loan.interestRatePercent,
      interestRateType: loan.interestRateType,
      maturityOn: dateOnly(loan.maturityOn),
      nextPaymentDueOn: dateOnly(loan.nextPaymentDueOn),
      nextPaymentCents: loan.nextPaymentCents,
      escrowBalanceCents: loan.escrowBalanceCents,
      ytdInterestCents: loan.ytdInterestCents,
      ytdPrincipalCents: loan.ytdPrincipalCents,
      propertyAddress: loan.propertyAddress,
      refreshedAt,
    };

    await db.loanDetail.upsert({
      where: { accountId: account.id },
      update: shared,
      create: { ...shared, accountId: account.id },
      select: { id: true },
    });
    written += 1;
  }

  return `Refreshed ${written} ${written === 1 ? "loan" : "loans"}.`;
}

/**
 * Pull the item's own metadata — institution, consent expiry, current error.
 *
 * Separate from `syncBalances` because it is cheap and does not reach the bank,
 * so it can run on a link and on every webhook without costing anything. It is
 * also what fills in `institutionName`: Link's `onSuccess` metadata carries one,
 * but only sometimes, and a blank name on the connections page is what makes a
 * broken credential undiscoverable.
 */
export async function refreshItemMeta(itemRowId: string): Promise<void> {
  const token = await readPlaidToken(itemRowId);
  if (!token) throw new Error("No such Plaid item.");

  const info = await getItem(token);
  const status = info.errorCode ? statusForError(info.errorCode) : null;

  const existing = await db.plaidItem.findUnique({
    where: { id: itemRowId },
    select: { institutionName: true, institutionId: true },
  });

  const needsName =
    !existing?.institutionName ||
    existing.institutionName === "Bank" ||
    existing.institutionId !== info.institutionId;

  await db.plaidItem.update({
    where: { id: itemRowId },
    data: {
      institutionId: info.institutionId,
      consentExpiresAt: info.consentExpiresAt,
      ...(needsName
        ? { institutionName: await getInstitutionName(info.institutionId) }
        : {}),
      ...(status
        ? { status, statusDetail: info.errorMessage }
        : { status: "good", statusDetail: null }),
    },
    select: { id: true },
  });
}
