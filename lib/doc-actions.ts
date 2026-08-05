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
/**
 * A doc hangs off a Project **or** an Area, exactly one of the two — the
 * invariant the schema comment on `Doc` describes and cannot express. This file
 * is the only writer, so this type is where it is actually enforced: there is no
 * way to spell "both" or "neither".
 */
type DocOwner = { projectId: string } | { areaId: string };

function ownerOf(form: FormData): DocOwner {
  const projectId = str(form, "projectId");
  const areaId = str(form, "areaId");

  if (projectId && areaId)
    throw new Error("A doc belongs to a project or an area, not both");
  if (projectId) return { projectId };
  if (areaId) return { areaId };
  throw new Error("A doc needs a project or an area");
}

/** The page to revalidate after a write — whichever surface shows this doc. */
function pathFor(doc: {
  project: { slug: string } | null;
  area: { slug: string } | null;
}): string {
  if (doc.project) return `/projects/${doc.project.slug}`;
  if (doc.area) return `/areas/${doc.area.slug}`;
  throw new Error("An orphaned doc — this should be unreachable");
}

const OWNER_SELECT = {
  project: { select: { slug: true } },
  area: { select: { slug: true } },
} as const;

async function mintSlug(owner: DocOwner, title: string): Promise<string> {
  const base = slugify(title) || "note";
  const taken = new Set(
    (
      await db.doc.findMany({
        where: { ...owner, slug: { startsWith: base } },
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
  const title = str(form, "title") ?? "Untitled";
  // Not `str` — an emptied doc is a legitimate save, and `str` turns "" into
  // null, which would silently keep the previous body.
  const bodyRaw = form.get("body");
  const body = typeof bodyRaw === "string" ? bodyRaw : "";

  // An edit must not be able to re-own the doc, so the owner is read only when
  // creating. Passing a stray `areaId` alongside an `id` is then inert rather
  // than a silent move.
  const doc = id
    ? await db.doc.update({
        where: { id },
        data: { title, body },
        select: { id: true, slug: true, ...OWNER_SELECT },
      })
    : await (async () => {
        const owner = ownerOf(form);
        return db.doc.create({
          data: {
            ...owner,
            title,
            body,
            slug: await mintSlug(owner, title),
            sortOrder: await db.doc.count({ where: owner }),
          },
          select: { id: true, slug: true, ...OWNER_SELECT },
        });
      })();

  revalidatePath(pathFor(doc));
  return doc.slug;
}

export async function deleteDoc(id: string) {
  await requireSession();
  const doc = await db.doc.delete({
    where: { id },
    select: OWNER_SELECT,
  });
  revalidatePath(pathFor(doc));
}
