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
| **AI assistant (Montblanc)** | **Anthropic Claude API** + **Vercel AI SDK** | Latest Claude models (e.g. `claude-opus-4-8` / `claude-sonnet-5`). AI SDK handles streaming chat + tool-calling so Montblanc can eventually act on my data. |
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
/app            → routes (dashboard, calendar, areas, auth, api)
/components     → shared UI (shadcn components live here)
/lib            → db client, auth config, utils
/lib/montblanc  → AI assistant logic (prompts, tools)
/prisma         → schema.prisma + migrations
/public         → static assets, icons, branding
```
_(Scaffolded so far: `/app`, `/public`, config files. Other folders added as their phase arrives.)_

---

## 5. Feature Roadmap (layer by layer)

Ordered so each phase builds on the last. We ship and use each layer before moving on.

### Phase 0 — Foundation
- [x] Initialize Git repo
- [x] Scaffold Next.js + TypeScript + Tailwind
- [ ] Add shadcn/ui
- [x] Push to GitHub — `https://github.com/lienmly/personal-assistant`
- [x] Deploy to Railway — branded landing shell is live (pipeline proven end-to-end)
- [ ] Provision Postgres on the Railway project
- [ ] Prisma connected, first migration

### Phase 1 — Auth & Shell  ← **next**
- [ ] Google login via Auth.js
- [ ] Allowlist so only my account(s) can enter
- [ ] Authenticated app shell: the five surfaces from §6 (Today, Hunt Board, Calendar,
      Studio, Projects) wired up with empty states
- [ ] Area filter chip row (hardcoded areas is fine at this stage)
- [ ] Responsive layout baseline — icon rail on desktop, bottom tab bar on phone

### Phase 2 — Areas, Projects & Marks
_Reordered ahead of Calendar: Today and Momentum are meaningless without Projects, and
Projects are cheaper to build than a calendar._
- [ ] Area + Project + Mark schema and migration
- [ ] Project CRUD, with `status` and `lastTouchedAt`
- [ ] Mark CRUD; completing a Mark bumps its Project's `lastTouchedAt`
- [ ] Hunt Board: open Marks grouped by Project
- [ ] Projects surface: roster + project cards
- [ ] Today, bands 1 & 4 (Marks due, Momentum)

### Phase 3 — Studio (content distribution)
- [ ] Drop + Channel + DropChannel schema
- [ ] Studio kanban by stage; publishing a Drop bumps `lastTouchedAt`
- [ ] Per-project Drop list on the project card
- [ ] Today, band 2 (Going out today)

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

### Four nouns

| Noun | What it is | Example | Churn |
|---|---|---|---|
| **Area** | Life domain. Coarse. Supplies colour + calendar separation. | Work, Baby, Hobbies, Home & Money | ~5 ever |
| **Project** | The thing being pushed forward. Belongs to one Area. | "Game X", "Japanese", "Rental 4B" | Constant |
| **Mark** | A task. Belongs to a Project, or floats in an Area for one-offs. | "Fix collision bug" | Constant |
| **Drop** | A unit of content going out. Belongs to a Project, targets 1..n Channels. | "Devlog #7 → YT + TikTok" | Constant |

**Drop is deliberately not a Mark.** A Mark is binary — open or done. A Drop moves through
repeating pipeline stages, fans out to several channels from one source asset, and has a
*publish datetime* rather than a *due date*. Merging them yields a task list where most rows
are "post the thing" and the real work is buried. Two entities, one shared daily view.

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

- **User** — id, email, name, role (`owner` | `child` later)
- **Area** — id, name, color, icon, sortOrder, ownerId
  _(Area doubles as the calendar grouping — see §8, resolved.)_
- **Project** — id, name, description, areaId, status (`active` | `simmering` | `paused` |
  `archived`), lastTouchedAt, cadenceDays (nullable, drives drift warnings), ownerId
- **Mark** — id, title, notes, dueDate, status (`open` | `doing` | `done`), projectId
  (nullable), areaId, ownerId
- **Drop** — id, title, notes, projectId, stage (`idea` | `script` | `edit` | `scheduled` |
  `published`), publishAt, ownerId
- **Channel** — id, name, platform (`youtube` | `tiktok` | `instagram` | `x` | …), handle, ownerId
- **DropChannel** — join: dropId, channelId, per-channel status + published URL
- **Event** — id, title, start, end, allDay, recurrence, areaId, projectId (nullable), ownerId
- **ChatMessage / Conversation** — Montblanc history (Phase 5)

---

## 7. Deployment (Railway)

- **Repo:** `https://github.com/lienmly/personal-assistant` (branch `main`).
- **Live:** the Next.js web service is deployed on Railway and serving the landing shell.
- Postgres plugin **not yet added** — next Phase 0 step, needed before Prisma.
- Deploy from GitHub (auto-deploy on push to `main`, or manual — decide later).
- **Environment variables** (keep in Railway, never commit):
  - `DATABASE_URL`
  - `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - `ANTHROPIC_API_KEY`
- `.env.local` for local dev, `.env.example` committed as a template.

---

## 8. Open Decisions (to resolve as we go)

- [x] **Information architecture** — resolved 2026-07-30. Area › Project › Mark, with Drop
      as its own entity, and five fixed nav surfaces. See §6.
- [x] **Areas vs Calendars** — resolved: **unified.** Area *is* the calendar grouping; there
      is no separate Calendar entity. Events carry an `areaId` and inherit its colour.
- [x] **Task flavor** — resolved: themed. Tasks are **Marks**, content units are **Drops**.
      Keep UI labels readable; flavor lives in headings, not in form fields.
- [ ] **Visual design** — still browsing Dribbble. The IA is settled, so a ref now only needs
      to answer look-and-feel: dark mode? card-heavy vs minimal? density?
- [ ] Prisma vs Drizzle (default: Prisma) — decide before Phase 2
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

---

## Environment notes

- **Windows machine.** Project lives on `D:\personal assistant dashboard`.
- **npm cache is redirected to `D:\npm-cache`** (the `C:` system drive has been prone to
  running full). If npm ever errors with `ENOSPC` or Node throws "heap out of memory",
  check free space on `C:` first — a full system drive breaks the Windows pagefile.
- Node v20.15.1 at time of setup (a lint dependency prefers 20.19+, harmless warning).
- **Next.js 16 / React 19.** This is a recent major — APIs and conventions may differ from
  older Next.js knowledge. Version-specific docs are bundled at
  `node_modules/next/dist/docs/`; the scaffold's `AGENTS.md` reminds agents to consult them
  before writing framework code. Read the relevant guide there when unsure.

---

_Last updated: 2026-07-30 · Status: **Phase 0 in progress** — scaffold done, pushed to
GitHub, deployed on Railway. Remaining: Postgres + Prisma, shadcn/ui.
Information architecture decided (§6); Phase 1 (auth + shell) is next up._
