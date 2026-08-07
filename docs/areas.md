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

The composer is the **last thing on today's thread** — the place the next thought
goes. On a day you haven't written in yet it is already open, cursor ready, no
button in the way: the thing you're recording happened thirty seconds ago and you
are probably holding her, so one tap before the cursor exists is the entry not
getting written. Once the day has something in it, it tucks behind a **"+ Add to
today"** so the day stays readable, and tapping that opens it in the same spot.

Two fields, both optional except that you need **either** some text **or** a
photo:

| Field | Notes |
|---|---|
| Headline | Only when it deserves one. "First time she laughed" does; most days it doesn't. |
| What happened | Markdown, same as docs — headings, lists, **bold**, links. |

**There is no date field, and that is deliberate.** An entry lands on today, at
the time you wrote it, taken from the clock rather than from anything you typed.

### You can only write into today

A day that has passed is closed. There is no way to add a new entry to Tuesday on
Thursday, and no way to move an entry you already wrote to a different day or
time.

This is the whole point of the thing. A journal whose dates are editable is a
journal you have to *trust*; one whose dates come from the clock is one you can
simply read. Years from now the useful fact about an entry is not that it claims
to be about the 3rd — it is that it was genuinely written at 21:04 on the 3rd,
five minutes after it happened, which is why it says what it says.

**Editing still works**, and it is a different thing. The pencil reopens an entry
so you can fix a word, finish a sentence, or add a photo you meant to attach. That
is correcting a record. Back-dating one is writing a record, later, and pretending
otherwise.

### A day at a time

**One card per day, and inside it the day is a thread.** Days run newest-first;
the entries *within* a day run in the order you wrote them, top to bottom, each
carrying its **time** — 09:14, 14:40, 21:02. So a day reads the way it happened,
a morning then an afternoon then whatever woke you at 3am, and you add to it by
tapping the **+** at the bottom of the thread.

The two directions are on purpose. A list of days is a list, so the newest is at
the top like everything else in this app. A day isn't a list — it's one train of
thought, and a train of thought read bottom-up isn't one.

Today's heading is badged **Today**, and it is the only day with a **+**. Past
days have no way in, which is the rule above made visible.

(Entries written before 6 August 2026, when the date *was* a field, can have a day
and a writing-time that disagree. Those read *written 6 Aug* instead of a clock
time, rather than claiming something happened at a moment it didn't.)

### Photos and clips

Two ways in:

- **Add photos** picks from your library — anything you shot with the phone's own
  camera app, which is also the only way a picture ends up in your camera roll
  without a second step.
- **Camera** opens a camera inside the journal: a live preview, a filter, a
  shutter, and a **10s clip** button.

**Filters** are colour grades — Warm, Faded, Mono, Dreamy — chosen *before* you
shoot and baked into what gets saved, so what you saw is what you keep. They are
not face filters; there are no dog ears, and adding them would mean shipping a
face-tracking model into the page.

**Clips stop at ten seconds**, by design rather than by accident. A clip is stored
in the database like everything else here, and ten seconds costs about 2MB against
75KB for a photo. It is long enough for her to do the thing.

**Ten photos or clips per entry.** Same reasoning: ten photos is small, ten clips
is 20MB, so the limit counts items rather than trying to be clever about which
kind. It caps a *moment*, not a day — a day holds as many entries as you like and
they all read as one thread, so if you have more than ten, the next entry is the
right home for them anyway. The composer shows where you are ("7 of 10") and the
buttons switch off when you get there.

Photos are **shrunk in your browser before they are sent** — a 4MB phone photo
becomes about 75KB at 1600px on the long edge, which is still larger than any
screen you'll read this on. You don't have to do anything; it just happens, and it
is what makes the whole thing affordable.

Everything is stored **in the database**, which means it is covered by whatever
backs up the database, and there is no second service to keep alive. The trade-off
is honest: the database grows, roughly 300MB per thousand photos, and a good deal
faster if you shoot a lot of clips. If that ever gets expensive, moving it all to
cheap object storage is a change to one file (`lib/media-store.ts`) — it was built
that way deliberately.

It is all behind your login, like everything else. `/api/journal/media/<id>`
returns nothing at all to someone who isn't signed in.

### Looking at them

Photos and clips sit under an entry as a tidy grid of squares — **tap one and it
opens full screen**, uncropped, with arrows (or the ← → keys) to step through the
rest and Esc to close. The squares are a contact sheet; the real photo is one tap
away, which is what makes cropping them to a neat grid fair. A lone photo isn't
cropped at all — one photo isn't a grid, it's *the* photo. A clip shows its first
frame with a play button, and plays in the viewer.

### Getting a copy into your camera roll

Open a photo or clip full screen and there's a **download button** in the corner.
On a phone it opens the share sheet, where **Save Image** / **Save Video** puts a
copy in Photos. On a desktop it downloads.

**It cannot be automatic, and that is a limit of the web rather than a decision.**
No web page can write to a phone's photo library — a picture taken with the
in-journal camera goes to the page and nowhere else. If you want something in
your camera roll without the extra tap, shoot it with the phone's own camera app
and use **Add photos**.

### Editing and deleting

The pencil on an entry reopens it; the bin deletes it, and asks twice. **Deleting
an entry deletes its photos and clips**, because they are part of it rather than
attachments that outlive it. Removing a single photo — the × on its thumbnail
while editing — takes effect immediately, not on save.

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
