-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "plaidTransactionId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "postedOn" DATE NOT NULL,
    "authorizedOn" DATE,
    "pending" BOOLEAN NOT NULL DEFAULT false,
    "pendingPlaidId" TEXT,
    "name" TEXT NOT NULL,
    "merchantName" TEXT,
    "website" TEXT,
    "plaidCategory" TEXT,
    "plaidCategoryDetail" TEXT,
    "category" TEXT,
    "note" TEXT,
    "isTransfer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Security" (
    "id" TEXT NOT NULL,
    "plaidSecurityId" TEXT NOT NULL,
    "tickerSymbol" TEXT,
    "name" TEXT,
    "type" TEXT,
    "closePriceCents" INTEGER,
    "closePriceOn" DATE,
    "isCashEquivalent" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Security_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "costBasisCents" INTEGER,
    "priceCents" INTEGER,
    "valueCents" INTEGER NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT NOT NULL,
    "securityId" TEXT NOT NULL,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanDetail" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "originationOn" DATE,
    "originationPrincipalCents" INTEGER,
    "interestRatePercent" DOUBLE PRECISION,
    "interestRateType" TEXT,
    "maturityOn" DATE,
    "nextPaymentDueOn" DATE,
    "nextPaymentCents" INTEGER,
    "escrowBalanceCents" INTEGER,
    "ytdInterestCents" INTEGER,
    "ytdPrincipalCents" INTEGER,
    "propertyAddress" TEXT,
    "refreshedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_plaidTransactionId_key" ON "Transaction"("plaidTransactionId");

-- CreateIndex
CREATE INDEX "Transaction_accountId_postedOn_idx" ON "Transaction"("accountId", "postedOn");

-- CreateIndex
CREATE INDEX "Transaction_postedOn_idx" ON "Transaction"("postedOn");

-- CreateIndex
CREATE INDEX "Transaction_category_postedOn_idx" ON "Transaction"("category", "postedOn");

-- CreateIndex
CREATE INDEX "Transaction_pending_postedOn_idx" ON "Transaction"("pending", "postedOn");

-- CreateIndex
CREATE UNIQUE INDEX "Security_plaidSecurityId_key" ON "Security"("plaidSecurityId");

-- CreateIndex
CREATE INDEX "Holding_accountId_idx" ON "Holding"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Holding_accountId_securityId_key" ON "Holding"("accountId", "securityId");

-- CreateIndex
CREATE UNIQUE INDEX "LoanDetail_accountId_key" ON "LoanDetail"("accountId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "Security"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanDetail" ADD CONSTRAINT "LoanDetail_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
