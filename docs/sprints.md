# Sprints — how to actually use this

_Written 2026-07-31, the day the Hunt Board hit sixty open marks and became unreadable._

## The problem this solves

You have four projects. Between them they hold about sixty open marks. Every one of those
is a real thing you genuinely want to do, which is exactly why a list of all sixty is
useless: it can't tell you what to do at 7am, and reading it just costs you the feeling
that you're behind.

So the app now has two different lists, and they have two different jobs:

| | Where | What it's for |
|---|---|---|
| **The sprint** | Today | The handful you committed to *this week*. Short enough to read. |
| **The backlog** | Hunt Board | Everything else. Complete, and safe to ignore until Sunday. |

The rule: **Today never shows you the backlog.** If you're looking at Today, everything on
the screen is something you decided, in advance, was this week's work.

## The weekly loop

### 1. Plan (once a week, ~10 minutes)

Go to the **Hunt Board**. Hit **New sprint** on the black bar at the top.

- **Name** — it fills in "Week 4" and that's fine.
- **What this week is for** — one sentence. If it needs two, it's two sprints. This shows
  up on Today under the heading, and it's the thing that makes the week feel like it had a
  point.
- **Dates** — defaults to today plus six. Shorten it when the week is going to be short.
  A sprint you can adjust is one you'll keep; a sprint you can only abandon is one you'll
  abandon.

Then fill it. The board is now scoped to **Main projects** by default (Sleepy Cat and
Coding Mom), with the side projects one pill away under **Everything**. Hover — or just
tap, on a phone — any mark and press **+** to pull it into the sprint. It jumps up into
the "In the sprint" card so you can see the commitment growing.

**Eight is a good number.** Not because eight is magic, but because a sprint you finish
teaches you what a week actually holds, and a sprint you never finish teaches you to stop
reading it.

### 2. Work (every day)

Open **Today**. The top card is the sprint, ordered so the first row is the answer:

1. Anything you've flagged **in flight** (the ▶ button)
2. Anything **overdue**
3. Anything **due today**
4. The rest of the sprint

Tick the circle to finish something. Press ▶ to say "this is what I'm on right now" — it
pins the mark to the top of the list, which is useful when you get interrupted, which with
a baby is always.

Due-dated marks appear here **even if they're not in the sprint**, badged, with a ⊕ to pull
them in. A due date is a promise to the outside world — the TikTok account has to exist
before the warm-up week starts — and it doesn't stop being true because you forgot it on
Sunday.

### 3. Run out (the good problem)

At the bottom of the sprint card: **"Show what's next on the main projects."** Two things
live there:

- The next few marks from each main project — the pending work you'd pick up anyway.
- **Wanted to try** — everything on the Experiments track, i.e. the formats you pasted a
  link for and never got around to.

Each has a **+** to pull it into the current sprint. So "I've finished, now what" has a
specific answer that isn't "go and look at sixty rows".

### 4. Close

Hit **Close** on the sprint bar (or just start the next sprint, which closes the old one).

**Whatever you didn't finish goes back to the backlog.** It does not follow you into next
week. This is deliberate and it is the most important rule here: sprints that roll their
leftovers forward fill up, and a sprint that starts full isn't a commitment, it's just a
to-do list with a date on it. Finished marks stay attached to the sprint — that's the
record of what the week produced.

## The tiers

Every project now carries a **priority** as well as a status. They answer different
questions:

- **status** — is this moving? (`active`, `simmering`, `paused`, `archived`)
- **priority** — should it be? (`main`, `side`, `later`)

Right now:

| Project | | |
|---|---|---|
| **Sleepy Cat** | main · active | Has a launch to reach. Nags after 3 quiet days. |
| **Coding Mom** | main · active | Daily posting; it's Forge's audience, built early. |
| **Forge** | side · active | Design and research on the side. Nags after 14 days. |
| **Utaitai** | side · active | Maintenance. Content still ships; nothing new goes in. |

`main` is what the Hunt Board opens expanded, what the "Main projects" pill filters to, and
where "Next up" draws from. Utaitai is `active` rather than `simmering` on purpose — its
dailies genuinely still ship, and calling it simmering would be saying the content stopped.

**When Sleepy Cat launches, Forge becomes `main`.** Open **Projects**, tap the Forge card,
tap **Main**, save. Two taps from a phone — this used to be an edit to `prisma/seed.ts`
followed by `npm run db:seed`, which is why it never happened at the right moment.

The same panel is where you create a project, rename one, move it to another Area (its
marks come with it), change its cadence, or archive it. Two things it deliberately won't
do: renaming a project doesn't change its slug, and deleting is refused for any project
still holding marks, drops or a series — it tells you what's holding it and points you at
**Archive**, because deleting wouldn't remove that work, it would set it loose with no
project to belong to.

## Small things worth knowing

- Nothing you write down lands in the sprint automatically. New marks go to the backlog,
  which is the point — if everything you think of joins this week's commitment, it isn't a
  commitment.
- The **Momentum** card on Today is separate from all of this. It watches how long each
  project has gone untouched, and "Let it simmer" is the honest way to silence a project
  you aren't really on. Marks completing and drops publishing both count as a touch.
- The sprint bar goes crimson when you're past the end date. That's not a telling-off, it's
  a prompt to close it out — the leftovers going back to the backlog is a relief, not a
  loss.
