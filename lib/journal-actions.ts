"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteMedia, putMedia } from "@/lib/media-store";

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
 * Today, as a *local* calendar day pushed to UTC midnight.
 *
 * `happenedOn` is `@db.Date`, so it stands in for a calendar day and must land
 * on UTC midnight or it shifts west of Greenwich (CLAUDE.md §6, "Dates are a
 * trap here"). Computed here on the server rather than accepted from the form —
 * see `saveJournalEntry`.
 */
function todayAsDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
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
 * Create or update one entry, with any media attached in the same submit.
 *
 * **The date is not a field, and an existing entry's date never moves** —
 * decided 2026-08-06. `happenedOn` is set once, here, from the server's clock,
 * and an update does not touch it; `createdAt` is `@default(now())` and was
 * never writable. So an entry's day and time are facts about when it was
 * written rather than values someone chose, which is the whole claim the journal
 * makes. See CLAUDE.md §6, "The date is not a field".
 *
 * The consequence is deliberate and stated on screen: **you cannot journal about
 * a day that has passed.** Editing an old entry still works — the text and the
 * photos are yours to fix — but a new one lands today or not at all.
 *
 * **An entry with neither text nor media is refused.** A journal that can hold a
 * blank row is one you scroll past a blank row in, and the failure mode is
 * silent — you tap Save with nothing typed and get a dated nothing that looks
 * like a day you failed to record.
 *
 * Media arrives as `File`s on the same FormData, already downscaled (photos) or
 * length-capped (clips) by the browser — see `components/areas/media-input.tsx`.
 * They are stored one at a time rather than in a transaction with the entry: a
 * photo that fails to store should cost you that photo, not the paragraph you
 * just wrote.
 */
export async function saveJournalEntry(form: FormData) {
  await requireSession();

  const id = str(form, "id");
  const areaId = str(form, "areaId");
  if (!areaId) throw new Error("An entry needs an area");

  const title = str(form, "title");
  // Not `str` — an emptied body is a legitimate save on an entry that has
  // media, and `str` turns "" into null, which would keep the previous text.
  const bodyRaw = form.get("body");
  const body = typeof bodyRaw === "string" ? bodyRaw.trim() : "";

  const files = form
    .getAll("media")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (!id && !title && !body && files.length === 0) {
    throw new Error("Write something or add a photo");
  }

  const entry = id
    ? await db.journalEntry.update({
        where: { id },
        // `happenedOn` is deliberately absent: an edit fixes what an entry says,
        // never when it happened.
        data: { title, body },
        select: { id: true },
      })
    : await db.journalEntry.create({
        data: { areaId, title, body, happenedOn: todayAsDate() },
        select: { id: true },
      });

  for (const file of files) {
    const meta = metaFor(form, file.name);
    await putMedia({
      entryId: entry.id,
      data: new Uint8Array(await file.arrayBuffer()),
      mimeType: file.type,
      width: meta.width,
      height: meta.height,
      kind: meta.kind,
      durationMs: meta.durationMs,
    });
  }

  refresh(await areaSlugFor(areaId));
  return entry.id;
}

/**
 * What the browser already knows about each file, sent alongside it as
 * `meta:<filename>` = "WxH:kind:durationMs".
 *
 * The alternative is decoding the file server-side to read its header, which
 * means a native image and video library in the dependency list to learn three
 * numbers the client had in hand — it has already decoded the photo to downscale
 * it, and it recorded the clip itself. If the value is missing or malformed we
 * store 0×0 and treat it as a photo, which the UI renders at its natural size.
 */
function metaFor(
  form: FormData,
  filename: string,
): {
  width: number;
  height: number;
  kind: "photo" | "video";
  durationMs: number | null;
} {
  const fallback = {
    width: 0,
    height: 0,
    kind: "photo" as const,
    durationMs: null,
  };

  const raw = form.get(`meta:${filename}`);
  if (typeof raw !== "string") return fallback;

  const [size, kind, duration] = raw.split(":");
  const [width, height] = (size ?? "").split("x").map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return fallback;

  const durationMs = Number(duration);

  return {
    width,
    height,
    kind: kind === "video" ? "video" : "photo",
    durationMs: Number.isFinite(durationMs) && durationMs > 0 ? durationMs : null,
  };
}

export async function deleteJournalEntry(id: string) {
  await requireSession();
  // Media cascades with the entry — it is part of it, not attachments that
  // outlive it. Same argument as a Doc cascading with its owner.
  const entry = await db.journalEntry.delete({
    where: { id },
    select: { area: { select: { slug: true } } },
  });
  refresh(entry.area.slug);
}

export async function deleteJournalMedia(id: string) {
  await requireSession();
  const item = await db.journalMedia.findUniqueOrThrow({
    where: { id },
    select: { entry: { select: { area: { select: { slug: true } } } } },
  });
  await deleteMedia(id);
  refresh(item.entry.area.slug);
}
