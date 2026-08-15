/**
 * Clears every Ledger row. **Nothing else.**
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/ledger-reset.mts
 *
 * The check scripts refuse to run when rows already exist — a guard that exists
 * because they run against the same Postgres that holds real work — so a script
 * that crashes before its cleanup blocks the next run. This is the way out.
 *
 * It touches no table outside the Ledger: tasks, projects, docs, journal entries
 * and content items are not its business, and a reset script that reached them
 * would be the most dangerous file in the repo.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const before = {
    statements: await db.propertyStatement.count(),
    properties: await db.property.count(),
    accounts: await db.account.count(),
    transactions: await db.transaction.count(),
    items: await db.plaidItem.count(),
    jobs: await db.ledgerJob.count(),
  };
  console.log("before:", before);

  // Children first where the relation is SetNull rather than Cascade —
  // `Transaction.propertyId` and `Account.itemId` both survive their parent by
  // design, so the rows have to be removed explicitly.
  await db.statementLineItem.deleteMany({});
  await db.statementDocument.deleteMany({});
  await db.propertyStatement.deleteMany({});
  await db.lease.deleteMany({});
  await db.propertyLoan.deleteMany({});
  await db.propertyValuation.deleteMany({});
  await db.property.deleteMany({});
  await db.holding.deleteMany({});
  await db.security.deleteMany({});
  await db.loanDetail.deleteMany({});
  await db.transaction.deleteMany({});
  await db.accountBalance.deleteMany({});
  await db.account.deleteMany({});
  await db.plaidItem.deleteMany({});
  await db.netWorthSnapshot.deleteMany({});
  await db.ledgerJob.deleteMany({});
  await db.ledgerCursor.deleteMany({});

  const after = {
    statements: await db.propertyStatement.count(),
    properties: await db.property.count(),
    accounts: await db.account.count(),
    transactions: await db.transaction.count(),
    items: await db.plaidItem.count(),
    jobs: await db.ledgerJob.count(),
  };
  console.log("after: ", after);

  // Deliberately left alone: `OAuthCredential` is a real Google grant that took
  // a consent screen to obtain, and projects minted alongside a property may
  // hold work somebody did.
  const projects = await db.project.count();
  const grants = await db.oAuthCredential.count();
  console.log(
    `untouched: ${projects} projects, ${grants} OAuth ${grants === 1 ? "grant" : "grants"}`,
  );
}

main()
  .catch((cause) => {
    console.error(cause);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
