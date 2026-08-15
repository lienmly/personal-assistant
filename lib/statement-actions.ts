"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueue } from "@/lib/ledger-jobs";
import { centsFromText } from "@/lib/money";
import { revokeGmail } from "@/lib/gmail";
import {
  SCHEDULE_E_LINE,
  STATEMENT_KINDS,
  lowestConfidence,
  reconciles,
  statementProblem,
} from "@/lib/statement-rules";
import { findBySha256, putStatementDocument, sha256 } from "@/lib/statement-store";

/**
 * Everything the statement review screen writes.
 *
 * The house conventions: every action re-checks the session, and **a refusal is
 * a returned value while a bug throws** — "that statement does not reconcile"
 * has to reach the screen, and React redacts thrown messages in production.
 */

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Not signed in");
  return session;
}

function refresh() {
  revalidatePath("/ledger");
  revalidatePath("/ledger/connections");
}

export type StatementResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

/**
 * Upload a statement by hand.
 *
 * **A first-class path, not a fallback**, and it is what made this layer
 * testable at all: it needs neither the Gmail grant nor the poll, so the whole
 * pipeline from `putStatementDocument` onward could be built and exercised
 * before any OAuth existed. It is also the answer when the manager changes
 * sender, or emails a portal link instead of a PDF.
 */
export async function uploadStatement(
  form: FormData,
): Promise<StatementResult> {
  await requireSession();

  const file = form.get("file");
  if (!(file instanceof File)) {
    return { ok: false, message: "No file arrived." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer()) as Uint8Array<ArrayBuffer>;

  const problem = statementProblem({
    mimeType: file.type || "application/pdf",
    byteLength: bytes.byteLength,
  });
  if (problem) return { ok: false, message: problem };

  // The same document twice is one document, whatever it was called this time.
  const existing = await findBySha256(sha256(bytes));
  if (existing) {
    return {
      ok: false,
      message: "That exact statement is already here — it was uploaded before.",
    };
  }

  const propertyId = form.get("propertyId");
  const now = new Date();

  const statement = await db.propertyStatement.create({
    data: {
      // A placeholder until the extractor reads the real period off the
      // document. Deliberately this month rather than a guess at what the
      // statement covers — asserting the wrong month would file it in the wrong
      // tax year, and the document is about to say.
      periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      periodEnd: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)),
      source: "upload",
      status: "pending",
      propertyId: typeof propertyId === "string" && propertyId ? propertyId : null,
    },
    select: { id: true },
  });

  try {
    await putStatementDocument({
      statementId: statement.id,
      data: bytes,
      mimeType: file.type || "application/pdf",
      filename: file.name || null,
    });
  } catch (cause) {
    // Do not leave a statement with no document behind — it would sit in the
    // queue forever waiting for bytes that are not coming.
    await db.propertyStatement.delete({ where: { id: statement.id } });
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Could not store that file.",
    };
  }

  await enqueue("statement_extract", statement.id);
  refresh();
  return { ok: true, id: statement.id };
}

/** Re-run the extractor — after a correction to the property, or when a first
 *  pass produced nothing useful. */
export async function reextractStatement(
  statementId: string,
): Promise<StatementResult> {
  await requireSession();
  await enqueue("statement_extract", statementId);
  refresh();
  return { ok: true, id: statementId };
}

/**
 * Correct one row.
 *
 * Every field is editable, because the extractor is a transcriber and a
 * transcriber can misread. Changing an amount or a kind **re-runs
 * reconciliation**, so a correction that fixes the arithmetic unlocks the accept
 * button immediately and one that breaks it says so at once — rather than at the
 * moment you press accept, which is the wrong time to find out.
 */
export async function saveLineItem(form: FormData): Promise<StatementResult> {
  await requireSession();

  const id = form.get("id");
  if (typeof id !== "string" || !id) {
    return { ok: false, message: "Which row?" };
  }

  const amountCents = centsFromText(String(form.get("amount") ?? ""));
  if (amountCents === null) {
    return { ok: false, message: "That amount could not be read." };
  }

  const kindRaw = String(form.get("kind") ?? "");
  const kind = (STATEMENT_KINDS as readonly string[]).includes(kindRaw)
    ? kindRaw
    : "other_income";

  const row = await db.statementLineItem.update({
    where: { id },
    data: {
      description: String(form.get("description") ?? "").trim() || "—",
      amountCents,
      kind,
      taxCategory: SCHEDULE_E_LINE[kind] ?? null,
      // A row a human has looked at is certain by definition — the confidence
      // was only ever the extractor's own doubt, and keeping it low afterwards
      // would leave the statement permanently flagged for a row that is fine.
      confidence: 100,
      reviewedAt: new Date(),
    },
    select: { statementId: true },
  });

  await recheck(row.statementId);
  refresh();
  return { ok: true, id: row.statementId };
}

export async function deleteLineItem(id: string): Promise<StatementResult> {
  await requireSession();
  const row = await db.statementLineItem.delete({
    where: { id },
    select: { statementId: true },
  });
  await recheck(row.statementId);
  refresh();
  return { ok: true, id: row.statementId };
}

/** Re-runs the check and writes the outcome. Called after any edit. */
async function recheck(statementId: string): Promise<void> {
  const statement = await db.propertyStatement.findUnique({
    where: { id: statementId },
    select: {
      statedIncomeCents: true,
      statedExpenseCents: true,
      lineItems: { select: { amountCents: true, kind: true, confidence: true } },
    },
  });
  if (!statement) return;

  const check = reconciles({
    lineItems: statement.lineItems,
    statedIncomeCents: statement.statedIncomeCents,
    statedExpenseCents: statement.statedExpenseCents,
  });

  await db.propertyStatement.update({
    where: { id: statementId },
    data: {
      problem: check.ok ? null : check.problem,
      confidence: lowestConfidence(statement.lineItems),
    },
    select: { id: true },
  });
}

/**
 * Accept a statement.
 *
 * **Refused unless it reconciles**, and unless it is attached to a property.
 * This is the one gate in the Ledger that a person cannot simply override, and
 * that is deliberate: everything downstream — the Schedule E, the cash flow, the
 * tax estimate — reads accepted statements as fact, and a set of rows that does
 * not add up to the totals printed on the document is not a fact.
 *
 * Accepting stamps every unreviewed row, because accepting *is* the review.
 */
export async function acceptStatement(
  statementId: string,
): Promise<StatementResult> {
  await requireSession();

  const statement = await db.propertyStatement.findUnique({
    where: { id: statementId },
    select: {
      id: true,
      propertyId: true,
      statedIncomeCents: true,
      statedExpenseCents: true,
      lineItems: { select: { amountCents: true, kind: true } },
    },
  });
  if (!statement) return { ok: false, message: "That statement is gone." };

  if (!statement.propertyId) {
    return {
      ok: false,
      message: "Say which property this belongs to first.",
    };
  }

  if (statement.lineItems.length === 0) {
    return { ok: false, message: "There are no rows to accept." };
  }

  const check = reconciles({
    lineItems: statement.lineItems,
    statedIncomeCents: statement.statedIncomeCents,
    statedExpenseCents: statement.statedExpenseCents,
  });
  if (!check.ok) return { ok: false, message: check.problem };

  const now = new Date();
  await db.$transaction([
    db.statementLineItem.updateMany({
      where: { statementId, reviewedAt: null },
      data: { reviewedAt: now },
    }),
    db.propertyStatement.update({
      where: { id: statementId },
      data: { status: "accepted", acceptedAt: now, problem: null },
      select: { id: true },
    }),
  ]);

  refresh();
  return { ok: true, id: statementId };
}

/** Set aside a statement that is a duplicate, a mis-file, or unreadable. Kept
 *  rather than deleted, so the same PDF arriving again is still recognised by
 *  its hash and does not come back round the loop. */
export async function rejectStatement(
  statementId: string,
): Promise<StatementResult> {
  await requireSession();
  await db.propertyStatement.update({
    where: { id: statementId },
    data: { status: "rejected" },
    select: { id: true },
  });
  refresh();
  return { ok: true, id: statementId };
}

/** Attach a statement to a property — the one thing the extractor deliberately
 *  will not guess when there is more than one candidate. */
export async function assignStatement(
  statementId: string,
  propertyId: string,
): Promise<StatementResult> {
  await requireSession();
  await db.propertyStatement.update({
    where: { id: statementId },
    data: { propertyId },
    select: { id: true },
  });
  refresh();
  return { ok: true, id: statementId };
}

/** Look in the mailbox now rather than waiting for the hourly check. */
export async function scanMailNow(): Promise<StatementResult> {
  await requireSession();
  await enqueue("gmail_scan");
  refresh();
  return { ok: true, id: "queued" };
}

/** Disconnect Gmail — revokes at Google, then deletes the row. */
export async function disconnectGmail(): Promise<StatementResult> {
  await requireSession();
  await revokeGmail();
  refresh();
  return { ok: true, id: "disconnected" };
}
