-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('checking', 'savings', 'cash', 'brokerage', 'retirement', 'credit_card', 'loan', 'mortgage', 'other');

-- CreateEnum
CREATE TYPE "LedgerJobStatus" AS ENUM ('pending', 'running', 'done', 'failed');

-- CreateTable
CREATE TABLE "PlaidItem" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "institutionId" TEXT,
    "institutionName" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "txCursor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'good',
    "statusDetail" TEXT,
    "consentExpiresAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "lastWebhookAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaidItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthCredential" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accountEmail" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "obtainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastError" TEXT,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "OAuthCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerCursor" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerCursor_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "plaidAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "officialName" TEXT,
    "mask" TEXT,
    "kind" "AccountKind" NOT NULL,
    "plaidType" TEXT NOT NULL,
    "plaidSubtype" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "currentCents" INTEGER,
    "availableCents" INTEGER,
    "limitCents" INTEGER,
    "balanceAt" TIMESTAMP(3),
    "includeInNetWorth" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "itemId" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountBalance" (
    "id" TEXT NOT NULL,
    "on" DATE NOT NULL,
    "currentCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountId" TEXT NOT NULL,

    CONSTRAINT "AccountBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetWorthSnapshot" (
    "id" TEXT NOT NULL,
    "on" DATE NOT NULL,
    "liquidCents" INTEGER NOT NULL,
    "investedCents" INTEGER NOT NULL,
    "retirementCents" INTEGER NOT NULL,
    "propertyCents" INTEGER NOT NULL,
    "liabilityCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "accountCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetWorthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerJob" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT,
    "status" "LedgerJobStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "result" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlaidItem_itemId_key" ON "PlaidItem"("itemId");

-- CreateIndex
CREATE INDEX "PlaidItem_status_lastSyncedAt_idx" ON "PlaidItem"("status", "lastSyncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthCredential_provider_key" ON "OAuthCredential"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "Account_plaidAccountId_key" ON "Account"("plaidAccountId");

-- CreateIndex
CREATE INDEX "Account_kind_sortOrder_idx" ON "Account"("kind", "sortOrder");

-- CreateIndex
CREATE INDEX "Account_itemId_idx" ON "Account"("itemId");

-- CreateIndex
CREATE INDEX "AccountBalance_on_idx" ON "AccountBalance"("on");

-- CreateIndex
CREATE UNIQUE INDEX "AccountBalance_accountId_on_key" ON "AccountBalance"("accountId", "on");

-- CreateIndex
CREATE UNIQUE INDEX "NetWorthSnapshot_on_key" ON "NetWorthSnapshot"("on");

-- CreateIndex
CREATE INDEX "NetWorthSnapshot_on_idx" ON "NetWorthSnapshot"("on");

-- CreateIndex
CREATE INDEX "LedgerJob_status_runAfter_idx" ON "LedgerJob"("status", "runAfter");

-- CreateIndex
CREATE INDEX "LedgerJob_kind_createdAt_idx" ON "LedgerJob"("kind", "createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PlaidItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountBalance" ADD CONSTRAINT "AccountBalance_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
