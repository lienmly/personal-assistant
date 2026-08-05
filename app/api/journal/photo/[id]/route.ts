import { auth } from "@/lib/auth";
import { readPhoto } from "@/lib/photo-store";

/**
 * Serves one journal photo's bytes.
 *
 * **Auth-gated, like every other surface.** `proxy.ts` guards pages; a route
 * handler is its own public endpoint, so it re-checks the session for the same
 * reason every server action does. These are pictures of a baby — an
 * unauthenticated `/api/journal/photo/<id>` would be the one genuinely public
 * thing in the app.
 *
 * `private` in the cache header, not `public`, precisely because it is
 * per-session. `immutable` is honest: a photo row's bytes are written once and
 * never updated — editing a photo means uploading another and deleting this one,
 * which mints a new id.
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
  const photo = await readPhoto(id);
  if (!photo) {
    return new Response("Not found", { status: 404 });
  }

  // A Blob rather than the Uint8Array itself: the view Prisma hands back is
  // typed over ArrayBufferLike, which is not a BodyInit. This wraps it without
  // copying the bytes.
  return new Response(new Blob([photo.data], { type: photo.mimeType }), {
    headers: {
      "Content-Type": photo.mimeType,
      "Content-Length": String(photo.data.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
