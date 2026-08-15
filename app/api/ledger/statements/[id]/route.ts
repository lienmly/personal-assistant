import { auth } from "@/lib/auth";
import { readStatementDocument } from "@/lib/statement-store";

/**
 * One statement PDF, served to the review screen.
 *
 * A structural copy of `app/api/journal/media/[id]/route.ts`, and it re-checks
 * the session for the same reason that one gives: **a route handler is its own
 * public endpoint.** Without this it would be the one genuinely public thing in
 * the app, and it would be a document listing what a property earns, what it
 * pays out, and who manages it.
 *
 * It is also why `proxy.ts` exempts *paths* and never the `api/ledger` prefix —
 * the job runner and the Plaid webhook are exempt, and this deliberately is not.
 *
 * `Content-Disposition: inline` so the browser's own PDF viewer renders it
 * beside the extracted rows; the filename is still supplied for the save
 * dialogue.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user) return new Response("Not signed in", { status: 401 });

  const { id } = await params;
  const document = await readStatementDocument(id);
  if (!document) return new Response("Not found", { status: 404 });

  const filename = (document.filename ?? "statement.pdf").replace(/["\\]/g, "");

  // A Blob rather than the Uint8Array: the view Prisma hands back is typed over
  // ArrayBufferLike, which is not a BodyInit. This wraps it without copying.
  return new Response(new Blob([document.data], { type: document.mimeType }), {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Length": String(document.data.byteLength),
      "Content-Disposition": `inline; filename="${filename}"`,
      // `private`, never `public`. `immutable` is honest because a document
      // row's bytes are written once — a corrected statement is a new upload
      // with a new id.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
