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
      {
        platform: "tiktok",
        handle: "utaitai_jp",
        label: "Japanese songs",
        state: "live",
      },
      {
        platform: "tiktok",
        handle: "utaitai_cn",
        label: "Chinese songs",
        state: "live",
      },
      // The rest are still guesses — edit them in Studio → Channels, not here.
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
  // Two series, not one with two channels: the accounts run different songs,
  // so each day is two separate pieces of work. One series fanning out to both
  // would model it as "the same video, posted twice" — which is the wrong
  // shape, and would give one card a day instead of two.
  {
    name: "Daily short — Japanese",
    brandSlug: "utaitai",
    projectSlug: "utaitai",
    format: "short_video",
    cadence: "daily",
    daysOfWeek: [],
    timeOfDay: "18:00",
    isActive: true,
    channelKeys: [{ platform: "tiktok", handle: "utaitai_jp" }],
  },
  {
    name: "Daily short — Chinese",
    brandSlug: "utaitai",
    projectSlug: "utaitai",
    format: "short_video",
    cadence: "daily",
    daysOfWeek: [],
    timeOfDay: "19:00",
    isActive: true,
    channelKeys: [{ platform: "tiktok", handle: "utaitai_cn" }],
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

/**
 * Utaitai's non-content work, which is most of what "the project" actually is.
 * Grouped by track so the Hunt Board doesn't render one flat wall of twenty.
 *
 * Bootstrap only — see `seedMarks`. Marks get completed and deleted, so unlike
 * everything above these are written once and never reconciled.
 */
const UTAITAI_MARKS: {
  track: string;
  title: string;
  notes?: string;
  link?: string;
}[] = [
  // ── Ship ──────────────────────────────────────────────────────────────────
  {
    track: "Ship",
    title: "Get the iOS build onto TestFlight",
    notes: "Signing, capabilities, a build that installs on a real phone.",
  },
  {
    track: "Ship",
    title: "Get the Android build onto the internal testing track",
    notes: "Signing key in a safe place — losing it means a new listing.",
  },
  {
    track: "Ship",
    title: "App Store Connect: listing, screenshots, privacy labels",
  },
  {
    track: "Ship",
    title: "Play Console: listing, screenshots, data safety form",
  },
  { track: "Ship", title: "Submit the iOS build for review" },
  { track: "Ship", title: "Submit the Android build for review" },

  // ── Marketing: store presence ─────────────────────────────────────────────
  {
    track: "Marketing",
    title: "ASO pass — title, subtitle and keywords for both stores",
    notes:
      "The one marketing job that keeps paying after you stop doing it. Aim at what learners search: song names, 'learn Japanese with music'.",
  },
  {
    track: "Marketing",
    title: "Screenshots + a preview video for both stores",
    notes: "The daily TikToks are already this footage — cut them down.",
  },
  {
    track: "Marketing",
    title: "Landing page with both store links",
    notes: "Needed before Product Hunt and before any creator can link you.",
  },
  {
    track: "Marketing",
    title: "Pitch Apple and Google for editorial featuring",
    notes: "Both have submission forms. Free, and the upside is enormous.",
  },

  // ── Marketing: creators & launch ──────────────────────────────────────────
  {
    track: "Marketing",
    title: "Line up 3 language-learning creators for a collab",
    notes:
      "Look for JP/CN learning accounts already doing song breakdowns — the overlap with the app is exact.",
  },
  {
    track: "Marketing",
    title: "Product Hunt launch",
    notes: "Blocked on the landing page and the store listings being live.",
  },
  {
    track: "Marketing",
    title: "Build-in-public thread from Coding Mom about shipping Utaitai",
    notes:
      "Different brand, same work — this is exactly the drop that carries a brand and no project.",
  },

  // ── Users ─────────────────────────────────────────────────────────────────
  {
    track: "Users",
    title: "In-app feedback button that emails me",
    notes:
      "The cheapest possible way to hear from users. One button, one mailto or form endpoint.",
  },
  {
    track: "Users",
    title: "Reply to every comment on both TikToks for a week",
    notes:
      "The audience is already there and already talking. This is the highest-signal user research available today, at zero cost.",
  },
  {
    track: "Users",
    title: "Book 5 user interviews with people who commented",
    notes: "20 minutes each. Ask what they were doing before they found you.",
  },
  {
    track: "Users",
    title: "Open a Discord (or Line group) for early users",
    notes: "Somewhere they can talk to you and to each other.",
  },
  {
    track: "Users",
    title: "Prompt for an App Store review after N songs learned",
    notes: "Ratings gate everything else in the stores. Ask at the good moment.",
  },

  // ── Content ───────────────────────────────────────────────────────────────
  {
    track: "Content",
    title: "Batch day — 7 songs each for JP + CN, recorded from the app",
    notes:
      "The weekly ritual. Find the songs, screen-record the clips, then fill the week in Studio → Fill the week.",
  },
];

/**
 * Bootstrap, not reconciliation: marks are seeded only into a project that has
 * none. Upserting them would resurrect every mark you'd since completed and
 * deleted, which is the opposite of useful.
 */
async function seedMarks() {
  const project = await db.project.findUnique({ where: { slug: "utaitai" } });
  if (!project) return 0;

  const existing = await db.mark.count({ where: { projectId: project.id } });
  if (existing > 0) return 0;

  await db.mark.createMany({
    data: UTAITAI_MARKS.map((mark, index) => ({
      title: mark.title,
      notes: mark.notes ?? null,
      link: mark.link ?? null,
      track: mark.track,
      projectId: project.id,
      areaId: project.areaId,
      sortOrder: index,
    })),
  });

  return UTAITAI_MARKS.length;
}

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

  const marksCreated = await seedMarks();

  const counts = {
    areas: await db.area.count(),
    projects: await db.project.count(),
    brands: await db.brand.count(),
    channels: await db.channel.count(),
    series: await db.series.count(),
    marks: await db.mark.count(),
  };
  console.log("Seeded:", counts);
  if (marksCreated === 0) {
    console.log("Marks: left alone — Utaitai already has some.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
