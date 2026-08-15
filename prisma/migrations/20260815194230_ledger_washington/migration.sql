-- AlterTable
ALTER TABLE "TaxProfile" ADD COLUMN     "realEstateGainCents" INTEGER,
ADD COLUMN     "salesTaxPaidCents" INTEGER,
ALTER COLUMN "stateOfResidence" SET DEFAULT 'WA';
