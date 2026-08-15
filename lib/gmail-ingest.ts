import { db } from "@/lib/db";
import {
  accessToken,
  findPdfPart,
  getAttachment,
  getMessage,
  headerValue,
  searchMessages,
} from "@/lib/gmail";
import { enqueue } from "@/lib/ledger-jobs";
import {
  findBySha256,
  putStatementDocument,
  sha256,
} from "@/lib/statement-store";
import { statementProblem } from "@/lib/statement-rules";

/**
 * Finding owner statements in the mailbox.
 *
 * **Materialise on read, not push.** Gmail's push notifications need a Google
 * Cloud Pub/Sub topic *and* a `users.watch` subscription that **expires every
 * seven days** and must be renewed — which needs a scheduler, which this app
 * does not have (§6). An owner statement arrives once a month. Scanning when the
 * Property or Tax tab is opened, at most once an hour, is absurd headroom for
 * zero infrastructure.
 *
 * The honest failure mode is stated on the surface rather than hidden: if the
 * manager changes sender, or stops attaching the PDF and starts linking to a
 * portal, this yields nothing — so the Property tab says when the last statement
 * arrived and when the next is expected, because **an automation that goes quiet
 * is the thing being designed against.**
 */

/** Senders worth looking at even before a manager domain is recorded. */
const STANDING_SENDERS = ["appfolio.com", "buildium.com", "propertyware.com"];

/** Sixty days, so a month missed is still picked up on the next scan without
 *  ever walking the whole mailbox. */
const WINDOW_DAYS = 60;

export function buildQuery(managerDomains: string[]): string {
  const senders = [...new Set([...STANDING_SENDERS, ...managerDomains])].filter(
    Boolean,
  );
  const from = senders.map((domain) => `from:${domain}`).join(" OR ");
  return `(${from}) has:attachment filename:pdf newer_than:${WINDOW_DAYS}d`;
}

/**
 * Scan for statements, store what is new, and queue extraction.
 *
 * Idempotent twice over: a message id already stored is skipped without
 * fetching the attachment, and an attachment whose **bytes** have been seen
 * before is skipped even under a different message id — which is what makes a
 * forwarded copy, a re-sent statement, or a re-scan after a failure cost
 * nothing rather than double a month.
 */
export async function scanMail(): Promise<string> {
  const token = await accessToken();
  if (!token) return "Gmail is not connected.";

  const properties = await db.property.findMany({
    where: { status: { not: "sold" } },
    select: { id: true, managerDomain: true, addressLine: true, postalCode: true },
  });

  const domains = properties
    .map((property) => property.managerDomain)
    .filter((domain): domain is string => Boolean(domain));

  const refs = await searchMessages(buildQuery(domains), token);
  if (refs.length === 0) return "Nothing new in the mailbox.";

  const known = new Set(
    (
      await db.propertyStatement.findMany({
        where: { gmailMessageId: { in: refs.map((ref) => ref.id) } },
        select: { gmailMessageId: true },
      })
    ).map((row) => row.gmailMessageId),
  );

  let stored = 0;
  let skipped = 0;

  for (const ref of refs) {
    if (known.has(ref.id)) {
      skipped += 1;
      continue;
    }

    const message = await getMessage(ref.id, token);
    const part = findPdfPart(message.payload);
    if (!part?.body?.attachmentId) {
      skipped += 1;
      continue;
    }

    const bytes = await getAttachment(ref.id, part.body.attachmentId, token);

    const problem = statementProblem({
      mimeType: "application/pdf",
      byteLength: bytes.byteLength,
    });
    if (problem) {
      skipped += 1;
      continue;
    }

    // The bytes, not the message id, are the identity of a document.
    if (await findBySha256(sha256(bytes))) {
      skipped += 1;
      continue;
    }

    const received = message.internalDate
      ? new Date(Number(message.internalDate))
      : new Date();

    // The period is filled in by the extractor from the document itself. These
    // are a placeholder so the row is valid, and are deliberately the month the
    // mail arrived rather than a guess at the month it covers — a statement
    // arrives *after* its period, and asserting the wrong month here would put
    // it in the wrong tax year.
    const periodStart = new Date(
      Date.UTC(received.getUTCFullYear(), received.getUTCMonth(), 1),
    );
    const periodEnd = new Date(
      Date.UTC(received.getUTCFullYear(), received.getUTCMonth() + 1, 0),
    );

    const statement = await db.propertyStatement.create({
      data: {
        periodStart,
        periodEnd,
        source: "gmail",
        gmailMessageId: ref.id,
        gmailReceivedAt: received,
        status: "pending",
        // Attached only when there is exactly one property it could belong to.
        // With two, the address has to be read off the document, and that is the
        // extractor's job — guessing here would be the same error as attaching a
        // mortgage by address similarity (§6).
        propertyId: properties.length === 1 ? properties[0].id : null,
      },
      select: { id: true },
    });

    await putStatementDocument({
      statementId: statement.id,
      data: bytes,
      mimeType: "application/pdf",
      filename: part.filename ?? headerValue(message, "Subject") ?? null,
    });

    await enqueue("statement_extract", statement.id);
    stored += 1;
  }

  await db.ledgerCursor.upsert({
    where: { key: "gmail:lastScanAt" },
    update: { value: new Date().toISOString() },
    create: { key: "gmail:lastScanAt", value: new Date().toISOString() },
    select: { key: true },
  });

  if (stored === 0) return `Nothing new (${skipped} already seen).`;
  return `Found ${stored} new ${stored === 1 ? "statement" : "statements"}.`;
}

/** How long since the mailbox was last looked at. Read by `ensureLedgerJobs`. */
export async function lastScanAt(): Promise<Date | null> {
  const cursor = await db.ledgerCursor.findUnique({
    where: { key: "gmail:lastScanAt" },
    select: { value: true },
  });
  if (!cursor) return null;
  const when = new Date(cursor.value);
  return Number.isNaN(when.getTime()) ? null : when;
}
