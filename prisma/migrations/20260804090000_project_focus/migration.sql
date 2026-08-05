-- `Project.focus` — the one thing a project is aiming at right now.
--
-- Today became project-first on 2026-08-04, and leading a project card with
-- `description` reads wrong: "a short cozy game made with my husband" tells you
-- what Sleepy Cat *is*, which you already know, and not what it is *for* this
-- month. Two fields, because they answer different questions and both get
-- asked. Nullable — a project without one simply shows its description.
ALTER TABLE "Project" ADD COLUMN "focus" TEXT;

-- Drop the abandoned `Doc` table.
--
-- Superseded by `ProjectDoc` a few hours after it was created; the two rows it
-- held are older, shorter copies of docs that live on their projects now, and
-- are backed up in `backups/doc-table-2026-08-04.json`. Nothing in the app has
-- ever read this table — there is no model for it in `schema.prisma`, which is
-- exactly why it went unnoticed and drifted for three days.
DROP TABLE IF EXISTS "Doc";
