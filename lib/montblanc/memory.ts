/**
 * What Montblanc remembers between openings of the drawer.
 *
 * **A transcript is not a memory.** CLAUDE.md §6 refuses to keep a chat log, and
 * every word of that argument is about the *drawer* — "a chat you have to scroll
 * past to start the next thought is a chat". It was never an argument against
 * the app knowing anything. So the drawer still opens on a blank sheet, and this
 * is what sits underneath it.
 *
 * Three layers, and the middle one is the whole idea:
 *
 * 1. **The log** — every message, kept, and **never sent to the model**. Raw
 *    history grows without bound and is paid for on every request; §6 already
 *    made exactly this trade when it refused a `list_projects` tool.
 * 2. **The notes** — dated one-liners distilled from the log, three at most per
 *    conversation. Dated rather than one overwritten summary because *how it
 *    changes* is half the ask, and a blob records the present by destroying the
 *    past.
 * 3. **The injection** — the live notes, rendered into the system message beside
 *    the "what currently exists" block. ~200 tokens, no extra round trip.
 *
 * The distiller runs off the hot path: on drawer close, and — for the
 * conversations whose close never landed — on the next drawer open, via
 * `ensureDistilled`. That sweep is deliberately **not** a cron, following
 * `ensureSeriesSlots` (`lib/studio.ts`), which has kept the posting cadence
 * alive since Phase 2 without any infrastructure to keep running.
 */

import { db } from "@/lib/db";

import { complete, isConfigured } from "./deepseek";
import type { NoteView } from "./types";

/** How many live notes reach the prompt. Fifteen is ~700 characters, which is a
 *  third of the context block that is already there. */
const NOTES_IN_PROMPT = 15;

/** How many notes may exist at once. Past this the oldest are superseded, because
 *  a memory that only ever grows is one that eventually says everything and
 *  therefore nothing. */
const MAX_LIVE_NOTES = 20;

/** Per conversation. Three is enough for a real sitting and few enough that a
 *  chatty afternoon cannot flood the list. */
const MAX_NEW_NOTES = 3;

/** A conversation is finished once it has been quiet this long. The on-close
 *  call usually beats the sweep to it; this is the guard for the one that
 *  didn't, and it must be longer than a pause for thought mid-conversation. */
const QUIET_MS = 5 * 60 * 1000;

/** Nothing shorter than this is worth a model call. One command and its receipt
 *  teaches nothing — see the distiller's own rules. */
const MIN_MESSAGES = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Reading
// ─────────────────────────────────────────────────────────────────────────────

/** The live notes, newest first. Used by the prompt and by the drawer's list. */
export async function getNotes(limit = NOTES_IN_PROMPT): Promise<NoteView[]> {
  const rows = await db.montblancNote.findMany({
    where: { supersededAt: null },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, kind: true, text: true, createdAt: true },
  });

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    text: row.text,
    when: row.createdAt.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    }),
  }));
}

/**
 * The notes as the model sees them. Empty string when there are none, so the
 * caller can leave the whole section out rather than print a heading over
 * nothing — an empty "what you have noticed" block reads as an assertion that
 * there is nothing to notice.
 */
export function renderNotes(notes: NoteView[]): string {
  if (notes.length === 0) return "";
  return notes.map((n) => `- (${n.when}, ${n.kind}) ${n.text}`).join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Writing the log
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Records one exchange. Called from the route after the stream closes, and
 * deliberately never awaited on the path the drawer is waiting on.
 *
 * `upsert` rather than a create-then-append, because the conversation id is
 * minted by the client and the first message is what brings the row into
 * existence.
 */
export async function recordExchange({
  conversationId,
  question,
  answer,
}: {
  conversationId: string;
  question: string;
  answer: string | null;
}): Promise<void> {
  const now = new Date();

  await db.montblancConversation.upsert({
    where: { id: conversationId },
    create: { id: conversationId, startedAt: now, lastMessageAt: now },
    // `distilledAt: null` because a conversation that has just gained a message
    // is no longer a finished one. This is what makes the resumed thread work:
    // close after two turns and it distils; pick it back up, say a third thing,
    // and closing again re-reads the whole thing rather than silently skipping
    // the half that arrived after the stamp.
    update: { lastMessageAt: now, distilledAt: null },
  });

  const messages: { conversationId: string; role: string; content: string }[] = [
    { conversationId, role: "user", content: question },
  ];
  if (answer) {
    messages.push({ conversationId, role: "assistant", content: answer });
  }

  await db.montblancMessage.createMany({ data: messages });
}

// ─────────────────────────────────────────────────────────────────────────────
// Distilling
// ─────────────────────────────────────────────────────────────────────────────

const DISTILL_PROMPT = `You read one conversation between a person and Montblanc, the assistant inside their private life-organising dashboard, and you write down what is worth remembering about THE PERSON for next time.

You are not summarising the conversation. Nobody will ever read your notes as a record of it — they get handed to Montblanc weeks later as standing context.

## What a note is

One sentence. Concrete. About a pattern rather than an incident.

GOOD: "Keeps returning to Utaitai's conversion rate; treats the paywall as the thing blocking everything else."
GOOD: "Prefers tasks filed without a due date unless they name one."
GOOD: "Has said twice that the Sleepy Cat art is waiting on someone else."
BAD: "Asked what was on for Utaitai today." (an incident, not a pattern)
BAD: "Seems stressed and overwhelmed." (nobody said this — see below)
BAD: "Is working on Sleepy Cat, Coding Mom, Forge and Utaitai." (already in the app; Montblanc can see the projects)

## The three rules

1. **Behaviour, not feelings.** Write what they keep returning to, keep deferring, keep complaining about, or have said they prefer. Do NOT infer a mood, an emotion or a state of mind. A person typing "add a bug to Sleepy Cat" has told you nothing about how they feel, and guessing is the single worst thing you can do here.
2. **Nothing from a filing turn.** If the conversation was just commands and confirmations — add this, tick that off, where is X — return NO notes at all. An empty result is the common and correct answer. Only write something down when they revealed a preference, a worry they came back to, a decision, or a fact about their situation that the app does not already hold.
3. **Never write down something the app already knows.** It has their projects, areas, brands, tracks and every task. A note repeating any of that is noise.

## Superseding

You are shown the notes that are currently live. If this conversation shows one of them is now resolved, wrong, or has been replaced by a newer position, list its id under "supersede". A concern that has passed must stop being asserted. Do not supersede a note merely because this conversation did not mention it.

## Output

Return JSON and nothing else. No prose, no code fence.

{"add": [{"kind": "concern", "text": "..."}], "supersede": ["id", ...]}

\`kind\` is one of: concern, focus, preference, decision, fact.
At most ${MAX_NEW_NOTES} notes in "add". Both lists may be empty — {"add": [], "supersede": []} is a perfectly good answer and usually the right one.`;

type DistillResult = {
  add?: { kind?: string; text?: string }[];
  supersede?: string[];
};

/**
 * Reads one conversation and writes its notes. Idempotent by `distilledAt`: a
 * second call is a no-op, which is what lets the on-close call and the sweep
 * both fire without racing to write the same notes twice.
 *
 * Returns the number of notes written, for the sweep's logging and for tests.
 */
export async function distill(conversationId: string): Promise<number> {
  if (!isConfigured()) return 0;

  const conversation = await db.montblancConversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      distilledAt: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: { role: true, content: true },
      },
    },
  });

  if (!conversation || conversation.distilledAt) return 0;

  // Stamped before the model call, not after. A distillation that throws should
  // not be retried forever by the sweep on every drawer open — the log survives
  // either way, and one lost set of notes is cheaper than a request that fails
  // on every open for the rest of time.
  await db.montblancConversation.update({
    where: { id: conversationId },
    data: { distilledAt: new Date() },
  });

  if (conversation.messages.length < MIN_MESSAGES) return 0;

  const live = await db.montblancNote.findMany({
    where: { supersededAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, kind: true, text: true },
  });

  const transcript = conversation.messages
    .map((m) => `${m.role === "user" ? "THEM" : "MONTBLANC"}: ${m.content}`)
    .join("\n\n");

  const liveBlock =
    live.length > 0
      ? live.map((n) => `${n.id} (${n.kind}): ${n.text}`).join("\n")
      : "(none yet)";

  let parsed: DistillResult;
  try {
    const result = await complete({
      messages: [
        { role: "system", content: DISTILL_PROMPT },
        {
          role: "user",
          content: `## Notes currently live\n\n${liveBlock}\n\n## The conversation\n\n${transcript}`,
        },
      ],
      tools: [],
    });
    parsed = parseResult(result.content);
  } catch {
    // Deliberately swallowed. This runs in the background, nobody is waiting on
    // it, and there is no screen it could report to.
    return 0;
  }

  const supersede = (parsed.supersede ?? []).filter((id) =>
    live.some((n) => n.id === id),
  );

  const add = (parsed.add ?? [])
    .map((n) => ({ kind: (n.kind ?? "fact").trim(), text: (n.text ?? "").trim() }))
    .filter((n) => n.text.length > 0)
    .slice(0, MAX_NEW_NOTES);

  if (supersede.length === 0 && add.length === 0) return 0;

  const now = new Date();

  await db.$transaction(async (tx) => {
    if (supersede.length > 0) {
      await tx.montblancNote.updateMany({
        where: { id: { in: supersede }, supersededAt: null },
        data: { supersededAt: now },
      });
    }

    if (add.length > 0) {
      await tx.montblancNote.createMany({
        data: add.map((n) => ({ ...n, sourceId: conversationId })),
      });
    }

    // Trim inside the same transaction, so the cap can never be observed broken.
    const liveCount = await tx.montblancNote.count({
      where: { supersededAt: null },
    });
    if (liveCount > MAX_LIVE_NOTES) {
      const stale = await tx.montblancNote.findMany({
        where: { supersededAt: null },
        orderBy: { createdAt: "asc" },
        take: liveCount - MAX_LIVE_NOTES,
        select: { id: true },
      });
      await tx.montblancNote.updateMany({
        where: { id: { in: stale.map((s) => s.id) } },
        data: { supersededAt: now },
      });
    }
  });

  return add.length;
}

/** The model is told to return bare JSON and mostly does. This is the "mostly":
 *  a fenced block, or a sentence in front of it. */
function parseResult(content: string | null): DistillResult {
  if (!content) return {};
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end <= start) return {};
  try {
    return JSON.parse(content.slice(start, end + 1)) as DistillResult;
  } catch {
    return {};
  }
}

/**
 * The sweep. Picks up conversations whose on-close call never landed — a tab
 * killed, a phone locked, a request that lost its network.
 *
 * Called on drawer open rather than from a cron, which is the pattern
 * `ensureSeriesSlots` established: idempotent, cheap, and nothing to keep alive.
 * By the time the first sentence is typed, yesterday's notes are in.
 */
export async function ensureDistilled(): Promise<void> {
  const stale = await db.montblancConversation.findMany({
    where: {
      distilledAt: null,
      lastMessageAt: { lt: new Date(Date.now() - QUIET_MS) },
    },
    orderBy: { lastMessageAt: "desc" },
    // A backlog is not a thing to work through in one page load. The rest wait
    // for the next open, and there is always a next open.
    take: 3,
    select: { id: true },
  });

  for (const row of stale) {
    await distill(row.id);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Correcting it
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Supersedes one note, from the drawer's × .
 *
 * Not a delete. The row is the record of what Montblanc thought and when it
 * stopped thinking it, and that is worth more than the space — the same reason
 * a superseded note is kept when the distiller retires one itself.
 *
 * This is the memory's half of the receipt bargain (§6, "A receipt is what a
 * confirmation step would have cost you"): Montblanc gets to conclude things
 * about you without asking, **because** you can see and remove what it
 * concluded.
 */
export async function forgetNote(id: string): Promise<void> {
  await db.montblancNote.updateMany({
    where: { id, supersededAt: null },
    data: { supersededAt: new Date() },
  });
}
