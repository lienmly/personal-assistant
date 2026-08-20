"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { type MediaMeta, decodeMediaMeta } from "@/lib/media-rules";
import {
  MAX_MEDIA_PER_ENTRY,
  deleteMedia,
  mediaProblem,
  putMedia,
} from "@/lib/media-store";

/**
 * What a save says back.
 *
 * **A refusal is a returned value, never a thrown error, and that is not a
 * style preference.** React redacts every error crossing the server boundary in
 * a production build, replacing the message with "An error occurred in the
 * Server Components render. The specific message is omitted…" — so on Railway,
 * every carefully worded sentence in this file reached the screen as that
 * paragraph instead, for every failure alike. The composer was already catching
 * and displaying `cause.message`; there was simply never a useful message in it.
 * Found 2026-08-10, when a ten-second clip refused to attach and said nothing
 * about why.
 *
 * A genuine bug — Prisma is down, the session is gone — still throws, because
 * that belongs in the logs rather than in a sentence under the composer.
 */
export type JournalSaveResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

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
  // **The global journal posts one field, because a `<select>` holds one
  // value.** An area or project page knows its owner and posts the column
  // directly; `/journal` is asking which of the two it is, and a picker that
  // posted into two fields would have to blank the other one on every change —
  // which is the "both" case this union exists to make unspellable, reintroduced
  // as a client-side invariant nobody would maintain.
  const combined = str(form, "owner");
  if (combined) {
    const split = combined.indexOf(":");
    const kind = combined.slice(0, split);
    const id = combined.slice(split + 1);
    if (kind === "area" && id) return { areaId: id };
    if (kind === "project" && id) return { projectId: id };
    throw new Error("Unrecognised journal owner");
  }

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
  // **Always the global journal too.** Every entry appears in exactly two
  // places now — its owner's page and `/journal` — so revalidating only the one
  // the write came from is how the other serves a copy that is missing the
  // paragraph you just wrote, or still showing the one you just deleted.
  revalidatePath("/journal");
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
export async function saveJournalEntry(
  form: FormData,
): Promise<JournalSaveResult> {
  await requireSession();

  const id = str(form, "id");
  // **Only demanded when creating.** An update never writes the owner — the
  // same reason `saveDoc` refuses to re-own a doc: a stray field posted
  // alongside an `id` should be inert rather than silently move the row. And
  // the page to revalidate comes from the row itself (`pathFor`), not from
  // here, so an edit genuinely has no use for it. Requiring one anyway is what
  // would force the global composer to post an owner it is not offering to
  // change.
  // Carried as "the columns only a create sets" rather than as a nullable
  // owner, so the branch below narrows on the one value it needs instead of
  // asserting that it is there.
  const filing = id
    ? null
    : { ...ownerOf(form), happenedOn: todayAsDate() };

  const title = str(form, "title");
  // Not `str` — an emptied body is a legitimate save on an entry that has
  // media, and `str` turns "" into null, which would keep the previous text.
  const bodyRaw = form.get("body");
  const body = typeof bodyRaw === "string" ? bodyRaw.trim() : "";

  const files = form
    .getAll("media")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (!id && !title && !body && files.length === 0) {
    return { ok: false, message: "Write something or add a photo." };
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
    return {
      ok: false,
      message: `An entry holds ${MAX_MEDIA_PER_ENTRY} photos or clips${existing > 0 ? ` — this one already has ${existing}` : ""}. Start another entry for the rest; they still read as one day.`,
    };
  }

  // **Every file is vetted before the entry is created**, for exactly the reason
  // the cap above is. A `File` knows its own type and size, so a bad one can be
  // refused without reading a byte or writing a row — and refusing it later, in
  // the store loop below, is what left "Happy baby" and two others in the
  // database holding a title and nothing else while the screen said the save had
  // failed outright. Nothing is written unless all of it can be.
  const prepared = files.map((file) => ({ file, meta: metaFor(form, file) }));

  for (const { file, meta } of prepared) {
    const problem = mediaProblem({
      mimeType: meta.mimeType,
      byteLength: file.size,
      kind: meta.kind,
    });
    if (problem) return { ok: false, message: problem };
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
        // Non-null on this branch: `filing` is exactly "there was no `id`".
        data: { ...filing!, title, body },
        select: { id: true, ...OWNER_SELECT },
      });

  for (const { file, meta } of prepared) {
    await putMedia({
      entryId: entry.id,
      data: new Uint8Array(await file.arrayBuffer()),
      mimeType: meta.mimeType,
      width: meta.width,
      height: meta.height,
      kind: meta.kind,
      durationMs: meta.durationMs,
    });
  }

  refresh(pathFor(entry));
  return { ok: true, id: entry.id };
}

/**
 * What the browser already knows about each file, sent alongside it.
 *
 * The alternative is decoding the file server-side to read its header, which
 * means a native image and video library in the dependency list to learn what
 * the client had in hand — it has already decoded the photo to downscale it, and
 * it recorded the clip itself. The format, and the reason the type is in it
 * rather than read off the request, are in `lib/media-rules.ts` beside the
 * encoder the composer uses.
 */
function metaFor(form: FormData, file: File): MediaMeta {
  return decodeMediaMeta(form.get(`meta:${file.name}`), file.type);
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
