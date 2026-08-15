import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { db } from "@/lib/db";
import { readGoogleRefreshToken, writeGoogleRefreshToken } from "@/lib/secret-store";

/**
 * Gmail, by hand — three `fetch` calls against a metapackage that ships every
 * Google API. `googleapis` is refused for the reason the Plaid SDK is (§8).
 *
 * ## Why this is a separate grant from signing in
 *
 * The obvious build adds `gmail.readonly` to the Auth.js Google provider and
 * reads the token off the session. Four reasons it is not that:
 *
 * 1. **Sign-in must not gain a failure mode.** Every future sign-in would carry
 *    a Gmail consent screen, and the thing that breaks when that consent is
 *    declined — or when Google changes its verification requirements for a
 *    restricted scope — is the front door.
 * 2. **There is nowhere to put a refresh token in the existing auth.** Auth.js
 *    runs JWT sessions with no adapter and there is deliberately no `User` table
 *    (§6). Persisting from the `jwt` callback means Prisma in a module `proxy.ts`
 *    also imports, which forces either the edge/Node split-config surgery or
 *    Prisma in the proxy bundle. Both are surgery on working auth.
 * 3. **Two different lifetimes.** A session lasts a browser. This grant must
 *    survive every sign-out and last until it is revoked.
 * 4. It makes **disconnecting one row deleted**, and makes what is granted
 *    visible on a page rather than implied by having logged in.
 *
 * Same Google Cloud project and the same client id and secret — **no new
 * secret**, just a second authorised redirect URI.
 *
 * ## The scope, and the honest cost
 *
 * `gmail.readonly` is the narrowest scope that can read an attachment;
 * `gmail.metadata` cannot. So it can read everything, and the mitigation is to
 * look at as little as possible: the query is narrowed to a sender, an
 * attachment and sixty days, **no message body is ever stored** — only the
 * matched PDF and the rows read out of it — and disconnecting revokes at Google
 * rather than just forgetting locally.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export function gmailProblem(): string | null {
  if (!process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
    return "AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are needed — the same pair sign-in already uses.";
  }
  if (!process.env.AUTH_SECRET) {
    return "AUTH_SECRET is needed to sign the OAuth state.";
  }
  return null;
}

function redirectUri(origin: string): string {
  return (
    process.env.GOOGLE_GMAIL_REDIRECT_URI ??
    `${origin}/api/ledger/gmail/callback`
  );
}

/**
 * A signed `state`, so the callback can tell its own redirect from a forged one.
 *
 * HMAC over a nonce with `AUTH_SECRET`, rather than a value stashed in a cookie
 * or a table: it needs no storage, survives a server restart mid-flow, and there
 * is nothing secret in it. This is CSRF protection for a route that is already
 * session-gated — belt and braces, and cheap.
 */
export function signState(): string {
  const nonce = randomBytes(16).toString("base64url");
  const mac = createHmac("sha256", process.env.AUTH_SECRET ?? "")
    .update(nonce)
    .digest("base64url");
  return `${nonce}.${mac}`;
}

export function verifyState(state: string | null): boolean {
  if (!state) return false;
  const [nonce, mac] = state.split(".");
  if (!nonce || !mac) return false;

  const expected = createHmac("sha256", process.env.AUTH_SECRET ?? "")
    .update(nonce)
    .digest("base64url");

  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function authUrl(origin: string, state: string): string {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", process.env.AUTH_GOOGLE_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_SCOPE);
  // Without `offline` Google returns no refresh token at all, and without
  // `consent` it returns none on a *re-*grant — which is the case that bites,
  // because the first grant works and the reconnect silently does not.
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

/** Exchanges the callback's code and stores the refresh token sealed. */
export async function exchangeCode(
  code: string,
  origin: string,
): Promise<{ email: string }> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.AUTH_GOOGLE_ID ?? "",
      client_secret: process.env.AUTH_GOOGLE_SECRET ?? "",
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google rejected the code: ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    refresh_token?: string;
    access_token?: string;
    scope?: string;
  };

  if (!payload.refresh_token) {
    // Reachable when `prompt=consent` is dropped, or when the grant already
    // exists at Google. Named rather than silently stored without one, because
    // the resulting row would authenticate exactly once and then fail forever.
    throw new Error(
      "Google returned no refresh token. Remove the app's access at myaccount.google.com/permissions and try again.",
    );
  }

  const email = payload.access_token
    ? await accountEmail(payload.access_token)
    : "unknown";

  await writeGoogleRefreshToken({
    accountEmail: email,
    refreshToken: payload.refresh_token,
    scope: payload.scope ?? GMAIL_SCOPE,
  });

  return { email };
}

async function accountEmail(accessToken: string): Promise<string> {
  try {
    const response = await fetch(`${API}/profile`, {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) return "unknown";
    const payload = (await response.json()) as { emailAddress?: string };
    return payload.emailAddress ?? "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * A live access token, from the stored refresh token.
 *
 * Cached in module memory for its own lifetime minus a minute. Not in the
 * database: an access token is valid for an hour and re-minting one is a single
 * cheap call, so storing it would be a second secret at rest to protect for no
 * benefit.
 */
let cached: { token: string; expiresAt: number } | null = null;

export async function accessToken(): Promise<string | null> {
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const refresh = await readGoogleRefreshToken();
  if (!refresh) return null;

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refresh,
      client_id: process.env.AUTH_GOOGLE_ID ?? "",
      client_secret: process.env.AUTH_GOOGLE_SECRET ?? "",
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    // A refresh token is revoked at Google, not here — by changing a password,
    // by removing the app, or by six months of disuse. Recording it is what lets
    // the connections page say "reconnect" instead of going quiet.
    await db.oAuthCredential.updateMany({
      where: { provider: "google" },
      data: {
        lastErrorAt: new Date(),
        lastError: `Google refused the refresh token. ${detail.slice(0, 160)}`,
      },
    });
    cached = null;
    throw new Error(
      "Google refused the stored Gmail grant. It needs reconnecting.",
    );
  }

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!payload.access_token) throw new Error("Google returned no access token.");

  cached = {
    token: payload.access_token,
    expiresAt: Date.now() + ((payload.expires_in ?? 3600) - 60) * 1000,
  };

  await db.oAuthCredential.updateMany({
    where: { provider: "google" },
    data: { lastUsedAt: new Date(), lastError: null, lastErrorAt: null },
  });

  return cached.token;
}

async function api<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `Gmail returned ${response.status}: ${(await response.text()).slice(0, 160)}`,
    );
  }
  return (await response.json()) as T;
}

export type GmailMessageRef = { id: string; threadId: string };

export async function searchMessages(
  query: string,
  token: string,
  limit = 25,
): Promise<GmailMessageRef[]> {
  const payload = await api<{ messages?: GmailMessageRef[] }>(
    `/messages?q=${encodeURIComponent(query)}&maxResults=${limit}`,
    token,
  );
  return payload.messages ?? [];
}

export type GmailPart = {
  mimeType?: string;
  filename?: string;
  body?: { attachmentId?: string; size?: number };
  parts?: GmailPart[];
};

export type GmailMessage = {
  id: string;
  internalDate?: string;
  payload?: GmailPart & { headers?: { name: string; value: string }[] };
};

export async function getMessage(
  id: string,
  token: string,
): Promise<GmailMessage> {
  return api<GmailMessage>(`/messages/${id}?format=full`, token);
}

/** Walks the MIME tree for the first PDF. A statement email usually has one
 *  attachment and sometimes a logo beside it; taking the first PDF rather than
 *  the first attachment is what skips the logo. */
export function findPdfPart(part: GmailPart | undefined): GmailPart | null {
  if (!part) return null;

  const isPdf =
    part.mimeType === "application/pdf" ||
    (part.filename ?? "").toLowerCase().endsWith(".pdf");
  if (isPdf && part.body?.attachmentId) return part;

  for (const child of part.parts ?? []) {
    const found = findPdfPart(child);
    if (found) return found;
  }
  return null;
}

export async function getAttachment(
  messageId: string,
  attachmentId: string,
  token: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const payload = await api<{ data?: string }>(
    `/messages/${messageId}/attachments/${attachmentId}`,
    token,
  );
  if (!payload.data) throw new Error("That attachment came back empty.");
  // Gmail uses base64url, which `Buffer.from(..., "base64")` does not decode
  // correctly on its own — `-` and `_` have to become `+` and `/` first.
  const normalised = payload.data.replace(/-/g, "+").replace(/_/g, "/");
  const buffer = Buffer.from(normalised, "base64");
  return new Uint8Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)) as Uint8Array<ArrayBuffer>;
}

export function headerValue(
  message: GmailMessage,
  name: string,
): string | null {
  const header = message.payload?.headers?.find(
    (item) => item.name.toLowerCase() === name.toLowerCase(),
  );
  return header?.value ?? null;
}

/** Ends the grant at Google as well as here. Forgetting the row alone leaves the
 *  app authorised on the account with nothing pointing at it. */
export async function revokeGmail(): Promise<void> {
  const refresh = await readGoogleRefreshToken();
  if (refresh) {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: refresh }),
      cache: "no-store",
    }).catch(() => {
      // Already revoked at Google, or offline. The row goes either way — a
      // credential we cannot use is not one to keep.
    });
  }
  cached = null;
  await db.oAuthCredential.deleteMany({ where: { provider: "google" } });
}
