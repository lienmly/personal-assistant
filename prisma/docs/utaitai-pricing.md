## The decision

**$1 for 7 days, then $7.99 a month, charged automatically.** Taken 2026-08-03.

The $7.99 monthly price already exists in Stripe and is not changing. What
changes is only how someone *arrives* at it — a paid week in front of it, and no
second decision to make at the end of that week.

> Record here what the entry point was before this, and the date it changed. Without it there is nothing to compare the new conversion rate against, and finding out whether $1 converts better than free is the entire point.

## Why a paid week and not a free one

A free trial optimises for signups. A $1 week optimises for people who are still
there on day 8, and it does three things a free trial cannot:

- **It takes a real payment, so the card is proven.** The day-7 charge repeats a charge that already succeeded — including whatever 3-D Secure challenge the bank wanted, which happened while the person was sitting there wanting the app. A free trial defers all of that to a moment when nobody is watching.
- **It filters.** A dollar is nothing to someone learning a language, and enough to stop the people who were never going to pay.
- **It sets the frame.** The question on day 7 is "keep paying", not "start paying", and those are different questions.

The cost is a smaller top of funnel and a payment form standing between a
curious person and the app. That is the trade, made deliberately, and it is the
number worth watching.

## What has to be true for it to work

**One charge up front, one subscription behind it.** The subscription is created
on the existing $7.99 monthly price with a 7-day trial, and the $1 rides on the
first invoice so it collects immediately. Access is granted for the whole trial
because it has been *paid for* — the app must treat a trialing subscription as
fully entitled, not as a limited mode.

Verify the exact mechanism against current Stripe docs before building. Two
shapes do this and they are not equally good:

- A one-time $1 line item added to the first invoice of a trialing subscription. Simpler, and it keeps one subscription carrying one price, which is what every later query wants.
- A two-phase subscription schedule — one week at $1, then $7.99 monthly. More literal, more moving parts.

**The existing subscriber does not move.** There is one active subscription
today. A Stripe subscription keeps the price it was created with, so adding a
new trial path should not touch it — confirm that rather than assume it, and do
not migrate them. Handing someone who already pays a trial, or changing their
terms without asking, is how one subscriber becomes zero.

**Day 7 is a real event with three outcomes**, and all three need code:

- **Charged.** Nothing to do but keep access on.
- **Failed.** Stripe retries on its own schedule, and access needs a decided answer for the days in between. Say what it is out loud rather than letting the entitlement check decide by accident.
- **Cancelled during the week.** Access runs to the end of the paid 7 days, because they paid for 7 days. Cutting it off at the cancel click is taking money for nothing.

## Saying so, and meaning it

A trial that charges by default is the exact pattern regulators are looking at.
It is also the pattern people feel tricked by, and one refund request costs less
than one person telling everyone they were charged without warning. So:

- **The price sits next to the button**, not in a footer: "$1 for 7 days, then $7.99/month. Cancel anytime." Same size as the rest of the sentence.
- **Cancelling is reachable from inside the app.** Stripe's customer portal is enough and is roughly a day's work. If the only way out is emailing me, the line above is a lie.
- **A reminder before the charge**, on the `trial_will_end` webhook. It fires three days out, which on a 7-day trial is day 4. It costs a few conversions and buys the right to charge automatically at all.

## The collision to resolve before the stores

Six open tasks on the Ship track put this app into the App Store and Play Store.
**A Stripe paywall inside an iOS app that unlocks digital content is a rejection
under App Store guideline 3.1.1.** Apple requires in-app purchase for that, at
its own cut and with its own trial mechanics, which look nothing like the above.

It does not have to be solved this week — the web checkout is what exists and it
can keep running. It does have to be solved before the iOS submission, and the
options are the usual ones: sell through IAP on iOS and keep Stripe on the web,
or qualify for one of Apple's exceptions. Pick one before building the paywall
screen twice.

## Open

- What the entry point was before 2026-08-03, so conversion has something to be compared against.
- The refund line for the $1 and for a first full month, written down before the first person asks.
- Whether an annual price should exist at all, and if so whether the $1 week leads there instead.
