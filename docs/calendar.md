# The Calendar

_Written 2026-08-01, when Phase 4 shipped. Update this when calendar behaviour changes._

The Calendar is the only surface organised by **time** rather than by state. Everything
else in Clan Centurio answers "what needs doing"; this one answers "what is my day".

---

## What's on it

Three different things share one grid, and they are told apart by **shape**, not colour:

| Glyph | What it is | Clicking it |
|---|---|---|
| **▌ bar** | An **Event** — something that happens at a time | Opens the event panel |
| **▪ square** | A **Task** due that day | Goes to the Hunt Board |
| **● dot** | A **Content item** going out at that time | Goes to Studio |

Colour is the **area** (or, for a content item, the brand) — orange for Baby, blue for Work, and
so on. That's why shape carries the type: colour is already saying something else.

Only Events actually live on the calendar. Task due dates and Content item publish times are
*shown* here but still belong to the Hunt Board and Studio, which is why clicking them
takes you there. The calendar is not a second place to edit them.

---

## Getting around

- **Month / Week / Day** — the three pills. Month is the overview; Week is the one that
  shows how a day actually packs together; Day is for a full one.
- **‹ › and Today** — pages by month, week or day depending on the view you're in.
- **Area pills** — filter to just Baby, just Work, and so on.
- **+N more** in a month cell content items you into that day.

The view and the date live in the URL, so a particular week is a link you can come back to
or send to yourself.

Week and Day show an hour grid. Things happening at the same time sit **side by side**
rather than on top of each other, and a thin crimson line tasks the current time.
**All-day things** — task due dates, an all-day event — sit in a band above the hours
instead of filling the whole column.

---

## Adding an event

**New event**, or the small **+** on any day cell or column.

- **All day** turns the times off. An all-day event can span several days — set a later
  end date and it appears on each one.
- **Project** is optional and mostly stays empty. A dentist appointment belongs to an area
  and nothing else; a playtest belongs to Sleepy Cat. Picking a project sets the area for
  you — same rule as tasks.

## Repeating events

**Repeats** offers: every day, weekdays, weekly (pick the days), monthly. **Repeat until**
is optional — leave it empty and it repeats forever, which a standing weekly block
genuinely does until it doesn't.

**The important thing:** only the *rule* is stored, not the individual days. So:

> **Editing any occurrence edits all of them — past and future.**
> Moving Tuesday's session moves every Tuesday session.

There is no "skip just this one" yet. If you need a one-off change, the honest move is to
end the repeat (set **Repeat until** to the day before) and start a new one. That's a real
limitation, and it's noted in the roadmap.

Two smaller edges worth knowing:

- **Monthly on the 31st** simply doesn't happen in a short month. It won't shuffle to the
  28th on its own.
- A repeating event that runs past midnight shows on the day it starts.

---

## Today's Agenda

The **Agenda** card on Today is the same events, just for today, in time order with the
all-day ones first. Things that have already finished go grey; whatever is happening right
now gets a crimson **Now**.

It shows **events only** — your tasks are already in the sprint card at the top of the
screen and your content items are in "Going out today" in between, so putting them here as well
would be the same row three times on one screen.

---

## What isn't on here: the baby

There used to be a seeded baby routine — feeds, naps, bath and bed, a swim class, a
check-up. It's gone, deliberately, as of 2 August 2026.

A four-month-old is followed, not scheduled. A calendar asserting a 13:00 nap every day
is mostly a machine for feeling behind, and worse, things started to *depend* on the
fiction: the Sunday filming block was parked "inside the long nap", which is planning
against something that was never reliably true.

The one part of the baby's day that genuinely is deliberate — reading to her in
Vietnamese and English — lives on the **Multilingual baby** project as recurring
**tasks**, not events. That's the right distinction and it's the one this whole app is
built on: an event is something that *happens at a time*, a task is something you *owe*.
Reading to her is owed. It happens in whatever gap the day leaves.

Real appointments still belong here. A paediatrician slot is an event — it has a time,
and the time is the point. Add it when you have one.
