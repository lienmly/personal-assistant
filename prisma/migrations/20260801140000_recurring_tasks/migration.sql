-- Recurring tasks. Reuses the `Recurrence` enum the calendar already defines,
-- so "every Wednesday and Sunday" means one thing across the whole app.
--
-- One live row that advances, plus a completed snapshot per occurrence. See
-- the block comment on `Task` in schema.prisma for why it isn't a template
-- table and isn't 365 materialised rows.

ALTER TABLE "Task" ADD COLUMN "recurrence"  "Recurrence" NOT NULL DEFAULT 'none';
ALTER TABLE "Task" ADD COLUMN "daysOfWeek"  INTEGER[] DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "Task" ADD COLUMN "repeatUntil" DATE;
ALTER TABLE "Task" ADD COLUMN "recurringId" TEXT;

CREATE INDEX "Task_recurringId_completedAt_idx" ON "Task"("recurringId", "completedAt");

ALTER TABLE "Task" ADD CONSTRAINT "Task_recurringId_fkey" FOREIGN KEY ("recurringId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
