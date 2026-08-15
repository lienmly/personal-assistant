import { centsFromText } from "@/lib/money";

/**
 * How a property's fields are read, and when it may be deleted.
 *
 * **Client-safe: no Prisma import**, the same split `lib/media-rules.ts` makes
 * against `lib/media-store.ts` and for the same reason — the form and the server
 * action must refuse the same input in the same words, and the only way to
 * guarantee that is one copy of the rules that both can reach.
 *
 * It is also the only part of the write path that can be tested without a
 * request scope: a `"use server"` action calls `auth()`, which needs
 * `next/headers`, so it cannot run from a script at all. Putting the parsing and
 * the delete guard here means the two places bugs actually live are covered by
 * `scripts/property-check.mts`, and the action is left as the thin auth wrapper
 * it should be.
 */

/** A money field typed by hand. Accepts "985,000", "$985000", "985000.00" —
 *  and it is `centsFromText`, the same parser the statement extractor uses, so
 *  a figure typed in and one read off a PDF cannot disagree about what it says. */
export function parseMoneyField(raw: string | null): number | null {
  return centsFromText(raw);
}

/**
 * A percentage typed as "20", "20.5" or "20%" → basis points.
 *
 * Returns `null` for anything outside 0–100 rather than clamping. A land
 * allocation of 140% is a typo, and silently storing 100% would produce a
 * depreciation figure that is confidently wrong — which is the exact failure
 * `Property.landAllocationBasisPoints` is documented against.
 */
export function parseBasisPoints(raw: string | null): number | null {
  if (!raw) return null;
  const value = Number(raw.replace(/[%\s]/g, ""));
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  return Math.round(value * 100);
}

/** `<input type="date">` → UTC midnight, for a `@db.Date` (CLAUDE.md §6). */
export function parseDateOnly(raw: string | null): Date | null {
  if (!raw) return null;
  const [year, month, day] = raw.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

/** "https://brightproperty.com/" → "brightproperty.com". The Gmail query in
 *  Layer 4 matches on a bare domain, and a pasted URL is what people paste. */
export function parseDomain(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
  return trimmed === "" ? null : trimmed;
}

export type PropertyCounts = {
  transactions: number;
  leases: number;
  valuations: number;
};

/**
 * Why this property cannot be deleted, as a sentence, or `null`.
 *
 * `deleteProject`'s rule, one noun over: every relation pointing at a Property
 * is either `SetNull` (transactions, which must survive) or `Cascade`
 * (valuations, loans, leases, and in Layer 4 the statement PDFs). Cascade is
 * right for one row and disastrous in bulk — deleting a property would destroy
 * the documents its tax figures were computed from, and those are the one thing
 * here that cannot be typed again.
 *
 * So delete is for the one you named wrong two minutes ago, and everything else
 * is marked sold. The message **names what is holding it**, because a refusal
 * that does not say why reads as a bug.
 */
export function propertyDeleteBlocker(counts: PropertyCounts): string | null {
  const holding = [
    counts.transactions > 0
      ? `${counts.transactions} claimed ${counts.transactions === 1 ? "transaction" : "transactions"}`
      : null,
    counts.leases > 0
      ? `${counts.leases} ${counts.leases === 1 ? "lease" : "leases"}`
      : null,
    // Two is the noise floor: a property refreshed twice has barely any history,
    // and refusing over it would make a mistyped address undeletable after a
    // month of automatic valuations.
    counts.valuations > 2 ? `${counts.valuations} valuations` : null,
  ].filter(Boolean);

  if (holding.length === 0) return null;

  return `That property still has ${holding.join(" and ")}. Mark it sold instead — deleting would take the history with it.`;
}

/**
 * What is still missing before depreciation can be estimated.
 *
 * Rendered as a prompt rather than a warning, and Layer 5 refuses to compute
 * without both. The land split comes off the county assessor's ratio and the app
 * cannot derive it; a plausible guess is wrong by thousands of dollars a year
 * and looks exactly like a real figure.
 */
export function depreciationBlocker(input: {
  landAllocationBasisPoints: number | null;
  placedInServiceOn: Date | null;
}): string | null {
  const noLand = input.landAllocationBasisPoints === null;
  const noDate = !input.placedInServiceOn;

  if (noLand && noDate) {
    return "Needs the land/improvement split and the date it was first available to rent";
  }
  if (noLand) return "Needs the land/improvement split from the county assessor";
  if (noDate) return "Needs the date it was first available to rent";
  return null;
}
