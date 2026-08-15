import { createHash } from "node:crypto";

import { db } from "@/lib/db";
import { statementProblem } from "@/lib/statement-rules";

/**
 * The one place that touches statement **bytes**.
 *
 * `lib/media-store.ts`'s seam, for the third time in this codebase and for the
 * same reason: **nothing else may `select` `StatementDocument.data`.** Every
 * other query names its columns, so a bare `findMany` on the table cannot drag a
 * year of PDFs into memory to render a list of filenames, and the bytes never
 * travel through a server component or an action's return value — they are
 * served by `app/api/ledger/statements/[id]/route.ts` alone.
 *
 * Moving these to R2 later is this file plus a nullable `storageKey`, exactly as
 * `media-store` documents. That property is what it exists to preserve.
 */

export {
  ACCEPTED_STATEMENT_MIME,
  MAX_STATEMENT_BYTES,
  statementProblem,
} from "@/lib/statement-rules";

export function sha256(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Has this exact document already been stored?
 *
 * **The hash, not the message id, is what makes ingestion idempotent.** The same
 * attachment can arrive twice with different message ids — forwarded to
 * yourself, re-sent by the manager, or picked up again by a re-scan after a
 * failure — and each of those would otherwise create a second statement and
 * double a month's figures. Two documents with identical bytes are one document.
 */
export async function findBySha256(
  digest: string,
): Promise<{ id: string; statementId: string } | null> {
  return db.statementDocument.findUnique({
    where: { sha256: digest },
    select: { id: true, statementId: true },
  });
}

export type NewStatementDocument = {
  statementId: string;
  data: Uint8Array<ArrayBuffer>;
  mimeType: string;
  filename: string | null;
};

/** Stores one PDF against a statement. Re-validates and throws — a caller that
 *  reached here with an unacceptable file is a bug, not a user error. */
export async function putStatementDocument(
  input: NewStatementDocument,
): Promise<string> {
  const problem = statementProblem({
    mimeType: input.mimeType,
    byteLength: input.data.byteLength,
  });
  if (problem) throw new Error(problem);

  const row = await db.statementDocument.create({
    data: {
      statementId: input.statementId,
      data: input.data,
      mimeType: input.mimeType.split(";")[0].trim().toLowerCase(),
      byteSize: input.data.byteLength,
      filename: input.filename,
      sha256: sha256(input.data),
    },
    select: { id: true },
  });

  return row.id;
}

/** Reads one back. The only `select` of `data` in the codebase. */
export async function readStatementDocument(
  id: string,
): Promise<{
  data: Uint8Array<ArrayBuffer>;
  mimeType: string;
  filename: string | null;
} | null> {
  const row = await db.statementDocument.findUnique({
    where: { id },
    select: { data: true, mimeType: true, filename: true },
  });
  if (!row) return null;
  return { data: row.data, mimeType: row.mimeType, filename: row.filename };
}

/** The extracted text, stored once so re-running the structurer never re-parses
 *  the PDF — and so a bad extraction can be diffed against what the parser
 *  actually saw rather than against the document a human is reading. */
export async function saveExtractedText(
  documentId: string,
  text: string,
  pageCount: number,
): Promise<void> {
  await db.statementDocument.update({
    where: { id: documentId },
    data: { text, pageCount },
    select: { id: true },
  });
}
