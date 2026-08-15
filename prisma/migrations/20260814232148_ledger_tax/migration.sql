-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('sl_27_5_mid_month', 'sl_39_mid_month', 'macrs_5_hy', 'macrs_15_hy', 'section_179', 'bonus', 'land');

-- CreateEnum
CREATE TYPE "FilingStatus" AS ENUM ('single', 'mfj', 'mfs', 'hoh', 'qw');

-- CreateEnum
CREATE TYPE "RuleSetStatus" AS ENUM ('draft', 'verified', 'superseded');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "assetId" TEXT,
ADD COLUMN     "taxCategory" TEXT;

-- CreateTable
CREATE TABLE "DepreciableAsset" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "placedInServiceOn" DATE NOT NULL,
    "basisCents" INTEGER NOT NULL,
    "method" "DepreciationMethod" NOT NULL,
    "caMethod" "DepreciationMethod",
    "disposedOn" DATE,
    "disposalCents" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "propertyId" TEXT NOT NULL,

    CONSTRAINT "DepreciableAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxProfile" (
    "id" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "filingStatus" "FilingStatus" NOT NULL,
    "dependents" INTEGER NOT NULL DEFAULT 0,
    "stateOfResidence" TEXT NOT NULL DEFAULT 'CA',
    "w2WagesCents" INTEGER,
    "spouseW2WagesCents" INTEGER,
    "federalWithheldCents" INTEGER,
    "stateWithheldCents" INTEGER,
    "selfEmploymentNetCents" INTEGER,
    "interestIncomeCents" INTEGER,
    "ordinaryDividendsCents" INTEGER,
    "qualifiedDividendsCents" INTEGER,
    "shortTermGainCents" INTEGER,
    "longTermGainCents" INTEGER,
    "hsaContributionCents" INTEGER,
    "traditionalRetirementCents" INTEGER,
    "studentLoanInterestCents" INTEGER,
    "charitableCents" INTEGER,
    "primaryMortgageInterestCents" INTEGER,
    "primaryPropertyTaxCents" INTEGER,
    "stateIncomeTaxPaidCents" INTEGER,
    "priorYearTaxCents" INTEGER,
    "priorYearAgiCents" INTEGER,
    "estimatedPaidCents" INTEGER DEFAULT 0,
    "reSafeHarbourHours" INTEGER,
    "realEstateProfessional" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxCarryforward" (
    "id" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "propertyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxCarryforward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRuleSet" (
    "id" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "RuleSetStatus" NOT NULL DEFAULT 'draft',
    "payload" JSONB NOT NULL,
    "provenance" JSONB,
    "sourceUrl" TEXT,
    "sourceLabel" TEXT,
    "fetchedAt" TIMESTAMP(3),
    "extractorModel" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedNote" TEXT,
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxRuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxStrategyNote" (
    "id" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'surfaced',
    "note" TEXT,
    "amountCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxStrategyNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DepreciableAsset_propertyId_placedInServiceOn_idx" ON "DepreciableAsset"("propertyId", "placedInServiceOn");

-- CreateIndex
CREATE UNIQUE INDEX "TaxProfile_taxYear_key" ON "TaxProfile"("taxYear");

-- CreateIndex
CREATE INDEX "TaxCarryforward_taxYear_kind_idx" ON "TaxCarryforward"("taxYear", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "TaxCarryforward_taxYear_kind_propertyId_key" ON "TaxCarryforward"("taxYear", "kind", "propertyId");

-- CreateIndex
CREATE INDEX "TaxRuleSet_jurisdiction_taxYear_status_idx" ON "TaxRuleSet"("jurisdiction", "taxYear", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRuleSet_taxYear_jurisdiction_version_key" ON "TaxRuleSet"("taxYear", "jurisdiction", "version");

-- CreateIndex
CREATE INDEX "TaxStrategyNote_taxYear_state_idx" ON "TaxStrategyNote"("taxYear", "state");

-- CreateIndex
CREATE UNIQUE INDEX "TaxStrategyNote_taxYear_slug_key" ON "TaxStrategyNote"("taxYear", "slug");

-- CreateIndex
CREATE INDEX "Transaction_taxCategory_postedOn_idx" ON "Transaction"("taxCategory", "postedOn");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "DepreciableAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepreciableAsset" ADD CONSTRAINT "DepreciableAsset_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCarryforward" ADD CONSTRAINT "TaxCarryforward_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
