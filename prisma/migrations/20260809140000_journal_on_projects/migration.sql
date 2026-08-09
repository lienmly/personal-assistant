-- A journal entry can hang off a Project as well as an Area (CLAUDE.md §6,
-- "A journal belongs to whatever it is a record of").
--
-- Exactly the shape `Doc` took in `20260805030000_journal_and_area_docs`, one
-- noun over: both owner columns nullable, exactly one set, enforced in
-- `lib/journal-actions.ts` because Prisma cannot express a check constraint and
-- that file is the only writer.
--
-- **Every statement here is additive or a DROP NOT NULL.** Nothing is dropped
-- and no row is rewritten — which matters more here than anywhere else in the
-- schema, because a journal entry and its photos are the one kind of row in this
-- app that genuinely cannot be recreated (§6, "Photos live in Postgres").
-- Hand-written and applied with `migrate deploy` for that reason; do not
-- regenerate it.

ALTER TABLE "JournalEntry" ALTER COLUMN "areaId" DROP NOT NULL;

ALTER TABLE "JournalEntry" ADD COLUMN "projectId" TEXT;

-- Cascade, matching the area side and matching `Doc`. An entry without an owner
-- is not an orphan with a home elsewhere, it is a record of nothing. Deleting a
-- project that holds any is refused in `lib/project-actions.ts` first, so this
-- is a backstop rather than the normal path.
ALTER TABLE "JournalEntry"
  ADD CONSTRAINT "JournalEntry_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "JournalEntry_projectId_happenedOn_idx" ON "JournalEntry"("projectId", "happenedOn");
