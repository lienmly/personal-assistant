import type { ProjectEditView } from "@/components/projects/types";
import { addDays, startOfWeek } from "@/lib/calendar-keys";
import { db } from "@/lib/db";
import { daysSince } from "@/lib/projects";
import { TOP_LEVEL_ONLY } from "@/lib/task-view";
import { localDayKey, todayKey } from "@/lib/utils";

/**
 * Today, rebuilt project-first on 2026-08-04.
 *
 * It used to read the sprint: one flat list of the week's committed handful,
 * ordered so the top row was "the answer". That was the right shape for a
 * screen whose question is *what should I do next*, and the wrong shape for the
 * question actually being asked each morning — **what have I got on, and which
 * of it do I feel like doing today**. With four projects running concurrently
 * and a baby setting the schedule, a single ranked list flattens the one
 * distinction that matters (which project a row belongs to) and replaces a
 * choice with an instruction.
 *
 * So the unit here is the *project*, not the task. Each one arrives with its
 * focus line and its few most pressing rows, and picking is left to the person
 * reading. Nothing counts down, nothing reports you behind: the sprint's pace
 * metric was the specific thing that turned a dashboard into a reprimand on the
 * days the baby won.
 */

const boardSelect = {
  id: true,
  title: true,
  notes: true,
  link: true,
  track: true,
  status: true,
  dueDate: true,
  sortOrder: true,
  recurrence: true,
  daysOfWeek: true,
  project: { select: { id: true, name: true, slug: true } },
  area: { select: { name: true, color: true } },
  // Single-object `orderBy` — see the note on `TASK_VIEW_SELECT`.
  subtasks: {
    select: { id: true, title: true, status: true },
    orderBy: { sortOrder: "asc" },
  },
} as const;

/** `@db.Date` → "YYYY-MM-DD". Read in UTC because that is where Prisma puts the
 *  local calendar day it stands for (CLAUDE.md §6). */
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Why a row is near the top of its project. Drives the badge, and nothing
 *  else — there is no cross-project ranking any more. */
export type TaskReason = "doing" | "overdue" | "today" | "soon" | "open";

const RANK: Record<TaskReason, number> = {
  doing: 0,
  overdue: 1,
  today: 2,
  soon: 3,
  open: 4,
};

function reasonFor(
  status: string,
  due: string | null,
  today: string,
  soon: string,
): TaskReason {
  if (status === "doing") return "doing";
  if (due === null) return "open";
  if (due < today) return "overdue";
  if (due === today) return "today";
  return due <= soon ? "soon" : "open";
}

/**
 * A repeating row is on Today only on the day it is *for*.
 *
 * Ticking a recurring task doesn't finish it, it advances it — so without this
 * a daily job reappears the instant it is done, dated tomorrow, on the screen
 * you opened to see what is left. It reads exactly like something still owed.
 * The Wed & Sun batch seen on a Monday is the same fault a size up: it is not
 * late, it is not today's, and a row you have to re-decide about every morning
 * is precisely the pressure this screen keeps having to take out (§6, "The
 * sprint"). It is also the fourth instance of the app's recurring error —
 * asserting something nobody said — here in the form of a date the task itself
 * disagrees with.
 *
 * Three things still show, each because hiding them would lose real
 * information:
 *
 * - **Overdue.** A missed day is a fact, and one you asked for.
 * - **`doing`.** That is you saying you are on it now, and the app does not get
 *   to argue with an explicit press.
 * - **A recurring row with no due date**, which is a rule that never fires
 *   (`saveTask` infers one, so it should not exist). Making a broken row
 *   invisible is worse than showing it.
 *
 * Deliberately Today-only. The Hunt Board and a project page are the complete
 * list in full, and hiding tomorrow's occurrence there would mean a project
 * could look empty when it isn't.
 */
function dueByToday(
  task: { recurrence: string; status: string; due: string | null },
  today: string,
): boolean {
  if (task.recurrence === "none") return true;
  if (task.status === "doing") return true;
  return task.due === null || task.due <= today;
}

export type ProjectBoard = Awaited<ReturnType<typeof getProjectBoards>>[number];

/**
 * Identity, but it *declares* the nullable type — which a plain annotation
 * cannot do here.
 *
 * `const edit: ProjectEditView | null = { … }` is narrowed straight back to
 * non-null by control-flow analysis, so the board rows would infer
 * `edit: ProjectEditView` and the "One-offs" pseudo-board below — which has no
 * project row behind it and so nothing to edit — would fail to match the
 * element type. A function's *return* type is not narrowed at the call site.
 */
const nullable = (project: ProjectEditView): ProjectEditView | null => project;

/**
 * Every project you are actually running, each with its few most pressing rows.
 *
 * **A project with nothing open still appears.** That is deliberate and it is
 * the main thing this differs from a task list: "Forge has nothing queued" is
 * information — it is the prompt to put something there — and a project that
 * silently vanishes the moment its last task is ticked is one you forget you
 * own. The empty state on the card says so in words.
 *
 * Ordering is `priority` then `sortOrder`, and deliberately *not* anything
 * dynamic like drift or due dates. This screen is read by scanning, and a list
 * that reshuffles itself overnight has to be re-read from the top every
 * morning; a stable one is learned once. The urgency lives inside each card,
 * where it is cheap to spot, rather than in the order of the cards.
 */
export async function getProjectBoards(perProject = 5) {
  const today = todayKey();
  // "Coming up" reaches a week out. Far enough that a Friday deadline is
  // visible on Monday, near enough that it doesn't swallow the whole backlog.
  const soon = addDays(today, 7);

  const [projects, tasks] = await Promise.all([
    db.project.findMany({
      // Paused and archived projects are not "what I have on". A paused project
      // is parked, and listing it every morning is how a dashboard starts
      // generating guilt rather than removing it.
      where: { status: { in: ["active", "simmering"] } },
      orderBy: [{ priority: "asc" }, { sortOrder: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        focus: true,
        status: true,
        priority: true,
        cadenceDays: true,
        areaId: true,
        lastTouchedAt: true,
        area: { select: { name: true, color: true } },
      },
    }),
    db.task.findMany({
      where: {
        status: { not: "done" },
        // A recurring task is one live row plus a completed snapshot per
        // occurrence. Without the first half of this filter a daily habit
        // appears once for every time it has ever been ticked; without the
        // second, a checklist item appears as a task beside the row that
        // renders it (CLAUDE.md §6).
        ...TOP_LEVEL_ONLY,
      },
      select: boardSelect,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const byProject = new Map<string, typeof tasks>();
  for (const task of tasks) {
    const key = task.project?.id ?? "unfiled";
    const bucket = byProject.get(key);
    if (bucket) bucket.push(task);
    else byProject.set(key, [task]);
  }

  const shape = (rows: typeof tasks) =>
    rows
      .map((task) => {
        const due = task.dueDate ? dayKey(task.dueDate) : null;
        return { ...task, due, reason: reasonFor(task.status, due, today, soon) };
      })
      .sort(
        (a, b) =>
          RANK[a.reason] - RANK[b.reason] ||
          (a.dueDate?.getTime() ?? Infinity) -
            (b.dueDate?.getTime() ?? Infinity) ||
          a.sortOrder - b.sortOrder,
      );

  const boards = projects.map((project) => {
    const all = shape(byProject.get(project.id) ?? []);
    const rows = all.filter((task) => dueByToday(task, today));
    const idle = daysSince(project.lastTouchedAt);

    // Everything the settings panel edits, carried on the card so the pencil
    // can open it without a second round trip. Since 2026-08-05 this is the
    // only way in — the roster page it used to live on is gone.
    const edit = nullable({
      id: project.id,
      name: project.name,
      description: project.description,
      focus: project.focus,
      status: project.status,
      priority: project.priority,
      cadenceDays: project.cadenceDays,
      areaId: project.areaId,
    });

    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      focus: project.focus,
      priority: project.priority,
      areaName: project.area.name,
      areaColor: project.area.color,
      idle,
      // Folded in from the old Momentum card, which is now redundant: a
      // separate list of every project's last-touched date, sitting beside a
      // list of every project, was the same information twice.
      touchedLabel:
        idle === 0 ? "Touched today" : idle === 1 ? "Yesterday" : `${idle}d ago`,
      drifting:
        project.status === "active" &&
        project.cadenceDays !== null &&
        idle > project.cadenceDays,
      edit,
      tasks: rows.slice(0, perProject),
      // The *whole* backlog, not what survived `dueByToday`, so the "N more →"
      // link still says a repeating row is waiting for its day rather than
      // pretending the project is empty.
      openTotal: all.length,
      // Counted across the whole project rather than the visible slice, so the
      // card can say "2 overdue" even when both are below the fold.
      overdue: all.filter((task) => task.reason === "overdue").length,
    };
  });

  // One-offs that belong to no project. Appended rather than sorted in: it is a
  // catch-all, not a project, and it should never lead the screen.
  const unfiled = shape(byProject.get("unfiled") ?? []);
  const unfiledToday = unfiled.filter((task) => dueByToday(task, today));
  if (unfiled.length > 0) {
    boards.push({
      id: "unfiled",
      name: "One-offs",
      slug: "",
      description: null,
      focus: null,
      priority: "later" as const,
      areaName: unfiled[0].area.name,
      areaColor: unfiled[0].area.color,
      idle: 0,
      touchedLabel: "",
      drifting: false,
      // Not a project, so there is nothing to edit and no pencil on the card.
      edit: null,
      tasks: unfiledToday.slice(0, perProject),
      openTotal: unfiled.length,
      overdue: unfiled.filter((task) => task.reason === "overdue").length,
    });
  }

  return boards;
}

/**
 * What you ticked off, per day, for the last twenty-six weeks.
 *
 * A contribution map rather than a running total, because the useful fact on a
 * hard week is not "you did fewer" — it is that the row is unbroken. Recurring
 * snapshots are counted: reading her a Vietnamese book on thirty days is thirty
 * things done, and collapsing them to the one live row would make the habits
 * that are easiest to keep the ones that show up least.
 *
 * Checklist items are the one thing excluded, and it is the opposite call from
 * the recurring snapshots for a reason that survives saying out loud: thirty
 * days of reading to her is thirty *days*, but posting to three accounts this
 * morning is one morning. Counting the steps would make a job look bigger for
 * having been broken up, which is a metric you can game by writing longer
 * checklists. The job itself still counts, once, when its last box is ticked.
 *
 * `completedAt` is a real timestamp, so it reduces to a **local** day key. The
 * grid then indexes on strings and never touches a `Date` again — the same
 * trick the calendar uses to make three date conventions agree on a cell.
 */
export async function getCompletionMap(weeks = 26) {
  const today = todayKey();
  // Whole weeks, ending with the one containing today, so the grid is a clean
  // 7-row rectangle with no ragged final column.
  const from = addDays(startOfWeek(today), -(weeks - 1) * 7);

  const done = await db.task.findMany({
    where: {
      status: "done",
      parentId: null,
      completedAt: { gte: new Date(`${from}T00:00:00.000`) },
    },
    select: {
      id: true,
      title: true,
      completedAt: true,
      track: true,
      project: { select: { name: true, slug: true } },
      area: { select: { color: true } },
    },
    orderBy: { completedAt: "desc" },
  });

  const counts = new Map<string, number>();
  for (const task of done) {
    if (!task.completedAt) continue;
    const key = localDayKey(task.completedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const days: { key: string; count: number }[] = [];
  for (let day = from; day <= today; day = addDays(day, 1)) {
    days.push({ key: day, count: counts.get(day) ?? 0 });
  }

  // Trailing empty days of the current week, so the last column is full height
  // and the grid doesn't appear to have lost its bottom-right corner.
  const end = addDays(startOfWeek(today), 6);
  for (let day = addDays(today, 1); day <= end; day = addDays(day, 1)) {
    days.push({ key: day, count: -1 });
  }

  const todayList = done.filter(
    (task) => task.completedAt && localDayKey(task.completedAt) === today,
  );

  return {
    days,
    weeks,
    total: done.length,
    todayCount: todayList.length,
    todayList: todayList.map((task) => ({
      id: task.id,
      title: task.title,
      projectName: task.project?.name ?? null,
      track: task.track,
      color: task.area.color,
    })),
    // The current run of consecutive days with at least one thing ticked,
    // counted backwards from today. Today not yet having one does not break it
    // — at 7am it never would, and a streak that resets every midnight is a
    // streak nobody can hold.
    streak: (() => {
      let run = 0;
      let cursor = counts.get(today) ? today : addDays(today, -1);
      while ((counts.get(cursor) ?? 0) > 0) {
        run += 1;
        cursor = addDays(cursor, -1);
      }
      return run;
    })(),
  };
}
