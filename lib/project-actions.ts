"use server";

import { revalidatePath } from "next/cache";
import type { ProjectPriority, ProjectStatus } from "@prisma/client";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { slugify } from "@/lib/utils";

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Not signed in");
  return session;
}

/**
 * `"layout"` rather than a list of pages, unlike the other action files.
 *
 * The area tree in the sidebar is rendered by `app/(app)/layout.tsx`, so a new
 * project that only revalidated `/today` would appear on its cards and *not*
 * in the sidebar until a full reload — which reads as the save having half
 * failed. Creating and renaming projects is rare enough that the wider
 * invalidation costs nothing.
 */
function refresh() {
  revalidatePath("/", "layout");
}

function str(form: FormData, key: string): string | null {
  const value = form.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Slugs are minted once, on create, and never follow a rename.
 *
 * `prisma/seed.ts` upserts every project on its slug, so a slug that drifted
 * with the name would make the next seed run *create a second row* rather than
 * find the existing one — the project would silently fork in two. The name is
 * the label; the slug is the identity.
 */
async function mintSlug(name: string): Promise<string> {
  const base = slugify(name) || "project";
  const taken = new Set(
    (
      await db.project.findMany({
        where: { slug: { startsWith: base } },
        select: { slug: true },
      })
    ).map((row) => row.slug),
  );

  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** Blank means "never nag" — a project with no cadence can't drift, which is
 *  the honest state for something that has no rhythm to be behind on. */
function cadence(value: string | null): number | null {
  if (!value) return null;
  const days = Number(value);
  if (!Number.isFinite(days) || days < 1) return null;
  return Math.round(days);
}

export async function saveProject(form: FormData) {
  await requireSession();

  const id = str(form, "id");
  const name = str(form, "name");
  if (!name) throw new Error("A project needs a name");

  const areaId = str(form, "areaId");
  if (!areaId) throw new Error("A project needs an area");

  const data = {
    name,
    description: str(form, "description"),
    focus: str(form, "focus"),
    areaId,
    status: (str(form, "status") ?? "active") as ProjectStatus,
    priority: (str(form, "priority") ?? "side") as ProjectPriority,
    cadenceDays: cadence(str(form, "cadenceDays")),
  };

  if (id) {
    // Moving a project between areas has to take its tasks with it. A Task
    // carries its own `areaId` — it's what a project-less one-off hangs off,
    // and what supplies the colour — and `saveTask` keeps the two in step. So
    // without this the project moves and its tasks stay behind, filed and
    // coloured for an area they're no longer in.
    await db.$transaction([
      db.project.update({ where: { id }, data }),
      db.task.updateMany({ where: { projectId: id }, data: { areaId } }),
    ]);
    refresh();
    return id;
  }

  const last = await db.project.findFirst({
    where: { areaId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const project = await db.project.create({
    data: {
      ...data,
      slug: await mintSlug(name),
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });

  refresh();
  return project.id;
}

/**
 * The explicit "I'm not really on this right now" action (CLAUDE.md §6).
 *
 * A drifting project has two honest answers — pick it back up, or admit it's
 * simmering. Without the second one the warning just accumulates, and a
 * dashboard that only ever adds guilt stops being opened. Demoting does *not*
 * touch `lastTouchedAt`: the project hasn't been worked on, it's been
 * reclassified, and pretending otherwise would falsify the momentum history.
 */
export async function setProjectStatus(projectId: string, status: string) {
  await requireSession();

  await db.project.update({
    where: { id: projectId },
    data: { status: status as ProjectStatus },
  });

  refresh();
}

/**
 * Deleting is only allowed for a project that never got started.
 *
 * Every relation pointing at a Project is `SetNull`, which is right for a
 * one-off failure and disastrous in bulk: deleting a project with work on it
 * doesn't delete the work, it *orphans* it — nineteen tasks quietly lose their
 * project and reappear on the Hunt Board as unfiled rows with no way to tell
 * where they came from. Archiving is the answer for anything with history;
 * delete exists for the one you named wrong two minutes ago.
 */
export async function deleteProject(projectId: string) {
  await requireSession();

  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    select: {
      _count: {
        select: {
          tasks: true,
          items: true,
          series: true,
          docs: true,
          journal: true,
        },
      },
    },
  });

  const { tasks, items, series, docs, journal } = project._count;
  const held = [
    tasks && `${tasks} task${tasks === 1 ? "" : "s"}`,
    items && `${items} item${items === 1 ? "" : "s"}`,
    series && `${series} series`,
    // Docs cascade rather than orphaning, so deleting would not leave them
    // behind — it would erase them. Which is worse, and so still blocks.
    docs && `${docs} doc${docs === 1 ? "" : "s"}`,
    // The journal cascades too, and it is the one thing here that cannot be
    // written again: a task can be retyped, a photo of the day something first
    // worked cannot.
    journal &&
      `${journal} journal ${journal === 1 ? "entry" : "entries"}`,
  ].filter(Boolean);

  if (held.length > 0) {
    // "13 tasks, 2 items and 2 series" — a plain join gives "and … and …".
    const list =
      held.length === 1
        ? held[0]
        : `${held.slice(0, -1).join(", ")} and ${held.at(-1)}`;
    throw new Error(
      `This still holds ${list}. Archive it instead — deleting would leave them behind with nothing to hang off.`,
    );
  }

  await db.project.delete({ where: { id: projectId } });
  refresh();
}
