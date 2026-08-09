# Montblanc

_Written 2026-08-09._

Montblanc is the moogle in the drawer. You tell it what you want on the board in
a sentence and it files it, or you ask where something lives and it takes you
there.

It exists because of one specific friction: you think of a bug while looking at
something else, and putting it somewhere means remembering which screen tasks
live on, which project it belongs to, and which track — three decisions before
you get to type the sentence you already had in your head.

## Opening it

- **`Ctrl+K`** (or `⌘K`) from anywhere.
- **The pill at the top of every screen** — the one that used to say "Try
  searching 'tasks'" and did nothing.

Type, press Enter. Shift+Enter for a second line, which you will almost never
want.

It **does not remember** between opens. Each time is a blank sheet. What
persists is the row it made.

## What to say

Ordinary sentences. It knows every project, area, brand and account by name, so
you can just use them.

| You say | What happens |
|---|---|
| "Add a bug to Sleepy Cat: cat clips through the sofa" | A task on Sleepy Cat, Build track |
| "Coding Mom idea: the 3am commit" | A content item on the Coding Mom brand, at the idea stage |
| "Remind me to renew the domain before the 20th" | A one-off task, due 20th |
| "Paediatrician Thursday at 2" | A calendar event |
| "She rolled over both ways today" | A journal entry in the Baby area, dated today |
| "What's overdue?" | The list, each row a link |
| "Tick off the store page task" | Finds it, ticks it |
| "Where do I add a new TikTok account?" | Takes you to Studio → Channels |
| "Post to all four accounts every morning" | A daily recurring task with a step per account |

Several at once works too: _"add a bug about collisions and one about the save
file"_ gets you two rows, not one.

## The rules it follows

These are the app's own rules (CLAUDE.md §6), not manners. They are the reason
it can be trusted to write without asking first:

- **It never invents a due date.** If you didn't say when, there is no date.
  That is the normal state for a task here and it is deliberate — a deadline
  nobody set is a row you have to stop and disprove.
- **It never guesses between two projects.** If it can't tell, it either leaves
  the task project-less (it shows on Today under **One-offs**, which is visible
  and fine) or asks you one short question.
- **It makes exactly what you asked for, once.** It will not add the three
  follow-up tasks it can imagine.
- **It doesn't write notes you didn't dictate.** "Fix the collision bug" is the
  title and the notes stay empty.
- **A thing you owe is a task, even with a date on it.** Only things that
  genuinely happen at a time — appointments, a fest week — go on the calendar.
- **A journal entry always lands today.** There is no back-dating, here or
  anywhere else.

## Undo

Everything it makes appears as a small card in the drawer saying what it is and
where it went, with **Open** and **Undo**.

That card is the whole reason it is allowed to write straight through instead of
showing you a draft to approve. A confirmation step would cost a tap on every
row including the ones that were right; the receipt costs nothing and makes a
wrong one a single tap to remove. Undo works as long as the drawer is open —
after that, delete it where it lives, same as anything else.

**Undo on a project it refuses** if you have already hung work off it, and says
what is holding it. That is the same rule the project panel follows.

## When it can't

- **"Montblanc has no API key yet"** — `DEEPSEEK_API_KEY` isn't set. Add it to
  `.env.local` locally, or to the service's variables on Railway, and restart.
- **"DeepSeek says: insufficient balance"** — the account is out of credit.
- **"no project called …"** — it will not file something near where you meant.
  Say the name as it appears in the sidebar.

## What it deliberately can't do

- **Edit or delete anything**, other than ticking a task off and undoing what it
  just made. It is a way in, not a way to rearrange. Changing a thing means
  opening it, where you can see what you are changing.
- **Read your docs or journal back to you.** It knows what projects and brands
  exist; it does not read your writing.
- **Publish anything.** Ticking a channel as posted stays on Today, where you do
  it having actually posted.
