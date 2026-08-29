# Project pages

_Written 2 August 2026, the day docs stopped living in a folder.
Updated 5 August 2026, when the roster went, and 9 August 2026, when a project got a
journal._

## Every project has a page now

Every project lives at `/projects/<slug>`. You get there from **its card on Today**, or
from its name in the sidebar tree — which highlights so you can see where you are.

**There is no longer a Projects tab.** It was the roster: a list of every project with its
description, open count and last-touched date. Once Today was rebuilt project-first on
4 August, that was the same list of the same projects one tap away, and the cards on Today
were the better copy — they carry the focus line and the actual tasks. So the roster's own
three jobs moved onto those cards rather than going with it:

- **The pencil** beside a project's name on Today opens the settings form — rename,
  re-area, re-tier, set the focus line and cadence, archive, delete. On a phone it's always
  visible; on a laptop it appears when you hover.
- **New project** sits at the foot of the projects card, under the idea box.
- **"N put away"**, next to it, opens the paused and archived ones. They're kept off the
  card proper because a paused project is parked, not owed — but this is the only way back
  to one, so un-archiving means opening it from there and changing its status.

## The five tabs

**Overview** — Next up (the first five open tasks), your first doc rendered in full,
what content is queued, and any standing series or calendar blocks. Four stat tiles across
the top: open work, content, docs, days since it was last touched.

**Tasks** — every task on the project, grouped by track, tickable in place. **Since the
Hunt Board was hidden on 28 August this is where you go for a project's full list**, and
Today's cards are where you go for the few rows that matter now.

**Social media** — everything carrying this project, whichever brand publishes it. That's
the two-axis model paying off: a Sleepy Cat devlog posted from Coding Mom's TikTok shows
up here *and* under Coding Mom's brand filter in Social Media.

Since 28 August it is **the same stage board Social Media shows** — Idea → Script →
Produce → Scheduled → Published — and a card **opens the same panel**, so you can write the
script, move the stage or add a destination without going to the other screen and hunting
for the row. "New item" here starts one already filed under this project.

Two chips above it split the same rows the two ways worth splitting them: **Posted as
&lt;brand&gt;** is what this project's own accounts publish, and **Covered elsewhere** is
what other people's accounts say about it. Forge is all of the second and none of the
first; Coding Mom is almost all of the first.

**Journal** — the devlog, added 9 August. Same thing the Baby area has: entries land on
today, grouped into one thread per day, with photos and the in-app camera. It points
*backwards* — what changed, what finally worked, what broke — which is what makes it a
different tab from the four around it, all of which are things still owed. You can only
write into today, and you can edit what you wrote but never move its date. Full notes are
in `areas.md`.

**Docs** — see below. Different from the Journal on purpose: a doc is a page you keep
rewriting, a journal entry is a dated record you add to and leave alone.

## Docs

This is the part that moved. There used to be a `/docs` folder in the repo with
`coding-mom.md` and `forge-vision.md` in it. Two problems: it was one folder away from the
work it described, and editing it meant a git commit — so the notes actually worth keeping,
the ones you think of at 3am on a phone, never got written down anywhere.

Docs are rows in the database now. Write them from the Docs tab on any project: a list on
the left, the doc on the right, **Edit** puts you straight into a textarea. It's Markdown —
headings, lists, **bold**, `code`, links. Nothing exotic; it's a deliberately small
renderer rather than a library.

Two that came across automatically:

| Project | Doc |
|---|---|
| Coding Mom | The brand and the project — the account chain, the seven pillars |
| Forge | The startup brief |

**Docs aren't only for projects any more.** Since 5 August 2026 one can hang off an
**area** instead — same tab, same editor — which is where the Baby area's *Languages* page
lives. See `areas.md`. A doc belongs to a project or an area, never both.

There was a third project doc — "Three languages, one unsolved", on the Multilingual baby
project. That project was removed on 4 August 2026 and a doc cascades with its owner, so it
went too; the writing came back the next day as the Baby area's *Languages* doc.

The markdown files still exist at `prisma/docs/`, but only as **seed material** — how an
empty database gets its first copy. Once a doc is in the app, the app's copy is the real
one and re-seeding will not touch it. Edit it in the app, not in the file.

`/docs` (this folder) keeps the guides that are about the **app** — Today, the calendar,
the Content Studio, and this. Those describe how the thing works, not what you're working
on, so they stay in the repo.

## Deleting

A project holding tasks, content, a series or docs won't delete. The panel tells you what's
holding it and points you at **Archive** instead.

Docs are the one relation that *cascades* — everything else would be orphaned by a delete,
but a doc without its project isn't an orphan, it's a page about nothing. Which means
deleting would erase your writing rather than leave it lying around, so docs count toward
the block too.
