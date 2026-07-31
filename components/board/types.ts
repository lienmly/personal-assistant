import type { MarkStatus, ProjectStatus } from "@prisma/client";

/** Plain view types, for the same reason as `components/studio/types.ts`:
 *  re-exporting the query's inferred type would drag `lib/db` into a client
 *  bundle. */

export type AreaView = { id: string; name: string; color: string };

export type BoardProjectView = {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  area: AreaView;
};

export type MarkView = {
  id: string;
  title: string;
  notes: string | null;
  link: string | null;
  track: string | null;
  status: MarkStatus;
  /** "YYYY-MM-DD", for `<input type="date">` to round-trip without a zone. */
  dueDate: string | null;
  /** Preformatted server-side — see the note in `components/studio/types.ts`. */
  dueLabel: string | null;
  overdue: boolean;
  projectId: string | null;
  areaId: string;
};
