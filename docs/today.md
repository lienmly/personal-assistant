# Today

_Written 2026-08-04, replacing `sprints.md`. Update this when Today changes._

Today is the screen you open in the morning. Its whole job is to let you **see what you
have on and choose**, and it is deliberately built so that it can never tell you you're
behind.

---

## Why the sprint went

Until 4 August this screen was built around a **sprint**: a handful of tasks committed to
at the start of the week, with a tile counting how many you'd finished against how many
you'd promised, and a "2 behind pace" note when the sum didn't work out.

That is a good instrument for a week you control. It is the wrong instrument for a week
where a four-month-old decides what happens. The commitment was made on Monday by someone
who didn't know how Thursday was going to go, and the tile then reported the difference
back as a shortfall — so the screen you open twenty times a day became the one keeping
score against you.

It's gone. Not hidden, not made optional: removed from Today, removed from the Hunt Board,
and nothing creates a new one any more. The `Sprint` table is still in the database so the
record of Week 1 survives, but nothing reads it.

**Nothing on Today counts down, and nothing has a target.**

---

## What's there instead

### Your projects

One card per project, in a fixed order — main projects first, then side, then later. The
order does not change from day to day, on purpose: a list that reshuffles overnight has to
be re-read from the top every morning, and one that stays put gets learned once.

Each card carries:

- **The name and area colour**, and a `main` chip if it's a main project.
- **The focus line** — one sentence saying what this project is aiming at *right now*.
  See below.
- **Up to five tasks**, most pressing first: anything you've marked in-flight, then
  overdue, then due today, then due this week, then the rest.
- **`2 overdue`** in crimson if there are any, counted across the *whole* project rather
  than just the five shown.
- **How long since you last touched it** — "Touched today", "Yesterday", "4d ago". This
  turns amber if the project is past its cadence. It replaces the old Momentum card, which
  was a list of every project's last-touched date sitting next to a list of every project.

You can tick a task done straight from the card, or press ▶ to mark it as the thing you're
on right now. Everything else — editing, adding, the full list — is one tap away on the
project.

**A project with nothing open still shows up**, saying so, with a link to put something on
it. That's information: a project that vanished the moment its last task was ticked is one
you'd forget you owned.

Loose tasks with no project collect at the bottom under **One-offs**.

### The focus line

New field, set on the project's settings panel — the pencil beside the project's name on
its card here — under **"What it's aiming at right now"**.

It is separate from the description on purpose. The description says what the project
*is* — "a short cozy game made with my husband" — which you already know and which almost
never changes. The focus says what it's *for* this month — "get the Steam page live so
wishlists can start" — and is meant to be rewritten whenever it stops being true.

Leave it blank and the card falls back to the description, so nothing breaks. Fill it in
and it's the first thing you read on that project every morning.

### Ticked off

A contribution map, like GitHub's: one small square per day for the last six months,
darker the more you got through. Under it, whatever you ticked off **today**.

This is the deliberate inverse of the sprint tile. It has no target, so it cannot report a
shortfall — the only thing it can say is what you did. On a week that went badly the useful
fact isn't "you did fewer than planned", it's that the row is unbroken.

The streak counts consecutive days with at least one thing ticked. **Today not having one
yet doesn't break it** — at 7am it never would.

Recurring tasks count every time you tick them. Reading her a Vietnamese book on thirty
days is thirty things done, not one.

### Social media content going out today

Unchanged. Anything publishing today, with one tick per channel. This is where posting gets
recorded.

### Agenda

Today's calendar events. Empty unless you've put something in the calendar — see
`calendar.md`.

---

## The tiles

| Tile | What it says |
|---|---|
| **Ticked off today** | What you got through. The one dark tile — the hero number is an achievement now, not a deficit. |
| **Projects on the go** | How many projects are active or simmering, and their total open tasks. |
| **Social media content** | Items publishing today, and how many are still to post. |
| **Overdue** | Across every project. The only number on the screen that is a nudge, and it is a fact rather than a judgement. |

---

## Where the other screens fit

- **Hunt Board** — every task, grouped by project and track, with the paste-a-link capture
  box. This is the full list; Today is the readable slice of it. Nothing is held back from
  it any more now that there is no committed subset.
- **A project's page** — Overview, Tasks, Social media, Docs. Where you add and edit tasks
  for one project, and where its docs live. Reached from a card here, or from the sidebar.
- **There is no Projects tab any more** (gone 5 August). It was a second list of the same
  projects. Creating, renaming, re-tiering and archiving all happen on the cards here — the
  pencil beside a project's name — and **"N put away"** at the foot of the card is where
  the paused and archived ones went.

---

## One thing worth knowing

**Nothing creates a task except you.** The seed used to create seventy-eight of them across
five projects, and it matched on title — so any you deleted came back the next time the
seed ran. That's why the board used to fill with work you didn't remember writing. As of
4 August the seed creates areas, projects, brands, channels, series and docs, and stops
there. The tasks it used to make are in `backups/tasks-2026-08-04.json` if any is ever
wanted back.
