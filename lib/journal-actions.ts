"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { deletePhoto, putPhoto } from "@/lib/photo-store";

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

/** `<input type="date">` gives "YYYY-MM-DD"; `happenedOn` is `@db.Date`, so it
 *  has to land on UTC midnight or the day shifts west of Greenwich. */
function dateOnly(value: string | null): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function refresh(areaSlug: string) {
  revalidatePath(`/areas/${areaSlug}`);
}

async function areaSlugFor(areaId: string): Promise<string> {
  const area = await db.area.findUniqueOrThrow({
    where: { id: areaId },
    select: { slug: true },
  });
  return area.slug;
}

/**
 * Create or update one entry, with any photos attached in the same submit.
 *
 * **An entry with neither text nor a photo is refused.** A journal that can hold
 * a blank row is one you scroll past a blank row in, and the failure mode is
 * silent — you tap Save with nothing typed and get a dated nothing that looks
 * like a day you failed to record.
 *
 * Photos arrive as `File`s on the same FormData, already downscaled by the
 * browser (see `components/areas/photo-input.tsx`). They are stored one at a
 * time rather than in a transaction with the entry: a photo that fails to store
 * should cost you that photo, not the paragraph you just wrote.
 */
export async function saveJournalEntry(form: FormData) {
  await requireSession();

  const id = str(form, "id");
  const areaId = str(form, "areaId");
  if (!areaId) throw new Error("An entry needs an area");

  const title = str(form, "title");
  // Not `str` — an emptied body is a legitimate save on an entry that has
  // photos, and `str` turns "" into null, which would keep the previous text.
  const bodyRaw = form.get("body");
  const body = typeof bodyRaw === "string" ? bodyRaw.trim() : "";

  const happenedOn =
    dateOnly(str(form, "happenedOn")) ??
    (() => {
      // Today, as a *local* calendar day pushed to UTC midnight — the same
      // conversion `dateOnly` does, so an entry saved without a date lands on
      // the row you are looking at rather than tomorrow's.
      const now = new Date();
      return new Date(
        Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
      );
    })();

  const files = form
    .getAll("photos")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (!id && !title && !body && files.length === 0) {
    throw new Error("Write something or add a photo");
  }

  const entry = id
    ? await db.journalEntry.update({
        where: { id },
        data: { title, body, happenedOn },
        select: { id: true },
      })
    : await db.journalEntry.create({
        data: { areaId, title, body, happenedOn },
        select: { id: true },
      });

  for (const file of files) {
    const dims = dimensionsFor(form, file.name);
    await putPhoto({
      entryId: entry.id,
      data: new Uint8Array(await file.arrayBuffer()),
      mimeType: file.type,
      width: dims.width,
      height: dims.height,
    });
  }

  refresh(await areaSlugFor(areaId));
  return entry.id;
}

/**
 * The browser measures each image while downscaling it and sends the result
 * alongside, as `dim:<filename>` = "WxH".
 *
 * The alternative is decoding the image server-side to read its header, which
 * means a native image library in the dependency list to learn two integers the
 * client already had in hand. If the pair is missing or malformed we store 0×0,
 * which the UI treats as "unknown" and renders at its natural size.
 */
function dimensionsFor(
  form: FormData,
  filename: string,
): { width: number; height: number } {
  const raw = form.get(`dim:${filename}`);
  if (typeof raw !== "string") return { width: 0, height: 0 };
  const [width, height] = raw.split("x").map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return { width: 0, height: 0 };
  }
  return { width, height };
}

export async function deleteJournalEntry(id: string) {
  await requireSession();
  // Photos cascade with the entry — they are part of it, not attachments that
  // outlive it. Same argument as a Doc cascading with its owner.
  const entry = await db.journalEntry.delete({
    where: { id },
    select: { area: { select: { slug: true } } },
  });
  refresh(entry.area.slug);
}

export async function deleteJournalPhoto(id: string) {
  await requireSession();
  const photo = await db.journalPhoto.findUniqueOrThrow({
    where: { id },
    select: { entry: { select: { area: { select: { slug: true } } } } },
  });
  await deletePhoto(id);
  refresh(photo.entry.area.slug);
}
