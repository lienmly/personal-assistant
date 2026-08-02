# Sprints — how to actually use this

_Written 2026-07-31, the day the Hunt Board hit sixty open tasks and became unreadable._

## The problem this solves

You have four projects. Between them they hold about sixty open tasks. Every one of those
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

### 1. Plan (once a week, ~2 minutes)

**You no longer have to remember to do this.** As of 2 August 2026 the sprint rolls over
by itself: the first time you open Today after the week's end date, the old sprint closes,
its unfinished tasks go back to the backlog, and a fresh **Week N** is waiting.

So planning now usually looks like this: open Today, see *"Week 5 is empty"* at the top of
the focus card with eight tasks already suggested and ticked, un-tick the two you don't
want, press **Commit**. Done.

The suggestion isn't random. In order: anything **overdue**, then anything **due inside
this week**, then the next few rows from each **main** project. An empty sprint with a "go
and plan it" link would just be the Hunt Board's blank page moved one screen earlier,
which is the thing sprints exist to avoid.

The banner also tells you what happened to last week — *"Week 4 closed with 5 done. 3
unfinished went back to the backlog — this week starts clean on purpose."*

> **One quirk worth knowing.** If the rollover happens on a Saturday or Sunday, the new
> sprint runs through the *following* Sunday rather than ending in a day or two. A sprint
> with one day in it is one where you plan eight things and all eight go back to the
> backlog on Monday morning having never been reachable.

#### Planning it by hand instead

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
tap, on a phone — any task and press **+** to pull it into the sprint. It jumps up into
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
pins the task to the top of the list, which is useful when you get interrupted, which with
a baby is always.

Due-dated tasks appear here **even if they're not in the sprint**, badged, with a ⊕ to pull
them in. A due date is a promise to the outside world — the TikTok account has to exist
before the warm-up week starts — and it doesn't stop being true because you forgot it on
Sunday.

### 3. Run out (the good problem)

At the bottom of the sprint card: **"Show what's next on the main projects."** Two things
live there:

- The next few tasks from each main project — the pending work you'd pick up anyway.
- **Wanted to try** — everything on the Experiments track, i.e. the formats you pasted a
  link for and never got around to.

Each has a **+** to pull it into the current sprint. So "I've finished, now what" has a
specific answer that isn't "go and look at sixty rows".

### 4. Close

Hit **Close** on the sprint bar (or just start the next sprint, which closes the old one).

**Whatever you didn't finish goes back to the backlog.** It does not follow you into next
week. This is deliberate and it is the most important rule here: sprints that roll their
leftovers forward fill up, and a sprint that starts full isn't a commitment, it's just a
to-do list with a date on it. Finished tasks stay attached to the sprint — that's the
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
tasks come with it), change its cadence, or archive it. Two things it deliberately won't
do: renaming a project doesn't change its slug, and deleting is refused for any project
still holding tasks, content items or a series — it tells you what's holding it and points you at
**Archive**, because deleting wouldn't remove that work, it would set it loose with no
project to belong to.

## Small things worth knowing

- Nothing you write down lands in the sprint automatically. New tasks go to the backlog,
  which is the point — if everything you think of joins this week's commitment, it isn't a
  commitment.
- The **Momentum** card on Today is separate from all of this. It watches how long each
  project has gone untouched, and "Let it simmer" is the honest way to silence a project
  you aren't really on. Tasks completing and content items publishing both count as a touch.
- The sprint bar goes crimson when you're past the end date. That's not a telling-off, it's
  a prompt to close it out — the leftovers going back to the backlog is a relief, not a
  loss.

---

## Tasks that come back

_Added 2 August 2026._

Some things aren't finished, they recur: reading to her in Vietnamese, batching the
Utaitai week. Those are **recurring tasks** — set **Repeats** in the task panel to Daily,
Weekdays, Weekly (pick the days) or Monthly.

**Ticking one does not finish it.** It records that you did it today and moves the task to
its next day. The row shows a ⟳ badge with the schedule ("Daily", "Wed & Sun") so this
isn't a surprise.

Three things follow from that, and they're all deliberate:

- **A missed day does not come back.** The task advances to the next occurrence after
  *today*, never from the date it was supposed to be done. Skip a fortnight of reading and
  you get tomorrow, not fourteen overdue rows for days that have already gone.
- **It counts for the sprint once.** A recurring task in the sprint reads as done as soon
  as it has fired that week — not once per tick, which would push done past total, and not
  never, which is what "is its status done" would have said.
- **The history is real.** Every tick writes a completed row underneath, so what you
  actually did is recorded even though the board only ever shows you one live task.

## "While you're in it"

On the days a weekly recurring task lands — Wednesday and Sunday, for Utaitai's batching —
Today grows one extra card offering two or three **other** tasks from that same project.

That's the whole answer to "Utaitai's maintenance work never gets done". It's a `side`
project, so no sprint is ever going to claim shipping the iOS build. But twice a week you
are already inside it with the context loaded, and that is the only moment those rows are
cheap. Any other day the card doesn't exist.

It's anchored on the *task*, not the weekday. Move the batch to Tuesday and Friday and
this follows.

## Somewhere to put an idea

At the foot of the focus card on Today there's a single field: **Note an idea…**. Type,
press return, keep going — it stays focused, because ideas arrive in threes.

It lands in the backlog on the **Experiments** track, which is where *"What’s next"*
already reads ideas from. So a thought you had on Tuesday surfaces itself the next time
the sprint runs dry, instead of needing to be remembered.

No project picker, on purpose. Filing is a decision, and a decision is what stops this
being instant.
