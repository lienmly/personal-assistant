import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/**
 * Seeds the real world as of 2026-07-30. Idempotent — every write is an upsert
 * keyed on something stable, so `npm run db:seed` is safe to re-run after a
 * schema change without wiping the drops you've since typed in.
 *
 * Handles are best guesses where I didn't have them. Edit them in Studio →
 * Channels rather than here; this file is a starting point, not the source of
 * truth once the app is live.
 */

const AREAS = [
  { slug: "work", name: "Work", color: "#3b6fd4", sortOrder: 0 },
  { slug: "hobbies", name: "Hobbies", color: "#2f8f5b", sortOrder: 1 },
  { slug: "baby", name: "Baby", color: "#d9852b", sortOrder: 2 },
  { slug: "home", name: "Home & Money", color: "#6b5bd4", sortOrder: 3 },
];

const PROJECTS = [
  {
    slug: "utaitai",
    name: "Utaitai",
    description: "Learn a language through the songs you already love.",
    areaSlug: "work",
    cadenceDays: 1,
    sortOrder: 0,
  },
  {
    slug: "sleepy-cat",
    name: "Sleepy Cat",
    description:
      "A short cozy game made with my husband — he draws, I build. Headed for Steam.",
    areaSlug: "work",
    cadenceDays: 7,
    sortOrder: 1,
  },
];

const BRANDS = [
  {
    slug: "utaitai",
    name: "Utaitai",
    tagline: "The app's own voice — songs, language, learning.",
    color: "#de1f4c",
    sortOrder: 0,
    channels: [
      { platform: "tiktok", handle: "utaitai", label: "Main", state: "live" },
      {
        platform: "tiktok",
        handle: "utaitai.jp",
        label: "Second account",
        state: "live",
      },
      { platform: "instagram", handle: "utaitai", label: "Reels", state: "planned" },
      { platform: "youtube", handle: "utaitai", label: "Shorts", state: "planned" },
      { platform: "facebook", handle: "utaitai", label: "Reels", state: "planned" },
    ],
  },
  {
    slug: "coding-mom",
    name: "Coding Mom",
    tagline:
      "Me. Building apps and games for moms, babies and families — and being my own UGC.",
    color: "#c2557a",
    sortOrder: 1,
    channels: [
      { platform: "tiktok", handle: "codingmom", label: "Main", state: "planned" },
      { platform: "medium", handle: "codingmom", label: "Essays", state: "live" },
      {
        platform: "threads",
        handle: "codingmom",
        label: "Repurposed from Medium",
        state: "planned",
      },
    ],
  },
  {
    slug: "sleepy-cat",
    name: "Sleepy Cat",
    tagline: "The game's own account — devlog and art, aimed at players.",
    color: "#5b7fa8",
    sortOrder: 2,
    channels: [
      { platform: "x", handle: "sleepycatgame", label: "Devlog", state: "planned" },
      { platform: "threads", handle: "sleepycatgame", label: "Devlog", state: "planned" },
    ],
  },
] as const;

/**
 * Series are keyed on [brandSlug, name]. Channels are matched on
 * platform + handle, never handle alone — one brand's accounts deliberately
 * share a handle across platforms (@utaitai on TikTok, IG, YouTube and
 * Facebook), so matching by handle would fan every daily short out to all five.
 */
const SERIES = [
  {
    name: "Daily short",
    brandSlug: "utaitai",
    projectSlug: "utaitai",
    format: "short_video",
    cadence: "daily",
    daysOfWeek: [],
    timeOfDay: "18:00",
    isActive: true,
    channelKeys: [
      { platform: "tiktok", handle: "utaitai" },
      { platform: "tiktok", handle: "utaitai.jp" },
    ],
  },
  {
    name: "Daily short",
    brandSlug: "coding-mom",
    // No project: this is brand-building, not work on a specific app. That's
    // exactly why Drop.projectId is nullable.
    projectSlug: null,
    format: "short_video",
    cadence: "daily",
    daysOfWeek: [],
    timeOfDay: "20:00",
    // Off until the account actually exists — a planned channel shouldn't be
    // generating slots you can't fill.
    isActive: false,
    channelKeys: [{ platform: "tiktok", handle: "codingmom" }],
  },
  {
    name: "Weekly essay",
    brandSlug: "coding-mom",
    projectSlug: null,
    format: "article",
    cadence: "weekly",
    daysOfWeek: [7], // Sunday
    timeOfDay: "09:00",
    isActive: true,
    channelKeys: [{ platform: "medium", handle: "codingmom" }],
  },
] as const;

async function main() {
  const today = new Date();
  const startsOn = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );

  for (const area of AREAS) {
    await db.area.upsert({
      where: { slug: area.slug },
      update: { name: area.name, color: area.color, sortOrder: area.sortOrder },
      create: area,
    });
  }

  for (const { areaSlug, ...project } of PROJECTS) {
    const area = await db.area.findUniqueOrThrow({ where: { slug: areaSlug } });
    await db.project.upsert({
      where: { slug: project.slug },
      update: {
        name: project.name,
        description: project.description,
        cadenceDays: project.cadenceDays,
        sortOrder: project.sortOrder,
        areaId: area.id,
      },
      create: { ...project, areaId: area.id },
    });
  }

  for (const { channels, ...brand } of BRANDS) {
    const saved = await db.brand.upsert({
      where: { slug: brand.slug },
      update: { name: brand.name, tagline: brand.tagline, color: brand.color },
      create: brand,
    });

    for (const [index, channel] of channels.entries()) {
      await db.channel.upsert({
        where: {
          platform_handle: { platform: channel.platform, handle: channel.handle },
        },
        update: { label: channel.label, brandId: saved.id, sortOrder: index },
        create: { ...channel, brandId: saved.id, sortOrder: index },
      });
    }
  }

  for (const series of SERIES) {
    const brand = await db.brand.findUniqueOrThrow({
      where: { slug: series.brandSlug },
    });
    const project = series.projectSlug
      ? await db.project.findUniqueOrThrow({ where: { slug: series.projectSlug } })
      : null;
    const channels = await db.channel.findMany({
      where: {
        brandId: brand.id,
        OR: series.channelKeys.map((key) => ({
          platform: key.platform,
          handle: key.handle,
        })),
      },
    });
    if (channels.length !== series.channelKeys.length) {
      throw new Error(
        `Series "${series.name}" (${series.brandSlug}) wanted ${series.channelKeys.length} channels but matched ${channels.length}`,
      );
    }

    const saved = await db.series.upsert({
      where: { brandId_name: { brandId: brand.id, name: series.name } },
      update: {
        format: series.format,
        cadence: series.cadence,
        daysOfWeek: [...series.daysOfWeek],
        timeOfDay: series.timeOfDay,
        isActive: series.isActive,
        projectId: project?.id ?? null,
      },
      create: {
        name: series.name,
        format: series.format,
        cadence: series.cadence,
        daysOfWeek: [...series.daysOfWeek],
        timeOfDay: series.timeOfDay,
        isActive: series.isActive,
        startsOn,
        brandId: brand.id,
        projectId: project?.id ?? null,
      },
    });

    await db.seriesChannel.deleteMany({
      where: { seriesId: saved.id, channelId: { notIn: channels.map((c) => c.id) } },
    });
    for (const channel of channels) {
      await db.seriesChannel.upsert({
        where: {
          seriesId_channelId: { seriesId: saved.id, channelId: channel.id },
        },
        update: {},
        create: { seriesId: saved.id, channelId: channel.id },
      });
    }
  }

  const counts = {
    areas: await db.area.count(),
    projects: await db.project.count(),
    brands: await db.brand.count(),
    channels: await db.channel.count(),
    series: await db.series.count(),
  };
  console.log("Seeded:", counts);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
