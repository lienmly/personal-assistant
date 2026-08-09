/**
 * The wire format between the Montblanc route and the drawer.
 *
 * Its own module, free of any `lib/db` or `@prisma/client` import, because the
 * drawer is a client bundle — the same rule `lib/tracks.ts` and
 * `lib/calendar-keys.ts` follow.
 */

/** One turn of the conversation, as the drawer holds it and posts it back. */
export type Turn = {
  role: "user" | "assistant";
  content: string;
};

/**
 * What Montblanc made, reported back so it can be seen and undone.
 *
 * Every write returns one of these. The whole reason it exists is CLAUDE.md
 * §6's oldest rule — the app must not assert things nobody told it — applied to
 * the one component in this app that can *invent*. A row you asked for is
 * yours; a row you did not ask for has to cost one tap to remove, and that
 * means you have to be able to see it without going and looking.
 */
export type Receipt = {
  kind: ReceiptKind;
  id: string;
  /** What was made — the title, verbatim. */
  label: string;
  /** Where it landed: "Sleepy Cat · Build", "Coding Mom", "Baby". */
  where: string;
  /** The surface it can be read on. */
  href: string;
};

export type ReceiptKind =
  | "task"
  | "subtask"
  | "contentItem"
  | "project"
  | "event"
  | "journalEntry";

/** A row Montblanc looked up and is offering, rather than one it created. */
export type Hit = {
  id: string;
  title: string;
  where: string;
  href: string;
  /** "Overdue · 6 Aug", "Doing", null when there is nothing to say. */
  note: string | null;
};

/**
 * The NDJSON event stream. One JSON object per line.
 *
 * Token streaming is deliberately not what this carries. Montblanc is a command
 * bar before it is a chat — the useful thing to watch during the four seconds a
 * tool round takes is *which tool is running*, not the prose being assembled
 * around it. `step` is that; `text` arrives once, whole, at the end.
 */
export type MontblancEvent =
  | { type: "step"; label: string }
  | { type: "receipt"; receipt: Receipt }
  | { type: "hits"; title: string; hits: Hit[] }
  | { type: "navigate"; href: string; label: string }
  | { type: "text"; text: string }
  | { type: "error"; message: string };

/** How many turns of history the drawer sends back. Enough to carry a
 *  clarification ("which project?" → "Sleepy Cat") and its answer, and short
 *  enough that a long session doesn't quietly become an expensive one. */
export const HISTORY_TURNS = 8;
