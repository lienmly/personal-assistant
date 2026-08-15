/**
 * What a statement may be, and whether one adds up.
 *
 * **Client-safe: no Prisma import**, the same split `lib/media-rules.ts` makes —
 * the upload control and the server action refuse the same file in the same
 * words, and `reconciles()` can be exercised without a database.
 */

export const ACCEPTED_STATEMENT_MIME = ["application/pdf"] as const;

/**
 * A ceiling on one stored statement.
 *
 * 6MB, matching `MAX_MEDIA_BYTES` and for the same reason: it sits under
 * `serverActions.bodySizeLimit` in `next.config.ts` (8MB), so an oversized file
 * is refused with a sentence rather than by a truncated request. A real owner
 * statement is around 80KB, so this is a backstop rather than a constraint.
 */
export const MAX_STATEMENT_BYTES = 6 * 1024 * 1024;

/** What a line item is, in the management company's terms. Free text in the
 *  column, for the reason `Task.track` is; this is the list the extractor is
 *  given and the review UI offers. */
export const STATEMENT_KINDS = [
  "rent",
  "other_income",
  "management_fee",
  "repair",
  "capital",
  "insurance",
  "property_tax",
  "utilities",
  "hoa",
  "leasing_fee",
  "distribution",
  "reserve",
] as const;

export type StatementKind = (typeof STATEMENT_KINDS)[number];

/**
 * Which Schedule E line a kind lands on.
 *
 * **`distribution` and `reserve` map to nothing on purpose.** An owner draw is
 * money moving from the management company's trust account to yours — it is not
 * income and it is certainly not an expense, and treating it as either is how a
 * rental appears to earn twice or to deduct its own profit. A reserve top-up is
 * the same movement in the other direction.
 *
 * `capital` maps to nothing either, for a different reason: a capital
 * improvement is **not an expense at all**. It becomes an asset with a
 * depreciation schedule (Layer 5), so putting it on a Schedule E line would
 * deduct in one year what the law spreads over 27.5.
 */
export const SCHEDULE_E_LINE: Record<string, string | null> = {
  rent: "rents_received",
  other_income: "rents_received",
  management_fee: "management_fees",
  repair: "repairs",
  insurance: "insurance",
  property_tax: "taxes",
  utilities: "utilities",
  hoa: "other",
  leasing_fee: "commissions",
  capital: null,
  distribution: null,
  reserve: null,
};

/** The lines a Schedule E actually has, in the order it prints them. */
export const SCHEDULE_E_LINES = [
  "rents_received",
  "advertising",
  "auto_travel",
  "cleaning_maintenance",
  "commissions",
  "insurance",
  "legal_professional",
  "management_fees",
  "mortgage_interest",
  "other_interest",
  "repairs",
  "supplies",
  "taxes",
  "utilities",
  "depreciation",
  "other",
] as const;

export const SCHEDULE_E_LABEL: Record<string, string> = {
  rents_received: "Rents received",
  advertising: "Advertising",
  auto_travel: "Auto and travel",
  cleaning_maintenance: "Cleaning and maintenance",
  commissions: "Commissions",
  insurance: "Insurance",
  legal_professional: "Legal and professional",
  management_fees: "Management fees",
  mortgage_interest: "Mortgage interest",
  other_interest: "Other interest",
  repairs: "Repairs",
  supplies: "Supplies",
  taxes: "Taxes",
  utilities: "Utilities",
  depreciation: "Depreciation",
  other: "Other",
};

export const STATEMENT_KIND_LABEL: Record<string, string> = {
  rent: "Rent",
  other_income: "Other income",
  management_fee: "Management fee",
  repair: "Repair",
  capital: "Capital improvement",
  insurance: "Insurance",
  property_tax: "Property tax",
  utilities: "Utilities",
  hoa: "HOA",
  leasing_fee: "Leasing fee",
  distribution: "Owner draw",
  reserve: "Reserve",
};

/** Why this file cannot be stored, as a sentence, or `null`. */
export function statementProblem(item: {
  mimeType: string;
  byteLength: number;
}): string | null {
  const mime = item.mimeType.split(";")[0].trim().toLowerCase();

  if (!(ACCEPTED_STATEMENT_MIME as readonly string[]).includes(mime)) {
    return `That is ${mime || "an unnamed type"} — owner statements have to be PDFs.`;
  }
  if (item.byteLength > MAX_STATEMENT_BYTES) {
    return `That file is ${(item.byteLength / 1024 / 1024).toFixed(1)}MB — the limit is ${MAX_STATEMENT_BYTES / 1024 / 1024}MB.`;
  }
  if (item.byteLength === 0) return "That file is empty.";
  return null;
}

export type ReconcileInput = {
  lineItems: { amountCents: number; kind: string }[];
  statedIncomeCents: number | null;
  statedExpenseCents: number | null;
};

export type ReconcileResult =
  | { ok: true }
  | { ok: false; problem: string; offByCents: number };

/**
 * Do the rows add up to what the statement says about itself?
 *
 * **This is the invariant the whole ingestion pipeline rests on**, and the
 * reason a language model is allowed to read a financial document at all. The
 * extractor is asked for two things separately: the individual rows, and the
 * totals printed in the summary block. If a row is hallucinated, dropped or
 * misread, the two disagree — so the document carries its own checksum and the
 * model is only ever being asked to transcribe it.
 *
 * `distribution` and `reserve` rows are excluded from both sides. They are money
 * moving between the manager's trust account and yours, not income or expense,
 * and a statement's own income/expense totals never include them.
 *
 * **To the cent.** A tolerance would be the obvious kindness and it is exactly
 * wrong: rounding errors do not happen here — every figure is a printed dollar
 * amount — so a discrepancy of any size means something was read incorrectly.
 * The moment a tolerance exists, the failures it hides are the small ones, and a
 * small error in a repair is the same shape as a large one in a fee.
 *
 * **What it cannot catch, stated plainly:** anything that does not change a
 * total. A repair mislabelled as insurance reconciles perfectly and is wrong on
 * the Schedule E. Hence no auto-accept, and `rawText` on every row.
 */
export function reconciles(input: ReconcileInput): ReconcileResult {
  const counted = input.lineItems.filter(
    (item) => item.kind !== "distribution" && item.kind !== "reserve",
  );

  const income = counted
    .filter((item) => item.amountCents > 0)
    .reduce((sum, item) => sum + item.amountCents, 0);
  const expense = counted
    .filter((item) => item.amountCents < 0)
    .reduce((sum, item) => sum - item.amountCents, 0);

  // A statement that prints no totals cannot be reconciled, and that is a
  // refusal rather than a pass. Accepting it would mean trusting a transcription
  // with nothing to check it against, which is the one thing this design exists
  // to avoid.
  if (input.statedIncomeCents === null && input.statedExpenseCents === null) {
    return {
      ok: false,
      problem:
        "The statement's own income and expense totals could not be read, so the rows cannot be checked against anything.",
      offByCents: 0,
    };
  }

  if (
    input.statedIncomeCents !== null &&
    income !== input.statedIncomeCents
  ) {
    const offBy = income - input.statedIncomeCents;
    return {
      ok: false,
      problem: `The income rows add up to ${fmt(income)} but the statement says ${fmt(input.statedIncomeCents)} — off by ${fmt(Math.abs(offBy))}.`,
      offByCents: offBy,
    };
  }

  if (
    input.statedExpenseCents !== null &&
    expense !== input.statedExpenseCents
  ) {
    const offBy = expense - input.statedExpenseCents;
    return {
      ok: false,
      problem: `The expense rows add up to ${fmt(expense)} but the statement says ${fmt(input.statedExpenseCents)} — off by ${fmt(Math.abs(offBy))}.`,
      offByCents: offBy,
    };
  }

  return { ok: true };
}

/** Local, so this module stays free of `lib/money`'s `Intl` instances — it is
 *  imported by the client and only ever formats an error sentence. */
function fmt(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100).toLocaleString("en-US")}.${String(abs % 100).padStart(2, "0")}`;
}

/** The lowest confidence of any row — not the mean. A mean lets nine certain
 *  rows hide the one guess, which is the row that matters. */
export function lowestConfidence(
  items: { confidence: number }[],
): number {
  if (items.length === 0) return 0;
  return items.reduce((low, item) => Math.min(low, item.confidence), 100);
}
