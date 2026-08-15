# The Ledger

_Written 2026-08-14, for me reading this in six months._

Money. Four tabs at `/ledger`: **Net worth**, **Accounts**, **Property**, **Tax estimate**,
plus a **Connections** page behind them where the plumbing lives.

The whole thing is built on one idea — **almost nothing here is typed in.** Balances and
transactions come from the bank, the owner statements come out of your email, the property's
value comes from an API. There are exactly two forms in the entire surface: a property's
address, and the handful of tax answers no bank can supply.

---

## Getting it running

Four environment variables, in `.env.local` and in Railway.

| | |
|---|---|
| `LEDGER_ENCRYPTION_KEY` | 32 bytes, base64: `openssl rand -base64 32`. Seals the bank token. |
| `PLAID_CLIENT_ID` / `PLAID_SECRET` | From the Plaid dashboard. |
| `PLAID_ENV` | `sandbox` or `production`. |
| `RENTCAST_API_KEY` | Optional. Without it, property values are entered by hand. |

**Do not regenerate the encryption key casually.** Change it without a rotation window and
every stored bank token becomes unreadable, which means re-linking every bank. To rotate: move
the old value into `LEDGER_ENCRYPTION_KEY_PREVIOUS`, set a new one, and let the secrets re-seal
as they are written.

Missing any of these, the Ledger opens and **names the one that is missing**. Nothing else in
the app is affected.

### Plaid sandbox vs production

Sandbox needs no approval and logs in with `user_good` / `pass_good`. Production is an
application to Plaid with a review, and it bills per linked bank per month. Build and poke
around on sandbox; apply for production while you do.

### Gmail

Reads the owner statements. It reuses the Google credentials sign-in already has — **no new
secret** — but it needs two things done once in Google Cloud:

1. Enable the **Gmail API** on the project.
2. Add a second authorised redirect URI to the existing OAuth client:
   `https://<your-app>/api/ledger/gmail/callback` (and the localhost one for dev).

Then press **Read statements from email** on the Property tab.

It is deliberately a **separate consent from signing in**. If it were part of sign-in, the
thing that breaks the day Google changes its rules about mailbox scopes would be the front
door. It is read-only, and the search is narrowed to mail from your management company with a
PDF attached in the last 60 days. No message body is ever stored — only the statement and the
rows read out of it.

---

## Net worth

The hero figure, what it is made of, and a line over time.

**Balances are stored exactly as the bank reports them** — always positive. Whether something
counts for or against you is decided in one place, so the roll-up and the account list can
never disagree about what a credit card means.

Three things that are deliberate and might look like bugs:

- **A property with no valuation contributes nothing.** Not its purchase price. A house bought
  in 2019 is not worth what it cost, and using that figure would be a number nobody gave the
  app while looking entirely reasonable.
- **The line needs two days to exist.** Net worth is recorded once per day you open the
  Ledger, and nothing is computed backwards.
- **Dashed segments are days you did not open it.** The value is carried forward, and the dash
  says that is an inference rather than a measurement.

An account can be left out of the total without disconnecting it — the eye icon on its row.
It still syncs and stays listed, because a hidden account you cannot find is one you can never
un-hide.

---

## Accounts

Spending, by month and by category, and the recent transactions.

**Transfers between your own accounts are excluded from every figure.** Paying a credit card
off is not spending. They are still *listed*, with a chip saying why they do not count —
a list that silently omitted them would disagree with your bank statement, and a ledger you
cannot reconcile against the source is one you stop trusting.

**Pending charges count.** Money you have spent is spent, whatever the bank has settled.

A category you set by hand **survives a sync**. Plaid's own guess is kept separately and never
overwrites yours.

---

## Property

Add one and the app creates a **project** alongside it, in Home & Money. That project is where
its tasks, docs and journal live — chase the plumber, the lease terms, what the tenant said in
March — because all of that already works and did not need reinventing. The money lives on the
property; the work lives on the project.

Three kinds of number sit on the card and they are **not** the same kind of true:

- the **value** is an estimate with real error bars, shown with its range and its age;
- the **debt** is a statement from the servicer, exact;
- the **cash flow** is bank transactions, exact but only over what has been claimed.

**The mortgage is suggested, never attached automatically.** Plaid hands back the servicer's
address and the app scores how well it matches — then stops and waits for you. A mortgage on
the wrong property moves the depreciation, the interest deduction and the cash flow at once.

### Two numbers only you can supply

**The land/improvement split.** Land does not depreciate, so this decides the deduction. It
comes off the county assessor's ratio. **Until it is entered, depreciation is not estimated at
all** — a plausible guess is wrong by thousands a year and looks exactly like a real figure.

**The date it was first available to rent** — *not* the purchase date. Depreciation starts
mid-month from this, so buying in June and finishing the work in September is a three-month
difference in the first year, and it lasts 27 years.

### Owner statements

They arrive by email, get read automatically, and wait for you to accept them.

**A statement cannot be accepted until it reconciles.** The rows must add up to the totals
printed on the statement itself, to the cent. That check is the only reason a language model is
allowed to read a financial document here — a misread digit fails arithmetic rather than
passing review.

**What it cannot catch**: anything that does not change a total. A repair booked as insurance
adds up perfectly and is wrong on the Schedule E. That is why nothing auto-accepts, why every
row shows the verbatim line it was read from, and why rows the extractor was unsure about are
tinted. Check those first.

You can always **upload a PDF by hand**. That path needs neither Gmail nor the poll, and it is
the answer when the manager changes sender or emails a portal link instead of an attachment.

---

## Tax estimate

**It computes nothing until the tax constants for the year have been confirmed**, and that is
the most important thing on the tab.

Every bracket, threshold and rate ships **empty**. Not one of them comes from the app's own
memory, because a tax figure that is 4% wrong looks exactly like one that is right, nothing
downstream contradicts it, and you find out when it has cost money.

### Confirming the constants

Past mid-October the app fetches the published IRS and Washington DOR pages and files a **draft** — each
number beside the verbatim sentence it was read from. Confirming is then *reading*: compare the
number to the quoted line, correct it if the extraction misread a digit, press confirm.

Confirming the last one flips the year to verified and the estimate starts computing. There is
no "mark as done" button, because the engine's refusal is keyed on there being nothing left.

### What it works out

Schedule E per property, self-employment tax, the §469 passive-loss limit, §199A, NIIT and
federal brackets. Every figure carries a small `est.` mark, and figures built on unconfirmed
constants carry a second badge.

**Washington has no personal income tax**, so salary, self-employment, interest, dividends and
rental income are untouched by the state — which is why there is no state bracket table to
confirm. What it *does* have is a **7% tax on long-term capital gains** above a threshold, and
two things about it are worth knowing before the year you need them:

- **Real estate is exempt outright.** Selling the rental does not trigger it, however large the
  gain. So is anything in a retirement account.
- **It only reaches securities**, so the profile asks how much of a long-term gain came from
  real estate — the app cannot tell a house sale from a stock sale otherwise.

One knock-on worth catching: on the federal Schedule A, state and local tax is **income or
sales, never both**. In a state with an income tax that election is academic. Here your state
income tax is zero, so **sales tax is the whole of it** — leaving that box empty understates
your itemized deduction by thousands.

**Refusals you will meet, and they are working as intended:**

- A property with no land split **takes the whole estimate down**, not just its own line — the
  rental's net feeds your AGI, so a missing depreciation figure would leave a tax bill that is
  too *large* with nothing saying so.
- A rental loss you cannot use this year **suspends and carries forward** rather than
  disappearing. It offsets rental profit later, or releases when you sell.
- §199A reports a **checklist, not a yes**. Whether a rental is a trade or business is a
  judgement, and the safe harbour has three conditions of which the app can see one.

### What it does not model

Listed permanently at the bottom of the tab: AMT, K-1s, 1031 exchanges, installment sales,
moving states part-way through a year, converting a rental to personal use, and most state
credits.

**Nothing here is a return and nothing here is advice.** The strategy list is phrased as
questions for your accountant, and the only button on any of them is *Mark as raised*. There is
no button that says "do this", on purpose.

---

## Connections

Where the plumbing shows itself: which banks are linked, when each last synced, whether Gmail
is connected, and a log of every outbound call with its result.

**This page exists because automation fails quietly.** Every other surface shows data you
entered, so a bug is obvious. A Ledger whose last sync was eleven days ago looks exactly like
one that synced this morning — the numbers are all still there, they are just wrong.

**The one thing that cannot be automated is re-authentication.** Banks expire credentials and
demand MFA. When that happens the sync line turns crimson on every Ledger page and names the
bank; press **Sign in again** and Plaid reopens with your phone in hand.

**Disconnecting keeps the accounts.** It ends the grant at Plaid first, then removes the
connection — the balances and two years of transactions stay, and simply stop updating. Those
transactions are what your tax numbers are computed from.

---

## Asking Montblanc

The drawer knows about the Ledger, and what it can do there is deliberately narrow:

> that $340 charge was a plumbing repair for the rental

It will find the transaction, show you which one it means, and file it against the property with
the right Schedule E line — with a receipt and an Undo, like every other write.

**It cannot create money.** There is no tool that makes a transaction, because transactions come
from a bank. And it will not tell you what you owe or whether something qualifies — it points at
the Tax estimate tab instead. Undoing a filing **releases the claim** rather than deleting
anything, because a bank row is a payment that really happened.

---

## When something looks wrong

**A figure has not moved in days.** Connections → look at the log. A red row names what failed.

**A bank says it needs signing in again.** Only you can fix it, and only in person. The button
is on Connections.

**Spending looks enormous this month.** Check whether a transfer between your own accounts has
failed to pair up — they only match within a few days of each other.

**A statement will not accept.** It says how far out the rows are from the statement's own
totals. Open the PDF next to it and find the row that is wrong; every row shows the line it came
from.

**The tax estimate says "not computed".** It always says why: either constants that have not
been confirmed, answers that have not been given, or a property missing its land split.

---

## The scripts

Under `scripts/`, run with `npx tsx`. They exist because most of what this feature does is
arithmetic that is wrong silently.

| | |
|---|---|
| `ledger-check.mts` | Money conversion, account mapping, the sign convention. No database. |
| `tax-check.mts` | Depreciation and bracket arithmetic. No database. |
| `engine-check.mts` | The estimate pipeline, including the two non-circular orderings. |
| `strategy-check.mts` | The strategy predicates and the confirm round trip. |
| `ledger-smoke.mts` | The roll-up against real rows, cleaning up after itself. |
| `property-check.mts` | Property parsing, guards, and the read path. |
| `statement-check.mts` | Builds a real PDF and runs it through extraction. |
| `tax-view-check.mts` | The tax refusals, in context. |
| `ledger-live.mts` | The whole stack against **real Plaid sandbox**. |
| `ledger-reset.mts` | Clears Ledger rows only. The way out when a check crashes mid-run. |

The database ones refuse to run when real rows exist, which is why `ledger-reset.mts` is there.
