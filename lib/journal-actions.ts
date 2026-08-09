"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  MAX_MEDIA_PER_ENTRY,
  deleteMedia,
  putMedia,
} from "@/lib/media-store";

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

/**
 * An entry belongs to an Area **or** a Project, exactly one of the two — the
 * invariant the schema comment on `JournalEntry` describes and cannot express.
 * This file is the only writer, so this type is where it is actually enforced:
 * there is no way to spell "both" or "neither". Same shape, and the same
 * argument, as `DocOwner` in `lib/doc-actions.ts`.
 */
type JournalOwner = { areaId: string } | { projectId: string };

function ownerOf(form: FormData): JournalOwner {
  const areaId = str(form, "areaId");
  const projectId = str(form, "projectId");

  if (areaId && projectId)
    throw new Error("An entry belongs to an area or a project, not both");
  if (projectId) return { projectId };
  if (areaId) return { areaId };
  throw new Error("An entry needs an area or a project");
}

/** Enough of the row to know which page shows it. */
const OWNER_SELECT = {
  area: { select: { slug: true } },
  project: { select: { slug: true } },
} as const;

/** The page to revalidate after a write — whichever surface shows this entry. */
function pathFor(entry: {
  area: { slug: string } | null;
  project: { slug: string } | null;
}): string {
  if (entry.project) return `/projects/${entry.project.slug}`;
  if (entry.area) return `/areas/${entry.area.slug}`;
  throw new Error("An orphaned journal entry — this should be unreachable");
}

function refresh(path: string) {
  revalidatePath(path);
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
  // Read even when updating, because the owner is what says which page to
  // revalidate — but never *written* on an update, for the same reason
  // `saveDoc` refuses to re-own a doc: a stray field posted alongside an `id`
  // should be inert rather than silently move the row.
  const owner = ownerOf(form);

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

  // **Counted against what the entry already holds, and before anything is
  // written.** The composer knows its own cap and disables the buttons at it,
  // but it is a form and this is an endpoint (the same reason every action here
  // re-checks the session). Checking first also means an over-full submit costs
  // you the submit rather than leaving an entry created and half its photos
  // stored — the one case where the per-file store-as-you-go below would land
  // somewhere you did not ask for.
  const existing = id
    ? await db.journalMedia.count({ where: { entryId: id } })
    : 0;
  if (existing + files.length > MAX_MEDIA_PER_ENTRY) {
    throw new Error(
      `An entry holds ${MAX_MEDIA_PER_ENTRY} photos or clips${existing > 0 ? ` — this one already has ${existing}` : ""}. Start another entry for the rest; they still read as one day.`,
    );
  }

  const entry = id
    ? await db.journalEntry.update({
        where: { id },
        // `happenedOn` is deliberately absent: an edit fixes what an entry says,
        // never when it happened. So is the owner — an entry does not move
        // between an area and a project on a save.
        data: { title, body },
        select: { id: true, ...OWNER_SELECT },
      })
    : await db.journalEntry.create({
        data: { ...owner, title, body, happenedOn: todayAsDate() },
        select: { id: true, ...OWNER_SELECT },
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

  refresh(pathFor(entry));
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
    select: OWNER_SELECT,
  });
  refresh(pathFor(entry));
}

export async function deleteJournalMedia(id: string) {
  await requireSession();
  const item = await db.journalMedia.findUniqueOrThrow({
    where: { id },
    select: { entry: { select: OWNER_SELECT } },
  });
  await deleteMedia(id);
  refresh(pathFor(item.entry));
}
