"use server";

import { revalidatePath } from "next/cache";
import type { Prisma, Recurrence, Task, TaskStatus } from "@prisma/client";

import type { TaskCommentView } from "@/components/board/types";
import { auth } from "@/lib/auth";
import { addDays, nextOccurrence } from "@/lib/calendar-keys";
import { db } from "@/lib/db";
import { localDayKey, todayKey } from "@/lib/utils";

/** Server actions are their own public endpoints — the route guard in the
 *  layout does not cover them, so each one re-checks the session. */
async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Not signed in");
  return session;
}

function refresh() {
  revalidatePath("/board");
  revalidatePath("/today");
  // The project page reads tasks, content and momentum, so every one of
  // these actions changes it. A dynamic segment is revalidated by its route
  // pattern, not by each concrete slug.
  revalidatePath("/projects/[slug]", "page");
  // An area page lists the tasks floating in that area, and has since
  // 2026-08-05. It was missing here, so ticking the Baby area's one task left
  // it looking untouched until a hard reload.
  revalidatePath("/areas/[slug]", "page");
}

function str(form: FormData, key: string): string | null {
  const value = form.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** `<input type="date">` gives "YYYY-MM-DD"; the column is `@db.Date`, so it
 *  has to land on UTC midnight or the day shifts west of Greenwich. */
function dateOnly(value: string | null): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

export async function saveTask(form: FormData) {
  await requireSession();

  const id = str(form, "id");
  const title = str(form, "title");
  if (!title) throw new Error("A task needs a title");

  const projectId = str(form, "projectId");

  // A task always carries an area, even when it hangs off a project — that's
  // what a floating one-off needs, and what supplies the colour. When there is
  // a project, its area wins, so the two can never disagree.
  let areaId = str(form, "areaId");
  if (projectId) {
    const project = await db.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { areaId: true },
    });
    areaId = project.areaId;
  }
  if (!areaId) throw new Error("A task needs a project or an area");

  // Only written when the form knows about recurrence, so a save from
  // somewhere that doesn't can't quietly turn a repeating task into a one-off.
  const repeat = form.has("recurrence")
    ? {
        recurrence: (str(form, "recurrence") ?? "none") as Recurrence,
        daysOfWeek: form
          .getAll("daysOfWeek")
          .map((value) => Number(value))
          .filter((day) => day >= 1 && day <= 7),
        repeatUntil: dateOnly(str(form, "repeatUntil")),
      }
    : {};

  const data = {
    title,
    notes: str(form, "notes"),
    link: str(form, "link"),
    track: str(form, "track"),
    status: (str(form, "status") ?? "open") as TaskStatus,
    dueDate: dateOnly(str(form, "dueDate")),
    projectId,
    areaId,
    ...repeat,
  };

  // A recurring task is *driven* by its due date — that is the day it is for,
  // and what `completeRecurring` advances. Without one it has a rule that
  // never fires: it sits on the board looking scheduled and never appears on
  // Today. Ticking "every Wednesday and Sunday" and leaving the date blank is
  // the obvious thing to do, so the first date is inferred rather than demanded.
  if (data.recurrence && data.recurrence !== "none" && !data.dueDate) {
    const today = todayKey();
    const first = nextOccurrence(
      today,
      data.recurrence,
      data.daysOfWeek ?? [],
      data.repeatUntil?.toISOString().slice(0, 10) ?? null,
      today,
    );
    if (first) data.dueDate = new Date(`${first}T00:00:00.000Z`);
  }

  const task = id
    ? await db.task.update({ where: { id }, data })
    : await db.task.create({ data });

  refresh();
  return task.id;
}

/**
 * The whole point of the board. Completing a task bumps its project's
 * `lastTouchedAt` — the same signal publishing a ContentItem sends — so section 4 of
 * Today measures real movement rather than just posting volume.
 */
export async function setTaskStatus(taskId: string, status: string) {
  await requireSession();

  await db.$transaction(async (tx) => {
    const before = await tx.task.findUniqueOrThrow({ where: { id: taskId } });

    if (status === "done" && before.recurrence !== "none") {
      await completeRecurring(tx, before);
    } else {
      await tx.task.update({
        where: { id: taskId },
        data: {
          status: status as TaskStatus,
          completedAt: status === "done" ? new Date() : null,
        },
      });
    }

    // Ticking the last item of a checklist finishes the job the checklist is
    // *for*. The alternative is a row reading "2/2" that still counts as open,
    // which is the kind of untrue line this app keeps having to delete: there
    // is nothing left to do on it and nothing to press but the parent's own
    // tick, so the app would be asking you to say the same thing twice.
    //
    // On a recurring parent this is the whole flow — tick the Japanese account,
    // tick the Chinese one, and the day is recorded and re-armed for tomorrow.
    if (status === "done" && before.parentId) {
      await completeParentIfFinished(tx, before.parentId);
    }

    if (status === "done" && before.projectId) {
      await tx.project.update({
        where: { id: before.projectId },
        data: { lastTouchedAt: new Date() },
      });
    }
  });

  refresh();
}

/** Nothing left open under it → the parent is done, by whichever route its own
 *  tick would have taken. Silent when anything is still outstanding. */
async function completeParentIfFinished(
  tx: Prisma.TransactionClient,
  parentId: string,
) {
  const remaining = await tx.task.count({
    where: { parentId, status: { not: "done" } },
  });
  if (remaining > 0) return;

  const parent = await tx.task.findUniqueOrThrow({ where: { id: parentId } });
  if (parent.status === "done") return;

  if (parent.recurrence !== "none") {
    await completeRecurring(tx, parent);
  } else {
    await tx.task.update({
      where: { id: parent.id },
      data: { status: "done", completedAt: new Date() },
    });
  }
}

/**
 * Ticking a recurring task: write what happened, then re-arm.
 *
 * The snapshot is a real `done` Task rather than a counter, so everything that
 * already reads tasks keeps working — Today's contribution map, the board's
 * recent-done list, "what did I actually get through in July". It carries
 * `recurringId`, which is what tells the two apart.
 *
 * The live row advances to the next occurrence **after today**, not after its
 * old due date. Advancing from the old date is the obvious version and it is
 * how a daily habit you skipped for a fortnight comes back as fourteen overdue
 * rows — a backlog of days that have already gone. Missing a day is missing a
 * day; the next one is tomorrow.
 */
async function completeRecurring(tx: Prisma.TransactionClient, task: Task) {
  const today = todayKey();
  const anchor = task.dueDate ? task.dueDate.toISOString().slice(0, 10) : today;
  const until = task.repeatUntil
    ? task.repeatUntil.toISOString().slice(0, 10)
    : null;

  await tx.task.create({
    data: {
      title: task.title,
      notes: task.notes,
      link: task.link,
      track: task.track,
      status: "done",
      completedAt: new Date(),
      // The day it was *for*, so a Sunday batch ticked on Monday morning still
      // reads as Sunday's.
      dueDate: task.dueDate,
      projectId: task.projectId,
      areaId: task.areaId,
      recurringId: task.id,
    },
  });

  const next = nextOccurrence(
    addDays(today, 1),
    task.recurrence,
    task.daysOfWeek,
    until,
    anchor,
  );

  if (next === null) {
    // The rule has run out. The live row becomes the last completed one rather
    // than lingering open with a due date it can never reach — and its
    // checklist goes with it, because an open step under a finished job is a
    // row nothing will ever ask you to do again.
    await tx.task.update({
      where: { id: task.id },
      data: { status: "done", completedAt: new Date(), recurrence: "none" },
    });
    await tx.task.updateMany({
      where: { parentId: task.id, status: { not: "done" } },
      data: { status: "done", completedAt: new Date() },
    });
    return;
  }

  await tx.task.update({
    where: { id: task.id },
    data: {
      status: "open",
      completedAt: null,
      dueDate: new Date(`${next}T00:00:00.000Z`),
    },
  });

  // The checklist re-arms with the row it belongs to. Tomorrow's post has not
  // been made, so tomorrow's boxes are empty — and clearing `completedAt` is
  // what keeps the contribution map honest: the day is recorded once, by the
  // snapshot above, rather than once per account posted to.
  await tx.task.updateMany({
    where: { parentId: task.id },
    data: { status: "open", completedAt: null },
  });
}

export async function deleteTask(taskId: string) {
  await requireSession();
  // The checklist goes with it, by the FK's `onDelete: Cascade`. That is the
  // one thing about deleting a parent that has to be true: a subtask left
  // behind would reappear on the board as a loose row reading "TikTok
  // @utaitai_jp", with nothing left to say what it was a step of.
  await db.task.delete({ where: { id: taskId } });
  refresh();
}

/**
 * One more step on a checklist.
 *
 * A single field and no panel, for the reason the idea box and the experiment
 * capture both exist: this is a thing you add *while looking at the list*, and
 * a form that asks for a project, a track and a due date to record "and
 * Instagram too" is a form you close.
 *
 * Everything it needs it takes from the parent — the project, the area and the
 * track are properties of the job, not of the step. It never takes the
 * recurrence: a checklist repeats with the thing it is a checklist for, and a
 * subtask with a rule of its own is a second schedule to disagree with.
 */
export async function addSubtask(parentId: string, title: string) {
  await requireSession();

  const clean = title.trim();
  if (!clean) throw new Error("Give the step a name");

  const parent = await db.task.findUniqueOrThrow({
    where: { id: parentId },
    select: {
      projectId: true,
      areaId: true,
      track: true,
      parentId: true,
      _count: { select: { subtasks: true } },
    },
  });

  // One level, deliberately. A checklist on a checklist item is a tree, and a
  // tree needs a way to collapse, indent and re-parent — none of which the
  // board has, and none of which "post to these accounts" asks for.
  if (parent.parentId) throw new Error("A checklist item can't have its own");

  const step = await db.task.create({
    data: {
      title: clean,
      parentId,
      projectId: parent.projectId,
      areaId: parent.areaId,
      track: parent.track,
      sortOrder: parent._count.subtasks,
    },
  });

  refresh();
  // Returned because the panel holds its own copy of the list and every
  // control on a row addresses it by id. Inventing a placeholder id here is
  // what made the first version throw on removing a step you had just added.
  return step.id;
}

/** Renaming a step in place. The panel is for the job; the step is one line of
 *  text and opening a drawer to change it is more ceremony than it is worth. */
export async function renameSubtask(taskId: string, title: string) {
  await requireSession();

  const clean = title.trim();
  if (!clean) throw new Error("Give the step a name");

  await db.task.update({ where: { id: taskId }, data: { title: clean } });
  refresh();
}

// ── Comments ────────────────────────────────────────────────────────────────
//
// `Task.notes` is what the task *is*; a comment is what *happened* on it. See
// the note on `TaskComment` in the schema for why that is a table rather than
// more text in one field.
//
// None of these calls `refresh()`, deliberately. No server-rendered surface
// reads comments — they live in the panel, which holds its own copy of the list
// exactly as the checklist editor does — so revalidating four routes would be
// re-rendering the whole board to record a sentence nothing on it displays.

/** `createdAt` is a real instant, not a `@db.Date`, so all three of these
 *  format in **local** time — the opposite rule from `dueDate` twenty lines up
 *  (CLAUDE.md §6, "Dates are a trap here"). */
const commentTime = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});
const commentDay = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});
const commentDayYear = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const commentFull = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "Today, 14:32" · "10 Aug, 09:05" · "3 Nov 2025, 21:40".
 *
 *  The time is always shown, because a comment's whole claim is that it was
 *  written at a moment. The year is only shown once it stops being this one —
 *  on a thread written this week it is four characters of noise on every row. */
function commentStamp(at: Date, today = todayKey()): string {
  const day = localDayKey(at);
  const label =
    day === today
      ? "Today"
      : at.getFullYear() === new Date().getFullYear()
        ? commentDay.format(at)
        : commentDayYear.format(at);
  return `${label}, ${commentTime.format(at)}`;
}

/**
 * A task's comments, oldest first.
 *
 * Oldest first because a thread is read *forwards* — it is the same argument
 * the journal settled on 2026-08-06 (§6, "A day is a thread"): a list of things
 * is newest-first, and a sequence of things that happened to one object is not
 * a list, it is an order.
 *
 * Fetched when the panel opens rather than carried on `TaskView`, because the
 * board holds ninety of those and renders none of this. Same bargain as "only
 * the active tab's heavy read runs" on a project page.
 */
export async function getTaskComments(
  taskId: string,
): Promise<TaskCommentView[]> {
  await requireSession();

  const rows = await db.taskComment.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
    select: { id: true, body: true, createdAt: true },
  });

  const today = todayKey();
  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    when: commentStamp(row.createdAt, today),
    at: commentFull.format(row.createdAt),
  }));
}

/**
 * Add one.
 *
 * The stamp is the database's `now()` and is never taken from the form — a time
 * the client supplies is a time that can be chosen, and a comment thread is only
 * worth reading back because its order came from a clock (§6, "The date is not
 * a field"). It is returned already formatted so the panel can show the new row
 * without a round trip and without a second copy of the formatting.
 */
export async function addComment(
  taskId: string,
  body: string,
): Promise<TaskCommentView> {
  await requireSession();

  const clean = body.trim();
  if (!clean) throw new Error("Write something first");

  const comment = await db.taskComment.create({
    data: { taskId, body: clean },
    select: { id: true, body: true, createdAt: true },
  });

  return {
    id: comment.id,
    body: comment.body,
    when: commentStamp(comment.createdAt),
    at: commentFull.format(comment.createdAt),
  };
}

/** Remove one. There is no edit: a comment is a record of a moment, and the
 *  honest fix for one that came out wrong is to delete it and say the thing
 *  again — which is stamped with when you actually said it. */
export async function deleteComment(commentId: string) {
  await requireSession();
  await db.taskComment.delete({ where: { id: commentId } });
}

/**
 * Somewhere to put an idea, from the screen you already have open.
 *
 * The Hunt Board's capture box wants a link, because it exists for "try this
 * format" — the link *is* the task there. This one wants nothing but a
 * sentence, because the ideas that get lost are the ones you have while doing
 * something else, and any field beyond the first is enough friction to lose
 * them.
 *
 * It lands on the Experiments track with no project, so it shows up on Today
 * under "One-offs" — visible without being filed, which is the point: filing
 * it is a decision for later, and demanding one now is how the thought is lost.
 */
export async function captureIdea(form: FormData) {
  await requireSession();

  const title = str(form, "title");
  if (!title) throw new Error("Write the idea down first");

  const projectId = str(form, "projectId");
  const project = projectId
    ? await db.project.findUniqueOrThrow({
        where: { id: projectId },
        select: { areaId: true },
      })
    : null;

  // Every task needs an area even without a project (§6). Falling back to the
  // first one is right here: an idea with nowhere to go is still worth more
  // than a form that refuses to save it.
  const areaId =
    project?.areaId ??
    str(form, "areaId") ??
    (await db.area.findFirstOrThrow({ orderBy: { sortOrder: "asc" } })).id;

  await db.task.create({
    data: { title, projectId, areaId, track: "Experiments" },
  });

  refresh();
}

/**
 * The viral-format capture. Finding a post worth copying happens while
 * scrolling on a phone — it has to be one paste and one tap, or it won't
 * happen at all, and the idea is gone by evening.
 */
export async function captureExperiment(form: FormData) {
  await requireSession();

  const link = str(form, "link");
  const title = str(form, "title") ?? "Try this format";
  const projectId = str(form, "projectId");
  if (!link) throw new Error("Paste the link to the post you want to try");

  const project = projectId
    ? await db.project.findUniqueOrThrow({
        where: { id: projectId },
        select: { areaId: true },
      })
    : null;

  const areaId = project?.areaId ?? str(form, "areaId");
  if (!areaId) throw new Error("Pick a project or an area");

  await db.task.create({
    data: { title, link, projectId, areaId, track: "Experiments" },
  });

  refresh();
}
