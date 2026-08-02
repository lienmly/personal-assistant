"use server";

import { revalidatePath } from "next/cache";
import type { TaskStatus } from "@prisma/client";

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
  };

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
    const task = await tx.task.update({
      where: { id: taskId },
      data: {
        status: status as TaskStatus,
        completedAt: status === "done" ? new Date() : null,
      },
    });

    if (status === "done" && task.projectId) {
      await tx.project.update({
        where: { id: task.projectId },
        data: { lastTouchedAt: new Date() },
      });
    }
  });

  refresh();
}

export async function deleteTask(taskId: string) {
  await requireSession();
  await db.task.delete({ where: { id: taskId } });
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
