/**
 * Layer 4 — reconciliation, and the whole extraction pipeline against a real PDF.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/statement-check.mts
 *
 * The first half is `reconciles()` in isolation: golden cases, no network. It is
 * the invariant the entire ingestion design rests on, so it gets tested like
 * one.
 *
 * The second half builds a **real PDF** — actual bytes, standard-font text
 * operators, correct xref offsets — stores it, and runs it through `unpdf` and
 * the model exactly as an emailed statement would go. That is the only way to
 * find out whether the extractor works or merely typechecks: everything about
 * this pipeline that can go wrong goes wrong at a boundary, and both boundaries
 * are real here.
 *
 * It removes everything it makes.
 */
import { PrismaClient } from "@prisma/client";

import { reconciles } from "../lib/statement-rules";
import { extractStatement } from "../lib/statement-extract";
import { putStatementDocument, sha256, findBySha256 } from "../lib/statement-store";

const db = new PrismaClient();
let failed = 0;

function eq(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failed += 1;
    console.log(`  FAIL  ${label}\n        got  ${a}\n        want ${e}`);
  } else {
    console.log(`  ok    ${label} = ${a}`);
  }
}

function ok(label: string, cond: boolean, detail = "") {
  if (!cond) {
    failed += 1;
    console.log(`  FAIL  ${label} ${detail}`);
  } else {
    console.log(`  ok    ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/**
 * A minimal but genuinely valid PDF.
 *
 * Helvetica is one of the fourteen standard fonts, so there is no embedded
 * subset and no `/ToUnicode` CMap — which means this exercises `unpdf`'s text
 * extraction on the easy path. A real AppFolio statement embeds a subset font,
 * which is precisely the case §8 said a hand-written extractor could not handle,
 * and precisely what this fixture cannot prove.
 */
function buildPdf(lines: string[]): Uint8Array<ArrayBuffer> {
  const escape = (text: string) =>
    text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  const content =
    `BT /F1 10 Tf 40 750 Td 14 TL\n` +
    lines.map((line) => `(${escape(line)}) Tj T*`).join("\n") +
    `\nET`;

  const objects = [
    `<< /Type /Catalog /Pages 2 0 R >>`,
    `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefAt = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;

  const buffer = Buffer.from(pdf, "latin1");
  return new Uint8Array(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  ) as Uint8Array<ArrayBuffer>;
}

const STATEMENT_LINES = [
  "BRIGHT PROPERTY CO",
  "Owner Statement",
  "Property: 1247 Willow Street, Los Angeles, CA 90042",
  "Period: 07/01/2026 - 07/31/2026",
  "",
  "INCOME",
  "07/03/2026   Rent - July                          4,200.00",
  "07/18/2026   Late fee                                75.00",
  "",
  "EXPENSES",
  "07/03/2026   Management fee (8%)                   -342.00",
  "07/11/2026   Plumbing - kitchen sink repair        -285.50",
  "07/22/2026   Landscaping                           -120.00",
  "",
  "SUMMARY",
  "Total Income                                      4,275.00",
  "Total Expenses                                      747.50",
  "Net Owner Distribution                            3,527.50",
  "Beginning Balance                                     0.00",
  "Ending Balance                                        0.00",
];

async function main() {
  console.log("\n=== reconciles() — the invariant everything rests on ===");

  const good = [
    { amountCents: 420_000, kind: "rent" },
    { amountCents: 7_500, kind: "other_income" },
    { amountCents: -34_200, kind: "management_fee" },
    { amountCents: -28_550, kind: "repair" },
    { amountCents: -12_000, kind: "repair" },
  ];

  eq(
    "rows matching the stated totals pass",
    reconciles({ lineItems: good, statedIncomeCents: 427_500, statedExpenseCents: 74_750 }).ok,
    true,
  );

  // The failure that matters: a dropped row still adds up *internally*, and is
  // only caught because the document printed its own total.
  const dropped = good.slice(0, 4);
  const missing = reconciles({
    lineItems: dropped,
    statedIncomeCents: 427_500,
    statedExpenseCents: 74_750,
  });
  eq("a dropped row fails", missing.ok, false);
  ok("and says how far out", !missing.ok && missing.problem.includes("$120.00"), !missing.ok ? missing.problem : "");

  const hallucinated = [...good, { amountCents: -5_000, kind: "repair" }];
  eq(
    "an invented row fails",
    reconciles({ lineItems: hallucinated, statedIncomeCents: 427_500, statedExpenseCents: 74_750 }).ok,
    false,
  );

  // One cent. A tolerance would hide exactly the errors worth catching.
  eq(
    "one cent out still fails",
    reconciles({ lineItems: good, statedIncomeCents: 427_501, statedExpenseCents: 74_750 }).ok,
    false,
  );

  // Owner draws and reserve movements are money moving, not income or expense.
  eq(
    "a distribution does not break it",
    reconciles({
      lineItems: [...good, { amountCents: -352_750, kind: "distribution" }],
      statedIncomeCents: 427_500,
      statedExpenseCents: 74_750,
    }).ok,
    true,
  );

  // No totals means nothing to check against, which is a refusal and not a pass.
  eq(
    "a statement with no totals is refused",
    reconciles({ lineItems: good, statedIncomeCents: null, statedExpenseCents: null }).ok,
    false,
  );

  console.log("\n=== a real PDF, through unpdf ===");
  const bytes = buildPdf(STATEMENT_LINES);
  ok("built a PDF", bytes.byteLength > 400, `${bytes.byteLength} bytes`);
  ok("with a PDF header", Buffer.from(bytes.slice(0, 5)).toString() === "%PDF-", "");

  const before = await db.propertyStatement.count();
  if (before > 0) {
    console.log("\nStatements already exist. Refusing to run the database half.\n");
    process.exit(failed === 0 ? 0 : 1);
  }

  const now = new Date();
  const statement = await db.propertyStatement.create({
    data: {
      periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      periodEnd: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)),
      source: "upload",
      status: "pending",
    },
    select: { id: true },
  });

  await putStatementDocument({
    statementId: statement.id,
    data: bytes,
    mimeType: "application/pdf",
    filename: "owner-statement-july.pdf",
  });

  // The hash, not the message id, is what makes ingestion idempotent.
  const found = await findBySha256(sha256(bytes));
  ok("the same bytes are recognised", found?.statementId === statement.id);

  console.log("\n=== extraction (this calls the model) ===");
  if (!process.env.DEEPSEEK_API_KEY) {
    console.log("  SKIP  no DEEPSEEK_API_KEY");
  } else {
    const result = await extractStatement(statement.id);
    console.log(`        ${result}`);

    const read = await db.propertyStatement.findUniqueOrThrow({
      where: { id: statement.id },
      include: { lineItems: { orderBy: { sortOrder: "asc" } }, document: { select: { text: true } } },
    });

    ok("text came out of the PDF", (read.document?.text ?? "").includes("Willow"), `${(read.document?.text ?? "").length} chars`);
    ok("rows were read", read.lineItems.length >= 5, `${read.lineItems.length}`);

    for (const item of read.lineItems) {
      console.log(
        `          ${String(item.amountCents).padStart(9)}  ${item.kind.padEnd(16)} ${item.description.slice(0, 40)}`,
      );
    }

    // The signs. Plaid's convention applied to a document: positive is money in
    // to the owner, so a management fee must be negative.
    const rent = read.lineItems.find((i) => i.kind === "rent");
    ok("rent is positive", (rent?.amountCents ?? 0) > 0, `${rent?.amountCents}`);
    const fee = read.lineItems.find((i) => i.kind === "management_fee");
    ok("the management fee is negative", (fee?.amountCents ?? 0) < 0, `${fee?.amountCents}`);

    eq("the stated income was read from the summary", read.statedIncomeCents, 427_500);
    eq("the stated expense was read from the summary", read.statedExpenseCents, 74_750);

    // The whole point.
    eq("it reconciles", read.problem, null);
    eq("and is left for a human, never auto-accepted", read.status, "needs_review");
    ok("every row kept its source line", read.lineItems.every((i) => i.rawText !== null));

    console.log("\n=== a corrupted statement must NOT reconcile ===");
    await db.statementLineItem.deleteMany({
      where: { id: read.lineItems[read.lineItems.length - 1].id },
    });
    const after = await db.propertyStatement.findUniqueOrThrow({
      where: { id: statement.id },
      select: { statedIncomeCents: true, statedExpenseCents: true, lineItems: true },
    });
    const check = reconciles({
      lineItems: after.lineItems,
      statedIncomeCents: after.statedIncomeCents,
      statedExpenseCents: after.statedExpenseCents,
    });
    eq("removing a row breaks it", check.ok, false);
  }

  console.log("\n=== cleanup ===");
  await db.statementLineItem.deleteMany({ where: { statementId: statement.id } });
  await db.statementDocument.deleteMany({ where: { statementId: statement.id } });
  await db.propertyStatement.deleteMany({ where: { id: statement.id } });
  await db.ledgerJob.deleteMany({});
  eq("database back where it started", await db.propertyStatement.count(), before);

  console.log(failed === 0 ? "\nALL PASS\n" : `\n${failed} FAILED\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main()
  .catch((cause) => {
    console.error("\nTHREW:", cause instanceof Error ? cause.message : cause);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
