"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { slugify } from "@/lib/utils";

/** Server actions are their own public endpoints — the route guard in the
 *  layout does not cover them, so each one re-checks the session. */
async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Not signed in");
  return session;
}

function str(form: FormData, key: string): string | null {
  const value = form.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * A doc's slug is minted once and never follows a rename — the same rule the
 * Project slug follows (CLAUDE.md §6, "The roster is the editor"), and here the
 * reason is the URL: `?doc=vision-brief` is a link you may have sent yourself,
 * and a slug that chased the title would break it every time you tidied the
 * heading.
 */
async function mintSlug(projectId: string, title: string): Promise<string> {
  const base = slugify(title) || "note";
  const taken = new Set(
    (
      await db.projectDoc.findMany({
        where: { projectId, slug: { startsWith: base } },
        select: { slug: true },
      })
    ).map((row) => row.slug),
  );

  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export async function saveDoc(form: FormData) {
  await requireSession();

  const id = str(form, "id");
  const projectId = str(form, "projectId");
  const title = str(form, "title") ?? "Untitled";
  // Not `str` — an emptied doc is a legitimate save, and `str` turns "" into
  // null, which would silently keep the previous body.
  const bodyRaw = form.get("body");
  const body = typeof bodyRaw === "string" ? bodyRaw : "";

  if (!projectId) throw new Error("A doc needs a project");

  const doc = id
    ? await db.projectDoc.update({ where: { id }, data: { title, body } })
    : await db.projectDoc.create({
        data: {
          projectId,
          title,
          body,
          slug: await mintSlug(projectId, title),
          sortOrder: await db.projectDoc.count({ where: { projectId } }),
        },
      });

  const project = await db.projectDoc.findUniqueOrThrow({
    where: { id: doc.id },
    select: { project: { select: { slug: true } } },
  });

  revalidatePath(`/projects/${project.project.slug}`);
  return doc.slug;
}

export async function deleteDoc(id: string) {
  await requireSession();
  const doc = await db.projectDoc.delete({
    where: { id },
    select: { project: { select: { slug: true } } },
  });
  revalidatePath(`/projects/${doc.project.slug}`);
}
