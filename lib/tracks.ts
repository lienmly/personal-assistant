/**
 * Workstreams within a project. Its own module, free of any `lib/db` import,
 * because the Hunt Board and the task panel are client bundles and pulling
 * Prisma into one is a build error.
 *
 * Offered as datalist suggestions rather than enforced as an enum: a project
 * invents a new stream far more often than that would justify a migration, and
 * an unrecognised value has to render fine regardless.
 *
 * This order is the order tracks appear on the board; anything not listed sorts
 * after, alphabetically.
 */
export const TRACKS = [
  // "Setup" leads because it is the work that unblocks everything else — a brand
  // with no e-mail account has no TikTok, and so has no content and no audience.
  // It empties out once a project is running, which is exactly right.
  "Setup",
  "Build",
  "Art",
  // Added 2026-08-05 with Sleepy Cat's polish pass. It sits beside "Art" rather
  // than inside it for the reason "Art" was split out of "Ship" in the first
  // place: it is somebody else's work on somebody else's schedule, and folding
  // it in hides that a third of the polish isn't mine to do. A cozy puzzle game
  // is carried by its audio more than its code, and "polish the game" as one row
  // is how the soundtrack gets noticed in February.
  "Audio",
  "Ship",
  // Added 2026-08-05 when Sleepy Cat aimed at the October Next Fest. A track
  // standing in for a **milestone**, which is a noun this app does not have and
  // probably should not grow one for: a milestone is a date plus the set of work
  // that has to be true by it, and a track already groups work while an Event
  // already holds the date. It sits after "Ship" because everything in it is
  // gated on Steam admin that has to be done first.
  //
  // Unlike every other track here, this one is expected to *disappear* — it is
  // for one week in October and is meaningless afterwards. That is fine; "Setup"
  // empties out too. If a second game ever does this, the track gets reused.
  // Added 2026-08-05. Separate from "Next Fest" on purpose: that track is one
  // event with a readiness chain and a hard week attached, this one is a rolling
  // queue of submissions with their own deadlines. Folding them together would
  // bury the fest's chain under a dozen application rows.
  "Festivals",
  "Next Fest",
  // Added 2026-08-03 with Utaitai's subscription change. Deliberately not
  // "Money" — that word is about to mean the Ledger (Phase 6), which is
  // household finances and a different thing entirely. This is the product's
  // own revenue: pricing, checkout, entitlement, the paywall. It sits after
  // "Ship" because it is product work, and before the two tracks about
  // courting people, which is work you do once there is something to charge for.
  "Monetization",
  "Users",
  "Marketing",
  // Added 2026-08-05 with Forge. The same shape as "Next Fest" — a track
  // standing in for a milestone, which is a date plus the work that has to be
  // true by it — with one difference that matters: there is no single date.
  // YC runs four batches a year on a rolling application, so this is a
  // readiness list that gets re-run every quarter rather than a countdown, and
  // the deadline it aims at moves each cycle. It sorts after "Marketing"
  // because everything in it is gated on the audience, the prototype and the
  // interviews existing first.
  "YC",
  "Experiments",
  "Content",
  // The Baby area's streams. They sort last on purpose: this order is the
  // order tracks appear on the board for *every* project, and a language
  // shouldn't outrank "Ship" on Sleepy Cat just because it was added later.
  "Vietnamese",
  "English",
  "Russian",
] as const;

/** Widened to `string` on purpose — `track` is free text, so the lookup key is
 *  routinely a name that isn't on the list above. */
const TRACK_ORDER = new Map<string, number>(
  TRACKS.map((name, index) => [name, index]),
);

export function trackRank(track: string | null): number {
  if (!track) return TRACKS.length + 1; // untracked tasks sink to the bottom
  return TRACK_ORDER.get(track) ?? TRACKS.length;
}
