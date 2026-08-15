import { extractText as pdfText, getDocumentProxy } from "unpdf";

import { db } from "@/lib/db";
import { completeJson } from "@/lib/deepseek";
import { centsFromText } from "@/lib/money";
import {
  SCHEDULE_E_LINE,
  STATEMENT_KINDS,
  lowestConfidence,
  reconciles,
} from "@/lib/statement-rules";
import { readStatementDocument, saveExtractedText } from "@/lib/statement-store";

/**
 * A PDF owner statement, turned into rows.
 *
 * Two steps and they fail differently. `unpdf` turns the PDF into text, which
 * either works or produces mojibake; a model turns that text into structured
 * rows, which can fail *plausibly*. The second failure is the dangerous one, and
 * the whole defence against it is that **the document carries its own
 * checksum**: the statement prints its income and expense totals, the model is
 * asked for those and for the rows separately, and `reconciles()` requires them
 * to agree to the cent.
 *
 * **Nothing here ever sets `accepted`.** A statement that reconciles is
 * `needs_review` with the button enabled; a statement that does not is
 * `needs_review` with the button disabled and a sentence saying why. Only a
 * person accepts.
 */

/** A hard ceiling on what is sent to the model. An owner statement is one or
 *  two pages; anything past this is a bundled annual pack or a scan that
 *  produced junk, and truncating is cheaper than a refused 40,000-token call. */
const MAX_TEXT_CHARS = 24_000;

export type ExtractedLineItem = {
  on: string | null;
  description: string;
  payee: string | null;
  amount: string;
  kind: string;
  confidence: number;
  rawText: string | null;
};

export type ExtractedStatement = {
  periodStart: string | null;
  periodEnd: string | null;
  propertyAddress: string | null;
  statedIncome: string | null;
  statedExpense: string | null;
  statedDistribution: string | null;
  beginningBalance: string | null;
  endingBalance: string | null;
  lineItems: ExtractedLineItem[];
};

const SYSTEM = `You transcribe property-management owner statements into JSON. You are a transcriber, not an analyst.

RULES — these matter more than completeness:
1. Return ONLY values that appear verbatim in the text. Never compute, infer, correct or complete a figure. If something is not printed, return null.
2. Amounts are strings, exactly as printed, including any currency symbol, comma, minus sign, parentheses or CR/DR marker. Do not normalise them.
3. SIGN: positive is money IN to the owner (rent, other income). Negative is money OUT (management fees, repairs, insurance, taxes). Use a leading minus for money out, unless the statement already prints parentheses or DR — in which case copy that.
4. The summary totals (statedIncome, statedExpense, statedDistribution, beginningBalance, endingBalance) must be read from the statement's OWN summary block. Never add up the line items to produce them. They are checked against the line items later, and that check is the only thing making this transcription trustworthy — if you compute them, the check becomes meaningless.
5. Dates are YYYY-MM-DD. If a row shows only a day and month, use the statement period's year.
6. confidence is 0-100 for EACH row: how certain you are that the description and amount are exactly what is printed. Use a low number when the text is garbled, a column is ambiguous, or you had to choose between two readings. Do not be generous.
7. rawText is the source line, verbatim, so a human can check the row without opening the PDF.

kind must be one of: ${STATEMENT_KINDS.join(", ")}.
 - management_fee: the manager's percentage or flat fee.
 - leasing_fee: a one-off charge for placing a tenant.
 - repair: fixing something that already existed.
 - capital: replacing or adding something substantial — a roof, a water heater, an appliance, a remodel. When a charge could be either, use "repair" and set a LOW confidence; a human decides.
 - distribution: money paid out to the owner. Not an expense.
 - reserve: money held back or topped up. Not an expense.

Return this shape and nothing else:
{"periodStart":null,"periodEnd":null,"propertyAddress":null,"statedIncome":null,"statedExpense":null,"statedDistribution":null,"beginningBalance":null,"endingBalance":null,"lineItems":[{"on":null,"description":"","payee":null,"amount":"","kind":"","confidence":0,"rawText":null}]}`;

/**
 * Pulls the text out of a stored PDF and keeps it.
 *
 * `unpdf` is imported statically rather than lazily. The lazy version reads
 * better — it inlines a build of pdf.js, so deferring it is the instinct — and
 * it cannot be run from a script: `tsx` transpiles this module to CommonJS and
 * the dynamic specifier fails to resolve against a `data:` URL. Since this is
 * server-only either way and pdf.js never reaches a browser bundle, the static
 * import costs nothing and buys back `scripts/statement-check.mts`, which is
 * the only place the extraction is exercised end to end.
 */
export async function extractText(
  documentId: string,
): Promise<{ text: string; pageCount: number }> {
  const stored = await readStatementDocument(documentId);
  if (!stored) throw new Error("No such statement document.");

  const pdf = await getDocumentProxy(new Uint8Array(stored.data));
  const { text, totalPages } = await pdfText(pdf, { mergePages: true });

  const merged = Array.isArray(text) ? text.join("\n") : text;
  await saveExtractedText(documentId, merged, totalPages);

  return { text: merged, pageCount: totalPages };
}

function dateOnly(value: string | null): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function clampConfidence(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

/**
 * Read a stored statement and write its rows.
 *
 * Runs the reconciliation and records the outcome. **The status never becomes
 * `accepted` here** — the most it can be is `needs_review` with nothing wrong,
 * because the check catches every error that changes a total and no error that
 * does not. A repair mislabelled as insurance adds up perfectly.
 */
export async function extractStatement(statementId: string): Promise<string> {
  const statement = await db.propertyStatement.findUnique({
    where: { id: statementId },
    select: { id: true, document: { select: { id: true, text: true } } },
  });
  if (!statement?.document) throw new Error("That statement has no document.");

  const text =
    statement.document.text ??
    (await extractText(statement.document.id)).text;

  if (text.trim().length < 40) {
    await db.propertyStatement.update({
      where: { id: statementId },
      data: {
        problem:
          "Almost no text came out of that PDF — it is probably a scan. It needs entering by hand.",
        extractedAt: new Date(),
      },
      select: { id: true },
    });
    return "No readable text in that PDF.";
  }

  const parsed = await completeJson<ExtractedStatement>({
    system: SYSTEM,
    user: text.slice(0, MAX_TEXT_CHARS),
  });

  const items = (parsed.lineItems ?? [])
    .map((item, index) => {
      const amountCents = centsFromText(item.amount);
      if (amountCents === null) return null;

      const kind = (STATEMENT_KINDS as readonly string[]).includes(item.kind)
        ? item.kind
        : "other_income";

      return {
        on: dateOnly(item.on),
        description: (item.description ?? "").trim() || "—",
        payee: item.payee?.trim() || null,
        amountCents,
        kind,
        taxCategory: SCHEDULE_E_LINE[kind] ?? null,
        // A row whose kind was not recognised is not a row we understood, so it
        // is capped low regardless of what the model claimed about it.
        confidence: (STATEMENT_KINDS as readonly string[]).includes(item.kind)
          ? clampConfidence(item.confidence)
          : Math.min(40, clampConfidence(item.confidence)),
        rawText: item.rawText?.trim() || null,
        sortOrder: index,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const statedIncomeCents = centsFromText(parsed.statedIncome);
  const statedExpenseCents = absOrNull(centsFromText(parsed.statedExpense));

  const check = reconciles({
    lineItems: items,
    statedIncomeCents,
    statedExpenseCents,
  });

  const periodStart = dateOnly(parsed.periodStart);
  const periodEnd = dateOnly(parsed.periodEnd);

  await db.$transaction([
    // Replaced wholesale: re-extracting must not append a second set of rows to
    // the first, and a partial overwrite would leave rows from two readings of
    // the same page.
    db.statementLineItem.deleteMany({ where: { statementId } }),
    db.propertyStatement.update({
      where: { id: statementId },
      data: {
        ...(periodStart ? { periodStart } : {}),
        ...(periodEnd ? { periodEnd } : {}),
        statedIncomeCents,
        statedExpenseCents,
        statedDistributionCents: centsFromText(parsed.statedDistribution),
        beginningBalanceCents: centsFromText(parsed.beginningBalance),
        endingBalanceCents: centsFromText(parsed.endingBalance),
        confidence: lowestConfidence(items),
        problem: check.ok ? null : check.problem,
        status: "needs_review",
        extractedAt: new Date(),
        extractorModel: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
        lineItems: { create: items },
      },
      select: { id: true },
    }),
  ]);

  return check.ok
    ? `Read ${items.length} ${items.length === 1 ? "row" : "rows"}; it reconciles.`
    : `Read ${items.length} rows — ${check.problem}`;
}

/** A statement's expense total is printed as a positive figure on most
 *  statements and as a negative on some. `reconciles` compares magnitudes, so
 *  the sign is normalised here rather than in the model's instructions, where a
 *  rule about signs on totals would fight rule 2's "exactly as printed". */
function absOrNull(value: number | null): number | null {
  return value === null ? null : Math.abs(value);
}
