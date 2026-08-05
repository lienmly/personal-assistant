# Areas, and the journal

_Written 5 August 2026._

An area used to be a colour and a heading. It is now something you can **open** —
click its name in the sidebar and you get a page with three tabs: **Journal ·
Docs · Tasks**.

It works exactly like a project page, and that is on purpose. The only real
difference is which tab it opens on: a project page opens on Overview, because
the question there is "where does this stand"; an area opens on the Journal,
because the reason to open one is almost always to write something down.

There is **no new icon in the rail**. Areas are not a destination in the nav —
that rule hasn't changed, and it's the one that keeps the rail from growing a row
per life area. You get here from the tree, the same way you get to a project.

---

## The Journal

**A journal entry is something that happened.** That is a genuinely new kind of
row in this app, and it is worth being precise about why it needed to exist.

Everything else here points forwards. A task is owed. An event is scheduled. A
content item is going out. None of those is "she rolled over on the 3rd" — and
when the only nouns available point forwards, recording the past means filing it
as something you owe, which is how the Baby area turned into a chore list.

So an entry:

- **cannot be overdue**, because it has no due date
- **cannot be ticked**, because it has no status
- **is never counted against anything** — no target, no streak, no pace

There is nothing here to fall behind on. That is the feature.

### Writing one

The composer sits open at the top of the tab, not behind a button. Every other
write in this app goes through a panel, which is right for a form you fill in
deliberately — but here the thing you're recording happened thirty seconds ago
and you are probably holding her, so one tap before the cursor exists is the
entry not getting written.

Three fields, all optional except that you need **either** some text **or** a
photo:

| Field | Notes |
|---|---|
| Date | Defaults to today. Change it when you're writing up Tuesday on Thursday — the entry files under the day it's **about**, not the day you typed it. |
| Headline | Only when it deserves one. "First time she laughed" does; most days it doesn't. |
| What happened | Markdown, same as docs — headings, lists, **bold**, links. |

Entries are listed newest first, and today's is badged **Today**.

### Photos

**Add photos** takes as many as you like, from the camera roll or the camera.

They are **shrunk in your browser before they are sent** — a 4MB phone photo
becomes about 75KB at 1600px on the long edge, which is still larger than any
screen you'll read this on. You don't have to do anything; it just happens, and
it is what makes the whole thing affordable.

They are stored **in the database**, which means they are covered by whatever
backs up the database, and there is no second service to keep alive. The
trade-off is honest: the database grows, roughly 300MB per thousand photos. If
that ever gets expensive, moving them to cheap object storage is a change to one
file (`lib/photo-store.ts`) — it was built that way deliberately.

Photos are behind your login, like everything else. `/api/journal/photo/<id>`
returns nothing at all to someone who isn't signed in.

### Editing and deleting

The pencil on an entry reopens it in the composer; the bin deletes it, and asks
twice. **Deleting an entry deletes its photos**, because they are part of it
rather than attachments that outlive it. Removing a single photo — the × on its
thumbnail while editing — takes effect immediately, not on save.

### Sending them to her one day

Not built. The data is shaped for it — every entry has a date and a body, and
the photos are addressable — so when you want it, it is a job that reads rows
rather than a schema change. Say the word.

---

## Docs

Identical to a project's Docs tab, and the same editor. This is where the writing
that isn't a task goes: what you want, decided once, so it stops being
re-decided.

The Baby area starts with one — **Languages** — which is the Vietnamese/English
plan, the three Russian leads, and Chinese as the open question it currently is.

---

## Tasks

Tasks filed straight to the **area** rather than to one of its projects. On the
Hunt Board and on Today these show up under **One-offs**; here they get their own
list, grouped by track like everywhere else.

Most areas won't have many. Baby has one — "Figure out a way to teach her Russian
and Chinese" — and that is the right number: it's on the list because it
genuinely won't happen by itself, which is the test for whether something belongs
in a task list at all.

---

## Why the Baby area has no projects

Because a project reports on something that would not otherwise happen, and
caring for a four-month-old is not in that category — it is the main thing
happening every day whether or not anything is written down.

A "Multilingual baby" project was tried and removed on 4 August 2026. A two-day
cadence on the most-attended-to thing in the house is a drift warning that can
never honestly fire, and "read her a Vietnamese book" as a tickable row is an
audit on the one thing least at risk of being skipped.

What replaced it is this page: **Docs** for what you want, the **Journal** for
what she actually did, and the odd real **task** for the parts that genuinely
need figuring out.
