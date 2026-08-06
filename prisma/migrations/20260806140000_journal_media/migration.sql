-- `JournalPhoto` holds clips as well as photos now, so it is `JournalMedia`.
--
-- Hand-written, and **every statement here is a RENAME or an additive ALTER**,
-- for the same reason `20260801120000_plain_names` and
-- `20260805030000_journal_and_area_docs` are: `prisma migrate dev` diffs a model
-- rename as a DROP plus a CREATE, and the rows in this table are the one kind in
-- this app that genuinely cannot be recreated. Apply with `migrate deploy`, which
-- runs the SQL as written rather than diffing. Do not regenerate it.
--
-- The index and constraint names are renamed alongside the table so a future
-- diff stays quiet. (The `*_not_null` constraints Postgres 17 names for itself
-- are left alone — Prisma does not model them, so they never appear in a diff.)

ALTER TABLE "JournalPhoto" RENAME TO "JournalMedia";

ALTER INDEX "JournalPhoto_pkey" RENAME TO "JournalMedia_pkey";
ALTER INDEX "JournalPhoto_entryId_sortOrder_idx" RENAME TO "JournalMedia_entryId_sortOrder_idx";

ALTER TABLE "JournalMedia" RENAME CONSTRAINT "JournalPhoto_entryId_fkey" TO "JournalMedia_entryId_fkey";

-- What the row actually holds. Every existing row is a photo, which is what the
-- default asserts, so no backfill is needed.
CREATE TYPE "MediaKind" AS ENUM ('photo', 'video');

ALTER TABLE "JournalMedia" ADD COLUMN "kind" "MediaKind" NOT NULL DEFAULT 'photo';
ALTER TABLE "JournalMedia" ADD COLUMN "durationMs" INTEGER;
