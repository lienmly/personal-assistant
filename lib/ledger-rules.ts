import type { AccountKind } from "@prisma/client";

/**
 * What an account *means* — the decisions the roll-up and the UI must not
 * disagree about.
 *
 * **Client-safe: no Prisma runtime import**, the same rule `lib/tracks.ts`,
 * `lib/calendar-keys.ts` and `lib/media-rules.ts` follow. `AccountKind` is a
 * type-only import, which is erased at compile time, so nothing here drags
 * `lib/db` into a client bundle.
 *
 * The whole reason this file exists is the sign convention. A balance is stored
 * exactly as the institution reports it — **always a positive magnitude**, so a
 * credit card with $2,300 outstanding stores `230000`, not `-230000`. That is
 * the honest thing to store, because it is what the statement says and what a
 * re-fetch would produce again. Whether it adds to or subtracts from net worth
 * is then an *interpretation*, and interpretations belong in one function rather
 * than at every call site. Before this existed, the reflexive alternative — flip
 * the sign at ingest — puts the interpretation in the database, where a change
 * of mind is a backfill.
 */

/** Whether a kind adds to net worth or is owed against it. */
export type NetWorthSide = "asset" | "liability";

/**
 * Which pile of the net worth a kind belongs to.
 *
 * `property` has no `AccountKind` — it comes from `Property.valueCents` in Layer
 * 3 — and is in the union because `NetWorthSnapshot` stores a column for it and
 * the composition bar draws a band for it. A group with no accounts in it simply
 * renders as zero.
 */
export type NetWorthGroup =
  | "liquid"
  | "invested"
  | "retirement"
  | "property"
  | "owed";

export function netWorthSideFor(kind: AccountKind): NetWorthSide {
  switch (kind) {
    case "credit_card":
    case "loan":
    case "mortgage":
      return "liability";
    default:
      return "asset";
  }
}

export function netWorthGroupFor(kind: AccountKind): NetWorthGroup {
  switch (kind) {
    case "checking":
    case "savings":
    case "cash":
      return "liquid";
    case "brokerage":
      return "invested";
    case "retirement":
      return "retirement";
    case "credit_card":
    case "loan":
    case "mortgage":
      return "owed";
    case "other":
      // Plaid's unclassifiable bucket, and it has to go somewhere. `invested`
      // rather than `liquid` on purpose: the dangerous direction of error here
      // is *overstating* money you could spend this afternoon. An account that
      // is really a current account counted as invested understates liquidity,
      // which is a conservative wrong answer; the reverse is the one that gets
      // a bill paid out of money that was never there.
      return "invested";
  }
}

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  checking: "Current account",
  savings: "Savings",
  cash: "Cash",
  brokerage: "Brokerage",
  retirement: "Retirement",
  credit_card: "Credit card",
  loan: "Loan",
  mortgage: "Mortgage",
  other: "Other",
};

export const NET_WORTH_GROUP_LABEL: Record<NetWorthGroup, string> = {
  liquid: "Liquid",
  invested: "Invested",
  retirement: "Retirement",
  property: "Property",
  owed: "Owed",
};

/** The order the groups read in, everywhere: most spendable first, debt last. */
export const NET_WORTH_GROUPS: NetWorthGroup[] = [
  "liquid",
  "invested",
  "retirement",
  "property",
  "owed",
];

/**
 * Plaid's `investment` subtypes that are retirement or otherwise locked up.
 *
 * 529 and HSA are in here and are not retirement accounts, which is worth
 * saying out loud. The group is really "tax-advantaged and not spendable this
 * afternoon", and both qualify — a 529 spent on anything but tuition is
 * penalised and an HSA is earmarked. Putting them in `brokerage` would inflate
 * the figure the Net worth tab presents as investments you could actually sell,
 * which is the same overstatement `other` is kept out of `liquid` to avoid.
 */
const RETIREMENT_SUBTYPES = new Set([
  "401a",
  "401k",
  "403B",
  "403b",
  "457b",
  "529",
  "ira",
  "roth",
  "roth 401k",
  "sep ira",
  "simple ira",
  "sarsep",
  "pension",
  "profit sharing plan",
  "stock plan",
  "thrift savings plan",
  "hsa",
  "rrsp",
  "rrif",
  "prif",
  "lira",
  "lrif",
  "lrsp",
  "lif",
  "resp",
  "rdsp",
  "tfsa",
  "sipp",
  "retirement",
]);

const LIQUID_DEPOSITORY_SUBTYPES = new Set([
  "checking",
  "paypal",
  "prepaid",
  "cash management",
  "ebt",
]);

const SAVINGS_SUBTYPES = new Set(["savings", "cd", "money market"]);

/**
 * Subtypes whose meaning does not depend on Plaid's `type`.
 *
 * An HSA is the only one so far, and it is here because of a real inconsistency
 * caught by running against Plaid's sandbox: it arrives as `depository/hsa` at a
 * bank and `investment/hsa` at a brokerage, and the type branches were putting
 * the first in `savings` — hence in **liquid**, whose label is "spendable this
 * afternoon". An HSA is not. It is spendable on medical expenses, or on anything
 * else with a 20% penalty attached, and counting it as cash overstates the one
 * figure on this screen where overstating is dangerous.
 *
 * The product genuinely differs between the two — one is a deposit account and
 * one holds funds — but what the *net worth* wants to know is whether the money
 * is available, and on that question both answer the same way.
 */
const KIND_BY_SUBTYPE: Record<string, AccountKind> = {
  hsa: "retirement",
};

/**
 * Plaid's `(type, subtype)` → our `AccountKind`.
 *
 * Deliberately total and deliberately forgiving: an unrecognised subtype falls
 * back on the *type*, and an unrecognised type falls back on `other`. Plaid adds
 * subtypes, and the failure mode of a strict mapping is that linking a new
 * institution throws rather than filing the account somewhere reasonable — a
 * dropped account is a wrong net worth, which is worse than a mislabelled one
 * you can see and correct.
 *
 * The raw pair is stored on the row regardless, so correcting this function
 * later is a re-derive over `Account` rather than a re-link of every bank.
 */
export function kindFromPlaid(
  type: string,
  subtype: string | null,
): AccountKind {
  const t = type.trim().toLowerCase();
  const s = (subtype ?? "").trim().toLowerCase();

  // Before the type branches: a handful of subtypes mean the same thing
  // whichever product they arrive as. See `KIND_BY_SUBTYPE`.
  const bySubtype = KIND_BY_SUBTYPE[s];
  if (bySubtype) return bySubtype;

  switch (t) {
    case "depository":
      if (SAVINGS_SUBTYPES.has(s)) return "savings";
      if (LIQUID_DEPOSITORY_SUBTYPES.has(s)) return "checking";
      return "checking";

    case "credit":
      return "credit_card";

    case "loan":
      return s === "mortgage" || s === "home equity" ? "mortgage" : "loan";

    case "investment":
    case "brokerage":
      return RETIREMENT_SUBTYPES.has(s) ? "retirement" : "brokerage";

    default:
      return "other";
  }
}

/**
 * How stale a link may get before the page asks for a refresh.
 *
 * The webhook is the fast path; this is the catch-up that runs when the Ledger
 * is opened, and it is what makes the webhook an *optimisation* rather than a
 * dependency — see `ensureLedgerJobs`. Plaid's sync cursor does not expire, so
 * a missed webhook is a delay and never a hole.
 */
export const SYNC_STALE_HOURS = 24;

/**
 * How far apart the two halves of a transfer may sit.
 *
 * A card payment leaves the current account the day you press the button and
 * lands at the card one to three days later, so an exact-date match finds almost
 * none of them. Four days is wide enough for a weekend and narrow enough that
 * two genuinely unrelated equal-and-opposite amounts are a coincidence rather
 * than a pattern.
 */
export const TRANSFER_WINDOW_DAYS = 4;

/** Plaid item statuses that mean a human has to run Link again, in person,
 *  with a phone. The one part of "automate everything" that cannot be. */
export const NEEDS_ATTENTION = new Set([
  "login_required",
  "pending_expiration",
  "revoked",
]);
