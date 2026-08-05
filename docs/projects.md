# Project pages

_Written 2 August 2026, the day docs stopped living in a folder._

## Every project has a page now

`/projects` is still the roster — the "which of these matters" screen. Clicking a card no
longer opens the settings form; it opens **the project**, at `/projects/<slug>`. Sidebar
project names go there too.

The settings form is still there: it's the little pencil on the top-right of a card. On a
phone it's always visible; on a laptop it appears when you hover. That split is the point —
before this, the first thing you ever saw of a project was a form asking you what tier it
was, which is not what you opened it to find out.

## The four tabs

**Overview** — Next up (the first five open tasks), your first doc rendered in full,
what content is queued, and any standing series or calendar blocks. Four stat tiles across
the top: open work, content, docs, days since it was last touched.

**Tasks** — every task on the project, grouped by track, tickable in place. Not the Hunt
Board with a filter on it: the board carries scope pills and a capture box,
and none of those mean anything once you've already decided which project you're in.

**Content** — everything carrying this project, whichever brand publishes it. That's the
two-axis model paying off: a Sleepy Cat devlog posted from Coding Mom's TikTok shows up
here *and* under Coding Mom's brand filter in the Content Studio.

**Docs** — see below.

## Docs

This is the part that moved. There used to be a `/docs` folder in the repo with
`coding-mom.md` and `forge-vision.md` in it. Two problems: it was one folder away from the
work it described, and editing it meant a git commit — so the notes actually worth keeping,
the ones you think of at 3am on a phone, never got written down anywhere.

Docs are rows in the database now. Write them from the Docs tab on any project: a list on
the left, the doc on the right, **Edit** puts you straight into a textarea. It's Markdown —
headings, lists, **bold**, `code`, links. Nothing exotic; it's a deliberately small
renderer rather than a library.

Three that came across automatically:

| Project | Doc |
|---|---|
| Coding Mom | The brand and the project — the account chain, the seven pillars |
| Forge | The startup brief |
| Multilingual baby | Three languages, one unsolved |

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
