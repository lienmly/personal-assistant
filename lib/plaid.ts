import { centsFromDollars } from "@/lib/money";

/**
 * Plaid, by hand.
 *
 * The same trade `lib/deepseek.ts` made and for the same reasons.
 * Plaid's HTTP surface is a POST with credentials in the JSON body — not even a
 * header scheme to get wrong — and the Ledger uses eight endpoints of it. The
 * official `plaid` package's real product is its generated types, and it pulls
 * `axios` to deliver them: a third of this repo's entire dependency count, for
 * typings of fields we mostly do not read.
 *
 * **The cost, stated:** a Plaid schema change is caught at runtime by the
 * narrowing helpers below rather than at build time by the SDK's types. That is
 * the same bet `deepseek.ts` already took, and it fails the same way — one
 * endpoint returning something unfamiliar, named in a sentence, instead of a
 * type error. Every field is read through `num`/`str`/`arr`, so an unexpected
 * shape produces a null rather than an exception three layers down.
 */

export type PlaidEnv = "sandbox" | "production";

const HOSTS: Record<PlaidEnv, string> = {
  sandbox: "https://sandbox.plaid.com",
  production: "https://production.plaid.com",
};

/**
 * Plaid's API version, pinned.
 *
 * Sent as a header on every request. Unpinned, Plaid serves whatever is current
 * and a response shape can change under a running deployment — which for a
 * hand-rolled client is precisely the failure the SDK would have caught. Pinning
 * turns "it broke on Tuesday" into "it will break when someone edits this line".
 */
const API_VERSION = "2020-09-14";

export class PlaidNotConfigured extends Error {
  constructor() {
    super(
      "Plaid has no credentials yet. Set PLAID_CLIENT_ID and PLAID_SECRET in .env.local (and in Railway), then reload the Ledger.",
    );
    this.name = "PlaidNotConfigured";
  }
}

/** A refusal Plaid itself issued, carrying the code the docs are indexed by. */
export class PlaidError extends Error {
  readonly code: string;
  readonly type: string;
  readonly requestId: string | null;

  constructor(input: {
    message: string;
    code: string;
    type: string;
    requestId: string | null;
  }) {
    super(input.message);
    this.name = "PlaidError";
    this.code = input.code;
    this.type = input.type;
    this.requestId = input.requestId;
  }
}

export function plaidEnv(): PlaidEnv {
  return process.env.PLAID_ENV === "production" ? "production" : "sandbox";
}

export function plaidConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

/** Why Plaid cannot be used, as a sentence, or `null`. Returned rather than
 *  thrown so the connections page can render it. */
export function plaidProblem(): string | null {
  if (!process.env.PLAID_CLIENT_ID) return "PLAID_CLIENT_ID is not set.";
  if (!process.env.PLAID_SECRET) return "PLAID_SECRET is not set.";
  return null;
}

async function call<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  if (!clientId || !secret) throw new PlaidNotConfigured();

  const response = await fetch(`${HOSTS[plaidEnv()]}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Plaid-Version": API_VERSION,
    },
    body: JSON.stringify({ client_id: clientId, secret, ...body }),
    // Plaid is never cached. Next will happily memoise a POST-shaped fetch in
    // some contexts, and a cached balance is exactly the stale assertion the
    // service worker was written to avoid one layer up.
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = JSON.parse(text);
  } catch {
    // fall through to the error below with an empty payload
  }

  if (!response.ok) {
    const p = asObject(payload);
    throw new PlaidError({
      message:
        str(p, "error_message") ??
        str(p, "display_message") ??
        `Plaid returned ${response.status}.`,
      code: str(p, "error_code") ?? String(response.status),
      type: str(p, "error_type") ?? "UNKNOWN",
      requestId: str(p, "request_id"),
    });
  }

  return payload as T;
}

// ── Narrowing ───────────────────────────────────────────────────────────────
// Every field Plaid sends is read through one of these. They return null rather
// than throwing, so a response that has grown or lost a field degrades to a
// missing value in one column instead of a 500 on the whole sync.

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function str(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function num(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function arr(source: Record<string, unknown>, key: string): unknown[] {
  const value = source[key];
  return Array.isArray(value) ? value : [];
}

/** A dollar amount from Plaid → cents, or null. The one conversion point for
 *  everything that arrives as a float (see `lib/money.ts`). */
function cents(source: Record<string, unknown>, key: string): number | null {
  const value = num(source, key);
  return value === null ? null : centsFromDollars(value);
}

// ── Link ────────────────────────────────────────────────────────────────────

/**
 * A short-lived token that opens Plaid Link in the browser.
 *
 * **`transactions` is required and the other two are required-if-supported**,
 * which is a deliberate correction to the obvious build. Putting all three in
 * `products` makes Link *hide every institution that does not support all
 * three* — so a credit union with no investments product would simply not appear
 * in the list, with no explanation. `required_if_supported_products` initialises
 * investments and liabilities wherever the institution has them and quietly does
 * without where it does not, which is the behaviour actually wanted.
 *
 * They still have to be asked for **now**, at first link, because adding a
 * product later requires re-linking the item — a re-auth the user has to sit
 * through. That part of the plan holds; only the field it goes in changed.
 */
export async function createLinkToken(input: {
  /** Stable across every link, because the app is single tenant. Plaid uses it
   *  to correlate items, not to identify a person. */
  clientUserId: string;
  /** Set on an existing item to reopen Link in *update mode* — the only cure
   *  for `ITEM_LOGIN_REQUIRED`, and the one step of this that a human has to do
   *  in person with a phone. */
  accessToken?: string;
}): Promise<{ linkToken: string; expiration: string | null }> {
  const webhook = process.env.PLAID_WEBHOOK_URL;
  const redirectUri = process.env.PLAID_REDIRECT_URI;

  const payload = await call<unknown>("/link/token/create", {
    client_name: "Clan Centurio",
    country_codes: ["US"],
    language: "en",
    user: { client_user_id: input.clientUserId },
    ...(input.accessToken
      ? // Update mode takes no `products`: the item already has them, and
        // sending them is an error rather than a no-op.
        { access_token: input.accessToken }
      : {
          products: ["transactions"],
          required_if_supported_products: ["investments", "liabilities"],
        }),
    ...(webhook ? { webhook } : {}),
    // Required for institutions that authenticate through their own OAuth page
    // (Chase, Capital One). Without it those banks are unlinkable, and the
    // failure is at the end of the flow rather than the start of it.
    ...(redirectUri ? { redirect_uri: redirectUri } : {}),
  });

  const root = asObject(payload);
  const linkToken = str(root, "link_token");
  if (!linkToken) throw new Error("Plaid returned no link token.");

  return { linkToken, expiration: str(root, "expiration") };
}

export async function exchangePublicToken(
  publicToken: string,
): Promise<{ accessToken: string; itemId: string }> {
  const root = asObject(
    await call<unknown>("/item/public_token/exchange", {
      public_token: publicToken,
    }),
  );

  const accessToken = str(root, "access_token");
  const itemId = str(root, "item_id");
  if (!accessToken || !itemId) {
    throw new Error("Plaid returned an incomplete token exchange.");
  }

  return { accessToken, itemId };
}

/**
 * A public token without going through Link. **Sandbox only.**
 *
 * Link is a browser modal, so without this there is no way to exercise the
 * exchange, the sync or the webhook from a script — and "verified by reasoning"
 * is what this codebase keeps having to apologise for. `scripts/ledger-live.mts`
 * is the only caller.
 *
 * It throws outside sandbox rather than checking a flag, because the endpoint
 * does not exist in production and the failure should name the reason rather
 * than arrive as a 404 from Plaid.
 */
export async function sandboxPublicToken(input: {
  institutionId: string;
  products: string[];
}): Promise<string> {
  if (plaidEnv() !== "sandbox") {
    throw new Error("sandboxPublicToken is only available in the sandbox.");
  }

  const root = asObject(
    await call<unknown>("/sandbox/public_token/create", {
      institution_id: input.institutionId,
      initial_products: input.products,
    }),
  );

  const token = str(root, "public_token");
  if (!token) throw new Error("Sandbox returned no public token.");
  return token;
}

// ── Webhook verification ────────────────────────────────────────────────────

/** JWKs, cached by `kid`. Plaid rotates keys, so this is a cache and not a
 *  config — an unknown `kid` is a fetch, not a rejection. */
const webhookKeys = new Map<string, { key: JsonWebKey; fetchedAt: number }>();
const KEY_TTL_MS = 24 * 60 * 60_000;

async function webhookKey(kid: string): Promise<JsonWebKey> {
  const cached = webhookKeys.get(kid);
  if (cached && Date.now() - cached.fetchedAt < KEY_TTL_MS) return cached.key;

  const root = asObject(
    await call<unknown>("/webhook_verification_key/get", { key_id: kid }),
  );
  const key = asObject(root.key) as JsonWebKey;
  if (!key.kty) throw new Error("Plaid returned no verification key.");

  webhookKeys.set(kid, { key, fetchedAt: Date.now() });
  return key;
}

function base64UrlToBuffer(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/**
 * Is this webhook genuinely from Plaid?
 *
 * The route is unauthenticated by necessity — Plaid has no session — so this is
 * the whole of its security, and it is worth being exact about the two lines
 * that are easy to get wrong.
 *
 * **`dsaEncoding: "ieee-p1363"` is mandatory.** An ES256 JWT signature is a raw
 * `r‖s` pair; Node's `crypto.verify` defaults to expecting DER. Without the
 * flag, verification fails *silently and always*, and every webhook 401s — which
 * looks exactly like a misconfigured endpoint rather than a one-word bug.
 *
 * **The body hash is over the raw bytes**, so the caller must read the body as
 * text before parsing it. `JSON.parse` then `JSON.stringify` produces a
 * different string and the comparison fails for a legitimate request.
 */
export async function verifyWebhook(
  rawBody: string,
  verificationHeader: string | null,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!verificationHeader) return { ok: false, reason: "no verification header" };

  const parts = verificationHeader.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed JWT" };

  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg?: string; kid?: string };
  let payload: { request_body_sha256?: string; iat?: number };
  try {
    header = JSON.parse(base64UrlToBuffer(headerB64).toString("utf8"));
    payload = JSON.parse(base64UrlToBuffer(payloadB64).toString("utf8"));
  } catch {
    return { ok: false, reason: "unreadable JWT" };
  }

  // Pinned, not read-and-trusted. `alg: "none"` is the classic JWT forgery and
  // an RS256 key confusion is the other; neither is possible if only ES256 is
  // ever accepted.
  if (header.alg !== "ES256") return { ok: false, reason: "alg is not ES256" };
  if (!header.kid) return { ok: false, reason: "no kid" };

  const { createPublicKey, createHash, verify } = await import("node:crypto");

  let key: ReturnType<typeof createPublicKey>;
  try {
    key = createPublicKey({
      key: (await webhookKey(header.kid)) as never,
      format: "jwk",
    });
  } catch {
    return { ok: false, reason: "unknown key id" };
  }

  const valid = verify(
    "sha256",
    Buffer.from(`${headerB64}.${payloadB64}`, "utf8"),
    { key, dsaEncoding: "ieee-p1363" },
    base64UrlToBuffer(signatureB64),
  );
  if (!valid) return { ok: false, reason: "bad signature" };

  // A valid signature over someone else's body is a replay with a swapped
  // payload; the hash is what binds the two together.
  const digest = createHash("sha256").update(rawBody, "utf8").digest("hex");
  if (payload.request_body_sha256 !== digest) {
    return { ok: false, reason: "body does not match its signature" };
  }

  // Five minutes. A correctly-signed webhook captured off the wire is otherwise
  // replayable forever, and replaying a sync trigger is cheap but not free.
  const age = Date.now() / 1000 - (payload.iat ?? 0);
  if (!Number.isFinite(age) || age > 300 || age < -60) {
    return { ok: false, reason: "stale or future-dated" };
  }

  return { ok: true };
}

/** Sandbox only: makes Plaid send a webhook so the endpoint can be exercised. */
export async function fireSandboxWebhook(
  accessToken: string,
  code = "SYNC_UPDATES_AVAILABLE",
): Promise<void> {
  if (plaidEnv() !== "sandbox") {
    throw new Error("fireSandboxWebhook is only available in the sandbox.");
  }
  await call<unknown>("/sandbox/item/fire_webhook", {
    access_token: accessToken,
    webhook_type: "TRANSACTIONS",
    webhook_code: code,
  });
}

// ── Item ────────────────────────────────────────────────────────────────────

export type PlaidItemInfo = {
  itemId: string;
  institutionId: string | null;
  consentExpiresAt: Date | null;
  /** Null when the item is healthy. */
  errorCode: string | null;
  errorMessage: string | null;
};

export async function getItem(accessToken: string): Promise<PlaidItemInfo> {
  const root = asObject(
    await call<unknown>("/item/get", { access_token: accessToken }),
  );
  const item = asObject(root.item);
  const error = asObject(item.error);
  const expires = str(item, "consent_expiration_time");

  return {
    itemId: str(item, "item_id") ?? "",
    institutionId: str(item, "institution_id"),
    consentExpiresAt: expires ? new Date(expires) : null,
    errorCode: str(error, "error_code"),
    errorMessage: str(error, "error_message"),
  };
}

/** The institution's display name. Falls back to the id, then to a placeholder:
 *  the connections page has to be able to say *which bank* needs attention, and
 *  a blank row there is the one thing that makes re-auth undiscoverable. */
export async function getInstitutionName(
  institutionId: string | null,
): Promise<string> {
  if (!institutionId) return "Bank";
  try {
    const root = asObject(
      await call<unknown>("/institutions/get_by_id", {
        institution_id: institutionId,
        country_codes: ["US"],
      }),
    );
    return str(asObject(root.institution), "name") ?? institutionId;
  } catch {
    return institutionId;
  }
}

/**
 * Ends the grant at Plaid.
 *
 * Must be called **before** deleting the row. Deleting the row alone leaves the
 * item live at the bank with nothing in the app pointing at it — still billing,
 * still authorised, and now invisible.
 */
export async function removeItem(accessToken: string): Promise<void> {
  await call<unknown>("/item/remove", { access_token: accessToken });
}

// ── Balances ────────────────────────────────────────────────────────────────

export type PlaidAccount = {
  accountId: string;
  name: string;
  officialName: string | null;
  mask: string | null;
  type: string;
  subtype: string | null;
  currency: string;
  currentCents: number | null;
  availableCents: number | null;
  limitCents: number | null;
};

/**
 * Current balances for every account on an item.
 *
 * `/accounts/balance/get` rather than `/accounts/get`: the latter serves Plaid's
 * cached copy, and a net worth built from a cache is the stale assertion this
 * whole app is written against. The cost is that this call reaches the bank and
 * is therefore slow — which is why it runs in a job rather than in a render.
 */
export async function getBalances(
  accessToken: string,
): Promise<PlaidAccount[]> {
  const root = asObject(
    await call<unknown>("/accounts/balance/get", { access_token: accessToken }),
  );

  return arr(root, "accounts").map(parseAccount);
}

function parseAccount(raw: unknown): PlaidAccount {
  const account = asObject(raw);
  const balances = asObject(account.balances);

  return {
    accountId: str(account, "account_id") ?? "",
    name: str(account, "name") ?? "Account",
    officialName: str(account, "official_name"),
    mask: str(account, "mask"),
    type: str(account, "type") ?? "other",
    subtype: str(account, "subtype"),
    currency: str(balances, "iso_currency_code") ?? "USD",
    currentCents: cents(balances, "current"),
    availableCents: cents(balances, "available"),
    limitCents: cents(balances, "limit"),
  };
}

// ── Transactions ────────────────────────────────────────────────────────────

export type PlaidTransaction = {
  transactionId: string;
  accountId: string;
  /** **Already inverted**: positive is money in. See `syncTransactions`. */
  amountCents: number;
  postedOn: string;
  authorizedOn: string | null;
  pending: boolean;
  pendingPlaidId: string | null;
  name: string;
  merchantName: string | null;
  website: string | null;
  category: string | null;
  categoryDetail: string | null;
};

export type SyncPage = {
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: string[];
  cursor: string;
  hasMore: boolean;
};

/**
 * One page of `/transactions/sync`.
 *
 * **The sign is inverted here, and this is the only place it happens.** Plaid
 * reports a debit as a *positive* number — correct from the institution's side
 * of the ledger, and backwards from ours. Every monthly total, category roll-up
 * and Schedule E line in this app reads naturally when positive means money in,
 * so the flip belongs at the boundary rather than at forty call sites.
 *
 * `/transactions/sync` rather than `/transactions/get`: sync is cursor-based and
 * tells you what *changed*, so a re-run costs one empty page instead of
 * re-fetching two years. The cursor never expires, which is what makes a missed
 * webhook a delay rather than a hole.
 */
export async function syncTransactions(
  accessToken: string,
  cursor: string | null,
): Promise<SyncPage> {
  const root = asObject(
    await call<unknown>("/transactions/sync", {
      access_token: accessToken,
      ...(cursor ? { cursor } : {}),
      count: 500,
    }),
  );

  return {
    added: arr(root, "added").map(parseTransaction),
    modified: arr(root, "modified").map(parseTransaction),
    removed: arr(root, "removed")
      .map((raw) => str(asObject(raw), "transaction_id"))
      .filter((id): id is string => id !== null),
    cursor: str(root, "next_cursor") ?? "",
    hasMore: root.has_more === true,
  };
}

function parseTransaction(raw: unknown): PlaidTransaction {
  const tx = asObject(raw);
  const pfc = asObject(tx.personal_finance_category);
  const amount = num(tx, "amount") ?? 0;

  return {
    transactionId: str(tx, "transaction_id") ?? "",
    accountId: str(tx, "account_id") ?? "",
    // The inversion. Plaid: positive = money out. Us: positive = money in.
    amountCents: -centsFromDollars(amount),
    postedOn: str(tx, "date") ?? "",
    authorizedOn: str(tx, "authorized_date"),
    pending: tx.pending === true,
    pendingPlaidId: str(tx, "pending_transaction_id"),
    name: str(tx, "name") ?? "Transaction",
    merchantName: str(tx, "merchant_name"),
    website: str(tx, "website"),
    category: str(pfc, "primary"),
    categoryDetail: str(pfc, "detailed"),
  };
}

// ── Investments ─────────────────────────────────────────────────────────────

export type PlaidSecurity = {
  securityId: string;
  tickerSymbol: string | null;
  name: string | null;
  type: string | null;
  closePriceCents: number | null;
  closePriceOn: string | null;
  isCashEquivalent: boolean;
};

export type PlaidHolding = {
  accountId: string;
  securityId: string;
  quantity: number;
  costBasisCents: number | null;
  priceCents: number | null;
  valueCents: number;
};

export async function getHoldings(accessToken: string): Promise<{
  securities: PlaidSecurity[];
  holdings: PlaidHolding[];
  accounts: PlaidAccount[];
}> {
  const root = asObject(
    await call<unknown>("/investments/holdings/get", {
      access_token: accessToken,
    }),
  );

  return {
    accounts: arr(root, "accounts").map(parseAccount),
    securities: arr(root, "securities").map((raw) => {
      const security = asObject(raw);
      return {
        securityId: str(security, "security_id") ?? "",
        tickerSymbol: str(security, "ticker_symbol"),
        name: str(security, "name"),
        type: str(security, "type"),
        closePriceCents: cents(security, "close_price"),
        closePriceOn: str(security, "close_price_as_of"),
        isCashEquivalent: security.is_cash_equivalent === true,
      };
    }),
    holdings: arr(root, "holdings").map((raw) => {
      const holding = asObject(raw);
      return {
        accountId: str(holding, "account_id") ?? "",
        securityId: str(holding, "security_id") ?? "",
        quantity: num(holding, "quantity") ?? 0,
        costBasisCents: cents(holding, "cost_basis"),
        priceCents: cents(holding, "institution_price"),
        valueCents: cents(holding, "institution_value") ?? 0,
      };
    }),
  };
}

// ── Liabilities ─────────────────────────────────────────────────────────────

export type PlaidLoan = {
  accountId: string;
  kind: "mortgage" | "student" | "credit";
  originationOn: string | null;
  originationPrincipalCents: number | null;
  interestRatePercent: number | null;
  interestRateType: string | null;
  maturityOn: string | null;
  nextPaymentDueOn: string | null;
  nextPaymentCents: number | null;
  escrowBalanceCents: number | null;
  ytdInterestCents: number | null;
  ytdPrincipalCents: number | null;
  propertyAddress: string | null;
};

/**
 * Mortgages, student loans and cards.
 *
 * The mortgage half is the reason `liabilities` is requested at all:
 * `ytd_interest_paid` is the Schedule E mortgage-interest line, arriving monthly
 * rather than on a Form 1098 in February — and it is the one number the
 * transaction feed genuinely cannot recover, because the payment leaves the
 * account as a single figure with the interest/principal split nowhere in it.
 */
export async function getLiabilities(
  accessToken: string,
): Promise<PlaidLoan[]> {
  const root = asObject(
    await call<unknown>("/liabilities/get", { access_token: accessToken }),
  );
  const liabilities = asObject(root.liabilities);
  const loans: PlaidLoan[] = [];

  for (const raw of arr(liabilities, "mortgage")) {
    const m = asObject(raw);
    const interest = asObject(m.interest_rate);
    const address = asObject(m.property_address);

    loans.push({
      accountId: str(m, "account_id") ?? "",
      kind: "mortgage",
      originationOn: str(m, "origination_date"),
      originationPrincipalCents: cents(m, "origination_principal_amount"),
      interestRatePercent: num(interest, "percentage"),
      interestRateType: str(interest, "type"),
      maturityOn: str(m, "maturity_date"),
      nextPaymentDueOn: str(m, "next_payment_due_date"),
      nextPaymentCents: cents(m, "next_monthly_payment"),
      escrowBalanceCents: cents(m, "escrow_balance"),
      ytdInterestCents: cents(m, "ytd_interest_paid"),
      ytdPrincipalCents: cents(m, "ytd_principal_paid"),
      propertyAddress: [
        str(address, "street"),
        str(address, "city"),
        str(address, "region"),
        str(address, "postal_code"),
      ]
        .filter(Boolean)
        .join(", ") || null,
    });
  }

  for (const raw of arr(liabilities, "student")) {
    const s = asObject(raw);
    loans.push({
      accountId: str(s, "account_id") ?? "",
      kind: "student",
      originationOn: str(s, "origination_date"),
      originationPrincipalCents: cents(s, "origination_principal_amount"),
      interestRatePercent: num(s, "interest_rate_percentage"),
      interestRateType: null,
      maturityOn: str(s, "expected_payoff_date"),
      nextPaymentDueOn: str(s, "next_payment_due_date"),
      nextPaymentCents: cents(s, "minimum_payment_amount"),
      escrowBalanceCents: null,
      ytdInterestCents: cents(s, "ytd_interest_paid"),
      ytdPrincipalCents: cents(s, "ytd_principal_paid"),
      propertyAddress: null,
    });
  }

  for (const raw of arr(liabilities, "credit")) {
    const c = asObject(raw);
    const apr = arr(c, "aprs").map((a) => num(asObject(a), "apr_percentage"));
    loans.push({
      accountId: str(c, "account_id") ?? "",
      kind: "credit",
      originationOn: null,
      originationPrincipalCents: null,
      interestRatePercent: apr.find((rate) => rate !== null) ?? null,
      interestRateType: null,
      maturityOn: null,
      nextPaymentDueOn: str(c, "next_payment_due_date"),
      nextPaymentCents: cents(c, "minimum_payment_amount"),
      escrowBalanceCents: null,
      ytdInterestCents: null,
      ytdPrincipalCents: null,
      propertyAddress: null,
    });
  }

  return loans;
}
