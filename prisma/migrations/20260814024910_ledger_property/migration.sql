-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('rented', 'vacant', 'owner_occupied', 'sold');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "propertyId" TEXT;

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "purchasedOn" DATE NOT NULL,
    "purchasePriceCents" INTEGER NOT NULL,
    "closingCostsCents" INTEGER NOT NULL DEFAULT 0,
    "landAllocationBasisPoints" INTEGER,
    "landAllocationSource" TEXT,
    "placedInServiceOn" DATE,
    "status" "PropertyStatus" NOT NULL DEFAULT 'rented',
    "soldOn" DATE,
    "salePriceCents" INTEGER,
    "valueCents" INTEGER,
    "valueLowCents" INTEGER,
    "valueHighCents" INTEGER,
    "rentEstimateCents" INTEGER,
    "valuationAt" TIMESTAMP(3),
    "valuationSource" TEXT,
    "managerName" TEXT,
    "managerDomain" TEXT,
    "activeParticipation" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "areaId" TEXT,
    "projectId" TEXT,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyValuation" (
    "id" TEXT NOT NULL,
    "on" DATE NOT NULL,
    "valueCents" INTEGER NOT NULL,
    "valueLowCents" INTEGER,
    "valueHighCents" INTEGER,
    "rentCents" INTEGER,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "propertyId" TEXT NOT NULL,

    CONSTRAINT "PropertyValuation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyLoan" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "accountId" TEXT,
    "manualBalanceCents" INTEGER,
    "manualRatePercent" DOUBLE PRECISION,
    "manualBalanceOn" DATE,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PropertyLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lease" (
    "id" TEXT NOT NULL,
    "tenantName" TEXT,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE,
    "monthlyRentCents" INTEGER NOT NULL,
    "depositCents" INTEGER,
    "notes" TEXT,
    "propertyId" TEXT NOT NULL,

    CONSTRAINT "Lease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Property_slug_key" ON "Property"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Property_projectId_key" ON "Property"("projectId");

-- CreateIndex
CREATE INDEX "Property_status_sortOrder_idx" ON "Property"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "PropertyValuation_propertyId_on_idx" ON "PropertyValuation"("propertyId", "on");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyValuation_propertyId_on_key" ON "PropertyValuation"("propertyId", "on");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyLoan_accountId_key" ON "PropertyLoan"("accountId");

-- CreateIndex
CREATE INDEX "PropertyLoan_propertyId_sortOrder_idx" ON "PropertyLoan"("propertyId", "sortOrder");

-- CreateIndex
CREATE INDEX "Lease_propertyId_startsOn_idx" ON "Lease"("propertyId", "startsOn");

-- CreateIndex
CREATE INDEX "Transaction_propertyId_postedOn_idx" ON "Transaction"("propertyId", "postedOn");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyValuation" ADD CONSTRAINT "PropertyValuation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyLoan" ADD CONSTRAINT "PropertyLoan_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyLoan" ADD CONSTRAINT "PropertyLoan_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
