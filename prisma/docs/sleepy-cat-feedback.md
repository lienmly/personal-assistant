# Design feedback — the shared doc

> **The live doc is here:** [Sleepy Cat — game design feedback](https://docs.google.com/document/d/1vn7Zqbh7doiuFkGDB8k9aJq_FduycCMmeM0B4a9DV6c/edit)
>
> That Google Doc is the source of truth and the place to write. This page is a
> pointer plus a dated snapshot, so the feedback is readable next to the tasks it
> generates without having to leave the board.

---

## Why this is a link and not a copy

This is a document my husband and I go back and forth in, and the doc rows in this
app are editable in the app. Importing the text would fork it on the first edit
and leave two versions drifting apart, with no way to tell which one either of us
had last read. **Write in the Google Doc. Summarise here when something is
settled.**

The snapshot below is from **2026-08-05** and is a summary rather than his words.

## Where the feedback stands — 5 August 2026

His overall verdict is the important part, and it agrees with the plan on the
[road to Steam](./sleepy-cat-steam.md) page without having been asked to:

> The game has reached MVP. The work now is polishing level structure and the
> existing mechanics, not adding features.

That is worth taking seriously, because scope creep on a first game is the failure
mode that actually kills it, and this is the person who has played it most.

### Round 1 — core mechanics and UI

- **"Hidden bed" should be "hidden sleep spot".** The art can make a sleep spot read as ordinary furniture, so the word has to carry what the picture doesn't.
- **Discovering one sleeping spot hides the others** — and it is undecided whether that is the design. Hiding them tests memory; leaving them visible helps the player. This is a real fork and not a bug.
- **The sleep and comfort dice work.** Left alone.
- **The resource UI is ambiguous** — hearts earned and hearts spent on comfort look like the same thing and are not. The fix is to separate them visually: Energy as action points, Comfort/Reset as its own category.
- **Look at how Final Fantasy and its neighbours organise on-screen information.** A puzzle game with two resources has the same problem a JRPG solved decades ago.

### Round 2 — progression and polish

- **The title screen blur hurts readability.** Remove the animation.
- **The jump from Level 1 to Level 9 is disorienting** — too many mechanics arriving at once.
- **Introduce one mechanic at a time.** Level 1 teaches move and sleep; Level 2 introduces Push. That is a level-order problem, not a difficulty-numbers problem.
- **Simplify the 3AM zoomies** to a regular 24-hour clock with time passing over about five minutes, so zoomies become a specific night event — which needs a visible day/night distinction to read.

## What this changes on the board

Nothing structural. The polish tracks already exist and this fills them in:

- **"Polish pass on the puzzle difficulty curve and level order"** is now the biggest single item on the project, and it has a concrete definition — teach one mechanic per level, starting from move and sleep.
- **The resource UI** is its own piece of work rather than part of the curve, because it is a readability problem and not a pacing one.
- **The title screen blur** is the cheapest fix on the whole list.
- **The hidden-spots question needs deciding before it is polished**, since the two answers are different games.
