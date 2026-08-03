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
/app/(app)/…       → the five authenticated surfaces + their shared layout
/app/login         → public sign-in page
/app/api/auth/…    → Auth.js route handler
/components/shell  → icon rail, sidebar, topbar, mobile tab bar
/components/ui     → card, empty state, surface header
/components/brand  → the moogle task
/lib               → auth config, nav config, server actions, utils
/components/studio → the content item board, daily queue, batch composer, content item panel, channel manager
/components/board  → the hunt board, task panel, experiment capture
/components/sprint → the sprint bar, the sprint panel (shared by Today and the board)
/components/today  → focus list, "next up", going-out, momentum, agenda
/components/calendar → month grid, week/day time grid, item chips, the event panel
/components/projects → the roster, the project panel
/lib/db.ts         → Prisma client singleton
/lib/studio.ts     → board queries + series slot generation + batch slots
/lib/studio-actions.ts → server actions for content items, channels, series, batch save
/lib/tasks.ts      → hunt board query
/lib/task-actions.ts → server actions for tasks
/lib/sprints.ts    → active sprint, the focus list, "next up"
/lib/sprint-actions.ts → start / close a sprint, move tasks in and out
/lib/projects.ts   → momentum (Today §4) + the roster query
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
- [x] Sleepy Cat's road to Steam seeded — 19 tasks over **Build / Art / Ship / Marketing**
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
- [ ] Sprint history — closed sprints keep their finished tasks, and nothing reads them
      yet. "What did I actually get done in July" is a query away and worth having.

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
- [x] **Utaitai batches twice a week** — a recurring Wed/Sun task pointing at
      `/studio/batch`, and "While you're in it" on Today
- [x] **Sprints roll over by themselves** — `ensureActiveSprint`, and a pre-filled
      planner on an empty sprint. §6, "The sprint rolls itself"
- [x] Pace on the sprint tile, and one-field idea capture on Today
- [ ] Area CRUD — still the only noun without an editor. Five areas ever, so it has
      still never bitten.

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
| **Area** | Life domain. Coarse. Supplies colour + calendar separation. | Work, Baby, Hobbies, Home & Money | ~5 ever |
| **Project** | The thing being pushed forward. Belongs to one Area. | "Utaitai", "Sleepy Cat", "Rental 4B" | Constant |
| **Brand** | A public identity with an audience and a voice. Owns Channels. | Utaitai, Coding Mom, Sleepy Cat | Rare |
| **Task** | A task. Belongs to a Project, or floats in an Area for one-offs. | "Fix collision bug" | Constant |
| **Sprint** | The handful of Tasks that are *this week's* work. Everything else is backlog. | "Week 1 — get the accounts up" | Weekly |
| **Content item** | A unit of content going out. Carries a Brand and (optionally) a Project. | "Devlog #7 → X + Threads" | Constant |
| **Series** | A standing commitment that generates dated Content item slots. | "Daily short, both Utaitai TikToks" | Rare |
| **Event** | Something that *happens at a time*, as opposed to something to do. | "Afternoon nap", "Paediatrician" | Constant |

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

### The sprint — decided 2026-07-31

By the time four projects had tasks on them the Hunt Board held **sixty open rows** and
had stopped being usable: it answered "what *could* I do", which is not a question anyone
can answer at 7am with a baby on one arm. Today was no better — section 1 was "every task
with a due date", and since only Coding Mom's setup chain had due dates, the screen you
open twenty times a day was either empty or one project's admin.

A **Sprint** fixes both ends. It is a named, dated, deliberately small set of Tasks —
"these, this week" — and it changes what each surface is *for*:

- **Today** reads the sprint. Nine rows, ordered so the top one is the answer.
- **The Hunt Board** stays the complete list, and that is now fine, because it is
  somewhere you go on purpose rather than the first thing you see.

Three rules make it work, and each is there because the obvious alternative fails:

1. **One active sprint.** Two would put Today back in the business of merging lists.
2. **Closing a sprint returns its unfinished Tasks to the backlog** — it does *not* roll
   them into the next one. Rolling over is how a sprint quietly becomes a second,
   permanent to-do list: the leftovers accumulate, next week starts full, and the
   commitment stops meaning anything. Finished tasks keep their `sprintId`, which is the
   record of what the week actually produced.
3. **Due dates outrank the sprint.** Today shows anything due or overdue *whether or not*
   it made the sprint, flagged, with one tap to pull it in. A due date is a promise to the
   outside world and doesn't stop being true because planning missed it.

The other half of the fix is **"Next up"**, collapsed at the foot of the focus list. When
the sprint runs dry the answer must be specific rather than "here is the board again":
the next few Tasks from each `main` project, plus the Experiments track — the things you
meant to try and never got to.

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

### The roster is the editor — decided 2026-07-31

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
| **Today** | The one screen opened 20×/day. "What do I do right now." Reads the sprint. |
| **Hunt Board** | Every open Task, grouped by Project. Where the sprint gets *planned*, not executed. |
| **Calendar** | Time. Events + baby + Content item publish dates + Task due dates, layered. |
| **Studio** | Cross-project content pipeline. Kanban by stage, or calendar by publish date. |
| **Projects** | The roster. Health and momentum at a glance. |
| **Montblanc** | A drawer on every surface, so it always knows what you're looking at. |

Future **Ledger** (bank + property audit, §5 Phase 6) slots in as one more surface without
disturbing anything. That's the test the IA is built to pass.

### The Today screen

Four stacked sections, in priority order. ("Section" just means a card on the
screen — they are numbered so the roadmap can refer to them.)

1. **This sprint** — the week's committed Tasks, plus anything due or overdue from
   anywhere. Ordered `doing` → overdue → due today → the rest of the sprint, so the top
   row is literally the answer to "what now". Capped (~8), tickable in place, and each row
   can be flipped to `doing` without opening anything. Followed by **Next up**, collapsed:
   where to go when the sprint runs dry. ✅
2. **Going out today** — Content items publishing today, with channel icons. Visually distinct from
   Tasks. Each channel is its own tick, so posting can be recorded without leaving Today. ✅
3. **Agenda** — today's calendar events, including the baby's routine, in time order with
   the all-day ones first. **Events only**: the tasks are the focus list two cards up and
   the content items have their own card in between, so replaying either here would put the same
   row on one screen three times. Anything already finished recedes rather than vanishing,
   and whatever is happening *right now* is the card's one accent. ✅
4. **Momentum** — per-project "last touched", drifting first then main-first, with drift
   warnings. ✅
5. **While you're in it** — only on days a weekly recurring task has already put you inside
   a project. Two or three of that project's other backlog rows, framed as an offer. On any
   other day the card does not render. ✅

Plus two things that live inside section 1 rather than beside it: the **sprint planner**,
which replaces the list when the sprint is empty, and **idea capture** — one field at the
foot of the card, filing to the Experiments track, because the ideas that get lost are the
ones you have while doing something else.

All five sections are built as of 2026-08-02.

The four stat tiles are Sprint (the one dark hero tile — done/total and days left), On the
list, Content items going out, Needs attention.

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
- **Project** — slug, name, description, areaId, status (`active` | `simmering` | `paused` |
  `archived`), priority (`main` | `side` | `later`), lastTouchedAt, cadenceDays (nullable,
  drives drift warnings) ✅
- **Sprint** — name, goal, startsOn/endsOn (`@db.Date`), status (`planning` | `active` |
  `done`), closedAt; Tasks join via `Task.sprintId` ✅
- **Brand** — slug, name, tagline, color, sortOrder ✅
- **Channel** — brandId, platform, handle, label, url, state (`planned` | `live` | `paused`) ✅
- **Series** — brandId, projectId (nullable), format, cadence, daysOfWeek, timeOfDay,
  startsOn/endsOn, horizonDays, isActive; channels via **SeriesChannel** ✅
- **Content item** — title, notes, body, brandId, projectId (nullable), format (`short_video` |
  `article` | `text_post` | `image`), stage (`idea` | `script` | `produce` | `scheduled` |
  `published`), publishAt, seriesId + slotDate, sourceDropId, refUrl ✅
- **ContentItemChannel** — join: itemId, channelId, state, caption, scheduledFor, publishedAt,
  publishedUrl ✅
- **Task** — id, title, notes, link, track, dueDate, status (`open` | `doing` | `done`),
  sprintId (nullable — null means backlog), projectId (nullable), areaId, recurrence
  (`none` | `daily` | `weekdays` | `weekly` | `monthly`), daysOfWeek, repeatUntil,
  recurringId (set on a completed snapshot, pointing at the live row) ✅
- **ProjectDoc** — projectId, slug (minted once, never follows a rename), title, body
  (Markdown), sortOrder. Cascades with its Project — the only relation that does ✅
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
   sprint history, momentum, the board's recent-done list — keeps working untouched.
   The cost is that every list and count must filter `recurringId: null`, or a daily habit
   appears thirty times. That filter is now in `getHuntBoard`, `getProjectDetail`,
   `getFocus`, `getUpNext`, `getRoster`, `getMomentum` and the calendar's task layer.
2. **It advances from *today*, not from its old due date.** Advancing from the old date is
   how a habit skipped for a fortnight returns as fourteen overdue rows for days that have
   already gone. Missing a day is missing a day.
3. **The sprint counts it done once it has fired inside the window.** `status: "done"`
   reports it outstanding all week however many times you did it; counting snapshots pushes
   `done` past `total`, because two Wednesdays and a Sunday are three completions of one
   commitment.
4. **A recurring task with no due date is a rule that never fires.** It looks scheduled on
   the board and never reaches Today. `saveTask` and the seeder both infer the first
   occurrence rather than demanding one — ticking "every Wednesday" and leaving the date
   blank is the obvious thing to do.

### "While you're in it" — decided 2026-08-02

Utaitai is `side`, so no sprint is ever going to claim "ship the iOS build". But its
content is produced in two sittings a week, and those are the only two days the project
reliably gets opened at all — which is the only moment its backlog is *cheap*, because the
context is already loaded. Section 5 of Today offers two or three of those rows on exactly
those days, and does not exist on any other.

Anchored on a **weekly or monthly** recurring task, never a daily one: a daily habit
doesn't create a special context, and anchoring on one would put the card on screen every
day, which is how it becomes wallpaper. Those projects are what "Next up" is for. And
anchored on the *task*, not the weekday — move the batch to Tuesday and Friday and this
follows, with nothing to keep in step.

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

Real appointments still belong on the calendar. A paediatrician slot has a time, and the
time is the point.

### The sprint rolls itself — decided 2026-08-02

A sprint that has to be closed and re-created by hand stops happening within a fortnight,
and what it leaves behind is worse than no sprint: Today keeps rendering last week's
commitment as though it were this week's, so the one screen meant to answer "what now"
quietly starts answering it wrong.

`ensureActiveSprint()` runs on render from Today, the same way `ensureSeriesSlots` does.
There is no scheduler and there does not need to be one — the rollover only has to have
happened by the time someone looks. Past its end date the sprint closes, its unfinished
tasks return to the **backlog** (rule 2 of "The sprint" above, unchanged and now
automatic), and a fresh Monday–Sunday week is created.

Two things fell out of building it:

- **A weekend rollover runs through the *following* Sunday.** Mon-to-Sun around today gives
  a Saturday rollover a one-day sprint: you plan eight things and all eight go back on
  Monday having never been reachable. Below three days of runway, extend.
- **An empty sprint arrives with the planning already done.** "Go and plan it" is the Hunt
  Board's blank page moved one screen earlier, which is the thing sprints exist to avoid.
  `getSprintSuggestion` proposes eight — overdue, then due this week, then the next rows
  from each `main` project — pre-ticked, so the interaction is un-ticking two and pressing
  a button.

The sprint tile now reads **pace** (done-so-far against days-elapsed) rather than only a
countdown, because "3 days left" leaves that sum to be done in your head every morning,
which is the work the tile exists to save.

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
      §10. **Light mode only** — the palette is built
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
    **The budget is one black element per screen, and both surfaces have now spent it:**
    the sprint bar on the Hunt Board (which is why the experiment-capture box was demoted
    from obsidian to `bg-inset` on 2026-07-31) and the sprint stat tile on Today. The
    selected scope pill is the one exception — a segmented control needs a filled state,
    and it's small enough not to compete.
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

- **Don't put a JSX expression next to text containing an HTML entity.**
  `{open ? "Hide" : "Show"} what&apos;s next` splits into different text nodes on the
  server and the client, and React reports a hydration mismatch. Put the whole thing in one
  expression — `` {`${open ? "Hide" : "Show"} what’s next`} `` — with a real character
  instead of the entity. Cost half an hour on 2026-07-31.

- **User docs live in `/docs`.** Guides written for *me reading later*, not for agents:
  - `docs/studio-guide.md` — how to use the Studio (brands, channels, content items, series,
    the board, repurposing). Written 2026-07-30. Update it when Studio behaviour changes.
  - `docs/sprints.md` — the weekly loop: plan on the Hunt Board, work from Today, what
    happens to leftovers when a sprint closes, and what the project tiers mean.
    Written 2026-07-31. Update it when sprint behaviour changes.
  - `docs/projects.md` — project pages, the four tabs, and where docs live now.
    Written 2026-08-02.
  - `docs/calendar.md` — the three things on the grid and how they differ, getting
    around the views, repeating events and what editing one actually changes, and the
    baby's routine. Written 2026-08-01. Update it when calendar behaviour changes.
  **Project docs are no longer here.** The Coding Mom brief, the Forge vision and the
  multilingual-baby plan live on their projects' **Docs tabs** in the app, and their
  source files sit in `prisma/docs/` as seed material only. See §6, "The docs moved onto
  the project" — and edit them in the app, not in the file.

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

## Environment notes

- **Now on macOS**, at `/Users/hcb3o/startups/personal-assistant` (Node v20.20.2, TZ
  `America/Los_Angeles`). Phase 4 was built and verified here. The Windows notes below are
  kept because that machine still exists, but they are no longer where the work happens.
  - _Windows:_ project lived on `D:\personal assistant dashboard`, npm cache redirected to
    `D:\npm-cache` because the `C:` system drive kept filling. If npm errors with `ENOSPC`
    or Node throws "heap out of memory" there, check free space on `C:` first — a full
    system drive breaks the pagefile. Measured 2026-07-31 at **100% (69 MB free)**.
    **Re-measured 2026-08-03: 100%, `0` bytes free — and it is now blocking.** `next dev`
    dies on startup with "Fatal process out of memory: Zone" before serving a request, so
    the Windows machine currently cannot run the app at all. Short scripts (`tsx`, a
    Prisma query) still work, which is why the 2026-08-03 calendar change could be
    verified against the database but not in a browser. `D:` has 114 GB free; the fix is
    clearing `C:`, not moving anything.
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
