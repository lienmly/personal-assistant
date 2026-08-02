"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Not signed in");
  return session;
}

/**
 * `/docs` for the library, `/projects` for the doc count on the roster.
 *
 * Not `("/", "layout")` like `project-actions` — the sidebar tree doesn't list
 * docs, so there is nothing in the layout to go stale.
 */
function refresh() {
  revalidatePath("/docs");
  revalidatePath("/projects");
}

function str(form: FormData, key: string): string | null {
  const value = form.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Saving a doc **does not** bump the project's `lastTouchedAt`, and that is a
 * decision rather than an oversight.
 *
 * Momentum (Today §4) is driven by discrete units of finished work — a Mark
 * completing, a Drop publishing. A doc save fires on every "Save" including the
 * one that fixed a typo, so wiring it in would let a two-character edit silence
 * a drift warning for a whole cadence period. That makes the warning
 * untrustworthy, and an untrustworthy warning is worse than none.
 *
 * If "I did real thinking on Forge today" should count, the honest way to say
 * it is a Mark.
 */
export async function saveDoc(form: FormData) {
  await requireSession();

  const id = str(form, "id");
  const title = str(form, "title");
  if (!title) throw new Error("A doc needs a title");

  const projectId = str(form, "projectId");

  // A doc filed under a project takes that project's area, always. `areaId` is
  // required — it supplies the colour and the grouping — and the same rule that
  // keeps a Mark's area in step with its project's applies here: let the two
  // disagree and the doc renders under an area its project has left.
  let areaId = str(form, "areaId");
  if (projectId) {
    const project = await db.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { areaId: true },
    });
    areaId = project.areaId;
  }
  if (!areaId) throw new Error("A doc needs an area or a project");

  const data = {
    title,
    kind: str(form, "kind"),
    // Not `str()` — that collapses "" to null, and an emptied doc is a real
    // state a person can save their way into. `body` is non-nullable.
    body: typeof form.get("body") === "string" ? String(form.get("body")) : "",
    areaId,
    projectId,
  };

  if (id) {
    await db.doc.update({ where: { id }, data });
    refresh();
    return id;
  }

  const doc = await db.doc.create({ data });
  refresh();
  return doc.id;
}

/**
 * Unlike a Project, a doc holds nothing — nothing points at it, so deleting is
 * a clean removal rather than an orphaning. The guard that matters is on the
 * client: deleting is two taps, because the body is the only copy.
 */
export async function deleteDoc(id: string) {
  await requireSession();
  await db.doc.delete({ where: { id } });
  refresh();
}
