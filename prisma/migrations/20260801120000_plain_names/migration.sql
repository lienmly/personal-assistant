-- Plain names (CLAUDE.md §2). "Marks" and "Drops" were two task-shaped nouns
-- and neither said which one you *do*, so Mark becomes Task and Drop becomes
-- ContentItem. Hunt Board and Series keep their names; Series was already
-- ordinary English and the board's name was never the confusing part.
--
-- Every statement here RENAMES. `prisma migrate dev` would have diffed this as
-- four dropped tables and four new ones, taking every row with it — which is
-- why this file is hand-written and must not be regenerated.

-- ── Enums ────────────────────────────────────────────────────────────────────
ALTER TYPE "MarkStatus" RENAME TO "TaskStatus";
ALTER TYPE "DropStage"  RENAME TO "ContentStage";
ALTER TYPE "DropFormat" RENAME TO "ContentFormat";

-- ── Mark → Task ──────────────────────────────────────────────────────────────
ALTER TABLE "Mark" RENAME TO "Task";
ALTER TABLE "Task" RENAME CONSTRAINT "Mark_pkey"           TO "Task_pkey";
ALTER TABLE "Task" RENAME CONSTRAINT "Mark_projectId_fkey" TO "Task_projectId_fkey";
ALTER TABLE "Task" RENAME CONSTRAINT "Mark_areaId_fkey"    TO "Task_areaId_fkey";
ALTER TABLE "Task" RENAME CONSTRAINT "Mark_sprintId_fkey"  TO "Task_sprintId_fkey";
ALTER INDEX "Mark_status_dueDate_idx"              RENAME TO "Task_status_dueDate_idx";
ALTER INDEX "Mark_projectId_status_sortOrder_idx"  RENAME TO "Task_projectId_status_sortOrder_idx";
ALTER INDEX "Mark_areaId_status_idx"               RENAME TO "Task_areaId_status_idx";
ALTER INDEX "Mark_sprintId_status_idx"             RENAME TO "Task_sprintId_status_idx";

-- ── Drop → ContentItem ───────────────────────────────────────────────────────
ALTER TABLE "Drop" RENAME TO "ContentItem";
ALTER TABLE "ContentItem" RENAME COLUMN "sourceDropId" TO "sourceItemId";
ALTER TABLE "ContentItem" RENAME CONSTRAINT "Drop_pkey"             TO "ContentItem_pkey";
ALTER TABLE "ContentItem" RENAME CONSTRAINT "Drop_brandId_fkey"     TO "ContentItem_brandId_fkey";
ALTER TABLE "ContentItem" RENAME CONSTRAINT "Drop_projectId_fkey"   TO "ContentItem_projectId_fkey";
ALTER TABLE "ContentItem" RENAME CONSTRAINT "Drop_seriesId_fkey"    TO "ContentItem_seriesId_fkey";
ALTER TABLE "ContentItem" RENAME CONSTRAINT "Drop_sourceDropId_fkey" TO "ContentItem_sourceItemId_fkey";
ALTER INDEX "Drop_stage_publishAt_idx"    RENAME TO "ContentItem_stage_publishAt_idx";
ALTER INDEX "Drop_brandId_publishAt_idx"  RENAME TO "ContentItem_brandId_publishAt_idx";
ALTER INDEX "Drop_projectId_idx"          RENAME TO "ContentItem_projectId_idx";
ALTER INDEX "Drop_seriesId_slotDate_key"  RENAME TO "ContentItem_seriesId_slotDate_key";

-- ── DropChannel → ContentItemChannel ─────────────────────────────────────────
ALTER TABLE "DropChannel" RENAME TO "ContentItemChannel";
ALTER TABLE "ContentItemChannel" RENAME COLUMN "dropId" TO "itemId";
ALTER TABLE "ContentItemChannel" RENAME CONSTRAINT "DropChannel_pkey"           TO "ContentItemChannel_pkey";
ALTER TABLE "ContentItemChannel" RENAME CONSTRAINT "DropChannel_dropId_fkey"    TO "ContentItemChannel_itemId_fkey";
ALTER TABLE "ContentItemChannel" RENAME CONSTRAINT "DropChannel_channelId_fkey" TO "ContentItemChannel_channelId_fkey";
ALTER INDEX "DropChannel_channelId_state_idx"   RENAME TO "ContentItemChannel_channelId_state_idx";
ALTER INDEX "DropChannel_dropId_channelId_key"  RENAME TO "ContentItemChannel_itemId_channelId_key";
