# Clan Centurio — Personal Assistant Dashboard

> A private, web-based command center for organizing every part of my life,
> with **Montblanc**, an AI assistant, at its heart.
>
> _Named after Clan Centurio and its moogle leader Montblanc from Final Fantasy XII —
> a clan that takes on the "marks" (hunts) of the world. This dashboard takes on the
> marks of my life._

---

## 1. Vision

I have a lot going on — main work, side hobbies, and now a baby daughter — and I need
one place to organize all of it. Clan Centurio is that place: a personal dashboard I can
reach from **any device**, protected behind login, with an AI assistant (**Montblanc**)
that helps me plan, track, and stay on top of everything.

This is a **long-term, layer-by-layer build**. We are intentionally starting small and
adding capability over time. This document is the living blueprint — we update it as the
vision sharpens and as features get built.

### Guiding principles
- **Web-first, device-agnostic.** Must work well on phone, tablet, and desktop (responsive).
- **Private by default.** Auth-gated. Realistically a single user (me), but locked so a
  random visitor can't get in.
- **Incremental.** Each layer should be independently useful and shippable. No big-bang.
- **Extensible by design.** New "life areas" and features get added constantly, so the
  data model and UI must make adding a new area cheap.
- **Montblanc as connective tissue.** The AI assistant should eventually be able to read
  and act across all areas (calendar, tasks, projects), not just chat in a silo.

---

## 2. Branding & Naming

| Thing | Name | Notes |
|-------|------|-------|
| The dashboard | **Clan Centurio** | The product / app name |
| The AI assistant | **Montblanc** | Chat + assistant persona; friendly, helpful moogle energy ("kupo!") |
| Users are | Clan members | Me now; possibly my daughter later |
| Tasks / to-dos | **Marks** | Decided. The Hunt Board is where they live. |
| Content / posts | **Drops** | A unit of content going out to one or more channels. |

Keep the FFXII/Ivalice flavor available as a theming option, but never at the expense of
usability.

---

## 3. Tech Stack

Chosen for: single language across the stack, first-class Railway deployment, strong
dashboard/UI ecosystem, easy Google auth, and a clean path to embedding an AI assistant.

| Layer | Choice | Why |
|-------|--------|-----|
| **Framework** | **Next.js (App Router) + TypeScript** | Full-stack in one repo — React UI *and* backend API routes. Ideal for dashboards. Deploys cleanly on Railway. |
| **UI / styling** | **Tailwind CSS + shadcn/ui** | Highly customizable, copy-in components you own. Makes it realistic to match a Dribbble design you like. |
| **Database** | **PostgreSQL** (Railway managed) | Relational fits calendars, tasks, projects, relations. Railway provisions it in a click. |
| **ORM** | **Prisma** | Type-safe DB access, easy migrations, gentle learning curve. (Drizzle is the lighter-weight alternative if we prefer.) |
| **Auth** | **Auth.js (NextAuth) with Google provider** | Free, self-hosted, "Login with Google" out of the box. Restrict to my own Google account(s) via an allowlist. |
| **AI assistant (Montblanc)** | **Qwen API** + **Vercel AI SDK** | Decided 2026-07-30. Qwen exposes an OpenAI-compatible endpoint, so the AI SDK's `openai-compatible` provider talks to it directly and tool-calling still works. Swapping providers later is a one-file change. |
| **Calendar UI** | **Schedule-X** or **FullCalendar** | Mature calendar rendering (month/week/day). Decide when we build the calendar layer. |
| **Data fetching / state** | **TanStack Query** (where needed) + React Server Components | Server components for most reads; Query for interactive client bits. |
| **Hosting** | **Railway** | App + Postgres in one project. Env vars, deploys from GitHub. |
| **Source control** | **Git + GitHub** | Local git initialized in Phase 0. Push to GitHub when ready. |

> These are recommendations, not commitments. Any of them can change before we write real
> feature code. The near-locked choices are **Next.js + TypeScript + Postgres + Railway**,
> which everything else assumes.

---

## 4. High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Clan Centurio (Next.js)              │
│                                                          │
│   Browser  ──►  App Router pages (RSC + client comps)    │
│                    │                                     │
│                    ├─ Route handlers / server actions    │
│                    │        │                            │
│                    │        ├─ Auth.js (Google)          │
│                    │        ├─ Prisma ──► PostgreSQL     │
│                    │        └─ Montblanc ──► Claude API  │
│                    │                                     │
└─────────────────────────────────────────────────────────┘
                 Deployed on Railway (app + DB)
```

### Folder layout
```
/app/(app)/…       → the five authenticated surfaces + their shared layout
/app/login         → public sign-in page
/app/api/auth/…    → Auth.js route handler
/components/shell  → icon rail, sidebar, topbar, mobile tab bar
/components/ui     → card, empty state, surface header
/components/brand  → the moogle mark
/lib               → auth config, nav config, server actions, utils
/components/studio → the drop board, drop panel, channel manager
/lib/db.ts         → Prisma client singleton
/lib/studio.ts     → board queries + series slot generation
/lib/studio-actions.ts → server actions for drops, channels, series
/lib/montblanc     → AI assistant logic (prompts, tools) — Phase 5
/prisma            → schema.prisma, migrations, seed.ts
/proxy.ts          → route protection (Next 16's renamed Middleware)
/public            → static assets, icons, branding
/assets            → styling reference screenshots — consult before building UI (§9)
```
_(Everything above exists except `/lib/montblanc`, which arrives with Phase 5.)_

---

## 5. Feature Roadmap (layer by layer)

Ordered so each phase builds on the last. We ship and use each layer before moving on.

### Phase 0 — Foundation
- [x] Initialize Git repo
- [x] Scaffold Next.js + TypeScript + Tailwind
- [x] Push to GitHub — `https://github.com/lienmly/personal-assistant`
- [x] Deploy to Railway — branded landing shell is live (pipeline proven end-to-end)
- [x] Provision Postgres on the Railway project
- [x] Prisma installed and wired (`prisma/schema.prisma`, `lib/db.ts`, `prisma/seed.ts`)
- [x] First migration run — `20260731033858_social_layer` applied, seed loaded
      (4 areas, 2 projects, 3 brands, 10 channels, 4 series)

### Phase 1 — Auth & Shell
- [x] Google login via Auth.js v5 (`lib/auth.ts`, JWT sessions — no DB needed yet)
- [x] Allowlist so only my account(s) can enter (`AUTH_ALLOWLIST`, fails closed)
- [x] Authenticated app shell: the five surfaces from §6 (Today, Hunt Board, Calendar,
      Studio, Projects) wired up with empty states
- [x] Area sidebar (hardcoded areas; the tree replaced the planned chip row — the
      reference design's nested tree does the job better)
- [x] Responsive layout baseline — icon rail on desktop, bottom tab bar on phone
      _(phone layout not yet visually confirmed on a real device)_
- [x] Sidebar tree reads real Areas and Projects from Postgres (`PLACEHOLDER_PROJECTS` deleted)

### Phase 2 — Studio (content distribution)
_Pulled ahead of Marks on 2026-07-30. Social output is the work that's actually
overflowing right now — a daily cadence on two TikToks with three more brands coming —
so it earns the first real data layer. Marks can wait; the posting can't._
- [x] Area + Project + Brand + Channel + Series + Drop + DropChannel schema
- [x] Seed of the real brands, accounts and standing series
- [x] Studio board: five stages, brand filter, drop panel, per-channel publish checklist
- [x] Series slot generation — the daily cadence materialises itself
- [x] Repurposing both ways: extra channels on one drop, derived drops across forms
- [x] Brands & channels admin at `/studio/channels`
- [x] Publishing a Drop bumps its Project's `lastTouchedAt`
- [x] Projects surface reads real projects, with drift warnings
- [ ] Today, band 2 (Going out today)
- [ ] Per-project Drop list on the project card

### Phase 3 — Marks & the Hunt Board
- [ ] Mark schema and migration
- [ ] Mark CRUD; completing a Mark bumps its Project's `lastTouchedAt`
- [ ] Hunt Board: open Marks grouped by Project
- [ ] Project CRUD (creating/editing projects, not just reading them)
- [ ] Today, bands 1 & 4 (Marks due, Momentum)

### Phase 4 — Calendar
- [ ] Calendar data model (events, recurring events)
- [ ] Month / week / day views
- [ ] Create / edit / delete events
- [ ] Layer in Mark due dates and Drop publish dates alongside events
- [ ] Baby daughter's activity calendar (feeds, naps, milestones, appointments)
- [ ] Today, band 3 (Agenda)

### Phase 5 — Montblanc (AI assistant)
- [ ] Chat drawer with streaming (Claude via AI SDK), available on every surface
- [ ] Montblanc persona/prompt
- [ ] Surface-aware context: Montblanc knows what you're currently looking at
- [ ] Tool-calling: let Montblanc read my Projects, Marks, Drops & calendar
- [ ] Then: let Montblanc create/modify them on request
- [ ] Proactive help (daily briefing, drift nudges) — later

### Phase 6 — Ledger (money)
- [ ] Bank account connections
- [ ] Property management statement ingestion + audit
- [ ] Slots in as a sixth surface — no IA change required

### Phase 7+ — Future / "as I think of it"
- [ ] Multi-user: log in as my daughter to see her own activities
- [ ] Richer per-project tooling (e.g. language-learning streaks, practice logs)
- [ ] Notifications (push / email)
- [ ] Habit/streak tracking, notes/journal, file storage
- [ ] _Add more here as ideas arrive_

---

## 6. Information Architecture & Data Model

**Decided 2026-07-30.** This is the spine of the app — everything else assumes it.

### The core insight

Social media distribution is **an axis that cuts through every project**, not a bucket
sitting alongside them. The earlier draft listed "Social Media Branding" as an Area next to
"App/Game Dev", which would mean context-switching out of a project to find its own posts.
With many concurrent projects that breaks down fast. So: **distribution is a dimension, not
a destination.**

### Six nouns

| Noun | What it is | Example | Churn |
|---|---|---|---|
| **Area** | Life domain. Coarse. Supplies colour + calendar separation. | Work, Baby, Hobbies, Home & Money | ~5 ever |
| **Project** | The thing being pushed forward. Belongs to one Area. | "Utaitai", "Sleepy Cat", "Rental 4B" | Constant |
| **Brand** | A public identity with an audience and a voice. Owns Channels. | Utaitai, Coding Mom, Sleepy Cat | Rare |
| **Mark** | A task. Belongs to a Project, or floats in an Area for one-offs. | "Fix collision bug" | Constant |
| **Drop** | A unit of content going out. Carries a Brand and (optionally) a Project. | "Devlog #7 → X + Threads" | Constant |
| **Series** | A standing commitment that generates dated Drop slots. | "Daily short, both Utaitai TikToks" | Rare |

**Drop is deliberately not a Mark.** A Mark is binary — open or done. A Drop moves through
repeating pipeline stages, fans out to several channels from one source asset, and has a
*publish datetime* rather than a *due date*. Merging them yields a task list where most rows
are "post the thing" and the real work is buried. Two entities, one shared daily view.

### Brand and Project are two axes, not one — decided 2026-07-30

The first draft hung a Drop off a Project alone. That collapses the moment one identity
promotes several projects, which is exactly the situation:

- A **Sleepy Cat** devlog posted from **Coding Mom's** TikTok
- The same game posted from **@sleepycatgame** on X
- A postpartum-coding story that belongs to **no project at all**

So a Drop carries `brandId` (who is saying it, to whose audience) *and* a nullable
`projectId` (what it's about). Without the second axis you end up inventing shadow projects
called "Coding Mom content" and losing the thread. A Channel is one real account and belongs
to one Brand; `state` distinguishes accounts that exist from accounts that are still an
intention.

### Repurposing is two different things

Calling both of these "repurposing" is what made the whole thing feel unmanageable:

1. **Same asset, more places** — a TikTok going to IG Reels, FB Reels and YT Shorts. That's
   **one Drop with more DropChannel rows**, each carrying its own caption, state and
   published URL. Near-zero effort, and it should stay that way.
2. **Same idea, different form** — a Medium essay becoming a Threads post. That's a
   **derived Drop** (`sourceDropId`), with its own stages and its own publish date, because
   it has to be rewritten rather than re-uploaded.

### Cadence is generated, never typed

Posting daily on two accounts is ~730 drops a year. A Studio that requires hand-creating
each one dies in a week. **Series** solves this: a brand + channels + cadence + format that
materialises empty dated slots ahead of time (`ensureSeriesSlots`, run on Studio load —
idempotent via the `[seriesId, slotDate]` unique key, so no cron and no infrastructure to
keep alive). The daily post is a card waiting to be filled, not a row to remember to make.

### Navigation: by verb and time; filter by area

Never one nav item per area — that list grows forever and forces you to recall which bucket
a thing lives in. Instead a **fixed set of surfaces** with Area as a persistent filter chip
row. Left icon rail on desktop, bottom tab bar on mobile — same IA, no redesign.

| Surface | Purpose |
|---|---|
| **Today** | The one screen opened 20×/day. "What do I do right now." |
| **Hunt Board** | All open Marks grouped by Project. Where you *plan*, not execute. |
| **Calendar** | Time. Events + baby + Drop publish dates + Mark due dates, layered. |
| **Studio** | Cross-project content pipeline. Kanban by stage, or calendar by publish date. |
| **Projects** | The roster. Health and momentum at a glance. |
| **Montblanc** | A drawer on every surface, so it always knows what you're looking at. |

Future **Ledger** (bank + property audit, §5 Phase 6) slots in as one more surface without
disturbing anything. That's the test the IA is built to pass.

### The Today screen

Four bands, in priority order:

1. **Marks due** — due today + overdue. Cap the visible list (~7) so it stays scannable.
2. **Going out today** — Drops publishing today, with channel icons. Visually distinct from Marks.
3. **Agenda** — calendar events, including baby.
4. **Momentum** — per-project "last touched", newest first, with drift warnings.

Band 4 is the answer to *"which projects am I actually following?"* Every Project carries a
`status` and a `lastTouchedAt` that bumps whenever one of its Marks completes or one of its
Drops publishes. Projects drifting past their cadence surface themselves, with an explicit
"demote to Simmering" action — so nothing dies quietly and nothing generates guilt.

A **project card** compresses to: next Mark · next Drop · open count · days since touched ·
channel row.

### Entities

Built ones are in `prisma/schema.prisma`, which is the source of truth; this is the map.

- **Area** — slug, name, color, sortOrder ✅
  _(Area doubles as the calendar grouping — see §8, resolved.)_
- **Project** — slug, name, description, areaId, status (`active` | `simmering` | `paused` |
  `archived`), lastTouchedAt, cadenceDays (nullable, drives drift warnings) ✅
- **Brand** — slug, name, tagline, color, sortOrder ✅
- **Channel** — brandId, platform, handle, label, url, state (`planned` | `live` | `paused`) ✅
- **Series** — brandId, projectId (nullable), format, cadence, daysOfWeek, timeOfDay,
  startsOn/endsOn, horizonDays, isActive; channels via **SeriesChannel** ✅
- **Drop** — title, notes, body, brandId, projectId (nullable), format (`short_video` |
  `article` | `text_post` | `image`), stage (`idea` | `script` | `produce` | `scheduled` |
  `published`), publishAt, seriesId + slotDate, sourceDropId ✅
- **DropChannel** — join: dropId, channelId, state, caption, scheduledFor, publishedAt,
  publishedUrl ✅
- **Mark** — id, title, notes, dueDate, status (`open` | `doing` | `done`), projectId
  (nullable), areaId — Phase 3
- **Event** — id, title, start, end, allDay, recurrence, areaId, projectId (nullable) — Phase 4
- **ChatMessage / Conversation** — Montblanc history — Phase 5
- **User** — id, email, name, role (`owner` | `child`) — Phase 7. Deliberately absent for
  now: the app is single-tenant behind the allowlist and Auth.js runs JWT sessions with no
  adapter, so no table exists to hang `ownerId` off. Adding it is purely additive.

`produce` replaced the earlier `edit` stage — it's format-neutral, so filming a TikTok and
writing a Medium essay share one column instead of needing a board each.

---

## 7. Deployment (Railway)

- **Repo:** `https://github.com/lienmly/personal-assistant` (branch `main`).
- **Live:** the Next.js web service is deployed on Railway and serving the landing shell.
- Postgres plugin **added and migrated.** Local dev connects over the public proxy
  (`DATABASE_PUBLIC_URL`, host `*.proxy.rlwy.net`); the deployed service uses the
  internal `${{Postgres.DATABASE_URL}}` reference.
- Deploy from GitHub (auto-deploy on push to `main`, or manual — decide later).
- **Environment variables** (keep in Railway, never commit):
  - `AUTH_SECRET` — generate with `npx auth secret`
  - `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
  - `AUTH_ALLOWLIST` — comma-separated e-mails; **empty means nobody gets in**
  - `AUTH_URL` — production only, the public Railway URL
  - `DATABASE_URL` — on Railway use the reference `${{Postgres.DATABASE_URL}}`;
    locally use Railway's `DATABASE_PUBLIC_URL` (`*.proxy.rlwy.net`)
  - `QWEN_API_KEY`, `QWEN_BASE_URL` — Phase 5 (Montblanc)
- `.env.local` for local dev, `.env.example` committed as a template.

> Auth.js v5 reads `AUTH_*` names natively, so the older `NEXTAUTH_*` / `GOOGLE_*`
> names from the first draft are not used.

---

## 8. Open Decisions (to resolve as we go)

- [x] **Information architecture** — resolved 2026-07-30. Area › Project › Mark, with Drop
      as its own entity, and five fixed nav surfaces. See §6.
- [x] **Areas vs Calendars** — resolved: **unified.** Area *is* the calendar grouping; there
      is no separate Calendar entity. Events carry an `areaId` and inherit its colour.
- [x] **Task flavor** — resolved: themed. Tasks are **Marks**, content units are **Drops**.
      Keep UI labels readable; flavor lives in headings, not in form fields.
- [x] **Visual design** — resolved 2026-07-30 from a Dribbble reference (a warm, light CRM
      dashboard). Translated into `app/globals.css`: warm greige canvas, floating white
      cards on a rounded panel, very large radii, near-invisible shadows, separation by
      background contrast rather than borders, and a single crimson accent (`#de1f4c`)
      that doubles as the moogle's pom-pom. **Light mode only** — the palette is built
      around warm neutrals and a dark variant would need its own design pass.
      The reference screenshots live in **`/assets`** — see §9, they are required reading
      before building any new surface.
- [ ] shadcn/ui — deferred. Phase 1 needed no complex primitives, and the design is custom
      enough that shadcn defaults would be fought rather than used. Revisit at Phase 2 when
      dialogs, selects and popovers appear.
- [x] **Prisma vs Drizzle** — resolved: **Prisma**, pinned to `6.x`. Prisma 7 requires Node
      20.19+ and this machine is on 20.15.1; 6.x supports 18.18+. Bump both once Node is
      upgraded — the schema is fresh, so the 6→7 move is a non-event.
- [x] **Montblanc's model provider** — resolved 2026-07-30: **Qwen**, via its
      OpenAI-compatible endpoint. See §3.
- [ ] Calendar library (Schedule-X vs FullCalendar) — decide at Phase 4
- [ ] Notifications channel (push vs email) — Phase 7

---

## 9. Working Conventions

- **Layer by layer.** Don't scaffold Phase 3 before Phase 1 is real and deployed.
- **Keep this doc current.** When a decision is made or a feature ships, update the
  relevant section and check the box.
- **Small, useful increments.** Prefer something I can log into and use this week over a
  perfect architecture I can't see yet.
- **Design comes from Dribbble refs.** When a design is chosen, drop the reference link(s)
  in Section 8 and translate into Tailwind/shadcn.
- **Look at `/assets` before building any new UI. Every time.** The folder holds the
  styling reference screenshots this dashboard is modelled on:
  - `assets/original-a7dc2253fa12ae740ce2079d84654d52.webp` — the flat reference
  - `assets/original-d881fd064d90adfc18f6cb20fd3ee16e.webp` — the same design on a monitor

  These are **not** a one-time inspiration that was "already translated" in Phase 1. They
  are the standing source of truth for how a surface should look, and they must be opened
  and actually viewed whenever a new feature, board, panel or card is added — not recalled
  from memory or inferred from existing code. Drift creeps in one component at a time.

  What to check a new surface against:
  - Warm greige canvas; content sits on a large rounded white panel that floats on it.
  - **Separation by background contrast, not borders.** Cards are white/near-white tiles on
    a tinted ground. Reach for a border only when contrast genuinely can't carry it.
  - Very large corner radii on panels and cards; pill shapes for chips, filters and toggles.
  - Shadows are near-invisible — depth comes from the layering, not from drop shadows.
  - Crimson `#de1f4c` is the *single* accent: one emphasis per region (active nav item, the
    primary action, one highlighted metric). A screen with crimson everywhere is wrong.
  - Black is used sparingly as a second emphasis — the selected pill, one hero tile.
  - Dense, calm typography: small muted labels above large confident numbers/titles.
  - Iconography and avatars are small, round, and inline with text — never decorative.

  If a new surface needs a pattern the reference doesn't show, extend it in the reference's
  spirit and note the new pattern in §8 so the next feature inherits it.

---

## Environment notes

- **Windows machine.** Project lives on `D:\personal assistant dashboard`.
- **npm cache is redirected to `D:\npm-cache`** (the `C:` system drive has been prone to
  running full). If npm ever errors with `ENOSPC` or Node throws "heap out of memory",
  check free space on `C:` first — a full system drive breaks the Windows pagefile.
- Node v20.15.1 at time of setup. This is now load-bearing: **Prisma 7 refuses to install
  below 20.19**, which is why Prisma is pinned to 6.x. `winget install OpenJS.NodeJS.LTS`
  fixes it, and then both Prisma packages can go to latest.
- **Next.js 16 / React 19.** This is a recent major — APIs and conventions may differ from
  older Next.js knowledge. Version-specific docs are bundled at
  `node_modules/next/dist/docs/`; the scaffold's `AGENTS.md` reminds agents to consult them
  before writing framework code. Read the relevant guide there when unsure.

---

_Last updated: 2026-07-30 · Status: **Phase 2 (Studio) built and running locally.** The
social layer is written end to end — schema, seed, board, channel admin, series generation
— and the project type-checks, lints and builds clean. Railway Postgres is provisioned and
migrated, the seed is loaded, Google OAuth credentials are in `.env.local`, and
`npm run dev` serves the auth-gated app on `localhost:3000`. Outstanding: sign-in has not
been exercised end to end against Google yet, and the phone layout still needs a look on a
real device._
