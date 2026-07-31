/**
 * Workstreams within a project. Its own module, free of any `lib/db` import,
 * because the Hunt Board and the mark panel are client bundles and pulling
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
  "Ship",
  "Users",
  "Marketing",
  "Experiments",
  "Content",
] as const;

/** Widened to `string` on purpose — `track` is free text, so the lookup key is
 *  routinely a name that isn't on the list above. */
const TRACK_ORDER = new Map<string, number>(
  TRACKS.map((name, index) => [name, index]),
);

export function trackRank(track: string | null): number {
  if (!track) return TRACKS.length + 1; // untracked marks sink to the bottom
  return TRACK_ORDER.get(track) ?? TRACKS.length;
}
