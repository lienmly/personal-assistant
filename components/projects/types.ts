import type { ProjectPriority, ProjectStatus } from "@prisma/client";

/** Plain view types, for the same reason as `components/board/types.ts`:
 *  re-exporting the query's inferred type would drag `lib/db` into a client
 *  bundle. */

export type AreaOption = { id: string; name: string; color: string };

/**
 * Exactly the columns `ProjectPanel` edits, and nothing else.
 *
 * This replaced the wider `ProjectRowView` on 2026-08-05, when the roster page
 * was folded into Today (CLAUDE.md §6, "The roster folded into Today"). The
 * roster carried counts and a preformatted touched label because it *displayed*
 * a project; Today already has both on its own card, so making the panel demand
 * them would have meant Today assembling a shape it has no other use for.
 */
export type ProjectEditView = {
  id: string;
  name: string;
  description: string | null;
  /** The one thing this project is aiming at right now. Distinct from
   *  `description`: what it is, versus what it is *for* this month. */
  focus: string | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  cadenceDays: number | null;
  areaId: string;
};

/**
 * A paused or archived project, as the disclosure at the foot of Today's
 * projects card lists it.
 *
 * These are deliberately not on the card proper: a paused project is parked,
 * and listing it every morning is how a dashboard starts generating guilt. But
 * they cannot be *unreachable* either — this is the only way back to one, and
 * un-archiving is the whole reason the row is clickable.
 */
export type DormantProjectView = ProjectEditView & {
  areaColor: string;
  /** Preformatted server-side — a client `Intl` call would format in the
   *  browser's zone and disagree with the server's first paint. */
  touchedLabel: string;
};
