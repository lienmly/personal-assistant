import { db } from "@/lib/db";
import { enqueue } from "@/lib/ledger-jobs";
import { verifyWebhook } from "@/lib/plaid";

/**
 * Plaid, telling us something changed.
 *
 * **Unauthenticated by necessity** — Plaid has no session — which makes the
 * signature check the whole of this endpoint's security, and makes it the one
 * route in the app that has to be exempted from `proxy.ts`. Gated, it would 302
 * to `/login`, Plaid would follow the redirect, receive HTML, and mark the
 * endpoint failed *silently*: a 302 is not an error anywhere in this app. That
 * is the manifest bug of Phase 4.21 for the third time (§9).
 *
 * Three rules:
 *
 * 1. **Read the raw body as text before parsing.** The signature covers the
 *    exact bytes, so `JSON.parse` followed by `JSON.stringify` produces a
 *    different string and the hash comparison fails for a legitimate request.
 * 2. **Enqueue and return 200. Never work inline.** Plaid retries anything that
 *    is slow or non-200, so doing the sync here means a slow bank turns one
 *    webhook into several, each starting another sync. A queue insert is a
 *    millisecond, and `LedgerJob` is where the work becomes visible anyway.
 * 3. **200 on anything already handled, including a webhook for an item we do
 *    not have.** Plaid disables an endpoint that keeps erroring; an item removed
 *    on this side is not Plaid's fault and must not count against that.
 */
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();

  const verified = await verifyWebhook(
    rawBody,
    request.headers.get("plaid-verification"),
  );
  if (!verified.ok) {
    return new Response(`Unverified: ${verified.reason}`, { status: 401 });
  }

  let payload: { webhook_type?: string; webhook_code?: string; item_id?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Unreadable body", { status: 400 });
  }

  const { webhook_type: type, webhook_code: code, item_id: itemId } = payload;
  if (!itemId) return new Response("ok", { status: 200 });

  const item = await db.plaidItem.findUnique({
    where: { itemId },
    select: { id: true },
  });
  // See rule 3. Not a 404: an unknown item is our state, not Plaid's error.
  if (!item) return new Response("ok", { status: 200 });

  await db.plaidItem.update({
    where: { id: item.id },
    data: { lastWebhookAt: new Date() },
    select: { id: true },
  });

  switch (type) {
    case "TRANSACTIONS":
      // Every transactions code — SYNC_UPDATES_AVAILABLE, and the older
      // INITIAL/HISTORICAL/DEFAULT_UPDATE and TRANSACTIONS_REMOVED — means the
      // same thing to a cursor-based sync: walk it again. Branching per code
      // would be four paths to one destination.
      await enqueue("plaid_sync", item.id);
      break;

    case "HOLDINGS":
      await enqueue("plaid_holdings", item.id);
      break;

    case "LIABILITIES":
      await enqueue("plaid_liabilities", item.id);
      break;

    case "ITEM":
      switch (code) {
        case "ERROR":
        case "PENDING_EXPIRATION":
        case "PENDING_DISCONNECT":
        case "USER_PERMISSION_REVOKED":
        case "USER_ACCOUNT_REVOKED":
          // `refreshItemMeta` reads the item's own error and writes the status
          // the connections page renders in crimson — rather than trusting the
          // webhook's code, which does not carry the error detail.
          await enqueue("plaid_item_meta", item.id);
          break;
        case "LOGIN_REPAIRED":
          await enqueue("plaid_item_meta", item.id);
          await enqueue("plaid_balances", item.id);
          await enqueue("plaid_sync", item.id);
          break;
        case "NEW_ACCOUNTS_AVAILABLE":
          await enqueue("plaid_balances", item.id);
          break;
      }
      break;
  }

  return new Response("ok", { status: 200 });
}
