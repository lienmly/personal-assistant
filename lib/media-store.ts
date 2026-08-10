import { db } from "@/lib/db";
import { baseMime, mediaProblem } from "@/lib/media-rules";

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

/** The rules live in a client-safe module so the camera and this endpoint
 *  decide from one copy; re-exported here because this is where callers of the
 *  store expect to find them. */
export {
  ACCEPTED_MIME,
  ACCEPTED_IMAGE_MIME,
  MAX_MEDIA_BYTES,
  MAX_MEDIA_PER_ENTRY,
  baseMime,
  mediaProblem,
} from "@/lib/media-rules";

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

  const problem = mediaProblem({
    mimeType: item.mimeType,
    byteLength: item.data.byteLength,
    kind: item.kind,
  });
  if (problem) throw new Error(problem);

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
