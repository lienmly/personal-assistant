import type { TaskView } from "@/components/board/types";
import { todayKey } from "@/lib/utils";

/**
 * The one place a Task row becomes a `TaskView`.
 *
 * The Hunt Board and the project page both do this, and when they each did it
 * inline they had already drifted — the board flagged a *completed* task as
 * overdue because it only compared dates. Two copies of date handling is
 * exactly the trap CLAUDE.md §6 warns about.
 *
 * No `lib/db` import: this takes a plain shape, so a page can hand it whatever
 * its own `select` produced.
 */

/** `dueDate` is a `@db.Date`, which Prisma returns as UTC midnight standing in
 *  for a local calendar day. Formatting it in UTC is what stops it rendering a
 *  day early west of Greenwich. */
const dueFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export type TaskRowInput = {
  id: string;
  title: string;
  notes: string | null;
  link: string | null;
  track: string | null;
  status: TaskView["status"];
  dueDate: Date | null;
  sprintId: string | null;
  projectId: string | null;
  areaId: string;
  recurrence: TaskView["recurrence"];
  daysOfWeek: number[];
  repeatUntil: Date | null;
  _count?: { occurrences: number };
};

/** The columns every caller has to select for `toTaskView` to work. Exported so
 *  a query and its mapper can't fall out of step. */
export const TASK_VIEW_SELECT = {
  id: true,
  title: true,
  notes: true,
  link: true,
  track: true,
  status: true,
  dueDate: true,
  sprintId: true,
  projectId: true,
  areaId: true,
  recurrence: true,
  daysOfWeek: true,
  repeatUntil: true,
  _count: { select: { occurrences: true } },
} as const;

export function toTaskView(task: TaskRowInput, today = todayKey()): TaskView {
  // Slicing the ISO string is the only read that doesn't shift the day in a
  // negative-offset zone — `getDate()` would return yesterday for most of the
  // evening in Los Angeles.
  const dueDate = task.dueDate?.toISOString().slice(0, 10) ?? null;

  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    link: task.link,
    track: task.track,
    status: task.status,
    dueDate,
    dueLabel: task.dueDate
      ? dueDate === today
        ? "Today"
        : dueFormat.format(task.dueDate)
      : null,
    // A done task is never overdue. It was, and then it wasn't.
    overdue: dueDate !== null && dueDate < today && task.status !== "done",
    sprintId: task.sprintId,
    projectId: task.projectId,
    areaId: task.areaId,
    recurrence: task.recurrence,
    daysOfWeek: task.daysOfWeek,
    repeatUntil: task.repeatUntil?.toISOString().slice(0, 10) ?? "",
    doneCount: task._count?.occurrences ?? 0,
  };
}

const DAY_LETTERS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** "Wed & Sun", "Daily", "Weekdays" — the badge on a repeating row. */
export function repeatLabel(task: {
  recurrence: string;
  daysOfWeek: number[];
}): string | null {
  switch (task.recurrence) {
    case "daily":
      return "Daily";
    case "weekdays":
      return "Weekdays";
    case "monthly":
      return "Monthly";
    case "weekly": {
      if (task.daysOfWeek.length === 0) return "Weekly";
      const names = [...task.daysOfWeek].sort().map((day) => DAY_LETTERS[day]);
      return names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;
    }
    default:
      return null;
  }
}
