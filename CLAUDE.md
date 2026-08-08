# Clan Centurio — Personal Assistant Dashboard

> A private, web-based command center for organizing every part of my life,
> with **Montblanc**, an AI assistant, at its heart.
>
> _Named after Clan Centurio and its moogle leader Montblanc from Final Fantasy XII —
> a clan that takes on the "tasks" (hunts) of the world. This dashboard takes on the
> tasks of my life._

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
| Tasks / to-dos | **Tasks** | Renamed from "Marks" 2026-08-02. The Hunt Board is still where they live. |
| Content / posts | **Content items** | A unit of content going out to one or more channels. Renamed from "Drops". |

### The de-jargoning — decided 2026-08-02

"Marks" and "Drops" were **two task-shaped nouns and neither said which one you actually
*do*.** That is the whole diagnosis. Naming one of them Task answers it, and the content
layer stops needing a glossary; `Mark → Task`, `Drop → ContentItem`, in the schema as well
as the UI, because a codebase that reads like a different app than its screens is a
codebase you re-learn every time.

What was **kept**, and why the sweep stopped there:

- **Hunt Board** stays. The board's name was never the confusing part — you always knew
  what it held. The flavour costs nothing where the noun underneath is plain.
- **Series** stays. It was already ordinary English.
- **Sprint** stays. Ordinary project-management vocabulary.
- **Clan Centurio** and **Montblanc** stay. They name the product and the assistant,
  not the things you handle twenty times a day.

The migration (`20260801120000_plain_names`) is hand-written and **every statement in it
is a RENAME**. `prisma migrate dev` diffs a model rename as a drop and a create, which
would have taken all sixty tasks and sixty-one content items with it. Index and constraint
names are renamed alongside so a future diff stays quiet. Do not regenerate it.

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
| **Calendar UI** | **Hand-built** (CSS grid + day arithmetic) | Decided 2026-08-01. Neither Schedule-X nor FullCalendar survived contact with the design: both ship their own DOM and stylesheet, and this look — borderless, very round, tiles on a tinted ground — gets fought rather than configured. Month/week/day came to ~600 lines with zero new dependencies. See §8. |
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
/app/(app)/…       → the four authenticated surfaces + their shared layout
/app/login         → public sign-in page
/app/api/auth/…    → Auth.js route handler
/components/shell  → icon rail, sidebar, topbar, mobile tab bar, the theme
                     provider and its Light · Auto · Dark toggle
/components/ui     → card, empty state, surface header
/components/brand  → the moogle task
/lib               → auth config, nav config, server actions, utils
/components/studio → the content item board, daily queue, batch composer, content item panel, channel manager
/components/board  → the hunt board, task panel, experiment capture
/components/today  → the projects card (list + create + archived), project cards,
                     the contribution map, going-out, agenda
/components/calendar → month grid, week/day time grid, item chips, the event panel
/components/projects → the project panel
/components/areas  → the area page's journal, the media grid and its viewer, the
                     media picker and the camera sheet
/components/docs   → the Docs tab, shared by a project page and an area page
/components/tasks  → the by-track task list, shared by both too, and the checklist
                     a task's subtasks render as (board, Today and both pages)
/lib/area-detail.ts → everything one area is, for /areas/[slug]
/lib/journal.ts    → reading the journal (never selects media bytes)
/lib/journal-actions.ts → server actions for entries and their photos/clips
/lib/journal-filters.ts → the camera's colour grades (client-safe: no Prisma)
/lib/media-store.ts → the **only** module that touches photo/video bytes (§6)
/app/api/journal/media/[id] → serves one photo or clip, auth-gated
/lib/sun.ts        → sunrise/sunset (client-safe: no Prisma import)
/lib/theme.ts      → theme types, storage keys, the pre-paint boot script
/lib/theme-store.ts → the theme as an external store (browser-only) — §11
/lib/db.ts         → Prisma client singleton
/lib/studio.ts     → board queries + series slot generation + batch slots
/lib/studio-actions.ts → server actions for content items, channels, series, batch save
/lib/tasks.ts      → hunt board query
/lib/task-actions.ts → server actions for tasks
/lib/today.ts      → the project cards and the contribution map (Today)
/lib/projects.ts   → `getDormantProjects` (paused + archived) + `daysSince`
/lib/project-actions.ts → create / edit / re-tier / archive / delete a project
/lib/tracks.ts     → workstream names (client-safe: no Prisma import)
/lib/calendar.ts   → the window query, recurrence expansion, the three-source merge
/lib/calendar-keys.ts → day-key arithmetic (client-safe: no Prisma import)
/lib/event-actions.ts → server actions for events
/lib/markdown.ts   → a small Markdown subset, parsed to a block tree
/lib/doc-actions.ts → server actions for project docs
/lib/project-detail.ts → everything one project is, for /projects/[slug]
/lib/task-view.ts  → the one Task row → TaskView mapper, shared by board and project page
/lib/montblanc     → AI assistant logic (prompts, tools) — Phase 5
/prisma            → schema.prisma, migrations, seed.ts
/proxy.ts          → route protection (Next 16's renamed Middleware)
/public            → static assets, icons, branding
/assets            → styling reference screenshots — consult before building UI (§9)
/docs              → guides written for me to read, not for agents (§9)
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
- [x] First migration run — `20260731033858_social_layer`, then
      `20260731190821_marks_and_drop_ref`, then `20260801004059_sprints_and_priority`;
      seed loaded (4 areas, 4 projects, 3 brands, 13 channels, 4 series, 60 tasks)

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
_Pulled ahead of Tasks on 2026-07-30. Social output is the work that's actually
overflowing right now — a daily cadence on two TikToks with three more brands coming —
so it earns the first real data layer. Tasks can wait; the posting can't._
- [x] Area + Project + Brand + Channel + Series + Content item + ContentItemChannel schema
- [x] Seed of the real brands, accounts and standing series
- [x] Studio board: five stages, brand filter, content item panel, per-channel publish checklist
- [x] Series slot generation — the daily cadence materialises itself
- [x] Repurposing both ways: extra channels on one content item, derived content items across forms
- [x] Brands & channels admin at `/studio/channels`
- [x] Publishing a Content item bumps its Project's `lastTouchedAt`
- [x] Projects surface reads real projects, with drift warnings
- [x] **Batching** — `/studio/batch` fills every upcoming slot from one grid, and the
      series slots collapse out of the board columns into a **daily queue** strip.
      Added 2026-07-31: the cadence is produced weekly in one sitting, so ~28 empty
      slot cards were both unfillable one-at-a-time and drowning the real content items.
- [x] `Content item.refUrl` — the viral post a content item reproduces, distinct from where it lands
- [x] Today, section 2 (Going out today) — each channel tickable straight from Today
- [x] `Series.timeOfDay` is applied in **local** time. It was being applied with
      `setUTCHours`, so a series set to 18:00 published at 11:00; fixed in
      `slotPublishAt`, and the already-generated slots were backfilled.
- [ ] Per-project Content item list on the project card

### Phase 3 — Tasks & the Hunt Board
_Pulled forward on 2026-07-31. Utaitai's real work — ship two apps, talk to users,
market it — had nowhere to live, and it isn't content, so Studio couldn't hold it._
- [x] Task schema and migration
- [x] Task CRUD; completing a Task bumps its Project's `lastTouchedAt`
- [x] Hunt Board: open Tasks grouped by Project, then by **track**
- [x] Experiment capture — paste a link, get a Task under Experiments
- [x] Today, section 1 (Tasks due) — due + overdue, capped at 7, tickable in place
- [x] Today, section 4 (Momentum) — drifting first, with "Let it simmer" inline
- [x] ~~Sleepy Cat's road to Steam seeded — 19 tasks over Build / Art / Ship / Marketing~~
      _Deleted 2026-08-04 with the other 78. Rewritten from scratch 2026-08-05 as 58 tasks
      over six tracks — see Phase 4.9._
- [x] **Coding Mom and Forge seeded as projects** (2026-07-31) — 13 + 10 tasks, and the
      first real due dates in the app: Coding Mom's account chain (e-mail → TikTok →
      a week of warm-up → first post 2026-08-09) is a strict sequence, so section 1 of
      Today now has something to show. See the Coding Mom and Forge projects' Docs tabs.
- [x] **Sprints** (2026-07-31) — `Sprint` + `Task.sprintId`, the sprint bar and sprint
      panel, and the whole of Today rebuilt around the committed subset. Added because
      sixty open tasks is the right *contents* for a planning surface and the wrong thing
      to be shown all at once. See §6, "The sprint".
- [x] **Project tiering** (2026-07-31) — `Project.priority` (`main` / `side` / `later`),
      separate from `status`. Sleepy Cat and Coding Mom are main; Utaitai is on
      maintenance and Forge is side until Sleepy Cat launches. See §6, "Two axes again".
- [x] **Project CRUD** (2026-07-31) — the roster is now the editor. A project panel on
      `/projects` (same shape as the task panel) creates, renames, re-areas, re-tiers,
      archives and deletes; the status chips became filters so archiving somewhere to put
      things doesn't clutter the roster. This was the gap that hurt: adding Coding Mom and
      Forge meant editing `prisma/seed.ts` and re-seeding, which is not a thing to do from
      a phone at 3am, and `priority` had no editor at all. Three rules fell out of it —
      see §6, "The roster is the editor".
- [ ] Due dates on the rest of the tasks — only the Coding Mom setup chain has them
- [x] ~~Sprint history~~ — moot. The sprint was retired 2026-08-04, and "what did I
      actually get done" is now Today's contribution map, read off `Task.completedAt`
      rather than off sprint membership.

### Phase 4 — Calendar
_Built 2026-08-01._
- [x] `Event` model + `Recurrence` enum (`20260801054445_calendar_events`)
- [x] Month / week / day views, hand-built (§8) — view and cursor live in the URL
- [x] Create / edit / delete events, with simple recurrence
- [x] Layer in Task due dates and Content item publish times alongside events
- [x] Baby daughter's activity calendar — Events in the Baby area, seeded with the
      real routine (7 daily rows standing in for ~2,500 occurrences a year)
      _(deleted 2026-08-02 — see Phase 4.5)_
- [x] Today, section 3 (Agenda) — events only, now-aware
- [x] **The three sources are switchable layers, content off by default**
      (2026-08-03) — the legend under the grid is the control. See §6.
- [x] **The seeded events are deleted and the seed makes none** (2026-08-03)
- [ ] Drag to move / resize an event. Every occurrence is positioned from
      `startMinutes` already, so this is a pointer handler and a server action,
      not a rewrite. Deliberately deferred: creating and editing had to be real
      first, and on a phone the panel is the honest interaction anyway.
- [ ] Per-occurrence exceptions ("skip *this* nap"). Needs a table; see the note
      on `Recurrence` in the schema for why it isn't there yet.

### Phase 4.5 — De-jargon, project pages, recurrence, automation
_Built 2026-08-02, all in one pass. Not a planned phase; it is the set of things that
turned out to be wrong once the app had been lived in for two days._
- [x] `Mark → Task`, `Drop → ContentItem` in schema and UI (§2)
- [x] **Project pages** — `/projects/[slug]`, Overview · Tasks · Content · Docs
- [x] **`ProjectDoc`** — docs are rows, editable in-app; `prisma/docs/*.md` is seed
      material only. §6, "The docs moved onto the project"
- [x] **Recurring tasks** — one live row that advances, plus a completed snapshot per
      occurrence. §6, "Tasks that come back"
- [x] **The baby routine deleted.** Nine seeded events gone; a "Multilingual baby"
      project replaces them. §6, "Followed, not scheduled"
      _(and that project was itself removed on 2026-08-05 — §6, "The Baby area is a
      journal, not a backlog". The Baby area is empty on purpose.)_
- [x] **Utaitai batches twice a week** — a recurring Wed/Sun task pointing at
      `/studio/batch`, and "While you're in it" on Today
- [x] **Sprints roll over by themselves** — `ensureActiveSprint`, and a pre-filled
      planner on an empty sprint. §6, "The sprint rolls itself"
- [x] Pace on the sprint tile, and one-field idea capture on Today
- [ ] Area CRUD — still the only noun without an editor. Five areas ever, so it has
      still never bitten.

### Phase 4.6 — The pressure came out
_Built 2026-08-04. Not planned either. Phase 4.5 fixed what was wrong once the app had
been lived in for two days; this fixes what was wrong once it had been lived in for four,
and every item is the same shape — **the app was asserting things nobody had told it.**_
- [x] **The sprint is retired.** Gone from Today and the Hunt Board; nothing creates one.
      Schema kept. §6, "The sprint"
- [x] **Today is project-first** — one card per project, with a focus line and its few
      most pressing rows. Momentum folded in. §6, "The Today screen"
- [x] **`Project.focus`** (`20260804090000_project_focus`) — what a project is aiming at
      *right now*, editable on the project panel, led with on Today
- [x] **A contribution map** replaces the pace metric — no target, so no shortfall
- [x] **The seed no longer creates tasks, sprints or events.** All 78 seeded tasks deleted
      (backed up to `backups/tasks-2026-08-04.json`). §6, "Nothing but you creates a task"
- [x] **The calendar starts empty** — `DEFAULT_LAYERS` is `["event"]`. §6, sixth rule
- [x] **Utaitai's two daily series switched off** and their 40 empty slots deleted; the
      recurring "Batch the Utaitai week" task is the whole commitment now
- [x] **"Content" reads "Social media content"** across every surface; the Studio nav item
      is "Social Media" (route unchanged)
- [x] **Migration drift fixed** — an applied-but-uncommitted `20260801183000_docs` had been
      making every `prisma migrate dev` offer to reset the database. Reconstructed from the
      live schema; the dead `Doc` table it created is dropped
- [ ] Area CRUD — still the only noun without an editor
- [ ] Multi-select delete on the Hunt Board. Clearing 78 rows needed a script; clearing the
      next batch shouldn't.

### Phase 4.7 — The roster folded into Today
_Built 2026-08-05, and it is Phase 4.6 finishing its own sentence: Today became
project-first on the 4th, which made a second screen listing the same projects redundant on
the 5th._
- [x] **The Projects surface is retired** — four nav items, not five. §6, "The roster
      folded into Today"
- [x] **Project CRUD moved onto Today's cards** — the pencil beside a project's name opens
      the same `ProjectPanel`; "New project" sits at the foot of the card
- [x] **"N put away"** — a collapsed list of paused and archived projects, which
      `getProjectBoards` filters out and which would otherwise be unreachable
- [x] `ProjectRowView` → `ProjectEditView`; `getRoster` → `getDormantProjects`
- [x] **The sidebar tree marks the current project**, replacing the "you are here" signal
      the rail's Projects icon used to give on `/projects/[slug]`
- [ ] Area CRUD — the sidebar's "Add area" and "Manage areas" are *still* disabled, and
      this fold makes it the last surface-level gap

### Phase 4.8 — The Baby area, and areas you can open
_Built 2026-08-05, immediately after the Multilingual baby removal above and caused by it.
The area had nothing left, and what it actually needed turned out to be three things none
of which hung off a Project._
- [x] **`/areas/[slug]`** — Journal · Docs · Tasks, reached from the sidebar tree, **not**
      a fifth nav item. §6, "An area is something you can open"
- [x] **`JournalEntry`** — the first noun in this app that points backwards. No due date,
      no status, nothing to tick. §6, "The journal"
- [x] **`JournalPhoto`, stored in Postgres** — downscaled to 1600px in the browser before
      upload (4MB → 75KB, measured), served auth-gated from `/api/journal/media/[id]`,
      and behind a one-file seam so moving to R2 later is cheap. §6, "Photos live in
      Postgres"
- [x] **`ProjectDoc` → `Doc`** — a doc hangs off a project *or* an area. Hand-written
      migration, every statement a RENAME or an additive ALTER. §6
- [x] The Baby area's **Languages** doc and its one real task ("Figure out a way to teach
      her Russian and Chinese"), the task written straight to the database rather than
      into the seed
- [ ] **Send the journal to her** — an email, a printed year, something. Deliberately not
      designed; the data is shaped for it (§6, "The journal")
- [ ] **Captions on photos.** The column exists and is written as `null`; there is no UI.
- [ ] Area CRUD — *still* the last surface-level gap, and now slightly more awkward: an
      area has a page but cannot be created or renamed

### Phase 4.9 — Sleepy Cat gets its backlog
_Built 2026-08-05. The first project filled in properly since the seed stopped creating
work on the 4th, and therefore the first test of whether "nothing but you creates a task"
is livable. It is: 58 tasks, all of them asked for._

- [x] **`Project.focus` and a vision doc for Sleepy Cat** — "The road to Steam", the first
      doc written for a project that had none
- [x] **71 tasks over seven tracks** — Setup, Build, Art, **Audio**, Ship, **Next Fest**,
      Marketing. Written straight to the database, never into `prisma/seed.ts`
- [x] **A second doc pointing at the shared Google Doc** he and I write feedback in, plus
      five Build tasks taken off it. §6, "A doc can point at a document"
- [x] **Re-aimed at the October 2026 Next Fest**, not February 2027 — a `Next Fest` track,
      the fest week as a calendar **Event**, and all 45 downstream dates pulled forward.
      §6, "A milestone is a track plus an event"
- [x] **A `Festivals` track** — 89 open tasks now. Submissions are a rolling queue with
      their own deadlines, which is a different shape from one event with a readiness chain
- [ ] **Every festival deadline is unverified**, recorded in notes rather than asserted as
      a due date. §6, "An unverified date is a note, not a due date"
- [ ] **The October fest dates are a guess.** Mon 12 – Mon 19, following the 2024 and 2025
      pattern. The event and every date in the track assume it; confirming it in Steamworks
      is due 2026-08-06 and is the first task in the track.
- [x] **`Audio` is a new track** (`lib/tracks.ts`), beside Art for the same reason Art was
      split out of Ship: it is somebody else's work on somebody else's schedule
- [x] **Seven channels on the Sleepy Cat brand** — X, Threads, TikTok, Instagram, Facebook,
      YouTube and **Reddit**, all `planned`, all `@sleepycatgame`
- [x] **`Platform.reddit`** (`20260805204731_reddit_platform`) — see §6, "Reddit is a room,
      not a megaphone"
- [x] **The Markdown renderer's continuation-line bug is fixed** — the one CLAUDE.md has
      been carrying against `forge-vision.md` since 2026-08-03, plus the same bug in
      blockquotes. §9
- [x] **`.gitattributes` pins `*.sql` to LF** — five migrations were reading as tampered
      with, and `prisma migrate dev` was offering to reset the database over line endings.
      §9, "A migration checksum is a hash of bytes"
- [ ] **Steam Next Fest dates are unconfirmed.** February 2027 is the target and the task
      to verify it in Steamworks is due 2026-08-12. The whole backlog is dated off it.
- [ ] Tables in a doc still render as raw pipes — `lib/markdown.ts` has never supported
      them and `forge-vision.md` has two. Pre-existing, untouched, and now the only known
      gap in the renderer.

### Phase 4.10 — A task can have a checklist
_Built 2026-08-06. The first structural change to `Task` since recurrence, and it came from
one ask: a daily reminder to post for Utaitai, with a step per account and more accounts to
come._
- [x] **`Task.parentId`** (`20260806090000_task_checklist`) — a self-relation, cascade,
      one level deep. Purely additive. §6, "A task can have a checklist"
- [x] **Ticking the last box completes the job**, and on a recurring one re-arms the whole
      checklist for its next day
- [x] **`TOP_LEVEL_ONLY`** in `lib/task-view.ts` — `recurringId: null` and `parentId: null`
      bundled, so the six queries that need both cannot drift apart
- [x] **`components/tasks/checklist.tsx`** — shared by the Hunt Board, Today and a project
      or area page. Collapsed by default, expanded on Today
- [x] **A `Steps` editor on the task panel** — add with Enter, rename in place, remove
- [x] **Utaitai's "Post today's shorts"** — daily, `Content` track, two steps
      (`TikTok @utaitai_jp`, `TikTok @utaitai_cn`). Written straight to the database, never
      into `prisma/seed.ts` (§6, "Nothing but you creates a task")
- [x] `revalidatePath("/areas/[slug]")` added to the task actions' `refresh()` — it was
      missing, so ticking the Baby area's one task left its page stale
- [ ] **Reordering steps.** They arrive in the order written, which for a list of accounts
      is the order you open them in. No drag handle; revisit if a checklist ever gets long.

### Phase 4.11 — Utaitai gets its backlog
_Built 2026-08-05. The same exercise Phase 4.9 did for Sleepy Cat, on the project that had
been running on one recurring task since the purge. **Not a single line of code changed** —
every track it needed already existed, which is the free-text `track` design paying off for
the fifth time._

- [x] **`Project.focus` for Utaitai** — "$100 MRR is 13 subscribers at $7.99, and there is
      one." The arithmetic is the focus line, because the goal was given as a dollar figure
      and 13 is the number that actually gets counted
- [x] **44 tasks over six tracks** — Setup, Ship, Monetization, Content, Users, Marketing.
      Written straight to the database, never into `prisma/seed.ts`
- [x] **A second doc, "The road to $100 MRR"** — the leverage order, the price-ladder
      conflict, why responsive web comes before either app, and the account/warm-up
      sequencing
- [x] **The pricing doc amended** with the ladder (weekly / yearly / lifetime behind a
      monthly default) and what two of the three cost. The stored copy was confirmed
      byte-identical to `git HEAD` before overwriting, so no in-app edit was clobbered
- [x] **One due date on 44 tasks.** §6, "A goal with no deadline gets no due dates"
- [x] **The recurring Wed/Sun batching task is back** — it was lost in the 2026-08-04 purge
      despite Phase 4.6 naming it "the whole commitment now", so the app had been asserting
      a commitment that no longer existed anywhere
- [ ] **Lifetime pricing is unresolved and conflicts with the stated goal.** A lifetime
      purchase contributes $0 MRR by definition. On the board as a decision, not a build
- [ ] **The old paywall's conversion rate is unrecorded**, and the window closes when it is
      switched off. The one dated row on the project
- [ ] **Xiaohongshu is deliberately absent** — it is where the Chinese-learning audience
      actually is, and it needs a `Platform` value plus a Chinese phone number

### Phase 4.12 — A repeating row waits for its day
_Built 2026-08-05. Four lines of filter, and it is the fifth instance of the same
error the last four phases have been removing: **the app asserting something nobody
told it.** Here the assertion was a date the task itself disagreed with._
- [x] **`dueByToday` in `lib/today.ts`** — a recurring row is on Today when it is due
      today or overdue, and not before. Overdue, `doing` and a rule with no due date
      still show. §6, "A repeating row is on Today only on its day"
- [x] **`openTotal` keeps counting the hidden ones**, so "N more →" and the Open tasks
      tile stay honest
- [x] **"Nothing due today"** as a distinct empty state from "Nothing open here"
- [x] **`TaskLine`'s recurring exception to the fold-out is gone** — every route out
      of the row now removes it from the screen
- [x] `TaskLineView.recurrence` deleted; it existed only for that exception
- [ ] The Hunt Board is untouched on purpose, and that is a judgement rather than a
      check: it has not been read on a phone with this change in place

### Phase 4.13 — A dark theme that follows the sun
_Built 2026-08-06. The first change in six phases that is purely about how the app looks
rather than about what it asserts — and the design pass §8 had been deferring since
2026-07-30 turned out to be **one** decision plus a second column of values._
- [x] **A dark theme**, as token values under `:root[data-theme="dark"]`. Not one component
      was restyled; the app was already painted entirely through the tokens. §11
- [x] **The elevation ladder inverts** — canvas darkest, cards above the stage, and
      `--color-obsidian` becomes the *lightest* surface so a hero tile stays a hero rather
      than turning into a hole. `text-white` still clears 10:1 on it, which is why all 47
      places that write it are untouched. §11
- [x] **`--color-scrim`** — the panel dimmer had been `bg-obsidian/25`, which only worked
      while obsidian happened to be near-black. Its own token now, alpha baked in. §11
- [x] **`lib/sun.ts`** — NOAA sunrise/sunset, ~40 lines, no dependency. Verified against
      almanac times at five latitudes including both polar cases
- [x] **`auto` / Light / Dark** in the topbar, `auto` being the default and the one that
      follows the sun. Persisted per browser, not per account — §11, "The theme is not a
      column"
- [x] **Geolocation once, cached, and a refusal remembered** — falling back to Los Angeles,
      which is wrong by under an hour and never asks twice
- [x] **`THEME_BOOT_SCRIPT`** — a pre-paint inline script, so a night-time load arrives
      dark instead of flashing white. It carries no solar arithmetic: the provider leaves
      behind the answer *and when it expires*. §11
- [x] **`lib/theme-store.ts`** — the clock, localStorage and geolocation are external
      systems, so they are an external store read through `useSyncExternalStore` rather
      than a pile of effects. §11
- [ ] **The phone layout has not been looked at on a real device.** The toggle is the one
      topbar control that stays visible at every breakpoint, which is a judgement about the
      device most likely to be used at dusk, not a check
- [ ] **`prefers-color-scheme` is deliberately ignored.** Following the sun and following
      the OS are different answers, and wiring both would need a fourth mode. §11

### Phase 4.14 — Coding Mom and Forge get their backlogs
_Built 2026-08-05. The last two projects the 2026-08-04 purge left empty, and the third and
fourth run of the exercise Phase 4.9 and 4.11 did for Sleepy Cat and Utaitai. One new track,
one new doc, and **no other code changed** — which is now the fifth time the free-text
`track` design has absorbed a new project without a migration._

- [x] **`Project.focus` on both**, written straight to the database
- [x] **Coding Mom: 30 tasks** over Setup, Content, Users and Marketing. The setup chain is
      **undated on purpose** — its previous incarnation was dated from a 2026-08-01 start
      that has entirely lapsed with none of the work done. §6, "A goal with no deadline gets
      no due dates", demonstrated on the project that disproved its own dates
- [x] **Forge: 31 tasks** over Setup, Build, Users, Marketing and **`YC`**. One due date on
      the whole project — confirming the next batch deadline, which is a clock somebody else
      holds and is recorded as *unverified*
- [x] **`YC` is a new track** (`lib/tracks.ts`) — the "Next Fest" shape, with the one
      difference that there is no single date: four batches a year, so it is a readiness
      list re-run each quarter rather than a countdown. §6
- [x] **`forge-yc.md`, "The road to YC"** — a second Forge doc, split from the brief for the
      same reason Utaitai has both a pricing note and a road to $100 MRR. Added to the
      seed's `DOCS` list, because docs are structure
- [x] **Both existing docs de-jargoned** — `forge-vision.md` still said "marks" and claimed
      the project was seeded `simmering`, three days after the rename and after it went
      `active`. `coding-mom.md` still said "Drops"
- [x] **The Coding Mom niche narrowed** from seven pillars to five, and the two that went
      are recorded with the reason
- [ ] **No recurring posting task exists yet, deliberately.** A daily row nagging about an
      account that does not exist is the thing this app keeps deleting; the last row of the
      setup chain is what creates it. §6
- [ ] **Coding Mom's `cadenceDays` is 1** and it currently reads "Drifting · 5d" on a
      project whose first task is to create an e-mail account. Correct the day posting
      starts, wrong until then, and left alone rather than churned
- [ ] **Every YC batch date is unverified** and none is asserted as a due date
- [ ] **There is no quarterly recurrence**, so "apply to the next batch" cannot be a
      repeating row — the enum is daily/weekdays/weekly/monthly

### Phase 4.15 — The journal groups by day
_Built 2026-08-06. No schema change and no migration: `createdAt` was already on the row,
unread. The flat list was right for a milestone log and wrong for journaling **through** a
day, which is what it is actually used for._
- [x] **Entries group under the day they are about**, newest day first, done in one pass
      over rows `getJournal` already sorted. §6, "A day is the unit you add to"
- [x] **Each entry shows the time it was written**, and only as a clock time when it was
      written on the day it is about — otherwise "written 6 Aug". `createdAt` is a real
      timestamp beside a `@db.Date`, so both halves of §6's date rule are in one component
- [x] **A "+" on every past day's heading** opens a composer prefilled with that day.
      Today's heading has none — the open composer above it already is that button
- [x] `JournalEntryView` lost `dayLabel`, `shortLabel` and `isToday`; the day carries them
- [x] **Two latent width bugs fixed** — `field` baked in `w-full`, so `${field} w-auto` on
      the date picker lost (equal specificity, and the winner is whichever utility Tailwind
      emits later, not the one at the end of your class string). The date input had been
      taking a whole row at every width, pushing the headline to a second and the edit
      composer's cancel × to a third. §9
- [x] ~~**Entries within a day are newest-first**, matching the rest of the app~~ —
      **reversed 2026-08-06.** The "real argument" named here turned out to be the right
      one: see Phase 4.17. It was the one line in `getJournal` it was said to be
- [ ] **The phone layout still has not been looked at on a real device.** The day heading is
      a single short row and adds no breakpoint, but that is reasoning, not a check

### Phase 4.16 — The journal only accepts today, and grows a camera
_Built 2026-08-06, hours after 4.15 and partly undoing it. The "+" on a past day was the
wrong half of that change: **a day that has passed should be closed**, and what makes the
record worth reading later is that its times came from a clock rather than from a field._
- [x] **`happenedOn` is set once from the server's clock and never editable.** No date input,
      no `+` on any day heading, and an update omits the column entirely. §6, "The date is
      not a field"
- [x] **Editing is untouched and is a different act** — fixing what an entry says, never when
      it happened
- [x] **`JournalPhoto` → `JournalMedia`** (`20260806140000_journal_media`) with `kind` and
      `durationMs`. Hand-written, every statement a RENAME or an additive ALTER, applied with
      `migrate deploy` — the `Doc` precedent, for the third time
- [x] **`lib/photo-store.ts` → `lib/media-store.ts`**, `/api/journal/photo/[id]` →
      `/api/journal/media/[id]`. The one-file seam §6 promised held
- [x] **An in-journal camera** — live preview, front/back flip, shutter, and a **ten-second
      clip** with audio. `components/areas/camera-sheet.tsx`
- [x] **Five colour-grade filters**, baked into what is stored, hidden entirely where
      `ctx.filter` is unsupported rather than silently doing nothing. §6
- [x] **"Save to photos"** on every photo and clip — `navigator.share` with a file, falling
      back to a download. §6, "The camera roll cannot be written to"
- [x] **`dim:<name>` → `meta:<name>`**, carrying size, kind and duration in one value
- [ ] **The live camera has not been exercised**, because granting Chrome's camera permission
      is the user's call. Everything around it is verified — the sheet opens, both capability
      probes come back true on this browser, the filter row and clip button render, `putMedia`
      accepts a codec-suffixed video mime, and the route serves `video/mp4` — but no frame has
      been captured
- [ ] **Face/AR filters** were considered and deliberately not built. §6
- [ ] **Captions on photos.** The column still exists, is still written as `null`, and still
      has no UI — now for clips too
- [ ] **The phone layout still has not been looked at on a real device**, and this is the
      change that most wants it: the camera is a phone feature and the sheet has only been
      seen at 1568px

### Phase 4.17 — A day is a thread
_Built 2026-08-06, hours after 4.16 and the third pass at the same object. 4.15 grouped
entries by day; 4.16 closed every day but today; this one **draws** the day as one thread and
puts the composer at the end of it. No schema change and no migration._
- [x] **One card per day, entries as nodes on a thread** — same rows, same timestamps, but
      the connection is drawn rather than asserted by a heading. §6, "A day is a thread"
- [x] **Days run newest-first, entries within a day run oldest-first** — reversing 4.15's
      call, which had named this argument "a real one" and declined it. One line in
      `getJournal`
- [x] **The composer is today's last node**, open when the day is empty and behind a **"+"**
      once it has started. `getJournal` now always returns today, empty or not
- [x] **No past day has a "+"** — 4.16's rule, now visible in the layout instead of only
      enforced in the action
- [x] **Uniform square media tiles, capped at `max-w-xl`** — the ragged rows were
      `object-cover` on a box with no fixed height, and the 420px tiles were a grid
      stretching to a 1300px column. §6, "A thumbnail is a promise"
- [x] **A full-screen viewer** — tap a tile, arrows and Esc, portalled to `<body>` because
      `animate-rise` leaves a transform on every day section. `--color-viewer` is its own
      token, for the reason `--color-scrim` is
- [x] **"Save to photos" moved onto the viewer**, off every tile
- [x] **`MAX_MEDIA_PER_ENTRY = 10`**, counted against what the entry already holds, checked
      in the composer and again in the action before anything is written. §6
- [ ] **Captions still have no UI.** The column exists, is still written as `null`, and the
      viewer is now the obvious place for one — it is the only screen with room
- [ ] **Reordering media.** They arrive in the order picked; there is no drag handle, and
      the cap keeps the list short enough that it has not bitten
- [ ] **The phone layout still has not been looked at on a real device.** The thread indents
      6px below `sm` and the grid drops to two columns, both of which are judgements

### Phase 4.18 — A task opens where you are reading it
_Built 2026-08-07. Four asks, and the first two are one ask: **a task row you can read is a
task row you should be able to open.** No schema change and no migration._
- [x] **Today's rows open the task panel** — `TaskLineView.edit` carries the whole `TaskView`,
      exactly as `ProjectBoardView.edit` carries the project's. §6, "A task opens where you
      are reading it"
- [x] **A project's Overview "Next up" opens it too** — `components/projects/next-up.tsx`.
      Still read-only otherwise: no tick, no play, because Overview is a summary
- [x] **`boardSelect` gained four columns** — `areaId`, `projectId`, `repeatUntil` and the
      occurrence count — which is what `toTaskView` needs and the whole cost of the above
- [x] **The Tasks tab has stage columns** — To do · Doing · Done, with a **Stages / Tracks**
      segmented control. Stages lead; each column is cut into track runs. §6, "Stages and
      tracks answer different questions"
- [x] **The track is a sticky run heading, not a chip on every card** — corrected hours after
      shipping, because "Setup" four times running on a line of its own beneath each title
      both repeated itself and doubled every card's height. The repeat badge, due date and
      link moved onto the title's row, so an ordinary card is one line. §6
- [x] **Arrows move a card between columns**, visible outright on touch and on hover on a
      pointer device (§9). The tick stays where it is on every other surface — it is the
      one-tap path from To do straight to done, which is most rows
- [x] **Each column shows twelve and offers the rest** — Sleepy Cat has 88 rows in To do and
      one in Done, so uncapped the page is 88 cards tall with two empty columns beside it.
      Shipped as `max-h-[70vh] overflow-y-auto` and **corrected the same day**: a scrollbar in
      a design that has none, and a column that swallowed the wheel once it hit its own
      bottom. The run headings stopped being sticky with it. §6
- [x] **The journal's two media buttons became one dropdown** — Photos · Camera
- [x] **The dropdown opens upward, and that is load-bearing** — §9, "A popup inside an
      `animate-rise` section"
- [x] **The camera is full screen on a phone**, a centred card from `sm` up. §6, "A camera in
      a window"
- [ ] **No drag-and-drop between columns.** HTML5 DnD does not work on touch, so it would be
      a desktop-only half of a feature beside arrows that already work everywhere. The arrows
      are the whole interaction; revisit if the board is ever used mostly on a desktop
- [ ] **The camera's full-screen layout has not been seen at a phone width.** `resize_window`
      still reports success while the renderer stays at 2560px — the standing gap below. What
      *was* checked is that every `sm:` class compiles and sits behind `min-width: 40rem`,
      which is reasoning plus a grep, not a look
- [ ] **No frame has still ever been captured** — granting Chrome's camera permission is the
      user's call, unchanged from Phase 4.16

### Phase 4.19 — A brand can be the work of a project
_Built 2026-08-07. One nullable column, and it closes the gap the two-axis model has carried
since 2026-07-30: Brand and Project only ever met on an item, so the app could not tell that
three of four projects **run an account**. Found by asking why the Coding Mom project page
showed 3 items and Studio showed 31 under the same name._
- [x] **`Brand.projectId`** (`20260808024550_brand_owning_project`) — nullable, `SetNull`,
      one index. Purely additive; `migrate dev` generated it and migrations were clean first
- [x] **The Social media tab asks two questions** — "Posted as X" and "Covered elsewhere",
      which partition the rows exactly. §6, "A brand can be the work of a project"
- [x] **A project page shows its own channels** — Sleepy Cat's seven @sleepycatgame accounts
      were invisible on the page about building them
- [x] **The composer defaults the project from the brand**, and stops following the moment
      you pick one yourself. An **existing item never moves on its own** — verified by saving
      a brand-only item unchanged and confirming `projectId` stayed `null`
- [x] **A "The work of" picker on Studio → Channels**, so the link is not seed-only
- [x] **The stat tile counts the union** — Coding Mom reads 31, and Sleepy Cat's note reads
      "7 accounts · 0 live" rather than "Nothing published yet"
- [x] **The seed sets it on create only** — verified idempotent: a full `db:seed` left all
      three links and the item count untouched
- [ ] **Nothing links a channel to the tasks about creating it.** Sleepy Cat has seven
      `planned` accounts and setup tasks for them, and the two are only connected by reading
      both. Same shape as the Next Fest track having no link to its event (§6)
- [ ] **Forge's borrowing of Coding Mom's audience is not modelled**, deliberately — it is
      expressed per item, and the handoff is two tasks. A `Project.audienceBrandId` would be
      a third place for the same fact to disagree
- [ ] **The phone layout still has not been looked at on a real device.** The account row is
      `flex-wrap` and the two sections stack, both of which are judgements, not checks

### Phase 5 — Montblanc (AI assistant)
- [ ] Chat drawer with streaming (Claude via AI SDK), available on every surface
- [ ] Montblanc persona/prompt
- [ ] Surface-aware context: Montblanc knows what you're currently looking at
- [ ] Tool-calling: let Montblanc read my Projects, Tasks, Content items & calendar
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

### Eight nouns

| Noun | What it is | Example | Churn |
|---|---|---|---|
| **Area** | Life domain. Coarse. Supplies colour + calendar separation, and since 2026-08-05 has a **page** — journal, docs, tasks. | Work, Baby, Hobbies, Home & Money | ~5 ever |
| **Project** | The thing being pushed forward. Belongs to one Area. | "Utaitai", "Sleepy Cat", "Rental 4B" | Constant |
| **Brand** | A public identity with an audience and a voice. Owns Channels. | Utaitai, Coding Mom, Sleepy Cat | Rare |
| **Task** | A task. Belongs to a Project, or floats in an Area for one-offs. Since 2026-08-06 it can carry a **checklist** of subtasks — the same model, one level deep. | "Fix collision bug" | Constant |
| ~~Sprint~~ | _Retired 2026-08-04. Table kept, nothing reads it — see "The sprint" below._ | — | — |
| **Content item** | A unit of content going out. Carries a Brand and (optionally) a Project. | "Devlog #7 → X + Threads" | Constant |
| **Series** | A standing commitment that generates dated Content item slots. | "Daily short, both Utaitai TikToks" | Rare |
| **Event** | Something that *happens at a time*, as opposed to something to do. | "Afternoon nap", "Paediatrician" | Constant |
| **Journal entry** | Something that *already happened*. The only noun pointing backwards. | "Rolled over, both directions" | Constant |

**Content item is deliberately not a Task.** A Task is binary — open or done. A Content item moves through
repeating pipeline stages, fans out to several channels from one source asset, and has a
*publish datetime* rather than a *due date*. Merging them yields a task list where most rows
are "post the thing" and the real work is buried. Two entities, one shared daily view.

### Brand and Project are two axes, not one — decided 2026-07-30

The first draft hung a Content item off a Project alone. That collapses the moment one identity
promotes several projects, which is exactly the situation:

- A **Sleepy Cat** devlog posted from **Coding Mom's** TikTok
- The same game posted from **@sleepycatgame** on X
- A postpartum-coding story that belongs to **no project at all**

So a Content item carries `brandId` (who is saying it, to whose audience) *and* a nullable
`projectId` (what it's about). Without the second axis you end up inventing shadow projects
called "Coding Mom content" and losing the thread. A Channel is one real account and belongs
to one Brand; `state` distinguishes accounts that exist from accounts that are still an
intention.

**A name can be both — added 2026-07-31.** "Coding Mom" is now a Brand *and* a Project, and
that is the model working rather than leaking. The brand is the voice; the project is the
audience-building *work* — create the e-mail, create the accounts, warm them up for a week,
keep the idea bank stocked, reply to everyone. Those are tasks, they have due dates, and
before the project existed the only place to file "create the Coding Mom TikTok account"
was **Sleepy Cat**, which is where it actually sat. The axes still don't collapse: a Sleepy
Cat devlog posted from Coding Mom's TikTok carries `projectId: sleepy-cat`. What did change
is that both Coding Mom *series* now carry `projectId: coding-mom` — the daily short is
that project's work, so posting has to bump its `lastTouchedAt` or Momentum reports it
drifting on a day you posted.

### A brand can be the work of a project — decided 2026-08-07

The two axes were right and **they had no declared relationship**, which is a different
fault and took a week of use to surface. Brand and Project only ever met on an individual
`ContentItem`; nothing said that Sleepy Cat *the project* runs Sleepy Cat *the brand*. So
`Brand.projectId` — nullable, `SetNull`, one index.

The complaint that found it: the Coding Mom project page showed **3 items** while Studio
showed **31** under the same name. Both numbers were correct and neither was useful. Three
of the four projects run an account, and the app could not say so:

| Project | Runs | Its channels | Items carrying its id |
|---|---|---|---|
| Sleepy Cat | Sleepy Cat | 7 × @sleepycatgame | 2, both from Coding Mom |
| Coding Mom | Coding Mom | 6 × @codingmom | 3 of that brand's 31 |
| Utaitai | Utaitai | 5 accounts | 1 |
| Forge | **nothing** | — | 5 |

**A project's Social media tab now asks two questions instead of one.** "Posted as X" is
`brandId ∈ my brands` — what this project's own accounts publish. "Covered elsewhere" is
`projectId = me` from any *other* brand — what the world says about it. They partition the
result exactly, so nothing is listed twice, and each answers something the other cannot:
Coding Mom is 31 · 0, Sleepy Cat 0 · 2, Forge 0 · 5.

That is what makes the 20 brand-only items stop looking like an omission. They are about no
project — "My dad was kind to me and dismissive of my mom" is not about anything you are
shipping — but **publishing them is the entire job of the Coding Mom project**, so they
belong on its page and on no other. Filing them under a project would be inventing the
shadow project this section already refuses.

Five things fell out, each chosen over an obvious alternative that fails:

1. **It is a default, never a constraint.** It supplies the composer's project when you pick
   a brand, and nothing else. A Sleepy Cat devlog from @codingmom is still one row with
   `brandId: coding-mom` and `projectId: sleepy-cat`. **Whether Sleepy Cat rides Coding Mom
   at all stays an item-by-item question**, which is what it has to be while that is
   undecided — changing your mind is editing two items' brand, not a migration.
2. **The project follows the brand only until you touch it.** Pick a project yourself and
   the field stops following; **an existing item never moves on its own**, because whatever
   it says now is a decision somebody made. Without that second rule, opening any of the 20
   loose items and saving would have silently filed it under Coding Mom.
3. **A list, not a single `brandId` on Project.** Splitting one voice in two — a Japanese
   and a Chinese Utaitai — should not need a migration. Today every project runs one or
   none. It also puts the column on the rare-churn table, and makes Forge's case expressible
   as simply having none rather than as a null that means something else.
4. **The seed sets it on create only**, and there is a picker for it on Studio → Channels.
   The same rule the Project upsert's `update: {}` and the Series upsert's dropped
   `isActive` both follow: once a column is editable in the app it is a decision, and a
   re-seed that reverted it is the failure the editor exists to end. The picker exists at
   all because the noun you cannot edit is the noun whose data goes wrong.
5. **Merging Brand into Project was the tempting simplification and it destroys 27 of 31
   items.** It looks free at three-of-four. It cannot express Forge's five essays (a brand
   whose project isn't Forge), the two Sleepy Cat crossovers, or the 20 that are about
   nothing. Forge is the proof the axes are real: it runs no account and has the most
   coverage of any project.

The stat tile counts the union rather than `projectId` alone, for the same reason — Coding
Mom's real workload is 31, and Sleepy Cat's note now reads "7 accounts · 0 live" where it
used to say "Nothing published yet" about a project with seven accounts to build.

### The sprint — introduced 2026-07-31, **retired 2026-08-04**

The sprint was a named, dated, deliberately small set of Tasks — "these, this week" — that
Today read from, invented because sixty open rows on the Hunt Board is the right *contents*
for a planning surface and the wrong thing to be greeted by at 7am. It worked as designed
and was removed anyway, which is worth recording properly because the failure is not in the
implementation.

**A commitment made on Monday is a prediction about Thursday, and this is not a life where
that prediction holds.** The sprint tile reported done-against-committed and, after
2026-08-02, *pace* — "2 behind pace · 3d left". On a week where the baby takes the week,
that arithmetic has exactly one output, and the screen opened twenty times a day becomes
the one keeping score. The instrument was fine; the thing it measured was the wrong thing
to put in front of someone whose available hours are not theirs to allocate.

Two smaller things were wrong with it even on a good week. It **flattened the project
axis** — its list ranked rows across every project at once, so the fact you actually needed
to choose (which project this belongs to) was a muted word at the end of a line. And it
**made the choice for you**, which is the opposite of what "I'll pick what fits today" asks
for.

What replaced it is in "The Today screen" below: the unit is the project, not the task, and
the only progress indicator is a record of what was done rather than a measure against a
target. See also "Nothing but you creates a task" — the same principle, one noun over.

**What was removed:** `lib/sprints.ts`, `lib/sprint-actions.ts`, `components/sprint/*`, the
sprint bar and "In the sprint" card on the Hunt Board, the sprint toggle in the task panel,
`getBandwidth` / "While you're in it", `getUpNext` / "Next up", and the Momentum card
(folded into the project cards). The **`Sprint` table and `Task.sprintId` stay in the
schema**: dropping them would delete the record of what Week 1 held, and an unread column
costs nothing. `Task.sprintId` is no longer selected, written or displayed anywhere.

### Two axes again: priority is not status — decided 2026-07-31

Same shape as Brand-vs-Project. `Project.status` answers *is this moving*;
`Project.priority` (`main` / `side` / `later`) answers *should it be*. Collapsing them is
what made every project shout equally loudly.

| Project | priority | status | Why |
|---|---|---|---|
| Sleepy Cat | `main` | `active` | Has a launch to reach. Cadence tightened 7 → 3. |
| Coding Mom | `main` | `active` | Posts daily; it's Forge's go-to-market phase 1. |
| Forge | `side` | `active` | Design and research on the side — becomes `main` when Sleepy Cat launches. |
| Utaitai | `side` | `active` | Maintenance. Content still ships; no new energy goes in. |

Encoding "maintenance mode" as `simmering` was the obvious shortcut and it lies twice: it
hides Utaitai from a drift check it still deserves, and it says the content stopped, which
it hasn't. `priority` drives which sections the Hunt Board opens expanded, which projects
"Next up" draws from, and the order of the Momentum card and the Projects roster.

`priority` is editable from the project panel as of 2026-07-31, so re-tiering Forge the day
Sleepy Cat launches is two taps rather than a seed edit.

### The roster is the editor — decided 2026-07-31, **moved onto Today 2026-08-05**

_Everything below still holds; only its address changed. The three rules are the point and
they are unaffected. See "The roster folded into Today" for where the panel lives now._

Projects were the last noun with no way to create one. Adding Coding Mom and Forge meant
editing `prisma/seed.ts` and running `db:seed`, so for a week every Coding Mom setup task
was filed under **Sleepy Cat** — the project you can't create is the project whose work
ends up in the wrong place. `/projects` now opens a panel on any card, and a "New project"
button mints one.

Three rules, each because the obvious alternative fails:

1. **The seed no longer updates existing projects — `update: {}`.** It used to reassert
   name, description, cadence, sortOrder and priority on every run, with `status`
   create-only on the grounds that a "let it simmer" is a decision and not a typo. The
   moment those columns became editable in the app, *all* of them are decisions: a
   re-seed that reverted last week's re-tiering is exactly the failure the editor exists
   to end. The seed bootstraps an empty database and records what the roster started as.
2. **The slug is minted once and never follows a rename.** The seed upserts on `slug`, so
   a slug that tracked the name would make the next seed run *create a second row* instead
   of finding the existing one — the project would silently fork in two. Name is the
   label, slug is the identity. Collisions get `-2` appended.
3. **Deleting is refused for a project that holds anything.** Every relation pointing at a
   Project is `SetNull`, which is right for one row and disastrous in bulk: deleting
   Sleepy Cat wouldn't delete its nineteen tasks, it would *orphan* them onto the Hunt
   Board as unfiled rows with no way to tell where they came from. The panel says what's
   holding it ("18 tasks and 2 content items") and points at Archive. Delete is for the one you
   named wrong two minutes ago.

Two smaller things fell out. Moving a project to another Area re-files its Tasks in the
same transaction — a Task carries its own `areaId` and `saveMark` keeps the two in step,
so without it the project moves and its tasks stay behind, coloured for an area they've
left. And `project-actions.ts` revalidates `("/", "layout")` rather than a list of pages,
because the area tree lives in the app layout: a new project that appeared on the roster
but not in the sidebar reads as a save that half-failed.

### The roster folded into Today — decided 2026-08-05

**Two surfaces were listing the same projects, and the one that also listed their work was
the better copy.** That is the whole diagnosis. The complaint that started it was "there's
a Hunt Board and a Projects tab, what's the difference" — and the honest answer was that
Hunt Board is a list of *tasks* (projects appear only as headings), while Projects was a
list of *projects*. A real distinction, and it stopped being load-bearing the day before,
when Today was rebuilt project-first: after that, `/projects` was five cards saying
name · description · open count · last touched, beside a screen already showing five cards
saying name · **focus** · the actual rows · overdue · last touched.

This is the same fold as the Momentum card one section up, one noun larger. Momentum was a
list of every project's last-touched date sitting beside a list of every project; the
roster was a list of every project sitting beside a list of every project.

What the roster **uniquely owned** — and so what had to move rather than be deleted:

1. **Creating a project.** Now a quiet "New project" at the foot of Today's projects card,
   beside the idea box. Deliberately **not** crimson: it was the roster's primary action
   and it is not Today's, and §9 allows one accent per region.
2. **Editing one.** The pencil now sits beside each project's name on its Today card, and
   opens the same `ProjectPanel` unchanged. This makes a project card on Today the only
   route to renaming, re-tiering or archiving anything.
3. **Seeing what isn't active.** `getProjectBoards` shows `active` and `simmering` only, so
   without this an archived project would be *unreachable* — un-archiving would be
   impossible from the app at all. A collapsed "N put away" line opens
   `getDormantProjects()` (paused + archived), each row opening the panel. Off the card
   proper because a paused project is parked, not owed.

Three smaller things fell out:

- **A project page's back link goes to Today**, and the sidebar tree gained an active
  state. A project page used to light the "Projects" icon in the rail; with that surface
  gone nothing said where you were, and `/projects/[slug]` is not one of the four remaining
  surfaces to claim. The tree is the honest place for it — it is where you were already
  clicking to get there.
- **`ProjectRowView` became `ProjectEditView`** — exactly the eight columns the panel
  edits. The roster's shape carried counts and a preformatted touched label because it
  *displayed* a project; Today has both already, and making the panel demand them would
  have meant assembling a shape with no other use.
- **`getRoster` is deleted**, replaced by `getDormantProjects`. `getMomentum` in the same
  file has had no callers since 2026-08-04 and is left alone — it went dead with the
  Momentum card, not with this.

What was **kept**: `/projects/[slug]` entirely — Overview · Tasks · Social media · Docs is
where a project's docs live and there is no second copy of it. The route did not move, so
every existing link still resolves.

### Repurposing is two different things

Calling both of these "repurposing" is what made the whole thing feel unmanageable:

1. **Same asset, more places** — a TikTok going to IG Reels, FB Reels and YT Shorts. That's
   **one Content item with more ContentItemChannel rows**, each carrying its own caption, state and
   published URL. Near-zero effort, and it should stay that way.
2. **Same idea, different form** — a Medium essay becoming a Threads post. That's a
   **derived Content item** (`sourceDropId`), with its own stages and its own publish date, because
   it has to be rewritten rather than re-uploaded.

### Cadence is generated, never typed

Posting daily on two accounts is ~730 content items a year. A Studio that requires hand-creating
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
| **Today** | The one screen opened 20×/day. "What have I got on." One card per project. |
| **Hunt Board** | Every open Task, grouped by Project and track. The complete list, in full. |
| **Calendar** | Time. Events only by default; Task due dates and content are layers. |
| **Social Media** | Cross-project content pipeline. Kanban by stage. (Route is still `/studio`.) |
| **Montblanc** | A drawer on every surface, so it always knows what you're looking at. |

~~**Projects**~~ — _retired 2026-08-05. See "The roster folded into Today" below. Project
**pages** are untouched at `/projects/[slug]`; only the roster listing them is gone._

Future **Ledger** (bank + property audit, §5 Phase 6) slots in as one more surface without
disturbing anything. That's the test the IA is built to pass.

### The Today screen — rebuilt project-first 2026-08-04

**The unit of this screen is the project, not the task.** That is the whole change. The
question it answers is "what have I got on, and which of it fits today" — which is a
different question from "what is the single next thing", and the sprint was a good answer
to the second one.

Four cards, and none of them counts down:

1. **Your projects** — one card per `active`/`simmering` project, carrying its **focus
   line**, its few most pressing Tasks (`doing` → overdue → due today → due this week →
   the rest, capped at 5), an overdue count across the *whole* project, and how long since
   it was last touched. Tickable in place; ▶ flips a row to `doing`. Loose tasks with no
   project collect at the foot under **One-offs**. ✅
2. **Ticked off** — a GitHub-style contribution map over the last 26 weeks, plus what was
   completed today. ✅
3. **Social media content going out today** — items publishing today, one tick per channel,
   so posting is recorded without leaving Today. ✅
4. **Agenda** — today's calendar events, in time order, all-day first. Events only, and
   usually empty, which is now the correct state (see the calendar rules below). ✅

Plus **idea capture** at the foot of the projects card: one field, filing to the
Experiments track with no project, because the ideas that get lost are the ones you have
while doing something else and any second field is enough friction to lose them.

Three rules fell out, each chosen over an obvious alternative that fails:

1. **The card order is fixed** — `priority` then `sortOrder`, never drift or due dates.
   This screen is read by *scanning*, and a list that reshuffles overnight has to be
   re-read from the top every morning; a stable one is learned once. Urgency lives inside
   each card, where it is cheap to spot.
2. **A project with nothing open still renders**, saying so, with a link to put something
   on it. "Forge has nothing queued" is information — it is the prompt — and a project that
   vanishes when its last task is ticked is one you forget you own.
3. **Progress is shown backwards.** A contribution map has no target, so it *cannot* report
   a shortfall; the only thing it can say is what you did. On a bad week the useful fact is
   not "you did fewer than planned", it is that the row is unbroken. Recurring snapshots
   count — reading her a Vietnamese book on thirty days is thirty things done — and the
   streak does not break for today not having one yet, because at 7am it never would.

The **Momentum card is folded in** rather than deleted: a list of every project's
last-touched date sitting beside a list of every project was the same information twice.
It is now the quiet "4d ago" line on each card, amber when the project is past cadence.

The four stat tiles are **Ticked off today** (the one dark hero tile — an achievement, not
a deficit), Projects on the go, Social media content, and Overdue.

Section 4 is the answer to *"which projects am I actually following?"* Every Project carries a
`status` and a `lastTouchedAt` that bumps whenever one of its Tasks completes or one of its
Content items publishes. Projects drifting past their cadence surface themselves, with an explicit
"demote to Simmering" action — so nothing dies quietly and nothing generates guilt.

**Only `active` projects can drift.** Demoting to simmering has to actually silence the
warning, or "let it simmer" relieves nothing and the nagging becomes unquittable — which is
the exact failure mode this section exists to avoid. Today sorts drifting projects first
rather than newest-first (which is right for the Projects roster): a quiet project that
sorts to the bottom is a quiet project you never read.

A **project card** compresses to: next Task · next Content item · open count · days since touched ·
channel row.

### Entities

Built ones are in `prisma/schema.prisma`, which is the source of truth; this is the map.

- **Area** — slug, name, color, sortOrder ✅
  _(Area doubles as the calendar grouping — see §8, resolved.)_
- **Project** — slug, name, description, **focus** (nullable — the one line saying what it
  is aiming at *right now*, distinct from `description`, which says what it *is*; Today
  leads each project card with it), areaId, status (`active` | `simmering` | `paused` |
  `archived`), priority (`main` | `side` | `later`), lastTouchedAt, cadenceDays (nullable,
  drives drift warnings) ✅
- **Sprint** — name, goal, startsOn/endsOn (`@db.Date`), status (`planning` | `active` |
  `done`), closedAt; Tasks join via `Task.sprintId` ✅
- **Brand** — slug, name, tagline, color, sortOrder, **projectId** (nullable — the project
  this identity is the *work of*; supplies the composer's default project and lets a project
  page show its own channels and output. Never a constraint on an item — see §6, "A brand
  can be the work of a project") ✅
- **Channel** — brandId, platform, handle, label, url, state (`planned` | `live` | `paused`) ✅
- **Series** — brandId, projectId (nullable), format, cadence, daysOfWeek, timeOfDay,
  startsOn/endsOn, horizonDays, isActive; channels via **SeriesChannel** ✅
- **Content item** — title, notes, body, brandId, projectId (nullable), format (`short_video` |
  `article` | `text_post` | `image`), stage (`idea` | `script` | `produce` | `scheduled` |
  `published`), publishAt, seriesId + slotDate, sourceDropId, refUrl ✅
- **ContentItemChannel** — join: itemId, channelId, state, caption, scheduledFor, publishedAt,
  publishedUrl ✅
- **Task** — id, title, notes, link, track, dueDate, status (`open` | `doing` | `done`),
  sprintId (nullable, **vestigial** — the sprint was retired 2026-08-04 and nothing reads
  or writes this), projectId (nullable), areaId, recurrence
  (`none` | `daily` | `weekdays` | `weekly` | `monthly`), daysOfWeek, repeatUntil,
  recurringId (set on a completed snapshot, pointing at the live row),
  **parentId** (set on a checklist item, pointing at the job it is a step of —
  cascade, one level deep) ✅
- **Doc** — projectId **or** areaId (both nullable, exactly one set — enforced in
  `lib/doc-actions.ts`), slug (minted once, never follows a rename), title, body
  (Markdown), sortOrder. Cascades with its owner — the only relation that does.
  Was `ProjectDoc` until 2026-08-05 ✅
- **JournalEntry** — areaId, happenedOn (`@db.Date` — **set once from the server's clock and
  never editable**, §6, "The date is not a field"), title (nullable), body (Markdown).
  Points **backwards**: no due date, no status, nothing to tick. See §6, "The journal" ✅
- **JournalMedia** — entryId, data (`BYTEA` — in Postgres on purpose, §6), mimeType, width,
  height, byteSize, **kind** (`photo` | `video`), **durationMs** (nullable, video only),
  caption, sortOrder. Cascades with its entry. **Nothing but `lib/media-store.ts` selects
  `data`**. Was `JournalPhoto` until 2026-08-06 ✅
- **Event** — id, title, notes, location, start, end (both real timestamps, `end`
  inclusive), allDay, recurrence (`none` | `daily` | `weekdays` | `weekly` |
  `monthly`), daysOfWeek, repeatUntil (`@db.Date`, null = forever), areaId,
  projectId (nullable) ✅
- **ChatMessage / Conversation** — Montblanc history — Phase 5
- **User** — id, email, name, role (`owner` | `child`) — Phase 7. Deliberately absent for
  now: the app is single-tenant behind the allowlist and Auth.js runs JWT sessions with no
  adapter, so no table exists to hang `ownerId` off. Adding it is purely additive.

`produce` replaced the earlier `edit` stage — it's format-neutral, so filming a TikTok and
writing a Medium essay share one column instead of needing a board each.

Two fields on Task are not in the original sketch, both added 2026-07-31:

- **`link`** — the post worth copying, the console page, the thread with the user who
  asked. For the "try this format" flow the link *is* most of the task, which is why the
  Hunt Board leads with a paste-a-link capture box rather than a form.
- **`track`** — a free-text workstream ("Setup", "Build", "Art", "Ship", "Users",
  "Marketing", "Experiments", "Content"). Free text, not an enum: streams differ per
  project and inventing one shouldn't cost a migration. Utaitai runs three at once and
  without this the board is a flat wall of twenty unrelated rows. Suggested names live in
  `lib/tracks.ts`, which is kept free of any Prisma import so client components can read
  it. **"Build" and "Art" were added 2026-07-31** when Sleepy Cat arrived: a game's two
  big jobs are gameplay polish and art assets, they're *different people's* work, and
  folding them into "Ship" hid that half of the project isn't mine to do. **"Setup"
  followed the same day** with Coding Mom, whose first ten days are entirely accounts and
  handles — work that blocks everything else and then disappears forever. Three new
  streams from two new projects, at a cost of zero migrations: that is the case for free
  text, made twice. **"Monetization" followed on 2026-08-03** with Utaitai's subscription
  change — deliberately not "Money", because that word is about to mean the Ledger
  (Phase 6), which is household finances and an entirely different thing. It sits after
  "Ship" and before "Users": pricing and checkout are product work, and they come before
  the tracks about courting people.

### An unverified date is a note, not a due date — decided 2026-08-05

A festival-submission plan arrived with thirteen named festivals and thirteen deadlines,
and **none of the dates were checkable**. Some of the festivals are recognisable (IGF, MIX,
Mobidictum, Roguelike Celebration, Taipei's Indie Game Award); several are not, and no date
could be confirmed from here.

Writing them as `dueDate` would have been the obvious move and it fails the same test the
seeded tasks failed on 2026-08-04: **a row you have to stop and disprove costs more than no
row.** A wrong due date is worse than a missing one, because the board's whole claim is that
what it shows is true — and a submission missed because the date was invented is a failure
you cannot tell from a submission missed because you ran out of time.

So the claimed dates live in `notes`, prefixed with what they are, and a single **"verify
the festival list and every deadline"** task sits in front of the whole track. The due dates
that *are* on those rows are working targets derived from the claims, which is a different
promise from a deadline and is what the notes say.

The same judgement applied in the other direction: **the plan omitted Wholesome Direct**,
which for a cozy game is probably the best-fitting showcase there is, so that became a row
too. A list handed over is evidence, not an instruction — the job is to diff it against what
is already known, not to transcribe it.

### A goal with no deadline gets no due dates — decided 2026-08-05

Utaitai's 44 tasks carry **one** due date between them. The goal was given as "$100 MRR, no
deadline, however long it takes", and that phrasing is load-bearing rather than casual.

The obvious move is to invent dates anyway, on the grounds that a task without one never
gets done. It fails for the reason every removal in this file has failed: **a date invented
to manufacture urgency is a row you have to stop and disprove**, and forty of them is an
Overdue tile counting up forever on a project that is deliberately `side`. Nothing would be
late. The tile would say otherwise every morning, and the tile is on the screen opened
twenty times a day.

This is the sibling of "An unverified date is a note, not a due date" one step further out.
There the date existed and could not be checked; here **there is no date to check**, and the
board's honest answer is an ordered list with no clock on it. What supplies the ordering
instead is the **track order** plus a handful of explicit decision rows sitting in front of
the work they gate — "decide the price ladder" before any price is built, "decide one
account per platform or one per language" before any account is created.

**The one exception earns its date because the world imposes it, not because the plan wants
it.** Whatever the old three-free-songs paywall converted at becomes unrecoverable the
moment the paywall is switched off, and it is the only baseline the $1 week can ever be
compared against. That is a genuine closing window, which is the test: a deadline someone
else is holding gets a due date, a deadline you would be inventing for yourself does not.

### A milestone is a track plus an event — decided 2026-08-05

Sleepy Cat aimed at the **October 2026** Next Fest, and the ask was for "a milestone or
something". This app has no milestone noun, and the conclusion is that **it does not need
one**, because a milestone is only ever two things it already has:

1. **A date it happens on** → an **Event**. The fest week is the first thing this project has ever genuinely justified putting on the calendar: it is a thing that *happens at a time*, which is exactly the test §6 sets, as opposed to a thing you owe. Every deadline *around* it stays a Task, for the same reason.
2. **The set of work that must be true by then** → a **track**, `Next Fest`, sitting after `Ship` because everything in it is gated on Steam admin.

Plus the project's **focus line**, which is what Today leads with and is where "why is this
the shape of my next two months" belongs.

Inventing a `Milestone` model would have bought a title and a date that two existing tables
already hold, and cost a fourth thing that can disagree with the others. The one honest
loss is that nothing *links* the track to the event — you cannot click the fest and see its
readiness list. That is a real gap and it is smaller than a table.

**`Next Fest` is the first track expected to disappear.** It is for one week and is
meaningless afterwards. That is fine — `Setup` empties out too, and a track that goes quiet
is the free-text design working rather than failing.

### A milestone with no date is still a track — decided 2026-08-05

`YC` is the second milestone track, and it breaks the half of the rule above that says a
milestone is a track *plus an event*. There is no event, because **YC runs four batches a
year on a rolling application** — the deadline it aims at moves every quarter, and the
readiness list is re-run against each one rather than counted down to.

The obvious move is to put the next deadline on the calendar anyway and treat that as the
event. It fails today for a specific reason rather than a principled one: the batch dates
could not be confirmed from here, so an Event would be asserting a date the app was told by
nobody — §6, "An unverified date is a note, not a due date", and an invented appointment is
the worst place to put one (see "nothing but you creates an event"). The verification task
is the first row in the track, and **once it is answered the deadline earns an Event** and
this becomes an ordinary milestone.

What the track supplies in the meantime is the thing an event never did anyway: the set of
work that has to be true before applying. That half was always the useful half.

### One project's goal is another project's input — decided 2026-08-05

Coding Mom and Forge are two projects with **one funnel running through them**, and they
stay two projects. Coding Mom's goal — 10,000 engaged followers — is not an end in itself;
it is Forge's launch audience, and Forge's own goal (getting into YC) is substantially
gated on it, because an application with no traction is a rejection.

The tempting simplification is to fold them into one project with an `Audience` track. It
fails on the thing this file keeps rediscovering: **they run on different clocks and have
different failure modes.** Coding Mom is a daily cadence that dies of friction — the whole
project is "did you post today", and its drift warning is meaningful at `cadenceDays: 1`.
Forge is a quarterly application on a `side` tier with `cadenceDays: 14`, where a fortnight
of silence is fine and a *year* of silence is the failure. One project cannot carry both
cadences, and whichever one won would make the other's warning a lie.

It is also the two-axis model (§6, "Brand and Project are two axes") holding at a larger
size. Coding Mom is already both a Brand and a Project for the same kind of reason; that
the Project's *purpose* is another project's precursor does not collapse them either. The
link between them is what it has always been: content carrying `brandId: coding-mom` and
`projectId: forge` — who is talking, and what it is about.

**What the coupling actually costs is one row each way**, and both exist rather than being
assumed: "Point the bio link at the Forge waitlist once it exists" on Coding Mom, and
"Ship the landing page with a waitlist" on Forge. The handoff between an audience that
follows a mom and a startup with a pitch deck is a third row, on Coding Mom, because that
is the side that loses people if it is got wrong.

### A doc can point at a document — decided 2026-08-05

Sleepy Cat's second doc is a **pointer to a Google Doc**, not a copy of one. The design
feedback he and I pass back and forth lives there, and the obvious move — import the text
so it is readable in the app — is the wrong one.

**A `Doc` row is editable in the app, so importing a living document forks it on the first
edit.** Two versions then drift apart with no way to tell which one either of us had last
read, which is worse than not having it here at all: the whole value of a feedback doc is
that both people are looking at the same words. Same failure the seed's `update: {}` rule
exists to prevent (§6, "The roster is the editor"), one system further out — there the
second writer was a re-seed, here it is another person.

So the row leads with the link, says plainly that the Google Doc is the source of truth,
and carries a **dated snapshot** underneath. The snapshot earns its place because the
feedback is read next to the tasks it generates, on a phone, and because it is a summary
rather than his words it cannot be mistaken for the document.

**What did get copied in properly is the work.** Five concrete Build tasks came off the
feedback, and the "Polish pass on the difficulty curve" row got a real definition from it —
teach one mechanic per level — plus the doc as its `link`. That is the division: a document
stays a document, and the things it asks you to *do* become rows, because rows are what
this app is for. `Task.link` pointing at the Google Doc is what keeps the two connected.

One of the five is deliberately a decision rather than a fix — "decide whether finding one
sleep spot hides the others" — because the two answers are different games and polishing
the level order before it is settled is work done twice.

### Reddit is a room, not a megaphone — decided 2026-08-05

`Platform.reddit` was added with Sleepy Cat, and it is the first channel in this app that
does not behave like a channel. Every other platform on the list is **an account you
broadcast from**; a subreddit is **a room you are a guest in**, with its own rules about
self-promotion and its own moderators enforcing them.

It earns a row anyway, because r/cozygames and Screenshot Saturday are real sources of
wishlists and the account needs karma and history long before it needs to post about a
launch. What it does **not** get is a **Series**. A generated cadence pointed at a
subreddit is precisely the behaviour those rules exist to stop, and the app would be
manufacturing the posts that get an account banned. The distinction is recorded on the enum
value itself so the next person to wire up a cadence reads it first.

The same logic says why this is `reddit` and not `other`: `other` renders a `··` lettermark
and no profile URL, and this is a real account with a real profile that gets linked from a
Steam page.

### The calendar: one grid, three sources — decided 2026-08-01

Only **Events** are stored for the calendar. A Task's due date and a Content item's publish time
are layered onto the same grid **at read time** (`lib/calendar.ts`), never copied into
event rows. Duplicating a due date gives it two places to be wrong and a synchronisation
job nobody will write — and the Task is still the thing that owns it.

That means three sources arrive with three *different* date conventions (`Event.start` a
real timestamp, `Task.dueDate` a `@db.Date` at UTC midnight, `Content item.publishAt` a real
timestamp), which is exactly the trap below. The resolution is that everything is reduced
to a **local day key** — "YYYY-MM-DD" — the moment it is read, and the grid only ever sees
keys. Three conventions agreeing on which *cell* they land in is the whole trick.

Four rules fell out of building it:

1. **Day arithmetic happens on strings, via UTC.** `lib/calendar-keys.ts` adds days by
   pivoting through `Date.UTC` and reading back the date part. The obvious version — add
   86,400,000 milliseconds — builds a grid that loses or repeats a day twice a year at the
   DST boundary. UTC has no DST, and the keys are what the grid indexes on anyway.
2. **The rule is stored, not the occurrences.** A daily nap over a year is 365 rows that
   are only ever read seven at a time, and editing the nap time would mean rewriting every
   one of them. The consequence is stated out loud in the panel: editing any occurrence
   edits all of them, because there is only one row.
3. **Events are the one model where `start`/`end` are both real timestamps**, deliberately
   breaking the split below. An Event is the only row where a *time* is the point, and
   mixing a date column and a time column inside one model is what makes a calendar drift
   by a day. `end` is **inclusive** (an all-day event runs to 23:59:59.999), so walking
   start-day → end-day yields exactly the days it occupies with no off-by-one at either end.
4. **The calendar is not an editor for tasks and content items.** Clicking an event opens the
   panel; clicking a task or a content item goes to the Hunt Board or Studio. A task's real context
   is its project and track, a content item's is its channel checklist — reproducing either here
   would be a second, worse copy of a screen that already exists.

Shape is the legend, not colour: a **bar** is an event, a **square** is a task due, a
**dot** is a content item going out. Colour is already spoken for — it carries the area (or the
brand for a content item), which is the other thing a cell has to say at a glance.

**A fifth rule, added 2026-08-03: the three sources are layers, and content is off by
default.** The three-source design was right and its default was wrong. Two Utaitai
dailies put **34 content dots on an August grid** — two a day, every day, and 34 of the 41
were unfilled slots rendering as "Daily short — Japanese slot". A grid that repetitive
stops being read, which costs it the eleven rows that mattered; the month went from 52
things to 11 by hiding one layer. `parseLayers` / `layersParam` in `lib/calendar-keys.ts`
put the set in the URL beside the view and the cursor, so "the month with content shown"
stays a link.

Three things make it work rather than just hide data:

- **The legend is the switch.** It was already naming and counting the three sources, so
  the thing that tells you "41 content going out" is the thing you press. No new control
  in the toolbar, and none of the accent budget (§9) spent — on/off is a filled pill and
  opacity.
- **A hidden layer keeps its true count**, which is why `getCalendar` is still asked for
  all three and only the active ones are drawn. A layer reporting `0` while hidden could
  never advertise itself, and the toggle would be present and invisible. One indexed read
  on a small table is worth less than the discoverability.
- **The dopamine was never the calendar's to give.** Ticking a post off already lives on
  Today's "Going out today", one tick per channel. The calendar was replaying it as an
  unfillable dot — recognisably the same failure as §6's "Followed, not scheduled", where
  a thing you *owe* had been drawn as a thing that *happens*.

**And a sixth, added 2026-08-04: the task layer comes off too, so the grid starts empty.**
Content came off for clutter, which is a weak reason next to this one. **A task is a thing
you owe; an event is a thing that happens**, and drawing the first as though it were the
second is a category error the grid makes look entirely reasonable — a due date rendered as
a square on Thursday reads as an appointment on Thursday, so a calendar full of due dates
shows a week that appears fully booked when in truth *nothing is scheduled at all*. That is
the third time this same error has been found and removed: the baby routine ("Followed, not
scheduled"), the five seeded events, and now the default layer set. `DEFAULT_LAYERS` is
`["event"]`.

The layer stays available in the legend, and the honest consequence is stated plainly: a
calendar that opens empty is a calendar telling the truth, and an empty one is the correct
state until something that genuinely happens at a time is put in it.

**And nothing but you creates an event — decided 2026-08-03.** The seed's five invented
events are deleted and `seedEvents` is gone. "Check the rent has landed" and "In-laws
visiting" were demo rows built to give Phase 4's new grid something to draw, and they
failed worse than the baby routine did: a nap you didn't take is at least recognisably
yours, while an in-law visit you never arranged is a row you must stop and *disprove*
before dismissing. A calendar is only worth having if it is trusted on sight. Two of the
five were also duplicates — "Batch-film the week's shorts" and "Fill the week's slots in
Studio" restate the recurring task "Batch the Utaitai week", and a commitment stated twice
is one you get to ignore twice. An empty calendar on a fresh database is correct.

### Tasks that come back — decided 2026-08-02

"Read her a Vietnamese book" and "batch the Utaitai week" had two equally wrong homes: a
one-off Task you tick and lose, or an Event, which asserts a thing *happens at a time*
rather than that you *owe* it. So `Task` gained the calendar's `Recurrence` — the same
enum, deliberately, because two implementations of "every Wednesday and Sunday" is how it
comes to mean two things on two screens. `nextOccurrence` lives in `lib/calendar-keys.ts`
next to the day arithmetic and is shared by both.

A recurring task is **one live row that advances**. Ticking it writes a `done` snapshot
(`Task.recurringId`) and moves the live row to its next date. Four consequences, each
chosen over an obvious alternative that fails:

1. **The snapshot is a real Task, not a counter.** Everything that already reads tasks —
   the board's recent-done list, momentum, and (since 2026-08-04) Today's contribution map
   — keeps working untouched. The cost is that every list of *open* work must filter
   `recurringId: null`, or a daily habit appears thirty times: `getHuntBoard`,
   `getProjectDetail`, `getProjectBoards`, `getRoster`, `getMomentum` and the calendar's
   task layer. The contribution map is the one place that deliberately does **not** filter
   them — thirty days of reading to her is thirty things done, and collapsing them to the
   one live row would make the easiest habits to keep the ones that show up least.
2. **It advances from *today*, not from its old due date.** Advancing from the old date is
   how a habit skipped for a fortnight returns as fourteen overdue rows for days that have
   already gone. Missing a day is missing a day.
3. ~~**The sprint counts it done once it has fired inside the window.**~~ Moot since
   2026-08-04 — nothing counts a recurring task against a target any more. The problem it
   solved (a live row never *stays* `done`, so it reported outstanding all week however
   many times you did it) simply does not arise on a screen with no denominator.
4. **A recurring task with no due date is a rule that never fires.** It looks scheduled on
   the board and never reaches Today. `saveTask` and the seeder both infer the first
   occurrence rather than demanding one — ticking "every Wednesday" and leaving the date
   blank is the obvious thing to do.

### A repeating row is on Today only on its day — decided 2026-08-05

Ticking a recurring task doesn't finish it, it **advances** it — so before this,
"Post today's shorts" was ticked at 9am and reappeared at 9:01, dated tomorrow, on
the screen you open to see what is left. It reads exactly like something still owed,
which means the app was **charging you twice for one job**. The Wed & Sun batching
task was the same fault a size larger: on a Monday it sat there as a thing to feel
behind on, four days before it was anything at all.

So `getProjectBoards` filters it: a row with `recurrence !== "none"` is on Today when
it is **due today or overdue**, and not before. Three things still show, each because
hiding them loses real information:

- **Overdue.** A missed day is a fact, and one you asked to be told.
- **`doing`.** That is you saying you are on it *now*, and an explicit press outranks
  a date.
- **A recurring row with no due date**, which is a rule that never fires (`saveTask`
  infers one, so it shouldn't exist). Making a broken row invisible is worse than
  showing it.

Three consequences, each chosen over an obvious alternative that fails:

1. **`openTotal` still counts the hidden ones**, so the card's "N more →" is honest
   and the "Open tasks" tile doesn't shrink every time a habit is ticked. Filtering
   the count too would make the backlog appear to evaporate.
2. **A card with nothing but future recurrence reads "Nothing due today", not
   "Nothing open here."** The second sentence would be untrue, and it is the sentence
   that offers to put something on the project — the wrong prompt for a project that
   already has work waiting for its day.
3. **Every route out of the row now folds it out.** `TaskLine` used to suppress the
   fold on a recurring task specifically because it stayed put and would be redrawn;
   it no longer stays put, so the special case is gone.

**Deliberately Today-only.** The Hunt Board and a project page are the complete list
in full — hiding tomorrow's occurrence there would let a project look empty when it
isn't, which is the opposite failure. This is the same distinction the calendar's
default layers draw (§6, sixth rule): the screen you open twenty times a day shows
what is true *today*, and the survey surfaces show everything.

### A task can have a checklist — decided 2026-08-06

Posting to Utaitai is **one job done in several places**, and before this it had two
equally wrong homes.

- **One task** — "post today's shorts" — cannot record that the Japanese account went up
  and the Chinese one didn't. You tick it when you are half done and lie, or you leave it
  open and it says nothing about which half is left.
- **One task per account** multiplies a single daily commitment by however many accounts
  exist. Two today, five when Instagram, Facebook and YouTube go live — and "ship the iOS
  build" is then buried under five rows that are all the same thought.

So `Task` gained `parentId`, a self-relation onto itself. **A subtask is the same model,
not a `Checklist` table**: it already carries a title, a project, a track and a done state,
and half a Task's fields being meaningless on a child is cheaper than a second table every
list query would also have to learn about.

Six things fell out, each chosen over an obvious alternative that fails:

1. **Ticking the last box finishes the job.** `completeParentIfFinished` runs after any
   subtask completes. The alternative — a row reading "2/2" that still counts as open — is
   exactly the kind of untrue line this app keeps having to delete: there is nothing left
   to do on it, and the only thing left to press says the same thing a second time.
2. **A checklist re-arms with its parent.** On a recurring task, `completeRecurring` sets
   every step back to `open` and clears its `completedAt`. Tomorrow's post has not been
   made, so tomorrow's boxes are empty. The one branch that does *not* reset is the rule
   running out — there the steps are marked done with the parent, because an open step
   under a finished job is a row nothing will ever ask for again.
3. **A subtask never gets its own recurrence.** A checklist repeats with the thing it is a
   checklist for. Two rules on one job is how they come to disagree, and there is no screen
   that could show the disagreement.
4. **One level, enforced in `addSubtask`.** A checklist on a checklist item is a tree, and a
   tree needs collapsing, indenting and re-parenting — none of which the board has, and
   none of which "post to these accounts" asks for.
5. **`parentId: null` is the tax, and it is the mirror of `recurringId`'s.** Every list of
   open work carries both, now bundled as `TOP_LEVEL_ONLY` in `lib/task-view.ts`:
   `getHuntBoard`, `getProjectBoards`, `getProjectDetail`, `getAreaDetail`, `getMomentum`
   and the calendar's task layer. Without it the steps appear on the board as tasks in
   their own right, directly beneath the row that already renders them.
6. **The contribution map excludes them**, which is the opposite call from the recurring
   snapshots and worth saying why. Thirty days of reading to her is thirty *days*; posting
   to three accounts this morning is one morning. Counting the steps would make a job look
   bigger for having been broken up — a metric you can game by writing longer checklists.
   The job itself still counts, once, when its last box is ticked.

**Where it is expanded is a per-surface decision.** Today opens it, because that is the
screen you are on in order to tick. The Hunt Board and a project page keep it collapsed
behind its own `n/m` count, because those are surfaces for choosing *which job*, and an
expanded checklist under every row is the "board dumps everything on my face" problem one
level down. Editing lives in the task panel — one field, Enter to add — for the same reason
the idea box and the experiment capture exist: adding "and Instagram too" should not require
answering questions about projects and due dates.

### "While you're in it" — added 2026-08-02, **removed 2026-08-04**

A card that appeared only on days a weekly or monthly recurring task had already put you
inside a project, offering two or three of that project's other backlog rows while the
context was loaded. It existed because Utaitai is `side`, so no sprint was ever going to
claim "ship the iOS build", and its twice-weekly batching days were the only moment its
backlog was cheap.

It was a workaround for the sprint hiding side projects, and the project-first Today does
not hide them: Utaitai has a card every day, with its rows on it. Keeping both would have
put the same three tasks on one screen twice.

### Followed, not scheduled — decided 2026-08-02

The seeded baby routine is **deleted**: seven daily rows for feeds, naps, bath and bed,
plus a swim class and a check-up. It read as a beautiful demonstration of recurrence and
was a lie about how the day goes. A four-month-old is followed, not scheduled, and a
calendar asserting a 13:00 nap every day is mostly a machine for feeling behind.

Worse, things had begun to *depend* on the fiction — the Sunday filming block was parked
"inside the long nap", so a real commitment was planned against something that was never
reliably true. Phase 4's own notes called the naps "the most useful thing on the whole
calendar". They were the most confidently wrong thing on it.

What is genuinely deliberate became a project instead: **Multilingual baby** (Baby area,
`main`, cadence 2). Vietnamese and English daily as recurring *tasks* — owed, not
scheduled, done in whatever gap the day leaves — and Russian as one umbrella task plus
three concrete leads, because "find a solution" alone is the kind of row that sits open for
a year for want of a first move. Its content items carry the Coding Mom brand and this
project, so the two axes (§6) do the work again.

_That project was **removed on 2026-08-04** — see the next section. The half of this
decision that holds is the first two paragraphs: the routine was a fiction and had to go.
The replacement was the part that didn't survive contact._

Real appointments still belong on the calendar. A paediatrician slot has a time, and the
time is the point.

### The Baby area is a journal, not a backlog — decided 2026-08-05

**Multilingual baby is deleted.** The Baby area held nothing at all for about an hour, and
then became the first area with a **page** — see "An area is something you can open" below,
which is this decision's second half and was built the same day.

The verdict on it was "it's just kind of weird", and the weirdness has a shape. Every other
project in this app is something that would not otherwise happen — Sleepy Cat does not ship
itself, Coding Mom's accounts do not create themselves, so a list of rows is the right
instrument and an untouched project genuinely is drift. **Caring for a four-month-old is
not in that category.** It is the main thing happening every day whether or not anything is
written down, so a project about it can only ever report on something already guaranteed:
`cadenceDays: 2` on the most-attended-to thing in the house is a drift warning that can
never fire honestly, and "read her a Vietnamese book" as a tickable row adds an audit to a
thing that was never at risk of being skipped.

This is one notch subtler than "Followed, not scheduled" above, and it is the same family
of error — the third instance now, after the baby routine and the seeded events. That one
was **a task drawn as an event**; this one is **a life drawn as a backlog.** In both cases
the app asserted a structure nobody had asked it for, and in both cases the tell was the
same: it produced rows you had to stop and disprove rather than rows that told you
anything.

What the area is heading towards is a **development-milestone journal** — written *after*
she does a thing, not before. That is a different noun from anything the app currently has:
Task is binary and forward-looking, Event asserts a time, ContentItem goes out to an
audience, and none of them is "she rolled over on the 3rd".

_That paragraph was written expecting to sit for a while. It sat for about an hour — the
journal was asked for immediately and is built. See the next two sections._

Three notes on the removal itself:

1. **The three content ideas were detached, not deleted.** "Raising her in two languages
   when only one of them is easy" and its two siblings were the two axes (§6) doing their
   job — Coding Mom is who is talking, the project was what it was about. Only the second
   axis went; they are brand-only ideas in the bank now, which is what the other three
   Baby-pillar ideas always were.
2. **The doc cascaded, which is the rule working as designed** — a doc without an owner is
   a page about nothing (§6, "The docs moved onto the project"). "Three languages, one
   unsolved" survived as a file, and is now back in the app as `baby-languages.md` — a
   **Doc on the Baby area**, which is the thing that did not exist when it was deleted.
   Its structural claims were rewritten rather than restored: it said "why this is a
   project and not a list", which would have been a page explaining a shape the app no
   longer has.
3. **The row is backed up** to `backups/multilingual-baby-2026-08-05.json`, the same
   courtesy the 78 seeded tasks got, and the seed entry is deleted rather than commented
   out — for the reason §6 gives about `seedTasks`, a landmine with a safety catch is still
   a landmine.

### An area is something you can open — decided 2026-08-05

`/areas/[slug]`, with **Journal · Docs · Tasks**, reached from the sidebar tree.

For five phases an Area was a colour, a heading, and a foreign key. That was fine while
everything inside one was a project, because a project has a page and the area was just the
folder above it. **The Baby area broke it**: it has no projects by design (previous
section), and yet it has a journal, a vision worth writing down, and one genuine task —
all three of which had nowhere to live, because every home in this app hung off a Project.

**This is not a fifth nav surface, and the rule against those still stands.** "Never one
nav item per area" (§6, Navigation) exists because that list grows forever and makes you
recall which bucket a thing is in. An area *page* is the same thing a project page is: a
destination you reach from the tree, not an item in the rail. The rail is still four icons.
The shape is deliberately copied from `/projects/[slug]` — same tab strip, same
one-query-per-section — and the Docs tab is now literally the same component.

Three decisions inside it:

1. **It opens on Journal, not on an Overview.** A project page opens on Overview because
   "where does this stand" is the question; an area does not stand anywhere, and an
   overview tab here would be a summary of the two tabs beside it. The reason to open an
   area is almost always to write something down.
2. **Only the active tab's heavy read runs.** The journal pulls every entry and its photo
   metadata for the area, and it is the one query on the page that grows without bound.
   Rendering the Docs tab should not pay for it.
3. **The area name in the sidebar became a link, and the "All areas" filter chip is
   gone.** That chip and the per-area selection had been cosmetic since Phase 1 — nothing
   ever read the selection. Leaving a dead toggle beside a live link is worse than either;
   the name now goes where a project's name already goes.

### The journal — added 2026-08-05

**A `JournalEntry` is something that happened.** It is the first row in this app that
points backwards, and that is the whole justification for a new noun rather than reusing
one.

Everything else points forwards: a Task is owed, an Event is scheduled, a ContentItem is
going out. "She rolled over on the 3rd" is none of those — and when the only available
nouns point forwards, recording the past means filing it as something you owe, which is
precisely how the Baby area became a chore list. So an entry **cannot be overdue** (no due
date), **cannot be ticked** (no status), and **is never counted against anything** (no
target, no streak, no pace). Nothing here can be fallen behind on, which is the feature and
not an omission.

It hangs off an **Area**, not a Project — the Baby area should not need to invent a project
in order to be written about, and Area is the coarse ~5-ever noun, which is the right grain
for "a journal".

Four things fell out:

1. **The composer sits open, not behind a button.** Every other write goes through a panel,
   which is right for a form you fill in deliberately. This is the opposite case: the thing
   being recorded happened thirty seconds ago and you are holding a baby, so one tap before
   the cursor exists is the entry not getting written. Same argument as Today's idea box,
   one size up.
2. **`happenedOn` is the day it is *about*, not the day it was typed** — `@db.Date`, so all
   of §6's "Dates are a trap here" applies, formatted `timeZone: "UTC"`. The two dates
   differ whenever you write up Tuesday on Thursday, which with a baby is most of the time.
3. **An entry with neither text nor a photo is refused.** A journal that can hold a blank
   dated row is one you scroll past a blank dated row in, and it reads as a day you failed
   to record rather than a save you fumbled.
4. **The seed will never create one**, for the general reason in "Nothing but you creates a
   task": an entry is a claim about her life, and it is the *strongest* form of that claim
   in the app. An invented milestone would be considerably worse than an invented task.

**Sending them to her one day** is not built and is deliberately not designed. The data is
the right shape for it — every entry has a date and a body, and photos are addressable by
URL — so it is a job that reads rows rather than a schema change.

### A day is the unit you add to — decided 2026-08-06

The journal shipped as a flat list of entries, newest first, each labelled with its date.
That is the right list for a milestone log — "she rolled over on the 3rd" — and the wrong
one for what it is actually used for, which is **journaling through a day**. A day is not
one thing that happened; it is a morning, an afternoon, and whatever woke you at 3am.

Before this, a second thought about Tuesday had two homes and both lose something. **Edit
Tuesday's entry** and the two moments become one paragraph, with nothing recording that
they were written six hours apart. **Write a second entry** and it sorts in beside the
first with its date repeated, so two entries about one day look exactly like two entries
about two days.

So entries are **grouped by `happenedOn`**, and each day heading carried its own **"+"**.

> **The "+" was removed the same day** — see "The date is not a field" below. Adding to a
> day that has passed turned out to be the thing that shouldn't exist, not the feature. The
> grouping and the timestamp are untouched and are the half that was right.

Four things fell out:

1. **Each entry shows the time it was written**, which is what the day heading frees up
   room for — the date has moved up to the group, and what an entry has left to say about
   *when* is the clock. The grouping and the timestamp are one change rather than two: a
   time is meaningless without the day above it, and a repeated date is what was crowding
   it out.
2. **The time is only a clock time when the entry was written on the day it is about.**
   Otherwise it reads "written 6 Aug". The two dates differ whenever you write up Tuesday
   on Thursday, which with a baby is most of the time, and a bare "21:04" under a Tuesday
   heading is a claim that something happened at nine on Tuesday night. It didn't; that is
   when you got round to typing it. This is `createdAt` — a real timestamp, formatted
   **local** — sitting next to `happenedOn`, a `@db.Date` formatted **UTC**, which is §6's
   "Dates are a trap here" with both traps in one component.
3. ~~**Today's heading has no "+".**~~ Superseded hours later: **no** heading has one, and
   the open composer is the only way in. See below — and then superseded again the same
   day, in the other direction: **today has a "+" and no other day does**, which is the
   two halves of this finally agreeing. See "A day is a thread" below.
4. **The grouping is done in `getJournal`, in one pass over rows the query already
   sorted.** The order is `happenedOn desc, createdAt asc` (it was `desc, desc` until the
   thread arrived), so consecutive rows of a day arrive together and a day boundary is
   "this key differs from the last one". No `Map`, no second sort, and no iteration order
   to reason about.

`JournalEntryView` lost `dayLabel`, `shortLabel` and `isToday` in the process — the day
carries all three now, and leaving a second copy on the entry is how the two come to
disagree. Same reason `TaskLineView.recurrence` was deleted when its one caller went.

~~**Entries within a day stay newest-first**, matching every other list in the app. Reading
a day bottom-up is the argument for reversing it, and it is a real one; it was not taken
because a journal you are *writing* is scanned from the top, and the newest thing is the
one you just wrote.~~ **Reversed hours later** — the argument named as real was the right
one. See the next section.

### The date is not a field — decided 2026-08-06

**`happenedOn` is set once, on create, from the server's clock, and nothing can move it.**
The date input is gone from the composer, an update never writes the column, and no day
heading has a "+". You cannot journal into a day that has passed.

This reverses the position `JournalEntry` shipped with — the column's own comment said "the
day it is *about*, not the day it was typed", and the reasoning was that you write up
Tuesday on Thursday. That reasoning was about a journal nobody had used yet. **The journal
turned out to be written live**, several times through a day, thirty seconds after the
thing happened, and against that use an editable date is not a convenience; it is the one
thing that makes the record worth less.

The argument is exactly the one this file keeps arriving at from the other direction.
Everywhere else the rule has been **the app must not assert things nobody told it** — no
seeded tasks, no invented events, no due dates that were guesses. This is its mirror:
**what the app records for itself, it should not let anyone overwrite.** A time that came
from the clock is a fact. A time somebody chose is a claim, and a journal of claims has to
be trusted rather than simply read. Years out, the useful thing about an entry is not that
it says it is about the 3rd; it is that it was genuinely written at 21:04 on the 3rd, which
is *why* it says what it says and in the tone it says it.

Three consequences, each chosen over an obvious alternative:

1. **Editing is untouched, and it is a different act.** The pencil still fixes a word,
   finishes a sentence, or attaches the photo you meant to. That is correcting a record.
   Back-dating one is writing a record later and presenting it as contemporaneous, and the
   distinction is the whole feature. `saveJournalEntry`'s update branch simply omits
   `happenedOn`, so a stray value posted alongside an `id` is inert rather than a silent
   move — the same shape as `saveDoc` refusing to re-own a doc.
2. **The day is computed server-side, not accepted from the form.** Taking it from the
   client would put the fact back in the hands of whatever posted it, which is the thing
   being removed. It is `Date.UTC(local y, m, d)` — a `@db.Date` standing in for a local
   calendar day, §6's first date trap.
3. **The "written 7 Aug" branch survives for old rows.** Every entry created from now on
   has a day and a writing-time that agree by construction, so the branch is unreachable
   for new data. It is three lines, and it is what stops the app printing "21:04" under a
   Tuesday heading for one of the handful of rows written while the date *was* a field.

**The honest cost, stated rather than smoothed over:** a day genuinely missed is a day
genuinely lost. Something that happened on Tuesday and was not written on Tuesday can only
be recorded as a Thursday entry that says so. That is the trade, and it is the right one
for a journal — it is the wrong one for a diary you fill in on Sundays, which is a
different product.

### A day is a thread, and the composer is its last node — decided 2026-08-06

The grouping two sections up was right and **the shape it was drawn in still said the old
thing.** Each entry stayed a floating white card, identical to every other, so two thoughts
about one afternoon looked exactly like two thoughts about two afternoons — the heading
above them was the only thing claiming otherwise, and a heading loses that argument to six
identical tiles underneath it.

So a **day** is the card, and the entries are nodes on one thread inside it. Same rows, same
timestamps, no schema change: what changed is that the connection is drawn rather than
asserted. This is the third pass at the same object, and the three agree — group by the day
(4.15), let only today be written into (4.16), and now say on screen that a day is one
train of thought rather than a folder.

Four things fell out, each chosen over an obvious alternative:

1. **The days run up and the entries inside a day run down**, and the two directions are not
   in conflict. A list of days is a list, and every list in this app is newest-first. **A day
   is not a list** — it is one train of thought from morning to night, and a train of thought
   read bottom-up is not one. This reverses 4.15's call, which had named the argument for
   reversing it "a real one" and declined it; reading a day *as a day* is what settled it.
2. **The composer is the last node of today**, not a form above the whole page. It was
   already directly above today's group and it read as a separate thing hovering over the
   journal rather than as the next thing in it. As a node it is literally where the next
   thought goes — which is the entire content of the request for a "+".
3. **It is open when today is empty and behind a "+" once the day has started.** The open
   composer's justification (4.8: the thing happened thirty seconds ago and you are holding
   a baby, so one tap before the cursor exists is the entry not getting written) is about
   *starting* the day. Once there is a day to read, a permanently open form halfway down it
   is something you scroll past, and the tap has bought you a readable page. Both states are
   the same node, so nothing moves when it opens.
4. **Only today gets one, which is what makes the "+" honest.** A past day heading has no
   button, no composer and no way in — §6's "The date is not a field", unchanged and now
   visible in the layout rather than only enforced in the action.

**`getJournal` always returns today**, empty or not, because the composer lives inside a day
and the one day you can write into therefore has to *be* a day before it is a record. An
empty group is what an unwritten day looks like; the "Nothing written yet" card is now about
the journal as a whole, not about today.

The thread's line is drawn **per node** rather than once down the list, because the nodes are
different heights and it has to stop at the last dot. It is one of the few places §9's
"separation by contrast, not borders" gives way, and for the reason the rule allows: the line
is not a divider between things, it is the statement that they are connected.

### A task opens where you are reading it — decided 2026-08-07

Today showed you a task's title, its track, its due date and its checklist, and the only
thing you could do to it was tick it. Changing anything else meant going to the Hunt Board,
finding the same row in a list of a hundred and ninety, and coming back. The project page's
Overview had the same hole one surface over: "Next up" answered *what is next* and then made
you go to the Tasks tab to act on it.

That is a **detour through a surface you did not want**, and it is the same complaint the
Projects roster died of (§6, "The roster folded into Today") — a second screen you have to
visit to finish a thought the first screen started.

The fix is the one this app already had a pattern for. A project card carries `edit:
ProjectEditView`, everything the settings panel needs, so the pencil opens it with no round
trip. A task row now carries `edit: TaskView` for the same reason and at the same cost: four
more columns on `boardSelect`, on a query that was already running.

Three things fell out:

1. **The panel is owned by `ProjectsCard`, not by each row.** One panel can be open at a
   time, and the project list its picker needs is fetched once for the whole screen rather
   than per card.
2. **The title is the hit target, and only the title.** The tick, the play toggle and the
   link all already do something, and a whole-row click would swallow whichever one you
   actually meant. This is what the Hunt Board and the Tasks tab already do.
3. **Overview stays read-only apart from opening.** No tick and no play there: it is a
   summary of the Tasks tab, and giving it the full row controls would make it a second,
   worse copy of one — the argument §6 already makes about the calendar not being an editor
   for tasks.

### Stages and tracks answer different questions — decided 2026-08-07

The Tasks tab grouped by track and nothing else, so **it could not say how anything was
moving**. A project with forty rows and three of them in flight rendered identically to a
project with forty rows and none: `doing` was a small amber word on one line of one group,
and `done` was behind a "Show N done" button. That is a list of work, and what a Tasks tab
is opened to check is progress.

So there are three columns — `open` → `doing` → `done`, the states `Task.status` has always
had — and a **Stages / Tracks** control between them.

**Stages lead, and tracks are not demoted.** They answer genuinely different questions:
stages are *how is this moving*, tracks are *what kind of work is left*, which is why free
text tracks exist at all (§6, "Two fields on Task"). The reason stages default is only that
the first question is the one this tab is for. Nothing is lost by choosing them, because
**each column is itself cut into track runs** — the columns re-cut the same rows rather than
replacing what they told you.

**The track is on the run, not on the card — corrected 2026-08-07, hours after shipping.**
The first version put a track chip on every card, and it was wrong twice over in the same
place: Forge's To do column opened with the word "Setup" four times running, each on **a line
of its own beneath the title**, so the chip both repeated itself and doubled the height of
every card in the column. Thirty-one cards took the room of sixty-two.

Said once per run it is the same information in a third of the space, and the run heading is
**sticky**, which recovers the one thing a per-card chip was genuinely better at: knowing
which workstream you are in thirty rows down. Two details it needed:

- **The heading's own padding separates it from the first card, not a `gap`.** A flex gap is
  transparent, so a card scrolling underneath a pinned heading shows through the strip below
  it. Found by scrolling, not by reading.
- **What is left after the track moved out — a repeat badge, a due date, a link — went onto
  the title's row.** That is what makes an ordinary card one line tall rather than merely
  shorter, and it is only affordable *because* the track left: the busiest row in the app
  ("Batch-create the week's content", `Wed & Sun`, `9 Aug`, a link) fits without wrapping.
  A checklist still goes below, because it is not a chip.

`groupByTrack` is shared with the Tracks view, so the two cannot disagree about track order
or about what an untracked row is called.

**A capped column, not a scrolling one — corrected 2026-08-07.** The cap shipped as
`max-h-[70vh] overflow-y-auto`, which is the reflexive way to bound a kanban column and is
wrong here twice.

- **It is a scrollbar in a design that has none anywhere else.** §9's whole vocabulary is
  near-invisible chrome — no borders, shadows you have to look for — and a grey bar down the
  side of the busiest column is the loudest thing on the screen.
- **It makes the wheel mean two things depending on where the pointer is.** A column that
  had reached its own bottom simply *swallowed* the scroll rather than passing it to the
  page, so the board appeared stuck. This was hit while verifying the feature and mistaken
  for a bug in the data before the cause was clear.

Twelve cards and a "N more →" removes both, and it is a pattern the board already had — it
is what the Done column was doing. Expanding is **per column**, because unfurling To do
should not also unfurl eighty finished rows underneath it. The honest cost is that an
expanded column makes the page long, which is exactly the thing the cap exists to prevent —
but it is now a per-column choice you made, rather than a default you have to fight.

The run headings **stopped being sticky** with it, and that is the change following through
rather than a loss: sticky was justified only by a long scroll *inside* the column, and with
no inner scroll it would have pinned itself against the page instead — three headings
floating over a board.

Four decisions inside it:

1. **Arrows move a card; the tick still finishes it.** Replacing the tick with arrows would
   have made the commonest move — To do straight to Done — two presses, and put a different
   control in the place every other surface in this app puts the same one. The arrows are
   what the columns *add*: they are the only way to say "I have started this" without
   opening the panel.
2. **Every column shows twelve and offers the rest.** Sleepy Cat is 88 · 0 · 1, so an
   uncapped board is a page 88 cards tall with two empty columns beside it — and on a phone,
   where they stack, you would pass all 88 before reaching Doing. **This began as
   `max-h-[70vh] overflow-y-auto` and that was the wrong instrument** — see below.
3. **One cap for all three columns**, rather than a queue rule and a record rule. The
   mechanism is the same and a single number is the one you can predict.
4. **A repeating card is not special-cased.** Ticking it advances the row rather than
   finishing it, so it reappears under To do dated forward — which is what happens on every
   other surface, and what the `Repeat` chip on the card is there to warn about. A kanban
   that quietly did something else with recurrence would be a fourth place recurrence means
   a fourth thing.

### A camera in a window is a camera you are looking at a third of — decided 2026-08-07

The journal's camera sheet was a centred card at every width. On a phone that is a viewfinder
occupying a third of a screen you are holding up at a baby, which is the one surface in this
app where the content genuinely wants the whole viewport: **the preview *is* the screen**, and
every native camera behaves this way.

So below `sm` it is full-bleed — header, a `flex-1` preview taking whatever the controls
leave, and the controls at the bottom over `env(safe-area-inset-bottom)`, because full screen
on a phone means the home indicator is genuinely over the bottom of this element. From `sm` up
there is a pointer, a large display and other things worth still seeing, so it stays the card
it was.

**The two media buttons became one dropdown** at the same time, and for a smaller reason:
"Add photos", "Camera" and the counter were three controls across the top of a composer whose
whole justification is that it is quiet enough to type into without deciding anything first
(§6, "The journal"). The choice between library and camera is real — it is the one §6 sets
out under `MediaInput` — but it is not one you make often enough to spend a permanent row on.

### A thumbnail is a promise that the whole photo is there — decided 2026-08-06

The photos on an entry were "all over the place", and the diagnosis is exact: each one was
rendered at **its own aspect ratio** in a grid with automatic rows, so a portrait, a square
and a panorama produced three heights and rows that did not line up. `object-cover` was
already on the image and was doing nothing — a box with no fixed height is never the wrong
shape to cover.

Three things, and the third is what makes the first two allowed:

1. **Uniform square tiles**, so the cover crop finally has something to crop to. Two columns
   on a phone, three from `sm`.
2. **Capped at `max-w-xl`, which was the bigger half of the bug.** The journal column is
   ~1300px on this monitor, so three tiles sharing it are **420px each** — a contact sheet
   rendered at poster size. A tile stretches to its container by default and a photo should
   not; the cap makes a thumbnail thumbnail-sized at every width.
3. **Tapping opens it uncropped, full screen**, and without that the crop would be a
   permanent loss — a grid that hides the top of somebody's head with no way to see it is
   worse than the ragged rows were. **A single photo is exempt from the crop entirely**: one
   photo is not a grid, it is *the* photo, and squaring it buys a tidy row of one.

Three notes on the viewer:

- **It is portalled to `<body>`, and that is not fussiness.** `animate-rise` finishes with
  `transform: translateY(0)` under `animation-fill-mode: both`, so every day section on the
  page permanently carries a transform — and a transformed ancestor is a containing block
  for `position: fixed`, which would pin a "full screen" viewer to the day it came from.
  The portal renders only when open, so there is no `document` touched on the server.
  React's delegated `onAnimationEnd` still works through it: Next mounts React on
  `document`, so the portal container is *inside* the root container.
- **`--color-viewer` is a third job, not a heavier scrim.** A scrim dims a page you can
  still read; this has to disappear so the photo is the only thing on screen. It is nearly
  the same value in both themes for that reason — a photo viewer is dark everywhere, and
  inverting it with the theme would be §11's elevation ladder applied to something that is
  not part of the page. Same lesson as `--color-scrim` itself: two jobs sharing a value is
  a coincidence that a second theme finds.
- **"Save to photos" moved onto the viewer.** On a tile it was a control on every square of
  a grid whose whole job is to be quiet, and below `sm` it is always visible (hover is not
  an affordance on a phone), so seven photos meant seven buttons. One level in, it is still
  on every photo and clip.

### Ten photos an entry — decided 2026-08-06

`MAX_MEDIA_PER_ENTRY = 10`, checked in the composer *and* in the action.

Ten is a **storage** number wearing a layout number's clothes, exactly as the clip's ten
seconds is. Ten photos is ~750KB in a database where every byte is a byte of database
(§6, "Photos live in Postgres"); ten *clips* is 20MB, which is why the cap counts items
rather than kinds and is deliberately not generous. It is also as many as the grid shows
before it becomes a contact sheet you scroll past instead of look at.

**The cap constrains a moment, not a day, which is why it can be this low without losing
anything** — a day already holds as many entries as you like and they read as one thread, so
"start another entry for the rest" is not a consolation, it is the better record anyway.
That is what the message says rather than just refusing.

Two smaller things:

- **The server counts what the entry already holds**, or the cap would be per-*submit*
  rather than per-entry: ten photos, save, ten more. The composer is told the existing
  count for the same reason, so the counter reads "7 of 10" while editing.
- **It is checked before the entry is created or updated.** Media is stored one file at a
  time and deliberately not in a transaction with the entry (a photo that fails should cost
  you that photo, not the paragraph) — so a late refusal would leave an entry created with
  half its photos attached.

### A clip is a photo that costs twenty times as much — decided 2026-08-06

`JournalPhoto` became **`JournalMedia`**, with a `kind` and a nullable `durationMs`, and the
journal's camera can record **ten seconds**.

The rename is the `ProjectDoc → Doc` precedent for the third time: a hand-written migration
where every statement is a RENAME or an additive ALTER, applied with `migrate deploy` rather
than diffed, because `prisma migrate dev` turns a model rename into a DROP plus a CREATE and
these are the rows §6 already calls the one kind in this app that cannot be recreated. The
alternative was leaving the model called `JournalPhoto` and storing video in it, which is
the "a codebase that reads like a different app than its screens" problem §2 exists to stop.

**Ten seconds is a storage decision wearing a UX hat, and both readings are true.** A clip
at 720p/1.5Mbps is about 2MB against ~75KB for a photo, and these live in Postgres for the
reasons below. Twenty-five clips cost what a whole month of photos does. Ten seconds is also
simply the right length for the thing being filmed — she does the thing or she doesn't — so
the cap did not have to be argued for twice.

Four things fell out:

1. **`MAX_PHOTO_BYTES` became `MAX_MEDIA_BYTES` and did not move.** Still 6MB, still under
   `serverActions.bodySizeLimit`, so an oversized file is refused with a sentence rather
   than by a truncated request. A ten-second clip lands at a third of it.
2. **`baseMime` exists because `MediaRecorder` reports its codecs.** The recorder hands back
   `video/webm;codecs=vp8,opus` or `video/mp4;codecs=avc1…`, and that string lands on the
   `File`. Storing it whole would be honest and useless — nothing downstream branches on the
   codec, and the accept-list would have to enumerate every combination any browser might
   pick. The base type is stored; the codec is discarded.
3. **The container is negotiated, not sniffed.** Safari muxes MP4 and rejects WebM; Chrome
   and Firefox are the other way round. `MediaRecorder.isTypeSupported` is a question the
   browser can actually answer, so the list is tried in order and the first `true` wins.
   Browser-sniffing would be a table that goes stale.
4. **The route now says `Accept-Ranges` matters.** It does not implement ranges, and gets
   away with it only because 6MB is small enough to send whole. That is written down because
   it stops being true the moment the cap moves.

**A photo's `dim:<name>` became `meta:<name>`**, carrying size, kind and duration in one
value. The browser has already decoded the photo to downscale it and recorded the clip
itself, so it knows all three; the alternative is a native image *and* video library in the
dependency list to re-derive numbers the client had in hand.

### The camera roll cannot be written to, so it is a button — decided 2026-08-06

The ask was for the journal's camera to save its photos to the phone's camera roll
automatically. **No web API can do that**, and it is worth recording that this is a platform
limit rather than a thing left undone: a photo captured through `getUserMedia`, or through a
file input's `capture` attribute, goes to the page and nowhere else. iOS in particular does
not put it in Photos.

What exists instead is **`navigator.share` with a file**, which opens the native share sheet
where "Save Image" is one tap. Where that is unavailable — every desktop browser, and
Firefox — it falls back to a download, which on Android lands in the gallery and on a
desktop lands in Downloads.

Two decisions inside that:

1. **The button lives on the entry, not in the camera.** A photo that arrived from the
   library is just as likely to be the one you want to send someone, and a control that only
   appears for camera-captured photos would be a rule you have to learn.
2. **The camera says so on screen.** One line under the shutter, because the failure mode
   otherwise is silent and delayed: you take twenty photos of her over a week and find out
   afterwards that none of them are in Photos.

**And the library picker stays**, which is the other half of the answer. Shooting with the
phone's own camera app *does* save to the roll, and "Add photos" attaches it — so the route
that needs no extra tap already exists, it just isn't the in-app camera.

### Filters are colour grades, not face filters — decided 2026-08-06

Five presets — None, Warm, Faded, Mono, Dreamy — chosen before the shot and **baked into
what gets stored**. Not stickers: dog ears and sparkles need a face-landmark model of
several megabytes shipped into the page and tracked per frame, which is a build in its own
right rather than a detail of this one.

Three things make them honest:

1. **One CSS filter string, two consumers.** The same value is the preview element's
   `filter` and the canvas context's `ctx.filter`. A second implementation for the baked
   copy is how a preview comes to lie about the result.
2. **The picker is hidden where the canvas cannot bake.** `ctx.filter` arrived late in
   Safari and is *silently ignored* where it is missing — so the preview would show a warm,
   faded photo and the stored one would come out untouched, and you would find out after the
   moment had passed. `canBakeFilters()` probes it, and where it fails there are no filters
   rather than fake ones.
3. **An unfiltered clip records the camera track directly.** Only a filtered one repaints
   through a canvas at 30fps, which on a phone is real work. The default costs nothing.

Vignette is the one grade that is not a `filter` function, so it is a radial gradient —
drawn onto the canvas after the frame, laid over the preview as an overlay. Two
implementations of one value, which is exactly what rule 1 warns about; it is accepted here
because there is no third option, and both live in `lib/journal-filters.ts` next to each
other rather than at opposite ends of the app.

### Photos live in Postgres — decided 2026-08-05

`JournalPhoto.data` is `BYTEA`. Chosen over a Railway volume and over S3/R2, and the
deciding argument is not cost.

**These are the one kind of row in this app that genuinely cannot be recreated.** Every
other table holds decisions, which can be re-made, or work, which can be re-typed. A photo
of her at four months cannot be. A volume is not in the database backup and an object store
is a second account that has to stay alive and paid; bytes in the DB are covered by whatever
covers the DB, and behave identically in local dev and on Railway.

The honest cost is size — roughly 300MB per thousand photos — and it was accepted knowing
the database is the expensive place to keep them. So the reversal is made cheap on purpose:

- **`lib/media-store.ts` is the only module that touches bytes.** Moving to R2 means adding
  a nullable `storageKey`, reimplementing three functions, and backfilling. Nothing else in
  the app reads `data`. (It was `lib/photo-store.ts` until clips arrived on 2026-08-06 — the
  seam held, which is what it was for.)
- **Every other query names its columns.** Postgres stores a column this size out-of-line,
  so one unqualified `findMany` on that table would drag every image into memory to render
  a list of thumbnails. This is a real footgun and the reason the model carries a comment.
- **The browser downscales before uploading** — 1600px on the long edge, JPEG at 0.82. A
  2400×1800 / 4MB source lands at 1600×1200 / 75KB, measured. This is not an optimisation:
  a server action's default body cap is 1MB, which one phone photo clears before the file
  has finished being read. `serverActions.bodySizeLimit` is 8MB for headroom and
  `MAX_PHOTO_BYTES` is 6MB, deliberately below it, so an oversized image gets a message
  rather than a truncated request.
- **The browser also measures the image**, and sends the dimensions along as `dim:<name>`.
  It has already decoded the file, so this is free — and the alternative is a native image
  library in the dependency list to learn two integers the client had in hand.
- **`/api/journal/media/[id]` re-checks the session.** A route handler is its own public
  endpoint, the same rule every server action follows. Without it this would be the one
  genuinely public thing in the app, and it would be pictures of a baby. The cache header
  is `private`, and `immutable` is honest: a photo row's bytes are written once, so editing
  means uploading another and deleting this one, which mints a new id.

### `ProjectDoc` became `Doc` — decided 2026-08-05

A doc now hangs off a Project **or** an Area, exactly one of the two. The Baby area needed
somewhere to keep a vision that isn't a backlog, and the alternative was a second, identical
`AreaDoc` model — two parallel doc systems, which is how one of them silently rots while
the other gets the improvements.

- **The migration is hand-written and every statement is a RENAME or an additive ALTER**,
  for the same reason `20260801120000_plain_names` is: `prisma migrate dev` diffs a model
  rename as a drop plus a create, which here would have taken the Coding Mom brief, the
  Forge vision and the Utaitai pricing note with it. Applied with `migrate deploy`, which
  runs the SQL as written rather than diffing. Backed up first to
  `backups/project-docs-pre-rename-2026-08-05.json`.
- **Both owner columns are nullable and exactly one is set.** Postgres cannot be asked for
  "exactly one of these" without a check constraint Prisma can't express, so it is enforced
  in `lib/doc-actions.ts` — as a **union type**, `{projectId} | {areaId}`, so "both" and
  "neither" are unspellable rather than merely rejected. That file is the only writer.
- **Two unique indexes**, `[projectId, slug]` and `[areaId, slug]`. NULLs are distinct in a
  Postgres unique index, so every project doc coexists with every area doc untouched.
- **An edit cannot re-own a doc.** `saveDoc` reads the owner only when creating, so a stray
  `areaId` posted alongside an `id` is inert rather than a silent move.

`ProjectDocs` → `DocsTab` and `ProjectTasks` → `TaskList` followed, both moved out of
`components/projects/`. Neither component changed except in what it is handed, which is the
argument for having generalised the model rather than duplicating it.

### The sprint rolls itself — added 2026-08-02, **removed 2026-08-04**

`ensureActiveSprint()` closed an expired sprint on render, handed its unfinished tasks back
to the backlog and opened a fresh Monday–Sunday week (extending through the following
Sunday if the rollover landed at a weekend, so as not to mint a one-day sprint). An empty
sprint arrived with eight pre-ticked suggestions.

All of it worked. It is gone with the sprint itself — nothing creates a sprint now, and
Today no longer calls anything on render except `ensureSeriesSlots`.

### The docs moved onto the project — decided 2026-08-02

`/docs` held `coding-mom.md` and `forge-vision.md` alongside the guides about the app
itself. Two problems: they were one folder away from the work they described, and editing
one meant a git commit — so the notes actually worth keeping, the ones thought of at 3am on
a phone, were never written anywhere.

`ProjectDoc` is a row with a Markdown body, edited from the project's Docs tab. The files
survive at **`prisma/docs/`** as *seed material* — how an empty database gets its first
copy — and `seedDocs` skips any that already exist, for the same reason `update: {}` exists
on the Project upsert: once a column is editable in the app, every value in it is a
decision, and a re-seed that reverted last night's writing is exactly what the move was
meant to end. `/docs` keeps the guides that are about the **app**.

Three smaller decisions:

1. **Markdown is ~170 hand-written lines, not react-markdown + remark-gfm +
   rehype-sanitize.** A project doc contains headings, lists, links, bold and the odd code
   span. There is **no HTML passthrough at all** — not because a stored-XSS route exists on
   a single-tenant app behind an allowlist, but because Phase 7's multi-user would open
   one, and a renderer that never had the feature cannot grow the hole.
2. **Docs are the one relation that cascades.** Everything else pointing at a Project is
   `SetNull`, which is right because a delete would orphan the work. A doc without its
   project isn't an orphan with a home elsewhere, it's a page about nothing — so it
   cascades, which means a delete would *erase* it, which is why docs now count among what
   blocks a delete.
3. **The roster card opens the project; the pencil opens the settings panel.** Tapping a
   card used to open the editor, so the first thing you ever saw of a project was a form
   asking what tier it was.

### Nothing but you creates a task — decided 2026-08-04

This is the third and last time this rule was arrived at, and stating it generally now:
**the seed creates structure, never work.** Areas, projects, brands, channels, series and
docs are scaffolding and are bootstrapped. Tasks, sprints and events are things you owe or
things that happened, and both are claims about your life that only you can make.

The cost of getting it wrong is asymmetric and that is the whole argument. A row you wrote
and no longer want costs one tap to delete. A row *you did not write* costs you a stop, a
re-read, and a decision about whether it was yours — before you are allowed to dismiss it.
Seventy-eight of those is not a full board, it is a board you stop opening.

It was worse than a one-off mistake because of how "A seed has to be able to grow" (below)
had been resolved. Matching on title made the seed additive, which was the right fix for
the stated problem and introduced a much worse one: **the seed could not tell "you never
had this" from "you had it and threw it away"**, so every deleted task came back on the
next `db:seed`. That is precisely why the board filled with work nobody remembered writing
and nobody could trace.

The three fixes, in order of how much they matter:

1. **`seedTasks` and the five `*_MARKS` arrays are deleted outright** — ~700 lines. Not
   guarded, not behind a flag: a landmine with a safety catch is still a landmine, and the
   rows survive in `backups/tasks-2026-08-04.json` and in git.
2. **`seedDrops` reverts to an all-or-nothing guard.** The idea bank seeds only into a brand
   that has none. The bank can no longer grow from this file, which is the honest price —
   a new idea gets typed into the Social Media board, which is where ideas are had anyway.
3. **The Series upsert stops reasserting `isActive`.** Switching Utaitai's dailies off is a
   decision made in the app, and a re-seed that flipped them back on would restart slot
   generation with no visible cause. Same rule as the Project upsert's `update: {}`.

`seedFirstSprint` and `reseatMarks` went with them.

### A seed has to be able to grow — decided 2026-08-02

Both `seedMarks` and `seedDrops` guarded on "does this project/brand have *any* rows",
which made them create-once-and-never-again: adding "Batch the Utaitai week" to a project
holding twenty tasks was a silent no-op, and so was adding three content ideas to a bank of
twenty-five. Both now skip **per title**. Completed rows count as present, so ticking one
doesn't bring it back; a *deleted* one does return on the next seed, which is the honest
cost of matching on title and is one tap to undo.

### Dates are a trap here

There are **two kinds of date column** and they take opposite handling. Every rule below
was learned by getting it wrong.

**`@db.Date` columns** (`slotDate`, `dueDate`, `startsOn`) — Prisma returns these as
**UTC midnight** standing in for a local calendar day:

1. Format them with `timeZone: "UTC"`, or west of Greenwich every date renders a day early.
2. Compare them against `todayKey()` from `lib/utils.ts`, never
   `new Date().toISOString().slice(0, 10)` — that's the UTC day, and it puts the "today"
   marker on the wrong row for part of every day.

**Real timestamps** (`publishAt`, `publishedAt`, `lastTouchedAt`) — ordinary instants,
formatted and compared in **local** time. `getGoingOutToday` builds a local
midnight-to-midnight window; do not reach for `dateKey` there.

**The third case (Phase 4):** a **local day key**, `localDayKey()` in `lib/utils.ts`, which
is what `todayKey()` now calls. It is how a real timestamp gets reduced to the calendar day
it falls on. When such a key is turned back into a `Date` for formatting it becomes UTC
midnight, so it formats with `timeZone: "UTC"` — the same rule as a `@db.Date`, for the
same reason. `app/(app)/calendar/page.tsx` does this for every label it renders.

**Where the two meet:** `slotPublishAt` combines a `slotDate` with `Series.timeOfDay` to
produce a `publishAt`. Both inputs mean *local*, so the result must be built with the local
`new Date(y, m, d, h, min)` constructor. Using `setUTCHours` — which is what it did
originally — shifts every publish time by the machine's offset.

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

- [x] **Information architecture** — resolved 2026-07-30. Area › Project › Task, with Content item
      as its own entity, and five fixed nav surfaces. See §6.
- [x] **Areas vs Calendars** — resolved: **unified.** Area *is* the calendar grouping; there
      is no separate Calendar entity. Events carry an `areaId` and inherit its colour.
- [x] **Task flavor** — resolved: themed. Tasks are **Tasks**, content units are **Content items**.
      Keep UI labels readable; flavor lives in headings, not in form fields.
- [x] **Visual design** — resolved 2026-07-30 from a Dribbble reference (a warm, light CRM
      dashboard). Translated into `app/globals.css`: warm greige canvas, floating white
      cards on a rounded panel, very large radii, near-invisible shadows, separation by
      background contrast rather than borders, and a single crimson accent (`#de1f4c`)
      that doubles as the moogle's pom-pom. Motion tokens followed on the same day — see
      §10. ~~**Light mode only**~~ — **resolved 2026-08-06: there is a dark theme**, and
      the design pass it was said to need turned out to be one decision (invert the
      elevation ladder) plus a second set of values for the same token names. See §11.
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
- [x] **Calendar library** — resolved 2026-08-01: **neither. Hand-built.** Month is a
      7-column CSS grid of tiles; week and day are an hour grid with absolutely positioned
      blocks and a first-fit lane packer for overlaps. Both libraries bring their own DOM
      and their own stylesheet, and this design (borderless, 1.5rem radii, tiles on a
      tinted ground, token-driven motion) is precisely the kind that gets fought rather
      than configured — the same argument that deferred shadcn in Phase 1, and the reason
      the grid could adopt `animate-rise`, the crimson today-pill and the accent now-line
      without a single override. ~600 lines, no new dependencies. The cost is that
      drag-to-move doesn't come for free; see Phase 4's open box.
- [ ] Notifications channel (push vs email) — Phase 7

---

## 9. Working Conventions

- **Layer by layer.** Don't scaffold Phase 3 before Phase 1 is real and deployed.
- **Keep this doc current.** When a decision is made or a feature ships, update the
  relevant section and check the box.
- **Small, useful increments.** Prefer something I can log into and use this week over a
  perfect architecture I can't see yet.
- **Design comes from Dribbble refs.** When a design is chosen, content item the reference link(s)
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
  - Shadows are near-invisible — depth comes from the layering, not from content item shadows.
  - Crimson `#de1f4c` is the *single* accent: one emphasis per region (active nav item, the
    primary action, one highlighted metric). A screen with crimson everywhere is wrong.
  - Black is used sparingly as a second emphasis — the selected pill, one hero tile.
    **The budget is one black element per screen.** On Today it is the "Ticked off today"
    tile (it was the sprint tile until 2026-08-04 — the hero slot changed hands but not
    size). On a project page it is the "Open" tile. The Hunt Board's went with the sprint
    bar, which is why its experiment-capture box stays `bg-inset` rather than reclaiming
    obsidian. The selected scope pill and the active project tab are the exceptions — a
    segmented control needs a filled state, and both are small enough not to compete.
  - Dense, calm typography: small muted labels above large confident numbers/titles.
  - Iconography and avatars are small, round, and inline with text — never decorative.

  If a new surface needs a pattern the reference doesn't show, extend it in the reference's
  spirit and note the new pattern in §8 so the next feature inherits it.

- **Hover is not an affordance on a phone.** A control revealed by `group-hover` doesn't
  exist on touch. Write it `sm:opacity-0 sm:group-hover:opacity-100` — visible outright on
  small screens, revealed on hover on a pointer device. The add-to-sprint buttons on the
  Hunt Board and in "Next up" are the reference implementations.

- **A grid column that has to stay in its lane needs `minmax(0, 1fr)`, not `1fr`.**
  `1fr` is really `minmax(auto, 1fr)`, so a track whose content has a large min-content
  width simply grows past its share and shoves every other column along. The week view's
  all-day band did exactly this: a long task title made Saturday's cell overlap Sunday, and
  the items looked like they were landing on the wrong days when the *data* was right and
  only the layout was wrong. Tailwind's `grid-cols-*` already emits `minmax(0, 1fr)` — this
  only bites where the template is written by hand in a `style` prop, as it must be when
  the column count is dynamic. Found on 2026-08-01.

- **A migration checksum is a hash of bytes, so a line ending is a content change.**
  Prisma records a SHA-256 of each `migration.sql` when it applies it and re-checks it on
  every `migrate dev`. This machine has `core.autocrlf=true`, so migrations written on the
  Mac (LF, hashed as LF) get checked out here as CRLF — and Prisma reports them as
  "modified after it was applied" and offers to **reset the database**, which on a database
  holding real work is the most destructive button in the toolchain, offered for a bug that
  is entirely cosmetic. Found 2026-08-05 with five mismatches; four were pure line endings
  and normalising them back to LF made all four match byte for byte. **`.gitattributes` now
  pins `*.sql` and `*.prisma` to `eol=lf`**, which is the actual fix. If it happens again:
  hash the file, hash it again with `\r\n` replaced by `\n`, and if the second matches the
  recorded checksum it is this and nothing is wrong with the SQL. **Never take the reset.**

  The fifth, `20260801183000_docs`, was the one reconstructed from the live schema on
  2026-08-04 — its file never matched what was applied, and the honest fix there is to
  repoint the recorded checksum at the file, because the file is the deliberate rebuild and
  the database already reflects it.

- **A browser capability is an external store, not a `useState` you fill in an effect.**
  `canvas.getContext("2d").filter` support and `MediaRecorder`'s existence are facts about
  the browser that decide whether a control renders at all — and the obvious shape,
  `useState(false)` plus a `useEffect` that sets it, is rejected by the React Compiler's
  lint for calling `setState` synchronously in an effect. That is a correct diagnosis rather
  than a nuisance, and it is the same one §11 records for the theme clock: read it through
  `useSyncExternalStore` with a no-op `subscribe` (the answer cannot change while the page is
  open) and a `getServerSnapshot` of `false`, so the server renders the control absent and
  hydration matches. The probe must also **cache**, because `getSnapshot` runs on every
  render and allocating a canvas to re-answer a fixed question is silly. Do not cache the
  server's `false` — that is a fact about there being no `document`, not about the browser.
  Found 2026-08-06 in `components/areas/camera-sheet.tsx`.

  The same lint flags **`Date.now()` called from a function declared in a component body**,
  even when every caller is an event handler — it cannot tell. Wrap it in a module-level
  `now()`; the wrapper is the whole fix.

- **A popup inside an `animate-rise` section must open upward, or be portalled.**
  `animate-rise` ends on `transform: translateY(0)` under `animation-fill-mode: both`, so
  every element carrying it **permanently has a transform** — and a transform makes a
  stacking context. A dropdown opened *downward* out of one section is therefore painted
  over by the **next** section, whatever z-index it is given, because the two sections are
  siblings and the later one wins. The journal's media menu hit this: it rendered, and the
  next day's card sliced it off mid-item, so it read as an overflow bug. This is the same
  mechanism §6 records for the media viewer, which needs a portal because it is `fixed`;
  a two-item menu does not — **opening upward keeps it inside its own section**, and costs
  no portal and no position maths. Found 2026-08-07.

- **A shared class string must not bake in a width, because you cannot override it later.**
  Two Tailwind utilities for the same property have equal specificity, so the winner is
  whichever one the compiled stylesheet defines *last* — not the one written last in your
  `className`. `` `${field} w-auto` `` where `field` starts `w-full` therefore stays 100%
  wide, silently. In a `flex-wrap` row that is worse than it sounds: a `width: 100%` child
  takes a whole line whatever its `basis` says, so `basis-full sm:basis-auto` never gets to
  do anything and the "beside it from `sm` up" layout never happens at any width. The
  journal composer had this on both its date and headline inputs from the day it was
  written, and it read as a design choice rather than a bug — the cancel × ended up alone on
  a third row. Found 2026-08-06. The fix is a `fieldBase` with no width and a
  `field = \`w-full ${fieldBase}\`` for the callers that want one.

- **`lib/markdown.ts` now consumes continuation lines**, in both list runs and blockquotes.
  It used to break a bullet run at the first line that wasn't a bullet, so a wrapped list
  item rendered as a list of one plus a stray paragraph — the bug this file had been
  carrying against `forge-vision.md` since 2026-08-03, where "Comfortable, affordable baby
  breathing tracker" and "foot sock." were two different blocks. Blockquotes had the same
  bug twice over: one block per *line*, and a bare `>` between two quoted paragraphs
  rendered as a paragraph containing the character `>`, because the test was `"> "` with a
  trailing space. Both now gather their whole run first and parse after. `opensBlock()` is
  what tells a wrapped line from the start of something new; a blank line always ends a run.

  **Tables are still not supported** and render as raw pipes. `forge-vision.md` has two.

- **Emphasis does not nest, so never put markup inside `**bold**`.** Found 2026-08-05 while
  writing the Coding Mom doc. `Inline` is a flat union — `bold`, `italic`, `code` and `link`
  each carry a plain `text: string`, with no children — so `parseInline` matches the *outer*
  run and emits everything inside it as literal characters. `**\`side\`**` renders with the
  backticks showing, and `**…[Forge](./forge-vision.md) launches into**` renders the entire
  link syntax on screen. Write the emphasis and the markup as siblings instead.

  It is a *writing* rule rather than a bug to fix: nesting would mean making `Inline`
  recursive and re-entering `parseInline` per span, which is a real parser for a problem
  that a different sentence solves. The five docs written before this one had no instances,
  so it has never actually bitten in a year of prose — the check is one pass looking for a
  bold or italic whose text still contains a backtick, a `[…](`, or a `*`.

  Nothing else in the renderer is known to be wrong.

- **Don't put a JSX expression next to text containing an HTML entity.**
  `{open ? "Hide" : "Show"} what&apos;s next` splits into different text nodes on the
  server and the client, and React reports a hydration mismatch. Put the whole thing in one
  expression — `` {`${open ? "Hide" : "Show"} what’s next`} `` — with a real character
  instead of the entity. Cost half an hour on 2026-07-31.

- **User docs live in `/docs`.** Guides written for *me reading later*, not for agents:
  - `docs/studio-guide.md` — how to use the Studio (brands, channels, content items, series,
    the board, repurposing). Written 2026-07-30. Update it when Studio behaviour changes.
  - `docs/today.md` — the project cards, the focus line, the contribution map, and why
    the sprint went. Written 2026-08-04, replacing `sprints.md`. Update it when Today
    changes.
  - `docs/projects.md` — project pages, the four tabs, and where docs live now.
    Written 2026-08-02.
  - `docs/calendar.md` — the three things that can go on the grid and how they differ,
    why only events show by default, getting around the views, and repeating events.
    Written 2026-08-01, updated 2026-08-05.
  - `docs/areas.md` — the area page, the journal, how photos work and where they live,
    and why the Baby area has no projects. Written 2026-08-05.
  - `docs/theme.md` — the Light · Auto · Dark control, why the browser asks for your
    location, and why it doesn't follow the OS setting. Written 2026-08-06.
  **Project docs are no longer here.** The Coding Mom brief, the Forge vision and the
  Utaitai pricing note live on their projects' **Docs tabs** in the app, and their
  source files sit in `prisma/docs/` as seed material only. See §6, "The docs moved onto
  the project" — and edit them in the app, not in the file.
  `prisma/docs/multilingual-baby.md` is the exception: its project was removed on
  2026-08-04, so the file is the only copy and the seed no longer points at it.

---

## 10. Motion

**Established 2026-07-30.** Motion is part of the design system, not decoration sprinkled
per-component. Everything below is defined once in `app/globals.css` under `@theme`; a new
surface uses these tokens and adds nothing of its own without a note here.

### Tokens

| Token | Value | Use |
|---|---|---|
| `--ease-soft` | `cubic-bezier(0.22, 1, 0.36, 1)` | Everything entering or settling. Decelerating, no overshoot. |
| `--ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Things leaving. Accelerates away. |
| `--duration-quick` | `120ms` | Colour, opacity, hover. |
| `--duration-base` | `200ms` | Transforms, small elements. |
| `--duration-slow` | `320ms` | Panels, whole-surface entrances. |

Named animations: `animate-rise` (fade + 8px up — cards, columns, rows arriving),
`animate-panel-in` / `animate-panel-out` (side panel slide), `animate-scrim-in` /
`animate-scrim-out` (overlay fade), `animate-pop` (a scale-in confirmation).

> **Tailwind v4 gotcha:** `--ease-*` and `--animate-*` are real theme namespaces and give
> you `ease-soft` / `animate-rise` for free. **`--duration-*` is not.** Write the duration
> as the CSS-variable shorthand — `duration-(--duration-base)` — or the class silently
> generates nothing. It compiles fine and looks right in the source; only the built CSS
> shows it missing.

### Rules

- **Reference the tokens, never raw ms or a bare `transition-all`.** Name the properties:
  `transition-[background-color,transform]`. Animating `all` fights layout.
- **Motion travels 8px or less.** The reference gets depth from layering, not from things
  flying in. A 1px hover lift plus `shadow-card` is the whole vocabulary for "raised".
- **Enter animations are staggered, ~35–45ms apart**, in reading order — columns left to
  right, cards top to bottom. The board should assemble, not blink into place.
- **Stagger via inline `animationDelay`**, and let React's keys do the work: keyed on a
  stable id, an animation replays only on a genuine mount (filtering, arriving in a new
  column), not on every re-render.
- **Anything that closes must animate out.** Hold a `closing` state, run the exit
  animation, unmount in `onAnimationEnd` — guarded with
  `event.target === event.currentTarget` so bubbling child animations don't fire it early.
  `ContentPanel` is the reference implementation.
- **A row a server action removes folds out.** Ticking a Task done removes the row, but
  what removes it is the revalidated data arriving — so without this it just blinks out
  of existence. Wrap the row in a `grid` whose `grid-template-rows` transitions
  `1fr → 0fr` (with the row itself in an `overflow-hidden` child) and **derive** the
  collapsed state from the action's `isPending` rather than holding it in state: a failed
  action then simply unfolds the row instead of leaving a blank gap. A ~140ms
  `transition-delay` lets the tick's `animate-pop` be seen before the fold starts.
  `TaskRow` on the Hunt Board is the reference implementation.
  Keyframes cannot do this job: `animation-fill-mode: both` pins the final opacity and
  beats any transition on the same element, so the fold and the `animate-rise` entrance
  must live on **different** elements.
- **Pending server actions recede** (`opacity-45` + `pointer-events-none`) rather than
  freezing, so a wait reads as progress.
- **Press feedback is `active:scale-[0.97]`** on buttons and chips (`0.985` on large
  cards). Small enough to feel, too small to notice.
- **`animate-pop` is the only attention-grabbing motion.** Reserve it for a thing that just
  became true — ticking a channel as posted. If it's on more than one element per surface,
  it's being overused.
- **Reduced motion is already handled globally** at the bottom of `globals.css` (all
  durations collapse to 0.01ms, which still fires `animationend`, so exit-then-unmount
  keeps working). Don't add per-component `prefers-reduced-motion` checks.

---

## 11. Themes

**Established 2026-08-06.** There are two themes, and they share one set of token *names*.
A surface written against the tokens gets the dark theme for free; a surface that reaches
for a hex does not.

### The whole thing is a second column of values

`:root[data-theme="dark"]` in `globals.css` restates the colour tokens and nothing else.
Not one component was restyled, because the app was already painted entirely through
`bg-card` / `text-ink` / `bg-obsidian` — an audit before starting found **zero** uses of
`bg-white`, zero Tailwind palette colours, and sixteen hex literals, all of them either
brand logos or `lib/platforms.ts` platform colours, which are supposed to be fixed.

That is the reason this cost a day rather than a fortnight, and it is worth protecting:
**a hardcoded colour is now a bug in two themes rather than a shortcut in one.**

### The elevation ladder inverts — this is the one design decision

In the light theme importance climbs toward white: canvas is the darkest thing, cards are
white tiles floating on a tinted stage, and a hero tile is black. The obvious way to build
a dark theme is to swap in dark greys, and it fails, because it leaves the ladder pointing
the wrong way — the hero tile stops being the most emphatic thing on screen and becomes a
**hole** in the page.

So here the ladder climbs toward light. Canvas is darkest (`#100e0d`), cards sit above the
stage, and **`--color-obsidian` is the lightest surface in the theme** (`#453e39`). White
text on it still clears 10:1, which is why all 47 `text-white` usages needed no change at
all: the token that means "highest emphasis" still means that, it just gets there from the
other direction.

Two other things are deliberately kept:

- **The warmth.** Every neutral still carries red and drops blue. Cooling them to slate
  would abandon the greige character the whole reference is built on, and the crimson
  accent would start to read as an error state sitting on it.
- **The accent's job.** Crimson is lifted to `#e8375d` — not for taste, but because
  crimson's luminance is dominated by its red channel, so there is no version of it that is
  comfortably legible *both* as a background under white text and as text on the stage.
  `#e8375d` sits at the balance point, about 4.1:1 each way, rather than favouring one.

### `--color-scrim` is its own token now

The panel dimmer was written `bg-obsidian/25` in five places, and that only ever worked
because obsidian *happened* to be near-black. The moment a hero tile has to become the
lightest surface, a scrim borrowing it would **brighten the page it exists to dim**.

Two different jobs that shared a value, which is exactly the kind of coincidence a second
theme finds. The token carries its own alpha (`rgba(...)` rather than a `/25` at the call
site) because the dark theme also wants a *heavier* dim: there is less contrast between a
panel and its backdrop to begin with.

The same audit caught one genuine regression — Studio's "All brands" chip passed
`dot="#14110f"`, a near-black dot that reads correctly on a white chip and disappears on a
dark one. It is `var(--color-ink)` now, which is what it always meant.

### The shadow tint is a nested variable, on purpose

Tailwind resolves `--shadow-*` at build time and inlines the geometry, so overriding
`--shadow-card` in a theme block does nothing. But it keeps any `var()` *inside* the value
as a runtime reference — the compiled rule is
`--tw-shadow: 0 1px 2px var(--tw-shadow-color, var(--tint-shadow))`. So the tint lives in
its own variable and the theme restates that. A shadow tuned to be invisible on warm greige
is *entirely* invisible on near-black, and depth in the dark theme needs a heavier hand.

### Sunset and sunrise, not `prefers-color-scheme`

`auto` is the default and it follows the sun, computed by `lib/sun.ts` — the NOAA solar
equations, about forty lines, no dependency. **Following the sun and following the OS are
different answers**, and the OS one was not what was asked for; wiring both would need a
fourth mode to choose between them, which is a control for a decision nobody has.

Fixed clock hours were the cheap alternative and they are wrong by a lot: Los Angeles
sunset moves from **16:57 in January to 20:07 at the solstice**. A dashboard that stays
light until 19:00 spends most of a winter evening glowing.

Four things fell out:

1. **Day arithmetic happens in UTC days and epoch milliseconds**, same as
   `lib/calendar-keys.ts` and for the same reason — UTC has no DST, so a day is always
   86,400,000 ms. Three UTC days of crossings are collected and sorted, and "which was most
   recent" answers it, because a *local* evening straddles a UTC midnight west of
   Greenwich. There is no timezone reasoning to get wrong, only a sorted list of instants.
2. **The polar cases are handled rather than crashed on.** Inside the arctic circle there
   are days with no crossing at all; the state is then whichever extreme applies and the
   next check is in an hour. Verified at Longyearbyen in midnight sun.
3. **Location is asked for once and a refusal is remembered.** The fallback is Los Angeles,
   matching the `TZ` the deployed app is meant to run on. Sunset moves four minutes per
   degree of longitude, so a whole timezone out is under an hour wrong — the correct amount
   of wrong for a fallback, and far cheaper than a dashboard opened twenty times a day
   asking twenty times a day.
4. **Only `auto` asks.** A pinned light or dark theme has no use for sun times, so there is
   no honest reason to request a location to compute them from.

### The theme is not a database column

It lives in localStorage. A theme is a property of **the screen you are looking at**, not
of you: a phone at 9pm and a desktop at 9am want different answers from the same account.
Storing it on a `User` row would also mean inventing that row, which §6 has deliberately
not done yet.

The consequence is accepted rather than worked around: a new browser starts at `auto`,
which is the right default anyway.

### The boot script carries no arithmetic

Without a pre-paint script the page renders light, hydrates, and *then* flips — a white
flash on every navigation at night, which is worse than having no dark theme. So
`THEME_BOOT_SCRIPT` runs inline in `<head>`, before the body is parsed.

It deliberately does **not** re-run the solar equations. Re-deriving, in a render-blocking
script on every page load, an answer that has not changed since the last page load is work
for nothing. Instead the provider leaves behind the answer *and the instant it stops being
true*, and the script only reads a clock: before that instant the stored answer holds; just
past it the crossings alternate, so flip once; long past it, guess by the hour and let the
provider correct it a frame later.

**`<html>` carries `suppressHydrationWarning`, and it is load-bearing.** The script writes
two attributes the server's markup does not have, and React diffs every attribute of an
element it renders. The escape hatch applies one level deep, so it covers exactly this
element and nothing inside the app. Rendering the theme server-side is not an alternative:
the server does not know what time it is where you are, which is the entire problem.

### The clock is an external store, so it is an external store

`lib/theme-store.ts` is read through `useSyncExternalStore`. The three things that decide
the theme — localStorage, the system clock, geolocation — are all genuinely outside React,
and the first attempt at this as `useState` + `useEffect` was rejected by the React
Compiler's lint for calling `setState` synchronously in an effect. That was a correct
diagnosis rather than a nuisance: the store computes and components subscribe.

Three rules inside it:

1. **Storage is the single source of truth, re-read on every recompute.** Caching `coords`
   in a module variable and filling it once meant the hourly heartbeat, the focus listener
   and the cross-tab `storage` event all silently reused whatever the first render found —
   so a location granted in one tab never reached another. Found by testing four cities at
   one instant and getting four identical answers.
2. **The snapshot is compared field by field before publishing.** `useSyncExternalStore`
   compares by reference and will loop forever if handed a fresh object every read, and the
   heartbeat calls this on a quiet afternoon where it must be a no-op.
3. **Never sleep more than an hour at a stretch.** A twelve-hour timer set at breakfast is
   not a promise anyone keeps — laptops suspend, and browsers throttle `setTimeout` hard in
   hidden tabs. The heartbeat re-derives the answer from the clock instead of trusting a
   timer to have fired; `visibilitychange` and `focus` cover the rest.

---

## Environment notes

- **Now on macOS**, at `/Users/hcb3o/startups/personal-assistant` (Node v20.20.2, TZ
  `America/Los_Angeles`). Phase 4 was built and verified here. The Windows notes below are
  kept because that machine still exists, but they are no longer where the work happens.
  - _Windows:_ **as of 2026-08-04 this is where the work is happening again, and it
    runs.** `C:` now has **104 GB free**, so the "0 bytes free / `next dev` dies
    allocating memory" note below is stale — Phase 4.6 was built and verified in a
    signed-in browser here. Project lives on `D:\personal assistant dashboard`, npm cache redirected to
    `D:\npm-cache` because the `C:` system drive kept filling. If npm errors with `ENOSPC`
    or Node throws "heap out of memory" there, check free space on `C:` first — a full
    system drive breaks the pagefile. Measured 2026-07-31 at **100% (69 MB free)**.
    **Re-measured 2026-08-03: 100%, `0` bytes free — and it is now blocking.** `next dev`
    dies on startup with "Fatal process out of memory: Zone" before serving a request, so
    the Windows machine currently cannot run the app at all. Short scripts (`tsx`, a
    Prisma query) still work, which is why the 2026-08-03 calendar change could be
    verified against the database but not in a browser. `D:` has 114 GB free; the fix is
    clearing `C:`, not moving anything.
- **The dev server can serve stale CSS while its JS is current, and it looks exactly like a
  broken class.** Found 2026-08-07: a new `bottom-full` was in the DOM's `className` and had
  no effect, and the *removed* `top-full` still worked — which is the tell. Turbopack had
  updated the JS chunk and not regenerated the stylesheet, so the browser was one edit behind
  on CSS only. Touching `globals.css` and touching the component both failed to shake it
  loose. **The decisive check is `npx next build` and a grep of the emitted CSS**
  (`.next/static/chunks/*.css`) for the escaped class — `grep -F '.bottom-full{'` — which
  answers "is this utility real" independently of the dev server. Use `-F`: Tailwind escapes
  `:` `[` `/` `.` with backslashes, and a regex without it silently matches nothing and reads
  as a missing class. A production `next start` on another port is the way to *see* the fix
  without restarting the dev server. Same family as the `animationend` note in the 4.17 log:
  the harness's own state can look exactly like a bug in the code.

- **The app assumes the server's local time is *my* local time**, and Phase 4 makes that
  assumption load-bearing rather than theoretical. Every "today", every publish window and
  the whole calendar grid is computed server-side with `new Date()` and the local-time
  constructor. Railway containers run **UTC**, so deployed, the calendar is currently
  7–8 hours ahead of the person reading it: an 18:00 content item lands on the wrong row, and after
  17:00 local "today" is tomorrow. **Fix: set `TZ=America/Los_Angeles` in the Railway
  service's variables.** One line, and it makes the deployed app agree with every rule in
  §6. The proper fix — storing a preferred timezone and formatting against it — only earns
  its keep if this ever becomes multi-user or I move.
- **Prisma is pinned to 6.x, and the reason has expired.** The pin exists because Prisma 7
  refuses to install below Node 20.19 and the Windows machine was on 20.15.1. This Mac runs
  **20.20.2**, which clears it — so on this machine the 6→7 bump is now just a version
  change, and the schema is small enough that it should be a non-event. Left pinned rather
  than bumped mid-phase; do it as its own change. The Windows machine still needs
  `winget install OpenJS.NodeJS.LTS` first.
- **Next.js 16 / React 19.** This is a recent major — APIs and conventions may differ from
  older Next.js knowledge. Version-specific docs are bundled at
  `node_modules/next/dist/docs/`; the scaffold's `AGENTS.md` reminds agents to consult them
  before writing framework code. Read the relevant guide there when unsure.

---

_Last updated: 2026-08-07 · Status: **Phase 4.19 — a brand can be the work of a project.**_

_**2026-08-07 — "there are 3 items under Coding Mom and a bunch more in Studio, I'm
confused."** Both numbers were right. Studio filters by **brand** and a project page filtered
by **project**, and "Coding Mom" is both — a Brand (the voice) and a Project (the work of
building its audience). The 31 items carrying that brand split 20 / 5 / 3 / 2 / 1 across no
project, Forge, Coding Mom, Sleepy Cat and Utaitai, and the page was showing the 3._

_**The two axes were not the flaw; the missing relationship between them was.** Brand and
Project only ever met on an individual item, so nothing recorded that Sleepy Cat *the
project* runs Sleepy Cat *the brand*. Three of four projects run an account and the app could
not say so — which is why **Sleepy Cat's page never mentioned its seven @sleepycatgame
accounts**, on the page about the tasks to create them. One nullable `Brand.projectId` closes
it._

_**A project's Social media tab now asks two questions.** "Posted as X" is what its own
accounts publish; "Covered elsewhere" is what other people's accounts say about it. They
partition the rows exactly — Coding Mom 31 · 0, Sleepy Cat 0 · 2, Forge 0 · 5. That is what
makes the 20 brand-only items stop reading as an omission: they are about no project, and
publishing them is nonetheless the **entire job** of the Coding Mom project._

_**It is a default and never a constraint**, which was the explicit ask — whether Sleepy Cat
gets posted under Coding Mom is undecided, so it stays an item-by-item question. The composer
fills the project in from the brand and **stops following the moment you pick one yourself**;
an existing item never moves on its own. Without that second rule, opening any of the 20
loose items and saving would have quietly filed it under Coding Mom, which is the one way
this change could have destroyed data. **Merging Brand into Project** was the tempting
simplification and it breaks 27 of the 31: Forge runs no account and has the most coverage of
any project, which is the axes being real rather than redundant._

_Verified in a signed-in browser, dark theme. All four project pages read the counts the
database says (partitions confirmed exact and disjoint by script first). Opened a new item
and watched Project arrive pre-filled as Utaitai, switched the brand to Sleepy Cat and
watched Project follow, then set Project to "None" by hand, switched the brand back, and
watched it **stay** None. Opened the existing brand-only "The five baby purchases…", confirmed
it read None rather than Coding Mom, saved it unchanged, and confirmed in the database that
`projectId` was still `null` with 20 brand-only and 31 total items — unmoved. Round-tripped
the new picker: unlinked Sleepy Cat, watched its page fall back to "runs no account of its
own" with its two Coding Mom posts untouched, and relinked it. A full `db:seed` left every
link and count alone. `npx next build`, `tsc --noEmit` and `eslint` all pass; console clean._

_Outstanding from this change: **nothing links a channel to the tasks about creating it** —
Sleepy Cat has seven `planned` accounts and setup rows for them, connected only by reading
both, which is the same gap as the Next Fest track having no link to its event. **Forge's
borrowing of Coding Mom's audience is deliberately not modelled**: it is expressed per item
and the handoff is two tasks, and a `Project.audienceBrandId` would be a third place for the
same fact to disagree. **And the phone layout still has not been looked at on a real
device.**_

---

_Previously: **Phase 4.18 — a task opens where you are reading it.**_

_**2026-08-07 — four asks, and the first two turned out to be one.** Today showed a task's
title, its track, its due date and its checklist, and the only thing you could do to it was
tick it; changing anything else meant a trip to the Hunt Board to find the same row among a
hundred and ninety. A project's Overview had the same hole one surface over — "Next up"
answered *what is next* and then sent you to the Tasks tab to act on it. **A task row you can
read is a task row you should be able to open**, and it is the detour the Projects roster
died of, one noun down._

_The fix needed no new pattern, because the app already had it: a project card carries
`edit: ProjectEditView` so the pencil opens the panel with no round trip. A task line now
carries `edit: TaskView` for the same reason and the same price — **four more columns on a
query that was already running.** The title is the hit target and only the title; the tick,
the play toggle and the link all already do something, and a whole-row click would swallow
whichever one you meant. Overview stays read-only apart from opening, because it is a summary
of the Tasks tab and the full row controls would make it a second, worse copy of one._

_**The Tasks tab could not say how anything was moving.** A project with forty rows and three
in flight rendered identically to one with forty and none — `doing` was a small amber word on
one line, `done` was behind a button. So: **three stage columns**, and a Stages / Tracks
control between them. **Stages lead and tracks are not demoted** — they answer genuinely
different questions (how is this moving, versus what kind of work is left), and nothing is
lost by choosing the columns because **each column is cut into track runs**. **Arrows move a
card and the tick still finishes it**: replacing the tick would make the commonest move — To
do straight to Done — two presses, and put a different control where every other surface puts
the same one. **Each column shows twelve and offers the rest**, because Sleepy Cat is 88 · 0 · 1
and an uncapped board is a page 88 cards tall with two empty columns beside it._

_**The journal's two media buttons became one dropdown, and the camera goes full screen on a
phone.** A viewfinder in a card is a viewfinder occupying a third of a screen you are holding
up at a baby — this is the one surface here where the content genuinely wants the whole
viewport, and every native camera agrees. Below `sm` it is full-bleed with the controls over
`env(safe-area-inset-bottom)`; from `sm` up it is the card it was._

_**One real bug found by looking, and its cause is now a §9 rule.** The media dropdown opened
downward and the *next day's card sliced it off mid-item*, which reads as an overflow bug and
is not one: `animate-rise` ends under `fill-mode: both`, so every day section permanently
carries a transform, and a transform makes a stacking context — a later sibling section wins
over any z-index inside an earlier one. Same mechanism the media viewer portals around in
4.17. A two-item menu does not need a portal: **opening upward keeps it inside its own
section**._

_**And one non-bug that cost more time than the bug.** The upward fix appeared not to work —
the new `bottom-full` was in the DOM's `className` and did nothing, while the `top-full` I had
just deleted still worked. That combination is the tell: **Turbopack had updated the JS chunk
and not regenerated the stylesheet**, so the browser was one edit behind on CSS only. Touching
`globals.css` and touching the component both failed to shake it loose. `npx next build` plus
a `grep -F` of the emitted CSS settled it in one step — `.bottom-full{bottom:100%}`, present,
and `top-full` gone — and a production `next start` on port 3100 was where the fix was actually
seen. §9 and Environment notes both record it, including that the grep must be `-F`, since
Tailwind escapes `:` `[` `/` `.` and a regex without it silently matches nothing and reads as a
missing class._

_Verified in a signed-in browser, on the production build. Opened a Today row and confirmed
the panel arrives fully populated — project, track, due date, status, notes, the Steps editor
— then saved it unchanged and confirmed the row came back identical (still overdue, Setup,
6 Aug, still under Sleepy Cat) with the Overdue tile unmoved, which is the test that matters:
a missing column would have blanked one. Opened a "Next up" row on Sleepy Cat's Overview and
got the same panel. On the Tasks tab, read the columns at 88 · 0 · 1, moved "Create the X
account" To do → Doing with the arrow and watched the counts go 87 · 1, moved it back and
watched them return to 88 · 0 with the card in its original position. Confirmed the Tracks
view is unchanged and its "Show 1 done" only appears there. In the journal, confirmed the
menu now opens **above** the button with a 6px gap and both items whole. `npx next build`,
`tsc --noEmit` and `eslint` all pass._

_**Corrected hours later, and the fix is the more interesting half.** The first version of
the columns put a track chip on every card, which read as obviously right and was wrong twice
in the same place: Forge's To do column opened with **"Setup" four times running, each on a
line of its own beneath the title**, so the chip repeated itself *and* doubled the height of
every card — thirty-one cards in the room of sixty-two. **The track belongs to the run, not
to the card.** It is a sticky heading now, said once, which also recovers the one thing the
chip was genuinely better at: knowing which workstream you are in thirty rows down. And with
the track gone from the card, what was left — a repeat badge, a due date, a link — fits on the
title's row, which is what makes an ordinary card **one line** rather than merely shorter. Two
things only scrolling could have found: a flex `gap` under a pinned heading is transparent, so
a card slides visibly through it (the heading's own padding has to do that job), and the
busiest row in the app — `Wed & Sun`, `9 Aug`, a link — had to be checked for wrapping before
this was safe. `groupByTrack` is shared with the Tracks view so the two cannot disagree about
track order._

_**And the column scrollbar went, which was the second thing shipped wrong.** Bounding a
kanban column with `max-h` and `overflow-y-auto` is the reflex, and it fails here twice: it
puts a grey bar down the busiest column in **a design whose entire vocabulary is
near-invisible chrome** (§9), and it makes the wheel mean two different things depending on
where the pointer is — a column that has reached its own bottom *swallows* the scroll instead
of passing it to the page, which I hit while verifying and briefly mistook for the board being
stuck. **Twelve cards and a "N more →"** removes both, and it is not a new pattern: it is what
the Done column was already doing, now applied to all three with one number instead of a queue
rule and a record rule. Expanding is **per column**, so unfurling To do does not also unfurl
eighty finished rows. **The run headings stopped being sticky** with it — sticky was only ever
justified by a long scroll inside the column, and without one it would have pinned itself
against the page instead, leaving three headings floating over the board. Confirmed after: the
only scroll region left on the page is the app shell's own `<main>`._

_Outstanding from this change: **no drag-and-drop between columns** — HTML5 DnD does not work
on touch, so it would be a desktop-only half of a feature beside arrows that already work
everywhere. **The camera's full-screen layout has not been seen at a phone width**:
`resize_window` still reports success while the renderer stays at 2560px, so what was checked
is that every `sm:` class compiles and sits behind `min-width: 40rem` — reasoning plus a grep,
not a look. **The dev server on :3000 is still serving the stale stylesheet** and wants a
restart before the journal menu looks right there. And **no frame has still ever been captured
by the camera**, unchanged since 4.16._

---

_Previously: **Phase 4.17 — a day is a thread.**_

_**2026-08-06 — the journal grouped by day this morning and still looked like a filing
cabinet.** Three asks, and the first one names the problem exactly: a "+" for today, because
one day has several entries and **they should look connected, like a flow of thoughts**. The
grouping shipped in 4.15 was right and the shape was still the old one — each entry a
floating white card identical to every other, so two thoughts about one afternoon looked
exactly like two thoughts about two afternoons, with a heading above them losing that
argument to six identical tiles. So a **day** is now the card and the entries are nodes on
one thread inside it. No schema change and no migration; what changed is that the connection
is **drawn** rather than asserted._

_**The days run up and the entries inside a day run down**, and that is not a contradiction.
A list of days is a list, and every list here is newest-first. A day is not a list — it is
one train of thought from morning to night, and a train of thought read bottom-up is not
one. This reverses 4.15, which had named the argument for reversing it "a real one" and
declined it; reading a day *as a day* rather than as a log is what settled it._

_**The composer is the last node of today**, which is what the "+" was asking for. It was
already directly above today's group and it read as a form hovering over the journal rather
than as the next thing in it. **It is open when today is empty and behind a "+" once the day
has started** — the always-open composer's justification is about *starting* a day (the
thing happened thirty seconds ago and you are holding a baby), and once there is a day to
read, a permanently open form halfway down it is something you scroll past. **Only today
gets one**, which is 4.16's rule finally visible in the layout instead of only enforced in
the action: a day that has gone has no button, no composer and no way in._

_**The photos were "all over the place" for two reasons and the second was the bigger one.**
Each was rendered at its own aspect ratio in a grid with automatic rows, so a portrait, a
square and a panorama gave three heights — `object-cover` was already there and was doing
nothing, because a box with no fixed height is never the wrong shape to cover. And the grid
**stretched to the container**: three tiles sharing a 1300px column are **420px each**, a
contact sheet at poster size. Uniform squares, capped at `max-w-xl`. **A single photo is
exempt from the crop** — one photo is not a grid, it is the photo._

_**Cropping is only honest because tapping opens the whole thing**, so there is a full-screen
viewer with arrows and Esc, and "Save to photos" moved into it — on a tile it was a control
on every square of a grid whose job is to be quiet, and below `sm` those are always visible.
**It is portalled to `<body>`, which is load-bearing rather than tidy**: `animate-rise`
finishes with `transform: translateY(0)` under `fill-mode: both`, so every day section
permanently carries a transform, and a transformed ancestor is a containing block for
`position: fixed` — the "full screen" viewer would have been pinned inside the day it came
from. **`--color-viewer` is its own token** for the same reason `--color-scrim` got one: a
scrim dims a page you can still read, and this one has to disappear._

_**Ten photos an entry**, checked in the composer and again in the action. It is a storage
number wearing a layout number's clothes, exactly as the clip's ten seconds is — ten photos
is ~750KB in a database where every byte is a byte of database, and ten *clips* is 20MB,
which is why the cap counts items rather than kinds. **The cap constrains a moment, not a
day**, which is why it can be this low: a day holds as many entries as you like and they read
as one thread, so "start another entry for the rest" is the better record anyway, and that is
what the message says rather than just refusing. The server counts what the entry already
holds, or the cap would be per-submit rather than per-entry — ten photos, save, ten more._

_Verified in a signed-in browser, light and dark. Added a second entry to today from the "+"
and watched it land **below** the 13:05 one at 16:46 with the heading gaining "2 entries" and
the composer collapsing back to the "+"; deleted it afterwards and confirmed the count back
at 2. Confirmed a past day has no "+" and its thread ends at its last entry, that an area
with nothing in it opens with the composer live and the explainer below, that the edit
composer opens in place inside the thread and its counter reads **7 of 10**, and that the
viewer opens at the right index, steps with the arrow keys (1/7 → 6/7), closes on Escape and
releases the page's scroll lock. `npx next build`, `tsc --noEmit` and `eslint` all pass;
console clean._

_**One diagnosis I got wrong and corrected before it shipped**, worth recording because the
wrong version was already in a comment: Escape appeared not to close the viewer — the exit
animation ran to completion and left it mounted — and I blamed React's delegated
`onAnimationEnd` not reaching a portal, and replaced it with a native listener. The real
cause is that this **Chrome window is occluded, so `document.visibilityState` is `hidden`,
and Chrome dispatches no `animationend` at all** — a native listener on the element gets
nothing either, which is what disproved it. Next mounts React on `document`, so a portal into
`<body>` is inside the root container and the delegated listener sees the event normally;
verified by dispatching the event by hand. Reverted to `onAnimationEnd`, matching
`ContentPanel`. **The harness's own state can look exactly like a bug in the code.**_

---

_Previously: **Phase 4.16 — the journal only accepts today, and has a camera.**_

_**2026-08-06 — the "+" I shipped this morning was the wrong half of that change.** The
verdict was exact: **a day that has already passed should not accept a new entry** — "it
doesn't make sense" — and if you want to add to it, edit what you wrote. So the "+" is gone
from every day heading, the **date field is gone from the composer**, and `happenedOn` is now
set once from the server's clock and never moves. An update omits the column entirely._

_**This is the mirror of the rule this file keeps arriving at.** Everywhere else it has been
"the app must not assert things nobody told it" — no seeded tasks, no invented events, no
guessed due dates. This is the other side: **what the app records for itself, nobody should
be able to overwrite.** A time that came from a clock is a fact; a time somebody typed is a
claim, and a journal of claims has to be trusted rather than simply read. Years out, the
useful thing about an entry is not that it says it is about the 3rd — it is that it was
genuinely written at 21:04 on the 3rd, which is why it says what it says. **Editing is
untouched and is a different act**: fixing a word is correcting a record, back-dating one is
writing a record later and presenting it as contemporaneous. The honest cost is stated
rather than smoothed over — a day genuinely missed is a day genuinely lost, and that is the
right trade for a journal and the wrong one for a diary you fill in on Sundays._

_**And it has a camera.** Live preview, front/back flip, a shutter, and a **ten-second clip**
with sound. `JournalPhoto` became **`JournalMedia`** with a `kind` and a `durationMs`, on a
hand-written migration where every statement is a RENAME or an additive ALTER — the
`ProjectDoc → Doc` precedent for the third time, because `migrate dev` turns a model rename
into a DROP plus a CREATE and these are the rows that cannot be recreated. **`photo-store.ts`
became `media-store.ts` and the one-file seam §6 promised held**, which is the first time
that claim has been tested._

_**Ten seconds is a storage decision wearing a UX hat**, and both readings are true: a clip
is ~2MB against ~75KB for a photo, so twenty-five clips cost a month of photos — and ten
seconds is simply the right length for the thing being filmed. `baseMime` exists because
`MediaRecorder` reports the codecs it negotiated (`video/webm;codecs=vp8,opus`), and the
container is **negotiated rather than sniffed** — Safari muxes MP4 and rejects WebM, Chrome
is the other way round, and `isTypeSupported` is a question the browser can actually answer._

_**Filters are colour grades, not face filters** — five presets, chosen before the shot and
baked into what gets stored, with **one CSS filter string serving both the preview and the
canvas** so a preview cannot lie about the result. The picker is **hidden entirely where
`ctx.filter` is unsupported**, because that property is silently ignored rather than throwing:
the preview would show a warm, faded photo and the stored one would come out untouched, and
you would find out after the moment had passed. Dog ears would mean a face-landmark model of
several megabytes tracked per frame, which is a build of its own and was not made._

_**One ask could not be built as stated, and it is a platform limit rather than a gap.** No
web page can write to a phone's photo library — a picture taken through `getUserMedia` goes
to the page and nowhere else, iOS especially. So there is a **"Save to photos"** button on
every photo and clip, which opens the native share sheet (`navigator.share` with a file)
where "Save Image" is one tap, and falls back to a download elsewhere. The camera says so in
one line under the shutter, because the failure mode otherwise is silent and delayed: you
shoot twenty photos of her over a week and find out afterwards that none are in Photos. The
library picker stays as the other half of the answer — shooting with the phone's own camera
app **does** save to the roll, and "Add photos" attaches it._

_Verified in a signed-in browser. The decisive test: opened the **5 August** entry, confirmed
its form has no date input and posts no `happenedOn`, saved it unchanged, and watched it stay
at 5 August 19:49 — before this it would have jumped into today's group. Confirmed the
composer has no date field and no day heading has a "+", that the existing nine photos still
serve from the renamed table and route, that the camera sheet opens with both capability
probes true on this browser (filter row and 10s clip button both render), and that a `<video>`
renders in the entry grid with its Save-to-photos button clear of the control bar.
`putMedia` was exercised directly with a **codec-suffixed** `video/mp4;codecs=avc1…` and
stored it as `video/mp4`, and the route served it back as `video/mp4`, 593061 bytes.
`npx next build`, `tsc --noEmit` and `eslint` all pass._

_**Two React Compiler lints were hit and both were right**, now recorded in §9: a browser
capability read as `useState` + `useEffect` is rejected, and belongs in
`useSyncExternalStore` for exactly the reason §11 gives for the theme clock; and `Date.now()`
called from a component-body function is flagged even when every caller is an event handler,
which a module-level `now()` wrapper fixes._

_Outstanding from this change: **no frame has actually been captured.** Granting Chrome's
camera permission is the user's call and I did not click Allow — everything around the
capture is verified, but the record → upload → play round trip has not been run. **A
synthetic test clip proved to be a bad fixture rather than a bug**: a Windows OS asset
(`oobe-intro.mp4`) failed to decode from a `blob:` URL too, which exonerates the route and
the component. **Face/AR filters** were considered and deliberately not built. **Captions
still have no UI**, now for clips as well as photos. **And the phone layout still has not
been looked at on a real device** — this is the change that most wants it, since the camera
is a phone feature and the sheet has only been seen at 1568px._

_**One thing went wrong on my side and is worth recording:** regenerating the Prisma client
needs `next dev` stopped (the documented Windows `EPERM`), and in finding the dev server I
killed the wrong process tree first — the **Sleepy Cat game's vite server**. It was restarted
immediately. The dashboard's dev server is the `dotenv -e .env.local -- next dev` chain, not
the bare `npm run dev` one._

---

_Previously: **Phase 4.15 — the journal groups by day.**_

_**2026-08-06 — the journal was a list of days and it needed to be a list of moments
inside days.** The ask was two things and they turn out to be one: show the time an entry
was written, and put a **"+"** on each day so you can keep adding to it. A day is not one
thing that happened — it is a morning, an afternoon, and whatever woke you at 3am — and the
flat list had no way to say that. Editing yesterday's entry to append the afternoon loses
that the two were written six hours apart; writing a second entry put it beside the first
with the date repeated, so two entries about one day looked exactly like two entries about
two days._

_So entries **group under `happenedOn`**, newest day first, and the date moves up to the
group heading — which is precisely what frees the room for the time. **No schema change and
no migration**: `createdAt` was already on the row and had never been read._

_**One thing was got right rather than cheaply**: the stamp is a clock time only when the
entry was written on the day it is about. Otherwise it reads "written 6 Aug". A bare
"21:04" under a Tuesday heading is a claim that something happened at nine on Tuesday night,
and with a baby, writing up Tuesday on Thursday is most of the time. That puts a real
timestamp formatted **local** next to a `@db.Date` formatted **UTC** in one component, which
is §6's "Dates are a trap here" with both traps side by side._

_**Today's heading deliberately has no "+"** — the always-open composer directly above it
already is that button, and two identical forms on screen for the same day reads as a bug._

_**Two latent layout bugs came out on the way**, neither of them the ask and both visible
from the day the journal was written. `field` baked in `w-full`, so `${field} w-auto` on the
date picker lost — equal specificity means the winner is whichever utility Tailwind emits
last, not the one at the end of your class string. The date input had been claiming a whole
row at every width, which pushed the headline to a second row and the edit composer's cancel
× onto a third, where it read as a design choice. §9._

_Verified in a signed-in browser. Added a second entry to 5 August from its "+" and watched
it group under the existing one with the heading gaining "2 entries" and the new row reading
**written 6 Aug**; added one for today from the top composer and watched a **Today**-badged
group appear above it stamped **12:49**. Deleted both afterwards and confirmed the page back
at one entry. `tsc --noEmit` and `eslint` pass; console clean, no hydration warning._

_Outstanding from this change: **entries within a day stay newest-first**, matching the rest
of the app — reading a day bottom-up is a real argument and is one line in `getJournal` if it
turns out to be wanted. **And the phone layout still has not been looked at on a real
device**; the day heading is one short row and adds no breakpoint, but that is reasoning, not
a check._

---

_Previously: **Phase 4.14 — Coding Mom and Forge get their backlogs.**_

_**2026-08-05 — the two projects the purge left emptiest now have work on them.** Coding Mom
and Forge were the last two carrying zero tasks and no focus line, and they arrived together
because they are **one funnel**: Coding Mom is TikTok-first audience building aimed at 10,000
engaged followers, and those followers are the audience Forge launches into. 30 tasks and 31
tasks, both written straight to the database. **No code changed but one line** — a `YC`
track — which is the free-text `track` design absorbing a fifth project without a migration._

_**They stay two projects, and §6 now says why.** The tempting fold is one project with an
`Audience` track, and it fails because they run on different clocks: Coding Mom is a daily
cadence that dies of friction, Forge is a quarterly application where a fortnight of silence
is fine and a year of it is the failure. One project cannot carry both cadences and whichever
won would make the other's drift warning a lie. What the coupling costs is one row each way,
and both were written rather than assumed._

_**The goal reframed itself twice while being written down.** "10,000 engaged followers" has
two different products inside it — a follower who scrolled past and tapped follow is worth
nothing to a $200 prototype waitlist — so **deciding what "engaged" means is a task**, or the
goal can only be counted and never measured. And "try TikTok first" has no exit condition,
which is how it quietly becomes "do TikTok forever, badly"; picking a post count and a
stretch of weeks **in advance** is much easier than picking them while feeling bad._

_**Forge's whole backlog is undated except one row**, per §6's "A goal with no deadline gets
no due dates" — the goal is explicitly rolling, and forty invented dates on a `side` project
is an Overdue tile counting up forever. The exception is confirming the next YC batch
deadline, because that is a clock somebody else holds; it is recorded as **unverified** and
carries the only due date on the project (12 Aug). **Coding Mom is undated too**, and it is
the project that proved the rule: its previous setup chain was dated from a 2026-08-01 start
with a first post on the 9th, and every one of those dates has lapsed with none of the work
done._

_**Four things the ask didn't mention and the capture surfaced.** **The $200 prototype credit
is an unpriced claim** — it is in the tagline, the solution and the business model, and
nobody has asked a manufacturer what it actually buys; if the honest number is $600 the pitch
changes, and two conversations settle it. **The breathing tracker is a regulatory question,
not just a build** — anything implying it will alert you about a baby's breathing is in
territory a well-funded competitor spent years on, and the claim is the marketing and the
marketing is the video. **Text-to-CAD is the load-bearing assumption of the entire company
and has never been tested**, so it is early in Build and may change the pitch. And **the
solo-founder question is asked directly on the application** — the answer here is a good one,
and it is much better decided than improvised, because "looking for a co-founder" has a
recruiting task hiding behind it._

_**The docs were also three days stale.** `forge-vision.md` still said "marks" and claimed the
project was seeded `simmering`, after the 2026-08-02 rename and after it went `active`;
`coding-mom.md` still said "Drops". Both fixed, plus a second Forge doc, **"The road to YC"**,
split from the brief for the same reason Utaitai has both a pricing note and a road to $100
MRR — one says what the thing is, the other says what happens next, and they change on
different clocks. Both stored copies were confirmed byte-identical to `git HEAD` before being
overwritten, so no in-app edit was lost._

_**One real renderer gotcha, found only by looking at the page.** `Inline` is a flat union, so
emphasis does not nest: `**\`side\`**` renders with the backticks showing, and a link inside a
bold run renders its entire `[…](…)` syntax on screen. Three instances, all in prose written
today, none in the five older docs. Recorded in §9 as a writing rule rather than fixed —
nesting means making the type recursive for a problem a different sentence solves._

_Verified in a signed-in browser. Today leads both cards with their focus lines, the Coding
Mom setup chain reads in order, Forge's one dated row sorts to the top of its card, and the
Overdue tile is still 0. The `YC` track groups last on the project page, after Setup → Build
→ Users → Marketing. Both docs render clean and the re-check for nested emphasis comes back
empty. `tsc --noEmit` and `eslint` pass; console clean on both project pages. The dark theme
came on by itself partway through, which is Phase 4.13 working._

_Outstanding from this change: **no recurring posting task exists yet**, deliberately — a
daily row nagging about an account that does not exist is what this app keeps deleting, so
the last row of the setup chain is what creates it. **Coding Mom reads "Drifting · 5d"** on
`cadenceDays: 1` while its first task is to create an e-mail account; correct the day posting
starts and wrong until then, left alone rather than churned. **There is no quarterly
recurrence**, so "apply to the next batch" cannot be a repeating row. **Every YC batch date is
unverified.** `prisma/docs/utaitai-mrr.md` is still missing from the seed's `DOCS` list, so a
fresh database would not get it — noticed here, not fixed. **And the phone layout still has
not been looked at on a real device.**_

---

_Previously: **Phase 4.13 — a dark theme that follows the sun.**_

_**2026-08-06 — the app goes dark at sunset and light again at dawn.** The first change in
six phases that is purely about how it looks rather than about what it asserts, and §8 had
been carrying "light mode only — a dark variant would need its own design pass" since
2026-07-30. The design pass turned out to be **one decision**._

_**The elevation ladder inverts.** In the light theme importance climbs toward white:
canvas is darkest, cards are white tiles on a tinted stage, a hero tile is black. Swapping
in dark greys — the obvious build — leaves that ladder pointing the wrong way, and the hero
tile stops being the most emphatic thing on screen and becomes a **hole**. So the dark
theme climbs toward light instead: canvas darkest, cards above the stage, and
`--color-obsidian` is the **lightest** surface in the theme. White text on it still clears
10:1, which is why **not one of the 47 `text-white` usages needed touching** — the token
that means "highest emphasis" still means that, reached from the other side._

_**Everything else is a second column of values.** An audit before starting found zero uses
of `bg-white`, zero Tailwind palette colours, and sixteen hex literals, all of them brand
logos or platform colours that are supposed to be fixed. So `:root[data-theme="dark"]`
restates the tokens and no component was restyled. The honest new cost: a hardcoded colour
is now a bug in two themes rather than a shortcut in one._

_**Two things the audit caught that would have shipped broken.** The panel scrim was
`bg-obsidian/25` in five places, which worked only while obsidian happened to be near-black
— on a theme where it is the lightest surface, the dimmer **brightens the page it exists to
dim**. It is `--color-scrim` now, with its own alpha, and heavier in the dark because there
is less contrast between a panel and its backdrop to begin with. And Studio's "All brands"
chip passed a literal `#14110f` dot, correct on a white chip and invisible on a dark one;
it is `var(--color-ink)`, which is what it always meant._

_**Sunset, not `prefers-color-scheme`** — following the sun and following the OS are
different answers, and the OS one was not what was asked for. `lib/sun.ts` is the NOAA
solar equations, forty lines and no dependency, verified against almanac times at five
latitudes including both polar cases. Fixed clock hours were the cheap alternative and are
wrong by a lot: **Los Angeles sunset moves from 16:57 in January to 20:07 at the
solstice**, so a dashboard that stays light until 19:00 glows through most of a winter
evening. Location is asked for once, a refusal is remembered, and the fallback is Los
Angeles — under an hour wrong, which is the correct amount of wrong for a fallback and far
cheaper than asking twenty times a day._

_**A pre-paint script stops the white flash**, and carries no arithmetic: the provider
leaves behind the answer *and when it expires*, so the script only reads a clock. `<html>`
needs `suppressHydrationWarning` for it, which is load-bearing rather than a smell — the
script writes attributes the server's markup cannot have, because the server does not know
what time it is where you are, which is the whole problem._

_**One real bug, found only by testing.** The store cached coordinates in a module variable
and filled it once, so every recompute — the hourly heartbeat, the focus listener, the
cross-tab `storage` event — silently reused whatever the first render found, and a location
granted in one tab never reached another. Caught by driving four cities at a single instant
and getting four identical answers; storage is now re-read on every recompute. Re-run
after the fix, at 02:13 UTC: **London 03:13 dark, Reykjavík 02:13 dark, Sydney 12:13 light,
Singapore 10:13 light**, each with the right next crossing._

_Verified in a signed-in browser across Today, the Hunt Board, the Calendar and Studio, and
through a panel to check the scrim dims rather than lightens. Native date, time and select
controls render dark, which is `color-scheme` doing its job and would otherwise have been
blinding white boxes on a dark panel. `npx next build`, `tsc --noEmit` and `eslint` all
pass; console clean, no hydration warning._

_Outstanding from this change: **the phone layout still has not been looked at on a real
device** — the toggle is the one topbar control that stays visible at every breakpoint,
which is a judgement about the device most likely to be used at dusk rather than a check.
**The login page was not seen in dark** — it redirects while signed in, and it uses only
tokens verified elsewhere, which is reasoning rather than a check. And `npm run build`
still cannot run while `next dev` is up on Windows; `npx next build` alone can, since the
`EPERM` is `prisma generate` renaming the query-engine DLL._

---

_Previously: **Phase 4.12 — a repeating row waits for its day.**_

_**2026-08-05 — a ticked-off habit was still sitting on Today, dated tomorrow.** The
complaint was exact: a recurring task on Today "makes me feel like I have to get it
done while I don't have to." Ticking one advances it rather than finishing it, so
"Post today's shorts" left at 9am and came straight back for tomorrow, on the one
screen whose job is to say what is left. And the Wed & Sun batching task sat there on
a Monday, four days before it was owed. Both were the app charging you for work that
was either already done or not yours yet — the fifth instance of the error the last
four phases have been pulling out, and the reason the sprint went._

_**Four lines of filter.** A row that repeats is on Today when it is **due today or
overdue**, and not before. Overdue still shows, because a missed day is a fact you
asked for; `doing` still shows, because an explicit press outranks a date; and a
recurring row with no due date shows, because that is a rule that never fires and
making a broken row invisible is worse than showing it. **`openTotal` deliberately
still counts the hidden ones**, so the card's "N more →" and the Open tasks tile don't
shrink every time a habit is ticked — a card whose whole remainder is waiting for its
day now reads "Nothing due today", which is a different sentence from "Nothing open
here" and does not offer to put more work on a project that already has some._

_**Today-only, on purpose.** The Hunt Board and a project page are the complete list
in full, and hiding tomorrow's occurrence there would let a project look empty when it
isn't. Same split the calendar's default layers draw._

_One thing fell out that wasn't the ask: `TaskLine` had a special case suppressing the
fold-out animation for recurring rows, on the grounds that they stay put and get
redrawn. They no longer stay put, so both the exception and the `recurrence` field on
`TaskLineView` that existed only to drive it are gone._

_Verified against the live database across all five cases — due tomorrow (hidden), due
today, overdue, far-future-but-`doing`, and no due date (all shown) — with the test row
restored to its original value afterwards. Then in a signed-in browser: Utaitai's card
was led by "Post today's shorts" and "Batch-create the week's content" and is now led
by the three real rows underneath them. Round-tripped a throwaway daily task end to
end — created it due today, watched it appear under One-offs with its `Daily` badge,
ticked it, watched the row fold out rather than blink, "Ticked off today" go 3 → 4 with
the snapshot listed, and One-offs drop to "1 more →" with the advanced row counted but
not shown. Both rows deleted afterwards and the screen confirmed back at 3 ticked and
134 open. `tsc --noEmit` and `eslint` pass; console clean._

_Outstanding from this change: **the Hunt Board is untouched by design**, which is a
judgement rather than a check. **And the phone layout still has not been looked at on a
real device** — this adds no breakpoint, but that is reasoning, not a check._

---

_Previously: **Phase 4.11 — Utaitai gets its backlog.**_

_**2026-08-05 — Utaitai had been running on one recurring task, and it has a revenue goal.**
The same exercise Phase 4.9 did for Sleepy Cat, on the project the 2026-08-04 purge left
emptiest. Forty-four tasks over six tracks, a focus line, and a second doc. **No code
changed at all** — every track it needed already existed, which is the free-text `track`
design paying off for the fifth time. (The Phase 4.10 entry below is dated the 6th; its own
notes record that the work happened on the 5th, so this is the same day.)_

_**The goal reframed itself the moment it was written down.** "$100 MRR" at the existing
$7.99 price is **thirteen subscribers**, and there is one. At one to two signups a day —
about forty-five a month — that is twelve more conversions, which at 10% is three months and
at 3% is most of a year. So **the conversion rate is the variable, not the traffic**, and the
rate today is under 1%. That ordering is the whole doc: doubling the audience doubles a
number very close to zero, so the paywall comes first, talking to people who didn't pay comes
second, repurposing third, and the apps last. The focus line is the arithmetic rather than
the dollar figure, because 13 is the number that actually gets counted._

_**Three things the ask didn't mention and the capture surfaced.** **Lifetime pricing
contributes $0 MRR by definition** — it is cash today in exchange for a subscriber
permanently removed from a count that only has to reach thirteen, so one lifetime buyer is
roughly 8% of the goal, gone. It is on the board as a decision (price it at 30–40× monthly,
or hold it until $100 MRR is passed), not as a build. **Weekly cannibalises monthly and costs
more to collect** — about 13% to Stripe on a $2.99 week against about 6.6% on $7.99 a month,
charged four times as often. And **whatever the old three-free-songs paywall converted at is
unrecorded**, which becomes unrecoverable the moment it is switched off; without it there is
no baseline the $1 week can ever be compared against. That is the only dated row on the
project._

_**Also flagged rather than smoothed over: replacing the free tier outright is a bet this
volume may not survive.** Forty-five signups a month is not much to absorb a card form
arriving before anyone has heard the product work, and zero signups times any conversion rate
is zero. The alternative shape — keep the three songs as the taste, put the $1 week where
they run out — is on the board as a decision beside it, with the numbers attached. The
pricing doc's 2026-08-03 assumption of replacement stands until that decision is made; it is
just no longer implicit._

_**Responsive web before either app, and the reasons are mostly other people's rules.** A
webview wrapper around a desktop-only layout is a bad app on both stores, so the cheap job is
also the prerequisite. Three gates that get found late: **Apple 3.1.1 and Google Play Billing
both require in-app purchase for digital content**, at a cut and with their own trial
mechanics, so "$1 for 7 days then $7.99/month" may not be expressible as an IAP in that shape
at all — which is a reason to settle it before the paywall screen is built twice. **Apple's
4.2 minimum-functionality rule** is aimed squarely at repackaged websites, so choosing the
wrapper doesn't remove the need for the app to be an app. And **a new personal Play developer
account cannot reach production without a closed test of twelve testers over fourteen
continuous days** — no work at all, two weeks of calendar, and worth starting long before the
build is finished. The honest verdict, written into the doc: the apps buy store search, which
is real and is why they should exist, and they are still weeks against days._

_**The recurring Wed/Sun batching task is back.** It was asked for, and finding out why
revealed that Phase 4.6 had called it "the whole commitment now" while the 2026-08-04 purge
had deleted it — so for two days the app had been asserting a commitment that existed nowhere
in it. Weekly on `[3, 7]`, first firing Sunday 9 August, linking straight to `/studio/batch`.
Verified that 2026-08-09 is genuinely a Sunday rather than trusting the arithmetic._

_**Forty-four tasks, one due date**, which is a rule now: §6, "A goal with no deadline gets no
due dates". The goal was given as "no deadline, however long it takes", and inventing dates
anyway would put forty rows into an Overdue tile that counts up forever on a project that is
deliberately `side`. What supplies the ordering instead is the track order plus explicit
decision rows sitting in front of the work they gate._

_**Answering "where else has short-form clip?"** — the three planned channels (IG Reels, YT
Shorts, FB Reels) were already on the brand and now have creation and warm-up rows behind one
decision about whether they split per language. Recommended on the board: **split YouTube and
Instagram, keep one Facebook page**, and link Instagram to it so Reels cross-post themselves.
**X earns a look for the Japanese side specifically** — it is dominant in Japan in a way it is
nowhere else. **Xiaohongshu is where the Chinese-learning audience actually is and is
deliberately not on the board**: it needs a `Platform` value and a Chinese phone number, so it
is a migration for an account that may not be openable from here. And one concrete row that is
easy to miss: **strip the TikTok watermark before reposting**, because Instagram and YouTube
both demote reuploads carrying it._

_Verified in a signed-in browser. All 44 rows render grouped in track order (Setup → Ship →
Monetization → Users → Marketing → Content), the batching task shows its `Wed & Sun` badge and
9 Aug date, "Post today's shorts" still reads `Daily · 2` with its `0/2` checklist and neither
subtask appears as a loose row, Today's card leads with the focus line, the Overdue tile reads
0, and both docs render clean — headings, ordered and bulleted lists, and the pricing doc's
blockquote surviving as a quote rather than a paragraph beginning with `>`. Console clean.
The stored pricing doc was confirmed byte-identical to `git HEAD` before being overwritten, so
no in-app edit was lost._

_Outstanding from this change: **lifetime pricing is a live conflict with the stated goal** and
needs deciding before it is built. **The conversion baseline is unrecorded and the window
closes** when the old paywall does. **Xiaohongshu needs a `Platform` value** if the Chinese
side ever outgrows TikTok. Utaitai stays `side` with `cadenceDays: 14`, deliberately — the
daily posting task bumps `lastTouchedAt` anyway, so the drift warning could never fire, and
that is the correct amount of nagging for a project with no deadline. **And the phone layout
still has not been looked at on a real device** — nothing here adds a breakpoint, but that is
reasoning, not a check._

---

_Previously: **Phase 4.10 — a task can have a checklist.**_

_**2026-08-06 — posting to Utaitai is one job done in two places, and the app had no way to
say that.** The ask was a daily recurring task to post, with a subtask per TikTok account
and more accounts to come. Subtasks were not a thing this app had, and the two ways to fake
it both fail in the same direction: one row cannot record that the Japanese account went up
and the Chinese one didn't, and one row *per account* multiplies a single daily commitment
by however many accounts exist — five once Instagram, Facebook and YouTube go live, all of
them the same thought, all of them sitting on the board next to "ship the iOS build"._

_So `Task` gained **`parentId`**, pointing at itself. Same model rather than a `Checklist`
table, because a step already needs a title, a project, a track and a done state, and half
a Task's fields being meaningless on a child is cheaper than a second table every list query
would also have to learn about. The tax is exact and it is the mirror of the one recurrence
already charges: **every list of open work now filters `parentId: null` as well as
`recurringId: null`**, or the steps appear on the board as tasks in their own right,
directly under the row that already renders them. The two are bundled as `TOP_LEVEL_ONLY`
so the six queries needing both cannot drift apart._

_**Ticking the last box finishes the job**, which is the behaviour the whole thing is for:
tick @utaitai_jp, tick @utaitai_cn, and the day is recorded and the row comes back tomorrow
with empty boxes. A "2/2" that still counted as open would be exactly the kind of untrue
line this app keeps having to delete — nothing left to do on it, and the only control left
says the same thing twice. **The checklist re-arms with its parent**, cleared `completedAt`
and all, and that clearing is what keeps the contribution map honest. **The map excludes
steps**, which is the opposite call from the recurring snapshots and worth saying why:
thirty days of reading to her is thirty days, but posting to three accounts this morning is
one morning, and counting the steps would make a job look bigger for having been broken
up — a metric you can game by writing longer checklists._

_**Where it expands is a per-surface decision.** Today opens it, because that is the screen
you are on in order to tick. The Hunt Board and a project page keep it collapsed behind its
own `n/m` count, because those are for choosing *which job*, and an expanded checklist under
every row is the "board dumps everything on my face" problem one level down. Adding a step
is one field and Enter, on the task panel — the same argument the idea box and the
experiment capture are built on. **One level only**, enforced in `addSubtask`: a checklist
on a checklist item is a tree, and a tree wants collapsing, indenting and re-parenting, none
of which "post to these accounts" asks for._

_The task itself — **"Post today's shorts"**, daily, `Content` track, `TikTok @utaitai_jp`
and `TikTok @utaitai_cn` — went **straight to the database and not into `prisma/seed.ts`**,
per §6's rule that the seed creates structure and never work._

_Verified in a signed-in browser. Ticked the Japanese account and watched the row hold at
1/2 while Utaitai flipped to "Touched today"; ticked the Chinese one and watched the task
advance to 6 Aug, both boxes reset to 0/2, and "Ticked off" gain **one** row rather than
three. Confirmed the project page reads "Open 1" and `Daily · 1`, that the steps appear
nowhere as loose rows, and that the panel's Steps editor adds, renames and removes.
`npm run build`, `tsc --noEmit` and `eslint` all pass._

_**One real bug was found there and fixed:** the panel's optimistic add inserted a
placeholder id, and both the × and the rename-on-blur address a row by id — so removing a
step you had *just* added threw `PrismaClientKnownRequestError`. `addSubtask` now returns
the real id. Found only because the round trip was actually done in the browser rather than
reasoned about._

_Outstanding from this change: **steps cannot be reordered** — they arrive in the order
written, which for a list of accounts is the order you open them in, and a drag handle is a
lot of machinery for a list of three. **The migration folder is dated `20260806`** while the
work was done on the 5th; it is applied, so renaming it would make Prisma try to apply it
again. And **the phone layout still has not been looked at on a real device** — the
checklist indents inside the existing rows and adds no new breakpoint, but that is reasoning,
not a check._

---

_Previously: **Phase 4.9 — Sleepy Cat has a plan.**_

_**2026-08-05 — the first project filled in by hand since the seed stopped creating work.**
Sleepy Cat had zero tasks, zero docs and no focus line: everything went in the 4th's purge,
which is exactly what was supposed to happen and left the question of whether "nothing but
you creates a task" is actually livable. It is. **58 tasks over six tracks**, all of them
asked for, plus a vision doc — "The road to Steam" — and a focus line the project card now
leads with._

_**Then the target moved to the October 2026 Next Fest**, which is nine weeks out rather
than six months, and the interesting part is what that changed. Not the dates — those are
arithmetic. **It changed what is being aimed at.** The February plan quietly assumed the
whole game had to be polished; a fest needs a **demo**, and a demo is a **slice**. So the
"cut the demo slice" decision moved to 17 August and became the binding constraint on
everything, and roughly a third of the Build track — key rebinding, controller support,
saves, Steam Cloud, achievements, the Steam Deck pass, localisation — moved to **after** the
fest. Sequenced, not cut. What stayed in front of it is what a stranger sees in sixty
seconds: the settings menu, the pause and first-run flow, the level order, and the resource
UI his feedback flagged. And **"get the store page live" stopped being an optimisation and
became a gate** — you cannot register for Next Fest without a live, approved page, so it is
due 10 September with Valve's review in front of it. Stated plainly in the doc rather than
smoothed over: this is four months of plan in nine weeks with a five-month-old, and if
something gives it should be the demo's **size**, never its finish._

_**Then a festival-submission plan was pasted in to diff against the board**, and the useful
output was the disagreements rather than the additions. It had **thirteen festivals with
thirteen unverifiable deadlines**, so those went into notes behind one verification task
rather than onto rows as due dates — §6, "An unverified date is a note, not a due date". It
**omitted Wholesome Direct**, which for a cozy game is likely the best-fitting showcase
there is. It **omitted the entire Steam legal and admin spine** — the $100 Direct fee and
its 30-day clock, the tax interview, the name check, the licence audit, the age rating —
which is the one thing that can actually make October impossible. And it **disagreed about
the demo**: 45–60 minutes against this board's much smaller slice. That is standard advice
written for teams with more than nine weeks and no five-month-old, so rather than silently
picking a side it became an explicit decision on the "cut the demo slice" row. Genuinely
additive and now on the board: a **reusable submission kit** (one pitch, pasted a dozen
times, and the Steam page wants the same words), a browser build for judges — plausibly
near-free since the game is built with Vite — an end card with the social links, vertical
art for the five vertical-first channels, a landing page, and **Devlog Friday** as a weekly
recurring row beside Screenshot Saturday._

_**"A milestone or something" turned out to need no new noun.** A milestone is a date plus
the work that must be true by it, and both already exist here: the fest week is an **Event**
— the first thing this project has ever genuinely justified putting on the calendar, since
it is a thing that *happens at a time* rather than a thing you owe — and the readiness list
is a **track**. §6, "A milestone is a track plus an event"._

_**The plan was originally dated off Steam Next Fest, February 2027, launching late March or April.**
Next Fest is a week-long Valve festival for unreleased demos and you get **one per game,
ever**, which is what makes the date the spine of everything else: October 2026 is nine
weeks out and would spend it on a rough demo, June 2027 is ten more months on a game whose
MVP is already done. Working backwards puts **Steam's admin first rather than last**, which
is the part that felt wrong and is right — the $100 Steam Direct fee starts a 30-day clock
before you are allowed to release at all, and the tax interview and ID verification take
real days. None of it can be hurried in the week it matters, and all of it can be finished
in a fortnight now. The single highest-leverage row on the board is **"Get the store page
live"**, due 30 November: wishlists only accumulate while the page is public, so every week
earlier is free._

_Three things the ask didn't mention and the capture surfaced. **The Steam capsule set is
an art job nobody had scoped** — six fixed sizes plus screenshots plus a trailer, which is
his work and is weeks, not an afternoon. **"Sleepy Cat" is a very common phrase**, so the
Steam and trademark check is due 12 August, before any capsule exists, because the capsule
is where a rename gets expensive. And **the audio and art licences need auditing for
commercial *and* redistribution rights** — a genuine launch-blocker that gets found late._

_**`Audio` is a new track**, beside Art rather than inside it, for exactly the reason Art
was split out of Ship when Sleepy Cat arrived: it is a third person's schedule, and a cozy
puzzle game is carried by its music more than by its code. That is the fourth track this
project has invented at a cost of zero migrations — the case for free text, made again._

_**Seven channels on the Sleepy Cat brand**, all `@sleepycatgame`, including **Reddit**,
which needed a `Platform` enum value. It is the first channel here that isn't a megaphone —
a subreddit is a room you are a guest in — so it is on the list and it **never gets a
Series**, because a generated cadence pointed at a subreddit is the behaviour that gets an
account banned. §6, "Reddit is a room, not a megaphone". The honest tension, written into
the doc rather than smoothed over: Coding Mom already runs six channels daily and Utaitai
five, so seventeen accounts is not a plan. Sleepy Cat's own accounts exist because Steam
links to them; the cadence stays where the audience already is._

_**Two bugs fixed on the way, neither of them the ask.** `lib/markdown.ts` broke a bullet
run at the first wrapped line, so `forge-vision.md` had been rendering "Comfortable,
affordable baby breathing tracker" and "foot sock." as separate blocks since it was
written — the bug this file has been carrying since 2026-08-03. Blockquotes had it twice
over. Both fixed, verified against seven parser cases and both real docs. And **five
migrations were reading as tampered with**: `core.autocrlf=true` had turned the Mac-written
LF migrations into CRLF on checkout, so `prisma migrate dev` was offering to **reset the
database** over line endings. Four were pure whitespace; `.gitattributes` now pins `*.sql`
to LF so it cannot recur. §9._

_**The shared feedback doc is in, as a link.** He and I write design feedback into a Google
Doc, and it is on the project's Docs tab as a **pointer plus a dated snapshot** rather than
an import — a `Doc` row is editable in the app, so copying a living document in forks it on
the first edit and leaves two versions drifting with no way to tell which one either of us
last read. What did come across is the **work**: five Build tasks off the feedback, and the
difficulty-curve row got a real definition from it — teach one mechanic per level, Level 1
is move and sleep, Level 2 introduces Push — because the Level 1 → Level 9 jump is a
level-order problem and not a difficulty-numbers one. One of the five is a **decision**
rather than a fix, since whether finding one sleep spot hides the others is two different
games and polishing the order before it is settled is work done twice. His overall verdict
arrived at the same place this plan did without being asked: MVP reached, polish structure
and existing mechanics, don't add features. §6, "A doc can point at a document"._

_Verified in a signed-in browser: all 63 tasks render grouped by track in the right order,
the recurring Screenshot Saturday task lands on an actual Saturday and shows its `Sat`
badge, the monthly wishlist check shows `Monthly`, all seven channels render with the new
Reddit lettermark, Today's card leads with the focus line and says "Touched today", and
both docs render clean. `tsc --noEmit`, `eslint` and `next build` all pass._

_Outstanding from this change: **the October 2026 Next Fest dates are a guess** — Mon 12 to
Mon 19, following the 2024 and 2025 Mon-to-Mon pattern. The calendar event and all 71 due
dates assume it, and confirming it in Steamworks is due **6 August**, the earliest row on
the board. It is the one task that moves everything else. **Nothing links the Next Fest
track to the Next Fest event** — clicking the fest does not show its readiness list, which
is the honest cost of not inventing a Milestone table. **Tables still render as raw pipes.**
And `npm run build` cannot run while `next dev` is up on Windows: `prisma generate` fails
with `EPERM` renaming the query-engine DLL, so the dev server has to be stopped first._

---

_Previously: **Phase 4.8 — areas you can open, and a journal.**_

_**2026-08-05 — the Baby area got a journal, and areas became openable.** Straight after
the removal below, and caused by it: the area had nothing left, and what it actually needed
was three things, none of which hung off a Project — somewhere to record what she did,
somewhere to keep what I want for her, and one real task. So **an Area is now something you
can open**: `/areas/[slug]`, Journal · Docs · Tasks, reached by clicking its name in the
sidebar. Not a fifth nav item — that rule holds, and this is the same kind of destination a
project page is._

_**`JournalEntry` is the first noun in this app that points backwards.** Everything else
points forward — a Task is owed, an Event is scheduled, a ContentItem is going out — and
"she rolled over on the 3rd" is none of those, which is exactly how recording the past
turned into a chore list. So an entry cannot be overdue, cannot be ticked, and is never
counted against anything. The composer sits open rather than behind a button, because the
thing being recorded happened thirty seconds ago and you are holding her. It files under
the day it is **about**, not the day it was typed._

_**Photos are in Postgres, and the argument isn't cost.** These are the one kind of row
here that genuinely cannot be recreated: a volume isn't in the database backup and an
object store is a second account to keep alive. The price is size, so the reversal was made
cheap on purpose — `lib/media-store.ts` is the only module that touches bytes, and moving
to R2 later is that file plus a backfill. The browser downscales to 1600px before anything
is sent: a 2400×1800 / 4MB source landed at 1600×1200 / **75KB**, measured end to end.
That is not tidiness — a server action's default body cap is 1MB, which one phone photo
clears before the file has finished being read. `/api/journal/media/[id]` re-checks the
session, because without it that route would be the one genuinely public thing in the app._

_**`ProjectDoc` became `Doc`**, hanging off a project *or* an area, on a hand-written
migration where every statement is a RENAME or an additive ALTER — the `plain_names`
precedent, for the same reason: an auto-diffed rename would have dropped the Coding Mom
brief, the Forge vision and the Utaitai pricing note. The alternative was a parallel
`AreaDoc`, which is how one of two identical systems silently rots. `ProjectDocs` →
`DocsTab` and `ProjectTasks` → `TaskList` followed; **neither component changed except in
what it is handed**, which is the whole argument for generalising rather than duplicating._

_The Baby area now holds the **Languages** doc — the Vietnamese/English plan, the three
Russian leads, and Chinese as the open question it currently is — and one task, "Figure out
a way to teach her Russian and Chinese", written straight to the database rather than into
the seed, per §6's rule that the seed creates structure and never work. The doc's old
structural claims were rewritten rather than restored: it used to explain "why this is a
project and not a list", which would have been a page describing a shape the app no longer
has._

_Verified in a signed-in browser: wrote a real entry with a photo and watched the 4MB PNG
arrive as a 75KB 1600×1200 JPEG; confirmed the photo serves from the API route, all three
tabs render, the sidebar marks the current area, the task shows under One-offs on Today,
and Forge's Docs tab still works after the rename. `npm run build`, `tsc --noEmit` and
`eslint` all pass, and `db:seed` reports `Docs: imported 1`._

_**Not verified: the phone layout.** The new surfaces are built to the existing
breakpoints and the composer drops its headline to its own line below `sm`, but the browser
here would not take a sub-768px viewport — `resize_window` reports success and the renderer
stays at 2560px. This is the same gap CLAUDE.md has carried for a week. The dev server
prints a **Network URL** (`http://192.168.1.36:3000`); opening that on the phone on the same
wifi is the honest check and takes ten seconds._

_**2026-08-05 — the Baby area is empty on purpose now.** First stop on a project-by-project
review, and the verdict on "Multilingual baby" was that it was **just kind of weird**. The
shape of the weirdness: every other project here is something that would not otherwise
happen — Sleepy Cat does not ship itself — so rows are the right instrument and an
untouched project genuinely is drift. Caring for a four-month-old is not in that category.
It is the main thing happening every day whether or not anything is written down, so
`cadenceDays: 2` on it was a drift warning that could never fire honestly, and "read her a
Vietnamese book" as a tickable row put an audit on the one thing never at risk of being
skipped. Same family as "Followed, not scheduled" and one notch subtler — that was a task
drawn as an event, this is **a life drawn as a backlog**. The project is deleted (it held
no tasks), its three content ideas were **detached rather than deleted** because Coding Mom
was still the one talking, and its doc cascaded as designed, surviving as
`prisma/docs/multilingual-baby.md`. The seed entries went with it so a re-seed can't bring
it back, and the row is in `backups/multilingual-baby-2026-08-05.json`. Where the area is
heading is a **development-milestone journal** — written after she does a thing, not
before — which is a noun the app does not have: Task is binary and forward-looking, Event
asserts a time, ContentItem goes to an audience, and none of them is "she rolled over on
the 3rd". Not designed yet, deliberately. §6, "The Baby area is a journal, not a backlog"._

_**2026-08-05 — there were two screens listing the same projects.** The question was "there
is a Hunt Board and a Projects tab, what's the difference" and the answer only sounded good
for a day. Hunt Board is a list of **tasks**, where projects are just the headings you group
by; Projects was a list of **projects**. A real distinction — which stopped mattering on
2026-08-04, when Today was rebuilt project-first. After that the roster was five cards
reading name · description · open count · last touched, sitting one tap from a screen
already showing five cards reading name · **focus** · the actual rows · overdue · last
touched. The same fold as the Momentum card, one noun larger._

_**So the Projects surface is gone and its three real jobs moved onto Today's cards.** The
pencil beside a project's name opens the settings panel unchanged — rename, re-area,
re-tier, focus line, cadence, archive, delete. "New project" sits at the foot of the card
next to the idea box, deliberately **not** crimson: it was the roster's primary action and
it is not Today's, and §9 allows one accent per region. And **"N put away"** opens the
paused and archived ones, which is the part that could not simply be deleted —
`getProjectBoards` shows `active` and `simmering` only, so without it an archived project
is unreachable and un-archiving it is impossible from the app at all._

_**Project pages are untouched.** `/projects/[slug]` — Overview · Tasks · Social media ·
Docs — is where a project's docs live and there was never a second copy of it. The route
did not move, so every existing link still resolves; only the roster listing them is gone.
Two things fell out of that: the page's back link now reads "← Today", and **the sidebar
tree marks the current project**, because a project page used to light the "Projects" icon
in the rail and with that surface gone nothing said where you were._

_Verified in a signed-in browser on Windows. Round-tripped a throwaway project end to end
through the new controls — created it from Today, edited it via the pencil, set it to
Archived and watched it leave both the card list and the sidebar while "1 put away"
appeared, reopened it from that list, deleted it, and watched the disclosure vanish with
it. Confirmed `/projects` now 404s, `/projects/sleepy-cat` renders with "← Today" and a
highlighted sidebar row, the rail carries four icons, and the console is clean.
`npm run build`, `tsc --noEmit` and `eslint` all pass._

_Outstanding from this change: **the phone layout still hasn't been looked at on a real
device** — the tab bar is four items now instead of five and the new footer row is
`justify-between`, both of which should be fine and neither of which has been seen small.
**Area CRUD is now the last surface-level gap** — the sidebar's "Add area" and "Manage
areas" are still disabled. `getMomentum` in `lib/projects.ts` has had no callers since
2026-08-04 and was left alone; it went dead with the Momentum card, not with this._

_**2026-08-04 — the app stopped telling me things I hadn't told it.** Four complaints
arrived together and they turned out to be one complaint. **The sprint is gone** — it
worked exactly as designed, and what it was designed to do was measure a Monday commitment
against a Thursday that a four-month-old gets to decide, which on a bad week makes the
screen you open twenty times a day into the one keeping score. **Today is project-first
now**: one card per project carrying a new `Project.focus` line — what this is aiming at
*right now*, as opposed to `description`, which says what it is — and its few most pressing
rows, in a fixed order, because a screen you read by scanning cannot reshuffle itself
overnight. Momentum folded into those cards, since a list of every project's last-touched
date beside a list of every project was the same thing twice. And progress is shown
**backwards**: a GitHub-style contribution map of what actually got ticked off, which has
no target and therefore cannot report a shortfall._

_**All 78 tasks were deleted, and the seed is why they were there.** Not one of them had
been typed into the app; `seedTasks` created them across five projects and matched on
title, so anything deleted came back on the next `db:seed` — which is the whole answer to
"I don't know where the hell they're from". The arrays and the function are deleted rather
than guarded (~700 lines), the rows are in `backups/tasks-2026-08-04.json`, and the rule is
now general and stated in §6: **the seed creates structure, never work.** Tasks, sprints
and events are claims about your life and only you get to make them. That is the third time
this same error has been found — the baby routine, the five seeded events, and now the
tasks._

_**The calendar starts empty**, which was asked for and turns out to be principled: a task
is a thing you *owe* and an event is a thing that *happens*, and a due date drawn as a
square on Thursday reads as an appointment on Thursday — so a grid full of them shows a
week that looks fully booked when nothing is scheduled at all. `DEFAULT_LAYERS` is
`["event"]`; both other layers stay one tap away in the legend and keep their true counts.
**Utaitai's two daily series are switched off** and their 40 empty slots deleted, so nobody
has to fill in fourteen cards a week; the recurring "Batch the Utaitai week" task is the
commitment. And **"Content" now reads "Social media content"** everywhere, with the Studio
nav item renamed **Social Media** (route still `/studio`)._

_**One thing found on the way that had nothing to do with the ask:** a migration
`20260801183000_docs` was applied to the Railway database but had never been committed, so
every `prisma migrate dev` for three days had been reporting drift and offering to reset
the database. Reconstructed from the live schema, and the dead `Doc` table it created —
two rows, superseded hours later by `ProjectDoc` — is dropped in
`20260804090000_project_focus`. `prisma migrate status` is clean again._

_Verified in a signed-in browser on Windows (`C:` has 104 GB free now, so `next dev` runs
again — the note in Environment notes is stale). Ticked a task and watched the streak go
3 → 4, the project's line change to "Touched today" and the row appear under the map;
round-tripped a focus line through the project panel onto Today; confirmed the calendar
renders empty with "0 events · 3 tasks due · 3 social media content" in the legend; checked
the Hunt Board has no sprint bar and the project tabs read Overview · Tasks · Social media
· Docs. `npm run build`, `tsc --noEmit` and `eslint` all clean, and a full `db:seed` re-run
now reports `tasks: 0`._

_Outstanding: **the board is empty** — five projects, no tasks, no focus lines written yet
(both are yours to fill in, which is the point). Area CRUD, multi-select delete on the Hunt
Board, drag-to-move on the calendar, per-occurrence exceptions, and the phone layout still
needs a look on a real device. **And still: set `TZ=America/Los_Angeles` on the Railway
service** — see Environment notes._

---

_Last updated: 2026-08-03 · Status: **Phase 4.5, plus a calendar that only shows what it
was asked to, and Utaitai charging for its trial.**_

_**2026-08-03 — Utaitai's subscription became a paid week.** $1 for 7 days, then $7.99 a
month automatically. Captured as nine tasks on a new **Monetization** track (§6) and a
project doc, **"What Utaitai charges"** — Utaitai's first, and the reason `ProjectDoc`
exists: a pricing decision that is only in someone's head is one that gets re-litigated
every time it's questioned. Three tasks went into Week 1 because the change is the whole
point; the other six are backlog because none of them blocks the first $1, and a sprint
with three days left does not need nine more rows. The billing is **Stripe**, not store
IAP — the $7.99 price already exists and has one subscriber on it, who is deliberately
not migrated: a Stripe subscription keeps the price it was created with, and handing
someone who already pays a trial is how one subscriber becomes zero. Two things the
capture surfaced that the ask didn't mention. **A Stripe paywall inside the iOS app is a
3.1.1 rejection** — Apple wants IAP for digital content — and six open Ship tasks lead
straight to that submission, so it is a real collision with a date on it rather than a
someday. And **charging by default is the pattern regulators are looking at**: the
disclosure next to the button, a cancel path that isn't emailing me, and a reminder on
`trial_will_end` are what make it defensible, so they are tasks rather than assumptions.
Written into the live database and into `prisma/seed.ts` with identical titles, so a
re-seed is a no-op. Not seen in a browser — `C:` is still at 0 bytes free and `next dev`
dies on startup (Environment notes)._

_**Noticed while writing that doc, not fixed:** `lib/markdown.ts` treats a wrapped list
item as a list of one plus a stray paragraph, because it consumes a bullet run line by
line. `prisma/docs/forge-vision.md` has been rendering that way since it was written.
The new doc works around it with single-line bullets; the renderer is the real fix._

_**2026-08-03 — the calendar stopped shouting.** Two complaints, one root: the grid was
showing things nobody put there. **Content is now a layer, off by default.** The two
Utaitai dailies were laying 34 dots across August, two a day and mostly untitled slots
reading "Daily short — Japanese slot"; hiding the layer took the month from 52 things to
11. The three counts in the legend became the switch, because the thing that says "41
content going out" should be the thing you press, and the hidden layer keeps its real
count so it can still advertise itself. Nothing was lost — ticking a post off already
lives on Today's "Going out today", one tick per channel, and the calendar was replaying
it as a dot you can't tick. **And the five seeded events are deleted**, `seedEvents` with
them: "In-laws visiting", "Check the rent has landed", a Sunday playtest and two batching
blocks that duplicated the recurring "Batch the Utaitai week" task. Invented rows are
worse on a calendar than anywhere else — an appointment you never made is one you have to
disprove before you can dismiss it — and it is the same error as the baby routine, one
notch harder to spot. An event is now something you were there for; nothing but you makes
one. Verified against the live database and by 22 checks on the layer parsing; **not** yet
seen in a browser, because `C:` is at 0 bytes free and the dev server dies allocating
memory — see Environment notes, this needs clearing before the phone pass._

_**Phase 4.5, built 2026-08-02.** Not a planned phase — the set of things that turned out
to be wrong once the app had been lived in for two days._

_**The jargon went.** "Marks" and "Drops" were two task-shaped nouns and neither of them
said which one you actually do; `Mark → Task` and `Drop → ContentItem`, in the schema as
well as the screens, on a hand-written migration where every statement is a RENAME (§2).
Hunt Board, Series and Sprint were kept — the board's name was never the confusing part
and the other two were already ordinary English. Studio is now the Content Studio._

_**Every project has a page**, `/projects/[slug]`, with Overview · Tasks · Content · Docs.
The roster card opens the project; the pencil opens the settings panel it used to open.
And **docs are rows now** — a `ProjectDoc` with a Markdown body, edited in-app, rendered by
~170 hand-written lines rather than three dependencies and a sanitiser. The two project
briefs moved out of `/docs` to `prisma/docs/`, where they are seed material and nothing
else: the notes worth keeping are the ones thought of at 3am on a phone, and a git commit
is not available then._

_**The baby routine is deleted.** Seven daily rows of feeds and naps, a swim class, a
check-up. It demonstrated recurrence beautifully and lied about how the day goes — a
four-month-old is followed, not scheduled — and worse, the Sunday filming block had been
parked "inside the long nap", so a real commitment was planned against a fiction. Phase 4's
notes called the naps the most useful thing on the calendar; they were the most confidently
wrong thing on it. What is genuinely deliberate became **Multilingual baby**: Vietnamese
and English daily as recurring tasks, and Russian as an umbrella task plus three concrete
leads, because her dad speaks it and won't teach her, so it has to come from somewhere that
isn't him. Three content items carry the Coding Mom brand and that project._

_**Tasks can recur**, which is what both the reading and the Utaitai batching needed. One
live row that advances, plus a real `done` snapshot per occurrence so history, momentum and
sprint records keep working — at the cost of a `recurringId: null` filter in seven queries.
It advances from *today*, never from the date it was missed, so a skipped fortnight is not
fourteen overdue rows for days that have gone._

_**Utaitai batches on Wednesday and Sunday.** The batch composer had existed since July but
nothing ever told you to use it, so the ask was still "fill fourteen cards one at a time",
which doesn't happen. Now a recurring task says so and links straight there — and because
those are the only two days the project reliably gets opened, Today grows a fifth card
offering two or three of its other backlog rows while the context is loaded._

_**Sprints roll over by themselves**, which they should have done from the start: an
expired sprint doesn't just stop being useful, it makes Today render last week's
commitment as this week's. Past its end date it closes, hands the unfinished back to the
backlog and opens a fresh Monday–Sunday — except at the weekend, where it runs through the
following Sunday rather than minting a one-day sprint. An empty sprint arrives with eight
suggestions pre-ticked, because "go and plan it" is the blank page sprints exist to avoid.
The tile reads pace rather than a countdown, and there is a one-field idea box at the foot
of the focus card._

_Verified in a signed-in browser at UTC-7: committed a suggested sprint, ticked a daily
recurring task and watched it advance to tomorrow while the sprint counted it 1/8, opened
two project pages and their Docs tabs, and confirmed "While you're in it" appears with
Utaitai's three Ship rows. Four things were found and fixed there — eight crimson ticks in
the planner and an accent button in the Studio header, both over §9's one-accent budget; a
due date wrapping onto two lines on the board; and a doc rendering its own title twice.
Two real bugs were found while verifying Stage 5: a recurring task with no due date has a
rule that never fires, and a task link opened in a new tab even when it pointed inside the
app._

_Outstanding: drag-to-move on the calendar, per-occurrence exceptions, sprint history has
rows but nothing reads them, due dates on most tasks, Area CRUD, and the phone layout
still needs a look on a real device. **And still: set `TZ=America/Los_Angeles` on the
Railway service** — see Environment notes._

---

_Last updated: 2026-08-01 · Status: **Phase 4 is done — the Calendar is live, and Today is
finally whole.**_

_**Phase 4, built 2026-08-01.** The Calendar was the last surface still showing an empty
state, and it is now month, week and day, hand-built rather than pulled from a library —
the decision §8 had been carrying since the start, resolved against Schedule-X and
FullCalendar for the same reason shadcn was deferred: this design gets fought rather than
configured, and ~600 lines of CSS grid inherited `animate-rise`, the crimson today-pill and
the accent now-line for free. A new `Event` model carries simple recurrence
(daily / weekdays / weekly-on-days / monthly, plus an end date) and stores **the rule, not
the occurrences** — the baby's seven daily rows stand in for roughly 2,500 occurrences a
year, and a month view renders 296 of them without materialising anything. Task due dates
and Content item publish times are layered onto the same grid at read time rather than copied into
event rows, which meant three date conventions had to agree on which cell they land in;
they do it by reducing to a **local day key** the moment they're read (§6, "The calendar").
Today's section 3 is real, so all four sections now read live data. The baby's routine is
seeded — feeds, naps, bath and bed, a swim class, a check-up — and the Sunday filming block
is deliberately parked inside the afternoon nap, because the naps are the only two blocks
of the day the other projects can happen in, and the calendar is the first screen that
shows that. Verified end-to-end in a signed-in browser at UTC-7, which is the west-of-
Greenwich case §6 keeps warning about: created a weekly-on-Wednesday event, confirmed it
first fired on the right day, round-tripped the edit, deleted it. One real bug was found
and fixed there — a hand-written `1fr` grid track let a long title push Saturday's all-day
cell over Sunday's (§9). **One thing to do before this helps on the phone: set
`TZ=America/Los_Angeles` on the Railway service**, or the deployed calendar runs on UTC and
puts the evening on the wrong day — see Environment notes._

_Previously: **Phases 2 and 3 both real and running locally, with sprints.**
Studio now batches: `/studio/batch` fills a whole week of slots from one grid, and the
board shows a daily-queue strip instead of ~28 empty slot cards. The Hunt Board is live
with Tasks grouped by project and track, a paste-a-link experiment capture, and both
projects' tasks seeded — Utaitai's twenty ship/users/marketing tasks, and **Sleepy Cat's
nineteen** across Build / Art / Ship / Marketing, aimed at a Steam release. Coding Mom
gained Instagram, Facebook and YouTube channels so its daily short fans out four ways,
and its 2026-08-02 Medium slot now holds the postpartum-collaboration essay — a Content item
carrying the Coding Mom brand and the Sleepy Cat project, which is the two-axis model
(§6) earning its keep for the first time. Postgres is migrated, the seed is loaded, and
all three surfaces have been checked in a signed-in browser.
**Today is live except the calendar**: sections 1 (Tasks due), 2 (Going out today) and 4
(Momentum) all read real data and are actionable in place — tick a task done, tick a
channel posted, let a drifting project simmer. All four stat tiles are wired. Building
section 2 exposed and corrected a `timeOfDay` bug that had every series publishing at the
wrong hour.
**Two projects joined the roster on 2026-07-31: Coding Mom and Forge.** Coding Mom was
only a brand until now; it is a project too, because building the audience is a backlog of
its own — 13 tasks, led by a **Setup** track that runs e-mail → TikTok → a week of warm-up
→ first post on 2026-08-09, and those are the first tasks in the app with real due dates,
so section 1 of Today stopped rendering empty. Its content bank is 25 idea-stage Content items
across seven pillars, deliberately ordered so Multilingual sets up Hardware and Hardware
sets up **Forge** — the AIoT hardware startup with 10 tasks and a full brief in
the Forge project's Docs tab. Coding Mom is Forge's go-to-market phase 1, started early.
**Sprints landed the same day, and they are the answer to the board being unreadable.**
Four projects' worth of tasks added up to sixty open rows, which is the right contents for
a planning surface and the wrong thing to be greeted by: Today's old section 1 was "every
task with a due date", so it showed one project's admin or nothing at all. Now a `Sprint`
holds the week's committed handful, Today reads it in the order you'd actually work
(`doing` → overdue → due today → the rest) with due tasks from anywhere merged in, and
**Next up** sits collapsed underneath for when it runs dry. The Hunt Board became the
planning surface it always claimed to be: a black sprint bar, an "In the sprint" card, a
Main-projects / Everything scope pill, and project sections that start collapsed unless
they're `main`. Closing a sprint hands its unfinished tasks back to the backlog rather than
rolling them forward, which is the rule that stops it becoming a second to-do list.
**The roster was re-tiered at the same time**, via a new `Project.priority` that is
deliberately *not* `status`: Sleepy Cat (cadence 3) and Coding Mom are `main`; Utaitai is
`side` on maintenance — its dailies still ship — and Forge moved `simmering` → `active`
`side` now that design and research are genuinely running, and becomes `main` the day
Sleepy Cat launches. "Week 1" is seeded with eight tasks, round-robined across the two main
projects. Both surfaces were re-checked in a signed-in browser; a hydration mismatch in
"Next up" was found and fixed there (see §9).
**Project CRUD closed the last hole in Phase 3, also on 2026-07-31.** Projects were the
only noun with no way to create one, and the cost was visible: every Coding Mom setup task
sat under Sleepy Cat for a week because "create the Coding Mom TikTok account" had nowhere
else to go. The roster is now the editor — a panel on any card creates, renames, re-areas,
re-tiers, archives and deletes, the status chips became filters, and moving a project to
another Area re-files its tasks in the same transaction. `prisma/seed.ts` stopped updating
existing projects entirely (`update: {}`): once the columns are editable in-app they are
all decisions, and a re-seed that reverted last week's re-tiering is the exact thing the
editor was built to end. Deleting is refused for a project holding tasks, content items or series
— `SetNull` everywhere means deletion orphans the work rather than removing it — so the
panel names what's holding it and points at Archive instead. Verified in a signed-in
browser: created a throwaway project, edited it, deleted it, and round-tripped a save of
Utaitai with every column unchanged.
Outstanding: section 3 (Agenda, waits on Phase 4), due dates on everything other
than the setup chain, sprint history (closed sprints keep their finished tasks and nothing
reads them), Area CRUD (the sidebar's "Add area" and "Manage areas" are still disabled —
five areas ever, so it has never bitten), and the phone layout still needs a look on a real
device._
