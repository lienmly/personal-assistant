import type { StatementStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { moneyLabel, signedMoneyLabel } from "@/lib/money";
import {
  SCHEDULE_E_LABEL,
  STATEMENT_KIND_LABEL,
} from "@/lib/statement-rules";

/** Everything the statement queue and the review screen read. */

const monthFormat = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export type LineItemView = {
  id: string;
  dayLabel: string | null;
  description: string;
  payee: string | null;
  amountCents: number;
  amountLabel: string;
  kind: string;
  kindLabel: string;
  taxCategoryLabel: string | null;
  confidence: number;
  reviewed: boolean;
  rawText: string | null;
};

export type StatementView = {
  id: string;
  periodLabel: string;
  status: StatementStatus;
  /** Null when it adds up. The sentence saying how far out it is when it does not. */
  problem: string | null;
  confidence: number;
  sourceLabel: string;
  receivedLabel: string | null;
  documentId: string | null;
  filename: string | null;

  propertyId: string | null;
  propertyLabel: string | null;

  statedIncomeLabel: string | null;
  statedExpenseLabel: string | null;
  statedDistributionLabel: string | null;

  /** What the rows actually add up to — shown *beside* the stated totals, so a
   *  discrepancy is visible rather than only described. */
  rowIncomeLabel: string;
  rowExpenseLabel: string;
  netLabel: string;

  lineItems: LineItemView[];
  /** Rows the extractor was least sure about, so review starts where it matters. */
  lowConfidenceCount: number;
  extractedLabel: string | null;
};

export async function getStatements(limit = 24): Promise<StatementView[]> {
  const rows = await db.propertyStatement.findMany({
    orderBy: [{ status: "asc" }, { periodStart: "desc" }],
    take: limit,
    include: {
      property: { select: { id: true, label: true } },
      // Never `data` — that column is `lib/statement-store.ts`'s alone.
      document: { select: { id: true, filename: true } },
      lineItems: { orderBy: { sortOrder: "asc" } },
    },
  });

  return rows.map((statement) => {
    const items: LineItemView[] = statement.lineItems.map((item) => ({
      id: item.id,
      dayLabel: item.on ? dayFormat.format(item.on) : null,
      description: item.description,
      payee: item.payee,
      amountCents: item.amountCents,
      amountLabel: signedMoneyLabel(item.amountCents),
      kind: item.kind,
      kindLabel: STATEMENT_KIND_LABEL[item.kind] ?? item.kind,
      taxCategoryLabel: item.taxCategory
        ? (SCHEDULE_E_LABEL[item.taxCategory] ?? item.taxCategory)
        : null,
      confidence: item.confidence,
      reviewed: item.reviewedAt !== null,
      rawText: item.rawText,
    }));

    const counted = items.filter(
      (item) => item.kind !== "distribution" && item.kind !== "reserve",
    );
    const rowIncome = counted
      .filter((item) => item.amountCents > 0)
      .reduce((sum, item) => sum + item.amountCents, 0);
    const rowExpense = counted
      .filter((item) => item.amountCents < 0)
      .reduce((sum, item) => sum - item.amountCents, 0);

    return {
      id: statement.id,
      periodLabel: monthFormat.format(statement.periodStart),
      status: statement.status,
      problem: statement.problem,
      confidence: statement.confidence,
      sourceLabel: statement.source === "gmail" ? "From email" : "Uploaded",
      receivedLabel: statement.gmailReceivedAt
        ? dayFormat.format(statement.gmailReceivedAt)
        : null,
      documentId: statement.document?.id ?? null,
      filename: statement.document?.filename ?? null,

      propertyId: statement.property?.id ?? null,
      propertyLabel: statement.property?.label ?? null,

      statedIncomeLabel:
        statement.statedIncomeCents === null
          ? null
          : moneyLabel(statement.statedIncomeCents),
      statedExpenseLabel:
        statement.statedExpenseCents === null
          ? null
          : moneyLabel(statement.statedExpenseCents),
      statedDistributionLabel:
        statement.statedDistributionCents === null
          ? null
          : moneyLabel(statement.statedDistributionCents),

      rowIncomeLabel: moneyLabel(rowIncome),
      rowExpenseLabel: moneyLabel(rowExpense),
      netLabel: signedMoneyLabel(rowIncome - rowExpense),

      lineItems: items,
      lowConfidenceCount: items.filter((item) => item.confidence < 70).length,
      extractedLabel: statement.extractedAt
        ? dayFormat.format(statement.extractedAt)
        : null,
    };
  });
}

export type StatementQueueView = {
  needsReview: number;
  pending: number;
  accepted: number;
  /** When a statement was last accepted, so the Property tab can say whether one
   *  is overdue. **An automation that goes quiet is the failure being designed
   *  against**, so an absence is stated rather than left blank. */
  lastAcceptedLabel: string | null;
  gmailConnected: boolean;
  gmailEmail: string | null;
  gmailError: string | null;
  lastScanLabel: string | null;
};

export async function getStatementQueue(): Promise<StatementQueueView> {
  const [needsReview, pending, accepted, latest, credential, cursor] =
    await Promise.all([
      db.propertyStatement.count({ where: { status: "needs_review" } }),
      db.propertyStatement.count({ where: { status: "pending" } }),
      db.propertyStatement.count({ where: { status: "accepted" } }),
      db.propertyStatement.findFirst({
        where: { status: "accepted" },
        orderBy: { periodStart: "desc" },
        select: { periodStart: true },
      }),
      db.oAuthCredential.findUnique({
        where: { provider: "google" },
        select: { accountEmail: true, revokedAt: true, lastError: true },
      }),
      db.ledgerCursor.findUnique({
        where: { key: "gmail:lastScanAt" },
        select: { value: true },
      }),
    ]);

  const scannedAt = cursor ? new Date(cursor.value) : null;

  return {
    needsReview,
    pending,
    accepted,
    lastAcceptedLabel: latest ? monthFormat.format(latest.periodStart) : null,
    gmailConnected: Boolean(credential && !credential.revokedAt),
    gmailEmail: credential?.accountEmail ?? null,
    gmailError: credential?.lastError ?? null,
    lastScanLabel:
      scannedAt && !Number.isNaN(scannedAt.getTime())
        ? dayFormat.format(scannedAt)
        : null,
  };
}
