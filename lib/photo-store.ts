import { db } from "@/lib/db";

/**
 * The one place that touches photo **bytes**.
 *
 * Photos live in Postgres as `JournalPhoto.data` (decided 2026-08-05 — see the
 * model's comment for why, over a Railway volume and over S3/R2). That decision
 * was made knowing the database is the expensive place to keep them, so this
 * module exists to make reversing it cheap:
 *
 * **To move to R2/S3 later**, add a nullable `storageKey` to `JournalPhoto`,
 * reimplement the three functions below against the bucket, and backfill by
 * streaming every row's `data` out and nulling the column. Nothing else in the
 * app reads `data` — that is the property this file is here to preserve, and
 * the reason every other query names its columns instead of selecting the row.
 *
 * The bytes never travel through a server component or a server action's return
 * value; they are served by `app/api/journal/photo/[id]/route.ts` alone.
 */

/** What a browser is allowed to send. Anything else is refused on upload. */
export const ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/**
 * A ceiling on one stored image, checked server-side.
 *
 * The client downscales to ~1600px before uploading and normally lands under
 * 500KB, so this is not the working limit — it is the backstop for a client that
 * failed to downscale (a browser without canvas support falls back to the
 * original file). 6MB also sits under `serverActions.bodySizeLimit` in
 * `next.config.ts`, so a refusal here is a clean error rather than a truncated
 * request.
 */
export const MAX_PHOTO_BYTES = 6 * 1024 * 1024;

export type NewPhoto = {
  entryId: string;
  data: Uint8Array<ArrayBuffer>;
  mimeType: string;
  width: number;
  height: number;
  caption?: string | null;
};

/** Stores one image and returns its id. Rejects anything oversized or unknown. */
export async function putPhoto(photo: NewPhoto): Promise<string> {
  if (!(ACCEPTED_MIME as readonly string[]).includes(photo.mimeType)) {
    throw new Error(`Unsupported image type: ${photo.mimeType}`);
  }
  if (photo.data.byteLength > MAX_PHOTO_BYTES) {
    throw new Error(
      `That image is ${(photo.data.byteLength / 1024 / 1024).toFixed(1)}MB — the limit is ${MAX_PHOTO_BYTES / 1024 / 1024}MB.`,
    );
  }

  const row = await db.journalPhoto.create({
    data: {
      entryId: photo.entryId,
      data: photo.data,
      mimeType: photo.mimeType,
      width: photo.width,
      height: photo.height,
      byteSize: photo.data.byteLength,
      caption: photo.caption ?? null,
      sortOrder: await db.journalPhoto.count({
        where: { entryId: photo.entryId },
      }),
    },
    select: { id: true },
  });

  return row.id;
}

/** Reads one image back. The only `select` of `data` in the codebase. */
export async function readPhoto(
  id: string,
): Promise<{ data: Uint8Array<ArrayBuffer>; mimeType: string } | null> {
  const row = await db.journalPhoto.findUnique({
    where: { id },
    select: { data: true, mimeType: true },
  });
  if (!row) return null;
  return { data: row.data, mimeType: row.mimeType };
}

/** Removes one image. Deleting an entry cascades and never comes through here. */
export async function deletePhoto(id: string): Promise<void> {
  await db.journalPhoto.delete({ where: { id } });
}
