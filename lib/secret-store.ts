import { db } from "@/lib/db";
import { open, seal } from "@/lib/crypto-box";

/**
 * The one place that touches the Ledger's **secrets**.
 *
 * This is `lib/media-store.ts`'s seam, applied to strings instead of bytes, and
 * the property being preserved is the same one stated there: *nothing else in
 * the app reads that column.* For media the point was that moving to R2 should
 * be one file; here the point is that a leak has exactly one place to happen.
 *
 * **Nothing but this module may name `PlaidItem.accessTokenEnc` or
 * `OAuthCredential.refreshTokenEnc`.** Every other query names its columns —
 * which is already the house rule for the same reason on `JournalMedia.data` —
 * so a bare `findMany` on `PlaidItem` cannot accidentally carry a standing bank
 * grant into a server component's props, a log line, or a React error boundary's
 * serialised payload.
 *
 * Three rules follow from that and none of them is negotiable:
 *
 * 1. **A sealed value never crosses a boundary.** No server action returns one,
 *    no server component reads one, nothing logs one. `lib/plaid.ts` takes a
 *    token as an argument and its callers get it from here.
 * 2. **The plaintext is not cached.** It is read, used for one HTTP call, and
 *    dropped. Holding it in a module variable would keep a bank credential in
 *    the process across every request the container serves.
 * 3. **Deleting a Plaid item calls `/item/remove` first** — see
 *    `disconnectItem` in `lib/ledger-actions.ts`. Deleting the row alone leaves
 *    the grant live at the bank with nothing pointing at it, and Plaid keeps
 *    billing for it.
 */

/** Bound into the ciphertext, so a value cannot be moved between columns. */
const PLAID_AAD = "plaid:access_token";
const GOOGLE_AAD = "google:refresh_token";

export async function writePlaidToken(
  itemRowId: string,
  accessToken: string,
): Promise<void> {
  await db.plaidItem.update({
    where: { id: itemRowId },
    data: { accessTokenEnc: seal(accessToken, PLAID_AAD) },
    select: { id: true },
  });
}

/**
 * The access token for one item, or `null` if there is no such item.
 *
 * The **only** `select` of `accessTokenEnc` in the codebase, exactly as
 * `readMedia` is the only `select` of `JournalMedia.data`.
 */
export async function readPlaidToken(
  itemRowId: string,
): Promise<string | null> {
  const row = await db.plaidItem.findUnique({
    where: { id: itemRowId },
    select: { accessTokenEnc: true },
  });
  if (!row) return null;
  return open(row.accessTokenEnc, PLAID_AAD);
}

/**
 * Create the item row and seal its token in one call.
 *
 * Sealing before the insert rather than updating after it, so there is never a
 * moment — not even inside a transaction — where the row exists holding a
 * plaintext token. `institutionName` is required because an item with no name
 * is unidentifiable on the connections page, which is the one screen that exists
 * to tell you *which bank* needs re-authenticating.
 */
export async function createPlaidItem(item: {
  itemId: string;
  accessToken: string;
  institutionId: string | null;
  institutionName: string;
}): Promise<{ id: string }> {
  return db.plaidItem.upsert({
    where: { itemId: item.itemId },
    // Re-linking the same institution is an *update*, not a second row: Plaid
    // issues a fresh access token and keeps the item id, and a second row would
    // orphan every account already hanging off the first one.
    update: {
      accessTokenEnc: seal(item.accessToken, PLAID_AAD),
      institutionId: item.institutionId,
      institutionName: item.institutionName,
      status: "good",
      statusDetail: null,
    },
    create: {
      itemId: item.itemId,
      accessTokenEnc: seal(item.accessToken, PLAID_AAD),
      institutionId: item.institutionId,
      institutionName: item.institutionName,
    },
    select: { id: true },
  });
}

// ── Google ──────────────────────────────────────────────────────────────────
// Written in Layer 4 with the Gmail grant. The functions live here rather than
// in `lib/gmail.ts` so that the "one module names the secret column" property
// holds across both integrations rather than being a Plaid-only habit.

export async function writeGoogleRefreshToken(input: {
  accountEmail: string;
  refreshToken: string;
  scope: string;
}): Promise<void> {
  const refreshTokenEnc = seal(input.refreshToken, GOOGLE_AAD);
  await db.oAuthCredential.upsert({
    where: { provider: "google" },
    update: {
      accountEmail: input.accountEmail,
      refreshTokenEnc,
      scope: input.scope,
      obtainedAt: new Date(),
      revokedAt: null,
      lastError: null,
      lastErrorAt: null,
    },
    create: {
      provider: "google",
      accountEmail: input.accountEmail,
      refreshTokenEnc,
      scope: input.scope,
    },
    select: { id: true },
  });
}

/** The **only** `select` of `refreshTokenEnc`. Null when there is no live
 *  grant — a revoked one counts as none, so a caller cannot use it by
 *  forgetting to check `revokedAt`. */
export async function readGoogleRefreshToken(): Promise<string | null> {
  const row = await db.oAuthCredential.findUnique({
    where: { provider: "google" },
    select: { refreshTokenEnc: true, revokedAt: true },
  });
  if (!row || row.revokedAt) return null;
  return open(row.refreshTokenEnc, GOOGLE_AAD);
}
