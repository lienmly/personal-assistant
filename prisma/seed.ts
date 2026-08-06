import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";

import type {
  ContentFormat,
  ProjectPriority,
  ProjectStatus,
} from "@prisma/client";

const db = new PrismaClient();

/**
 * Seeds the **scaffolding** as of 2026-07-30: areas, projects, brands,
 * channels, series and the project docs. Idempotent — every write is an upsert
 * keyed on something stable, so `npm run db:seed` is safe to re-run after a
 * schema change without wiping the items you've since typed in.
 *
 * It does **not** seed tasks, sprints or events (2026-08-04). All three used to
 * be invented here, and all three failed the same way: a row you did not write
 * is one you have to stop and disprove before you may dismiss it, and matching
 * on title meant deleting one only bought you until the next `db:seed`.
 * Structure is seeded; the work that hangs off it is yours.
 *
 * Handles are best guesses where I didn't have them. Edit them in Studio →
 * Channels rather than here; this file is a starting point, not the source of
 * truth once the app is live.
 */

/**
 * Docs, bootstrapped from `prisma/docs/*.md`.
 *
 * These files used to live in `/docs` next to the guides that are about the
 * *app*, which is one folder away from the project they describe and a git
 * commit away from being edited. They are seed material now: the row in
 * Postgres is the copy that gets read and written, and the file is only how an
 * empty database gets one.
 *
 * `update: {}` for the same reason the Project upsert has it — the moment a
 * column is editable in the app, every value in it is a decision, and a
 * re-seed that reverted last night's writing is exactly the failure this
 * whole move was meant to end.
 */
/**
 * A doc hangs off a project or an area (2026-08-05), so its seed entry names
 * one or the other. `baby-languages.md` is the first area doc: the Baby area has
 * no project by design, and what I want for her still has to live somewhere.
 */
type SeedDoc = { file: string; title: string } & (
  | { projectSlug: string; areaSlug?: never }
  | { areaSlug: string; projectSlug?: never }
);

const DOCS: SeedDoc[] = [
  {
    projectSlug: "coding-mom",
    file: "coding-mom.md",
    title: "The brand and the project",
  },
  { projectSlug: "forge", file: "forge-vision.md", title: "The startup brief" },
  // The brief is the pitch; this is the plan. Split for the same reason Utaitai's
  // pricing note and its road to $100 MRR are two docs — one says what the thing
  // is, the other says what happens next, and they change on different clocks.
  { projectSlug: "forge", file: "forge-yc.md", title: "The road to YC" },
  {
    projectSlug: "sleepy-cat",
    file: "sleepy-cat-steam.md",
    title: "The road to Steam",
  },
  // A pointer to the Google Doc he and I write in, plus a dated snapshot —
  // deliberately not a copy of it. See the note at the top of the file.
  {
    projectSlug: "sleepy-cat",
    file: "sleepy-cat-feedback.md",
    title: "Design feedback — the shared doc",
  },
  {
    projectSlug: "utaitai",
    file: "utaitai-pricing.md",
    title: "What Utaitai charges",
  },
  { areaSlug: "baby", file: "baby-languages.md", title: "Languages" },
];

async function seedDocs(): Promise<number> {
  let created = 0;

  for (const entry of DOCS) {
    const owner = entry.projectSlug
      ? await db.project
          .findUnique({
            where: { slug: entry.projectSlug },
            select: { id: true },
          })
          .then((row) => (row ? { projectId: row.id } : null))
      : await db.area
          .findUnique({
            where: { slug: entry.areaSlug },
            select: { id: true },
          })
          .then((row) => (row ? { areaId: row.id } : null));
    if (!owner) continue;

    const slug = entry.file.replace(/\.md$/, "");
    // `findFirst` rather than a compound `findUnique`: the two unique keys are
    // `[projectId, slug]` and `[areaId, slug]`, and which one applies depends on
    // the owner. This is the same lookup either way.
    const existing = await db.doc.findFirst({
      where: { ...owner, slug },
      select: { id: true },
    });
    if (existing) continue;

    await db.doc.create({
      data: {
        ...owner,
        slug,
        title: entry.title,
        body: readFileSync(join(__dirname, "docs", entry.file), "utf8"),
      },
    });
    created++;
  }

  return created;
}

const AREAS = [
  { slug: "work", name: "Work", color: "#3b6fd4", sortOrder: 0 },
  { slug: "hobbies", name: "Hobbies", color: "#2f8f5b", sortOrder: 1 },
  { slug: "baby", name: "Baby", color: "#d9852b", sortOrder: 2 },
  { slug: "home", name: "Home & Money", color: "#6b5bd4", sortOrder: 3 },
];

/**
 * The roster, in the order it actually deserves attention — which is what
 * `priority` records and `sortOrder` mirrors (2026-07-31).
 *
 * Two are `main`: Sleepy Cat, which has a launch to reach, and Coding Mom,
 * which posts every day. Two are `side`: Utaitai, now on maintenance — its
 * content keeps shipping but no new energy goes in — and Forge, which is design
 * and research on the side *until Sleepy Cat launches*, at which point it
 * becomes the main project and this list gets re-tiered.
 *
 * `priority` and `status` are separate columns because they answer separate
 * questions. Utaitai is `active` (it is genuinely still moving, daily) and
 * `side` (it should not be asking for anything). Encoding "maintenance mode" as
 * `simmering` would have been the obvious shortcut and it lies twice: it hides
 * the project from the drift check it still deserves, and it says the content
 * stopped, which it hasn't.
 *
 * **All four are in the Work area, and the Baby area's emptiness is the decision
 * rather than a gap (2026-08-05).** "Multilingual baby" lived there and was
 * removed: caring for her is the main thing already happening every day, so a
 * backlog about it could only ever report on something already guaranteed — a
 * cadence of 2 on the most-attended-to thing in the house is a drift warning
 * that can never fire honestly. What the area is *for* is still being worked
 * out; a development-milestone journal is the direction, and it is a noun this
 * app does not have yet. See §6, "The Baby area is a journal, not a backlog".
 */
const PROJECTS = [
  {
    slug: "sleepy-cat",
    name: "Sleepy Cat",
    description:
      "A short cozy game made with my husband — he draws, I build. Headed for Steam.",
    areaSlug: "work",
    // Was 7. A main project with a weekly cadence contradicts the tiering: it
    // could sit untouched for six days without the dashboard saying a word.
    cadenceDays: 3,
    sortOrder: 0,
    priority: "main",
    status: "active",
  },
  // Coding Mom is a Brand *and* a Project, and that is not a contradiction — it's
  // the two-axis model (§6) at its clearest. The brand is who is talking; the
  // project is the audience-building work itself, which has its own accounts to
  // create, its own content bank to keep stocked and its own backlog. Without the
  // project half, "create the Coding Mom TikTok" had to be filed under Sleepy Cat,
  // which is where it actually was until 2026-07-31.
  {
    slug: "coding-mom",
    name: "Coding Mom",
    description:
      "Building an audience as a mom who builds — and the community Forge will launch into.",
    areaSlug: "work",
    cadenceDays: 1,
    sortOrder: 1,
    priority: "main",
    status: "active",
  },
  // The eventual main startup: AI-designed AIoT hardware plus a marketplace, aimed
  // at YC. It was seeded `simmering` on 2026-07-31 because nothing had started;
  // it is `active` and `side` now that design and research are genuinely running
  // alongside Utaitai. A fortnightly cadence is the point — enough to notice a
  // month of silence, not enough to nag about a week of it.
  {
    slug: "forge",
    name: "Forge",
    description:
      "Design life-changing AIoT hardware with AI, prototype for $200, sell it. The full brief is on the Docs tab.",
    areaSlug: "work",
    cadenceDays: 14,
    sortOrder: 2,
    priority: "side",
    status: "active",
  },
  // Maintenance mode. Still shipping its daily shorts — which is why it stays
  // `active` and why its `lastTouchedAt` will keep bumping on its own — but the
  // ship/users/marketing backlog is no longer where the week goes.
  {
    slug: "utaitai",
    name: "Utaitai",
    description: "Learn a language through the songs you already love.",
    areaSlug: "work",
    cadenceDays: 14,
    sortOrder: 3,
    priority: "side",
    status: "active",
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
      // Where the TikTok gets re-uploaded. Same file, three more places —
      // repurposing kind 1, which is meant to cost nothing (§6).
      { platform: "instagram", handle: "codingmom", label: "Reels", state: "planned" },
      { platform: "facebook", handle: "codingmom", label: "Reels", state: "planned" },
      { platform: "youtube", handle: "codingmom", label: "Shorts", state: "planned" },
    ],
  },
  {
    slug: "sleepy-cat",
    name: "Sleepy Cat",
    tagline: "The game's own account — devlog and art, aimed at players.",
    color: "#5b7fa8",
    sortOrder: 2,
    // Seven, as of 2026-08-05 — the game's own presence, created ahead of the
    // Steam page so the links on it point at something. All `planned`: the row
    // is the record that the account is *meant* to exist, and it flips to `live`
    // when it does (§6 — a channel usually exists before the account does).
    //
    // The handle is deliberately identical across all seven. A game linked from
    // a Steam page is searched for by name, and one handle that is wrong
    // everywhere is recoverable where six different ones are not.
    channels: [
      { platform: "x", handle: "sleepycatgame", label: "Devlog", state: "planned" },
      { platform: "threads", handle: "sleepycatgame", label: "Devlog", state: "planned" },
      // The one that actually drives wishlists for a cozy game, which is why it
      // is the only one of the five below that is not just a re-upload target.
      { platform: "tiktok", handle: "sleepycatgame", label: "Devlog", state: "planned" },
      { platform: "instagram", handle: "sleepycatgame", label: "Reels", state: "planned" },
      { platform: "facebook", handle: "sleepycatgame", label: "Reels", state: "planned" },
      { platform: "youtube", handle: "sleepycatgame", label: "Shorts", state: "planned" },
      // Not a broadcast account and never gets a Series — see the note on
      // `Platform.reddit` in schema.prisma. It is here because r/cozygames and
      // Screenshot Saturday are real wishlist sources and the account needs
      // karma and history long before it needs to post about a launch.
      { platform: "reddit", handle: "sleepycatgame", label: "Communities", state: "planned" },
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
    // Was `null` — "brand-building, not work on a specific app". True until
    // 2026-07-31, when Coding Mom became a project in its own right. The daily
    // short *is* that project's work, so it hangs off it and each post bumps its
    // `lastTouchedAt`; otherwise Momentum would show it drifting on a day you
    // posted. The two axes still don't collapse: a Sleepy Cat devlog going out
    // from this brand carries `projectId: sleepy-cat`, which is the whole point.
    projectSlug: "coding-mom",
    format: "short_video",
    cadence: "daily",
    daysOfWeek: [],
    timeOfDay: "20:00",
    // Off until the account actually exists — a planned channel shouldn't be
    // generating slots you can't fill.
    isActive: false,
    // Four channels, one piece of work: shoot for TikTok, re-upload three
    // times. Wired up now so that flipping `isActive` once the account exists
    // is the only step left.
    channelKeys: [
      { platform: "tiktok", handle: "codingmom" },
      { platform: "instagram", handle: "codingmom" },
      { platform: "facebook", handle: "codingmom" },
      { platform: "youtube", handle: "codingmom" },
    ],
  },
  {
    name: "Weekly essay",
    brandSlug: "coding-mom",
    projectSlug: "coding-mom",
    format: "article",
    cadence: "weekly",
    daysOfWeek: [7], // Sunday
    timeOfDay: "09:00",
    isActive: true,
    channelKeys: [{ platform: "medium", handle: "codingmom" }],
  },
] as const;

/**
 * **The seed does not create tasks.** It used to create seventy-eight of them
 * across five projects, and matched on title so that anything you deleted came
 * straight back on the next run — which is why the board filled with work
 * nobody remembered typing.
 *
 * This is the same rule the calendar already reached on 2026-08-03 for Events,
 * one noun over: a task is a thing you owe, and a thing you owe cannot be
 * invented for you. A seeded task you did not write is worse than an empty
 * board, because you have to stop and work out whether it was yours before you
 * are allowed to dismiss it.
 *
 * What the seed still does is bootstrap the *scaffolding* — areas, projects,
 * brands, channels, series and the project docs. Those are structure. The work
 * that hangs off them is yours.
 *
 * The tasks that were here are in `backups/tasks-2026-08-04.json` and in git
 * history, if any of them is ever wanted back.
 */

/**
 * Coding Mom's content bank — seven pillars, written down once so the daily
 * question is "which of these" and never "what on earth do I post today".
 *
 * These are Content, not Tasks, and stage `idea` is exactly what it's for (§6): a
 * post is not binary work, it moves through produce → scheduled → published and
 * fans out to four accounts. They carry no `publishAt` and no series, so they sit
 * in the board's idea column as a bank and get pulled into a slot when their turn
 * comes, rather than pretending to be scheduled.
 *
 * `projectId` is the second axis doing its job: most are the audience-building
 * itself (Coding Mom), one is about the game (Sleepy Cat), the hardware ones are
 * about Forge, and the unbuilt app ideas belong to no project at all yet.
 */
type SeedDrop = {
  pillar: string;
  title: string;
  format: ContentFormat;
  notes?: string;
  projectSlug?: string | null;
};

const CODING_MOM_DROPS: SeedDrop[] = [
  // ── Pillar: Baby — what I'm learning by doing it ──────────────────────────
  {
    pillar: "Baby",
    title: "The baby-care thing I got wrong for three weeks straight",
    format: "short_video",
  },
  {
    pillar: "Baby",
    title: "Newborn wake windows, explained the way I wish someone had",
    format: "short_video",
  },
  {
    pillar: "Baby",
    title: "The five baby purchases that actually earned their place",
    format: "short_video",
  },
  // These three used to carry `projectSlug: "multilingual-baby"`. The project
  // went on 2026-08-04 and they stayed, which is the two axes (§6) surviving
  // the loss of one of them: Coding Mom is who is talking, and that half was
  // never in question. They are brand-only ideas now, like the three above.
  {
    pillar: "Baby",
    title: "Raising her in two languages when only one of them is easy",
    format: "short_video",
  },
  {
    pillar: "Baby",
    title: "Her dad is Russian and won't teach her. Here's what I'm doing.",
    format: "short_video",
  },
  {
    pillar: "Baby",
    title: "What reading to a four-month-old in Vietnamese actually looks like",
    format: "short_video",
  },

  // ── Pillar: Build — what I'm making and how ───────────────────────────────
  {
    pillar: "Build",
    title: "How I ship an app in nap-length blocks",
    format: "short_video",
    projectSlug: "coding-mom",
  },
  {
    pillar: "Build",
    title: "What 'I built this with AI' actually looks like hour to hour",
    format: "short_video",
  },
  {
    pillar: "Build",
    title: "Idea to TestFlight, alone, with a baby: the whole stack",
    format: "short_video",
    projectSlug: "utaitai",
  },

  // ── Pillar: The roster — on-brand apps I'm building or want to ────────────
  {
    pillar: "Roster",
    title: "We made a game to stay connected postpartum — he draws, I build",
    format: "short_video",
    notes:
      "Sleepy Cat. The 'it's a bit forced' part is the honest bit and it is what makes it land — two exhausted people inventing a reason to be in the same room.",
    projectSlug: "sleepy-cat",
  },
  {
    pillar: "Roster",
    title: "The baby scheduling app I'm building because the notebook stopped working",
    format: "short_video",
    projectSlug: null,
  },
  {
    pillar: "Roster",
    title: "An app that shows the registered offenders near an address you're considering",
    format: "short_video",
    notes:
      "Built on the public registries. The hook is the real moment: checking before deciding where to live.",
    projectSlug: null,
  },
  {
    pillar: "Roster",
    title: "BLM recipe app",
    format: "short_video",
    notes:
      "Captured verbatim from the brain-dump — expand what BLM stands for before this becomes a post. There's a task on the Coding Mom board for it.",
    projectSlug: null,
  },
  {
    pillar: "Roster",
    title: "The app ideas I lost because I didn't write them down",
    format: "short_video",
    notes:
      "Doubles as content and as recovery: the comments will hand you back better versions of the ones you forgot.",
  },

  // ── Pillar: B-roll — the 3am reasons ──────────────────────────────────────
  {
    pillar: "B-roll",
    title: "Lying awake at 3am dreaming about the day this works and I can stay home with her",
    format: "short_video",
  },
  {
    pillar: "B-roll",
    title: "Hoping this takes off so she never has to ask for the life I want to give her",
    format: "short_video",
  },
  {
    pillar: "B-roll",
    title: "One hand on the keyboard, one hand holding her",
    format: "short_video",
  },
  {
    pillar: "B-roll",
    title: "The version of me she'll remember is the one building at midnight",
    format: "short_video",
  },

  // ── Pillar: Mom & wife — the harder ones ──────────────────────────────────
  {
    pillar: "Home truths",
    title: "\"A husband trains his wife to be virtuous\" — a phrase I grew up hearing",
    format: "short_video",
  },
  {
    pillar: "Home truths",
    title: "My dad was kind to me and dismissive of my mom. Both are true.",
    format: "article",
    notes:
      "Long-form first — this one needs room and a Medium essay gives it that. Cut the short version from the essay afterwards as a derived item, not the other way round.",
  },
  {
    pillar: "Home truths",
    title: "Splitting a baby, a house and two startups with the same person",
    format: "short_video",
  },

  // ── Pillar: Multilingual — the plan for her ───────────────────────────────
  {
    pillar: "Multilingual",
    title: "The plan to raise her multilingual — who speaks what, and when",
    format: "short_video",
  },
  {
    pillar: "Multilingual",
    title: "Why I started before she could talk",
    format: "short_video",
  },
  {
    pillar: "Multilingual",
    title: "What I'd have to buy to make her foreign-language books readable at home (it doesn't exist)",
    format: "short_video",
    notes:
      "The bridge post. This is the one that hands the audience the problem Forge is being built to solve, so it should run before the hardware pillar starts.",
    projectSlug: "forge",
  },

  // ── Pillar: Hardware — the on-ramp to Forge ───────────────────────────────
  {
    pillar: "Hardware",
    title: "Building a clip-on that reads any physical book aloud, in any language",
    format: "short_video",
    projectSlug: "forge",
  },
  {
    pillar: "Hardware",
    title: "The baby breathing sock is uncomfortable. Here's what I'd build instead.",
    format: "short_video",
    projectSlug: "forge",
  },
  {
    pillar: "Hardware",
    title: "$200 and an AI design tool — what can you actually get manufactured?",
    format: "short_video",
    projectSlug: "forge",
  },
  {
    pillar: "Hardware",
    title: "Hardware is where software was before AI",
    format: "article",
    notes: "The thesis post. This is Forge's pitch, told as an essay rather than a deck.",
    projectSlug: "forge",
  },
];

/**
 * The idea bank, bootstrapped into a brand that has none.
 *
 * **This is an all-or-nothing check, and the per-title version it replaces was
 * the same bug that filled the task board.** Matching on title means the seed
 * cannot tell "you never had this" from "you had it and threw it away", so
 * every idea you deleted came back on the next run. The cost of the stricter
 * guard is that the bank can no longer *grow* from this file — a new idea gets
 * typed into the Social Media board, which is where ideas are had anyway.
 *
 * Series slots are excluded from the count: those are generated rather than
 * seeded, so a brand whose only rows are empty slots still counts as bankless.
 */
async function seedDrops(brandSlug: string, items: SeedDrop[]) {
  const brand = await db.brand.findUnique({ where: { slug: brandSlug } });
  if (!brand) return 0;

  const existing = await db.contentItem.count({
    where: { brandId: brand.id, seriesId: null },
  });
  if (existing > 0) return 0;

  const fresh = items;
  if (fresh.length === 0) return 0;

  const projects = await db.project.findMany({ select: { id: true, slug: true } });
  const projectId = new Map(projects.map((p) => [p.slug, p.id]));

  await db.contentItem.createMany({
    data: fresh.map((item) => ({
      title: item.title,
      // There is no `pillar` column and there shouldn't be one — seven strings
      // don't earn a table. Carrying it in the notes keeps the rotation legible
      // on the card without a migration.
      notes: [`Pillar: ${item.pillar}`, item.notes].filter(Boolean).join("\n\n"),
      format: item.format,
      stage: "idea" as const,
      brandId: brand.id,
      projectId: item.projectSlug ? (projectId.get(item.projectSlug) ?? null) : null,
    })),
  });

  return fresh.length;
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

  for (const { areaSlug, status, priority, ...project } of PROJECTS) {
    const area = await db.area.findUniqueOrThrow({ where: { slug: areaSlug } });
    await db.project.upsert({
      where: { slug: project.slug },
      // Create-only, all of it. `status` always was — re-seeding must not undo
      // a "let it simmer", because the demotion is a decision, not a typo —
      // and as of the Projects editor every other column here is a decision
      // too: the name, the area, the cadence and the tiering are all set from
      // the app now. This file bootstraps an empty database and records what
      // the roster started as; the app owns it from the first edit onward.
      //
      // A project that needs correcting gets corrected in the UI. Reasserting
      // from here would mean a re-seed silently reverting last week's
      // re-tiering, which is the exact failure the editor exists to end.
      update: {},
      create: {
        ...project,
        status: status as ProjectStatus,
        priority: priority as ProjectPriority,
        areaId: area.id,
      },
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
      // `isActive` is deliberately **not** reasserted. Switching a series off
      // is a decision made in the app — the two Utaitai dailies were turned off
      // on 2026-08-04 because fourteen empty slots a week is data entry nobody
      // has time for — and a re-seed that flipped them back on would start the
      // slots generating again with no visible cause. Same rule as the Project
      // upsert's `update: {}`, for the same reason.
      update: {
        format: series.format,
        cadence: series.cadence,
        daysOfWeek: [...series.daysOfWeek],
        timeOfDay: series.timeOfDay,
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

  const docsCreated = await seedDocs();
  const dropsCreated = await seedDrops("coding-mom", CODING_MOM_DROPS);

  const counts = {
    areas: await db.area.count(),
    projects: await db.project.count(),
    brands: await db.brand.count(),
    channels: await db.channel.count(),
    series: await db.series.count(),
    tasks: await db.task.count(),
    items: await db.contentItem.count(),
    events: await db.event.count(),
  };
  console.log("Seeded:", counts);
  console.log(
    dropsCreated === 0
      ? "Ideas: left alone — the bank already has something in it."
      : `Ideas: banked ${dropsCreated} for Coding Mom.`,
  );
  console.log("Tasks: none — nothing but you creates a task.");
  console.log("Sprints: none — the sprint was retired on 2026-08-04.");
  console.log(
    "Events: none — the calendar only ever holds what you put there.",
  );
  console.log(
    docsCreated === 0
      ? "Docs: left alone — they are edited in the app now."
      : `Docs: imported ${docsCreated} from prisma/docs.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
