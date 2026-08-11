-- CreateTable
CREATE TABLE "MontblancConversation" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "distilledAt" TIMESTAMP(3),

    CONSTRAINT "MontblancConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MontblancMessage" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" TEXT NOT NULL,

    CONSTRAINT "MontblancMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MontblancNote" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),
    "sourceId" TEXT,

    CONSTRAINT "MontblancNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MontblancConversation_distilledAt_lastMessageAt_idx" ON "MontblancConversation"("distilledAt", "lastMessageAt");

-- CreateIndex
CREATE INDEX "MontblancMessage_conversationId_createdAt_idx" ON "MontblancMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "MontblancNote_supersededAt_createdAt_idx" ON "MontblancNote"("supersededAt", "createdAt");

-- AddForeignKey
ALTER TABLE "MontblancMessage" ADD CONSTRAINT "MontblancMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "MontblancConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MontblancNote" ADD CONSTRAINT "MontblancNote_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "MontblancConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
