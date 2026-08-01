-- CreateEnum
CREATE TYPE "ProjectPriority" AS ENUM ('main', 'side', 'later');

-- CreateEnum
CREATE TYPE "SprintStatus" AS ENUM ('planning', 'active', 'done');

-- AlterTable
ALTER TABLE "Mark" ADD COLUMN     "sprintId" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "priority" "ProjectPriority" NOT NULL DEFAULT 'side';

-- CreateTable
CREATE TABLE "Sprint" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "status" "SprintStatus" NOT NULL DEFAULT 'active',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sprint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sprint_status_startsOn_idx" ON "Sprint"("status", "startsOn");

-- CreateIndex
CREATE INDEX "Mark_sprintId_status_idx" ON "Mark"("sprintId", "status");

-- CreateIndex
CREATE INDEX "Project_priority_sortOrder_idx" ON "Project"("priority", "sortOrder");

-- AddForeignKey
ALTER TABLE "Mark" ADD CONSTRAINT "Mark_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
