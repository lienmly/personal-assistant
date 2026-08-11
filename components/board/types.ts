import type {
  Recurrence,
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

/**
 * One step of a checklist. Deliberately three fields out of a Task's twenty:
 * the project, the area, the track and the due date all belong to the job it
 * hangs off, and repeating them on every step is how a two-line checklist
 * starts rendering like four more tasks.
 */
export type SubtaskView = {
  id: string;
  title: string;
  status: TaskStatus;
};

/**
 * One dated note on a task.
 *
 * `when` is preformatted server-side, like every other date label in this app —
 * `createdAt` is a real instant, so it formats in **local** time, and doing it
 * on the client would render it twice from two clocks. `at` is the full stamp,
 * for the `title` on hover: the label says "Today, 14:32" because that is what
 * you want to read, and the exact day is one hover away when you are reading a
 * thread back months later.
 */
export type TaskCommentView = {
  id: string;
  body: string;
  when: string;
  at: string;
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
  projectId: string | null;
  areaId: string;

  /** `"none"` for an ordinary task. Anything else and ticking it re-arms the
   *  row for its next day rather than finishing it — see `completeRecurring`. */
  recurrence: Recurrence;
  /** ISO weekdays for a `weekly` rule, 1 = Monday … 7 = Sunday. */
  daysOfWeek: number[];
  /** "YYYY-MM-DD", or "" — the date input round-trips it without a zone. */
  repeatUntil: string;
  /** How many times this has been completed. Only meaningful when recurring;
   *  it is what makes a habit feel like it is going somewhere. */
  doneCount: number;

  /** The checklist under this row, in order. Empty for most tasks — a job that
   *  is done in one place does not need to be broken into the one place. */
  subtasks: SubtaskView[];
};
