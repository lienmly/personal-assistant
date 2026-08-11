"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Brain,
  CalendarDays,
  Clapperboard,
  CornerDownLeft,
  FolderPlus,
  Loader2,
  RotateCcw,
  Swords,
  Undo2,
  X,
} from "lucide-react";

import { MoogleMark } from "@/components/brand/moogle-mark";
import { Markdown } from "@/components/ui/markdown";
import {
  forgetNoteAction,
  listNotes,
} from "@/lib/montblanc/memory-actions";
import { undoMontblanc } from "@/lib/montblanc/undo";
import {
  HISTORY_TURNS,
  type MontblancEvent,
  type NoteView,
  type Receipt,
  type ReceiptKind,
  type Turn,
} from "@/lib/montblanc/types";
import { cn } from "@/lib/utils";

/**
 * Montblanc, as a drawer on every surface.
 *
 * The shape is deliberately the task panel's — same slide, same scrim, same
 * width — because it is the same *kind* of thing: something you open over what
 * you were reading, do one job in, and dismiss. A full page would lose the
 * screen you were on, which is half the reason this exists (you were looking at
 * Sleepy Cat when you thought of the bug).
 *
 * What it is **not** is a chat log. It opens on a fresh sheet: the ask was
 * "quick — add this bug to this app", and a conversation you have to scroll past
 * to start the next one is a conversation. What persists is the row that got
 * made.
 *
 * Two things soften that without reversing it, both added 2026-08-10:
 *
 * - **A recent thread can be picked back up.** Within thirty minutes the last
 *   conversation is offered on one line, and taken only if pressed. Closing the
 *   drawer by accident, mid-thought, was losing work that the "fresh sheet" rule
 *   was never meant to be about. It is a *link*, not a restored transcript.
 * - **Montblanc remembers between openings, and the drawer does not.** The
 *   distinction is the whole of `lib/montblanc/memory.ts`: §6's argument against
 *   a chat log is an argument about this component, and never was one about the
 *   app knowing anything. What it has concluded is readable, and removable, from
 *   the empty state.
 */

const SUGGESTIONS = [
  "Add a bug to Sleepy Cat: cat clips through the sofa",
  "Idea for Coding Mom: the 3am commit",
  "What's overdue?",
  "Where do I add a new social account?",
];

/** Where a thread waits to be picked back up. `localStorage`, not the database:
 *  this is a phone, and resuming what you were saying thirty seconds ago should
 *  cost nothing at all — no request, no spinner. The version is in the key so a
 *  change to `Entry` retires old copies instead of crashing on them. */
const DRAFT_KEY = "montblanc:thread:v1";

/** How long a thread stays offered. Long enough to cover a misfired tap, a
 *  nappy, or going to look something up; short enough that yesterday's
 *  conversation is never what greets you. */
const RESUME_WINDOW_MS = 30 * 60 * 1000;

type SavedThread = {
  conversationId: string;
  entries: Entry[];
  turns: Turn[];
  savedAt: number;
};

const RECEIPT_ICON: Record<ReceiptKind, typeof Swords> = {
  task: Swords,
  subtask: Swords,
  contentItem: Clapperboard,
  project: FolderPlus,
  event: CalendarDays,
  journalEntry: BookOpen,
};

const RECEIPT_NOUN: Record<ReceiptKind, string> = {
  task: "Task",
  subtask: "Step",
  contentItem: "Social media content",
  project: "Project",
  event: "Event",
  journalEntry: "Journal entry",
};

type Entry =
  | { role: "user"; text: string }
  | { role: "montblanc"; events: MontblancEvent[]; pending: boolean };

/** A fresh conversation id. `randomUUID` needs a secure context, which localhost
 *  and https both are — the fallback is for nothing in particular and costs one
 *  line. */
function newConversationId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `c${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
}

/** Reads the saved thread, or null. Anything unparseable, stale or half-written
 *  is cleared rather than repaired: it is a convenience, and a broken one should
 *  disappear silently instead of becoming a bug report. */
function readThread(): SavedThread | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedThread;
    const usable =
      saved &&
      typeof saved.conversationId === "string" &&
      Array.isArray(saved.entries) &&
      Array.isArray(saved.turns) &&
      typeof saved.savedAt === "number" &&
      saved.entries.length > 0 &&
      Date.now() - saved.savedAt < RESUME_WINDOW_MS;
    if (!usable) {
      window.localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return saved;
  } catch {
    return null;
  }
}

/**
 * The saved thread, read as an **external store** rather than as a `useState`
 * filled in from an effect — which is what the React Compiler's lint asks for,
 * and correctly: `localStorage` is outside React, exactly like the camera's
 * capability probe and the theme's clock (§9, §11).
 *
 * `subscribe` is a no-op because the answer cannot change while the drawer is
 * open: nothing else writes this key, and what *this* drawer writes is offered
 * on the next open rather than on this one. The snapshot is cached because
 * `getSnapshot` runs on every render and is compared **by reference** — handing
 * back a fresh object each time is an infinite loop (§11's second rule). The
 * cache is dropped on unmount, so reopening genuinely re-reads.
 */
let threadSnapshot: SavedThread | null | undefined;

function subscribeToNothing(): () => void {
  return () => {};
}

function getThreadSnapshot(): SavedThread | null {
  if (threadSnapshot === undefined) threadSnapshot = readThread();
  return threadSnapshot;
}

/** Null on the server, so a drawer that ever gets prerendered hydrates matching.
 *  Deliberately not cached: that is a fact about there being no `window`, not a
 *  fact about the thread. */
function getNoThread(): SavedThread | null {
  return null;
}

/** Saved with every entry settled. A thread stored mid-request would come back
 *  with a spinner that nothing is ever going to resolve, and an unanswered
 *  question at the end of it is noise rather than a thread. */
function writeThread(thread: SavedThread): void {
  const entries = thread.entries
    .map((entry) =>
      entry.role === "montblanc" ? { ...entry, pending: false } : entry,
    )
    .filter(
      (entry) => entry.role === "user" || entry.events.length > 0,
    );

  try {
    if (entries.length === 0) {
      window.localStorage.removeItem(DRAFT_KEY);
      return;
    }
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ ...thread, entries }),
    );
  } catch {
    // Private mode, or a full quota. Losing the ability to resume is not worth
    // taking the drawer down for.
  }
}

export function MontblancDrawer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);

  /** The thread offered on the empty state. The store is what was there when
   *  this drawer opened; `resumeDone` is whether it has been taken or overtaken.
   *  Two values rather than one piece of state, because only the second half is
   *  React's to own. */
  const saved = useSyncExternalStore(
    subscribeToNothing,
    getThreadSnapshot,
    getNoThread,
  );
  const [resumeDone, setResumeDone] = useState(false);
  const resumable = resumeDone ? null : saved;

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** One id per opening, so "a conversation" is one sitting. A ref rather than
   *  state: it is read inside `ask` and changing it must never re-render. */
  const conversationRef = useRef<string>(newConversationId());
  /** Whether anything was actually said, so closing an untouched drawer does not
   *  post a distillation request for a conversation that does not exist. */
  const spokeRef = useRef(false);

  const dismiss = () => setClosing(true);

  useEffect(() => {
    inputRef.current?.focus();

    // The sweep. Picks up whatever the last close never delivered — a tab
    // killed, a phone locked — so by the time the first sentence is typed,
    // yesterday's notes are in. Nobody waits on it; see the route.
    void fetch("/api/montblanc/distill", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sweep: true }),
    }).catch(() => {});

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setClosing(true);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      abortRef.current?.abort();
      // Dropped so the next open re-reads what this session just wrote.
      threadSnapshot = undefined;

      // Distil on the way out, while the conversation is still fresh. `keepalive`
      // is the whole reason this is a route handler rather than a server action:
      // the request has to outlive the component that fired it.
      if (spokeRef.current) {
        void fetch("/api/montblanc/distill", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ conversationId: conversationRef.current }),
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, []);

  // Kept in step with what is on screen, so an accidental close loses nothing.
  useEffect(() => {
    if (entries.length === 0) return;
    writeThread({
      conversationId: conversationRef.current,
      entries,
      turns,
      savedAt: Date.now(),
    });
  }, [entries, turns]);

  /** Take the offered thread. The id comes back with it, so continuing where you
   *  left off is genuinely the same conversation rather than a copy of one — the
   *  distiller then reads it whole. */
  const resume = (thread: SavedThread) => {
    conversationRef.current = thread.conversationId;
    spokeRef.current = true;
    setEntries(thread.entries);
    setTurns(thread.turns);
    setResumeDone(true);
    inputRef.current?.focus();
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [entries]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;

    const history = [...turns, { role: "user" as const, content: text }].slice(
      -HISTORY_TURNS,
    );

    setDraft("");
    setBusy(true);
    // Asking something new abandons the offer rather than stacking on it: the
    // saved thread is a different conversation, and merging the two would put
    // words in it nobody said in that order.
    setResumeDone(true);
    spokeRef.current = true;
    setEntries((current) => [
      ...current,
      { role: "user", text },
      { role: "montblanc", events: [], pending: true },
    ]);
    setTurns(history);

    // Appends to the entry this call created — the last one — rather than to
    // whatever is last at the time it resolves. Two questions in flight is not
    // possible (the composer is disabled while busy), but reading the array
    // inside the updater is what makes that true rather than merely likely.
    const push = (event: MontblancEvent) =>
      setEntries((current) =>
        current.map((entry, index) =>
          index === current.length - 1 && entry.role === "montblanc"
            ? { ...entry, events: [...entry.events, event] }
            : entry,
        ),
      );

    const controller = new AbortController();
    abortRef.current = controller;

    let spoke = "";
    let wrote = false;
    let goTo: string | null = null;

    try {
      const response = await fetch("/api/montblanc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          turns: history,
          conversationId: conversationRef.current,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(
          response.status === 401
            ? "Signed out — sign in again."
            : "Montblanc could not be reached.",
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // NDJSON: a chunk can split a line anywhere, so the tail is held back
      // until its newline arrives. Reading it as whole lines is the only thing
      // that makes the stream parseable at all.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newline = buffer.indexOf("\n");
        while (newline !== -1) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf("\n");
          if (!line) continue;

          const event = JSON.parse(line) as MontblancEvent;
          if (event.type === "text") spoke = event.text;
          if (event.type === "receipt") wrote = true;
          if (event.type === "navigate") goTo = event.href;
          push(event);
        }
      }
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) {
        push({
          type: "error",
          message:
            cause instanceof Error ? cause.message : "Something went wrong.",
        });
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      // The step lines were progress, not transcript. Once the answer is here
      // they are three lines of "Looking…" above it saying nothing.
      setEntries((current) =>
        current.map((entry, index) =>
          index === current.length - 1 && entry.role === "montblanc"
            ? {
                ...entry,
                pending: false,
                events: entry.events.filter((event) => event.type !== "step"),
              }
            : entry,
        ),
      );
    }

    if (spoke) {
      setTurns((current) =>
        [...current, { role: "assistant" as const, content: spoke }].slice(
          -HISTORY_TURNS,
        ),
      );
    }

    // A write revalidates its paths server-side, but this came through a route
    // handler rather than a server action, so nothing has told the client router
    // to re-render the page underneath. Without it you close the drawer onto a
    // Today that does not yet have the task you just watched it make.
    if (wrote) router.refresh();

    if (goTo) {
      router.push(goTo);
      dismiss();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={dismiss}
        className={cn(
          "absolute inset-0 bg-scrim",
          closing ? "animate-scrim-out" : "animate-scrim-in",
        )}
      />

      <div
        role="dialog"
        aria-label="Montblanc"
        onAnimationEnd={(event) => {
          if (closing && event.target === event.currentTarget) onClose();
        }}
        className={cn(
          "relative flex h-full w-full max-w-[440px] flex-col bg-stage shadow-float",
          closing ? "animate-panel-out" : "animate-panel-in",
        )}
      >
        <div className="flex items-center gap-3 px-5 py-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-obsidian text-white">
            <MoogleMark className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">
              Montblanc
            </h2>
            <p className="truncate text-[11px] text-faint">
              Say what you want on the board
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-full text-muted transition-[background-color,color,transform] duration-(--duration-base) ease-soft hover:rotate-90 hover:bg-card hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 space-y-4 overflow-y-auto px-5 pb-6"
        >
          {entries.length === 0 ? (
            <Opener onPick={ask} resumable={resumable} onResume={resume} />
          ) : (
            entries.map((entry, index) =>
              entry.role === "user" ? (
                // `break-words` because a pasted URL is one unbroken word and
                // `max-w-[85%]` does not make text wrap — at 390px a link in
                // the question scrolled the whole message list sideways.
                <p
                  key={index}
                  className="ml-auto max-w-[85%] animate-rise rounded-2xl bg-inset px-3.5 py-2 text-[13px] break-words text-ink"
                >
                  {entry.text}
                </p>
              ) : (
                <MontblancTurn key={index} entry={entry} onClose={dismiss} />
              ),
            )
          )}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void ask(draft);
          }}
          className="flex items-end gap-2 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            disabled={busy}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends. This is a command bar and its input is one
              // sentence; Shift+Enter is there for the rare paste that isn't.
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void ask(draft);
              }
            }}
            placeholder="Add a bug to Sleepy Cat…"
            className="max-h-32 min-h-[2.75rem] w-full flex-1 resize-none rounded-2xl bg-card px-4 py-3 text-[13px] text-ink shadow-card outline-none transition-[box-shadow] duration-(--duration-base) ease-soft placeholder:text-faint focus:ring-2 focus:ring-accent/25 disabled:opacity-45"
          />
          <button
            type="submit"
            disabled={busy || draft.trim() === ""}
            aria-label="Send"
            className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-white transition-[background-color,transform] duration-(--duration-quick) ease-soft hover:bg-accent-hover active:scale-[0.97] disabled:bg-line disabled:text-faint"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CornerDownLeft className="size-4" strokeWidth={2.2} />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

/** What an empty drawer says. Four real sentences rather than a description of
 *  what Montblanc can do: the fastest way to learn the shape of a thing you
 *  talk to is to see a sentence that works and edit it. */
function Opener({
  onPick,
  resumable,
  onResume,
}: {
  onPick: (text: string) => void;
  resumable: SavedThread | null;
  onResume: (thread: SavedThread) => void;
}) {
  const lastSaid = resumable?.entries.findLast?.(
    (entry): entry is Extract<Entry, { role: "user" }> => entry.role === "user",
  );

  return (
    <div className="animate-rise space-y-3 pt-2">
      {resumable && lastSaid ? (
        <button
          type="button"
          onClick={() => onResume(resumable)}
          className="flex w-full items-center gap-2 rounded-2xl bg-inset px-4 py-2.5 text-left transition-[transform,background-color] duration-(--duration-quick) ease-soft hover:bg-card active:scale-[0.985]"
        >
          <RotateCcw className="size-3.5 shrink-0 text-faint" />
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] text-muted">
              Pick up where you left off
            </span>
            <span className="block truncate text-[11px] text-faint">
              {lastSaid.text}
            </span>
          </span>
        </button>
      ) : null}

      <p className="text-[13px] leading-relaxed text-muted">
        Tell me what you want on the board and I&rsquo;ll file it — a bug, an
        idea, a post, a memory — or ask me where something lives and I&rsquo;ll
        take you there.
      </p>
      <div className="space-y-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onPick(suggestion)}
            className="w-full rounded-2xl bg-card px-4 py-3 text-left text-[13px] text-ink shadow-card transition-[transform,background-color] duration-(--duration-quick) ease-soft hover:bg-inset active:scale-[0.985]"
          >
            {suggestion}
          </button>
        ))}
      </div>
      <Memory />
    </div>
  );
}

/**
 * What Montblanc has concluded about you, and the × that removes it.
 *
 * This is the memory's half of the receipt bargain (§6, "A receipt is what a
 * confirmation step would have cost you"). Montblanc gets to write notes about
 * you between conversations without asking first — **because** they are visible
 * and one tap takes one away. Without this the feature would be the app
 * asserting things nobody told it, one layer up from a seeded task.
 *
 * Behind a toggle, and fetched on expand, because the drawer exists to be typed
 * into: this is a question you ask occasionally and never on the way to filing a
 * bug.
 */
function Memory() {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<NoteView[] | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && notes === null) {
      void listNotes()
        .then(setNotes)
        .catch(() => setNotes([]));
    }
  };

  const forget = (id: string) => {
    // Struck out here and superseded there — the row is kept, because when it
    // stopped being true is worth as much as that it was.
    setNotes((current) => current?.filter((note) => note.id !== id) ?? null);
    startTransition(() => {
      void forgetNoteAction(id);
    });
  };

  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-1.5 text-[11px] text-faint transition-colors duration-(--duration-quick) ease-soft hover:text-muted"
      >
        <Brain className="size-3" />
        {open ? "Hide what I remember" : "What I remember"}
      </button>

      {open ? (
        <div
          className={cn(
            "mt-2 space-y-1.5",
            pending && "opacity-45",
          )}
        >
          {notes === null ? (
            <p className="text-[11px] text-faint">Looking…</p>
          ) : notes.length === 0 ? (
            <p className="text-[11px] leading-relaxed text-faint">
              Nothing yet. I write something down when a conversation tells me
              what you keep coming back to — never from filing a task.
            </p>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="group flex items-start gap-2 rounded-2xl bg-inset px-3 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] leading-relaxed break-words text-muted">
                    {note.text}
                  </span>
                  <span className="block text-[10px] text-faint">
                    {note.kind} · {note.when}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => forget(note.id)}
                  aria-label="Forget this"
                  // Visible outright on touch, revealed on hover on a pointer
                  // device — §9, hover is not an affordance on a phone.
                  className="grid size-5 shrink-0 place-items-center rounded-full text-faint transition-[opacity,color] duration-(--duration-quick) ease-soft hover:text-ink sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function MontblancTurn({
  entry,
  onClose,
}: {
  entry: Extract<Entry, { role: "montblanc" }>;
  onClose: () => void;
}) {
  return (
    <div className="space-y-2.5">
      {entry.events.map((event, index) => {
        switch (event.type) {
          case "step":
            return (
              <p
                key={index}
                className="flex items-center gap-2 text-[12px] text-faint"
              >
                <Loader2 className="size-3 animate-spin" />
                {event.label}…
              </p>
            );

          case "receipt":
            return (
              <ReceiptCard key={index} receipt={event.receipt} onGo={onClose} />
            );

          case "hits":
            return (
              <div key={index} className="animate-rise space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                  {event.title}
                </p>
                {event.hits.map((hit) => (
                  <Link
                    key={hit.id}
                    href={hit.href}
                    onClick={onClose}
                    className="flex items-start gap-2 rounded-2xl bg-card px-3.5 py-2.5 shadow-card transition-[background-color] duration-(--duration-quick) ease-soft hover:bg-inset"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">
                        {hit.title}
                      </span>
                      <span className="block truncate text-[11px] text-faint">
                        {hit.where}
                        {hit.note ? ` · ${hit.note}` : ""}
                      </span>
                    </span>
                    <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-faint" />
                  </Link>
                ))}
              </div>
            );

          case "navigate":
            return (
              <p key={index} className="text-[12px] text-faint">
                Opening {event.label}…
              </p>
            );

          case "text":
            // Through the same renderer the Docs tab uses. The model reaches
            // for Markdown whether or not anyone asked it to, and a bulleted
            // answer arriving as literal asterisks reads as a broken app —
            // `prompt.ts` now names the exact subset this parses.
            //
            // `whitespace-pre-wrap` is deliberately gone with the `<p>`: the
            // parser owns the line breaks now, and keeping it would render
            // every blank line twice, once as a gap and once as a margin.
            return (
              <div key={index} className="animate-rise">
                <Markdown
                  source={event.text}
                  className="text-[13px] leading-relaxed text-ink"
                  onLinkClick={onClose}
                />
              </div>
            );

          case "error":
            return (
              <p
                key={index}
                className="animate-rise rounded-2xl bg-warn-soft px-3.5 py-2.5 text-[12px] leading-relaxed text-warn"
              >
                {event.message}
              </p>
            );
        }
      })}

      {entry.pending && entry.events.length === 0 && (
        <p className="flex items-center gap-2 text-[12px] text-faint">
          <Loader2 className="size-3 animate-spin" />
          Thinking…
        </p>
      )}
    </div>
  );
}

/**
 * What was made, and the one tap that takes it back.
 *
 * The Undo is the whole reason Montblanc is allowed to write without asking
 * first — see `lib/montblanc/undo.ts`. It stays on screen after being used,
 * saying so, rather than the card vanishing: a card that disappears when you
 * press it leaves you unsure whether it removed the row or just the card.
 */
function ReceiptCard({
  receipt,
  onGo,
}: {
  receipt: Receipt;
  onGo: () => void;
}) {
  const [undone, setUndone] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const Icon = RECEIPT_ICON[receipt.kind];

  return (
    <div
      className={cn(
        "animate-rise rounded-2xl bg-card p-3.5 shadow-card transition-opacity duration-(--duration-base) ease-soft",
        (undone || pending) && "opacity-45",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-inset text-muted">
          <Icon className="size-3.5" strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
            {undone ? "Removed" : RECEIPT_NOUN[receipt.kind]}
          </p>
          <p
            className={cn(
              "text-[13px] text-ink",
              undone && "line-through decoration-faint",
            )}
          >
            {receipt.label}
          </p>
          {receipt.where && (
            <p className="truncate text-[11px] text-muted">{receipt.where}</p>
          )}
        </div>
      </div>

      {failed && <p className="mt-2 text-[11px] text-warn">{failed}</p>}

      {!undone && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <Link
            href={receipt.href}
            onClick={onGo}
            className="rounded-chip bg-inset px-2.5 py-1 text-[11px] font-medium text-ink transition-[background-color] duration-(--duration-quick) ease-soft hover:bg-line"
          >
            Open
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setFailed(null);
                try {
                  await undoMontblanc(receipt.kind, receipt.id);
                  setUndone(true);
                } catch (cause) {
                  setFailed(
                    cause instanceof Error
                      ? cause.message
                      : "Could not undo that.",
                  );
                }
              })
            }
            className="flex items-center gap-1 rounded-chip px-2 py-1 text-[11px] font-medium text-muted transition-[color,background-color] duration-(--duration-quick) ease-soft hover:bg-inset hover:text-accent"
          >
            <Undo2 className="size-3" strokeWidth={2} />
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
