"use server";

import { revalidatePath } from "next/cache";
import type { Prisma, Recurrence, Task, TaskStatus } from "@prisma/client";

import { auth } from "@/lib/auth";
import { addDays, nextOccurrence } from "@/lib/calendar-keys";
import { db } from "@/lib/db";
import { todayKey } from "@/lib/utils";

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
  revalidatePath("/projects");
  // The project page reads tasks, content and momentum, so every one of
  // these actions changes it. A dynamic segment is revalidated by its route
  // pattern, not by each concrete slug.
  revalidatePath("/projects/[slug]", "page");
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

  // Only written when the form actually carries the field. The task panel
  // always does; anything else that saves a task must not silently pull it out
  // of the sprint just by not knowing sprints exist.
  const sprint = form.has("sprintId")
    ? { sprintId: str(form, "sprintId") }
    : {};

  // Same shape as the sprint field above: only written when the form knows
  // about recurrence, so a save from somewhere that doesn't can't quietly turn
  // a repeating task into a one-off.
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
    ...sprint,
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

    if (status === "done" && before.projectId) {
      await tx.project.update({
        where: { id: before.projectId },
        data: { lastTouchedAt: new Date() },
      });
    }
  });

  refresh();
}

/**
 * Ticking a recurring task: write what happened, then re-arm.
 *
 * The snapshot is a real `done` Task rather than a counter, so everything that
 * already reads tasks keeps working — sprint history, the board's recent-done
 * list, "what did I actually get through in July". It carries `recurringId`,
 * which is what tells the two apart.
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
      // reads as Sunday's — which is what the sprint's record should say.
      dueDate: task.dueDate,
      projectId: task.projectId,
      areaId: task.areaId,
      sprintId: task.sprintId,
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
    // than lingering open with a due date it can never reach.
    await tx.task.update({
      where: { id: task.id },
      data: { status: "done", completedAt: new Date(), recurrence: "none" },
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
}

export async function deleteTask(taskId: string) {
  await requireSession();
  await db.task.delete({ where: { id: taskId } });
  refresh();
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
 * It lands in the backlog on the Experiments track, which is where "Next up"
 * already reads ideas from, so a note written on Tuesday surfaces itself the
 * next time the sprint runs dry rather than needing to be remembered.
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
