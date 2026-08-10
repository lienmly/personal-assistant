/**
 * What may be stored as journal media, and why a given file may not be.
 *
 * **Client-safe: no Prisma import**, the same rule `lib/tracks.ts`,
 * `lib/calendar-keys.ts` and `lib/journal-filters.ts` follow. It is split out of
 * `lib/media-store.ts` — which imports `lib/db` and therefore cannot be reached
 * from a client bundle — so that the camera, the media picker and the server
 * action all decide from **one** copy of these rules.
 *
 * They used to be three copies: `MAX_MEDIA_BYTES` and the accepted types were
 * mirrored as literals in `components/areas/media-input.tsx` and again in
 * `camera-sheet.tsx`, each with a comment pointing back here. That is how the
 * camera came to say "recorded that as …" while the server said "recorded that
 * clip as …" about the same file, and it is the kind of drift a shared module
 * makes unspellable rather than merely discouraged.
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

/** The image half, for the library picker's `accept` and its fallback path. */
export const ACCEPTED_IMAGE_MIME = ACCEPTED_MIME.filter((mime) =>
  mime.startsWith("image/"),
);

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

/**
 * What the browser knows about one file, as it travels beside it.
 *
 * The composer appends this as `meta:<filename>`; the action reads it back.
 * **Both halves live here on purpose** — a wire format written in one file and
 * parsed in another is a format with two definitions, and this one grew a fourth
 * field the day a device turned out not to send the third thing it carries.
 *
 * The type is in here rather than left on the `File` because a file's type
 * crosses the wire as its multipart part's `Content-Type` header, and a part
 * arriving without one parses as `text/plain` — which is what an Android phone's
 * recorded clips were arriving as (2026-08-10), refused for a type no recorder
 * produces. The header is the browser's to send; this value is ours.
 *
 * `:` is the separator and no field can contain one: a base mime has none once
 * the codec parameters are off it, and the rest are numbers and a keyword.
 */
export type MediaMeta = {
  width: number;
  height: number;
  kind: "photo" | "video";
  durationMs: number | null;
  mimeType: string;
};

export function encodeMediaMeta(meta: MediaMeta): string {
  return `${meta.width}x${meta.height}:${meta.kind}:${meta.durationMs ?? 0}:${baseMime(meta.mimeType)}`;
}

/**
 * The inverse, tolerant of anything malformed.
 *
 * `fallbackMime` is the file's own type, used only when the field is absent —
 * a form posted by hand, or a client from before the field existed. A missing
 * size stores 0×0, which the UI renders at the image's natural size.
 */
export function decodeMediaMeta(
  raw: unknown,
  fallbackMime: string,
): MediaMeta {
  const fallback: MediaMeta = {
    width: 0,
    height: 0,
    kind: "photo",
    durationMs: null,
    mimeType: fallbackMime,
  };

  if (typeof raw !== "string") return fallback;

  const [size, kind, duration, mimeType] = raw.split(":");
  const [width, height] = (size ?? "").split("x").map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return fallback;

  const durationMs = Number(duration);

  return {
    width,
    height,
    kind: kind === "video" ? "video" : "photo",
    durationMs:
      Number.isFinite(durationMs) && durationMs > 0 ? durationMs : null,
    mimeType: mimeType?.trim() ? mimeType.trim() : fallbackMime,
  };
}

/**
 * Why one file cannot be stored, as a sentence, or `null` if it can.
 *
 * Pure, so the camera can refuse a recording at the viewfinder and the action
 * can refuse the same file again at the endpoint, in the same words. Neither
 * needs the bytes: a `File` already knows its own size, and its type is now
 * declared alongside it rather than read off the request (see `metaFor` in
 * `lib/journal-actions.ts`).
 */
export function mediaProblem(item: {
  mimeType: string;
  byteLength: number;
  kind: "photo" | "video";
}): string | null {
  const mimeType = baseMime(item.mimeType);
  const noun = item.kind === "video" ? "clip" : "photo";

  if (!(ACCEPTED_MIME as readonly string[]).includes(mimeType)) {
    // The type is named because it is the only way to find out what a given
    // device actually produced — in a production build a thrown message never
    // reaches the screen (see `JournalSaveResult`), and this one is returned.
    return `This browser recorded that ${noun} as ${mimeType || "an unnamed type"}, which can't be stored yet.`;
  }
  if (item.byteLength > MAX_MEDIA_BYTES) {
    return `That ${noun} is ${(item.byteLength / 1024 / 1024).toFixed(1)}MB — the limit is ${MAX_MEDIA_BYTES / 1024 / 1024}MB. A shorter one will fit.`;
  }
  return null;
}
