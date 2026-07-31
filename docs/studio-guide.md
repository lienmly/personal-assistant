# How to use the Studio

> The pipeline for everything you post publicly. This is the "what do I click, and why"
> guide — for the *reasoning* behind the data model, see `CLAUDE.md` §6.

---

## The four nouns

Studio has four ideas in it. Once these land, the rest of the screen is obvious.

### Brand — *who is talking*

A public identity, with its own audience and its own voice. You have three:

| Brand | Who it is |
|---|---|
| **Utaitai** | The app's own voice — songs, language, learning. |
| **Coding Mom** | You, personally. Building apps and games for moms and families. |
| **Sleepy Cat** | The game's own account — devlog and art, aimed at players. |

**A brand is not a project.** "Coding Mom" isn't something you're building — it's a persona
that can talk about *any* of your projects, or about nothing in particular. A postpartum-
coding story belongs to no project at all. That's why the board filters by brand, and why
every drop's project field has a `None — brand building` option.

### Channel — *one real account*

`@utaitai-japanese` on TikTok. `codingmom` on Medium. One channel = one login you actually
post from. Each channel belongs to exactly one brand.

Channels have a **state**:
- `live` — the account exists and you post to it
- `planned` — you intend to make it, but haven't yet
- `paused` — dormant

Planned channels stay visible so the intention doesn't get lost, but they shouldn't be
generating work you can't do.

Managed at **Studio → Channels**.

### Drop — *one unit of content going out*

One video. One essay. One text post. A drop carries:

- **Brand** — who's saying it *(required)*
- **Project** — what it's about *(optional)*
- **Format** — short video / article / text post / image
- **Stage** — where it is in the pipeline
- **Publish at** — a date *and time*, not a due date
- **Goes out on** — which channels, as checkboxes
- **Body** — the actual words
- **Notes** — anything else

**A drop is deliberately not a Mark.** A Mark (task) is binary — open or done. A drop moves
through repeating stages, fans out to several channels from one source asset, and has a
publish datetime. If they were the same thing, your task list would be 90% "post the thing"
and the real work would be buried underneath.

### Series — *a standing commitment that creates drops for you*

"Daily short, Japanese TikTok, 18:00." A series materialises empty dated cards ahead of
time, every time Studio loads.

This is the whole point. Posting daily on two accounts is ~730 drops a year — a Studio that
made you hand-create each one would die in a week. **You never create your daily posts. You
open a card that's already waiting and fill it in.**

Currently seeded:

| Series | Brand | Cadence | Channel |
|---|---|---|---|
| Daily short — Japanese | Utaitai | daily, 18:00 | TikTok (Japanese) |
| Daily short — Chinese | Utaitai | daily, 19:00 | TikTok (Chinese) |
| Daily short | Coding Mom | daily, 20:00 | TikTok — **off**, account doesn't exist yet |
| Weekly essay | Coding Mom | Sundays, 09:00 | Medium |

The two Utaitai dailies are two series, not one series with two channels — the accounts run
different songs, so each day is two separate pieces of work.

---

## The board

Five columns, left to right:

```
Idea  →  Script  →  Produce  →  Scheduled  →  Published
```

| Stage | Means |
|---|---|
| **Idea** | Something worth saying |
| **Script** | Words down |
| **Produce** | Film, write, design |
| **Scheduled** | Queued to go out |
| **Published** | Live |

`Produce` is format-neutral on purpose — filming a TikTok and writing a Medium essay share
one column, so you get one board instead of a board per format.

### What's on the screen

- **Brand filter chips** (top left) — pick a brand, or "All brands". The filter also
  pre-selects the brand when you hit "New drop".
- **"N going out today"** — a crimson pill, only appears when there are unpublished drops
  with today's publish date.
- **"New drop"** (top right) — for anything outside a series.
- **Drop cards** — brand dot + name, title, format · project · publish date, and a row of
  channel badges. A `↳` means the drop was derived from another one.
- **The `→ <next stage>` button** at the bottom of a card — appears on hover (always
  visible on phone). One click advances the stage without opening anything.

The columns hold **one-off drops only**. Series slots live in the queue strip above — see
below.

### The drop panel

Click any card to open the panel from the right. Everything about the drop is editable
there. Two sections are worth calling out:

**Goes out on** — checkboxes for every channel belonging to the selected brand. Tick more
to fan the same asset out to more places.

**Posted where** — the per-channel publish checklist, one row per attached channel:
- a check button to mark that channel posted
- a field for the live URL
- an open-link icon once the URL is in

This is how one video going to TikTok + Reels + Shorts stays *one drop* instead of three.
The card shows `2/3` when you're partway through.

---

## The daily queue, and filling a week at a time

Posting daily on two accounts is about 730 drops a year. Two things make that survivable.

### The queue strip

Above the columns sits **Daily queue** — one lane per series, one small square per day:

| Square | Means |
|---|---|
| dashed, grey | empty slot, still ahead of you |
| dashed, crimson | the day went past and it was never filled |
| solid grey | filled, still in `idea`/`script`/`produce` |
| solid black | `scheduled` |
| solid green | `published` |
| ringed | today |

Click any square to open that slot's drop panel, exactly as if it were a card. The header
counts `filled / total` and flags anything that slipped past.

Series slots are deliberately **not** shown as cards in the columns — twenty-eight
identical empty cards would bury the handful of drops you actually thought up.

### Fill the week

**Studio → Fill the week** (or the button on the queue strip) opens every upcoming slot as
one grid, grouped by day. Each row is one slot:

- a channel badge, so you can see at a glance which account it's for
- **Song / hook for this one** — the title
- **Viral post it's based on** — the TikTok you found the song on, kept for later

Type the whole batch, then:

- **Save** — writes the titles and links, leaves every stage alone.
- **Save + mark produced** — the same, and moves every row that has a title to `Produce`.
  Empty rows are left alone, and anything already `scheduled` is never dragged backwards.

This is the flow if you batch: find the songs, screen-record the clips, then fill the grid
once instead of opening fourteen panels.

---

## The two kinds of repurposing

Calling both of these "repurposing" is what makes content feel unmanageable. They're
different, and Studio treats them differently:

**1. Same asset, more places** — a TikTok also going to IG Reels, FB Reels, YT Shorts.
→ **One drop, more channels ticked.** Near-zero effort, and it should stay that way.

**2. Same idea, different form** — a Medium essay becoming a Threads post.
→ **A derived drop.** Use the *derive* action in the panel. It gets its own stages and its
own publish date, because it has to be rewritten, not re-uploaded. The child card shows `↳`.

---

## A week in the Studio

**Batch day.**

1. Find the songs — seven for `@utaitai_jp`, seven for `@utaitai_cn`.
2. Screen-record the clips from the Utaitai app.
3. **Studio → Fill the week.** Type each song into its row, and paste the TikTok you found
   it on into the reference field beside it.
4. Hit **Save + mark produced**. All fourteen land in `Produce` at once.

**Each day after.**

1. **Open Studio.** The queue strip rings today and the crimson pill says
   "2 going out today".
2. **Click today's square** for the Japanese account. The panel opens on that drop.
3. **Post it on TikTok for real**, then tick the channel under "Posted where" and paste
   the URL.
4. The square turns green. That publish **bumps the Utaitai project's `lastTouchedAt`**,
   which is what feeds momentum and drift warnings on the Projects surface. Posting is how
   a project proves it's alive.

If you'd rather work one drop at a time, nothing stops you — click an empty square, fill
the panel, and walk it through the stages by hand.

---

## Studio → Channels

The admin screen for brands and channels. Add a brand, add an account under it, set its
platform, handle, label and state.

**Note the seeded handles are placeholders** — `utaitai-japanese`, `codingmom`,
`sleepycatgame` and friends were deliberately made obviously-fake so they couldn't be
mistaken for correct. Fix them here, **not** in `prisma/seed.ts`. The seed is a starting
point, not the source of truth now that the app is live.

---

## FAQ

**A drop should have no project. Is that wrong?**
No — it's the normal case for brand-building content. Pick `None — brand building`. Forcing
a project would make you invent a fake "Coding Mom content" project, which is exactly the
mess the two-axis model exists to avoid.

**One project posts from several brands. Is that wrong?**
Also no. Sleepy Cat devlogs go out from both Coding Mom's TikTok and the game's own X
account. Brand and project are two independent axes.

**Why is there an empty card with no title?**
It's a series slot. The series generated it for that date; you haven't filled it yet.

**Can I delete a series slot I'm not going to do?**
Yes, delete the drop from the panel. Slot generation is idempotent on `[seriesId, slotDate]`,
so a deleted slot may reappear on the next load — turn the series off if you're stopping the
cadence for good.

**Where do tasks go?**
Not here. Tasks are **Marks**, and they live on the Hunt Board — Phase 3, not built yet.
