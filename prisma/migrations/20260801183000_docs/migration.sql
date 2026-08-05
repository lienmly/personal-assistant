-- Reconstructed 2026-08-04 from the live database.
--
-- This migration was applied to the Railway database on 2026-08-01 and its
-- folder never made it into the repo, so every `prisma migrate dev` since has
-- reported drift and offered to reset the database. The SQL below is rebuilt
-- from `information_schema` and `pg_indexes` so the migration history in the
-- repo matches the one in `_prisma_migrations`.
--
-- `Doc` was a first attempt at project documents, superseded hours later by
-- `ProjectDoc` (`20260801130000_project_docs`), which is what the app actually
-- reads. The next migration drops it. It is recreated faithfully here only so
-- that a database built from scratch off these files follows the same path the
-- real one did — create, then drop — rather than diverging.

-- CreateTable
CREATE TABLE "Doc" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT,
    "areaId" TEXT NOT NULL,

    CONSTRAINT "Doc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Doc_projectId_sortOrder_idx" ON "Doc"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "Doc_areaId_sortOrder_idx" ON "Doc"("areaId", "sortOrder");

-- CreateIndex
CREATE INDEX "Doc_updatedAt_idx" ON "Doc"("updatedAt");

-- AddForeignKey
ALTER TABLE "Doc" ADD CONSTRAINT "Doc_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Doc" ADD CONSTRAINT "Doc_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;
