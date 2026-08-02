import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";

import { nextOccurrence } from "../lib/calendar-keys";
import { todayKey } from "../lib/utils";
import type {
  ContentFormat,
  ProjectPriority,
  ProjectStatus,
  Recurrence,
} from "@prisma/client";

const db = new PrismaClient();

/**
 * Seeds the real world as of 2026-07-30. Idempotent — every write is an upsert
 * keyed on something stable, so `npm run db:seed` is safe to re-run after a
 * schema change without wiping the items you've since typed in.
 *
 * Handles are best guesses where I didn't have them. Edit them in Studio →
 * Channels rather than here; this file is a starting point, not the source of
 * truth once the app is live.
 */

/**
 * Project docs, bootstrapped from `prisma/docs/*.md`.
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
const PROJECT_DOCS: { projectSlug: string; file: string; title: string }[] = [
  {
    projectSlug: "coding-mom",
    file: "coding-mom.md",
    title: "The brand and the project",
  },
  { projectSlug: "forge", file: "forge-vision.md", title: "The startup brief" },
  {
    projectSlug: "multilingual-baby",
    file: "multilingual-baby.md",
    title: "Three languages, one unsolved",
  },
];

async function seedDocs(): Promise<number> {
  let created = 0;

  for (const entry of PROJECT_DOCS) {
    const project = await db.project.findUnique({
      where: { slug: entry.projectSlug },
      select: { id: true },
    });
    if (!project) continue;

    const slug = entry.file.replace(/\.md$/, "");
    const existing = await db.projectDoc.findUnique({
      where: { projectId_slug: { projectId: project.id, slug } },
      select: { id: true },
    });
    if (existing) continue;

    await db.projectDoc.create({
      data: {
        projectId: project.id,
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
      "Design life-changing AIoT hardware with AI, prototype for $200, sell it. Vision: docs/forge-vision.md.",
    areaSlug: "work",
    cadenceDays: 14,
    sortOrder: 2,
    priority: "side",
    status: "active",
  },
  // The one deliberate thing in the Baby area, and the reason there is a
  // project rather than a handful of loose tasks: it has a backlog (Russian is
  // an unsolved problem, not a task), it has a cadence worth drifting against,
  // and it feeds the Coding Mom content bank — the bilingual-reading angle is
  // a pillar, so the project and the brand are the two axes again (§6).
  {
    slug: "multilingual-baby",
    name: "Multilingual baby",
    description:
      "Vietnamese and English every day. Russian is the open problem — her dad speaks it and won't teach her.",
    areaSlug: "baby",
    cadenceDays: 2,
    sortOrder: 4,
    priority: "main",
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
 * Utaitai's non-content work, which is most of what "the project" actually is.
 * Grouped by track so the Hunt Board doesn't render one flat wall of twenty.
 *
 * Bootstrap only — see `seedMarks`. Tasks get completed and deleted, so unlike
 * everything above these are written once and never reconciled.
 */
type SeedMark = {
  track: string;
  title: string;
  notes?: string;
  link?: string;
  /** Makes this a recurring task: one live row that advances each time it is
   *  ticked, rather than a one-off. See the `Task` model's recurrence block. */
  recurrence?: Recurrence;
  /** ISO weekdays for a `weekly` rule, 1 = Monday … 7 = Sunday. */
  daysOfWeek?: number[];
  /** "YYYY-MM-DD", read as a *local* calendar day. `dueDate` is `@db.Date`, so
   *  it is stored as UTC midnight standing in for that day (§6). */
  dueDate?: string;
};

/** The first day a seeded recurrence rule fires, counting from today. Null for
 *  a one-off, which is the overwhelming majority. */
function firstOccurrence(
  recurrence: Recurrence | undefined,
  daysOfWeek: number[] | undefined,
): Date | null {
  if (!recurrence || recurrence === "none") return null;
  const today = todayKey();
  const first = nextOccurrence(today, recurrence, daysOfWeek ?? [], null, today);
  return first ? new Date(`${first}T00:00:00.000Z`) : null;
}

/** The `@db.Date` convention, applied to a hand-written day string. */
function dateOnly(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

const UTAITAI_MARKS: SeedMark[] = [
  // ── Content: the batch, and the reason the rest of this list is reachable ─
  //
  // Utaitai posts daily on two accounts. Filling ~14 slots one card at a time
  // never happens, so the cadence is produced in two sittings a week and the
  // *sitting* is the task — one recurring row on Wednesday and Sunday, which
  // deep-links to the batch composer where a whole week goes in from one grid.
  //
  // These two days are also when the rest of the Utaitai backlog gets a look
  // in: Today shows the project's other open tasks underneath a batch day
  // ("While you're in it"), because the context is already loaded and the
  // alternative is that maintenance work never surfaces at all.
  {
    track: "Content",
    title: "Batch the Utaitai week",
    recurrence: "weekly",
    daysOfWeek: [3, 7],
    link: "/studio/batch",
    notes:
      "Fill every upcoming slot from one grid. Screen-record the songs, paste the refs, advance the row.",
  },

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
      "Different brand, same work — this is exactly the item that carries a brand and no project.",
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
 * Sleepy Cat's road to Steam. Four tracks, because the two halves the game
 * actually needs — gameplay polish and art — are different people's work on
 * different days, and collapsing them into one "Ship" list hides that half of
 * it isn't mine to do.
 *
 * Marketing runs on two brands at once, which is the two-axis model (§6) doing
 * its job: @sleepycatgame talks to players, Coding Mom talks about building it.
 */
const SLEEPY_CAT_MARKS: SeedMark[] = [
  // ── Build: polish gameplay + levels ───────────────────────────────────────
  {
    track: "Build",
    title: "Inventory every level — which are finished, which are still rough",
    notes:
      "Do this first. 'Polish the levels' is unstartable as a task; 'fix these four' isn't.",
  },
  {
    track: "Build",
    title: "Fix the top 5 feel problems — controls, camera, collision",
    notes:
      "The things that make a cozy game feel cheap. Write the list while playing, fix it after.",
  },
  {
    track: "Build",
    title: "Difficulty curve pass over the level order",
    notes: "Reorder before building anything new — it's free and usually enough.",
  },
  {
    track: "Build",
    title: "Pause, settings and save",
    notes:
      "A player on Steam will alt-tab, change the volume and quit mid-level. Without these that session ends badly.",
  },
  {
    track: "Build",
    title: "Controller support",
    notes: "Steam players expect it, and Valve asks about it on the store page.",
  },
  {
    track: "Build",
    title: "Watch 3 people play it without saying anything",
    notes:
      "Silently. Every instinct to explain the controls is a note about the tutorial.",
  },

  // ── Art ───────────────────────────────────────────────────────────────────
  {
    track: "Art",
    title: "Agree the full asset list with husband — one checklist, both of us",
    notes:
      "The handoff, not the drawing, is what stalls. One list means neither of us is guessing what's outstanding.",
  },
  {
    track: "Art",
    title: "Replace the placeholder sprites in the shipped levels",
  },
  {
    track: "Art",
    title: "UI and menu art pass",
    notes: "Menus are what the screenshots show, and screenshots sell the page.",
  },
  { track: "Art", title: "Title screen and logo" },
  {
    track: "Art",
    title: "Steam capsule art — main, small, header",
    notes:
      "Valve's sizes are exact and the capsule is most of your click-through. Not a last-week job.",
    link: "https://partner.steamgames.com/doc/store/assets/standard",
  },

  // ── Ship: Steam ───────────────────────────────────────────────────────────
  {
    track: "Ship",
    title: "Register Steamworks and pay the $100 app fee",
    notes: "Blocks everything else on this track. There's a ~30-day wait after it too.",
    link: "https://partner.steamgames.com/",
  },
  {
    track: "Ship",
    title: "Draft the store page — description, tags, screenshots, trailer",
  },
  {
    track: "Ship",
    title: "Build a depot and push a test build to Steam",
    notes: "Do it early with a rough build. The first upload is never the smooth one.",
  },
  {
    track: "Ship",
    title: "Get the store page live for wishlists",
    notes:
      "Wishlists before launch are the whole game on Steam. Every week the page isn't up is a week of them not accruing.",
  },
  {
    track: "Ship",
    title: "Set a release date",
    notes: "Valve wants ~2 weeks' notice, and the date is what makes the rest real.",
  },

  // ── Marketing ─────────────────────────────────────────────────────────────
  {
    track: "Marketing",
    title: "Create @sleepycatgame on X and Threads",
    notes:
      "Both are sitting in Studio → Channels as `planned`. Flip them to `live` once they exist.",
  },
  // "Create the Coding Mom TikTok account" used to live here, because Coding Mom
  // was only a brand and its chores had nowhere else to go. It now sits on the
  // Coding Mom project with the rest of the account chain — see `reseatMarks`.
  {
    track: "Marketing",
    title: "Cut a trailer — Steam page and socials off the same edit",
  },
];

/**
 * Coding Mom's own work, added 2026-07-31 when it stopped being only a brand.
 *
 * The Setup track is a strict chain and it is the only place in this file with
 * real due dates: create the e-mail, create the account, then *do not post for a
 * week*. A brand-new TikTok that posts on day one gets throttled, and a warm-up
 * is a thing you either do on specific days or don't do at all — so it is the one
 * piece of this that a date genuinely helps with. Everything downstream is dated
 * off the end of that week rather than off "soon".
 *
 * Dates assume a start of 2026-08-01. Move them; they're a spine, not a promise.
 */
const CODING_MOM_MARKS: SeedMark[] = [
  // ── Setup: the account chain ──────────────────────────────────────────────
  {
    track: "Setup",
    title: "Create the dedicated Coding Mom e-mail account",
    notes:
      "First, because every account below hangs off it — TikTok, Instagram, Facebook, YouTube, Threads, Medium. Doing this after the fact means migrating accounts instead of creating them.",
    dueDate: "2026-08-01",
  },
  {
    track: "Setup",
    title: "Create the Coding Mom TikTok account with that e-mail",
    notes:
      "The channel already exists in Studio → Channels as `planned`. Flip it to `live` once the account is real.",
    dueDate: "2026-08-01",
  },
  {
    track: "Setup",
    title: "Warm up the TikTok for a week — no posting until 2026-08-09",
    notes:
      "15 minutes a day: scroll, watch to the end, like, follow and comment in the mom / build / AIoT niche. This is what teaches the algorithm who you are before you ask it for anything, and it doubles as the best possible research for the content bank.",
    dueDate: "2026-08-08",
  },
  {
    track: "Setup",
    title: "Claim @codingmom on Instagram, Facebook, YouTube and Threads",
    notes:
      "Same e-mail, same handle. Claiming costs nothing today and is impossible later — all four are already sitting in Studio → Channels as `planned`.",
    dueDate: "2026-08-02",
  },
  {
    track: "Setup",
    title: "Write the bio — one line that says who this is and points at Forge",
    notes:
      "The bio is the only place Coding Mom converts an audience into Forge's waitlist. Worth 20 minutes now rather than a rewrite at 10k followers.",
  },
  {
    track: "Setup",
    title: "Flip the Coding Mom channels to `live` and switch on the Daily short",
    notes:
      "The series is seeded `isActive: false` because slots you cannot fill are worse than no slots. Turning it on is the last step of the warm-up week, not the first.",
    dueDate: "2026-08-09",
  },

  // ── Content ───────────────────────────────────────────────────────────────
  {
    track: "Content",
    title: "Brain-dump the rest of the app ideas before they're gone again",
    notes:
      "There were 'a ton' and most of them are already lost. Sit with a 15-minute timer and empty your head into the idea column — the roster of on-brand apps is a whole content pillar on its own, and you cannot post about ideas you can't remember.",
  },
  {
    track: "Content",
    title: "Decide what BLM stands for in 'BLM recipe app'",
    notes:
      "Written down from the brain-dump exactly as it was said. Expand it before it becomes a post — the idea is in the bank with the same warning on it.",
  },
  {
    track: "Content",
    title: "Set the pillar rotation — which pillar posts on which day",
    notes:
      "Seven pillars, one post a day. Deciding the rotation once is what stops the daily question 'what do I post today', which is the thing that actually kills a daily cadence.",
    dueDate: "2026-08-07",
  },
  {
    track: "Content",
    title: "Batch-film the first week of shorts during the warm-up",
    notes:
      "Day one of posting must not also be day one of filming. Fill them in Studio → Fill the week once the series is on.",
    dueDate: "2026-08-08",
  },

  // ── Users ─────────────────────────────────────────────────────────────────
  {
    track: "Users",
    title: "Find and follow 20 mom-builder / multilingual-parenting accounts",
    notes:
      "Do it inside the warm-up week — it counts as warming and it maps the niche you are about to post into.",
    dueDate: "2026-08-08",
  },
  {
    track: "Users",
    title: "Reply to every comment for the first month",
    notes:
      "Small accounts grow on replies. It is also where the Forge interviews come from — the people who comment on a SIDS-monitor video are exactly who you need to talk to.",
  },

  // ── Marketing ─────────────────────────────────────────────────────────────
  {
    track: "Marketing",
    title: "Stand up a Forge waitlist page for the bio to point at",
    notes:
      "Coding Mom is the community-building for Forge (§ docs/forge-vision.md). Until there is somewhere to send people, the audience doesn't compound into anything.",
  },
];

/**
 * Forge — the startup Coding Mom is the on-ramp to. Simmering by design: this is
 * the destination, and the work that gets you there is the audience and the two
 * prototypes, which are already tasks below.
 *
 * The full brief lives in `docs/forge-vision.md`; these are only the next real
 * moves, so the project reads as a thing you could start on a Tuesday rather
 * than as a pitch deck.
 */
const FORGE_MARKS: SeedMark[] = [
  // ── Build: the two flagship prototypes ────────────────────────────────────
  {
    track: "Build",
    title: "Spec the multilingual book reader — what it clips to, what it reads",
    notes:
      "The flagship. Start from the actual use: a Russian children's book, a Vietnamese-English household, a toddler who cannot read yet. One page of what it must do beats three months of what it could do.",
  },
  {
    track: "Build",
    title: "Breadboard version of the book reader — camera, speaker, off-the-shelf parts",
    notes:
      "Ugly and wired to a laptop is fine. The point is to learn whether it reads a real page in a real room, which no amount of design settles.",
  },
  {
    track: "Build",
    title: "Spec the baby breathing tracker as the comfortable alternative to the sock",
    notes:
      "The complaint is comfort and price, so those are the spec — not more sensors. Owlet already owns 'more sensors'.",
  },
  {
    track: "Build",
    title: "Price a $200 prototype run end to end with one manufacturer",
    notes:
      "The $200 sample credit is the load-bearing promise of the whole pitch. Find out what $200 actually buys before it goes on a landing page.",
  },

  // ── Users: the research the pitch assumes ─────────────────────────────────
  {
    track: "Users",
    title: "Interview 5 multilingual parents about reading to their kids",
    notes: "Recruit them from the Coding Mom comments — that is what the audience is for.",
  },
  {
    track: "Users",
    title: "Interview a pediatrician and a speech therapist",
    notes:
      "Both flagship products make claims about babies. Two conversations decide whether they are claims you can make.",
  },
  {
    track: "Users",
    title: "Talk to 3 manufacturers about small-run AIoT samples",
    notes:
      "The marketplace half of Forge is manufacturing partnerships. Nothing about it is real until someone on that side says yes.",
  },

  // ── Marketing ─────────────────────────────────────────────────────────────
  {
    track: "Marketing",
    title: "Document every prototype build as Coding Mom content",
    notes:
      "Phase 1 of the go-to-market *is* the content plan — the build videos are the marketing, so nothing gets built off-camera.",
  },
  {
    track: "Marketing",
    title: "Pick the real name — 'Forge' is a placeholder",
    notes:
      "ForgeMarket / ImpactForge / LuminaForge were the shortlist. Check the domain and the handles at the same time, and rename the project when it lands.",
  },

  // ── Ship ──────────────────────────────────────────────────────────────────
  {
    track: "Ship",
    title: "Draft the YC application against the current vision doc",
    notes:
      "Draft it early even if you apply late — the questions are the fastest way to find which parts of the vision are still hand-waving.",
    link: "https://www.ycombinator.com/apply",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Events (Phase 4)
// ─────────────────────────────────────────────────────────────────────────────

type SeedEvent = {
  title: string;
  areaSlug: string;
  projectSlug?: string;
  /** "HH:mm"–"HH:mm", or omitted for an all-day event. */
  from?: string;
  to?: string;
  /** Offsets in days from the seed run, so the calendar has something on it
   *  whenever this is run rather than in one fixed week of 2026. */
  startsIn?: number;
  endsIn?: number;
  allDay?: boolean;
  recurrence?: Recurrence;
  daysOfWeek?: number[];
  location?: string;
  notes?: string;
};

/**
 * The standing shape of the week — the blocks other work has to fit around.
 *
 * There is deliberately **no baby routine here**. The first version seeded one:
 * seven daily rows for feeds, naps, bath and bed, which read as a beautiful
 * demonstration of recurrence and was a lie about how the day actually goes. A
 * four-month-old is followed, not scheduled, and a calendar asserting a 13:00
 * nap every day mostly generates the feeling of being behind. The one thing
 * that genuinely is deliberate — reading to her in two languages — is a
 * recurring *task* in the Baby area, because it is something owed rather than
 * something that happens at a time.
 *
 * Removed 2026-08-02, along with the swim class and the check-up: the naps had
 * become load-bearing (the Sunday filming block was parked inside one) and that
 * dependency was on a fiction.
 */
const EVENTS: SeedEvent[] = [
  // ── Work: the standing blocks ─────────────────────────────────────────────
  {
    title: "Batch-film the week's shorts",
    areaSlug: "work",
    projectSlug: "coding-mom",
    from: "13:00",
    to: "15:00",
    recurrence: "weekly",
    daysOfWeek: [7],
    notes:
      "A daily cadence only survives if it's produced weekly, in one sitting.",
  },
  {
    title: "Fill the week's slots in Studio",
    areaSlug: "work",
    projectSlug: "coding-mom",
    from: "08:00",
    to: "08:30",
    recurrence: "weekly",
    daysOfWeek: [1],
  },
  {
    title: "Sleepy Cat playtest",
    areaSlug: "work",
    projectSlug: "sleepy-cat",
    from: "20:30",
    to: "21:30",
    recurrence: "weekly",
    daysOfWeek: [7],
    notes: "Play the current build together and write down what felt bad.",
  },

  // ── Home: the two shapes nothing else covers ──────────────────────────────
  {
    title: "Check the rent has landed",
    areaSlug: "home",
    allDay: true,
    startsIn: 1,
    recurrence: "monthly",
  },
  {
    title: "In-laws visiting",
    areaSlug: "home",
    allDay: true,
    startsIn: 14,
    endsIn: 17,
  },
];

/**
 * Bootstrap, not reconciliation — same rule as the tasks below. Events are
 * seeded only into a completely empty table, because there is no stable key to
 * upsert a "Morning feed" on and re-running this must not quietly give the baby
 * two of every nap.
 */
async function seedEvents() {
  if ((await db.event.count()) > 0) return 0;

  const areas = new Map(
    (await db.area.findMany()).map((area) => [area.slug, area]),
  );
  const projects = new Map(
    (await db.project.findMany()).map((project) => [project.slug, project]),
  );

  const now = new Date();
  /** A local calendar day, `offset` days from today. Built with the local
   *  constructor because `Event.start` is a real timestamp and both halves of
   *  the seed data mean local wall-clock (CLAUDE.md §6). */
  const at = (offset: number, time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + offset,
      hours,
      minutes,
    );
  };

  const data = EVENTS.flatMap((event) => {
    const project = event.projectSlug ? projects.get(event.projectSlug) : null;
    // The project's area wins, exactly as `saveEvent` enforces it.
    const area = project
      ? [...areas.values()].find((row) => row.id === project.areaId)
      : areas.get(event.areaSlug);
    if (!area) return [];

    const startsIn = event.startsIn ?? 0;
    const endsIn = event.endsIn ?? startsIn;

    return [
      {
        title: event.title,
        notes: event.notes ?? null,
        location: event.location ?? null,
        start: event.allDay ? at(startsIn, "00:00") : at(startsIn, event.from!),
        // Inclusive end — the last instant of the final day. See the note on
        // `Event.end` in the schema.
        end: event.allDay
          ? new Date(at(endsIn, "00:00").getTime() + 86_399_999)
          : at(endsIn, event.to!),
        allDay: event.allDay ?? false,
        recurrence: event.recurrence ?? "none",
        daysOfWeek: event.daysOfWeek ?? [],
        areaId: area.id,
        projectId: project?.id ?? null,
      },
    ];
  });

  await db.event.createMany({ data });
  return data.length;
}

/**
 * Bootstrap, not reconciliation: tasks are seeded only into a project that has
 * none. Upserting them would resurrect every task you'd since completed and
 * deleted, which is the opposite of useful.
 */
/**
 * The multilingual work. Two habits and one unsolved problem.
 *
 * The reading rows are `recurrence: "daily"` rather than seven dated tasks or a
 * calendar event: they are owed rather than scheduled, they happen whenever the
 * day allows, and a single live row that advances is the only shape that
 * doesn't either vanish when ticked or pile up when missed.
 *
 * Russian is deliberately one umbrella task plus three concrete leads. "Find a
 * solution" alone is the kind of task that sits open for a year because there
 * is no first move in it; the leads are the first moves, and any that turn out
 * to be wrong get deleted in a tap.
 */
const MULTILINGUAL_MARKS: SeedMark[] = [
  {
    track: "Vietnamese",
    title: "Read her a Vietnamese book",
    recurrence: "daily",
    notes: "Any length. The point is the sound of it, daily.",
  },
  {
    track: "English",
    title: "Read her an English book",
    recurrence: "daily",
  },
  {
    track: "Russian",
    title: "Work out how she gets Russian",
    notes:
      "Her dad is Russian and won't teach her, so it has to come from somewhere else. The three below are the leads worth trying first — this row is the decision, not the doing.",
  },
  {
    track: "Russian",
    title: "Find a Russian-speaking sitter or playgroup nearby",
    notes: "A few hours a week of a real speaker beats any amount of screen.",
  },
  {
    track: "Russian",
    title: "Ask his family to video-call her in Russian, regularly",
    notes:
      "Costs nothing and needs no buy-in from him. Wants to be a standing slot, not an ask each time.",
  },
  {
    track: "Russian",
    title: "Build a Russian shelf — songs, cartoons, board books",
    notes: "Lowest-effort lead. Won't make her fluent; will make it familiar.",
  },
  {
    track: "Content",
    title: "Film the two-language reading routine for Coding Mom",
    notes:
      "The bilingual-baby angle is a Coding Mom pillar and this project is where the footage comes from.",
  },
  {
    track: "Content",
    title: "Write up the Russian problem once it has an answer",
    notes:
      "'My daughter's dad is Russian and won't teach her' is a real post, and it needs the ending first.",
  },
];

async function seedMarks(slug: string, tasks: SeedMark[]) {
  const project = await db.project.findUnique({ where: { slug } });
  if (!project) return 0;

  // Per-title, not "does this project have any tasks at all". The old
  // all-or-nothing count meant a project could never gain a seeded task after
  // its first run — adding "Batch the Utaitai week" to a project holding
  // twenty rows was a silent no-op. Same fix as `seedDrops`.
  //
  // Completed tasks count as present, so ticking one doesn't bring it back.
  // A *deleted* one does return on the next seed; that is the honest cost of
  // matching on title, and re-deleting it is one tap.
  const seeded = new Set(
    (
      await db.task.findMany({
        where: { projectId: project.id },
        select: { title: true },
      })
    ).map((row) => row.title),
  );
  const fresh = tasks.filter((task) => !seeded.has(task.title));
  if (fresh.length === 0) return 0;

  const offset = seeded.size;

  await db.task.createMany({
    data: fresh.map((task, index) => ({
      title: task.title,
      notes: task.notes ?? null,
      link: task.link ?? null,
      track: task.track,
      // A recurring task with no due date has a rule that never fires — see
      // `saveTask`, which infers the same first date for one created in the UI.
      dueDate: task.dueDate
        ? dateOnly(task.dueDate)
        : firstOccurrence(task.recurrence, task.daysOfWeek),
      recurrence: task.recurrence ?? "none",
      daysOfWeek: task.daysOfWeek ?? [],
      projectId: project.id,
      areaId: project.areaId,
      // Appended rather than renumbered from zero, so a task added later
      // doesn't jump above the ones already on the board.
      sortOrder: offset + index,
    })),
  });

  return fresh.length;
}

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
  // These three carry `projectSlug: "multilingual-baby"` — the two axes doing
  // their job (§6). Coding Mom is who is talking; the multilingual project is
  // what it's about, and posting one bumps *that* project's lastTouchedAt, so
  // Momentum stops reporting it as drifting on a day it actually moved.
  {
    pillar: "Baby",
    title: "Raising her in two languages when only one of them is easy",
    format: "short_video",
    projectSlug: "multilingual-baby",
  },
  {
    pillar: "Baby",
    title: "Her dad is Russian and won't teach her. Here's what I'm doing.",
    format: "short_video",
    projectSlug: "multilingual-baby",
  },
  {
    pillar: "Baby",
    title: "What reading to a four-month-old in Vietnamese actually looks like",
    format: "short_video",
    projectSlug: "multilingual-baby",
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
 * Bootstrap only, on the same principle as `seedMarks`: seeded once, into a brand
 * with no free-standing items. Re-running must not resurrect an idea you looked
 * at and threw away. Series slots are excluded from the check — those are
 * generated, and they exist for Coding Mom already.
 */
async function seedDrops(brandSlug: string, items: SeedDrop[]) {
  const brand = await db.brand.findUnique({ where: { slug: brandSlug } });
  if (!brand) return 0;

  // Per-title rather than "has this brand any content at all". The all-or-
  // nothing count meant the bank could never *grow*: adding three multilingual
  // ideas to a file that had already seeded twenty-five was a silent no-op.
  // Titles are the stable key here — there is no slug on a content item, and
  // an idea whose title you rewrote is one you have already made yours.
  const seeded = new Set(
    (
      await db.contentItem.findMany({
        where: { brandId: brand.id, seriesId: null },
        select: { title: true },
      })
    ).map((row) => row.title),
  );
  const fresh = items.filter((item) => !seeded.has(item.title));
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

/**
 * The one piece of reconciliation in this file. "Create the Coding Mom TikTok
 * account" was seeded under Sleepy Cat because Coding Mom had no project to hang
 * it on; it does now, and the account chain there supersedes it. Only removed
 * while it is still untouched — a task you have started or finished is yours.
 */
async function reseatMarks() {
  const codingMom = await db.project.findUnique({ where: { slug: "coding-mom" } });
  const sleepyCat = await db.project.findUnique({ where: { slug: "sleepy-cat" } });
  if (!codingMom || !sleepyCat) return 0;

  const { count } = await db.task.deleteMany({
    where: {
      projectId: sleepyCat.id,
      status: "open",
      title: "Create the Coding Mom TikTok account",
    },
  });

  // Changing a Series' project doesn't retouch the slots it already generated,
  // so an empty slot made before Coding Mom was a project would publish without
  // bumping it. Restricted to *unfilled* slots — an empty title and no project is
  // the definition of untouched, and it leaves the 2026-08-02 essay (which
  // deliberately carries Sleepy Cat) exactly where it is.
  await db.contentItem.updateMany({
    where: {
      title: "",
      projectId: null,
      series: { brand: { slug: "coding-mom" } },
    },
    data: { projectId: codingMom.id },
  });

  return count;
}

/**
 * The first sprint, so the app never opens on an empty focus list.
 *
 * Bootstrap, not reconciliation — same rule as `seedMarks`. It runs only when
 * *no* sprint has ever existed, so it can't reach into a week you've already
 * planned. After this the sprint is planned in the app, on the Hunt Board.
 *
 * What goes in: everything already due inside the window (a due date is a
 * commitment the sprint has to honour, whatever else is going on), then the top
 * open tasks of the `main` projects until the sprint holds eight. Eight is a
 * week's worth alongside a daily posting cadence and a baby; the number matters
 * far less than the fact that there *is* one.
 */
async function seedFirstSprint() {
  if ((await db.sprint.count()) > 0) return null;

  const now = new Date();
  // `@db.Date`, so UTC midnight standing in for the local calendar day — see
  // CLAUDE.md §6, "Dates are a trap here".
  const startsOn = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  const endsOn = new Date(startsOn);
  endsOn.setUTCDate(endsOn.getUTCDate() + 6);

  const sprint = await db.sprint.create({
    data: {
      name: "Week 1",
      goal: "Get Coding Mom's accounts standing up and Sleepy Cat honestly assessed.",
      startsOn,
      endsOn,
      status: "active",
    },
  });

  const due = await db.task.findMany({
    where: { status: { not: "done" }, dueDate: { lte: endsOn } },
    select: { id: true },
    orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }],
  });

  // Round-robin across the main projects rather than straight down the sorted
  // list. Ordering by project and taking the first five hands you five tasks
  // from whichever project sorts first, which is a week spent on one thing —
  // the opposite of what a two-main-project roster is asking for.
  const mainProjects = await db.project.findMany({
    where: { priority: "main", status: "active" },
    select: { id: true },
    orderBy: { sortOrder: "asc" },
  });

  const queues = await Promise.all(
    mainProjects.map((project) =>
      db.task.findMany({
        where: { status: { not: "done" }, dueDate: null, projectId: project.id },
        select: { id: true },
        orderBy: { sortOrder: "asc" },
        take: 8,
      }),
    ),
  );

  const filler: { id: string }[] = [];
  for (let round = 0; filler.length < 8 - due.length; round += 1) {
    const before = filler.length;
    for (const queue of queues) {
      if (filler.length >= 8 - due.length) break;
      if (queue[round]) filler.push(queue[round]);
    }
    if (filler.length === before) break; // every queue is exhausted
  }

  const ids = [...due, ...filler].map((task) => task.id);
  await db.task.updateMany({
    where: { id: { in: ids } },
    data: { sprintId: sprint.id },
  });

  return ids.length;
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

  const docsCreated = await seedDocs();
  const reseated = await reseatMarks();

  const marksCreated =
    (await seedMarks("utaitai", UTAITAI_MARKS)) +
    (await seedMarks("sleepy-cat", SLEEPY_CAT_MARKS)) +
    (await seedMarks("coding-mom", CODING_MOM_MARKS)) +
    (await seedMarks("forge", FORGE_MARKS)) +
    (await seedMarks("multilingual-baby", MULTILINGUAL_MARKS));

  const dropsCreated = await seedDrops("coding-mom", CODING_MOM_DROPS);
  const sprintMarks = await seedFirstSprint();
  const eventsCreated = await seedEvents();

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
  console.log(`Tasks created: ${marksCreated}, ideas banked: ${dropsCreated}`);
  if (reseated > 0) {
    console.log("Moved 'Create the Coding Mom TikTok account' off Sleepy Cat.");
  }
  if (marksCreated === 0) {
    console.log("Tasks: left alone — every project already has some.");
  }
  console.log(
    sprintMarks === null
      ? "Sprint: left alone — one already exists."
      : `Sprint: created 'Week 1' with ${sprintMarks} tasks.`,
  );
  console.log(
    eventsCreated === 0
      ? "Events: left alone — the calendar already has some."
      : `Events: created ${eventsCreated}.`,
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
