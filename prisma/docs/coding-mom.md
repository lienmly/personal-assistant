# Coding Mom — the brand *and* the project

> Coding Mom is two things in this dashboard, and that isn't a mistake.
>
> - The **Brand** is who is talking — a persona that can post about any project, or about
>   nothing in particular. That's been true since Studio was built.
> - The **Project** is the audience-building *work*: accounts to create, a warm-up week to
>   sit through, a content bank to keep stocked, a community to reply to.
>
> The brand is a voice; the project is a backlog.

---

## The goal

**10,000 engaged followers, who become the audience Forge launches into** — the startup in
[the Forge brief](./forge-vision.md). That is the whole reason this project exists, and it
is worth being blunt about the shape of it: Coding Mom is not a side hustle sitting next to
the startup, and it is not a marketing plan for later. It is Forge's first phase, running
early, and the follower count is a *means*. The thing being built is a group of people who
trust a mom who builds, and who will still be there when there is something to hand them.

**Nothing counts until the account exists.** As of 2026-08-05 there is no dedicated e-mail
and no TikTok account, so every row on this project is either the setup chain or a decision
that has to be made before the chain is worth starting.

### "Engaged" is doing a lot of work in that sentence

10,000 followers and 10,000 *engaged* followers are different products, and only one of
them is worth anything to Forge. A follower who scrolled past and tapped follow is not
someone who will join a waitlist for a $200 prototype credit.

So the number needs a second definition beside it, and picking one is a task rather than
something to be assumed here. The candidates, roughly in order of how much they predict
someone actually showing up for Forge:

- **DMs and replies you have had an actual conversation in.** The strongest signal and the
  hardest to fake. Probably the real metric.
- **Saves and shares** — someone filing a build to come back to.
- **Comments** — cheap, but the ones asking "how did you make that" are the audience.
- **Watch-through rate** — what TikTok itself rewards, so it drives reach, but it says
  nothing about intent.

Follower count is what gets counted because it is what the platform shows. Decide which of
the above is the one that actually matters, and check it monthly.

---

## Why TikTok first, and when to stop

One platform, because six accounts posting daily from a standing start is not a plan, it is
six accounts that go quiet. TikTok first because it is still the cheapest place to reach
people who have never heard of you — reach there does not depend on an existing following
the way every other platform's does.

**A trial needs an exit condition, or it isn't a trial.** "Try TikTok first" quietly becomes
"do TikTok forever, badly" unless there is a number and a date written down in advance. Pick
both before the first post — a count of posts and a stretch of weeks, judged on the metric
above rather than on followers — and write down what happens if it is missed. The honest
alternatives are a different platform, a different niche, or a different format, and it is
much easier to choose between them in advance than while feeling bad about it.

---

## The niche

**Building apps and hardware for babies and moms, and posting the result and the journey.**

That is narrower than the seven-pillar plan this doc used to carry, and the narrowing is
deliberate: a niche is what makes the algorithm able to find your people, and "a mom who
codes" is a description rather than a niche. The tighter version also happens to be the
truth — the multilingual book reader and the breathing tracker are being built anyway, for
her, and they are Forge's flagship products.

**The thing this rules out is the interesting part.** Sleepy Cat and Utaitai are real apps
being genuinely shipped, and neither is for babies or moms. Posting them here is off-niche
and it is on the board as a decision rather than assumed either way, because "I built a
cozy game with my husband" is a good video and a mixed signal.

### The pillars

A daily post is only sustainable if "what do I post today" has already been answered. The
pillars are the answer, and they have an **order**, not just a rotation — Multilingual sets
up Hardware, and Hardware sets up Forge. Run that sequence deliberately.

- **Baby** — what I'm learning taking care of her. The warmest audience, and it is the daily
  reality anyway.
- **Build** — the things I build and how. Establishes that "coding" in Coding Mom is real.
- **Multilingual** — raising her multilingual. Deeply on-brand, and it is the bridge into
  hardware: *what I'd have to buy to make her foreign-language books readable at home — and
  it doesn't exist*.
- **Hardware** — building physical things: the book reader, the breathing tracker. The
  on-ramp to Forge. Everything here carries `projectId: forge`.
- **B-roll** — the 3am reasons. Relatable, quiet, travels furthest, costs least to make.

**Cut from the earlier plan: Roster and Home truths.** Roster was an app list, which is the
off-niche question above. Home truths was the highest-signal and highest-risk pillar, and
launching a brand-new account on the riskiest material is a bad first bet — it can come back
once there is an audience that already knows who is talking.

### Where the bank lives

The ideas are **content items in the idea stage**, on the Social Media board filtered to
the Coding Mom brand. Not tasks — a post isn't binary work, it moves through
produce → scheduled → published and fans out to several accounts at the end (CLAUDE.md §6).

They carry **no publish date and no series**, so they sit in the idea column as a bank
rather than pretending to be scheduled. When a day's slot comes up in the daily queue, you
pull one across. The pillar is written into the item's notes as `Pillar: X` — seven strings
didn't earn a database column.

There are **31 of them already**, written against the older seven-pillar plan. They need a
pass against the narrowed niche before they are used, which is a row on the board. One is
flagged: **"BLM recipe app"** is captured verbatim with a warning on it, because what BLM
stands for has to be expanded before it becomes a post.

---

## The setup chain — do it in this order

The Setup track is a strict sequence, and it is the only part of this project where order is
load-bearing rather than a preference.

1. **Check the handle is actually free.** "Coding Mom" is a common phrase. The channels in
   this app are seeded with `@codingmom`, which is an assumption and not a fact. Find out
   before the e-mail account is named after it.
2. **The dedicated e-mail account.** First, because TikTok, Instagram, Facebook, YouTube,
   Threads and Medium all hang off it. Doing this second means migrating accounts instead of
   creating them.
3. **The branding decisions**, below — they change what the profile says and how every video
   is made, and all of them are cheaper now than after fifty posts.
4. **The TikTok account**, made with that e-mail.
5. **Claim the handles everywhere else** while you wait. Free today, impossible later.
6. **A week of warm-up, no posting.** 15 minutes a day of scrolling, watching to the end,
   liking, following and commenting in the mom / build / AIoT niche. A brand-new account
   that posts on day one gets throttled — and the week doubles as the best possible research
   for the bank.
7. **Batch-film the first week** *during* the warm-up. Day one of posting must not also be
   day one of filming.
8. **Flip the channel to live, switch on the Daily short series, and add the daily posting
   task.** The series ships `isActive: false` on purpose: slots you can't fill are worse than
   no slots.

**There are no due dates on this chain, on purpose.** The previous version of this doc dated
it from a 2026-08-01 start with a first post on 2026-08-09, and every one of those dates has
now lapsed with none of the work done — which is the exact failure CLAUDE.md §6 describes in
*"A goal with no deadline gets no due dates"*. There is no external clock on this. Say which
day the e-mail account gets created and the eight rows can be dated off it in one pass.

---

## The branding decisions still open

None of these has a right answer that can be looked up, all of them get more expensive the
longer they wait, and each one is a row on the board.

- **Face on camera, or not.** The single biggest one. A face builds a relationship far
  faster, which is the entire point of a precursor audience, and it also raises the cost of
  every video and puts her family on the internet. Hands-and-screen is a real alternative
  and several large build accounts run on it.
- **English only, or English and Vietnamese.** Multilingual parenting is a pillar, and a
  Vietnamese-speaking audience is a genuinely different audience with much less competition
  in it. Doing both from one account halves the signal for each; doing both from two accounts
  doubles the daily work.
- **The one-line bio**, which is the positioning line: who this is for, and what they get.
  Write it before the account exists, because it is what the first hundred visitors read.
- **What the link in bio points at.** Today there is nothing to sell and nothing to join, so
  it points nowhere — and the moment the Forge waitlist is live, this is the handoff.
- **The format.** Talking head, screen recording, build timelapse, b-roll with voiceover.
  Pick one that can be made in twenty minutes with a five-month-old in the house, and make
  the editing a template rather than a decision.

---

## What the daily post fans out to

One short, several places — TikTok first, then Instagram Reels, Facebook Reels and YouTube
Shorts as each is switched on. That is a single content item with several channel rows
(repurposing kind 1, §6), so it stays near-free. **Strip the TikTok watermark before
reposting**: Instagram and YouTube both demote reuploads that carry it.

Medium is separate — the Weekly essay series, Sundays at 09:00, and it is the one channel
that is already `live`. Two ideas in the bank are essays rather than shorts because they need
the room, and the short version is cut *from* the essay afterwards as a derived item, not the
other way round.

**Turn the cross-posts on one at a time.** Both Coding Mom series carry
`projectId: coding-mom`, so posting bumps the project's `lastTouchedAt` and it stops showing
as drifting on a day you actually posted.

---

## The handoff to Forge

This is the part that is easy to leave until it is awkward. The audience follows **a mom who
builds things for her daughter**. Forge is **a startup with a marketplace and a pitch deck**.
Those are not the same character, and an account that spends a year being the first and then
one day starts being the second loses the people it spent the year collecting.

The way through is that the flagship products *are* the content — the book reader and the
breathing tracker get built on camera, and the audience watches the thing that becomes the
company. Forge, when it arrives, is "the tools I had to build to make these, opened up to
everyone else", which is a sentence the audience has been watching the evidence for.

Deciding how that handoff actually reads is a row on the board, and it should be written
long before it is needed.
