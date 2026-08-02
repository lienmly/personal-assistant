import type {
  TaskStatus,
  ProjectPriority,
  ProjectStatus,
} from "@prisma/client";

/** Plain view types, for the same reason as `components/studio/types.ts`:
 *  re-exporting the query's inferred type would drag `lib/db` into a client
 *  bundle. */

export type AreaView = { id: string; name: string; color: string };

export type BoardProjectView = {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  /** Decides which sections the board opens expanded, and what the scope pills
   *  filter on. See `ProjectPriority` in the schema. */
  priority: ProjectPriority;
  areaId: string;
  area: AreaView;
};

export type TaskView = {
  id: string;
  title: string;
  notes: string | null;
  link: string | null;
  track: string | null;
  status: TaskStatus;
  /** "YYYY-MM-DD", for `<input type="date">` to round-trip without a zone. */
  dueDate: string | null;
  /** Preformatted server-side — see the note in `components/studio/types.ts`. */
  dueLabel: string | null;
  overdue: boolean;
  /** The running sprint's id when this task is committed to it, else null. */
  sprintId: string | null;
  projectId: string | null;
  areaId: string;
};
