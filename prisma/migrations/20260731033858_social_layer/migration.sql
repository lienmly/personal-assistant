-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('active', 'simmering', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('tiktok', 'instagram', 'youtube', 'facebook', 'threads', 'x', 'medium', 'steam', 'other');

-- CreateEnum
CREATE TYPE "ChannelState" AS ENUM ('planned', 'live', 'paused');

-- CreateEnum
CREATE TYPE "DropFormat" AS ENUM ('short_video', 'article', 'text_post', 'image');

-- CreateEnum
CREATE TYPE "DropStage" AS ENUM ('idea', 'script', 'produce', 'scheduled', 'published');

-- CreateEnum
CREATE TYPE "ChannelPostState" AS ENUM ('pending', 'scheduled', 'published', 'skipped');

-- CreateEnum
CREATE TYPE "Cadence" AS ENUM ('daily', 'weekdays', 'weekly', 'custom');

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'active',
    "cadenceDays" INTEGER,
    "lastTouchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "areaId" TEXT NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "color" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "handle" TEXT NOT NULL,
    "label" TEXT,
    "url" TEXT,
    "state" "ChannelState" NOT NULL DEFAULT 'planned',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "brandId" TEXT NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Series" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "format" "DropFormat" NOT NULL,
    "cadence" "Cadence" NOT NULL,
    "daysOfWeek" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "timeOfDay" TEXT,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "horizonDays" INTEGER NOT NULL DEFAULT 14,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "brandId" TEXT NOT NULL,
    "projectId" TEXT,

    CONSTRAINT "Series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeriesChannel" (
    "seriesId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,

    CONSTRAINT "SeriesChannel_pkey" PRIMARY KEY ("seriesId","channelId")
);

-- CreateTable
CREATE TABLE "Drop" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "body" TEXT,
    "format" "DropFormat" NOT NULL,
    "stage" "DropStage" NOT NULL DEFAULT 'idea',
    "publishAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "brandId" TEXT NOT NULL,
    "projectId" TEXT,
    "seriesId" TEXT,
    "slotDate" DATE,
    "sourceDropId" TEXT,

    CONSTRAINT "Drop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DropChannel" (
    "id" TEXT NOT NULL,
    "state" "ChannelPostState" NOT NULL DEFAULT 'pending',
    "caption" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishedUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dropId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,

    CONSTRAINT "DropChannel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Area_slug_key" ON "Area"("slug");

-- CreateIndex
CREATE INDEX "Area_sortOrder_idx" ON "Area"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Project_areaId_sortOrder_idx" ON "Project"("areaId", "sortOrder");

-- CreateIndex
CREATE INDEX "Project_status_lastTouchedAt_idx" ON "Project"("status", "lastTouchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- CreateIndex
CREATE INDEX "Brand_sortOrder_idx" ON "Brand"("sortOrder");

-- CreateIndex
CREATE INDEX "Channel_brandId_sortOrder_idx" ON "Channel"("brandId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_platform_handle_key" ON "Channel"("platform", "handle");

-- CreateIndex
CREATE INDEX "Series_isActive_idx" ON "Series"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Series_brandId_name_key" ON "Series"("brandId", "name");

-- CreateIndex
CREATE INDEX "SeriesChannel_channelId_idx" ON "SeriesChannel"("channelId");

-- CreateIndex
CREATE INDEX "Drop_stage_publishAt_idx" ON "Drop"("stage", "publishAt");

-- CreateIndex
CREATE INDEX "Drop_brandId_publishAt_idx" ON "Drop"("brandId", "publishAt");

-- CreateIndex
CREATE INDEX "Drop_projectId_idx" ON "Drop"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Drop_seriesId_slotDate_key" ON "Drop"("seriesId", "slotDate");

-- CreateIndex
CREATE INDEX "DropChannel_channelId_state_idx" ON "DropChannel"("channelId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "DropChannel_dropId_channelId_key" ON "DropChannel"("dropId", "channelId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Series" ADD CONSTRAINT "Series_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Series" ADD CONSTRAINT "Series_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeriesChannel" ADD CONSTRAINT "SeriesChannel_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeriesChannel" ADD CONSTRAINT "SeriesChannel_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drop" ADD CONSTRAINT "Drop_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drop" ADD CONSTRAINT "Drop_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drop" ADD CONSTRAINT "Drop_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drop" ADD CONSTRAINT "Drop_sourceDropId_fkey" FOREIGN KEY ("sourceDropId") REFERENCES "Drop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DropChannel" ADD CONSTRAINT "DropChannel_dropId_fkey" FOREIGN KEY ("dropId") REFERENCES "Drop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DropChannel" ADD CONSTRAINT "DropChannel_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
