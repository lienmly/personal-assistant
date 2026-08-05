-- Journal, and docs that can hang off an Area (CLAUDE.md §6, "The Baby area is
-- a journal, not a backlog").
--
-- Two things happen here.
--
-- 1. `ProjectDoc` becomes `Doc`, and gains a nullable `areaId` alongside a now
--    nullable `projectId`. The Baby area needs somewhere to keep a vision that
--    isn't a backlog, and it has no project by design. The alternative was a
--    second, identical `AreaDoc` model, and two parallel doc systems is how one
--    of them silently rots.
--
--    **Every statement in this half is a RENAME or an additive ALTER.**
--    `prisma migrate dev` diffs a model rename as a drop plus a create, which
--    here would have taken the Coding Mom brief, the Forge vision and the
--    Utaitai pricing note with it. This file is hand-written for the same reason
--    `20260801120000_plain_names` is, and must not be regenerated.
--
-- 2. `JournalEntry` and `JournalPhoto` are new. Photos are `BYTEA` — stored in
--    Postgres rather than on a volume or in S3, decided 2026-08-05, because
--    these are the one kind of row in this app that genuinely cannot be
--    recreated and bytes in the DB are covered by whatever backs up the DB.

-- ── ProjectDoc → Doc ─────────────────────────────────────────────────────────
ALTER TABLE "ProjectDoc" RENAME TO "Doc";

ALTER TABLE "Doc" RENAME CONSTRAINT "ProjectDoc_pkey"           TO "Doc_pkey";
ALTER TABLE "Doc" RENAME CONSTRAINT "ProjectDoc_projectId_fkey" TO "Doc_projectId_fkey";

ALTER INDEX "ProjectDoc_projectId_slug_key"      RENAME TO "Doc_projectId_slug_key";
ALTER INDEX "ProjectDoc_projectId_sortOrder_idx" RENAME TO "Doc_projectId_sortOrder_idx";

-- Postgres 17 names NOT NULL constraints, and Prisma 6.19 emits them. Renaming
-- them alongside the table keeps a future `migrate diff` quiet.
ALTER TABLE "Doc" RENAME CONSTRAINT "ProjectDoc_id_not_null"        TO "Doc_id_not_null";
ALTER TABLE "Doc" RENAME CONSTRAINT "ProjectDoc_slug_not_null"      TO "Doc_slug_not_null";
ALTER TABLE "Doc" RENAME CONSTRAINT "ProjectDoc_title_not_null"     TO "Doc_title_not_null";
ALTER TABLE "Doc" RENAME CONSTRAINT "ProjectDoc_body_not_null"      TO "Doc_body_not_null";
ALTER TABLE "Doc" RENAME CONSTRAINT "ProjectDoc_sortOrder_not_null" TO "Doc_sortOrder_not_null";
ALTER TABLE "Doc" RENAME CONSTRAINT "ProjectDoc_createdAt_not_null" TO "Doc_createdAt_not_null";
ALTER TABLE "Doc" RENAME CONSTRAINT "ProjectDoc_updatedAt_not_null" TO "Doc_updatedAt_not_null";

-- A doc now belongs to a Project *or* an Area, so neither column can be
-- mandatory. Exactly-one-of is enforced in `lib/doc-actions.ts`; Prisma cannot
-- express a check constraint and that file is the only writer.
ALTER TABLE "Doc" ALTER COLUMN "projectId" DROP NOT NULL;

ALTER TABLE "Doc" ADD COLUMN "areaId" TEXT;

ALTER TABLE "Doc"
  ADD CONSTRAINT "Doc_areaId_fkey"
  FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NULLs are distinct in a Postgres unique index, so every existing project doc
-- (areaId NULL) coexists here untouched.
CREATE UNIQUE INDEX "Doc_areaId_slug_key" ON "Doc"("areaId", "slug");
CREATE INDEX "Doc_areaId_sortOrder_idx" ON "Doc"("areaId", "sortOrder");

-- ── Journal ──────────────────────────────────────────────────────────────────
CREATE TABLE "JournalEntry" (
    "happenedOn" DATE NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "areaId" TEXT NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JournalEntry_areaId_happenedOn_idx" ON "JournalEntry"("areaId", "happenedOn");

ALTER TABLE "JournalEntry"
  ADD CONSTRAINT "JournalEntry_areaId_fkey"
  FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "JournalPhoto" (
    "id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entryId" TEXT NOT NULL,

    CONSTRAINT "JournalPhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JournalPhoto_entryId_sortOrder_idx" ON "JournalPhoto"("entryId", "sortOrder");

ALTER TABLE "JournalPhoto"
  ADD CONSTRAINT "JournalPhoto_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
