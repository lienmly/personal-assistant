import { auth } from "@/lib/auth";
import { readMedia } from "@/lib/media-store";

/**
 * Serves one journal photo's or clip's bytes.
 *
 * **Auth-gated, like every other surface.** `proxy.ts` guards pages; a route
 * handler is its own public endpoint, so it re-checks the session for the same
 * reason every server action does. These are pictures of a baby — an
 * unauthenticated `/api/journal/media/<id>` would be the one genuinely public
 * thing in the app.
 *
 * `private` in the cache header, not `public`, precisely because it is
 * per-session. `immutable` is honest: a row's bytes are written once and never
 * updated — replacing a photo means uploading another and deleting this one,
 * which mints a new id.
 *
 * **`Accept-Ranges` matters here now that clips exist.** A `<video>` element
 * asks for byte ranges to scrub, and a server that ignores `Range` gets away
 * with it only because these are small enough to send whole — which they are,
 * capped at 6MB. Stated rather than assumed, because it stops being true the
 * moment the cap moves.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Not signed in", { status: 401 });
  }

  const { id } = await params;
  const item = await readMedia(id);
  if (!item) {
    return new Response("Not found", { status: 404 });
  }

  // A Blob rather than the Uint8Array itself: the view Prisma hands back is
  // typed over ArrayBufferLike, which is not a BodyInit. This wraps it without
  // copying the bytes.
  return new Response(new Blob([item.data], { type: item.mimeType }), {
    headers: {
      "Content-Type": item.mimeType,
      "Content-Length": String(item.data.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
