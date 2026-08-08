-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "projectId" TEXT;

-- CreateIndex
CREATE INDEX "Brand_projectId_idx" ON "Brand"("projectId");

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
