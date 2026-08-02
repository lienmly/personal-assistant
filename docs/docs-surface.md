# Two kinds of document, one place to read them

_Written 2026-08-01, the day project docs stopped being files you could only read in an
editor._

## The problem this solves

Every project has thinking behind it that a task list can't hold — why Forge exists, what
Sleepy Cat's launch is actually aiming at, which of Coding Mom's seven pillars sets up
which. That thinking was real, and it lived in markdown files in the repo. Which meant it
was readable from a laptop with the project checked out, and nowhere else.

A project's `description` is one line on a roster card. It is not a vision statement.

So there's a **Docs** surface now, and it holds two different kinds of thing that happen to
be read the same way.

## The two kinds

|  | Where it's stored | Who edits it |
|---|---|---|
| **Project and area docs** | The database | You, from anything with a browser |
| **These manuals** | Files in the repo | Whoever changes the code |

The split is deliberate. A vision doc gets rewritten at 3am when the thought arrives, so it
has to be editable from a phone — that's the same argument that made the roster the project
editor. A manual describes how the app *behaves*, so it should change in the same commit as
the behaviour; put it in the database and it can quietly drift from the code with nothing to
catch it.

Practical consequence: **the manuals are read-only here.** There's no Edit button on one,
and that isn't an oversight.

## Getting around

The left column is grouped the way the sidebar is — area, then the projects inside it. Every
row has a **+** to start a doc filed right there, including the empty ones.

Every area has an **Area notes** row, even areas with no projects. That's where a doc goes
when it isn't about a project — the baby's routine notes, a house thing, anything under
Home & Money.

What's open lives in the URL, so a link to a specific doc is just a link. Worth knowing when
you want to point yourself at something from a note somewhere else.

## Writing one

**Kind** is free text with suggestions — Vision, Northstar, Strategy, Research, Brief,
Notes. Type whatever you want; "Postmortem" and "Brand voice" are obviously docs and
inventing one shouldn't be a whole thing. It's also what the list sorts by, so a project's
Vision sits above its Notes.

**Project or area.** Pick a project and the doc takes that project's area automatically, and
follows it if the project ever moves. Leave the project blank and you pick the area yourself
— that's an area doc.

**Body is markdown**, same as you'd write in a file. Headings, lists, tables, quotes, links,
`code` — all of it renders. The **Preview** toggle shows you what it'll look like without
leaving the editor or losing your place.

## Two things it deliberately doesn't do

**Saving a doc doesn't count as touching the project.** Momentum (the drift warnings on
Today) is driven by finished work — a mark completing, a drop publishing. If a doc save
counted, fixing a typo would silence a drift warning for a whole cadence. If real thinking
happened, the honest way to record it is a mark.

**Deleting takes two taps.** The body is the only copy. There's no version history and no
trash, so the second tap is the whole guard.

## A project you can't delete

If a project holds docs, deleting it is refused — same as marks, drops and series. The docs
would survive (they'd fall back to being area docs), but a project with a written vision
isn't the one you named wrong two minutes ago. Archive it instead.
