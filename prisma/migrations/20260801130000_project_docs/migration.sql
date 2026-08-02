-- Project docs. The /docs folder keeps the guides that are about the app;
-- anything about a *project* moves in here, where it can be written from a
-- phone instead of requiring a git commit.

CREATE TABLE "ProjectDoc" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "ProjectDoc_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectDoc_projectId_sortOrder_idx" ON "ProjectDoc"("projectId", "sortOrder");
CREATE UNIQUE INDEX "ProjectDoc_projectId_slug_key" ON "ProjectDoc"("projectId", "slug");

ALTER TABLE "ProjectDoc" ADD CONSTRAINT "ProjectDoc_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
