# Coding Mom — the brand *and* the project

> Coding Mom is two things in this dashboard, and that isn't a mistake.
>
> - The **Brand** is who is talking — a persona that can post about any project, or about
>   nothing in particular. That's been true since Studio was built.
> - The **Project**, added 2026-07-31, is the audience-building *work*: accounts to create,
>   a warm-up week to sit through, a content bank to keep stocked, a community to reply to.
>
> The brand is a voice; the project is a backlog. Both needed to exist, because "create the
> Coding Mom TikTok account" was previously filed under **Sleepy Cat** — which is where it
> lived until this project was created.

Why it matters: **Coding Mom is the community-building for [Forge](./forge-vision.md).**
Phase 1 of Forge's go-to-market is "document the journey publicly", so this isn't a side
hustle next to the startup — it's the startup's first phase, running early.

---

## The setup chain — do it in this order

The Setup track on the Hunt Board is a strict sequence, and it's the only place in the
whole board with real due dates on it.

1. **The dedicated e-mail account.** First, because TikTok, Instagram, Facebook, YouTube,
   Threads and Medium all hang off it. Doing this second means migrating accounts instead
   of creating them.
2. **The TikTok account**, made with that e-mail.
3. **A week of warm-up, no posting.** 15 minutes a day of scrolling, watching to the end,
   liking, following and commenting in the mom / build / AIoT niche. A brand-new account
   that posts on day one gets throttled — and the week doubles as the best possible
   research for the bank below.
4. **Claim the handles everywhere else** while you wait. Free today, impossible later.
5. **Batch-film the first week** *during* the warm-up. Day one of posting must not also be
   day one of filming.
6. **Flip the channels to `live` and switch on the Daily short series.** The series ships
   seeded `isActive: false` on purpose: slots you can't fill are worse than no slots.

Dates assume a 2026-08-01 start and first post on **2026-08-09**. They're a spine, not a
promise — move them.

---

## The seven pillars

One post a day is only sustainable if "what do I post today" has already been answered.
Seven pillars, a fixed rotation, and a bank of ideas sitting under each one.

| Pillar | What it is | Why it earns a slot |
|---|---|---|
| **Baby** | Educational — what I'm learning taking care of her | The biggest, warmest audience, and it's the daily reality anyway |
| **Build** | Educational — the things I build and how | Establishes that "coding" in Coding Mom is real |
| **Roster** | The on-brand apps: built, building, and want to build | Turns an idea list into a series; comments hand back new ideas |
| **B-roll** | The 3am reasons — relatable, aspirational, quiet | The pillar that travels furthest; costs the least to make |
| **Home truths** | Life as a mom and a wife, including the hard parts | Highest-signal, highest-risk. Long-form first where it needs room |
| **Multilingual** | The plan to raise her multilingual | Deeply on-brand, and it bridges straight into hardware |
| **Hardware** | Building physical things — book reader, SIDS monitor | The on-ramp to Forge. Everything here carries `projectId: forge` |

**The pillars have an order to them, not just a rotation.** Multilingual is what sets up
Hardware ("what I'd have to buy to make her foreign-language books readable at home — it
doesn't exist"), and Hardware is what sets up Forge. Run that sequence deliberately rather
than shuffling.

### Where the bank lives

The ideas are **Drops in the `idea` stage**, on the Studio board, filtered to the Coding
Mom brand. Not marks — a post isn't binary work, it moves through produce → scheduled →
published and fans out to four accounts at the end (CLAUDE.md §6).

They carry **no publish date and no series**, so they sit in the idea column as a bank
rather than pretending to be scheduled. When a day's slot comes up in the daily queue, you
pull one across. The pillar is written into the drop's notes as `Pillar: X` — seven strings
didn't earn a database column.

Two of them are essays rather than shorts, because they need the room: the one about my dad
and my mom, and the "hardware is where software was before AI" thesis. Those go to Medium
first, and the short version is cut *from* the essay afterwards as a derived drop — not the
other way round.

### One idea is flagged

**"BLM recipe app"** is in the bank captured verbatim, with a warning on it and a matching
mark on the board: expand what BLM stands for before it becomes a post. Better a flagged
row than a guess baked into a script.

---

## What the daily post fans out to

One short, four places — TikTok, Instagram Reels, Facebook Reels, YouTube Shorts. That's a
single Drop with four DropChannel rows (repurposing kind 1, §6), so it stays near-free.
Medium is separate: the Weekly essay series, Sundays at 09:00.

Both Coding Mom series now carry `projectId: coding-mom`, so **posting bumps the project's
`lastTouchedAt`** and it stops showing as drifting on a day you actually posted.
