-- CreateEnum
CREATE TYPE "StatementStatus" AS ENUM ('pending', 'needs_review', 'accepted', 'rejected');

-- CreateTable
CREATE TABLE "PropertyStatement" (
    "id" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "statedIncomeCents" INTEGER,
    "statedExpenseCents" INTEGER,
    "statedDistributionCents" INTEGER,
    "beginningBalanceCents" INTEGER,
    "endingBalanceCents" INTEGER,
    "status" "StatementStatus" NOT NULL DEFAULT 'needs_review',
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "problem" TEXT,
    "source" TEXT NOT NULL,
    "gmailMessageId" TEXT,
    "gmailReceivedAt" TIMESTAMP(3),
    "extractedAt" TIMESTAMP(3),
    "extractorModel" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "propertyId" TEXT,

    CONSTRAINT "PropertyStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatementDocument" (
    "id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "filename" TEXT,
    "sha256" TEXT NOT NULL,
    "text" TEXT,
    "pageCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statementId" TEXT NOT NULL,

    CONSTRAINT "StatementDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatementLineItem" (
    "id" TEXT NOT NULL,
    "on" DATE,
    "description" TEXT NOT NULL,
    "payee" TEXT,
    "amountCents" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "taxCategory" TEXT,
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "reviewedAt" TIMESTAMP(3),
    "rawText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "statementId" TEXT NOT NULL,

    CONSTRAINT "StatementLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropertyStatement_gmailMessageId_key" ON "PropertyStatement"("gmailMessageId");

-- CreateIndex
CREATE INDEX "PropertyStatement_propertyId_periodStart_idx" ON "PropertyStatement"("propertyId", "periodStart");

-- CreateIndex
CREATE INDEX "PropertyStatement_status_periodStart_idx" ON "PropertyStatement"("status", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "StatementDocument_sha256_key" ON "StatementDocument"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "StatementDocument_statementId_key" ON "StatementDocument"("statementId");

-- CreateIndex
CREATE INDEX "StatementLineItem_statementId_sortOrder_idx" ON "StatementLineItem"("statementId", "sortOrder");

-- CreateIndex
CREATE INDEX "StatementLineItem_taxCategory_idx" ON "StatementLineItem"("taxCategory");

-- AddForeignKey
ALTER TABLE "PropertyStatement" ADD CONSTRAINT "PropertyStatement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementDocument" ADD CONSTRAINT "StatementDocument_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "PropertyStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementLineItem" ADD CONSTRAINT "StatementLineItem_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "PropertyStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
