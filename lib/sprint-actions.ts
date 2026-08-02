"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/** Server actions are their own public endpoints — the route guard in the
 *  layout does not cover them, so each one re-checks the session. */
async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Not signed in");
  return session;
}

function refresh() {
  revalidatePath("/today");
  revalidatePath("/board");
  revalidatePath("/projects");
}

function str(form: FormData, key: string): string | null {
  const value = form.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** "YYYY-MM-DD" → UTC midnight, which is where a `@db.Date` column keeps the
 *  local calendar day it stands for (CLAUDE.md §6). */
function dateOnly(value: string | null): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Start a sprint, closing whatever was running.
 *
 * One active sprint at a time is the entire point — two would put Today back in
 * the business of merging lists, which is the thing the sprint exists to stop.
 * Closing the outgoing one returns its unfinished tasks to the backlog: see
 * `closeSprint`.
 */
export async function startSprint(form: FormData) {
  await requireSession();

  const name = str(form, "name");
  const startsOn = dateOnly(str(form, "startsOn"));
  const endsOn = dateOnly(str(form, "endsOn"));

  if (!name) throw new Error("Give the sprint a name");
  if (!startsOn || !endsOn) throw new Error("A sprint needs both dates");
  if (endsOn < startsOn) throw new Error("The end date is before the start");

  const id = str(form, "id");

  // Editing the running sprint is a different job from starting a new one, and
  // it must not close anything or move any tasks.
  if (id) {
    await db.sprint.update({
      where: { id },
      data: { name, goal: str(form, "goal"), startsOn, endsOn },
    });
    refresh();
    return id;
  }

  const sprint = await db.$transaction(async (tx) => {
    const outgoing = await tx.sprint.findMany({
      where: { status: "active" },
      select: { id: true },
    });

    if (outgoing.length > 0) {
      const ids = outgoing.map((row) => row.id);
      await tx.task.updateMany({
        where: { sprintId: { in: ids }, status: { not: "done" } },
        data: { sprintId: null },
      });
      await tx.sprint.updateMany({
        where: { id: { in: ids } },
        data: { status: "done", closedAt: new Date() },
      });
    }

    return tx.sprint.create({
      data: {
        name,
        goal: str(form, "goal"),
        startsOn,
        endsOn,
        status: "active",
      },
    });
  });

  refresh();
  return sprint.id;
}

/**
 * Close a sprint and hand its unfinished work back to the backlog.
 *
 * Rolling the leftovers into the next sprint is the obvious alternative and it
 * is how a sprint quietly becomes a second, permanent to-do list: the unfinished
 * things accumulate, next week starts full, and the commitment stops meaning
 * anything. Finished tasks keep their `sprintId` — that's the record of what the
 * week actually produced.
 */
export async function closeSprint(sprintId: string) {
  await requireSession();

  await db.$transaction(async (tx) => {
    await tx.task.updateMany({
      where: { sprintId, status: { not: "done" } },
      data: { sprintId: null },
    });
    await tx.sprint.update({
      where: { id: sprintId },
      data: { status: "done", closedAt: new Date() },
    });
  });

  refresh();
}

/** Pull a task into the running sprint, or push it back to the backlog.
 *  `sprintId: null` is the push. */
export async function setTaskSprint(markId: string, sprintId: string | null) {
  await requireSession();
  await db.task.update({ where: { id: markId }, data: { sprintId } });
  refresh();
}

/** Sprint planning in bulk — ticking eight tasks one round-trip at a time is
 *  how planning stops happening. */
export async function addTasksToSprint(markIds: string[], sprintId: string) {
  await requireSession();
  if (markIds.length === 0) return;
  await db.task.updateMany({
    where: { id: { in: markIds } },
    data: { sprintId },
  });
  refresh();
}
