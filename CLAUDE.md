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
| Tasks / to-dos | could be themed as **Marks / Hunts** | Optional flavor — decide later |

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
- [ ] Push to GitHub
- [ ] Provision Railway project + Postgres
- [ ] Prisma connected, first migration
- [ ] Deploy a "hello world" dashboard shell to Railway (prove the pipeline end-to-end)

### Phase 1 — Auth & Shell
- [ ] Google login via Auth.js
- [ ] Allowlist so only my account(s) can enter
- [ ] Authenticated app shell: nav/sidebar, header, empty dashboard home
- [ ] Responsive layout baseline (works on phone)

### Phase 2 — Calendar (core of "organize my life")
- [ ] Calendar data model (events, recurring events)
- [ ] Month / week / day views
- [ ] Create / edit / delete events
- [ ] **Separate calendars / categories** (e.g. Work, Hobbies, Baby)
- [ ] Baby daughter's activity calendar (feeds, naps, milestones, appointments)

### Phase 3 — Life Areas & Tasks
- [ ] Generic "Area" concept so new areas are cheap to add
- [ ] **Main areas:** App/Game Dev, Social Media Branding, (more as they come)
- [ ] **Hobby areas:** Language Learning, Musical Instrument Learning, (more)
- [ ] Tasks / to-dos ("Marks") within areas, with due dates that surface on the calendar
- [ ] Dashboard home widgets: today's agenda, upcoming, per-area snapshots

### Phase 4 — Montblanc (AI assistant)
- [ ] Chat interface with streaming (Claude via AI SDK)
- [ ] Montblanc persona/prompt
- [ ] Tool-calling: let Montblanc read my calendar & tasks
- [ ] Then: let Montblanc create/modify events & tasks on request
- [ ] Proactive help (daily briefing, reminders) — later

### Phase 5+ — Future / "as I think of it"
- [ ] Multi-user: log in as my daughter to see her own activities
- [ ] Richer per-area tooling (e.g. language-learning streaks, practice logs)
- [ ] Notifications (push / email)
- [ ] Habit/streak tracking, notes/journal, file storage
- [ ] _Add more here as ideas arrive_

---

## 6. Data Model (early sketch — will evolve)

Not final; just to anchor Phase 2–3 thinking.

- **User** — id, email, name, role (`owner` | `child` later)
- **Area** — id, name, type (`main` | `hobby`), color, icon, ownerId
- **Event** — id, title, start, end, allDay, recurrence, areaId/calendarId, ownerId
- **Calendar** — id, name, color, ownerId (Work / Hobbies / Baby)
- **Task ("Mark")** — id, title, notes, dueDate, status, areaId, ownerId
- **ChatMessage / Conversation** — for Montblanc history (Phase 4)

---

## 7. Deployment (Railway)

- One Railway project containing: **web service (Next.js)** + **Postgres plugin**.
- Deploy from GitHub (auto-deploy on push to `main`, or manual — decide later).
- **Environment variables** (keep in Railway, never commit):
  - `DATABASE_URL`
  - `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - `ANTHROPIC_API_KEY`
- `.env.local` for local dev, `.env.example` committed as a template.

---

## 8. Open Decisions (to resolve as we go)

- [ ] **Design/layout** — still browsing Dribbble. Pick a direction before Phase 1 UI polish.
      (Dark mode? Sidebar vs top-nav? Card-heavy vs minimal?)
- [ ] Prisma vs Drizzle (default: Prisma)
- [ ] Calendar library (Schedule-X vs FullCalendar) — decide at Phase 2
- [ ] How to model "Areas" vs "Calendars" — overlap; unify or keep separate?
- [ ] Task flavor: plain "Tasks" or themed "Marks/Hunts"?
- [ ] Notifications channel (push vs email) — Phase 5

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

_Last updated: 2026-07-26 · Status: **Phase 0 in progress** (scaffold done)_
