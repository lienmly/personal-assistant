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
| **AI assistant (Montblanc)** | **DeepSeek API**, hand-rolled | Decided 2026-08-09, replacing the pencilled-in Qwen (I already hold a DeepSeek key). Still an OpenAI-compatible endpoint, so "swapping providers is a one-file change" held — it *was* one file. **The Vercel AI SDK went with it**: what Montblanc needs from a provider library is a tool-calling loop, which is thirty lines in `route.ts`, and nothing here streams tokens (§6, "Montblanc is a command bar"). Same trade §8 made against a calendar library and shadcn. |
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
/components/ui     → card, empty state, surface header, the Markdown formatting
                     row (writes into a textarea, never owns its value — §6)
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
/lib/montblanc     → the assistant: `deepseek.ts` (the only file that knows the
                     provider), `prompt.ts`, `context.ts` (what exists, as text),
                     `tools.ts` (writes go through the UI's own server actions),
                     `undo.ts`, `memory.ts` (the log, the distiller, the notes —
                     the only module that reads either), `memory-actions.ts`
                     (read and forget, for the drawer), `types.ts` (client-safe:
                     no Prisma)
/app/api/montblanc → the tool loop, streaming NDJSON. Auth-gated
/app/api/montblanc/distill → turns a finished conversation into notes; on close
                     and, for the ones that never landed, on the next open
/components/montblanc → the drawer
/prisma            → schema.prisma, migrations, seed.ts
/proxy.ts          → route protection (Next 16's renamed Middleware)
/app/manifest.ts   → the web app manifest, served at /manifest.webmanifest
/public/sw.js      → the service worker: installability + an offline page, nothing else
/public/offline.html → what a failed page load shows. Entirely self-contained (§6)
/public/icons      → home-screen icons, generated — never hand-edited
/scripts/generate-icons.mjs → draws them from the moogle mark. No dependency (§6)
/components/shell/service-worker.tsx → registers it; renders nothing
/public            → static assets, icons, branding
/assets            → styling reference screenshots — consult before building UI (§9)
/docs              → guides written for me to read, not for agents (§9)
```
_(Everything above exists.)_

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

### Phase 4.20 — The phone's chrome gets out of the way
_Built 2026-08-08. The first change since 4.13 that is purely about how the app looks, and
the first one aimed **only** at the phone — which is the device every phase since 4.8 has
recorded as unchecked. No schema change, no migration, and nothing outside
`components/shell/`._
- [x] **The topbar and the tab bar hide on a downward scroll** and return on **any** upward
      one. Together they are ~124px of an 844px viewport and ~19% of a small phone's. §6,
      "A phone's chrome is mostly ornament"
- [x] **Both are overlays now, not rows in the flow** — the topbar is `fixed` below `md`,
      the tab bar always was. Hiding a row in flow would reflow the document under your
      thumb; hiding an overlay reclaims viewport, which is the whole point
- [x] **A fixed 64px mobile topbar**, down from an intrinsic 76px, which is what lets the
      stage's `pt` be an exact number instead of a measurement in state
- [x] **A 12px travel threshold that banks rather than discards** — under it the last
      reading is *kept*, so a slow drag accumulates toward it instead of never arriving
- [x] **Nothing hides in the first 72px**, where the header still overlaps the first card
      and hiding reads as a flinch
- [x] **Arriving on a new surface always shows the chrome**, reset during render rather
      than in an effect. Without it a link followed from halfway down Today lands on a page
      that may not scroll, with the only navigation a phone has stuck off-screen
- [x] **Opening the drawer shows it too** — it is the menu button you just pressed
- [x] **Desktop is untouched**, verified rather than assumed: at 1280px the header is
      `static`, `translate: 0px`, 76px tall, stage top at 92px, with the hide class present
      and the `md:` override beating it
- [ ] **Still not seen on a real device.** It was verified at a true 390×844 viewport — a
      same-origin iframe, which answers media queries from its own box — which is a great
      deal closer than reasoning but is still a desktop Chrome. §9
- [ ] **No `inert` on the hidden chrome.** Its links stay focusable while off-screen;
      tabbing to one scrolls it into view, which fires the handler and brings it back, so
      the failure mode self-corrects. Revisit if it ever reads wrong with a screen reader

### Phase 4.21 — It installs
_Built 2026-08-09. The complaint was not about a feature: "it's such a hassle having to go to
the website — sometimes I don't remember the URL because it's on Railway and it's too long."
That is a **distribution** problem, and no amount of work inside the app fixes it. The answer
is one icon on a home screen. No schema change and no migration._
- [x] **`app/manifest.ts`** — name, icons, `display: standalone`, `start_url: /today`, and
      three long-press shortcuts. §6, "An app you install"
- [x] **Four real PNG icons, drawn from the moogle mark** by `scripts/generate-icons.mjs` —
      a ~150-line rasteriser with no dependency, because `apple-touch-icon` has never
      supported SVG and a manifest icon that fails to decode is a blank square
- [x] **A maskable copy**, drawn smaller, so Android's launcher mask does not shave the
      pom off the top of the mark
- [x] **`public/sw.js`** — installability and an offline page, and **deliberately no app
      caching**. §6, "The service worker caches nothing that changes"
- [x] **`public/offline.html`** — self-contained, theme-aware, reads the theme the app
      left in localStorage
- [x] **`viewport-fit: cover`** so `env(safe-area-inset-bottom)` reports real values; the
      tab bar already had the padding and had never been able to use it
- [x] **`apple-mobile-web-app-capable`** written by hand — Next emits only the standardised
      `mobile-web-app-capable`, which Safari ignores before iOS 17, and an installed icon
      that opens *in Safari with the address bar* is the exact complaint
- [x] **The theme-color meta follows the theme.** Installed there is no browser chrome, so
      the OS paints the status bar with it — the one part of the window §11 did not reach
- [x] **`proxy.ts` lets the install files through.** The browser fetches the manifest, the
      icons and the worker *before* anyone signs in; gated, each 302s to /login and the
      install prompt silently never appears
- [x] **Four grid containers were one long word away from scrolling sideways** — §9's
      `minmax(0, 1fr)` rule, in its `grid-cols-1` form. The project page's Overview was
      already doing it: 126px of horizontal scroll at 390px wide
- [x] **The calendar's area filter** stopped overflowing and wrapping "Home & Money" onto
      three lines; it is a scrolling strip now, with a `no-scrollbar` utility because §9
      does not have scrollbars
- [x] **Every page checked at a genuine 390×844 viewport** — all sixteen surface/tab
      combinations, plus the task, event and drawer overlays. Desktop confirmed untouched
- [ ] **Still not installed on a real phone.** Everything is verified in desktop Chrome:
      the manifest parses, the worker is active and intercepts navigations, and killing the
      server really does produce the offline page. What that cannot show is the iOS install
      flow, the standalone status bar, or the home indicator against the tab bar
- [ ] **The Railway URL is still the Railway URL.** A custom domain is the other half of
      this and it is a Railway setting plus a DNS record, not code — worth doing once,
      because the install is where the URL stops mattering but a re-install still needs it
- [ ] **No push notifications.** The worker has no `push` handler; that is Phase 7, and on
      iOS it requires the app to have been installed first — which it now can be

### Phase 5 — Montblanc (AI assistant)
_Built 2026-08-09. The complaint was navigational, not conversational: "sometimes I want a
quick — add this bug to this app, add this idea to social media — and I have to navigate
around the board and sometimes forget where things are." So Montblanc shipped as a **command
bar**, not a chatbot. See §6, "Montblanc is a command bar"._
- [x] **A drawer on every surface**, opened with `Ctrl/⌘+K` or from the topbar
- [x] **It took the dead search pill's place** — the widest control on a phone, disabled
      since Phase 1. §6
- [x] **DeepSeek, hand-rolled** — `lib/montblanc/deepseek.ts` is one `fetch`; no AI SDK. §3
- [x] **Eight tools**: `create_task`, `create_content_item`, `create_project`,
      `create_event`, `create_journal_entry`, `find_tasks`, `complete_task`, `navigate`
- [x] **Every write goes through the UI's own server action**, so an invariant enforced in
      `saveTask` cannot be bypassed by asking nicely. §6
- [x] **What exists is in the prompt, not behind a tool** — ~2,000 characters of areas,
      projects, brands, accounts and tracks, which removes a whole round trip from *every*
      request. §6
- [x] **The prompt encodes §6's rules**: never invent a due date, never guess between two
      projects, make exactly what was asked for once, a thing you owe is a task
- [x] **A receipt with an Undo on every write**, which is what buys the right to write
      without a confirmation step. §6, "A receipt is what a confirmation step would have
      cost you"
- [x] **NDJSON event stream**, so the four seconds a tool round takes shows *which tool*
      rather than nothing. Deliberately not token streaming. §6
- [x] **Verified end to end against the live model** in a signed-in browser, six sentences,
      every row deleted afterwards and the board confirmed back at 196 open tasks
- [x] **The icon rail's disabled "Montblanc — arrives in Phase 5" button is now the way in**,
      alongside the topbar pill. Found by reading the accessibility tree rather than by
      looking — it is at the foot of the rail, below the fold on a short window
- [ ] **Surface-aware context** — Montblanc does not know which screen you are on. Cheap to
      add (one field on the request) and deliberately not guessed at before use
- [ ] **It cannot edit or delete**, other than ticking a task off and undoing its own
      writes. A way in, not a way to rearrange. §6
- [ ] **The transcript is not kept between opens.** Each open is a fresh sheet
- [ ] Proactive help (daily briefing, drift nudges) — later, and it is the half most likely
      to reproduce the sprint's failure: a thing that speaks unbidden about what you have
      not done

### Phase 5.1 — The camera is the screen, and a project keeps a journal
_Built 2026-08-09. Two asks and they are unrelated: make the journal's camera look like
TikTok's, and put the journal on a project page too. The first is a layout with one
correctness bug behind it; the second is the `Doc` change of 2026-08-05 applied one noun over._
- [x] **The controls float on the viewfinder** — close top left, flip and grades on a rail
      top right, a mode strip and one shutter at the bottom, at every width. §6, "The controls
      go on the glass"
- [x] **One shutter instead of two buttons**, with `Photo · 10s clip` naming the mode first.
      Big enough to hit one-handed, which is the whole operating context
- [x] **The ring is the countdown**, and the inner shape morphs circle → rounded square rather
      than the surface growing a word that says "Stop"
- [x] **The grades hide behind a rail toggle**, which stays lit while one is applied
- [x] **White-on-dark chrome in both themes** — the `--color-viewer` argument: a viewfinder is
      dark everywhere. Two gradient scrims so white controls read over bright footage
- [x] **What you see is what gets stored.** The capture crops to the previewed rectangle
      instead of drawing the whole sensor frame — verified at 740×720 out of a 1280×720 camera
      in a 416×405 frame, matching the shown aspect to four decimals. Photo and clip both
- [x] **The sheet is portalled to `<body>`** — a pre-existing bug, and the one the phone check
      found: `animate-rise`'s transform on every day section was the containing block for the
      "full screen" overlay, so on a phone the viewfinder began below the tab strip. §6
- [x] **Body scroll locks** under it, matching the media viewer
- [x] **`animate-rise`, not `animate-panel-in`** — a centred dialog does not slide in from the
      edge (§10)
- [x] **`JournalEntry.projectId`** (`20260809140000_journal_on_projects`) — nullable beside a
      now-nullable `areaId`, exactly one set, enforced as a union type in the actions file.
      Hand-written, every statement additive or a `DROP NOT NULL`. §6
- [x] **A Journal tab on `/projects/[slug]`**, fourth of five, same component as the area's
- [x] **`deleteProject` counts journal entries** among what blocks a delete — the journal
      cascades, and it is the one thing on a project that cannot be written again
- [x] **Montblanc files into either**, `areaSlug` and `projectSlug` mutually exclusive, a
      refusal rather than a guess when both or neither arrive
- [x] **Verified at a real 390×844 viewport** (§9's iframe technique) as well as on a desktop,
      with a synthetic camera feed standing in for a permission grant
- [ ] **No frame has still ever been captured from a real camera.** Granting Chrome's camera
      permission is the user's call — unchanged since Phase 4.16. Everything around it is
      exercised, including a real `MediaRecorder` round trip against a canvas stream
- [ ] **Nothing links a project's journal to its Docs tab**, and a devlog and a doc will
      eventually want to point at each other. Deliberately not designed
- [ ] **Captions still have no UI**, now on a third surface

### Phase 5.2 — One shutter, and the front camera the right way round
_Built 2026-08-09, hours after 5.1 and correcting it. The mode strip that replaced two
buttons was still one control too many, and the mirror had been wrong since the camera was
written. No schema change and no migration; nothing outside `camera-sheet.tsx`._
- [x] **Tap for a photo, hold to record** — the mode strip is gone and there is one
      control. §6, "One button, and the gesture chooses"
- [x] **The photo fires on release**, because until the finger lifts there is nothing to
      tell the two gestures apart; the **hold starts recording at the threshold**, because
      the clip has to cover what you were reacting to
- [x] **`MIN_CLIP_MS`** — a release just past the threshold runs on to one second rather
      than storing a 70ms recording with no frames in it
- [x] **`setPointerCapture` cannot take the press down with it** — it throws
      `NotFoundError` on an inactive pointer, and unguarded that meant no photo, no
      recording and no error on screen
- [x] **Enter and Space wired back to the photo**, which `onClick` was giving for free
- [x] **The front camera is un-mirrored**, one flag driving the preview's `-scale-x-100`
      and the canvas `drawImage` together. §6, "The front camera is un-mirrored"
- [x] **The rear camera is untouched**, decided from `getSettings().facingMode` rather than
      from what was requested — a desktop webcam reports nothing and resolves to self-facing
- [ ] **The clip's real length has still never been exercised.** The verification window is
      occluded (`visibilityState: "hidden"`), so `requestAnimationFrame` fires roughly once
      a second and the canvas path records one frame — §9's standing harness limit, not a
      fault in the code
- [ ] **No frame has still ever been captured from a real camera**, unchanged since Phase
      4.16 — granting Chrome's camera permission is the user's call

### Phase 5.3 — The journal composer can write
_Built 2026-08-09. Two asks about the same box: give the body some formatting, and stop the
headline field posting the entry when you hit Enter. The second is a bug rather than a
feature — the browser's default, not a decision anybody made. No schema change and no
migration._
- [x] **A formatting row above the body** — bold, italic, link, bulleted, numbered, quote,
      code. Exactly the seven things `lib/markdown.ts` renders and nothing else. §6, "The
      toolbar offers what the renderer can render"
- [x] **`components/ui/markdown-toolbar.tsx`** — it edits the textarea and never owns its
      value, so the composer stays the uncontrolled form every other field in this app is
- [x] **Edits go through `execCommand("insertText")`**, deprecated and correct: it is the
      only way to change a textarea's value and keep the browser's native undo stack.
      `setRangeText` is the fallback, not the default. §6
- [x] **`Ctrl/⌘+B`, `+I`, `+K`** through the same functions the buttons call
- [x] **The adjacency test counts asterisks rather than string-matching them** — `*` is a
      prefix of `**`, so italic on an already-bold word read the bold pair as its own. Found
      by driving the buttons: it produced `****stayed****`. §6
- [x] **Enter in the headline moves to the body**, at the end of what is already there. A
      headline is the *start* of writing an entry, and a one-input form submits on Enter.
      §6, "Enter is not Post"
- [x] **The project journal gets it too**, unchanged — same component, the third time the
      2026-08-09 generalisation has paid for itself
- [ ] **The Docs editor still has no toolbar**, and it is the more Markdown-heavy surface of
      the two. The component is written to be handed any textarea ref; wiring it up is four
      lines and was left out of scope rather than overlooked
- [ ] **No preview.** The entry renders formatted the moment it is saved and editing is one
      tap, so a live preview would double the composer's height to answer a question that
      answers itself
- [ ] **Enter on a bulleted line does not continue the list.** You type the next `- `
      yourself, or press the button again

### Phase 5.4 — The photo viewer swipes
_Built 2026-08-09. One ask — "in mobile mode the journal photos can't be swiped" — and it is
the same shape as the phone chrome and the full-screen camera before it: a surface built with
a pointer's affordances, met on a touchscreen. No schema change and no migration; nothing
outside `components/areas/media-grid.tsx`._
- [x] **The current item and its two neighbours sit on one track that follows the finger** —
      the next photo is visible while you drag toward it, which is what says the gesture is
      working before you have committed to it. §6, "A photo viewer you cannot flick"
- [x] **Committing is only `onIndex`** — the neighbour keeps its key, so React keeps the DOM
      node and the transition carries it from ±100% to 0 by itself. The arrows and the arrow
      keys take exactly the same route, so there is no second animation path to keep in step
- [x] **Three slides, not ten** — opening a viewer fetches one photo and pre-warms the two
      you might go to next
- [x] **An axis lock**, so a vertical wobble does not slide the photo sideways by however far
      the thumb wandered
- [x] **Resistance at either end** (0.35×), so a swipe with nowhere to go says so by barely
      moving rather than by doing nothing at all
- [x] **A gesture that starts on a clip's controls or on the chrome belongs to them** —
      scrubbing is a horizontal drag too, and it is the one the finger meant
- [x] **`setPointerCapture` is taken at the axis lock, not on the press** — a captured pointer
      sends its `click` to the capture element, so capturing every press would make a tap on
      the photo read as a tap on the backdrop, which closes the viewer. §6
- [x] **A flick that ends over the backdrop is not also a tap on it** — one ref, set when the
      gesture becomes a swipe and cleared on the next press
- [x] **The commit distance is read off the gesture, not off `drag` state** — otherwise it
      depends on React having re-rendered between the last move and the release. Found by
      dispatching a whole gesture in one synchronous burst, where it silently did not commit
- [x] **A clip's `autoPlay` became an effect keyed on the index.** `autoPlay` only fires on
      mount and a neighbour slide is mounted long before it is the one you are looking at —
      and it is what stops the clip you just swiped away from playing on off screen
- [ ] **No clip has been swiped past**, because there are none: the journal holds 52 photos
      and zero videos. The guard that keeps a gesture starting on a `<video>` away from the
      track was exercised against an injected one, which tests the selector and not a clip
- [ ] **No pinch to zoom.** A photo opens fit-to-screen and that is all it does; zooming is a
      second gesture on the same surface and was not asked for
- [ ] **Still not swiped on a real phone.** It was driven at a genuine 390×844 viewport with
      synthetic pointer events, which is §9's iframe technique plus dispatched input — closer
      than reasoning, and not a thumb

### Phase 5.5 — Montblanc's replies render, and it remembers
_Built 2026-08-10. Two asks about the same drawer, and they are unrelated: make the reply
stop showing its asterisks, and give Montblanc some memory of what I keep coming back to.
The first is a bug with a renderer already sitting in the repo. The second needed a
distinction this file did not have — **a transcript is not a memory**._
- [x] **The reply goes through `components/ui/markdown.tsx`** — the same renderer the Docs
      tab uses, which already parses exactly the subset the model emits. §6, "The reply is
      rendered by the thing that renders"
- [x] **`Markdown` gained `className` and `onLinkClick`**, and an **in-app link is a Next
      `<Link>`** rather than an `<a target="_blank">`. A doc linking to another doc had been
      leaving the SPA since the renderer was written
- [x] **The prompt names two answer shapes** — one sentence after a write, a short list after
      a question. It only ever had the first, so a question got an improvised briefing
- [x] **It names the exact syntax the renderer supports**, and what to avoid with the reason:
      no headings (a 440px drawer is not a document), no tables (raw pipes), no nested
      bullets (they flatten), no `__bold__` (only the asterisk forms parse). §6's "the
      toolbar offers what the renderer can render", turned around
- [x] **"Never repeat the cards"** — `find_tasks` had already put the rows on screen and the
      prose re-listed all twelve. That was the real ugliness in the screenshot
- [x] **Three additive models** (`20260811055359_montblanc_memory`) — `MontblancConversation`,
      `MontblancMessage`, `MontblancNote`. Generated by `migrate dev`, every statement a
      CREATE
- [x] **The log is never sent to the model.** What is sent is ~15 dated one-line notes,
      distilled from it. §6, "A transcript is not a memory"
- [x] **Notes are dated and superseded, never overwritten** — a blob records the present by
      destroying the past, and "how it changes" was half the ask
- [x] **Behaviour, not feelings.** A command bar is a poor mood sensor; the distiller is told
      so in those words, with worked examples. §6
- [x] **A filing turn writes nothing** — verified first, because it is the one that matters:
      "add a bug to Sleepy Cat" logged, distilled, and produced zero notes
- [x] **The sweep is `ensureDistilled()` on drawer open, not a cron** — `ensureSeriesSlots`'s
      bargain (`lib/studio.ts:65`), for the same reason and at the same price
- [x] **"What I remember" in the empty state, with a × per note.** The memory's half of the
      receipt bargain: Montblanc may conclude things unasked **because** they are visible and
      one tap removes them. A × supersedes rather than deletes
- [x] **A thread can be picked back up for 30 minutes**, from `localStorage`, offered on one
      line and taken only if pressed. Read through `useSyncExternalStore` — §9's rule, for
      the third time
- [x] **`recordExchange` clears `distilledAt`** — so a resumed thread is re-read whole rather
      than losing the half that arrived after the first close
- [ ] **The notes have only ever been distilled from conversations I staged.** Every rule was
      exercised, but nothing here has met a week of real use, which is the only thing that
      shows whether the notes are worth their place in the prompt
- [ ] **Nothing shows a note's source conversation.** `sourceId` is written and the log is
      kept, and there is no screen that joins them — so "why do you think that" is a database
      query. The × is the answer for now
- [ ] **Distillation is unbounded in cost.** One model call per conversation, and a day of
      heavy use is a day of calls nobody sees. There is no cap and no accounting
- [ ] **Still not used on a real phone**, and the memory list is the part most likely to want
      it — it is the one new thing in the drawer that can get long

### Phase 5.6 — A task keeps a log
_Built 2026-08-11. One ask — comments on a task, with the time and date on each — and it is
the first structural change to `Task` since the checklist. The panel could say what a task
**is** and had nowhere to say what had **happened** to it._
- [x] **`TaskComment`** (`20260811214157_task_comments`) — body, `createdAt`, cascade. Purely
      additive; `migrate dev` generated it and every statement is a CREATE
- [x] **The stamp comes from the server's clock and is not editable** — §6, "The date is not a
      field", one noun over. There is no edit, either: the honest fix for a comment that came
      out wrong is to delete it and say the thing again, stamped with when you said it
- [x] **A thread reads forwards** — oldest at the top, the composer at the bottom. The
      journal's argument (§6, "A day is a thread"): a sequence of things that happened to one
      object is an order, not a list
- [x] **Fetched when the panel opens**, not carried on `TaskView` — a board holds ninety tasks
      and renders none of this. `TASK_VIEW_SELECT` is untouched
- [x] **Enter is a new line and Ctrl+↵ posts.** §6's "Enter is not Post", arrived at from the
      other side: a comment is prose, so the key that ends a paragraph must not file it
- [x] **It is on every surface at once** — the Hunt Board, Today, a project page and an area
      page all open the same `TaskPanel`, so the section arrived on four screens with no
      per-surface work
- [x] **"Delete this task" moved into the footer**, beside Cancel and Save. It had been the
      last thing in the *scrolling* body, so adding a comment thread pushed it further down a
      column that now grows without bound — a control you have to scroll to find is one you
      stop knowing is there. `mr-auto` rather than `justify-between` on the row: a new task
      has nothing to delete, and a two-child `justify-between` would fling Cancel to the far
      left the moment the button is absent
- [ ] **Nothing shows that a task has any.** A thread is invisible until you open the row, and
      the fix is `_count.comments` on a query already running plus a badge on three tight card
      layouts — deliberately not spent here. §6
- [ ] **Comments are plain text**, matching `Notes` beside them. The Markdown toolbar takes any
      textarea ref (Phase 5.3), so this is four lines whenever it is wanted
- [ ] **Not seen on a real phone**, unchanged since Phase 4.8 — the section is one column of
      full-width rows inside a panel that was already checked at 390px

### Phase 6 — Ledger (money) ✅
_Started 2026-08-12, finished 2026-08-14. The Home & Money area has existed since the first seed and held
**nothing** — no projects, no docs, no tasks — while the money side of life sat across four
bank apps, an AppFolio owner portal and a shoebox for April. Four asks: link the banks and
see analysis per account; add the rental properties; sum it all into a net worth with a
real breakdown; and a place to see how to use the tax rules to minimise what comes out of
pocket._

_**The standing requirement, given emphatically, is "automate everything — I don't want to
do anything manual."** That drives every decision below, and where something genuinely
cannot be automated it is named rather than quietly left as a form._

**Decided with the user before any code**: Plaid for bank data (transactions, investments,
liabilities); net worth covers banks, brokerage, retirement, cards and loans but
**deliberately not** crypto or vehicles; AppFolio statements arrive **through Gmail**
because there is no owner-facing AppFolio API; RentCast for the property valuation;
a **real** tax estimate engine; built in ordered layers.

#### Layer 1 — accounts, balances, net worth ✅ _(2026-08-12)_
- [x] **`/ledger` is the fifth surface** — one entry in `lib/nav.ts`, which is exactly what
      §6 predicted ("slots in as one more surface without disturbing anything… the test the
      IA is built to pass"). The icon rail, the mobile tab bar and `surfaceForPath` all read
      that array, so none of them changed
- [x] **`lib/money.ts`** — integer cents, and the argument against `Decimal` (§8)
- [x] **`lib/ledger-rules.ts`** — client-safe; `netWorthSideFor`, `netWorthGroupFor`,
      `kindFromPlaid`. The sign convention lives here and nowhere else
- [x] **`lib/crypto-box.ts` + `lib/secret-store.ts`** — AES-256-GCM, and the
      `lib/media-store.ts` seam applied to secrets: **exactly one module names
      `accessTokenEnc`**
- [x] **`lib/plaid.ts`** hand-rolled, no SDK (§8); `lib/plaid-sync.ts` is the ingest boundary
- [x] **`LedgerJob`** and `ensureLedgerJobs()` — the materialise-on-read bargain, plus the
      thing `ensureSeriesSlots` never needed: a visible failure. §6, "Automation that stops
      without saying so"
- [x] **Net worth + Accounts tabs, and `/ledger/connections`** — the `/studio` +
      `/studio/channels` shape
- [x] **`--color-bad`** in both themes, with a usage rule (§8)
- [x] **`scripts/ledger-check.mts`** (54 golden cases) and **`scripts/ledger-smoke.mts`**
      (end-to-end against the real database, cleaning up after itself)
- [x] **`proxy.ts` exempts `api/ledger/jobs/run`** — found by curling it. See §9
- [ ] **Not seen in a browser.** The Chrome extension has no host permission for
      `localhost:3100`, so the surface has been verified by build, typecheck, lint, both
      check scripts and curl — and not by looking at it. Unchanged in kind from the phone
      gap every phase since 4.8 has recorded, but this one is a desktop gap too
- [ ] **Plaid Production is an application and a bill.** Layer 1 is built against Sandbox

#### Layer 2 — transactions, holdings, liabilities ✅ _(2026-08-12)_
- [x] **`Transaction`, `Security`, `Holding`, `LoanDetail`** — migration `_ledger_transactions`,
      17 statements, every one a CREATE
- [x] **`/transactions/sync`, cursor-based** — and **the cursor is not advanced if any row was
      skipped.** §6, "A cursor you advance past a row you did not write"
- [x] **The sign inversion**, once, in `lib/plaid-sync.ts`. Plaid reports a debit as positive
- [x] **A pending row is deleted when the posted one arrives** — Plaid issues a *new* id and
      points back at the old one rather than modifying it, so both sit there and every total
      counts the purchase twice
- [x] **A hand-set `category` or `note` survives a re-sync** — the seed's `update: {}` rule,
      one noun over. Verified against live sandbox
- [x] **Holdings are replaced wholesale**, so a sold position leaves the net worth
- [x] **`LoanDetail.ytdInterestCents`** — the Schedule E mortgage-interest line, arriving
      monthly instead of on a 1098 in February. Sandbox reports **$12,300.40** and an address,
      which is what Layer 3 will match a property against
- [x] **The webhook, with ES256 verification** — `dsaEncoding: "ieee-p1363"`, the body hash
      over raw bytes, a five-minute `iat` window, `alg` pinned rather than read. Enqueues and
      returns 200; never works inline
- [x] **`proxy.ts` exempts the webhook too** — one path, not a prefix. Verified that
      `/api/ledger/statements/[id]` still 302s
- [x] **The transfer matcher** — equal and opposite, different accounts, within four days.
      Un-marks a pair that stops matching
- [x] **Spending analysis** — twelve months in/out, this month by category, and a single
      recurring figure (a merchant within 15% of its median in three of four months)
- [x] **Three chart shapes, hand-built** (§8). Two of them turned out not to want SVG at all
- [x] **`scripts/ledger-live.mts`** — the whole stack against real Plaid sandbox, cleaning up
      after itself
- [ ] **The webhook has never received a real delivery.** It needs a public URL, so it is
      verified by unit-testing the verifier and by curling the endpoint — not by Plaid calling
      it. Safe, because the read-triggered catch-up makes it an optimisation
- [ ] **Sandbox never produces a matched transfer pair** (one institution), so the matcher is
      exercised against synthetic rows in `scripts/ledger-smoke.mts` instead

#### Layer 3 — property ✅ _(2026-08-13)_
- [x] **`Property`, `PropertyValuation`, `PropertyLoan`, `Lease`** and `Transaction.propertyId`
      (`SetNull`). Migration `_ledger_property` — one nullable `ADD COLUMN` on an existing
      table, everything else a CREATE
- [x] **A property mints a companion Project** in Home & Money, with `cadenceDays: null` so it
      can never "drift". §6, "A property is money; its project is the work"
- [x] **A property with no valuation contributes nothing to net worth** — never its purchase
      price. §6
- [x] **The mortgage is suggested, never assigned** — `getLoanCandidates` scores the
      servicer's address and stops. §6
- [x] **`--color-bad` earns its second use**: the owed bar against the value
- [x] **RentCast**, hand-rolled, with the quota guard *inside the job* — a refusal is a
      recorded result, not a retry against a limit that resets on the 1st
- [x] **The range is stored and shown**, never the point estimate alone
- [x] **`lib/property-rules.ts`** — client-safe parsing and the two guards, extracted because
      a `"use server"` module cannot be called from a script at all. §9
- [x] **The Property tab does not require a bank** — an address is the one fact no aggregator
      can supply, so it is the one form on the surface
- [x] `scripts/property-check.mts` — parsing, both guards, and the read path against real rows
- [ ] **RentCast has never been called.** No `RENTCAST_API_KEY` yet; the client, the quota
      guard and the job are written and the network call is unexercised
- [ ] **The loan-address matcher scored 0.67 on a synthetic pair** and has never seen a real
      servicer string

#### Layer 4 — statements ✅ _(2026-08-13)_
- [x] **`PropertyStatement`, `StatementDocument`, `StatementLineItem`** — migration
      `_ledger_statements`, every statement a CREATE
- [x] **A statement cannot be accepted until it reconciles to the cent.** §6, "The document
      carries its own checksum". Verified against a real PDF, and verified to *fail* when a
      row is removed
- [x] **`unpdf`** — the one dependency this phase adds, and it has **zero of its own**
      (18 lines in the lockfile). §8
- [x] **`lib/deepseek.ts`** — moved out of `lib/montblanc/`, since the Ledger is its second
      consumer and "swapping providers is a one-file change" only survives if there is one
      file. Gained `completeJson` with `response_format: json_object` and `temperature: 0`
- [x] **The Gmail grant is separate from sign-in** — its own row, its own consent, its own
      lifetime. §6
- [x] **The hash, not the message id, is what makes ingestion idempotent** — a forwarded copy
      or a re-scan after a failure is the same document
- [x] **Uploading is a first-class path**, which is what made the pipeline testable before
      any OAuth existed
- [x] **`app/api/ledger/statements/[id]`** — auth-gated, `private, immutable`, and confirmed
      to still 307 while the webhook and job runner 401
- [x] **`scripts/statement-check.mts`** builds a **real PDF** — actual bytes, text operators,
      correct xref offsets — and runs it through `unpdf`, the model, and the reconciliation
- [x] **`scripts/ledger-reset.mts`** — clears Ledger rows only, so a crashed check does not
      block the next one
- [ ] **Gmail has never been connected.** The grant flow, the poll, the query and the
      attachment decode are written and unexercised — it needs a consent screen and a second
      redirect URI on the Google OAuth client
- [ ] **The test PDF uses a standard font**, so it exercises `unpdf`'s easy path. A real
      AppFolio statement embeds a subset font, which is exactly the case §8 said a
      hand-written extractor could not handle — and exactly what this fixture cannot prove
- [ ] **Reconciliation cannot catch a mislabelled row.** A repair booked as insurance adds up
      perfectly and is wrong on the Schedule E. Hence no auto-accept, and `rawText` on every
      row

#### Layer 5 — tax rule sets, depreciation, Schedule E ✅ _(2026-08-14)_
- [x] **`TaxRuleSet`, `TaxProfile`, `DepreciableAsset`, `TaxCarryforward`, `TaxStrategyNote`**
      — migration `_ledger_tax`; the only change to an existing table is a nullable
      `Transaction.assetId`
- [x] **The rule sets ship with every numeric leaf `null`.** No tax constant in this app comes
      from a model's memory. §6, "A tax figure that is wrong looks exactly like one that is
      right"
- [x] **A rule set with any unconfirmed number is unusable** — not "used with defaults". The
      engine reports *not computed*; `missingFigures` walks the payload so a newly added
      constant cannot be forgotten
- [x] **`FEDERAL_SOURCES` / `CALIFORNIA_SOURCES`** name the document each group comes from, so
      confirming is looking one thing up rather than searching for it
- [x] **MACRS 27.5-year straight line, mid-month** — and the number of full years **depends on
      the start month**, which is where the one real bug was
- [x] **5- and 15-year MACRS derived from the declining-balance formula**, not transcribed —
      there is no table to mistype, and the output is checkable against Pub 946
- [x] **`buildingBasisCents` refuses without the land split.** The gap between a 15% and a 30%
      allocation on a $985,000 property is ~$2,700 a year, in a figure that looks equally
      authoritative either way
- [x] **Schedule E from three sources, each labelled** — accepted statements, claimed
      transactions, and the servicer's YTD interest. Only `accepted` statements count
- [x] **A capital improvement is excluded from expenses** once promoted to an asset, or it
      would be deducted twice — in full now and again over 27.5 years
- [x] **Preferential rates stack on ordinary income** — the part people get wrong
- [x] **The tab is called "Tax estimate"**, the rule-set card sits above the figures, and
      "What this does not model" is permanent and enumerated. §6
- [x] `scripts/tax-check.mts` — 49 golden cases, no network, no database
- [ ] **Not one tax constant has been confirmed yet.** The skeletons are empty by design, so
      the Tax tab currently computes nothing and says so. Filling them in is Layer 7's draft
      flow plus a person
- [ ] **`TaxProfile` has no editor yet** — the model exists and nothing writes it

#### Layer 6 — the estimate pipeline ✅ _(2026-08-14)_
- [x] **SE tax, §469, §199A, NIIT, federal brackets, California** — one file each, pure
- [x] **The ordering is the design**, and two steps that look circular are not. §6
- [x] **Wages consume the OASDI wage base first** — the commonest way an SE figure comes out
      far too high
- [x] **A disallowed rental loss suspends rather than vanishing**, and `TaxCarryforward` is
      what makes the app a planning tool rather than one that understates what you own
- [x] **§199A returns a checklist, never a computed yes.** Rev. Proc. 2019-38's safe harbour
      is three conditions and the app can only see one of them
- [x] **Above the §199A threshold the W-2/UBIA limits are declared unmodelled**, so the figure
      is labelled an upper bound rather than presented as the answer
- [x] **California is a different tax, not a percentage** — no QBI, no bonus depreciation,
      gains as ordinary income, credits not exemptions. Its separate passive-loss bookkeeping
      is declared unmodelled rather than approximated
- [x] **A broken California rule set refuses** rather than quietly reporting federal-only
- [x] **An incomplete Schedule E withdraws the whole estimate** — the rental's net feeds AGI,
      so a missing depreciation line would silently overstate it
- [x] **`EstimateFigure` puts the caveat on the number**, at every one of ~40 sites, and
      badges every figure derived from draft constants
- [x] **`TaxProfile` has an editor**, and blank ≠ zero in it
- [x] `scripts/engine-check.mts` (58 cases) and `scripts/tax-view-check.mts` (refusals in
      context, against the real database)
- [ ] **The estimate has never run on confirmed constants**, because none are confirmed. The
      checks fill a skeleton with invented values to exercise the path
- [ ] **AMT, K-1s, 1031 exchanges, a mid-year move and most state credits are not modelled**,
      and are enumerated permanently on the tab

#### Layer 7 — strategies and rule updates ✅ _(2026-08-14)_
- [x] **`lib/tax/strategies.ts` — hand-written, in git, never LLM output.** Nine entries, each
      a predicate plus a sentence. §6
- [x] **Every entry is a question addressed to a third party**, and the only action anywhere
      is *Mark as raised*. There is no button that says "Do this"
- [x] **`applies` returns three answers**, because `maybe` is where most of the value is — the
      ones that clearly fit you have usually already done
- [x] **The amount is an order of magnitude, not a promise**, and the card says so
- [x] **A declined strategy is per-year**, so it stops resurfacing now and returns when the
      facts have changed
- [x] **`lib/tax/rules-update.ts`** — fetches the published source, extracts with a per-figure
      **verbatim source line**, and files a `draft`. A value arriving without its source line
      is discarded
- [x] **A source covering the wrong year is discarded entirely**, not merged — last year's
      numbers filed as this year's would look completely normal
- [x] **The draft writes to `provenance`, never to `payload`.** Confirming is what moves a
      value across, so nothing is live until a person reads it
- [x] **Confirming the last figure flips the set to `verified` automatically** — there is no
      button declaring a rule set finished while it still holds a null
- [x] **`RuleSetDiff` puts the number beside the sentence it came from**, and the number is
      editable. Confirming is reading, not looking up
- [x] Drafting is queued only past **15 October**, when the IRS has actually published
- [x] `scripts/strategy-check.mts` — 27 cases, predicates and the confirm round trip
- [ ] **The updater has never fetched a real page.** The URLs, the extraction contract and the
      wrong-year guard are written and unexercised against live IRS or FTB HTML
- [ ] **Unrealised losses are not known**, so the harvesting strategy sizes itself without one
      — Plaid reports cost basis only where the institution supplies it

#### Layer 8 — Montblanc, and the guide ✅ _(2026-08-14)_
- [x] **Four tools, and none of them creates money** — `find_transaction`,
      `claim_transaction`, `categorise_transaction`, `mark_strategy_raised`. §6
- [x] **Undoing a filing releases the claim; it never deletes the transaction** — a bank row is
      a payment that really happened
- [x] **`claim_transaction` refuses a row already filed elsewhere**, which is what makes the
      undo safe: the state before is always unclaimed
- [x] **Two prompt rules**: never invent an amount, a transaction date or a tax figure; never
      state a tax conclusion
- [x] **The context names accounts and properties and carries no figures** — a number in the
      prompt is one the model can repeat back stale
- [x] **`ReceiptKind` gained `transactionClaim`**, and the drawer's exhaustive maps caught it
      at compile time
- [x] **`docs/ledger.md`** — the guide §9 requires for every surface
- [x] `scripts/montblanc-ledger-check.mts` — 25 cases
- [ ] **The tools have not been driven through the drawer against the live model.** They are
      exercised at the schema, registry and database level; what is untested is the model
      choosing them

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
| **Task** | A task. Belongs to a Project, or floats in an Area for one-offs. Since 2026-08-06 it can carry a **checklist** of subtasks — the same model, one level deep — and since 2026-08-11 a **log of dated comments**. | "Fix collision bug" | Constant |
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

### A phone's chrome is mostly ornament — decided 2026-08-08

On a phone the topbar and the tab bar are **~124px of an 844px viewport**, and nearer a
fifth of a small one. That is a fixed tax on every screen, and the topbar in particular is
paying it with a **disabled** search field, a date that is hidden below `lg` and a
notifications button that is hidden below `md` — so most of the widest element on the screen
is a control that does nothing yet. So both slide away on a downward scroll and come back on
**any** upward one.

The second half is the load-bearing one. The tab bar is the **only** navigation a phone
has — the sidebar is a drawer opened from the topbar, so hiding both hides the way to
everything — and it is only safe because getting them back is a flick in the direction you
were already going to read what you just scrolled past. Nothing needs to be found; you
already know how.

Five things fell out, each chosen over an obvious alternative that fails:

1. **They are overlays, not rows that collapse.** Collapsing a flex row changes the
   document's height while your thumb is on it, so the content jumps as you read. An
   overlay slides over a page that never moves, and the space it vacates is filled by what
   was already scrolling up into it — which is the space actually being reclaimed. The
   stage's top padding is only ever seen at scroll-top, where the header is showing anyway.
2. **A fixed 64px mobile topbar.** The height had been intrinsic (76px, set by the search
   pill), and an overlay's height has to be known by the thing padding around it. The
   alternative is measuring it into state, which means a `setState` in an effect — the
   thing §9 already records the React Compiler correctly refusing. Pinning the height is
   both simpler and 12px cheaper.
3. **The travel threshold banks, it does not discard.** A reading under 12px leaves `last`
   alone rather than updating it, so a slow drag accumulates toward the threshold instead
   of resetting under it forever. Discarding is the version that feels broken only on the
   gesture that needs it most.
4. **Arriving on a surface always shows them**, adjusted during render rather than in an
   effect. Without it, a project card tapped from halfway down Today lands you on a page
   that might not scroll at all, with no navigation on screen and no gesture that summons
   it — a dead end reachable in two taps.
5. **Only below `md`.** A desktop has no shortage of screen, and chrome that moved while
   you scrolled would be motion for nothing. The hidden class is still applied at every
   width and a `md:` override beats it, which is one media-query rule rather than a second
   branch to keep in step.

### An app you install, not a URL you remember — decided 2026-08-09

Every phase since 4.8 has recorded the phone as the device this is really for, and every
one of them worked on what happens **after** the app is open. The thing actually costing
the most was one step earlier: opening Safari, remembering that the address is a Railway
subdomain, and typing enough of it to find it in history.

**No change inside the app can fix that**, which is why this is the first phase that is not
about a surface. What fixes it is the web app manifest plus a service worker — Add to Home
Screen, and thereafter an icon beside every other app, opening straight to Today with no
address bar.

Five decisions, each chosen over an obvious alternative that fails:

1. **`start_url` is `/today`, not `/`.** Opening the app should land on the screen it
   exists for. `/` only ever redirects there, so this is a round trip removed from the
   slowest moment there is — a cold launch on a phone.
2. **`display: "standalone"`, not `fullscreen`.** The OS status bar stays. Going fullscreen
   would hide the clock and the battery on an app whose entire subject is what time it is
   and what is left of the day.
3. **The icons are generated PNGs, not the SVG the app already has.** `apple-touch-icon`
   has never supported SVG and Chrome's support for SVG manifest icons is patchy — and the
   failure mode is a blank square on the one screen this whole change exists to improve.
   `scripts/generate-icons.mjs` redraws the mark from three primitives and encodes the PNG
   itself, because pulling in an image library to produce four files that change once a
   year is the larger cost. A **maskable** copy exists separately and is drawn smaller:
   Android masks a home-screen icon to the launcher's shape, and an "any" icon fed through
   that mask loses the pom off the top.
4. **The install files are exempt from the proxy.** The browser fetches the manifest, the
   icons and the worker *before* anyone has signed in. Gated, each one 302s to /login — a
   manifest that fails to parse costs the install prompt outright, silently, with no error
   anywhere but a devtools line nobody is reading. None of them is private: a name, a
   moogle, and a twenty-line cache policy.
5. **`apple-mobile-web-app-capable` is written by hand.** Next's `appleWebApp.capable`
   emits the standardised `mobile-web-app-capable`, which Safari only began honouring in
   iOS 17. On anything older the installed icon opens **in Safari, with the address bar** —
   which is precisely the complaint, arrived at by a longer route.

Two smaller things fell out. **`viewport-fit: cover`**, because `env(safe-area-inset-*)`
returns zero without it — the tab bar has carried `pb-[env(safe-area-inset-bottom)]` since
it was written and had never once been able to use it, since in a browser tab the home
indicator is Safari's problem. And **the theme-color meta now follows the theme**: installed
there is no browser chrome, so the OS paints the status bar with that tag, and left static
it is a light strip above a dark app all night — the one piece of the window §11 never
reached.

**A custom domain is the other half and is not code.** It is a Railway setting and a DNS
record. The install is what makes the URL stop mattering day to day; the domain is what
makes it cheap to re-install, or to open on a device that has not got the icon yet.

### Montblanc is a command bar, not a chatbot — decided 2026-08-09

The ask names the problem precisely: _"sometimes I want a quick — add this bug to this app,
add this idea to social media, add this app idea — and I have to navigate around the board
and sometimes forget where things are."_ That is **a filing problem and a wayfinding
problem**, and neither is solved by conversation. So Montblanc is a thing you say one
sentence to.

The distinction is not cosmetic; it decided most of what follows:

1. **The transcript is not kept between opens.** Each open is a blank sheet. A chat you have
   to scroll past to start the next thought is a chat, and the whole premise is that this is
   faster than walking to the screen.
2. **It streams *events*, not tokens.** `MontblancEvent` carries "Writing it down…", then a
   receipt, then one sentence — because the useful thing to watch during the four seconds a
   tool round takes is **which tool is running**, not prose being assembled. Token streaming
   is also the one part of a provider SDK that is genuinely hard to write, so not needing it
   is what made hand-rolling the client obviously right rather than merely defensible (§3).
3. **The reply is one sentence.** "Added it to Sleepy Cat under Build." A dashboard assistant
   that writes paragraphs is one you stop reading, and the row it made is the actual output.
4. **It cannot edit or delete**, beyond ticking a task off and undoing its own writes. It is
   a way *in*. Changing something means opening it, where you can see what you are changing —
   the same argument §6 already makes about the calendar not being an editor for tasks.

**It took the search pill's place, and that is the point rather than a convenience.** That
control was the widest element on a phone and it was **disabled** — §6's own "A phone's
chrome is mostly ornament" complains about it by name. Asking for something in a sentence
also strictly contains searching for it: "what's overdue" is a search, and "add a bug to
Sleepy Cat" is not a query anybody could have typed there.

### A transcript is not a memory — decided 2026-08-10

The ask was for Montblanc to carry "some context of what I'm concerned about, my state of
mind, and how it changes". The obvious reading is a chat history, and §6 has refused one
since Phase 5: _"a chat you have to scroll past to start the next thought is a chat"_.

**That refusal is about the drawer, and it was never an argument against the app knowing
anything.** So the drawer still opens on a blank sheet, and three tables sit underneath it:

| Layer | What | Reaches the model? |
|---|---|---|
| `MontblancConversation` + `MontblancMessage` | everything said, verbatim | **never** |
| `MontblancNote` | dated one-liners distilled from it | ~15 live ones |
| the injection | those notes, in the system message | ~200 tokens |

**The log is never in the prompt**, which is the same trade this file already made against a
`list_projects` tool: a whole extra round trip on every request to carry text that changes
once a fortnight. Notes are that bargain done properly — small, current, no extra hop.

**Dated notes rather than one rolling summary**, because *how it changes* is half of what was
asked for. A summary you overwrite records the present by destroying the past. A note that can
be **superseded** records both: "worried the paywall isn't shipping", live 10 Aug, superseded
the day it shipped, is the change itself. Superseding is also what the × in the drawer writes,
so Montblanc retiring a note and you removing one are the same act on the same row.

Five things fell out, each chosen over an obvious alternative that fails:

1. **Behaviour, not feelings — and this is the honest half of "state of mind".** A command bar
   is a poor mood sensor: most turns are "add a bug to Sleepy Cat", which reveals nothing
   emotional, and a model asked for a mood will produce one. So the distiller is told, in
   those words and with worked examples, to record what is being returned to, deferred or
   preferred, and never to infer how anyone feels. Guessing would be the app asserting things
   nobody told it — the oldest rule here — about the one subject where being wrong is worst.
2. **A filing turn writes nothing.** "Add a bug to Sleepy Cat" teaches nothing about anybody,
   and an empty result is stated to be the common and correct answer. A memory that grows on
   every use is one that fills with the fact that you use it.
3. **It chooses; it does not speak.** Notes decide which task gets led with and how big a
   thing gets suggested, and then the answer reads as ordinary good judgement about the board.
   **This is the sprint's lesson and it is the whole risk of the feature**: that surface died
   because the screen opened twenty times a day became the one keeping score, and an assistant
   reciting your patterns back is that screen with a voice. The rule needed *examples* rather
   than a prohibition — told only "never repeat them back", the model still opened with "you
   keep circling the paywall without shipping it". The prompt now bans the specific
   constructions ("you keep", "you tend to", "as usual") and shows a good and a bad answer for
   the same note. The one exception is being asked outright.
4. **The notes are visible and removable.** This is the memory's half of the receipt bargain:
   Montblanc may conclude things about you between conversations without asking **because**
   you can see what it concluded and one tap takes it away. Without that the feature is a
   seeded task one layer up — a claim about your life that you did not make and cannot find.
5. **The sweep is not a cron.** `ensureDistilled()` runs on drawer open, idempotent, picking
   up whatever the on-close call never delivered. `ensureSeriesSlots` has kept the posting
   cadence alive on exactly this bargain since Phase 2, and there is nothing here worth
   standing infrastructure up to run.

**A thread can also be picked back up for thirty minutes**, from `localStorage`, offered on one
line in the empty state. That is a smaller decision and it is not a reversal: it is a link, not
a restored chat, and closing the drawer mid-thought was losing work the "fresh sheet" rule was
never about. Continuing it is genuinely the *same* conversation — `recordExchange` clears
`distilledAt`, so a resumed thread is re-read whole rather than losing the half that arrived
after the first close.

### The reply is rendered by the thing that renders — decided 2026-08-10

Montblanc's replies were plain text in a `<p className="whitespace-pre-wrap">`, so a model that
reaches for Markdown whether or not anyone asked it to produced `**Due today:**` on screen,
asterisks and all. `components/ui/markdown.tsx` has parsed exactly that subset since the Docs
tab was built. Nothing needed writing; the two had to meet.

The prompt was the larger half. It said "answer in ONE short sentence" and said nothing about
answering a *question*, so a question got an improvised briefing — and the briefing **re-listed
in prose the twelve rows `find_tasks` had already put on screen as cards.** Three rules now:

1. **Two answer shapes.** One sentence after a write; a short list after a question.
2. **Only the syntax the renderer renders**, named exactly, with what to avoid and why — no
   headings (a 440px drawer is not a document), no tables (`lib/markdown.ts` prints raw
   pipes), no nested bullets (`parseMarkdown` strips indentation, so they flatten into
   siblings), no `__bold__`. This is §6's "The toolbar offers what the renderer can render",
   turned around: **the model may only emit what the renderer can render**, for the same
   reason — syntax the app then refuses to honour teaches you a thing that isn't true.
3. **Never restate the cards.** The rows are on screen; the sentence underneath says which one
   matters and why, which is the thing a card cannot say.

**An in-app link became a Next `<Link>`** in the same edit. `safeHref` has always admitted
`/…`, and every one of them was rendering as `<a target="_blank">` — so a doc linking to
another doc opened a new tab and left the app. External links are untouched.

### Every write goes through the UI's own action — decided 2026-08-09

`lib/montblanc/tools.ts` builds `FormData` and calls `saveTask`, `saveContentItem`,
`saveProject`, `saveEvent`, `saveJournalEntry` — the same functions the forms submit to. It
reads oddly for a machine-to-machine call and it is the cheaper half of the trade, because
**the invariants live in those actions and nowhere else**:

- a task's area is taken from its project, so the two can never disagree;
- a recurring task with no due date gets its first occurrence inferred, rather than becoming
  a rule that never fires;
- a project's slug is minted once and never follows a rename;
- a journal entry's day comes from the server's clock and cannot be supplied.

Talking to Prisma directly is shorter and would mean the app has two ways to create a task
with only one of them right — and worse, that a rule added to `saveTask` next month silently
does not apply to the assistant. Undo goes through `deleteTask` / `deleteProject` / … for the
same reason: `deleteProject` refuses one that holds anything, and that refusal should not
have a second door.

**Nothing that fails is retried somewhere near.** A project name that doesn't resolve returns
`FAILED: no project called "…"` with an instruction *not* to retry with a different one. The
model's own instinct is to be helpful and file it under the nearest match, which is exactly
the failure this whole file is about — and it is worse from an assistant than from a seed
script, because a seeded row at least came from a file you can read.

### What exists is in the prompt, not behind a tool — decided 2026-08-09

The obvious build gives Montblanc a `list_projects` and lets it go and look. That costs a
whole extra model round trip — three or four seconds, on a phone, on **every** request — to
fetch about two thousand characters that change roughly once a fortnight. Four areas, four
projects, three brands with their twenty accounts, and the track list are simply handed over
up front, so "add a bug to Sleepy Cat" needs one model call instead of two.

It is also what makes the slugs reliable: the model is **choosing from a list it can see**
rather than guessing an identifier, which is the difference between the write landing on
`sleepy-cat` and it inventing `sleepycat`. The resolver still accepts a display name
case-insensitively, because a model reaches for the label it was just shown, and failing a
write over that would be a bad reason to fail a write.

### A receipt is what a confirmation step would have cost you — decided 2026-08-09

Montblanc writes straight through. It does not show a draft and wait for approval, and this
is the one decision here that runs *against* the grain of everything in §6 — so it is worth
being exact about why.

The rule this file keeps arriving at is **the app must not assert things nobody told it**,
and an assistant that can write rows is the first thing in the app capable of committing that
error at speed. The reflex fix is a confirm step. It fails on the ask: "quick — add this bug",
one-handed, and a confirmation turns one tap into two on *every* row, including the
ninety-five in a hundred that were right. A command bar you have to approve is a form.

§6 already priced the alternative, under "Nothing but you creates a task": _"a row you wrote
and no longer want costs one tap to delete. A row **you did not write** costs you a stop, a
re-read, and a decision about whether it was yours."_ Montblanc's rows sit between the two —
you asked for the thing, but the *filing* was its idea. **The receipt is what moves them into
the first category.** You see exactly what was made and where it landed without going to
look, and undoing is one tap in the same place.

Three details it needed:

1. **The card stays after being undone**, greyed and struck through, saying "Removed". A card
   that vanishes when pressed leaves you unsure whether it deleted the row or just the card.
2. **The prompt does most of the work anyway.** No invented due dates, no guessing between
   projects, exactly one row per thing asked for, no notes that were not dictated. The
   receipt catches what the prompt misses; it is not the only line of defence.
3. **A write has to `router.refresh()`.** This came through a route handler rather than a
   server action, so `revalidatePath` marks the server cache and nothing tells the client
   router to re-render. Without it you close the drawer onto a Today that does not have the
   task you just watched it make.

### The service worker caches nothing that changes — decided 2026-08-09

It has two jobs and refuses a third. It makes the app installable (a manifest gets you an
icon; browsers ask for a worker with a fetch handler before they offer to *install*), and
it replaces the browser's offline error with a page that looks like this app.

**It very deliberately does not cache the app.** The reflex with a service worker is a
cache-first shell, and here that is actively harmful: every surface is a server-rendered
view of a database that changes as you use it, so a cached shell shows last Tuesday's tasks
and lets you tick them. "Why is it showing me the wrong thing" is a far worse failure than
"it needs signal" — it is the same objection this file has raised at every seeded task and
invented event, one layer down. **The app must not assert things that are not true**, and a
stale cache is that assertion made by machinery rather than by a seed script.

So: navigations go to the network, and the cache is consulted only once the network has
actually failed. Everything else — assets, server actions, the auth callback, the journal's
media route — is passed through untouched, which is also what keeps auth out of it. Nothing
in the worker touches a non-GET request, an `/api` route, or another origin, so no session
and no upload can ever be served from a cache.

The offline page is **self-contained**, and that is a requirement rather than tidiness: none
of the app's CSS or fonts are cached, so anything it referenced would fail for exactly the
reason the page is being shown. It reads the theme out of localStorage for the same reason
`THEME_BOOT_SCRIPT` exists — arriving at a white card at midnight is the flash §11 already
went to some trouble to prevent.

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
- **TaskComment** — taskId, body (plain text), createdAt. What *happened* on a task, as
  opposed to `Task.notes`, which is what the task *is*. **The stamp is the server's
  clock and there is no edit** (§6, "The date is not a field"). Cascades with its task,
  like a Doc. Read only by the task panel, so it is deliberately **not** on
  `TASK_VIEW_SELECT` — see §6, "A note is what it is, a comment is what happened" ✅
- **Doc** — projectId **or** areaId (both nullable, exactly one set — enforced in
  `lib/doc-actions.ts`), slug (minted once, never follows a rename), title, body
  (Markdown), sortOrder. Cascades with its owner — the only relation that does.
  Was `ProjectDoc` until 2026-08-05 ✅
- **JournalEntry** — areaId **or** projectId (both nullable, exactly one set — enforced in
  `lib/journal-actions.ts`, and **create-only**, so an entry never moves owner on a save),
  happenedOn (`@db.Date` — **set once from the server's clock and never editable**, §6, "The
  date is not a field"), title (nullable), body (Markdown). Cascades with its owner, like a
  Doc. Points **backwards**: no due date, no status, nothing to tick. See §6, "The journal"
  and "A journal belongs to whatever it is a record of" ✅
- **JournalMedia** — entryId, data (`BYTEA` — in Postgres on purpose, §6), mimeType, width,
  height, byteSize, **kind** (`photo` | `video`), **durationMs** (nullable, video only),
  caption, sortOrder. Cascades with its entry. **Nothing but `lib/media-store.ts` selects
  `data`**. Was `JournalPhoto` until 2026-08-06 ✅
- **Event** — id, title, notes, location, start, end (both real timestamps, `end`
  inclusive), allDay, recurrence (`none` | `daily` | `weekdays` | `weekly` |
  `monthly`), daysOfWeek, repeatUntil (`@db.Date`, null = forever), areaId,
  projectId (nullable) ✅
- **MontblancConversation** — one opening of the drawer. `id` is minted by the client, so
  "one conversation" is one sitting; `distilledAt` is null until read, which is the whole of
  the sweep's query ✅
- **MontblancMessage** — conversationId, role (`user` | `assistant`), content. **Nothing
  reads this into a prompt** — it is what the distiller reads once, and the record behind a
  note you don't recognise ✅
- **MontblancNote** — kind (`concern` | `focus` | `preference` | `decision` | `fact`, free
  text for the reason `Task.track` is), text, createdAt, `supersededAt` (set when a later
  conversation resolves it, or when you press the × — never deleted, because when it stopped
  being true is worth as much as that it was), sourceId (`SetNull`). **These are the only
  part of the memory the model ever sees.** §6, "A transcript is not a memory" ✅
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

### A note is what it is, a comment is what happened — decided 2026-08-11

`Task.notes` is **one field you rewrite**, and rewriting it destroys what it said before.
That is right for what a task *is* — the definition, the acceptance condition, the thing
you re-read before starting. It is wrong for everything you find out along the way, and
before this there were two equally bad homes for that.

- **Append to `notes`** and you get an undated wall with no order in it. "The export times
  out at 30s" and "it was the proxy, not the query" are two facts from two days, and the
  field can only tell you they are both in there somewhere.
- **A subtask** and you have declared something to *do*. A finding is not a step, and
  filing it as one makes the checklist — whose whole job is "the last box finishes the
  job" — carry rows that can never be the last box.

So a `TaskComment` is a row per moment. It is the same distinction `JournalEntry` draws
against `Doc`, one noun over: a page you maintain, versus a dated record you add to.

Five things fell out, each chosen over the obvious alternative:

1. **The stamp is the server's clock and there is no way to move it.** §6, "The date is not
   a field", which the journal arrived at the hard way — a time somebody chose is a claim,
   a time that came from a clock is a fact, and reading a thread back is only worth doing
   because its order is the order things actually happened in.
2. **There is no edit, either**, which goes one step further than the journal does. The
   journal allows one because an entry is a paragraph you were composing; a comment is a
   sentence, and the honest fix for one that came out wrong is to delete it and say the
   thing again — stamped with when you said it, rather than silently rewriting what you
   knew on Tuesday.
3. **Oldest first, composer last.** Every *list* in this app is newest-first and this is
   not a list — it is the same shape as a day in the journal, one train of thought read
   forwards. The box you type into is the end of the thread rather than a form above it.
4. **Fetched when the panel opens, not carried on `TaskView`.** Nesting them in
   `TASK_VIEW_SELECT` the way the checklist is nested would pull every comment body on a
   board of ninety rows to render a board that shows none of them — the checklist's
   argument ("never read apart from the row it belongs to") does not transfer, because a
   comment is only ever read *inside the panel*. Same bargain as "only the active tab's
   heavy read runs" on a project page.
5. **Nothing revalidates.** No server-rendered surface reads comments, so re-rendering
   Today and the board to record a sentence neither of them displays is work for nothing.
   The panel holds its own copy, exactly as the checklist editor does and for the same
   reason: it was opened with a *snapshot*, so a revalidation would never reach it anyway.

**The honest cost is that nothing on any card says a task has a thread.** Making it visible
is `_count.comments` — cheap, on queries already running — plus a badge on the Hunt Board
row, Today's `TaskLine` and the kanban card, all three of which are one line tall by
deliberate correction (§6, "Stages and tracks answer different questions"). That is a
layout decision on three tight surfaces rather than a lookup, so it is written down here
rather than guessed at.

### A balance is a magnitude; whether it counts against you is a decision — 2026-08-12

The Ledger's first real design decision, and it is the one every figure on the surface
depends on. `Account.currentCents` stores what the institution reports: **always a positive
magnitude**, so a credit card with $2,300 outstanding stores `230000` and a current account
with $2,300 in it stores exactly the same number.

The reflexive alternative is to flip the sign at ingest, so a liability is stored negative
and the roll-up is a plain `SUM`. It is shorter and it is wrong, because **it puts an
interpretation in the database.** Two things follow from storing the magnitude instead:

1. **The column says what the statement says**, so a row can be checked against a bank
   screen without knowing anything about this app's conventions, and a re-fetch produces the
   same value it produced last time.
2. **Changing your mind is a function, not a backfill.** `netWorthSideFor(kind)` in
   `lib/ledger-rules.ts` is the only place that decides, and it is client-safe — so the
   account list, the composition bar and the snapshot writer cannot disagree about what a
   mortgage means. Had the sign been baked in, deciding that a HELOC should be netted
   against the property rather than listed as debt would be a migration.

`scripts/ledger-smoke.mts` exists mostly to hold this in place: five accounts, two of them
liabilities, asserting that $250,000 of assets and $403,000 of debt come out at −$153,000
rather than at $653,000. That is the failure a sign convention produces, and it is not one
you notice by looking — the number is plausible.

**Plaid's transaction amounts get the opposite treatment**, and the asymmetry is
deliberate. Plaid reports a debit as a *positive* number, which is right from the
institution's side of the ledger and backwards from ours; every sum, category roll-up and
Schedule E line reads naturally when positive means money in. So that one **is** inverted at
ingest, in `lib/plaid-sync.ts`, once. The rule underneath both is the same: a convention is
fixed at exactly one boundary, and it is written down at that boundary.

### The automation stops one step before the number goes live — 2026-08-14

"The engine will auto-update its rules and laws" was the ask, and the honest version of it
splits cleanly in two. **Fetching and extracting can be automated. Confirming cannot, and
will not be.**

`lib/tax/rules-update.ts` fetches the published source past 15 October, extracts what it can,
and files a `draft` beside the verified set. What it does *not* do is write into `payload` —
the extraction lands in `provenance`, and `confirmRuleFigure` is the only thing that moves a
value across. So a drafted number is visible, attributed, and **inert**.

The reason is the same one the whole tax layer rests on: a tax engine that silently rewrote
its own constants and got one wrong would be the worst failure this app could produce. Every
figure downstream would move, all of them would look authoritative, and nothing would
contradict them. So the automation ends one step early, on purpose.

Four details that make the remaining human step small enough to actually happen:

1. **Every figure carries the verbatim sentence it came from**, and a value arriving without
   one is discarded rather than kept. That is what turns confirming into *reading* — the
   reviewer compares a number against a quoted line instead of searching a 40-page Revenue
   Procedure for where it might be.
2. **A source covering the wrong year is discarded entirely**, not merged. Last year's numbers
   filed as this year's is the single most plausible-looking way this could go wrong, and the
   extraction prompt is told so in those words.
3. **The number is editable on the confirm row.** An extraction that misread a digit should be
   corrected by the person already looking at the source line, not re-run.
4. **Confirming the last outstanding figure flips the set to `verified` automatically.** There
   is deliberately no button that declares a rule set finished, because the engine's refusal
   to compute is keyed on there being no nulls left — a button would let the two disagree.

### A strategy is a question, never an instruction — 2026-08-14

`lib/tax/strategies.ts` is **hand-written, in git, and never LLM output**. A hallucinated §179
threshold is bad; an invented *election* is worse, because a bracket is a number somebody
might sanity-check and "you can elect X" is a sentence people act on. A strategy is a
predicate plus a sentence — which is code, and code belongs somewhere it can be reviewed.

**Every entry is phrased as a question to a third party.** The field is called `question`,
each begins "Ask your accountant whether…", and the only action anywhere on the card is *Mark
as raised*. There is no button that says *Do this*. That is structural rather than cautious:
the gap between "here is something worth asking about" and "here is what you should do" is the
gap between a tool and an unlicensed adviser, and the second is not what was asked for.

Three smaller decisions:

- **`applies` returns three answers, not two.** `maybe` is where most of the value is — the
  strategies that clearly fit are usually the ones already done, and the useful list is the
  near-misses. A `no` is not shown at all, so an always-on list cannot form.
- **The amount is an order of magnitude, not a promise**, and the card says so in those words.
  Every one of these turns on facts the app cannot see; the figure exists to say "worth an
  hour of somebody's time".
- **A declined strategy is declined *for the year*.** It stops resurfacing now and comes back
  next year, when the facts have changed. A permanent dismissal would quietly delete a
  question that becomes right later.

### Two orderings that look circular and are not — 2026-08-14

The tax pipeline's sequence is not a style choice, and in two places the obvious fix — iterate
to a fixed point — would produce a **different and wrong** answer. Both are worth stating
because both look, on first reading, like they need a loop.

**§469's phase-out tests a MAGI computed *without* the passive loss.** The special allowance
for a rental you actively participate in phases out over income; income is reduced by the
rental loss you are allowed to deduct. Statute settles it: the MAGI the phase-out looks at
excludes the loss itself. With $120,000 of salary and a $20,000 loss, the allowance is reduced
to $15,000 and $5,000 suspends. Fold the loss into MAGI and it becomes $100,000, the allowance
is the full $25,000, and the whole loss deducts — a different answer, arrived at reasonably.

**§199A's limitation is measured against taxable income *before* the QBI deduction.** The
deduction is capped at 20% of taxable income; taxable income is reduced by the deduction.
Again statute settles it, and again iterating converges somewhere lower.

Both have direct assertions in `scripts/engine-check.mts` rather than being left to the
totals, because a total is exactly the thing that would still look plausible.

**Self-employment tax runs before AGI** for the same family of reason: half of it is an
above-the-line deduction, so AGI depends on it and it does not depend on AGI. And within it,
**W-2 wages consume the OASDI wage base first** — $150,000 of salary against a $160,000 base
leaves $10,000 of room, so the SE charge on a $100,000 profit is a fraction of what it looks
like. That is the commonest way an SE figure comes out far too high.

### What the estimate refuses to do — 2026-08-14

Three refusals, and each is a place where producing *something* would have been easy and
wrong.

1. **An incomplete Schedule E withdraws the whole estimate.** A property whose depreciation
   cannot be computed has no net, and that net feeds AGI — so a missing line would not
   produce a gap, it would produce an AGI that is too high and a tax bill that is too large,
   with nothing on screen to say so. The blocker names the property.
2. **A broken California rule set refuses rather than reporting federal-only.** Quietly
   dropping a state is the difference between an estimate and half of one, and half of one
   looks complete.
3. **§199A reports a checklist, never a computed yes.** Whether a rental is a §162 trade or
   business is a judgement; Rev. Proc. 2019-38's safe harbour has three conditions and the app
   can only observe one of them — hours, if they were recorded. It says what it can see and
   who decides the rest. Above the threshold, where W-2 wages and property basis limit the
   deduction further, the figure is labelled **an upper bound** rather than presented as the
   answer.

**California is a different tax, not a percentage of the federal one**, and all four modelled
differences push the same way: no QBI deduction, no bonus depreciation, long-term gains as
ordinary income, and credits rather than exemptions. What is *not* modelled is its separate
passive-loss bookkeeping — CA tracks suspended losses on its own depreciation basis, and
reproducing that means a parallel §469 calculation with its own carryforward table. The engine
says so on the tab rather than using the federal figure, which would be wrong in a direction
nobody could see.

**And `EstimateFigure` puts the caveat on the number.** A banner saying "these are estimates"
is read once and scrolled past for the rest of the year; a hairline `est.` beside every one of
forty figures cannot be. A figure computed from unconfirmed constants carries a second badge,
and one that could not be computed reads "not computed" rather than zero.

### The state was Washington, not California — 2026-08-15

Corrected the day after Phase 6 closed, and worth recording because of **where the wrong
assumption came from**: `TZ=America/Los_Angeles` in the Environment notes, which is the
*server's* timezone and says nothing about where anybody lives. I read a deployment setting as
a fact about the user. Nobody had said California at any point.

Washington makes the state layer much smaller, and mostly by subtraction — **there is no
personal income tax**, so salary, self-employment, interest, dividends and *rental income* are
untouched by the state. That deleted the entire class of federal/state divergence California's
module existed for: no state brackets, no separate depreciation basis, no state passive-loss
bookkeeping, no exemption credits.

Three things did **not** simplify, and all three are the kind that get missed precisely because
"no income tax" sounds like "no tax":

1. **Washington taxes long-term capital gains at 7% above a threshold.** It only appears in a
   year with a large stock sale — exactly the year you would want warning — and it is easy to
   forget because the state is famous for the thing it does not have.
2. **Real estate is exempt from that tax outright.** Selling the rental does not trigger it,
   however large the gain. So `TaxProfile` gained `realEstateGainCents`: the app cannot tell a
   house sale from a stock sale, and inferring it would be wrong in the one year it mattered.
3. **The SALT election stops being academic.** Schedule A takes state and local *income or
   sales* tax, never both. In a state with an income tax, income always wins and the choice is
   invisible. Here income tax is zero by construction, so **sales tax is the whole of it** —
   and treating it as zero understates the itemized deduction by thousands. Hence
   `salesTaxPaidCents`, and `Math.max` rather than a sum.

**`parseTaxRules` had baked the assumption in too**, demanding a bracket table of every
jurisdiction. That held only while the one state modelled had an income tax. It now requires
brackets of *federal* and nothing else — the kind of constraint that looks like validation and
is really a generalisation from a sample of one.

The migration is additive: two nullable columns and a changed default. The `ca` rule-set
skeletons were deleted rather than migrated, which cost nothing because **they contained no
confirmed numbers** — the entire point of shipping them empty.

### A wrong tax number looks exactly like a right one — 2026-08-14

**No tax constant in this app comes from a model's memory.** The rule sets in
`lib/tax/rulesets/` ship with every numeric leaf `null` — brackets, standard deduction, the
SE wage base, the §469 allowance, the §199A thresholds, all of it — and the engine computes
**nothing** until each has been read off its published source.

This is §6's oldest rule under maximum pressure. The seeded tasks of 2026-08-04 were a
nuisance because they were rows nobody wrote; a wrong standard deduction is worse in kind,
because **the seeded task announced itself by existing and the wrong constant announces
nothing.** A tax figure that is 4% out looks precisely as authoritative as one that is
right, nothing downstream contradicts it, and the moment you find out is the moment it has
already cost money.

Four things follow:

1. **A rule set with any unconfirmed number is unusable — not "used with defaults".** A
   default is the same lie one indirection further away. The Tax tab reports "not computed",
   names how many figures are missing, and lists them.
2. **`missingFigures` walks the payload** rather than checking a maintained list, because the
   failure mode of a hand-kept list is that the newest constant is the one nobody added to
   it. The top bracket's `null` ceiling is exempted by shape, not by name.
3. **Booleans are not figures.** California's `conformsToBonus: false` is a standing fact
   about non-conformity, not a number to look up, so it ships with a value. It still wants an
   annual check — conformity is a thing legislatures change — but it has a defensible default
   in a way a bracket rate does not.
4. **Arithmetic defined by statute may live in code; rates may not.** The mid-month
   convention, the half-year convention, the declining-balance formula and the stacking of
   preferential rates on ordinary income are all *procedures*, checkable by anyone against
   Publication 946. The 5- and 15-year MACRS percentages are therefore **derived rather than
   transcribed** — there is no table to mistype.

**The land split is the sharpest instance.** `buildingBasisCents` returns `null` without it,
so depreciation is not estimated at all. On a $985,000 property the difference between a 15%
and a 30% land allocation is about $2,700 of deduction every year for 27 years — and both
numbers render identically. The ratio comes off the county assessor and the app cannot derive
it, so it asks, and refuses until answered.

### The month a rental became rentable is not a detail — 2026-08-14

`Property.placedInServiceOn` is **the date it was first available to rent**, never the
purchase date, and the mid-month convention is why. Depreciation starts from the middle of
that month: a house rentable on 2 August and one rentable on 30 August get identical first
years, both 4.5 months. Buying in June and finishing the work in September is a three-month
difference in the first year's deduction, and it survives for 27 years because nothing
contradicts it.

**The one real bug in this layer lived here.** How many *complete* years follow the first
partial one depends on the start month — 27.5 years measured from mid-month leaves
`27.5 − firstYearShare`, and only the whole part of that is taken at the full rate. January
takes 11.5 months up front, so 26 full years follow and the tail lands in year 27; August
takes 4.5, so 27 full years follow and the tail lands in year 28. Hardcoding `floor(life)`
produced a "final" year **larger than a full one**, which `scripts/tax-check.mts` caught by
asserting the tail is a partial. Both months are now golden cases, along with the property
depreciating to exactly its basis and not a cent more.

### The document carries its own checksum — 2026-08-13

**This is the only reason a language model is allowed to read a financial document
in this app**, and everything else about statement ingestion follows from it.

An owner statement prints its own totals: income, expenses, the distribution, the closing
balance. So the extractor is asked for two things **separately** — the individual rows, and
the totals from the summary block — and `reconciles()` requires them to agree **to the
cent**. A hallucinated row, a dropped row or a misread digit fails arithmetic rather than
passing review. The model is only ever being asked to transcribe something that can check
itself.

The prompt says this out loud, because it is the instruction most worth obeying: *"Never add
up the line items to produce them. They are checked against the line items later, and that
check is the only thing making this transcription trustworthy — if you compute them, the
check becomes meaningless."* A model that helpfully sums the rows into the totals field
defeats the whole design while appearing to do a better job.

Four rules fall out:

1. **To the cent, with no tolerance.** A tolerance is the obvious kindness and it is exactly
   wrong: every figure here is a printed dollar amount, so rounding error does not exist and
   any discrepancy means something was read incorrectly. The failures a tolerance hides are
   the *small* ones — and a small error in a repair is the same shape as a large one in a fee.
2. **A statement that prints no totals is refused, not passed.** Nothing to check against is
   not the same as nothing wrong.
3. **Distributions and reserves are excluded from both sides.** An owner draw is money moving
   between the manager's trust account and yours — not income, and certainly not an expense.
   Counting it is how a rental appears to deduct its own profit.
4. **Nothing is ever auto-accepted.** Not even a statement that reconciles perfectly.

**The honest limit, and it is the important half:** reconciliation catches every error that
changes a total and **no error that does not**. A repair mislabelled as insurance adds up
exactly right and is wrong on the Schedule E. That is why every row keeps its `rawText` — the
verbatim source line, shown under it — why a row the extractor was unsure about is tinted,
and why the accept button is a person's.

### A property is money; its project is the work — 2026-08-13

`Property` holds an address, a basis, a valuation and a mortgage. It holds **no tasks, no
docs and no journal** — those hang off a `Project` the Ledger mints alongside it, filed in
Home & Money like every other project.

§6's own table of nouns has given "Rental 4B" as an example **Project** since 2026-07-30, and
that turns out not to be a coincidence to work around. A property genuinely has tasks (chase
the plumber), docs (the lease terms, the CPA's notes) and a journal (what the tenant reported
in March) — and all three already exist, already work, and already have a page at
`/projects/[slug]`. Inventing property-tasks and property-docs would be the parallel-system
mistake `AreaDoc` was refused for, three times over.

Three details:

1. **`cadenceDays` is null on the minted project**, so it can never report drift. A rental is
   responded to, not pushed forward on a schedule — a fortnightly warning that you have not
   "touched" a house is exactly the untrue line that got the Multilingual Baby project
   deleted (§6, "The Baby area is a journal, not a backlog").
2. **`Property.projectId` is `@unique`**, so two properties cannot share one project: "the
   disposal is broken" has to be about a specific unit. Postgres treats NULLs as distinct, so
   any number of properties may have none.
3. **Deleting the property leaves the project alone.** By then it may hold work somebody did,
   and cascading into it from a money row is what `deleteProject`'s own guard exists to stop.

### Three kinds of number, and they must not blur — 2026-08-13

The Property card shows figures of three different kinds and the whole design of `lib/property.ts`
is about keeping them apart:

| | |
|---|---|
| **Value** | an *estimate*, with real error bars — shown with its range and its age |
| **Debt** | a *statement* from the servicer — exact |
| **Cash flow** | *bank transactions*, exact, but only over what has been claimed — which the card says |

Equity is the one derived figure, and it inherits the estimate's uncertainty. It is shown
anyway, because it is the number people actually want — but next to the range, never alone.

Two refusals fall out, and both are the same rule this file keeps arriving at:

- **A property with no valuation contributes nothing to net worth.** Not its purchase price.
  A house bought in 2019 is not worth what it cost, and a fallback would be the app asserting
  a number nobody gave it — with the particular nastiness that it would look completely
  reasonable. So the card says "no valuation yet", names what was paid, and says plainly that
  the figure is *deliberately* not being used.
- **Depreciation is not estimated without the land split.** The ratio comes off the county
  assessor and cannot be derived; a plausible guess is wrong by thousands of dollars a year
  and is indistinguishable from a real figure. The card states what is missing as a prompt
  rather than an error, and Layer 5 refuses to compute.

**And the mortgage is suggested, never assigned.** Plaid's Liabilities product hands back a
`property_address` string — "2992 Cameron Road, Malakoff, NY" — and the obvious move is to
match it and attach the loan. `getLoanCandidates` scores candidates by shared address tokens,
orders the list, and stops there. A mortgage on the wrong property moves the depreciation,
the interest deduction *and* the cash flow, and a Schedule E is not somewhere to discover an
inference was wrong. The scoring is deliberately crude for the same reason: it orders a short
list and nothing more, so a cleverer metric would buy precision nobody acts on.

### A cursor you advance past a row you did not write — 2026-08-12

The load-bearing line in `lib/plaid-sync.ts`, and the bug it prevents is one that
**nothing in the app could ever detect**.

`/transactions/sync` is cursor-based: it reports what *changed* since the cursor and then
gives you a new one. That is what makes it cheap to re-run and what makes a missed webhook a
delay rather than a hole. It also means a row offered once and not written is **never offered
again.**

A transaction is skipped when its `Account` does not exist yet. That is not hypothetical: a
new item queues a balance refresh (which creates the accounts) and a transaction sync
together, and `drain` orders by `runAfter` — jobs enqueued in the same millisecond share one,
so Postgres decides which runs first. Insertion order is not a guarantee.

So the sync counts what it skipped and, if the count is not zero, **throws before saving the
cursor.** The job retries with backoff, the balance refresh has run by then, and Plaid
re-offers every row. The alternative — advance anyway, log a warning — loses a week of
transactions permanently, in the data the tax figures are computed from, with no gap visible
anywhere: the ledger simply has fewer rows than the bank, and nothing compares the two.

Two smaller notes from the same file:

- **`drain` also orders by `createdAt` then `id`**, which approximates insertion order
  because cuids are monotonic within a process. That is belt and braces, not the fix — a
  correctness property that depends on a queue happening to order itself is not one.
- **The failure is deliberately loud.** It reads "50 transactions belong to an account that
  has not synced yet", appears on the connections page, and clears itself on the retry. A
  silent skip would have been the same code with one line removed.

This is the third time this file has arrived at the same shape: **an operation that cannot be
undone must refuse rather than approximate.** A statement that will not reconcile is not
accepted (Layer 4); an unverified tax constant is not computed with (Layer 5); a cursor is
not advanced past a row that was not written.

### Automation's failure mode is that it stops without saying so — 2026-08-12

Every surface built before this one shows you data you entered, so a bug is obvious: the
task is not there. **The Ledger shows numbers that arrive on their own, and a Ledger whose
last successful sync was eleven days ago looks exactly like one that synced this morning.**
The numbers are all still there. They are just wrong, and nothing on screen says so.

That is why "automate everything" produced *more* visible machinery rather than less:

- **`LedgerJob`** — every outbound call gets a row, with its result in a sentence
  ("Refreshed 4 accounts") or its error. This app has no cron and keeps the
  materialise-on-read bargain `ensureSeriesSlots` has run on since Phase 2 — but that
  pattern swallowing an exception is *worse* than a cron, because with a cron there is at
  least a log. Now there is one, and `/ledger/connections` is it.
- **The sync strip**, on every Ledger page: "4 accounts · synced 2 hours ago". It turns
  crimson for the one case no amount of engineering fixes — a bank that wants a person and
  a phone — and that is §9's one accent per region spent on the only thing here needing a
  human.
- **Backoff lives on the row**, not in a retry loop, so a bank down for an hour is not
  hammered once per page load, and a request is never held open through five retries.
- **Failures sort first in the log** regardless of age. A job that failed on Tuesday matters
  more than one that succeeded this morning, and a strictly chronological list is precisely
  how three weeks of stale balances go unnoticed.

**The webhook is an optimisation, never a dependency.** `ensureLedgerJobs()` queues a
refresh for any item nobody has heard from in a day, so a webhook that never arrived costs a
delay and not a hole — Plaid's sync cursor does not expire. That is also what let Layer 1 be
built and verified before a public URL for the webhook existed.

### Disconnecting a bank must not delete the ledger — 2026-08-12

`Account.itemId` is nullable and `SetNull`, and this is the one relation in the Ledger worth
arguing. §6's rule is cascade when the child is *part of* the parent and SetNull when it has
a home elsewhere, and an account has a home elsewhere: the ledger itself.

The cost of getting it wrong is asymmetric in the way this file keeps rediscovering. Two
years of transactions are what the tax numbers are computed from, and **a Schedule E that
silently loses a quarter because a credential expired in March is worse than no Schedule E**
— you would not know to look. So a disconnected account keeps everything it has and stops
updating, reading "Disconnected" where the bank's name was.

`disconnectItem` also calls Plaid's `/item/remove` **before** deleting the row, and fails
loudly if that call fails. The other order leaves the grant live at the bank with nothing in
the app pointing at it: still authorised, still billing, and now invisible.

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

> **A project keeps one too, since 2026-08-09** — see "A journal belongs to whatever it is a
> record of" below. The sentence above is still the reason it began area-only, and the reason
> an area can have one *without* a project; it stopped being a reason for the Project side to
> be refused the moment a devlog was asked for.

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

### A journal belongs to whatever it is a record of — decided 2026-08-09

`JournalEntry` gained a nullable `projectId` beside its now-nullable `areaId`, exactly one
set. **This is the `Doc` change of 2026-08-05, one noun over**, and the argument transfers
without modification — including the enforcement: exactly-one-of is a union type in
`lib/journal-actions.ts` (`{areaId} | {projectId}`), so "both" and "neither" are unspellable
rather than merely rejected, because Prisma cannot express a check constraint and that file
is the only writer.

**The noun did not change; only what it can point at.** A devlog — "the level order finally
reads, here is what changed" — is something that already happened, and the four tabs beside it
on a project page are all things that are owed or going out. A Task is binary and
forward-looking, an Event asserts a time, a ContentItem goes to an audience, and a Doc is a
page you maintain rather than a dated record you add to. That is the same gap the Baby area
had, arrived at from the opposite direction: the area had no project to hang a record off, and
a project had no area of its own to hang one off either — Sleepy Cat's devlog is not the Work
area's journal.

Three things follow, each over an obvious alternative:

1. **One model, not a `ProjectJournal`.** Two parallel systems is how one of them silently
   rots while the other gets the improvements — the exact sentence the `AreaDoc` alternative
   was refused with. The whole `Journal` component moved across unchanged except in what it is
   handed, which is the argument for having generalised rather than duplicated, made for the
   second time.
2. **The owner is create-only.** `saveJournalEntry` reads it to know which page to revalidate
   and never writes it on an update, so a stray field posted alongside an `id` is inert rather
   than a silent move. Same shape as `saveDoc` refusing to re-own a doc — and here it matters
   more, because the entry's *date* is already immutable on the same principle (§6, "The date
   is not a field") and an owner you could move would be the one remaining way to rewrite a
   record after the fact.
3. **`deleteProject` counts journal entries among what blocks a delete.** The journal cascades
   with its owner, like a doc, so deleting would not orphan it — it would *erase* it. And it
   is the one thing on a project that cannot be written again: a task can be retyped, a photo
   of the day something first worked cannot.

**Where the tab sits says what it is for.** An area page opens on Journal, because the reason
to open an area is almost always to write something down. A project page still opens on
Overview and the journal is fourth of five, because "where does this stand" is the question
there and the record is what you come back to afterwards. Only the active tab's heavy read
runs, the same rule the area page follows — the journal is the one query on either page that
grows without bound.

**Montblanc can file into either**, with `areaSlug` and `projectSlug` mutually exclusive on
`create_journal_entry` and a refusal rather than a guess when both or neither arrive. A tool
that knew about only one half of a two-owner noun would file every devlog into an area, which
is the assistant committing the filing error the whole prompt is written to prevent.

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

### The toolbar offers what the renderer can render — decided 2026-08-09

Seven buttons above the journal's body field — bold, italic, link, bulleted, numbered,
quote, code — and the list is not a judgement about what is useful. It is **exactly the
subset `lib/markdown.ts` parses**, because a button that inserts syntax the renderer prints
as literal characters is worse than no button: it teaches you a thing the app then refuses
to do. Headings are the one omission with a reason of its own — an entry already has a
headline field above the body, and a second title inside it is the field being ignored.

Four decisions, each over the obvious alternative:

1. **It writes into the textarea; it does not own its value.** Every field in this app is
   uncontrolled and read out of `FormData` on submit, and the reflex build — lift the body
   into React state so the buttons can transform it — makes the composer a controlled form
   for the sake of seven buttons, on the one surface whose whole argument is that it costs
   nothing to type into. So the actions take the element and edit it in place. That is also
   what lets `Ctrl+B` work without going through the component at all: the keyboard handler
   and the button call the same function on the same element.
2. **`execCommand("insertText")`, which is deprecated and which is correct.** It is the only
   way to change a textarea's value and keep the browser's **native undo stack**.
   `setRangeText` — the modern, non-deprecated call — silently discards it, so bolding a
   word would make the next `Ctrl+Z` throw away everything typed before it. That is a real
   loss in a box you write a paragraph into one-handed, and it is invisible until it costs
   you the paragraph. `setRangeText` is the fallback for the browsers and the one case
   (deleting to an empty string) where `insertText` refuses.
3. **The adjacency test counts asterisks; it does not string-match them.** `*` is a prefix
   of `**`, so "does this text already carry my markers" answered with `endsWith` gets
   `***bold and italic***` wrong in both directions — italic reads the bold pair as its own
   and eats one off each end, or declines to unwrap and adds a fourth. An odd run has an
   italic marker in it; a run of two or more has a bold pair. **Found by driving the buttons
   rather than by reading them**: bold-then-italic-then-italic produced `****stayed****`.
4. **`onMouseDown` is prevented on every button.** A mousedown on a button takes the
   selection out of the textarea, and the selection is the thing the button is about to act
   on — so without it, every button applies to an empty range at the caret.

**The Docs editor does not have it yet**, which is the odd half of this: that is the more
Markdown-heavy of the two surfaces. The component takes any textarea ref, so it is four
lines there whenever it is wanted; it was left alone because the ask was about the journal
and widening it is a decision rather than a tidy-up.

### Enter is not Post — decided 2026-08-09

Pressing Enter in the journal's headline field filed the entry. That was never a decision:
**a form with one text input submits on Enter, and that is the browser's default**, arrived
at because the composer's other input is a `textarea`, where Enter means what it should.

It is exactly the wrong default here. A headline is the *start* of writing an entry — you
name the thing, then say what happened — so the most natural keystroke in the sequence
posted a record with no body in it. On a journal, that is worse than a lost draft: the entry
is dated from the server's clock and cannot be moved (§6, "The date is not a field"), so the
recovery is editing a row that now exists at a time you did not choose to write at.

So Enter moves the caret to the body, **at the end of whatever is already there** rather
than at position zero — on an entry being edited the headline is a thing you tab back up to
and fix, and dropping the caret in front of an existing paragraph would make the fix the
start of a new sentence. Submitting is the button, which is where it already was.

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

> **The half of this that stopped at the breakpoint was the wrong half** — see "The controls
> go on the glass" below, 2026-08-09. Going full-bleed on a phone was right and it left the
> *stacked* layout in place, so the phone still spent a header row and a controls block on
> chrome around the picture. And the desktop card kept a shape no camera has.

**The two media buttons became one dropdown** at the same time, and for a smaller reason:
"Add photos", "Camera" and the counter were three controls across the top of a composer whose
whole justification is that it is quiet enough to type into without deciding anything first
(§6, "The journal"). The choice between library and camera is real — it is the one §6 sets
out under `MediaInput` — but it is not one you make often enough to spend a permanent row on.

### The controls go on the glass — decided 2026-08-09

Modelled on TikTok's capture screen, which is the reference for this: **a viewfinder with
nothing beside it, and every control floating over it.**

Two days earlier the sheet went full-bleed on a phone (above) and that fixed the *frame* while
leaving the *stack* — a header row, then the preview, then a filter row, then two buttons.
Chrome above and below a picture is chrome you are not looking at, and on a phone it was still
most of the height. So the preview fills the surface at every width and the controls sit on top
of it: close at the top left, flip and the colour grades on a rail at the top right, a mode
strip and one shutter at the bottom.

Six decisions, each chosen over the obvious alternative:

1. **One shutter, and the mode is named first.** "Photo" and "10s clip" were two buttons side
   by side and both looked like the primary action, so the screen had no answer to "which one
   do I press". A `Photo · 10s clip` strip and a single large round button is how every camera
   works, and it is what buys room for a target you can hit one-handed while holding a baby
   with the other — which is the entire operating context of this feature.
2. **The ring is the countdown.** A recording that cuts itself off at ten seconds has to say
   so *before* it happens, or the stop reads as a failure. The inner shape morphs circle →
   rounded square, which is universal camera vocabulary for "this is now a stop button" and
   needs no label — the word "Stop" it replaces was the only English on the surface.
3. **The chrome is white-on-dark in both themes.** Same argument `--color-viewer` makes: a
   viewfinder is dark everywhere, and §11's elevation ladder is about the *page*, not about
   something laid over live video. The one accent on the surface is the shutter, which is §9's
   one-accent-per-region budget spent on the thing you came here to press.
4. **Two gradients, and they are not decoration.** White chrome is legible against a face and
   invisible against a window. A scrim at each end costs nothing and makes every control
   readable whatever is in front of the lens — this was found by pointing a bright synthetic
   feed at it, not by reasoning, and the first values were too weak.
5. **The grades are behind a toggle.** Five pills permanently across the bottom is a row you
   read past every time to reach the shutter, and the answer is "None" almost always. The rail
   button stays lit while a grade is applied, so a filtered camera never looks like a plain one.
6. **`animate-rise`, not `animate-panel-in`.** The panel animation is the *side panel's* slide,
   and on a centred dialog it reads as the wrong thing arriving from the wrong place (§10).

**What you see is now what gets stored, and that was a real bug.** The preview is
`object-cover` in a frame that is rarely the camera's own shape — a 16:9 webcam in a portrait
window has its sides off screen — and the capture drew the *whole* sensor frame. So the stored
photo was wider than the one composed, silently. It now crops to exactly the rectangle on
screen, which is the rule the filters already follow ("one CSS string, two consumers, so a
preview cannot lie about the result"), applied to geometry. Verified: a 416×405 frame on a
1280×720 camera stores 740×720, matching the shown aspect to four decimal places.

The crop is read **once per capture**, not per frame — `clientWidth` forces layout, and a clip
repainting through a canvas would ask thirty times a second. And a clip only goes through the
canvas when there is something to bake: a filter, or a crop. On a phone the preview usually
matches the camera's own shape, so the cheap path — recording the camera's track directly — is
still the common one.

**And the whole sheet is portalled to `<body>`.** This was the find of the change and it was
pre-existing: `animate-rise` ends on `transform: translateY(0)` under `fill-mode: both`, so
every day section in the journal permanently carries a transform, and a transformed ancestor is
the containing block for `position: fixed`. The camera was therefore pinned inside the day it
was opened from — on a desktop the section is nearly the width of the page and it looked
plausible, and **on a phone the viewfinder began below the tab strip and ended above the tab
bar.** Exactly the mechanism the media viewer portals around, exactly the mechanism §9 records
for the media dropdown, and found the same way both times: by looking at it at 390px.

### One button, and the gesture chooses — decided 2026-08-09

The mode strip lasted a day. `Photo · 10s clip` was the fix for two buttons that both
looked like the primary action, and it kept the underlying mistake: **it asks you to
declare what you are about to do before the thing you are pointing at has finished
happening.** A baby does the thing once. Deciding, then pressing, is two acts where the
camera only ever needed one.

So there is one control. **Tap it for a photo, hold it to record** — for as long as you
hold, up to the same ten seconds. It is the gesture every phone camera already uses, so
there is nothing to learn, and it is the gesture that removes a permanent row of chrome
from a surface whose whole argument (above) is that the preview *is* the screen.

Four things fell out, each chosen over an obvious alternative:

1. **The photo fires on release, not on press.** Until the finger comes up there is no way
   to tell the two gestures apart, and a 350ms threshold is well under where a shutter
   starts to feel sluggish. The **hold**, by contrast, starts recording the moment it
   becomes a hold rather than on release — the recording has to cover the thing you were
   reacting to, not begin after it.
2. **A release just past the threshold runs on to one second rather than stopping.** A
   70ms recording is one `MediaRecorder` often hands back with no frames in it at all, so
   the honest outcome of a gesture that *worked* would have been "that clip came back
   empty". `MIN_CLIP_MS` is the whole fix.
3. **`setPointerCapture` is wrapped in a `try`.** It throws `NotFoundError` when the
   pointer is no longer active by the time the handler runs, and unguarded that takes the
   entire press down with it — no photo, no recording, no error on screen. The capture is a
   convenience (it lets a finger slide off the button and still stop the clip); the tap
   underneath it is the control. The press is armed *before* the attempt for the same
   reason. Found by driving the shutter with synthetic pointer events, which is exactly the
   case that throws.
4. **Pointer events, so the keyboard needs wiring back.** `onClick` cannot tell a tap from
   a hold, and dropping it costs a button its default Enter/Space activation. Both are
   bound to the photo; the hold has no keyboard equivalent worth inventing, and a photo is
   the gesture nine times in ten.

### The front camera is un-mirrored, and in both places at once — decided 2026-08-09

WebKit hands back a **mirrored track** for `facingMode: "user"`, so the viewfinder showed a
flipped world and every `drawImage` of it stored one — text backwards in a record whose
entire value is being able to trust it later.

The flip is undone once, as one `mirrored` flag driving both the video element's
`-scale-x-100` and a `translate`/`scale` around the canvas `drawImage`. **Two consumers,
one decision** — the rule the filters and the crop already follow, for the third time: a
preview that cannot lie about the result.

Two details:

1. **The track is asked what it is, rather than the request being trusted.** A desktop has
   one camera and grants it whatever `facingMode` was asked for while reporting nothing
   back, so `facing` state would say "environment" for a webcam pointed at your face.
   `getSettings().facingMode !== "environment"` is the test: anything not explicitly the
   rear camera is pointed at you, and unknown resolves to the common case.
2. **A selfie clip always goes through the canvas**, since that is where the flip is undone
   — so `mirrored` joins a filter and a crop in the list of things that cost the cheap
   record-the-track-directly path. On a rear camera, which is most of what this journal
   films, the cheap path is untouched.

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

### A photo viewer you cannot flick is broken — decided 2026-08-09

The viewer shipped with arrows, arrow keys and Escape, which is a **pointer device's**
vocabulary — and on a phone it left a photo you could open and then only stare at. Every
photo viewer on a phone swipes, so one that does not does not read as minimal, it reads as
not finished loading. Same shape as the phone's chrome (4.20) and the full-screen camera
(4.18): a surface built at 2560px and met with a thumb.

So the current item and its two neighbours sit on **one track that follows the finger**. The
alternative — snap to the next photo on a flick and animate it in — is less code and worse,
because it gives you nothing until the gesture is over: the whole reason to drag the track is
that **the next photo is visible while you are dragging toward it**, which is what tells you
the gesture is working before you have committed to it, and what makes a half-swipe that
springs back a decision rather than a dead press.

Six things fell out, each chosen over an obvious alternative that fails:

1. **Committing is only `onIndex`.** The neighbour keeps its key, so React keeps the same DOM
   node and the transition carries it from ±100% to 0 by itself — the arrows and the arrow
   keys go through exactly the same line. A separate "animate the slide" path would be a
   second way to change photo, and the two would drift.
2. **Three slides, not all ten.** Opening a viewer fetches the photo you asked for and
   pre-warms the two you might go to next. Rendering the whole entry would pull ten
   auth-gated images for a viewer most often opened to look at one.
3. **`setPointerCapture` is taken at the axis lock, not on the press.** A captured pointer
   sends its `click` to the capture element, so capturing every press would make a tap on the
   photo arrive at the backdrop — which closes the viewer. A gesture that has already become
   a swipe has no click left to protect and gains a finger that can slide off the element and
   still deliver its `up`. It is still wrapped in a `try`, for the reason §6 already records
   under "One button, and the gesture chooses".
4. **The commit distance lives on the gesture, not in `drag` state.** Reading it back off
   state makes committing depend on React having re-rendered between the last move and the
   release — true of a real finger and not a thing to rest on. **Found by dispatching a whole
   gesture in one synchronous burst**, where it silently did not commit.
5. **A gesture that starts on a clip's controls or on the chrome belongs to them.** Scrubbing
   is a horizontal drag too, and it is the one the finger meant.
6. **An axis lock and edge resistance**, which are the two things that make it feel like a
   photo viewer rather than a control that sometimes fires. A vertical wobble abandons the
   gesture instead of sliding the photo by however far the thumb wandered; a pull at either
   end moves 0.35× and springs back, so a swipe with nowhere to go says so by barely moving
   rather than by doing nothing at all.

**A clip's `autoPlay` had to become an effect**, keyed on the index. It only fires on mount,
and a neighbour slide is mounted long before it is the one you are looking at — and the same
effect is what pauses the clip you just swiped away from, which would otherwise carry on
playing off screen.

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
  - `DEEPSEEK_API_KEY` — Montblanc. **Without it the drawer opens and says so**;
    nothing else in the app breaks. `DEEPSEEK_BASE_URL` and `DEEPSEEK_MODEL` are
    optional and default to `https://api.deepseek.com/v1` and `deepseek-chat`
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
- [x] **Montblanc's model provider** — ~~resolved 2026-07-30: **Qwen**~~ →
      **re-resolved 2026-08-09: DeepSeek**, because I already hold a key for it.
      Still an OpenAI-compatible endpoint, which is what made the swap the
      one-file change §3 promised it would be — and **the Vercel AI SDK went with
      Qwen**, since a tool-calling loop is thirty lines and nothing here streams
      tokens. See §3 and §6, "Montblanc is a command bar".
- [x] **Calendar library** — resolved 2026-08-01: **neither. Hand-built.** Month is a
      7-column CSS grid of tiles; week and day are an hour grid with absolutely positioned
      blocks and a first-fit lane packer for overlaps. Both libraries bring their own DOM
      and their own stylesheet, and this design (borderless, 1.5rem radii, tiles on a
      tinted ground, token-driven motion) is precisely the kind that gets fought rather
      than configured — the same argument that deferred shadcn in Phase 1, and the reason
      the grid could adopt `animate-rise`, the crimson today-pill and the accent now-line
      without a single override. ~600 lines, no new dependencies. The cost is that
      drag-to-move doesn't come for free; see Phase 4's open box.
- [x] **Money representation** — resolved 2026-08-12: **integer cents**, `Int`, every column
      suffixed `…Cents`. Not `Decimal @db.Decimal(14,2)`. Four reasons, in order of weight.
      (1) **The RSC boundary**: Prisma's `Decimal` is a class instance, Next refuses to
      serialize one into a client component's props, and it fails at *runtime* on the page
      nobody tested — the "format server-side into `…Label` strings" rule mitigates it and
      does not remove it, because a chart needs raw numbers for geometry. `BigInt` has the
      mirror defect: `JSON.stringify` throws on it. (2) **The tax engine is hundreds of
      multiplications**, each of which in Decimal.js is `a.times(b).dividedBy(c)` *and still*
      needs an explicit rounding decision; in cents it is `applyRate`, one function, one
      rounding rule. (3) **Every source already speaks decimal-dollar floats** — Plaid sends
      `12.34` — so constructing a `Decimal` from one has already lost the accuracy Decimal
      exists to protect; the conversion is the thing to get right, once. (4) Zero decimals
      exist in this schema, so adopting one leaks Decimal.js semantics everywhere forever.
      **The cost, stated:** `Int` caps a column at $21,474,836.47; sums are computed in JS,
      never in Postgres, so only a single line item could cross it, and the escape is
      `BigInt` plus a `.toString()` at the read layer — a wider column, not a redesign.
- [x] **Charting library** — resolved 2026-08-12: **neither. Hand-built.** The calendar
      decision one surface over, with smaller arithmetic: the Ledger needs three shapes, each
      forty to eighty lines against a fixed `viewBox`. Every candidate fails the same three
      tests the calendar libraries failed. **They bring their own DOM and stylesheet**, and a
      chart is *more* design-sensitive than a month grid, not less. **They force
      `"use client"`**, because they measure the DOM to lay out — so a chart with no state
      and no handlers would ship to the browser to re-derive what the server already knew,
      and formatting would have to move into the bundle with it. **And they cannot see the
      tokens**: a canvas library needs a JS bridge to read `--color-accent`, and a hex passed
      to a chart is a bug in two themes rather than a shortcut in one (§11).
      `components/today/done-map.tsx` is the year-old precedent. The cost: no hover tooltips,
      no zoom, no free legend — `<title>` and a rendered legend row cover it, exactly as the
      contribution grid does. _Note added on building it: the composition bar turned out not
      to want SVG **either**. A stacked bar is four widths that add to 100%, which is a
      layout, not geometry — flex percentages keep it responsive, server-rendered and painted
      through the tokens. Reaching for SVG there would have been the charting-library mistake
      in miniature._
- [x] **A loss colour** — resolved 2026-08-12: **`--color-bad` / `--color-bad-soft`**, in both
      themes. `--color-good` has existed since Phase 1 and nothing needed its opposite until a
      P&L did. Two existing tokens were candidates and both are wrong. **Crimson is the
      emphasis token**, budgeted at one per region — if crimson also means "loss", the single
      highlighted metric and every negative number compete for one meaning and the budget
      stops being enforceable. **`--color-warn` means "attention"** — overdue, drifting,
      expiring — a claim about *time*, not about sign; a −$40 month is not a warning. Plus a
      usage rule, because the failure mode of a loss colour is a screen of red: **a number is
      coloured only when its sign is the point**. Balances are never coloured. Neither are
      expenses — an expense is not a loss.
- [x] **The Plaid SDK** — resolved 2026-08-12: **refused, hand-rolled.** Plaid's HTTP surface
      is a POST with credentials in the JSON body and the Ledger uses eight endpoints of it.
      The official package's real product is its generated types, and it pulls `axios` to
      deliver them — a third of this repo's entire dependency count, for typings of fields we
      mostly do not read. Same trade `deepseek.ts` made. **The cost, stated:** a Plaid schema
      change is caught at runtime by `lib/plaid.ts`'s narrowing helpers rather than at build
      time by the SDK's types, which is the same bet, failing the same way. `react-plaid-link`
      (a hook around a CDN script), `jose` (ES256 verification is two built-in calls) and
      `googleapis` (three `fetch`es against a metapackage shipping every Google API) are
      refused alongside it. **`unpdf` is the one dependency this phase adds**, in Layer 4, and
      it is zero-dependency itself.
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

- **A same-origin iframe is a real phone viewport, and it is how the mobile layout finally
  got looked at.** `resize_window` has reported success while leaving the renderer at
  2560px for a week, which is why every phase since 4.8 carries "not seen on a real
  device". **Media queries inside an iframe answer to the iframe's own box**, so a 390×844
  iframe pointed at the app is genuinely below `md` — `matchMedia("(min-width:48rem)")`
  comes back `false` inside it while the window is still 2560px wide. Same origin, so the
  session cookie applies and `frames[0].document` is readable. Build the harness by
  `document.write`-ing over a page already on the app's origin:

  ```js
  document.open();
  document.write('<style>html,body{margin:0;height:100%;overflow:hidden}' +
    'iframe{position:fixed;top:0;left:0;width:390px;height:844px;border:0}</style>' +
    '<iframe id="ph" src="/today"></iframe>');
  document.close();
  ```

  Pin the outer page `overflow:hidden` and the iframe to the top-left, or the wheel scrolls
  the *outer* document and the phone slides off screen. To see it at a glance, wrap it in a
  clipping box and `transform: scale(.55)` the iframe — a transform does not change the
  iframe's internal viewport, so the layout under test is unaffected. Found 2026-08-08.

- **An occluded Chrome window dispatches no scroll events, so scroll behaviour cannot be
  driven through it.** This is the same harness state §6 records for `animationend` — the
  window here reports `visibilityState: "hidden"`, so the browser skips its rendering
  steps: `requestAnimationFrame` never fires, CSS transitions never advance (an element
  keeps its *start* transform however long you wait, while its className is already
  correct), and **setting `scrollTop` fires no `scroll` event at all**. A handler that
  reads `element.scrollTop` can still be exercised honestly by dispatching the event
  yourself — `main.scrollTop = y; main.dispatchEvent(new Event("scroll"))` — which tests
  the logic against real scroll positions and leaves only Chrome's event delivery
  unverified, which was never in doubt. To *measure* a transformed element in this state,
  inject `*{transition:none !important}` first so the target value applies immediately.
  Read the className, not the rect, if you can. Found 2026-08-08.

- **Hover is not an affordance on a phone.** A control revealed by `group-hover` doesn't
  exist on touch. Write it `sm:opacity-0 sm:group-hover:opacity-100` — visible outright on
  small screens, revealed on hover on a pointer device. The add-to-sprint buttons on the
  Hunt Board and in "Next up" are the reference implementations.

- **A `grid` with no base `grid-cols-*` is the same bug, and it hides until a phone.**
  `className="grid gap-5 lg:grid-cols-3"` has *no column definition below `lg`*, so the
  browser makes an **implicit** track sized `auto` — whose floor is min-content, not the
  container. One long word, one wide card, and the track grows past its parent and takes
  the whole page sideways with it. It is invisible on a desktop, because there the
  `lg:` variant supplies real columns. Found 2026-08-09 with **126px of horizontal scroll**
  on the project page's Overview at 390px, and latent in three more places. Tailwind's
  `grid-cols-1` compiles to `repeat(1, minmax(0, 1fr))`, so the fix is to always write the
  base case: `grid grid-cols-1 gap-5 lg:grid-cols-3`. Same root cause as the note below,
  which is about the version you write by hand.

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

  **Anything `fixed` rendered from inside one must be portalled, and "it looks fine on a
  desktop" is not evidence.** A transformed ancestor is the containing block for
  `position: fixed`, so `fixed inset-0` quietly becomes "the size of that day's card". The
  camera sheet had this from the day it was written and it went unnoticed for two days,
  because a day section is nearly the width of a desktop page — at 390px the viewfinder began
  below the tab strip and ended above the tab bar. Three surfaces have now hit it (the media
  viewer, this dropdown, the camera), so the standing rule is that an overlay meant to cover
  the window is `createPortal(…, document.body)`. The cheap check is
  `overlay.clientWidth === window.innerWidth`. Found 2026-08-09.

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

- **A route handler that authenticates itself still has to be let *through* the proxy.**
  `proxy.ts` is an optimistic gate and every route re-checks `auth()` behind it, so it is
  easy to assume an endpoint with its own check is fine either way. It is not: gated, a
  caller holding a valid **bearer token** gets a 302 to `/login`, follows it, receives HTML,
  and reports success while having run nothing. Found 2026-08-12 by curling
  `/api/ledger/jobs/run` with a token and getting `307` — the endpoint would have looked
  fine forever from a browser, because a browser has a session cookie and takes the other
  branch. This is the manifest bug of Phase 4.21 in a second costume, and the tell is the
  same: **a 302 is not an error anywhere in this app**, so nothing logs it.

  The fix is one path in the matcher's negative lookahead, and it must be **one path, not a
  prefix**. `api/ledger/statements/[id]` serves the bytes of a property statement and has to
  keep 302ing; exempting `api/ledger` wholesale would make it the one genuinely public thing
  in the app. The same exemption is owed to the Plaid webhook, which is unauthenticated by
  necessity and verifies a signature instead.

  The general rule: **anything that can be called without a session cookie needs a matcher
  exemption, and the check to run is a `curl` asserting `401` rather than `307`.**

- **A `"use server"` module cannot be called from a script, so the logic worth testing must
  not live in one.** Every action starts with `auth()`, which reads `next/headers` and throws
  `` `headers` was called outside a request scope `` outside a request. There is no supported
  way to fake one. Found 2026-08-13 trying to exercise `saveProperty` from
  `scripts/property-check.mts`.

  The fix is not a mock, it is a split — and it is the one `lib/media-rules.ts` already makes
  against `lib/media-store.ts`, arrived at from a different direction. Field parsing and
  refusal messages go in a **client-safe rules module**; the action keeps the auth check and
  the database call. That buys three things: the form and the action refuse the same input in
  the same words, the parsers get golden cases, and what is left in the action is thin enough
  to read. `lib/property-rules.ts` is the reference.

  What this does **not** cover, stated rather than glossed: the action wrapper itself — the
  session check, the `revalidatePath`, the ordering of writes — is exercised only in a
  browser.

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
  - `docs/montblanc.md` — what to say to the assistant, the rules it follows and
    why, Undo, and what it deliberately can't do. Written 2026-08-09.
  - `docs/ledger.md` — the four tabs, the two forms, what refuses to compute and why,
    and what to do when a figure stops moving. Written 2026-08-14.
  - `docs/install.md` — putting it on a phone's home screen, per platform; what changes
    once it's installed and what deliberately doesn't; and the custom-domain steps,
    including the `AUTH_URL` change that is easy to forget and takes sign-in down.
    Written 2026-08-09.
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

- **A leftover production `.next` makes `next dev` 404 every route, and it looks nothing
  like a stale build.** Found 2026-08-11: a fresh `next dev` served the root layout (so the
  app directory was found) and then 404'd `/board`, `/login` **and**
  `/manifest.webmanifest`, with no compile line logged for any of them — Turbopack had
  discovered no routes at all. The cause is a production build sitting in `.next` beside
  `.next/dev`; `rm -rf .next` and restart fixed every route in one step. Same family as the
  stale-stylesheet note above: **the build directory's state can look exactly like a bug in
  the code**, and here it looks like the router itself is broken. Suspect it whenever
  *everything* 404s rather than one page.
- **Port 3000 on the Windows machine is the Utaitai frontend**, not this app. `npm run dev`
  here is `next dev -p 3100`. Check the command line of whatever is listening before
  assuming a dev server on 3000 is this one — and before killing it. (`Get-CimInstance
  Win32_Process -Filter "ProcessId = N" | Select CommandLine`.) Killing the wrong tree has
  already happened once, on 2026-08-06.
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

_Last updated: 2026-08-15 · Status: **Phase 6 is done — the Ledger.**_

_**2026-08-15 — "the state tax is washington, not california."** Corrected the day after the
phase closed. The assumption came from `TZ=America/Los_Angeles` in the Environment notes — the
**server's** timezone, which says nothing about where anybody lives, and which nobody had ever
offered as a fact about residence._

_Washington shrinks the state layer mostly by subtraction: **no personal income tax**, so
salary, self-employment, interest, dividends and rental income are untouched by the state, and
the whole federal/state divergence machinery California needed goes with it. What did not
simplify: **a 7% tax on long-term capital gains** that only shows up in a year with a large
stock sale, **real estate exempt from it outright** (so selling the rental triggers nothing,
which is why `realEstateGainCents` had to become its own field rather than an inference), and
**the SALT election becoming load-bearing** — Schedule A takes income *or* sales tax, and with
income tax at zero the sales-tax box is the whole deduction. Leaving it blank understates
itemizing by thousands._

_**One assumption was baked into a place I would not have looked**: `parseTaxRules` demanded a
bracket table of every jurisdiction, which is only true of a state that has an income tax — a
constraint that looked like validation and was really a generalisation from a sample of one. It
now requires brackets of federal alone._

_Additive migration, two nullable columns and a changed default. The `ca` skeletons were deleted
rather than migrated, which cost nothing: **they held no confirmed numbers**, which is the whole
point of shipping them empty. All nine check scripts pass — `tax-check` and `engine-check` gained
10 assertions between them, covering the capital gains tax, the real-estate exemption, and that
income and sales tax are an election rather than a sum._

_**2026-08-14 — Layer 8, and the phase closes.** Montblanc's Ledger tools and `docs/ledger.md`._

_**Nothing here creates money, and the asymmetry is the point.** Every other surface's tools
make rows; these do not. Balances and transactions come from a bank, statements come from
email, a tax constant comes from a published source somebody confirms — there is nothing on
this surface a sentence ought to be able to invent. What a command bar is actually useful for
here is the small tedious act of **filing**: "that $340 was a plumbing repair for the rental",
said while looking at the charge on a phone rather than after navigating to the Property tab._

_**Undoing a filing releases the claim and never deletes the transaction.** A bank row is a
payment that really happened, and "undo" cannot mean "pretend it never left the account". That
is safe to do outright because `claim_transaction` **refuses a row already filed against
another property** — so the state before is always unclaimed. Same shape as §6's "an existing
item never moves on its own", one noun over._

_**Two prompt rules and one context block.** Never invent an amount, a transaction date or any
tax figure; never state a tax conclusion — point at the Tax estimate tab instead, the one
exception being recording what the user says *they* decided. The context names accounts and
properties and **carries no figures at all**, because a number in the prompt is a number the
model can repeat back stale._

_Verified: 25 cases. `find_transaction` matches by merchant and by amount in either direction,
says so plainly when nothing matches rather than guessing at a different search, and refuses an
empty search. A claim files against the property with the right Schedule E line, and undoing it
leaves the transaction and its amount untouched. The context names the account and the property
and carries no balance. All nine check scripts pass, with `npx tsc --noEmit`, `eslint` and
`npx next build`._

_**The compiler caught the one thing I would have missed**: `ReceiptKind` is used as an
exhaustive `Record` key in the drawer's icon and noun maps, so adding a kind failed the build
until both were filled in. That is the kind of place a receipt silently renders blank._

---

## Phase 6, closed

**Eight layers, one new dependency, and the IA held.** Adding a whole life area cost exactly
one entry in `lib/nav.ts` — which is the claim §6 has been making since 2026-07-30, and the
test it said it was built to pass.

What the four asks became:

| Ask | Where it landed |
|---|---|
| Link the banks, see analysis | Plaid, with the webhook as an optimisation rather than a dependency |
| Add the rental properties | A property holds the money; a Project holds the work |
| Sum it into a net worth | The default tab, with property counted only when genuinely valued |
| Somewhere to see the tax rules | An engine that computes nothing until its constants are confirmed |

**Nine check scripts, 300-odd assertions**, because almost everything this feature does is
arithmetic that is wrong *silently*. Four real bugs came out of running them rather than reading
them: the depreciation tail that depended on the start month, the cursor that would have
advanced past unwritten transactions, the HSA counted as spendable cash, and a rule set that
called itself usable with empty bracket tables.

**The through-line is the same refusal in eight costumes.** A cursor is not advanced past a row
that was not written. A statement is not accepted until it reconciles to the cent. A property
with no valuation contributes nothing rather than its purchase price. Depreciation is not
estimated without the land split. An incomplete Schedule E withdraws the whole estimate. A tax
constant nobody confirmed computes nothing. A strategy is a question, never an instruction. And
a filing is undone by releasing it, never by deleting what happened.

**What is genuinely not done**, and none of it is code: Plaid Production is an application and
a bill; Gmail needs a consent screen and a redirect URI; RentCast needs a key; the tax constants
need a person and an afternoon. And **the surface has never been looked at** — the Chrome
extension has no host permission for `localhost:3100`, so every layer here is verified by build,
typecheck, lint, nine scripts and curl, and not by a screenshot.

---

_Previously: **Phase 6, Layer 7 — the tax layer keeps itself current.**_

_**2026-08-14, later still — the strategies and the rules updater.** The two halves of "a
place to see how to use the rules", and the layer where the ask and the honest answer needed
separating most carefully._

_**"The engine will auto-update its rules and laws" splits cleanly in two: fetching and
extracting can be automated, confirming cannot.** `rules-update.ts` fetches the published
source past 15 October, extracts what it can, and files a draft — into `provenance`, **never
into `payload`**. A drafted number is visible, attributed and inert until somebody moves it
across. The reason is the one this whole layer rests on: an engine that silently rewrote its
own constants and got one wrong would move every figure downstream, all of them looking
authoritative, with nothing to contradict them. §6._

_**What makes the remaining human step small enough to happen is the source line.** Every
figure carries the verbatim sentence it came from, and a value arriving without one is
discarded rather than kept — so confirming is *reading*, comparing a number against a quoted
line, instead of searching a 40-page Revenue Procedure for where it might be. The confirm row
puts the two side by side and lets the number be edited, because an extraction that misread a
digit should be fixed by the person already looking at the source. **A source covering the
wrong year is discarded entirely**, which is the most plausible-looking way this could have
gone wrong._

_**The strategy catalogue is hand-written, in git, and never LLM output.** A hallucinated §179
threshold is bad; an invented *election* is worse, because a bracket is a number somebody
might sanity-check and "you can elect X" is a sentence people act on. Nine entries, each a
predicate plus a sentence — **every one phrased as a question to an accountant**, and the only
action on any card is *Mark as raised*. There is no button that says "Do this", and that is
structural: the gap between "worth asking about" and "what you should do" is the gap between a
tool and an unlicensed adviser._

_**`applies` returns three answers rather than two**, and `maybe` is where the value is — the
strategies that clearly fit are usually the ones already done, so the useful list is the
near-misses. A `no` is never shown, which is what stops an always-on list forming. The figure
beside each is **an order of magnitude, not a promise**, and the card says so. A declined
strategy is declined *for the year* and returns next year, because a permanent dismissal
quietly deletes a question that becomes right later._

_Verified: 27 cases covering both halves. The predicates stay quiet on a salary and nothing
else, and fire correctly on self-employment, suspended losses, a brokerage, a large basis, a
near-miss on itemizing, a withholding shortfall, and 200 hours against the safe harbour's 250.
The drafting window opens on 20 October and not on the 1st. And the confirm round trip removes
a figure from the missing list while leaving the other 63 — which is what "nothing is live
until confirmed" means in practice. All eight check scripts pass, with `npx tsc --noEmit`,
`eslint` and `npx next build`._

_Outstanding: **the updater has never fetched a real page** — the URLs, the extraction contract
and the wrong-year guard are written and unexercised against live IRS or FTB HTML, and the
first honest test of it is October. **Unrealised losses are unknown**, so the harvesting
strategy sizes itself without one; Plaid reports cost basis only where the institution supplies
it. And **the surface has still not been looked at**._

---

_Previously: **Phase 6, Layer 6 — the Ledger estimates the tax.**_

_**2026-08-14, later — the pipeline.** Self-employment tax, §469, §199A, NIIT, federal
brackets and California, one file each and all pure. Plus a `TaxProfile` editor, which is the
second and last form in the Ledger after the property address._

_**The ordering is the design, and two steps that look circular are not.** §469's phase-out
tests a MAGI computed **without** the passive loss; §199A's limitation is measured against
taxable income **before** the deduction. In both cases statute settles what looks like a
mutual dependency, and the obvious fix — iterate to a fixed point — converges somewhere
plausible and wrong. Both have direct assertions rather than being left to the totals, because
a total is exactly the thing that would still look right. §6._

_**Three refusals, each somewhere producing *something* would have been easy.** An incomplete
Schedule E withdraws the whole estimate, because the rental's net feeds AGI and a missing
depreciation line would not leave a gap — it would leave a tax bill that is too large with
nothing on screen to say so. A broken California rule set refuses rather than quietly
reporting federal-only. And §199A returns a **checklist, never a computed yes**: whether a
rental is a §162 trade or business is a judgement, the Rev. Proc. 2019-38 safe harbour has
three conditions and the app can observe one of them, so it says what it can see and who
decides the rest._

_**Two things I would have got wrong without writing them down.** Wages consume the OASDI wage
base before self-employment income does, so the SE charge on a $100,000 profit alongside a
$150,000 salary is a fraction of what it looks like. And **a disallowed rental loss suspends
rather than vanishing** — it offsets rental profit later or is released on sale, so writing it
to `TaxCarryforward` is the difference between a planning tool and one that understates what
you own._

_**California is a different tax rather than a percentage**, and all four modelled differences
push the same way — no QBI, no bonus depreciation, gains as ordinary income, credits not
exemptions. Its separate passive-loss bookkeeping is **declared unmodelled** on the tab rather
than approximated from the federal figure, which would be wrong in a direction nobody could
see._

_**`EstimateFigure` puts the caveat on the number**, at every one of about forty sites. A
banner is read once and scrolled past for a year; a hairline `est.` beside each figure cannot
be. A figure from unconfirmed constants carries a second badge, and one that could not be
computed reads "not computed" rather than zero._

_**One real gap found by running it.** A rule set whose scalar fields were all confirmed
reported itself `usable` while the engine refused to compute — because its **bracket tables
were empty arrays**, which `missingFigures` walked straight past. An empty table cannot tax
anything, so it is a missing figure, and the two halves now agree. Caught by
`scripts/tax-view-check.mts`, which exercises the refusals in context rather than in
isolation._

_Verified: 58 engine cases and 49 depreciation cases, both pure; and the full path through
`getTaxView` against the real database — empty rules refuse, confirmed rules plus no profile
still refuse and say which answers are missing, a profile unblocks it, a property with no land
split withdraws it again and names the property, supplying the split restores it, and a draft
rule set computes but badges every figure. Database confirmed back to zero rows. All seven
check scripts pass, along with `npx tsc --noEmit`, `eslint` and `npx next build`._

_Outstanding: **the estimate has never run on confirmed constants**, because none are
confirmed — the checks fill a skeleton with invented values to exercise the path, and Layer 7
plus a person is what fills the real ones. **AMT, K-1s, 1031 exchanges, a mid-year move and
most state credits are not modelled**, enumerated permanently on the tab. And **the surface has
still not been looked at**._

---

_Previously: **Phase 6, Layer 5 — the Ledger has a Schedule E.**_

_**2026-08-14 — the tax layer's foundation.** `TaxRuleSet`, `TaxProfile`, `DepreciableAsset`,
`TaxCarryforward`, `TaxStrategyNote`, MACRS depreciation, and a per-property Schedule E. The
only change to an existing table is a nullable `Transaction.assetId`._

_**The rule sets ship with every numeric leaf `null`, and that is the layer's whole
character.** No bracket, no standard deduction, no wage base, no §469 allowance comes from a
model's memory — the files carry the *structure* and the name of the document each number is
published in, and nothing else. A set with any unconfirmed figure is **unusable**, not "used
with defaults", so the Tax tab currently computes nothing and says so in as many words. §6._

_This is the app's oldest rule under the most pressure it has faced. The seeded tasks of
2026-08-04 were a nuisance because they were rows nobody wrote; **a wrong standard deduction
is worse in kind, because the seeded task announced itself by existing and a wrong constant
announces nothing.** It looks exactly as authoritative as a right one, nothing downstream
contradicts it, and you find out when it has already cost money._

_**What may live in code is arithmetic defined by statute; what may not is a rate.** The
mid-month convention, the half-year convention, the declining-balance formula and the stacking
of preferential rates on ordinary income are all procedures anyone can check against
Publication 946 — so the 5- and 15-year MACRS percentages are **derived rather than
transcribed**, and there is no table to mistype. `missingFigures` walks the payload rather
than a maintained list, because the newest constant is the one a list forgets._

_**The land split is the sharpest instance of the refusal.** `buildingBasisCents` returns
`null` without it, so depreciation is not estimated at all. On a $985,000 property the gap
between a 15% and a 30% allocation is about $2,700 of deduction a year for 27 years, and both
figures render identically. The ratio comes off the county assessor; the app asks, and waits._

_**The one real bug was in the depreciation tail, and the month is why.** How many complete
years follow the first partial one depends on when the property became rentable — January
takes 11.5 months up front so 26 full years follow, August takes 4.5 so 27 do. Hardcoding
`floor(life)` produced a "final" year **larger than a full one**, caught by the golden case
asserting the tail is a partial. Both months are now covered, along with the property
depreciating to exactly its basis and not a cent more, and the 39-year commercial path going
through the same code._

_**The Schedule E draws on three sources and labels each**: accepted statements, claimed
transactions, and the servicer's year-to-date interest. Only `accepted` statements count — a
statement that has not reconciled is not a fact. A capital improvement promoted to an asset is
**excluded from expenses**, or it would be deducted twice, in full now and again over 27.5
years. And the tab is called **"Tax estimate"** rather than "Tax", so the word is in the
navigation and cannot be scrolled past; the rule-set card sits above the figures rather than
beside them; and "What this does not model" is permanent and enumerated — AMT, K-1s, 1031
exchanges, a mid-year move, personal-use conversion, most state credits, California's separate
passive bookkeeping._

_Verified by `scripts/tax-check.mts` — 49 golden cases, no network and no database, which is
possible precisely because `DepreciableAsset` stores no schedule. `npx tsc --noEmit`, `eslint`
and `npx next build` all pass; the other four check scripts still pass._

_Outstanding: **not one tax constant has been confirmed**, so the Tax tab computes nothing
today — by design, and Layer 7's draft flow plus a person is what fills it. **`TaxProfile` has
no editor yet.** **The Schedule E has never been run against real accepted statements**, since
none exist. And **the surface has still not been looked at**._

---

_Previously: **Phase 6, Layer 4 — the Ledger reads statements.**_

_**2026-08-13, later — the owner statements.** `PropertyStatement`, `StatementDocument`,
`StatementLineItem`, the Gmail grant, `unpdf`, and the extractor. This is the layer the tax
work needs: **a Schedule E computed from bank transactions alone misses the management fee**,
which is netted out of the deposit and appears as a debit nowhere._

_**The design turns on one thing: the document carries its own checksum.** A statement prints
its own income and expense totals, so the extractor is asked for the rows and for those
totals **separately**, and `reconciles()` requires them to agree to the cent. That is the only
reason a language model is allowed near a financial document here — a hallucinated row, a
dropped row or a misread digit fails arithmetic rather than passing review. The prompt says so
in as many words, because a model that helpfully sums the rows into the totals field defeats
the whole design while appearing to do a better job. **No tolerance**: every figure is a
printed dollar amount, so rounding error does not exist and any discrepancy means something
was read wrong. §6._

_**The honest limit is stated on the screen, not just here.** Reconciliation catches every
error that changes a total and **no error that does not** — a repair mislabelled as insurance
adds up perfectly and is wrong on the Schedule E. So nothing is ever auto-accepted, every row
shows the verbatim line it was read from, and a row the extractor was unsure about is tinted
with its confidence beside it._

_**`unpdf` is the one dependency this phase adds and it has zero of its own** — 18 lines in
the lockfile. §8's argument held exactly: the hand-written alternative gets ~60% of the way on
`node:zlib` and then meets the font's `/ToUnicode` CMap, which is what decides between text
and mojibake._

_**`lib/montblanc/deepseek.ts` became `lib/deepseek.ts`.** That file's own header has claimed
since Phase 5 that swapping providers stays a one-file change, and the Ledger is its second
consumer — the claim only survives if there genuinely is one file. It gained `completeJson`
with `response_format: json_object` and `temperature: 0`, because extraction is transcription
and a creative reading of a statement is not a thing anybody wants._

_**The Gmail grant is deliberately separate from signing in**, and §6 gives the four reasons —
the front door must not gain a failure mode, there is nowhere in a JWT session to put a
refresh token, the two have different lifetimes, and disconnecting should be one row deleted.
It reuses the existing Google client, so it is **no new secret**: just a second authorised
redirect URI. `gmail.readonly` is the narrowest scope that can read an attachment, so the
mitigation is to look at as little as possible — sender, attachment, sixty days — and **no
message body is ever stored**, only the PDF and the rows read out of it._

_**Uploading is a first-class path rather than a fallback**, and it is what made this layer
testable before any OAuth existed. **The hash, not the message id, is what makes ingestion
idempotent** — the same attachment forwarded to yourself, or picked up again by a re-scan
after a failure, is one document._

_Verified end to end: `scripts/statement-check.mts` builds a **real PDF** — actual bytes, text
operators, correct xref offsets — stores it, and runs it through `unpdf` and the live model.
It extracted 439 characters, read all five rows with the right kinds, got the signs right
(rent +$4,200.00, management fee −$342.00), read the summary totals **from the summary block**
rather than by summing, reconciled, and stopped at `needs_review`. Then removing a row was
confirmed to break the reconciliation. The isolated cases cover a dropped row, an invented
row, a one-cent discrepancy, a distribution that must not count, and a statement with no
totals at all. Route gating re-checked: statements, Gmail connect and Gmail callback all 307,
while the webhook and job runner 401 — the two exemptions are exactly the two that need them._

_**One `tsx` limit worth recording.** `unpdf` was imported lazily, which reads better, and
could not be run from a script at all: `tsx` transpiles the module to CommonJS and the dynamic
specifier fails to resolve against a `data:` URL. Made static — it is server-only either way,
so pdf.js never reaches a browser bundle — which cost nothing and bought back the only place
the extraction is exercised end to end. **`scripts/ledger-reset.mts`** was added in the same
pass, because the check scripts refuse to run when rows exist and a crash before cleanup
blocks the next run; it touches Ledger tables only, and deliberately not the OAuth grant or
the projects minted alongside a property._

_Outstanding: **Gmail has never actually been connected** — the flow, the poll, the query and
the base64url attachment decode are written and unexercised, and it needs a consent screen and
a redirect URI on the Google client. **The test PDF uses a standard font**, so it proves
`unpdf` on the easy path; a real AppFolio statement embeds a subset font, which is precisely
the case §8 said a hand-written parser could not handle and precisely what this fixture cannot
prove. **RentCast is still uncalled.** And **the surface has still not been looked at**._

---

_Previously: **Phase 6, Layer 3 — the Ledger has property.**_

_**2026-08-13 — the rental.** `Property`, `PropertyValuation`, `PropertyLoan`, `Lease`, and
`Transaction.propertyId`. One nullable `ADD COLUMN` on an existing table; everything else a
CREATE._

_**A property holds the money and a Project holds the work**, and the Ledger mints that
project when you add the property. §6's own table of nouns has given "Rental 4B" as an
example **Project** since the first week, which turns out not to be a coincidence to work
around: a property has tasks, docs and a journal, all three already exist, and inventing
property-shaped copies of them would be the `AreaDoc` mistake for the fourth time. The minted
project gets `cadenceDays: null` so it can never report drift — a fortnightly warning that
you have not "touched" a house is the untrue line that got the Multilingual Baby project
deleted._

_**The card shows three different kinds of number and the whole file is about not letting
them blur.** The value is an estimate with real error bars, so it is shown with its range and
its age. The debt is a statement from the servicer, exact. The cash flow is bank
transactions, exact but only over what has been claimed — which the card says out loud.
Equity is the one derived figure; it is shown because it is what people want, and shown
beside the range rather than alone._

_**Two refusals, and they are the same rule this file keeps arriving at.** A property with no
valuation contributes **nothing** to net worth — not its purchase price, because a house
bought in 2019 is not worth what it cost and the fallback would look entirely reasonable
while being a number nobody gave us. And **depreciation is not estimated without the land
split**: that ratio comes off the county assessor, cannot be derived, and a plausible guess is
wrong by thousands a year and indistinguishable from a real figure. Both are stated on the
card as prompts rather than errors._

_**The mortgage is suggested, never assigned.** Plaid hands back a `property_address` string
and the obvious move is to match it and attach the loan. `getLoanCandidates` scores by shared
address tokens, orders the list, and stops — a mortgage on the wrong property moves the
depreciation, the interest deduction and the cash flow at once, and a Schedule E is not
somewhere to find out an inference was wrong. The scoring is crude on purpose: it orders a
short list, so precision nobody acts on would be wasted._

_**RentCast's quota guard lives inside the job, not at the call site**, because that is the
only place that knows how many calls have gone out this month — and because a refusal there
is recorded as a job result, which is where somebody would look to find out why a value
stopped updating. It returns a sentence rather than throwing: a `failed` job with backoff
would keep retrying against a limit that only resets on the 1st._

_**One real limit found, and it changed the design.** `scripts/property-check.mts` could not
call `saveProperty` at all — every action begins with `auth()`, which reads `next/headers` and
throws outside a request scope, and there is no supported way to fake one. The fix is not a
mock but a **split**, and it is the one `lib/media-rules.ts` already makes against
`lib/media-store.ts`: parsing and refusal messages moved into a client-safe
`lib/property-rules.ts`, leaving the action as the auth check and the database call. The form
and the action now refuse the same input in the same words, and the parsers have golden cases
— including that **140% is refused rather than clamped**, since silently storing 100% would
produce a confidently wrong depreciation figure. §9._

_Verified: parsing, both guards and the whole read path against real rows — equity, the value
range, YTD interest surfacing at $12,300.40, the rent gap, the cap rate, and net worth
counting the valuation rather than the purchase price. The candidate matcher scored 0.67 on a
synthetic address pair and dropped to zero candidates once linked. Database confirmed back to
zero rows. `npx tsc --noEmit`, `eslint` and `npx next build` all pass; 56 golden cases and
both earlier check scripts still pass._

_Outstanding: **RentCast has never actually been called** — no API key yet, so the client, the
quota guard and the job are written and the network call is unexercised. **The address matcher
has never seen a real servicer string.** **The action wrappers are exercised only in a
browser**, which is still not possible here. And **the surface has still not been looked at**._

---

_Previously: **Phase 6, Layer 2 — the Ledger has transactions.**_

_**2026-08-12, later — Plaid sandbox keys arrived, so Layer 2 was built and every layer so
far was run against the real API.** Transactions, holdings, loan details, the webhook, the
transfer matcher and the spending analysis. `scripts/ledger-live.mts` mints a public token
through `/sandbox/public_token/create` — Link is a browser modal, and this is the only way to
prove `lib/plaid.ts` matches Plaid's wire format rather than matching what I remembered of
it._

_**The load-bearing decision is that the sync refuses to advance its cursor if it skipped
anything.** `/transactions/sync` only ever reports what *changed*, so a row offered once and
not written is never offered again — and a row is skipped when its account does not exist
yet, which genuinely happens because the balance and sync jobs are queued together and
`drain` orders by a timestamp they share. Advancing anyway loses a week of transactions
permanently, in the data the tax figures come from, **with no gap visible anywhere**. The
guard was exercised by deleting every account and re-running: it refused, named the count,
and left the cursor `null`. §6._

_**Two conventions, each fixed at exactly one boundary, and they point opposite ways.** A
*balance* is stored as the institution reports it — always positive — because a magnitude is
a fact and which side it falls on is an interpretation. A *transaction* is inverted at ingest,
because Plaid reports a debit as positive and every downstream sum reads naturally when
positive means money in. Both verified against live data: 44 debits negative, 6 credits
positive._

_**A hand-set category survives a re-sync**, which is the seed's `update: {}` rule one noun
over: once a column is editable in the app it is a decision, and a sync that reverted it is
the failure the editor exists to prevent. **A pending row is deleted when its posted twin
arrives** — Plaid issues a new id and points back at the old one rather than modifying it, so
without this every total counts the purchase twice, which is the commonest way a spending
figure goes quietly wrong._

_**`LoanDetail` is why `liabilities` is requested at all.** Sandbox's mortgage reports
`$12,300.40` of year-to-date interest and a property address. That figure is the largest
deduction on a rental and the one number the transaction feed genuinely cannot recover — a
mortgage payment leaves the account as a single amount with the split nowhere in it — so it
arrives monthly instead of on a 1098 in February. The address is what Layer 3 will match a
property against, as a **suggestion**, never an assignment._

_**The webhook verifies properly**: `dsaEncoding: "ieee-p1363"` (an ES256 JWT signature is
raw `r‖s` and Node defaults to DER, so without it verification fails silently and every
webhook 401s), the hash over the raw body bytes, a five-minute `iat` window, and `alg` pinned
rather than read — `alg: none` is refused by name. It enqueues and returns 200; doing the work
inline would mean Plaid retrying a slow sync into several concurrent ones. **`proxy.ts` gained
its exemption as one path, not a prefix**, verified by confirming `/api/ledger/statements/[id]`
still 302s — that route will serve the bytes of a property statement._

_**The charts are hand-built and two of the three turned out not to want SVG.** A stacked
composition bar and a month-by-month column are *layouts* — widths and heights as percentages
— and expressing them as flex keeps them responsive, keeps them server components, and paints
them straight through the tokens. Only the net-worth line needs path geometry. **Carried
points are drawn dashed**: a snapshot exists only for a day the Ledger was opened, so a flat
line across a fortnight nobody looked at is a claim rather than a measurement._

_Verified end to end against live Plaid sandbox, twice, with the database confirmed back to
zero rows each time: 12 accounts mapped with none falling through to `other`, 50 transactions
with correct signs and UTC-midnight dates, 13 holdings replaced rather than appended on a
second run, 3 loans, and forged webhooks refused. `npx tsc --noEmit`, `eslint` and
`npx next build` all pass; the golden cases are at 56._

_**One real inconsistency found by the live run**: `depository/hsa` mapped to `savings` and
therefore into **liquid**, whose label is "spendable this afternoon", while `investment/hsa`
mapped to retirement. An HSA is not spendable this afternoon. Both go to retirement now,
through a `KIND_BY_SUBTYPE` table for the subtypes whose meaning does not depend on Plaid's
type. Overstating liquidity is the dangerous direction, which is the same argument that keeps
Plaid's `other` bucket out of it._

_Outstanding from this layer: **the webhook has never received a real delivery** — it needs a
public URL, so it is verified by unit-testing the verifier and curling the endpoint. Safe,
because the read-triggered catch-up makes it an optimisation. **The transfer matcher cannot be
exercised by sandbox** (one institution, so no equal-and-opposite pair exists) and is tested
against synthetic rows instead. **And the surface still has not been looked at** — the Chrome
extension has no host permission for `localhost:3100`._

---

_Previously: **Phase 6, Layer 1 — the Ledger has accounts.**_

_**2026-08-12 — "for Home & Money there are 2 things I wanna add… and I leave it up to you
to design and add any useful info so I can manage my finances."** Four asks — link every
bank and see analysis per account, add the rental properties, sum it all into a net worth
with a real breakdown, and somewhere to see how to use the tax rules to minimise what comes
out of pocket. The Home & Money area has existed since the first seed and held **nothing**.
Planned as eight layers; this is the first._

_**The standing requirement is emphatic and it shaped everything: "automate everything, I
don't want to do anything manual."** So: Plaid rather than CSV import, Gmail rather than
typing the owner statement in, RentCast rather than a value you remember to update. Where
something genuinely cannot be automated it is **named on screen** rather than left as a
quiet form — bank re-authentication after a credential expires is a person and a phone, and
the sync strip says which bank, in crimson, on every Ledger page._

_**One entry in `lib/nav.ts` was the whole cost of a sixth surface**, which is the claim §6
has been making since 2026-07-30 ("slots in as one more surface without disturbing
anything — that's the test the IA is built to pass"). The icon rail, the mobile tab bar and
`surfaceForPath` all read that array; none of them changed._

_**Money is integer cents, and the reason is the RSC boundary rather than precision.**
Prisma's `Decimal` is a class instance that Next refuses to serialize into a client
component, and it fails at runtime on the page nobody tested. The full argument is in §8,
including the honest cost: `Int` caps one column at $21,474,836.47. `centsFromDollars` uses
`toPrecision(15)` before rounding, because `1.005 * 100` is `100.49999999999999` and the
naive version rounds a half-cent **down**, silently, on about one value in two hundred —
that case is in `scripts/ledger-check.mts` and fails without it._

_**A balance is stored as the institution reports it — always positive — and
`netWorthSideFor` decides whether it counts against you.** The reflexive alternative, flip
the sign at ingest, puts an interpretation in the database where changing your mind is a
backfill. Plaid's transaction amounts get the opposite treatment and are inverted once, at
ingest, because "positive is money in" is what every downstream sum wants. The rule under
both: a convention is fixed at exactly one boundary and written down there. §6._

_**Disconnecting a bank keeps the accounts** — `SetNull`, not cascade. Two years of
transactions are what tax numbers are computed from, and a Schedule E that silently loses a
quarter because a credential expired in March is worse than none, because you would not know
to look. `disconnectItem` calls Plaid's `/item/remove` **first** and fails loudly if that
fails; the other order leaves the grant live at the bank with nothing pointing at it._

_**The two secrets get the `lib/media-store.ts` seam.** A Plaid access token reads balances
and two years of transactions, does not expire, and unlike a password the bank cannot change
it. AES-256-GCM via `node:crypto`, and **exactly one module in the codebase names
`accessTokenEnc`** — the property that makes a leak have one place to happen. The AAD is a
per-column label, so a ciphertext cannot be moved between columns; verified, along with
tamper detection. **What this protects against is a database dump** — a downloaded backup, a
leaked `DATABASE_PUBLIC_URL`, a Prisma Studio session left open. Not a compromised host,
which holds the key by necessity. Saying so is the point._

_**"Automate everything" produced more visible machinery, not less**, because automation
fails by going quiet. Every surface built before this shows data you entered, so a bug is
obvious; a Ledger whose last sync was eleven days ago looks exactly like one that synced this
morning. Hence `LedgerJob` — a row per outbound call, with backoff on the row rather than in
a retry loop — the sync strip on every page, and failures sorting first in the log
regardless of age. §6._

_Verified without a browser, which is the gap in this layer. **`scripts/ledger-check.mts`,
54 golden cases**, including the float trap and the fact that `"0.00"` and `"n/a"` must not
collapse into each other. **`scripts/ledger-smoke.mts`** runs the whole data path against the
real database: five accounts across both sides, asserting that $250,000 of assets and
$403,000 of debt come out at −$153,000 rather than $653,000 — the failure a sign convention
produces, and not one you spot by looking, because the number is plausible. It also confirms
the token round-trips as ciphertext, that excluding an account drops it from the total while
leaving it listed, that the snapshot is one row per day however often it runs, and that
deleting an item nulls `itemId` rather than cascading. **It deletes everything it made and
asserts the database is back where it started**, which it was. `npx tsc --noEmit`, `eslint`
and `npx next build` all pass._

_**One real bug found, and only by curling it.** `/api/ledger/jobs/run` accepts a session
**or** a `LEDGER_JOB_TOKEN` bearer, and the proxy cannot see the second one — so a Railway
cron holding a valid token got a `307` to `/login`, followed it, received HTML, and would
have reported success while running nothing. It would have looked fine forever from a
browser, which has a cookie and takes the other branch. This is Phase 4.21's manifest bug in
a second costume and the tell is identical: **a 302 is not an error anywhere in this app.**
Exempted as **one path, not a prefix** — `api/ledger/statements/[id]` will serve the bytes of
a property statement and must keep 302ing. Now curl-verified at 401 with no token, 401 with a
wrong token, 200 with the right one, while `/ledger` and `/api/journal/media/[id]` still
302. §9._

_Outstanding from this layer: **the surface has not been looked at.** The Chrome extension
has no host permission for `localhost:3100`, so everything above is build, typecheck, lint,
two check scripts and curl — and not a screenshot. **Plaid Production is an application with
a review and bills per linked bank per month**; this is built against Sandbox, and the
application should be in flight while Layer 2 is built. **Renaming an account is overwritten
by the next sync** — a nickname that survives needs its own column, which belongs to a layer
with a reason for one. **Property is a column on `NetWorthSnapshot` that is always zero**
until Layer 3._

---

_Previously: **Phase 5.6 — a task keeps a log.**_

_**2026-08-11 — "add comments section to task — make sure have time and date for the comment
as well."** The panel could say everything about what a task **is** — its title, its due
date, its track, the steps it gets done in — and had nowhere at all to say what had
**happened** to it. `Task.notes` is the only field that could have held it and it is one
field you rewrite, so appending to it gives you an undated wall in which "the export times
out at 30s" and "it was the proxy, not the query" are two days' findings with nothing to
say which came first. A `TaskComment` is a row per moment. Purely additive migration, every
statement a CREATE._

_**The stamp was the ask and it is also the rule.** It comes from the server's clock and
nothing can move it — §6, "The date is not a field", which the journal arrived at the hard
way on 2026-08-06. **There is no edit either**, which goes one step further than the journal
does: an entry is a paragraph you were composing, a comment is a sentence, and the honest
fix for one that came out wrong is to delete it and say the thing again with the time you
actually said it. The label reads "Today, 14:49" and carries the full weekday-and-year stamp
on hover, because the year is four characters of noise on a thread written this week and the
only thing you want months later._

_**Two things were taken from surfaces that had already solved them.** The thread runs
oldest-first with the composer at the end of it, which is the journal's "a day is a thread"
— a sequence of things that happened to one object is an order, not a list, and every *list*
in this app being newest-first does not make this one. And **Enter makes a new line while
Ctrl+↵ posts**, which is §6's "Enter is not Post" from the other side: there the headline
field was submitting a journal entry with no body in it, and here a comment is prose, so the
key that ends a paragraph must not file it._

_**The one design decision with a real alternative was where to read them from.** The
checklist is nested in `TASK_VIEW_SELECT` on the argument that it is never read apart from
the row it belongs to, and copying that here would pull every comment body on a board of
ninety rows to render a board that displays none of them. A comment is only ever read
**inside the panel**, so it is fetched when the panel opens — the same bargain a project
page makes by running only the active tab's heavy read. Nothing revalidates for the same
reason: no server-rendered surface reads these._

_Verified in a signed-in browser against the live database, on the Hunt Board and on Today —
the panel is shared, so the section arrived on four surfaces with no per-surface work.
Posted a two-line comment with Ctrl+↵ and confirmed Enter had made a line break rather than
filing it; both lines survived the round trip and the stamp read "Today, 14:49". Closed the
panel and reopened it to confirm the thread comes back **from the database** rather than from
the component's own state. Posted a second with the button and watched it land underneath at
14:52, which is the ordering. Deleted both from the ×, and in dark theme posted and deleted a
third to confirm the tile reads on `bg-inset` over the panel. **The board was confirmed back
where it started** — 0 comment rows, 195 open tasks, and the test task's title, notes, status
and due date untouched. `npx tsc --noEmit`, `eslint` and `npx next build` all pass._

_**One environment finding, not caused by the change and worth writing down**: `/board`,
`/login` and even `/manifest.webmanifest` all 404'd on a fresh `next dev` while the root
layout still rendered — no route in the app matched, and Turbopack logged no compile at all.
A leftover **production** `.next` in the same directory; deleting it fixed every route in one
step. It reads exactly like a broken build, which is the same family as the stale-stylesheet
note in §9. Also: **port 3000 on this machine is the Utaitai frontend**, and this app's dev
server is `next dev -p 3100`._

_**"Delete this task" moved into the footer** in the same pass, and the comments are why it
had to. It was the last thing in the scrolling body, which was fine when the body ended at a
short checklist — now the column below Notes grows with every comment written, so the one
destructive control on the panel was drifting further out of reach the more a task was used.
In the footer it sits beside Cancel and Save, which are the panel's other two verbs. It is
`mr-auto` rather than a `justify-between` row, because a **new** task has nothing to delete
and `justify-between` with two children would throw Cancel to the far left. Verified both
ways — the edit panel puts Delete left with Cancel and Save right, the new-task panel keeps
Cancel and Save right with nothing on the left — and the delete itself was exercised end to
end on a throwaway task, which is now gone. The board is back at 195 open._

_Outstanding from this change: **nothing on any card says a task has comments**, so a thread
is invisible until you open the row — the fix is a `_count` on queries already running plus a
badge on three card layouts that are one line tall by deliberate correction, which is a layout
decision rather than a lookup and was left rather than guessed at. **Comments are plain
text**, matching Notes beside them; the Markdown toolbar takes any textarea ref, so it is four
lines whenever it is wanted. **And it has not been seen on a real phone**, unchanged since
Phase 4.8._

---

_Previously: **Phase 5.5 — Montblanc's replies render, and it remembers.**_

_**2026-08-10 — "can you fix formatting for montblanc response? also is there a way to store
montblanc chat history so it has some context of what I'm concerned about, my state of mind
and how it changes?"** Two asks about one drawer. The first is a bug: the reply was plain
text in a `<p>`, so `**Post today's shorts**` arrived with its asterisks — while
`components/ui/markdown.tsx`, which parses exactly the subset the model emits, has been in
the repo since the Docs tab. Nothing needed writing; the two had to meet._

_**The screenshot showed a worse problem than the asterisks.** `find_tasks` had already put
twelve rows on screen as tappable cards, and the prose underneath **listed all twelve again**.
That is the prompt, not the renderer: it said "answer in ONE short sentence" and said nothing
at all about answering a question, so a question got an improvised briefing. It now names two
answer shapes, the exact syntax the renderer supports — no headings, no tables, no nested
bullets, each with the reason — and a rule never to restate the cards. That last one is what
the answer is actually for: which row matters and why, which is the thing a card cannot say._

_**The memory ask needed a distinction this file did not have: a transcript is not a
memory.** §6 has refused a chat log since Phase 5, and every word of that argument is about
the drawer. It was never an argument against the app *knowing* anything. So the drawer still
opens on a blank sheet, and underneath it the log is kept and **never sent to the model** —
what is sent is fifteen dated one-line notes distilled from it, about 200 tokens. Same trade
this file already made against a `list_projects` tool. **Dated notes rather than a rolling
summary**, because "how it changes" was half the ask and a blob you overwrite records the
present by destroying the past; a note that can be superseded records both._

_**The honest half of "state of mind": a command bar is a poor mood sensor.** Most turns are
"add a bug to Sleepy Cat", which reveals nothing emotional, and a model asked for a mood will
supply one. So the distiller records behaviour — what is returned to, deferred, preferred —
and is told in those words never to infer a feeling. Guessing would be the app asserting
things nobody told it, on the one subject where being wrong is worst._

_**The real find was in the prompt, and only driving it caught it.** The rule that matters
most is that memory must **choose** and never **speak** — the sprint died because the screen
opened twenty times a day became the one keeping score, and an assistant reciting your
patterns back is that screen with a voice. Told only "never repeat them back", the model
opened its very next answer with **"You keep circling the paywall without shipping it."** A
prohibition was not enough; it needed the specific constructions banned by name ("you keep",
"you tend to", "as usual") and a good and a bad answer shown for the same note. Re-run against
the identical two notes, the same question came back "Start with recording the old conversion
rate… **About twenty minutes.**" — the twenty-minute note steering the suggestion without ever
being said, which is exactly the design._

_Verified on a production build in a signed-in browser, then at a genuine 390×844 viewport
(§9's iframe technique). **The check that matters most was run first**: a pure filing turn —
"add a bug to Sleepy Cat" — was logged, distilled, and produced **zero notes**. A real
two-turn conversation produced two, both behavioural and neither inferring a mood. Telling it
the paywall had shipped **superseded** the concern while leaving the unrelated note live.
Asked outright what it remembered, it said so plainly. The × removed a note from the list and
from what the model is handed, keeping the row. A backdated orphan conversation was distilled
by the sweep on the next drawer open. A resumed thread continued the **same** conversation —
six messages on one row, `distilledAt` back to null — so the half that arrived after the first
close is not lost. `npx tsc --noEmit`, `eslint` and `npx next build` all pass, the new
utility was grepped out of the emitted CSS per §9, and the console is clean._

_**Every test row was removed afterwards and the board confirmed back where it started** —
194 open, 4 ticked today, Sleepy Cat at 5d ago. Two pre-existing Utaitai rows that Montblanc
ticked off during the conversation were reopened rather than left done, and the Baby area's
real journal entry from this morning was left alone._

_**One real defect found by the phone check, and it was pre-existing.** At 390px a pasted URL
in the question scrolled the whole message list sideways by 307px: the user bubble is
`max-w-[85%]` with no `break-words`, and a URL is one unbroken word. Fixed there and on the
link class, so a long link in an answer cannot do it either._

_Outstanding from this change: **the notes have only ever been distilled from conversations I
staged**, so nothing here has met a week of real use, which is the only thing that shows
whether they earn their place in the prompt. **Nothing shows a note's source** — `sourceId` is
written and the log is kept, and no screen joins them, so "why do you think that" is a
database query. **Distillation has no cost ceiling**: one model call per conversation, unseen
and unaccounted. **And it still has not been used on a real phone**, which the memory list
wants most, being the one new thing in the drawer that can get long._

---

_Previously: **Phase 5.4 — the photo viewer swipes.**_

_**2026-08-09 — "in mobile mode, make it so the journal photos can be swiped to view. rn i
can't swipe."** The viewer shipped with arrows, arrow keys and Escape, which is a pointer
device's whole vocabulary — so on a phone you could open a photo and then only stare at it.
Every photo viewer on a phone swipes, so one that doesn't doesn't read as minimal, it reads
as not finished loading. Same shape as the phone's chrome in 4.20 and the full-screen camera
in 4.18: a surface built at 2560px and met with a thumb. No schema change and no migration;
nothing outside `media-grid.tsx`._

_**The current item and its two neighbours sit on one track that follows the finger**, rather
than the shorter build — detect a flick, animate the next one in. The shorter one gives you
nothing until the gesture is over, and the entire reason to drag a track is that **the next
photo is visible while you are dragging toward it**: that is what says the gesture is working
before you have committed to it, and what turns a half-swipe that springs back into a
decision rather than a dead press. **Committing is then only `onIndex`** — the neighbour
keeps its key, so React keeps the DOM node and the transition carries it from ±100% to 0 by
itself, and the arrows and arrow keys go down the same line. There is no second animation
path to keep in step, which is the whole reason it is this small._

_**Two things it needed that are not the gesture.** `setPointerCapture` is taken **at the axis
lock, not on the press**: a captured pointer sends its `click` to the capture element, so
capturing every press would make a tap on the photo arrive at the backdrop, which closes the
viewer. And a **flick that ends over the backdrop must not also be a tap on it**, which is one
ref set when the gesture becomes a swipe. Both are the kind of thing that works in every test
you write and breaks the one interaction people actually do._

_**One real bug in my own change, found by driving it rather than reading it.** Dispatching a
whole gesture in one synchronous burst — every move and the release in a single task — the
swipe silently did not commit, because the release read the distance off `drag` state and
React had not re-rendered yet. A real finger always gives React that gap, which is exactly why
it would never have shown up. The distance lives on the gesture ref now and the burst commits._

_Verified on a production build at a genuine 390×844 viewport (§9's iframe technique,
`matchMedia("(min-width: 48rem)")` false inside it) against the Baby area's real 52 photos.
On a 7-photo entry: the track holds at −90/+316 mid-drag with transitions off, releasing past
the 70px threshold goes 1/7 → 2/7 and settles at exactly −406 / 0 / +406, a 40px swipe does
not commit and springs back, a 200px pull at index 0 moves 70px (0.35×) and commits nothing, a
200px vertical drag moves the track not at all, and the far end renders two slides with no
Next button. A drag starting on the Next arrow and one starting on an injected `<video>` both
leave the track alone, while the same drag on the photo commits. **The pre-existing behaviour
was re-checked rather than assumed**: tapping the photo keeps it open, tapping the backdrop
closes, the arrows and arrow keys still step, and `body.overflow` is restored on unmount.
Desktop confirmed untouched at 2560×1271 — the viewer fills the window, the photo sits at
905×1207 inside its `p-8`, arrows and keys unchanged. `npx tsc --noEmit`, `eslint` and
`npx next build` all pass, the five utilities were grepped out of the emitted CSS per §9, and
the console is clean._

_**§9's occluded-window limit showed up twice, both times exactly as written.** Transitions
never advance, so the track reads its *start* values until `*{transition:none !important}` is
injected — and `animationend` never fires, so the close leaves the dialog mounted. Dispatching
the event by hand unmounted it and restored the scroll lock, which is what confirms the close
path is intact and the harness is the thing that is stuck._

_Outstanding from this change: **no clip has been swiped past**, because the journal holds 52
photos and zero videos — the guard that keeps a gesture starting on a `<video>` away from the
track was exercised against an injected one, which tests the selector and not a clip. **No
pinch to zoom**: a photo opens fit-to-screen and that is all it does, and zooming is a second
gesture on the same surface that was not asked for. **And it has still not been swiped with a
thumb** — synthetic pointer events at a real phone viewport are much closer than reasoning and
are not a finger._

---

_Previously: **Phase 5.3 — the journal composer can write.**_

_**2026-08-09 — "give the journal text input some formatting option; and on the title, after
I type and hit enter the cursor should go to the content, not post it."** Two asks about one
box, and the second is not a feature request — it is a bug nobody decided on. **A form with
one text input submits on Enter**, which is the browser's default and which the composer
inherited because its other field is a `textarea`, where Enter already means what it should.
So the most natural keystroke in the sequence — name the thing, then say what happened —
filed an entry with no body in it. On a journal that is worse than a lost draft: the row is
dated from the server's clock and cannot be moved (§6, "The date is not a field"), so the
recovery is editing something that now exists at a time you did not choose to write at.
Enter moves to the body now, at the **end** of what is already there, because on an entry
being edited the headline is a thing you go back up to fix and the caret should not land in
front of an existing paragraph._

_**The toolbar offers exactly the seven things `lib/markdown.ts` renders** — bold, italic,
link, bulleted, numbered, quote, code. That list is not a judgement about what is useful; a
button inserting syntax the renderer prints as literal characters is worse than no button,
because it teaches you a thing the app then refuses to do. Headings are the one omission
with its own reason: the entry has a headline field above the body, and a second title
inside it is the field being ignored._

_**It writes into the textarea and never owns its value**, so the composer stays the
uncontrolled form every other field in this app is. The reflex build lifts the body into
React state so the buttons can transform it, and that makes a controlled form out of the one
surface whose whole argument is that it costs nothing to type into. Editing the element in
place is also what lets `Ctrl+B` work without going through the component at all — the
keyboard handler and the button call the same function on the same element._

_**Edits go through `execCommand("insertText")`, which is deprecated and which is right.**
It is the only way to change a textarea's value and keep the browser's **native undo
stack**; `setRangeText`, the modern non-deprecated call, silently discards it, so bolding a
word would make the next Ctrl+Z throw away everything typed before it. That is invisible
until it costs you the paragraph. Verified rather than assumed: two toolbar edits, two
Ctrl+Z, back to the plain sentence._

_**One real bug in my own change, found by driving the buttons rather than reading them.**
`*` is a prefix of `**`, so "does this already carry my markers", answered with `endsWith`,
gets `***bold and italic***` wrong in both directions. Bold, then italic, then italic again
produced `****stayed****` — it declined to unwrap and added a fourth pair. The test counts
the asterisk run now: an odd run has an italic marker in it, a run of two or more has a bold
pair. All six transitions between plain, bold, italic and both now round-trip._

_Verified on a production build in a signed-in browser. Enter in the headline left the value
intact, moved focus to the body and posted nothing. Bold wrapped, unwrapped and re-selected
the inner word; bulleted → numbered **replaced** the marker rather than stacking it; quote
toggled; link came back as `[happy](https://)` with the address pre-selected for typing. A
real mouse click on a button kept the textarea's focus and selection, which is the
`onMouseDown` guard doing its job. One entry was saved end to end — bold and a three-item
list rendered correctly — and **deleted afterwards, with the Baby area confirmed back at its
19 entries**. At a genuine 390×844 viewport (§9's iframe technique) all seven buttons sit on
one row ending at x=264 of 390, zero horizontal overflow. Sleepy Cat's Journal tab gets the
same toolbar unchanged — the third time the 2026-08-09 generalisation has paid for itself.
`npx tsc --noEmit`, `eslint` and `npx next build` all pass, the four new utilities were
grepped out of the emitted CSS per §9, and the console is clean on both surfaces._

_Outstanding from this change: **the Docs editor still has no toolbar**, and it is the more
Markdown-heavy of the two surfaces — the component takes any textarea ref, so it is four
lines whenever it is wanted, and it was left out of scope rather than overlooked. **No
preview**, deliberately: the entry renders formatted the moment it is saved and editing is
one tap, so a live preview would double the composer's height to answer a question that
answers itself. **Enter on a bulleted line does not continue the list.**_

---

_Previously: **Phase 5.2 — one shutter, and the front camera the right way round.**_

_**2026-08-09 — "no need to have 2 buttons for 2 options, it's so against minimal UI."**
Correct, and the mode strip shipped hours earlier was the same mistake wearing a better
hat: it still asks you to declare what you are about to do **before the thing you are
pointing at has finished happening**. A baby does the thing once. So there is one control —
**tap for a photo, hold to record** — which is what every phone camera already does, and
which takes a permanent row of chrome off a surface whose whole argument is that the preview
is the screen._

_The photo fires on **release**, because until the finger lifts there is nothing to tell the
two gestures apart and 350ms is well under where a shutter feels slow; the hold starts
recording **at** the threshold, because a clip has to cover what you were reacting to rather
than begin after it. **A release just past the threshold runs on to a second** instead of
stopping — a 70ms recording is one `MediaRecorder` hands back with no frames in it, so the
honest outcome of a gesture that worked would have been "that clip came back empty"._

_**The mirror had been wrong since the camera was written.** WebKit hands back a mirrored
track for `facingMode: "user"`, so the viewfinder showed a flipped world and every
`drawImage` stored one. It is undone once, as a single flag driving the video element's
`-scale-x-100` and the canvas transform together — two consumers, one decision, which is the
rule the filters and the crop already follow. **The rear camera is untouched**, and which
one it is comes from `getSettings().facingMode` rather than from what was asked for: a
desktop grants its only camera whatever was requested and reports nothing back, so trusting
the request would have left a webcam pointed at your face on the "environment" branch._

_**One real bug in my own change, found by driving the shutter rather than reading it.**
`setPointerCapture` throws `NotFoundError` when the pointer is no longer active by the time
the handler runs, and unguarded it took the **entire press** with it — no photo, no
recording, nothing on screen. The capture is a convenience; the tap underneath it is the
control, so it is wrapped and the press is armed before the attempt._

_Verified on a production build in a signed-in browser against a synthetic front camera whose
left half is blue and right half green. A tap closed the sheet and stored a **426×720** photo
— the previewed rectangle, not the 1280×720 sensor frame — with **green on the left and blue
on the right**, i.e. the flip baked in and agreeing with the preview. A hold read "Tap to
take a photo" at 250ms and "Recording — release to stop" at 500ms with the countdown showing
`10s`, and released at ~2.3s produced an `video/mp4` clip cropped and flipped the same way.
A release 70ms into recording produced a clip and **no empty-clip error**. Reporting the
track as `environment` gave `scale: none`, no flip class, and a stored photo matching the
source exactly. Nothing was submitted, and the Baby area is back at its **19 entries**.
`npx tsc --noEmit`, `eslint` and `npx next build` all pass, and the three new utilities were
grepped out of the emitted CSS per §9 (`.-scale-x-100`, `.touch-none`, `.select-none`)._

_Outstanding from this change: **the clip's real length has never been exercised**. The
verification window is occluded, so `visibilityState` is `"hidden"` and
`requestAnimationFrame` fires about once a second — the canvas path therefore records a
single frame and every clip reports 0.03s. That is §9's documented harness limit rather than
a fault, and it is unfixable from here: both the fake source and the component's own draw
loop are rAF-driven. **And no frame has still ever been captured from a real camera**,
unchanged since Phase 4.16._

---

_Previously: **Phase 5.1 — the camera is the screen, and a project keeps a journal.**_

_**2026-08-09 — "look at the TikTok camera layout, can you make the camera in journal have a
similar layout."** The reference is a viewfinder with nothing beside it and every control
floating over it, and holding it up against what was there names the problem: the sheet went
full-bleed on a phone two days ago, and that fixed the *frame* while leaving the *stack* — a
header row, the preview, a filter row, two buttons. So the preview fills the surface at every
width now and the chrome sits on the glass: close top left, flip and the grades on a rail top
right, a mode strip and one shutter at the bottom._

_**The two buttons becoming one shutter is the substantive part.** "Photo" and "10s clip" sat
side by side and both looked like the primary action, so the screen had no answer to which one
you press. Naming the mode first and pressing one big round button is how every camera works,
and it is what buys a target you can hit one-handed — which is the entire operating context of
a camera you open while holding a baby. **The ring is the countdown**, because a recording that
cuts itself off at ten seconds has to say so before it happens or the stop reads as a failure,
and the inner shape morphs to a rounded square rather than the surface growing a word._

_**One real bug was behind the layout.** The preview is `object-cover` in a frame that is rarely
the camera's own shape, and the capture drew the **whole sensor frame** — so the stored photo
was wider than the one composed, silently, and had been since the camera was written. It now
crops to exactly the rectangle on screen: 740×720 out of a 1280×720 camera in a 416×405 frame,
matching the previewed aspect to four decimals, for clips as well as photos. That is the rule
the filters already follow — one CSS string, two consumers, so a preview cannot lie about the
result — applied to geometry rather than colour._

_**And the phone check found the bigger one.** At a genuine 390×844 viewport the "full screen"
camera began below the tab strip and ended above the tab bar, because `animate-rise` leaves a
transform on every day section and a transformed ancestor is the containing block for
`position: fixed`. It is the third time this exact mechanism has bitten — the media viewer
portals around it, §9 records it for the media dropdown — and the third time it was found by
looking at the page rather than reading the code. Portalled to `<body>`, and the scrim now
measures 390×844 with the frame filling it exactly and square corners below `sm`._

_**The second ask needed no new noun, only a second owner.** `JournalEntry` gained a nullable
`projectId` beside a now-nullable `areaId`, exactly one set — the `ProjectDoc → Doc` change of
2026-08-05, one noun over, with the same union-type enforcement in the one file that writes.
A devlog is something that already happened, which is exactly what the four tabs beside it on a
project page are not: a Task is binary and forward-looking, an Event asserts a time, a
ContentItem goes to an audience, and a Doc is a page you maintain rather than a dated record
you add to. **The whole `Journal` component moved across unchanged except in what it is
handed**, which is the argument for generalising rather than duplicating, made for the second
time. The owner is **create-only** — it says which page to revalidate and is never written on
an update — because the entry's date is already immutable on the same principle, and an owner
you could move would be the one remaining way to rewrite a record after the fact._

_Verified on a production build in a signed-in browser, and at a real 390×844 viewport via §9's
iframe technique. Wrote an entry on Sleepy Cat's new Journal tab and watched it land on today's
thread at 15:27 with the composer collapsing to "+ Add to today"; deleted it afterwards and
confirmed the project journal back at 0 while the Baby area's **17 entries and their photos are
untouched** and still serving from `/api/journal/media/[id]`. Exercised the camera against a
synthetic `getUserMedia` feed: a photo and a real `MediaRecorder` clip both came back at the
cropped 740×720, the ten-second auto-stop fired, and the composer counter read "2 of 10". At
390px the scrim is the viewport, radius 0, `body` overflow hidden, zero horizontal overflow.
`npx next build`, `tsc --noEmit` and `eslint` all pass._

_**One harness lesson re-learned, already in §9:** an occluded Chrome window reports
`visibilityState: "hidden"` and does not advance animations, so `animate-panel-in` left the
frame parked at its `translateX(100%)` start and the dialog measured 416px off-centre. That is
the harness, not the layout — but it is what prompted looking at the entrance at all, and
`animate-panel-in` was genuinely the wrong one: it is the **side panel's** slide, and a centred
dialog should arrive with `animate-rise` (§10)._

_Outstanding from this change: **no frame has still ever been captured from a real camera** —
granting Chrome's camera permission is the user's call, unchanged since Phase 4.16, so
everything around the capture is exercised and the lens itself is not. **Nothing links a
project's journal to its Docs tab**, and a devlog and a doc will eventually want to point at
each other. **Captions still have no UI**, now on a third surface._

---

_Previously: **Phase 5 — Montblanc is in the drawer.**_

_**2026-08-09 — "sometimes I want a quick: add this bug to this app, add this idea to social
media — and I have to navigate around the board and sometimes forget where things are."**
That is a filing problem and a wayfinding problem, and neither is solved by conversation. So
Montblanc shipped as a **command bar**: `Ctrl+K` from anywhere, one sentence, and the row
exists. No schema change and no migration — Phase 5 turned out to need no new nouns at all,
because everything it files already had one._

_**It took the search pill's place, and that is the point rather than a convenience.** That
control was the widest element on a phone and it was **disabled** — §6's own "A phone's
chrome is mostly ornament" complains about it by name, three phases ago. Asking in a sentence
also strictly contains searching: "what's overdue" is a search, and "add a bug to Sleepy Cat"
is not a query anybody could have typed there._

_**DeepSeek, and the AI SDK went with Qwen.** The provider changed because I already hold a
DeepSeek key, and §3's promise that this would be a one-file change held — it was one file.
What was not planned is that the Vercel AI SDK went too: what Montblanc needs from a provider
library is a tool-calling loop, which is thirty lines sitting in `route.ts` where it can be
read, and **nothing here streams tokens**. It streams *events* — "Writing it down…", then a
receipt, then one sentence — because the useful thing to watch during the four seconds a tool
round takes is which tool is running, not prose being assembled. Same trade §8 made twice
before, against a calendar library and against shadcn._

_**Every write goes through the UI's own server action.** `tools.ts` builds `FormData` and
calls `saveTask`, `saveContentItem`, `saveProject`, `saveEvent`, `saveJournalEntry`. It reads
oddly for a machine-to-machine call and it is the cheaper half of the trade, because the
invariants live in those actions and nowhere else — a task's area taken from its project so
the two cannot disagree, a recurring task's first occurrence inferred rather than becoming a
rule that never fires, a slug minted once, a journal day that comes from the clock and cannot
be supplied. Talking to Prisma directly is shorter and means a rule added to `saveTask` next
month silently does not apply to the assistant._

_**What exists is in the prompt, not behind a tool.** The obvious build gives it a
`list_projects` and lets it go and look, which costs a whole extra round trip on **every**
request to fetch ~2,000 characters that change once a fortnight. Handing them over up front
makes "add a bug to Sleepy Cat" one model call instead of two, and it is also what makes the
slugs reliable — the model is choosing from a list it can see rather than guessing an
identifier._

_**The one decision that runs against the grain of this whole file: it writes without asking
first.** The rule here has always been that the app must not assert things nobody told it,
and an assistant that can write rows is the first thing in the app able to commit that error
at speed. The reflex fix is a confirmation step, and it fails on the ask — "quick, add this
bug", one-handed — by turning one tap into two on every row including the ninety-five in a
hundred that were right. **A receipt with an Undo is what buys the right instead.** §6 already
priced it: a row you wrote costs one tap to delete, a row you did not write costs a stop and a
re-read. Montblanc's rows sit between the two, and seeing exactly what was made and where,
without going to look, is what moves them into the first category. The prompt carries the rest
— never invent a due date, never guess between two projects, exactly one row per thing asked
for, no notes that were not dictated, and a thing you owe is a task even when it has a date._

_**Verified end to end in a signed-in browser against the live model**, and the checks that
matter are the ones about what it did **not** do. "Add a bug to Sleepy Cat: the cat clips
through the sofa" produced one task with `dueDate: null`, `notes: null`, track `Build`,
project Sleepy Cat and area Work inherited from it — nothing invented in the two columns most
available to invent in. "Remind me to renew the domain before the 20th" **did** get a date,
stored as `2026-08-20T00:00:00.000Z`, UTC midnight as a `@db.Date` must be — and **no
project**, filed to One-offs rather than guessed at among four. "Coding mom idea: a devlog
about the sleepy cat difficulty curve" came back brand **Coding Mom**, project **Sleepy Cat**,
which is §6's two-axis case arriving unprompted from one sentence._

_The best of the six was **"paediatrician appointment on thursday at 2pm, and remind me to
pack her red book for it"**, which produced **two rows of different kinds**: an Event at
`2026-08-13T21:00:00Z` — 14:00 Pacific, end defaulted to +1h, filed under **Baby** — and a
Task for the red book. That is the §6 distinction the calendar exists on ("a thing you owe is
a task, even when it has a date") drawn correctly inside a single sentence, which is the thing
most likely to have gone wrong. "What's overdue on sleepy cat?" came back **12**, matching
Today's badge exactly, each row a link. "Where do I add a new tiktok account?" landed on
`/studio/channels` — and ignored the "no thanks" prefixed to it, so the previous turn's offer
was correctly dropped._

_Undo was exercised on a task and on an event; both cards went to **REMOVED**, struck through,
and the rows were gone. Every test row was deleted afterwards and the board confirmed back at
**196 open tasks**, where it started. `npx next build`, `tsc --noEmit` and `eslint` all pass._

_**One real gap was found, and by reading the accessibility tree rather than by looking**: the
icon rail still carried a **disabled "Montblanc — arrives in Phase 5"** button at its foot,
which is below the fold on a short window and never appeared in a screenshot. It is the moogle
mark and a second way in now. It sits apart from the four surfaces above it rather than
joining them, because it is not one — §6's rule against a fifth nav item is unaffected._

_Outstanding from this change: **it does not know which screen you are on** — one field on the
request, deliberately not guessed at before use. **It cannot edit or delete**, beyond ticking a
task off and undoing its own writes. **The transcript is not kept between opens**, which is
deliberate and may prove wrong. **`Ctrl+K` is Chrome's own omnibox shortcut**, so it only
reaches the page when focus is already in the document — the pill and the rail button are the
reliable routes and the shortcut is the fast one. And **the proactive half — a daily briefing,
drift nudges — is not built and is the part most likely to reproduce the sprint's failure**: a
thing that speaks unbidden about what you have not done._

---

_Previously: **Phase 4.21 — it installs.**_

_**2026-08-09 — "it's such a hassle having to go to the website; sometimes I don't remember
the URL because it's on Railway and it's too long."** That is not a complaint about a
surface, and it is the first one in this file that **nothing inside the app could have
fixed**. Twelve phases have worked on what happens after the app is open; the expensive step
was one earlier — find Safari, remember that the address is a Railway subdomain, type enough
of it to hit history. The fix is an icon on the home screen: a web app manifest, a service
worker, four generated icons. No schema change, no migration._

_**`start_url` is `/today`, not `/`.** Opening the app should land on the screen it exists
for, and `/` only ever redirects there — a round trip removed from the slowest moment there
is. `display: standalone` rather than `fullscreen`, because the OS status bar should stay:
going fullscreen would hide the clock on an app whose whole subject is what time it is._

_**The icons are generated PNGs and that is not laziness avoided, it is a failure avoided.**
`apple-touch-icon` has never supported SVG and Chrome's support for SVG manifest icons is
patchy, so pointing at the mark the app already has produces **a blank square** on the one
screen this change exists to improve. `scripts/generate-icons.mjs` redraws the moogle from
three primitives — a circle, a capsule, and a circle clipped by a rounded rectangle, which
is what that one `c`-heavy path actually is — supersamples it 4×4 and encodes the PNG
itself. No dependency for four files that change once a year. **A maskable copy is drawn
smaller**, because Android masks a home-screen icon to the launcher's shape and an "any"
icon fed through that mask loses the pom off the top of the mark._

_**The service worker deliberately caches nothing that changes**, which is the whole design.
The reflex is a cache-first shell, and here that is actively harmful: every surface is a
server-rendered view of a database that moves as you use it, so a cached shell would show
last Tuesday's tasks **and let you tick them**. That is this file's oldest objection — the
app must not assert things that are not true — with the assertion made by machinery instead
of by a seed script. Navigations go to the network; the cache is consulted only once the
network has actually failed. Nothing touches a non-GET request, an `/api` route or another
origin, so no session and no upload can ever come from a cache._

_**Two things would have silently cost the whole feature.** `proxy.ts` gated the manifest,
the icons and the worker — and the browser fetches all three **before** anyone signs in, so
each 302'd to /login, the manifest failed to parse, and the install prompt would simply never
have appeared, with no error anywhere but a devtools line. And Next's `appleWebApp.capable`
emits only the standardised `mobile-web-app-capable`, which Safari ignores before iOS 17: on
an older iPhone the installed icon opens **in Safari, with the address bar**, which is the
original complaint arrived at by a longer route. The deprecated spelling is written by hand._

_**Then every page was read at a genuine 390×844 viewport**, and the sweep found a real bug
that had nothing to do with installing. **A `grid` with no base `grid-cols-*` has no column
definition below its breakpoint** — the browser makes an implicit `auto` track floored at
min-content, so one long word takes the page sideways. The project page's Overview was
scrolling **126px horizontally** on a phone and had been since it was written; it is
invisible on a desktop, where the `lg:` variant supplies real columns. Three more places
were one long word from the same fault. This is §9's `minmax(0, 1fr)` rule in its Tailwind
form, now written down. The calendar's area filter was the other one: six pills in a row
that could not wrap, overflowing 10px and rendering "Home & Money" **on three lines, clipped**.
It is a scrolling strip now, with a `no-scrollbar` utility, because a grey bar under a row of
pills is the loudest thing on a screen whose entire vocabulary is near-invisible chrome._

_Verified on a production build at 390×844 in a same-origin iframe (§9's technique). All
sixteen surface/tab combinations report zero horizontal overflow — Today, Hunt Board, all
three calendar views, Studio, batch, channels, four project pages and their four tabs, three
area tabs — plus the task panel, the event panel and the sidebar drawer, each read as a
screenshot rather than a number. **Desktop confirmed untouched rather than assumed**: at
2560px the project Overview is still three equal columns with the main one spanning two, and
the calendar toolbar is still a single 40px row whose pill strip does not scroll. The
manifest parses (name, `/today`, standalone, 3 icons, 3 shortcuts), the worker is active,
controlling, and genuinely intercepts navigations (`workerStart > 0`), and **the offline page
was proved by killing the server**: /board came back as "No connection, kupo" instead of
Chrome's error, and recovered on restart. The theme-color meta round-trips light → dark →
light with the toggle. `npx next build`, `tsc --noEmit` and `eslint` all pass; console clean._

_**One §9 trap re-encountered, exactly as written.** The `no-scrollbar` utility appeared not
to work — the class was on the element and `scrollbar-width` computed as `auto`. That is the
Turbopack stale-stylesheet symptom from Phase 4.18, not a broken utility: `npx next build`
plus `grep -F` of the emitted CSS found `.no-scrollbar{scrollbar-width:none}` present, and a
production `next start` on port 3100 is where the fix was actually seen. Costing this twice
is what the note is for._

_Outstanding from this change: **it has still not been installed on a real phone.** Desktop
Chrome can prove the manifest, the worker and the offline page; it cannot show the iOS
install flow, the standalone status bar, or the home indicator sitting against the tab bar.
**The Railway URL is still the Railway URL** — a custom domain is the other half of this and
is a Railway setting plus a DNS record, not code; the install is what makes the URL stop
mattering day to day, but a re-install still needs it. **No push notifications**: the worker
has no `push` handler, that is Phase 7 — and on iOS it requires the app to have been
installed first, which it now can be._

---

_Previously: **Phase 4.20 — the phone's chrome gets out of the way.**_

_**2026-08-08 — on a phone, a fifth of the screen was permanently spent on chrome.** The
topbar and the tab bar are ~124px of an 844px viewport, and the topbar is paying most of
that with a **disabled** search field, a date hidden below `lg` and a bell hidden below
`md`. So both slide away on a downward scroll and come back on **any** upward one. Nothing
outside `components/shell/`, no schema change, and the first change in twelve phases aimed
only at the device every one of them has recorded as unchecked._

_**The second half is the load-bearing half.** The tab bar is the only navigation a phone
has — the sidebar is a drawer opened from the topbar, so hiding both hides the way to
everything — and it is safe only because getting them back is a flick in the direction you
were already going to re-read what you just passed. Nothing has to be found._

_**They had to become overlays to be worth hiding.** Collapsing a row in the flow changes
the document's height while your thumb is on it, so the page jumps as you read; an overlay
slides over a page that never moves, and the vacated space is filled by content already
scrolling up into it. That cost the mobile topbar a **fixed 64px height** — an overlay's
height has to be known by whatever pads around it, and the alternative is measuring it into
state, which is the `setState` in an effect §9 already records the React Compiler correctly
refusing. Pinning it is simpler and 12px cheaper than the intrinsic 76px._

_Two smaller rules, each the version that survives the gesture that needs it most. **The
12px travel threshold banks rather than discards** — a reading under it leaves the mark
alone, so a slow drag accumulates toward it instead of resetting under it forever. And
**arriving on a surface always shows the chrome**, adjusted during render rather than in an
effect: without it, tapping a project card from halfway down Today lands you on a page that
may not scroll at all, with no navigation on screen and no gesture that summons it — a dead
end two taps away._

_**Verified at a genuine 390×844 viewport, which is the part worth keeping.** `resize_window`
has reported success while leaving the renderer at 2560px for a week, which is why every
phase since 4.8 says "not seen on a real device" — but **media queries inside an iframe
answer to the iframe's own box**, so a same-origin 390×844 iframe pointed at `/today` is
really below `md` (`matchMedia` says so) with the session cookie still applying. All nine
scroll cases behave: shown through the first 72px, hidden past it, a 6px upward twitch does
nothing, the next 6px brings it back (the banking rule), any real flick reveals immediately,
and the top always shows. Off-screen positions confirmed exactly — header bottom at 0, tab
bar top at 844. **Desktop confirmed untouched rather than assumed**: at 1280px the header is
`static`, `translate: 0px`, 76px tall with the stage at 92px, with the hide class present and
the `md:` override winning. Navigation reset confirmed by hiding the chrome on Today and
clicking through to a project page. `npx next build`, `tsc --noEmit` and `eslint` all pass,
and the four new utilities were grepped out of the emitted CSS with `-F` per §9._

_**Two harness findings, both now in §9.** The iframe technique itself, which is the standing
answer to a gap this file has carried for a week. And: **an occluded Chrome window dispatches
no scroll events at all** — same family as the `animationend` note in 4.17. `requestAnimationFrame`
never fires, transitions never advance (an element keeps its start transform while its
className is already correct), and `scrollTop = y` fires nothing. That was diagnosed by
attaching a probe listener and seeing zero events for a scroll that had demonstrably
happened; the handler was then exercised by dispatching the event by hand. **It also cost the
implementation an rAF wrapper, correctly** — the coalescing was guarding against nothing,
since Chrome already dispatches at most one scroll per frame and React bails out of an
unchanged boolean before rendering._

_Outstanding from this change: **it still has not been seen on a real phone** — a 390px
iframe in desktop Chrome is much closer than reasoning and is not a device, and it has no
touch inertia, no rubber-banding and no address bar of its own. **The hidden chrome is not
`inert`**, so its links stay focusable off-screen; tabbing to one scrolls it into view, which
fires the handler and brings the chrome back, so the failure mode self-corrects._

---

_Previously: **Phase 4.19 — a brand can be the work of a project.**_

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
