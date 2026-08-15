"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueue } from "@/lib/ledger-jobs";
import {
  PlaidNotConfigured,
  createLinkToken,
  exchangePublicToken,
  removeItem,
} from "@/lib/plaid";
import { createPlaidItem, readPlaidToken } from "@/lib/secret-store";

/**
 * Everything the Ledger writes.
 *
 * Two conventions from `lib/journal-actions.ts`, both load-bearing:
 *
 * **Server actions are their own public endpoints.** The route guard in
 * `proxy.ts` is optimistic and the `(app)` layout's `auth()` does not cover
 * these, so every one re-checks the session. On this surface that matters more
 * than anywhere else in the app — these actions reach a bank.
 *
 * **A refusal is a returned value; a bug throws.** React redacts every error
 * crossing the server boundary in a production build, so a thrown message never
 * reaches the screen — a "Plaid rejected the key" that arrives as "an error
 * occurred" is a support call. Genuine faults (no session, Prisma down) still
 * throw, because those belong in the logs.
 */

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Not signed in");
  return session;
}

/**
 * The Plaid `client_user_id`.
 *
 * A stable constant, because the app is single tenant — the same reason nothing
 * in this schema carries an `ownerId`. Plaid uses it to correlate items, not to
 * identify a person, and it must not change between links or Plaid treats the
 * second one as a different user.
 */
const PLAID_USER_ID = "clan-centurio";

function refresh() {
  revalidatePath("/ledger");
  revalidatePath("/ledger/connections");
}

export type LedgerResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : T))
  | { ok: false; message: string };

/**
 * Mint a Link token for the browser.
 *
 * Pass `itemId` to reopen Link in **update mode**, which is the only cure for
 * `ITEM_LOGIN_REQUIRED` and the one part of this feature that a person has to do
 * themselves, in front of a phone. Everything else about a bank connection is
 * automatic; re-authentication is not, and pretending otherwise would leave a
 * silently dead link.
 */
export async function createLinkTokenAction(
  itemId?: string,
): Promise<LedgerResult<{ linkToken: string }>> {
  await requireSession();

  try {
    let accessToken: string | undefined;
    if (itemId) {
      const stored = await readPlaidToken(itemId);
      if (!stored) return { ok: false, message: "That connection is gone." };
      accessToken = stored;
    }

    const { linkToken } = await createLinkToken({
      clientUserId: PLAID_USER_ID,
      accessToken,
    });

    return { ok: true, linkToken };
  } catch (cause) {
    if (cause instanceof PlaidNotConfigured) {
      return { ok: false, message: cause.message };
    }
    return {
      ok: false,
      message:
        cause instanceof Error
          ? cause.message
          : "Could not start the bank connection.",
    };
  }
}

/**
 * Finish a link: exchange the public token and queue the first sync.
 *
 * **The public token is never stored.** It is exchanged immediately and dropped;
 * the access token it becomes is sealed by `lib/secret-store.ts` before the row
 * exists. The two jobs queued here are what make the accounts appear — this
 * action deliberately does not await a bank, because it is called from a modal
 * the user is still looking at.
 *
 * Re-linking an institution that is already connected updates the existing row
 * rather than creating a second one (see `createPlaidItem`), so recovering a
 * broken credential does not fork the account list.
 */
export async function completePlaidLink(
  publicToken: string,
  institutionName?: string | null,
): Promise<LedgerResult<{ itemId: string }>> {
  await requireSession();

  if (!publicToken.trim()) {
    return { ok: false, message: "Plaid returned no token." };
  }

  try {
    const { accessToken, itemId } = await exchangePublicToken(publicToken);

    const row = await createPlaidItem({
      itemId,
      accessToken,
      institutionId: null,
      // Link's metadata usually carries a name and sometimes does not.
      // `plaid_item_meta` fills in the real one; this is what shows until it
      // lands, and a blank here is what makes a broken connection unfindable.
      institutionName: institutionName?.trim() || "Bank",
    });

    // Balances before transactions — see the note in `ensureLedgerJobs`. The
    // queue is drained in `runAfter` order, and these all share a timestamp, so
    // the insertion order is what decides.
    await enqueue("plaid_item_meta", row.id);
    await enqueue("plaid_balances", row.id);
    await enqueue("plaid_sync", row.id);
    await enqueue("plaid_holdings", row.id);
    await enqueue("plaid_liabilities", row.id);

    refresh();
    return { ok: true, itemId: row.id };
  } catch (cause) {
    return {
      ok: false,
      message:
        cause instanceof Error
          ? cause.message
          : "Could not finish connecting that bank.",
    };
  }
}

/**
 * Disconnect a bank.
 *
 * **`/item/remove` first, then the row.** Deleting the row alone leaves the
 * grant live at the bank with nothing in the app pointing at it — still
 * authorised, still billing, and now invisible. If Plaid's call fails the row
 * stays, so the connection remains visible and the disconnect can be retried;
 * the reverse order would lose the only handle on it.
 *
 * The accounts survive, by `SetNull` on `Account.itemId`. That is the schema
 * comment's argument made real: a disconnected account keeps its balance history
 * and stops updating, because that history is what tax numbers are computed
 * from and losing a quarter of it to an expired credential is worse than losing
 * the connection.
 */
export async function disconnectItem(
  itemRowId: string,
): Promise<LedgerResult> {
  await requireSession();

  const token = await readPlaidToken(itemRowId);
  if (!token) return { ok: false, message: "That connection is already gone." };

  try {
    await removeItem(token);
  } catch (cause) {
    return {
      ok: false,
      message:
        cause instanceof Error
          ? `Plaid would not release the connection: ${cause.message}`
          : "Plaid would not release the connection.",
    };
  }

  await db.plaidItem.delete({ where: { id: itemRowId } });

  refresh();
  return { ok: true };
}

/**
 * Keep an account out of the net worth without disconnecting it.
 *
 * For a joint account already counted elsewhere, or a legacy card at zero. It
 * still syncs and it is still listed — an excluded account that disappeared
 * from the list would be one you could never put back.
 */
export async function setAccountIncluded(
  accountId: string,
  included: boolean,
): Promise<LedgerResult> {
  await requireSession();

  await db.account.update({
    where: { id: accountId },
    data: { includeInNetWorth: included },
    select: { id: true },
  });

  refresh();
  return { ok: true };
}

/**
 * Rename an account.
 *
 * Plaid's names are the institution's ("PLAID CHECKING", "Total Checking"), and
 * the sync deliberately overwrites `name` on every run — so this sets the same
 * column and will be overwritten. That is the honest behaviour for now and it is
 * written down rather than hidden: giving an account a nickname that *survives*
 * a sync needs its own column, which is a migration and belongs with the layer
 * that has a reason for one.
 */
export async function renameAccount(
  accountId: string,
  name: string,
): Promise<LedgerResult> {
  await requireSession();

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "An account needs a name." };

  await db.account.update({
    where: { id: accountId },
    data: { name: trimmed },
    select: { id: true },
  });

  refresh();
  return { ok: true };
}

/** Queue a refresh for every live connection. The button on the connections
 *  page; the same jobs `ensureLedgerJobs` queues on a timer. */
export async function refreshAllItems(): Promise<LedgerResult<{ queued: number }>> {
  await requireSession();

  const items = await db.plaidItem.findMany({
    where: { status: { notIn: ["revoked", "removed"] } },
    select: { id: true },
  });

  for (const item of items) await enqueue("plaid_balances", item.id);

  refresh();
  return { ok: true, queued: items.length };
}

/**
 * File a bank row against a property, with the Schedule E line it belongs on.
 *
 * The one Ledger write Montblanc can make, and the shape is deliberate:
 * **nothing here is created by asking.** The money comes from a bank and the
 * statements come from email, so what a person actually needs from a command bar
 * is the small tedious act of *filing* — "that $340 was a plumbing repair for
 * the rental" — rather than another way to invent a row.
 *
 * **It refuses a transaction already claimed by a property**, and that refusal
 * is what makes undo safe: the state before is always unclaimed, so releasing
 * the claim restores it exactly. It is also §6's "an existing item never moves
 * on its own", one noun over — a row somebody already filed is a decision, not
 * a default to overwrite.
 */
export async function claimTransactionForProperty(input: {
  transactionId: string;
  propertyId: string;
  taxCategory: string | null;
}): Promise<LedgerResult<{ label: string; where: string }>> {
  await requireSession();

  const row = await db.transaction.findUnique({
    where: { id: input.transactionId },
    select: {
      id: true,
      name: true,
      merchantName: true,
      amountCents: true,
      propertyId: true,
    },
  });
  if (!row) return { ok: false, message: "That transaction is gone." };

  if (row.propertyId && row.propertyId !== input.propertyId) {
    return {
      ok: false,
      message:
        "That transaction is already filed against another property. Change it on the Ledger, where you can see what it is.",
    };
  }

  const property = await db.property.findUnique({
    where: { id: input.propertyId },
    select: { label: true },
  });
  if (!property) return { ok: false, message: "No such property." };

  await db.transaction.update({
    where: { id: row.id },
    data: { propertyId: input.propertyId, taxCategory: input.taxCategory },
    select: { id: true },
  });

  refresh();
  return {
    ok: true,
    label: row.merchantName ?? row.name,
    where: property.label,
  };
}

/** Undo a claim. Releases it; **never deletes the transaction** — a bank row is
 *  a payment that really happened. */
export async function releaseTransaction(
  transactionId: string,
): Promise<LedgerResult> {
  await requireSession();

  await db.transaction.update({
    where: { id: transactionId },
    data: { propertyId: null, taxCategory: null },
    select: { id: true },
  });

  refresh();
  return { ok: true };
}

/** Set or clear a transaction's spending category. Yours, not Plaid's — a sync
 *  deliberately never overwrites it. */
export async function categoriseTransaction(
  transactionId: string,
  category: string | null,
): Promise<LedgerResult<{ label: string }>> {
  await requireSession();

  const row = await db.transaction.update({
    where: { id: transactionId },
    data: { category: category?.trim() || null },
    select: { name: true, merchantName: true },
  });

  refresh();
  return { ok: true, label: row.merchantName ?? row.name };
}
