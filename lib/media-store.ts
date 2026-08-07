import { db } from "@/lib/db";

/**
 * The one place that touches journal media **bytes**.
 *
 * Photos and clips live in Postgres as `JournalMedia.data` (decided 2026-08-05
 * for photos, extended to video 2026-08-06 — see the model's comment for why,
 * over a Railway volume and over S3/R2). That decision was made knowing the
 * database is the expensive place to keep them, so this module exists to make
 * reversing it cheap:
 *
 * **To move to R2/S3 later**, add a nullable `storageKey` to `JournalMedia`,
 * reimplement the three functions below against the bucket, and backfill by
 * streaming every row's `data` out and nulling the column. Nothing else in the
 * app reads `data` — that is the property this file is here to preserve, and
 * the reason every other query names its columns instead of selecting the row.
 *
 * The bytes never travel through a server component or a server action's return
 * value; they are served by `app/api/journal/media/[id]/route.ts` alone.
 */

/** What a browser is allowed to send. Anything else is refused on upload. */
export const ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  // Whichever of these the recorder negotiated: Safari produces MP4/H.264,
  // Chrome and Firefox produce WebM. `MediaRecorder` hands back a type with the
  // codecs appended ("video/webm;codecs=vp8,opus"), so callers must compare the
  // base type — see `baseMime`.
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

/**
 * A ceiling on one stored item, checked server-side.
 *
 * Neither path normally approaches it. A photo is downscaled to ~1600px in the
 * browser and lands under 500KB; a ten-second clip is recorded at a deliberately
 * modest bitrate and lands around 1.5–2MB. This is the backstop for a client that
 * failed to downscale, or a recorder that ignored the bitrate hint. 6MB also sits
 * under `serverActions.bodySizeLimit` in `next.config.ts`, so a refusal here is a
 * clean error rather than a truncated request.
 */
export const MAX_MEDIA_BYTES = 6 * 1024 * 1024;

/**
 * How many photos and clips one entry may hold.
 *
 * Ten is a **storage** number wearing a layout number's clothes, the same way
 * the clip's ten seconds is (§6, "A clip is a photo that costs twenty times as
 * much"). Ten photos is ~750KB in a database where every byte is a byte of
 * database; ten *clips* is 20MB, which is why the cap counts items rather than
 * kinds and is deliberately not generous. It is also as many as the grid can
 * show without becoming a contact sheet you scroll past instead of look at.
 *
 * A second entry is always available and costs nothing — a day already holds as
 * many as you like, and they read as one flow. So the cap constrains a single
 * moment, not the day, which is why it can be this low without losing anything.
 */
export const MAX_MEDIA_PER_ENTRY = 10;

/**
 * "video/webm;codecs=vp8,opus" → "video/webm".
 *
 * `MediaRecorder` reports the type it actually negotiated, codecs and all, and
 * that string is what lands on the `File`. Storing it whole would be honest but
 * useless — nothing downstream branches on the codec, and it would mean the
 * accept-list had to enumerate every codec combination any browser might pick.
 */
export function baseMime(mimeType: string): string {
  return mimeType.split(";")[0].trim().toLowerCase();
}

export type NewMedia = {
  entryId: string;
  data: Uint8Array<ArrayBuffer>;
  mimeType: string;
  width: number;
  height: number;
  kind: "photo" | "video";
  /** Milliseconds. Video only; ignored on a photo. */
  durationMs?: number | null;
  caption?: string | null;
};

/** Stores one photo or clip and returns its id. Rejects oversized or unknown. */
export async function putMedia(item: NewMedia): Promise<string> {
  const mimeType = baseMime(item.mimeType);

  if (!(ACCEPTED_MIME as readonly string[]).includes(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }
  if (item.data.byteLength > MAX_MEDIA_BYTES) {
    throw new Error(
      `That ${item.kind === "video" ? "clip" : "image"} is ${(item.data.byteLength / 1024 / 1024).toFixed(1)}MB — the limit is ${MAX_MEDIA_BYTES / 1024 / 1024}MB.`,
    );
  }

  const row = await db.journalMedia.create({
    data: {
      entryId: item.entryId,
      data: item.data,
      mimeType,
      width: item.width,
      height: item.height,
      byteSize: item.data.byteLength,
      kind: item.kind,
      durationMs: item.kind === "video" ? (item.durationMs ?? null) : null,
      caption: item.caption ?? null,
      sortOrder: await db.journalMedia.count({
        where: { entryId: item.entryId },
      }),
    },
    select: { id: true },
  });

  return row.id;
}

/** Reads one item back. The only `select` of `data` in the codebase. */
export async function readMedia(
  id: string,
): Promise<{ data: Uint8Array<ArrayBuffer>; mimeType: string } | null> {
  const row = await db.journalMedia.findUnique({
    where: { id },
    select: { data: true, mimeType: true },
  });
  if (!row) return null;
  return { data: row.data, mimeType: row.mimeType };
}

/** Removes one item. Deleting an entry cascades and never comes through here. */
export async function deleteMedia(id: string): Promise<void> {
  await db.journalMedia.delete({ where: { id } });
}
