import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * Authenticated encryption for the two standing grants the Ledger holds.
 *
 * There are exactly two secrets in this application and they are both worse
 * than a password. A Plaid access token reads balances and two years of
 * transactions and **does not expire** — and unlike a password, the bank cannot
 * change it. A Google refresh token reads an entire mailbox. Neither is ever
 * shown to anyone, neither is ever compared, and both are read on a code path
 * that already has a database connection: which is precisely the shape that
 * wants sealing rather than hashing.
 *
 * AES-256-GCM, from `node:crypto`. No dependency, and GCM rather than CBC
 * because a bare ciphertext with no authentication tag is malleable — an
 * attacker who can write to the column could flip bits in a token and learn
 * something from how the request fails. GCM makes tampering a decryption error.
 *
 * ## What this actually protects against — stated honestly
 *
 * A **database dump**: a downloaded backup, a leaked `DATABASE_PUBLIC_URL`, a
 * Prisma Studio session left open on a laptop. That is a real threat here,
 * because this database is reachable over a public proxy in development.
 *
 * It does **not** protect against a compromised app host, which necessarily
 * holds the key, and anyone with Railway project access can read the variable.
 * Saying so is the point: encryption presented as more than it is, is worse than
 * none, because it buys a confidence that changes behaviour.
 *
 * ## Why the key is resolved lazily
 *
 * The obvious build throws at module load if `LEDGER_ENCRYPTION_KEY` is absent,
 * which fails closed — the right instinct, and the wrong blast radius. This
 * module is reachable from `/ledger`, and a module-scope throw turns a missing
 * environment variable into a 500 with a stack trace instead of a screen that
 * says which variable is missing. So the key is resolved on use, `configured()`
 * answers without throwing, and the Ledger renders an empty state naming the
 * problem. Same posture as `DEEPSEEK_API_KEY`: without it the drawer opens and
 * says so, and nothing else in the app breaks.
 */

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
/** 96 bits, which is the size GCM is specified around; anything else forces the
 *  implementation through a hash step and buys nothing. */
const IV_BYTES = 12;
const KEY_BYTES = 32;

type KeyProblem = { ok: false; message: string };
type KeyOk = { ok: true; key: Buffer };

function readKey(variable: string): KeyOk | KeyProblem {
  const raw = process.env[variable];
  if (!raw || raw.trim() === "") {
    return { ok: false, message: `${variable} is not set.` };
  }

  let key: Buffer;
  try {
    key = Buffer.from(raw.trim(), "base64");
  } catch {
    return { ok: false, message: `${variable} is not valid base64.` };
  }

  if (key.byteLength !== KEY_BYTES) {
    return {
      ok: false,
      message: `${variable} decodes to ${key.byteLength} bytes; it must be ${KEY_BYTES}. Generate one with: openssl rand -base64 32`,
    };
  }

  return { ok: true, key };
}

/**
 * Whether sealing is possible at all, as a sentence or `null`.
 *
 * Returned rather than thrown, so `/ledger` can say "the Ledger needs
 * LEDGER_ENCRYPTION_KEY" instead of crashing — the same shape as
 * `mediaProblem()`, and for the same reason: a refusal a screen can render.
 */
export function encryptionProblem(): string | null {
  const result = readKey("LEDGER_ENCRYPTION_KEY");
  return result.ok ? null : result.message;
}

export function encryptionConfigured(): boolean {
  return encryptionProblem() === null;
}

function requireKey(): Buffer {
  const result = readKey("LEDGER_ENCRYPTION_KEY");
  if (!result.ok) throw new Error(result.message);
  return result.key;
}

/**
 * Seal a secret.
 *
 * `aad` is additional authenticated data — it is not encrypted, it is *bound*
 * to the ciphertext, so decryption fails unless the same label is supplied.
 * Every caller passes a per-column label (`"plaid:access_token"`), which means a
 * ciphertext lifted out of `PlaidItem.accessTokenEnc` and written into
 * `OAuthCredential.refreshTokenEnc` will not decrypt. That is a small
 * protection and a free one: it costs a string and it removes a whole class of
 * confused-deputy mistake, including the one where a developer writes a
 * migration that moves a column.
 */
export function seal(plaintext: string, aad: string): string {
  const key = requireKey();
  const iv = randomBytes(IV_BYTES);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return [
    VERSION,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

/**
 * Open a sealed secret.
 *
 * Tries the current key, then `LEDGER_ENCRYPTION_KEY_PREVIOUS` if it is set —
 * which is the whole of key rotation: set the old key as PREVIOUS, set a new
 * key as current, and every secret re-seals the next time it is written. The
 * `v1.` prefix is there so a future algorithm change is a branch rather than a
 * guess about what the bytes mean.
 *
 * Throws on failure, and that is correct: a ciphertext that will not open is
 * either tampering or a lost key, and both are bugs rather than refusals. The
 * callers in `lib/secret-store.ts` are the only ones, and they are on paths
 * where there is nothing sensible to degrade to.
 */
export function open(sealed: string, aad: string): string {
  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Sealed value is not in the expected format.");
  }

  const [, ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(ctB64, "base64");

  const keys: Buffer[] = [requireKey()];
  const previous = readKey("LEDGER_ENCRYPTION_KEY_PREVIOUS");
  if (previous.ok) keys.push(previous.key);

  for (const key of keys) {
    try {
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAAD(Buffer.from(aad, "utf8"));
      decipher.setAuthTag(tag);
      return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      // Try the previous key before giving up. A GCM tag mismatch is what a
      // wrong key looks like, and it is indistinguishable from tampering — so
      // there is nothing to log here that would tell the two apart.
    }
  }

  throw new Error(
    "Could not open a sealed value. The encryption key has changed without a rotation window, or the value was tampered with.",
  );
}

/**
 * Constant-time string comparison, for the job runner's bearer token.
 *
 * `timingSafeEqual` throws on a length mismatch, which would itself leak the
 * length — so the lengths are checked first and a mismatch returns `false`
 * without comparing. That is not a leak worth closing: the token's length is not
 * the secret, and the alternative (padding to a fixed size) makes the caller
 * responsible for a detail it should not have to know.
 */
export function secretEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.byteLength !== right.byteLength) return false;
  return timingSafeEqual(left, right);
}
