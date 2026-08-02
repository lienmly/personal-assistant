/**
 * Kinds of document. Its own module, free of any `lib/db` import, because the
 * doc editor is a client bundle and pulling Prisma into one is a build error —
 * the same reason `lib/tracks.ts` exists.
 *
 * Offered as datalist suggestions rather than enforced as an enum, for the same
 * reason `Mark.track` is free text: "Pitch", "Brand voice", "Postmortem" are
 * all obviously docs and none of them should cost a migration.
 *
 * This order is the order docs sort within a project.
 */
export const DOC_KINDS = [
  // Vision leads because it is the one you re-read. The rest are downstream of
  // it — a strategy with no vision above it is just a list of tactics.
  "Vision",
  "Northstar",
  "Strategy",
  "Research",
  "Brief",
  "Notes",
] as const;

/** Widened to `string` on purpose — `kind` is free text, so the lookup key is
 *  routinely a name that isn't on the list above. */
const KIND_ORDER = new Map<string, number>(
  DOC_KINDS.map((name, index) => [name, index]),
);

export function kindRank(kind: string | null): number {
  if (!kind) return DOC_KINDS.length + 1; // unlabelled docs sink to the bottom
  return KIND_ORDER.get(kind) ?? DOC_KINDS.length;
}
