# Light, dark, and the sun

_Written 2026-08-06._

The dashboard has two looks. By default it picks for you, going dark at sunset and light
again at sunrise.

## The control

Three buttons in the topbar, between the date and the notification bell:

| | | |
|---|---|---|
| ☀ | **Light** | Pinned light. Stays light at midnight. |
| ◐ | **Auto** | The default. Follows the sun. |
| ☾ | **Dark** | Pinned dark. Stays dark at noon. |

Hovering the middle one tells you when it next changes — "Dark at 7:50 pm".

Pinning is not temporary. Pick Light and it stays light until you press something else,
including tomorrow and on the next visit. Press Auto to hand the decision back.

## Why it asked where you are

Sunset is a different time in Seattle and San Diego, and a very different time in
December and June — in Los Angeles it moves from **4:57pm in January to 8:07pm at the
solstice**. To be right all year the app has to know roughly where it is.

So the first time you load it in Auto, the browser asks for your location. It is asked
**once**:

- **Allow** — sunset is computed for exactly where you are, and follows you if you travel.
  The answer is cached for a month.
- **Block** — it falls back to Los Angeles and never asks again. Being a whole timezone
  out shifts the switch by under an hour, so this is a perfectly usable answer if you
  would rather not share it.

Pinning Light or Dark means the app has no use for sunset at all, so it does not ask.

Nothing about your location leaves the browser. It is not sent to the server and it is
not in the database — it sits in the browser's own storage purely to work out what time
the sun goes down.

## What it does not do

**It does not follow your phone or laptop's dark mode setting.** That is a different
question from "is it dark outside" — your system might be on a schedule of its own, or
pinned, or following an app you have never opened. Auto answers the sun question, and the
two buttons either side answer the other one directly.

## Per-device, not per-account

The choice is remembered **per browser**, not on your account. Your phone at 9pm and your
laptop at 9am want different answers, and this way they get them. The flip side is that a
new browser, or a cleared cache, starts at Auto again.

## If it looks wrong

- **Stuck in the wrong one?** Press Auto. It re-checks the moment you press it, and again
  every time you come back to the tab.
- **Switching at the wrong time?** The location was probably declined, so it is using Los
  Angeles. Re-allow location for the site in your browser's settings and reload.
- **A flash of white when a page loads?** Shouldn't happen — the theme is set before the
  page draws. If you see it, that is a bug worth writing down.
