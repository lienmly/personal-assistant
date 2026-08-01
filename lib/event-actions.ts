"use server";

import { revalidatePath } from "next/cache";
import type { Recurrence } from "@prisma/client";

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
  revalidatePath("/calendar");
  revalidatePath("/today");
}

function str(form: FormData, key: string): string | null {
  const value = form.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * "YYYY-MM-DD" + "HH:mm" → a real instant in *local* time.
 *
 * `Event.start` and `Event.end` are real timestamps, and both halves of the
 * form mean local wall-clock. Building them with `Date.UTC` — which is right
 * for `Mark.dueDate` two files over — would shift every event by the machine's
 * offset, which is the same bug `slotPublishAt` had (CLAUDE.md §6).
 */
function localAt(day: string, time: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, date, hours || 0, minutes || 0, 0, 0);
}

/** `repeatUntil` *is* a `@db.Date`, so it takes the opposite treatment: UTC
 *  midnight standing in for a local calendar day. */
function dateOnly(value: string | null): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

const RECURRENCES: Recurrence[] = [
  "none",
  "daily",
  "weekdays",
  "weekly",
  "monthly",
];

export async function saveEvent(form: FormData) {
  await requireSession();

  const id = str(form, "id");
  const title = str(form, "title");
  if (!title) throw new Error("An event needs a title");

  const startDay = str(form, "startDay");
  if (!startDay) throw new Error("An event needs a date");

  const allDay = form.get("allDay") === "on" || form.get("allDay") === "true";
  const endDay = str(form, "endDay") ?? startDay;

  if (endDay < startDay) throw new Error("The end is before the start");

  let start: Date;
  let end: Date;

  if (allDay) {
    // Inclusive end — the last instant of the final day. Walking start-day to
    // end-day then yields exactly the days the event occupies, with no
    // off-by-one at either edge. See the note on `Event.end` in the schema.
    start = localAt(startDay, "00:00");
    end = new Date(localAt(endDay, "00:00").getTime() + 86_399_999);
  } else {
    start = localAt(startDay, str(form, "startTime") ?? "09:00");
    end = localAt(endDay, str(form, "endTime") ?? "10:00");
    // A form that refuses to save because the end time is still sitting at its
    // default is worse than one that assumes an hour and lets you fix it.
    if (end.getTime() <= start.getTime()) {
      end = new Date(start.getTime() + 3_600_000);
    }
  }

  const raw = str(form, "recurrence") ?? "none";
  const recurrence: Recurrence = RECURRENCES.includes(raw as Recurrence)
    ? (raw as Recurrence)
    : "none";

  // Both are cleared unless the rule actually uses them. A `daysOfWeek` left
  // behind by a switch from weekly to daily is invisible in the UI and changes
  // what the expansion does the next time it's switched back.
  const daysOfWeek =
    recurrence === "weekly"
      ? form
          .getAll("daysOfWeek")
          .map((value) => Number(value))
          .filter((day) => day >= 1 && day <= 7)
      : [];
  const repeatUntil =
    recurrence === "none" ? null : dateOnly(str(form, "repeatUntil"));

  const projectId = str(form, "projectId");

  // Same rule as `saveMark`: when there's a project, its area wins, so the two
  // can never disagree and the event can't be coloured for an area it's left.
  let areaId = str(form, "areaId");
  if (projectId) {
    const project = await db.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { areaId: true },
    });
    areaId = project.areaId;
  }
  if (!areaId) throw new Error("An event needs an area");

  const data = {
    title,
    notes: str(form, "notes"),
    location: str(form, "location"),
    start,
    end,
    allDay,
    recurrence,
    daysOfWeek,
    repeatUntil,
    areaId,
    projectId,
  };

  const event = id
    ? await db.event.update({ where: { id }, data })
    : await db.event.create({ data });

  refresh();
  return event.id;
}

export async function deleteEvent(eventId: string) {
  await requireSession();
  await db.event.delete({ where: { id: eventId } });
  refresh();
}
