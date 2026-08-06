## The number

**$100 MRR at $7.99 a month is thirteen paying subscribers.** There is one today.

At one to two signups a day — call it forty-five a month — reaching thirteen needs twelve
more conversions. That is a smaller problem than it sounds and a different one than it
looks like: at a 10% signup-to-paid rate it is about three months, at 3% it is most of a
year, and the rate today is under 1%.

**So the rate is the variable, not the traffic.** Doubling the audience doubles a number
that is very close to zero. Fixing what happens after signup multiplies everything that
comes after it, including every hour spent on content. That is the whole reason the order
below is the order it is.

There is no deadline on this, deliberately, which is why almost nothing on the board has a
due date. The one exception is the baseline task, and it is time-limited for a reason given
below.

## The four levers, in the order they pay

1. **The paywall.** Days of work, and it changes the rate every other lever multiplies
   against. This is the one to finish first.
2. **Knowing why they don't pay.** Free, uncomfortable, and the only thing that can tell
   you whether the paywall is even the problem. Twelve conversions is a conversations
   problem, not a scale problem.
3. **More of the same audience.** Repurposing the clips already being made to Reels,
   Shorts and Facebook. Cheap per post, but the accounts have to exist and be warm first.
4. **The apps.** Weeks of work, a store review, an in-app-purchase rewrite of the paywall,
   and a platform cut. Worth doing; not the fast way to thirteen subscribers.

## The price ladder, and what it collides with

Monthly as the default, with weekly, yearly and lifetime available. Two of those three need
a decision before they ship, because two of them work against the number being chased.

- **Lifetime contributes nothing to MRR — by definition.** It is cash today and a subscriber permanently removed from a count that only needs to reach thirteen. One lifetime buyer is roughly 8% of the goal, gone. Either price it at 30–40× monthly, so it is rare and genuinely worth the loss, or hold it back entirely until $100 MRR is passed and it can no longer distort the only number being watched.
- **Weekly cannibalises monthly and costs more to collect.** Stripe takes 2.9% plus 30¢ per charge, so a $2.99 week loses about 13% to fees against about 6.6% on $7.99 a month — and it charges four times as often, with four times the chances to fail. The case for it is real but narrow: somebody with a trip in three weeks. If it ships, price it so a month of weeks costs clearly more than the month, and let it be the expensive convenience it is.
- **Yearly is the one with no catch.** Cash up front, retention solved for twelve months, one charge to fail instead of twelve. It counts toward MRR as the price divided by twelve, which is how everyone counts it and is honest.
- **The default matters more than the menu.** Four visible options is a decision to make instead of a purchase. Monthly pre-selected, the rest behind one small link.

## Two things to settle before the new paywall ships

**Write down what the old one converted at.** Three free songs and then pay — whatever
fraction of signups reached a payment under that becomes unrecoverable the moment it is
switched off, and it is the only baseline the $1 week can ever be compared against.
Signups, songs played, payments; rough is fine, missing is not. This is the single
genuinely time-sensitive row on the board and the only one carrying a date.

**Decide whether the three free songs survive.** The pricing doc assumes replacement, and
that assumption deserves one more look at this volume. Forty-five signups a month is not
enough to absorb a large hit to the top of the funnel: a card form arriving before anyone
has heard the product work converts a fraction of them to a $1 payer and the rest to
nothing at all, and zero signups times any conversion rate is zero. The other shape keeps
the three songs as the taste and puts the $1 week exactly where they run out — the wall
then arrives to somebody who already knows what they would be buying. Not decided here.

## Responsive web before either app

Cheapest of the three, and a prerequisite for two of them: a webview wrapper around a
desktop-only layout is a bad app on both stores. Four things that get found late otherwise.

- **Store billing is a hard gate, on both stores.** Apple's guideline 3.1.1 requires in-app purchase for digital content and Google requires Play Billing for the same, both at a cut and both with their own trial mechanics. "$1 for seven days, then $7.99 a month" may not be expressible as an IAP in that shape at all. Settle this before a paywall screen gets built twice.
- **A thin wrapper risks a different rejection.** Apple's 4.2 minimum-functionality rule is aimed squarely at repackaged websites. The app needs a reason to be an app — offline songs, lock-screen playback, a notification that brings someone back — and choosing the wrapper does not remove that requirement, it just makes it harder to satisfy.
- **Google Play gates new personal developer accounts behind a closed test:** twelve testers, fourteen continuous days, before production access. It costs no work at all and two weeks of calendar, so it wants starting long before the build is finished.
- **What the apps genuinely buy is store search.** "Learn Japanese with songs" typed into the App Store is a person describing this product exactly, and there is no equivalent on the open web. That is real and it is the reason to do it. It is still weeks against days, so do them because the app should exist — not because it is the shortest path to thirteen subscribers.

## Accounts before posting

Fanning the same vertical clip out to Reels, Shorts and Facebook Reels is nearly free —
one content item with more channel rows, which is exactly the case the Studio was built
for. **The cost is not the posting, it is the accounts.** A fresh account that posts on day
one gets shown to almost nobody, so a week of ordinary use in the niche comes first, and
that week has to happen before the first clip is worth uploading.

- **One account per platform, or one per language?** TikTok is already split into @utaitai_jp and @utaitai_cn, and the reason for splitting holds unevenly elsewhere. The proposal on the board is to split YouTube and Instagram and keep a single Facebook page: YouTube is search-driven and the language of the query picks the audience, Instagram's reach is decided by what the clip is, and Facebook returns the least of the three, so it is not worth doubling. This decides how many accounts get created and warmed, so it comes first.
- **Strip the TikTok watermark before reposting.** Instagram and YouTube both demote reuploads carrying another platform's watermark. Export clean from the editor rather than downloading the posted TikTok, which is the version everybody accidentally uses.
- **Link Instagram to the Facebook page** and Reels cross-post themselves. That makes Facebook the cheapest channel on the list rather than a third upload.
- **X earns a look for the Japanese side specifically.** It is the dominant social platform in Japan in a way it is nowhere else, and a Japanese-learning audience is genuinely there. Its own account and its own warm-up, so it is a decision rather than an obvious yes.
- **Xiaohongshu is where the Chinese-learning audience actually is, and it is deliberately not on the board.** Registering wants a Chinese phone number, the interface is Chinese-only, and `Platform` has no value for it — a migration for an account that might not be openable from here. Worth revisiting if the Chinese side outgrows TikTok.

## Open

- What the old paywall converted at. Blocking, and the window closes when it is switched off.
- Whether the three free songs survive in front of the $1 week.
- Which of weekly, yearly and lifetime ship, and at what prices.
- Whether iOS is a rewrite or a wrapper, and how the $1 week is expressed under in-app purchase.
- Whether one paying subscriber can say anything useful. n=1, and it is the only positive signal there is.
