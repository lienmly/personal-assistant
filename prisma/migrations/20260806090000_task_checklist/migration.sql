-- Subtasks: a checklist hanging off a Task, as the same model rather than a
-- second table. See the block comment on `Task` in schema.prisma.
--
-- Purely additive: one nullable column, one index, one self-referencing FK.
-- Nothing existing changes, so every row already in the table becomes a
-- top-level task, which is what it already was.

ALTER TABLE "Task" ADD COLUMN "parentId" TEXT;

CREATE INDEX "Task_parentId_sortOrder_idx" ON "Task"("parentId", "sortOrder");

ALTER TABLE "Task" ADD CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
