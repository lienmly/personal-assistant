-- CreateEnum
CREATE TYPE "MarkStatus" AS ENUM ('open', 'doing', 'done');

-- AlterTable
ALTER TABLE "Drop" ADD COLUMN     "refUrl" TEXT;

-- CreateTable
CREATE TABLE "Mark" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "link" TEXT,
    "track" TEXT,
    "status" "MarkStatus" NOT NULL DEFAULT 'open',
    "dueDate" DATE,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT,
    "areaId" TEXT NOT NULL,

    CONSTRAINT "Mark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Mark_status_dueDate_idx" ON "Mark"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Mark_projectId_status_sortOrder_idx" ON "Mark"("projectId", "status", "sortOrder");

-- CreateIndex
CREATE INDEX "Mark_areaId_status_idx" ON "Mark"("areaId", "status");

-- AddForeignKey
ALTER TABLE "Mark" ADD CONSTRAINT "Mark_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mark" ADD CONSTRAINT "Mark_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;
