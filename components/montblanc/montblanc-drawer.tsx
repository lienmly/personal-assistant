"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Clapperboard,
  CornerDownLeft,
  FolderPlus,
  Loader2,
  Swords,
  Undo2,
  X,
} from "lucide-react";

import { MoogleMark } from "@/components/brand/moogle-mark";
import { undoMontblanc } from "@/lib/montblanc/undo";
import {
  HISTORY_TURNS,
  type MontblancEvent,
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
 * What it is **not** is a chat log. The transcript is not kept between opens:
 * the ask was "quick — add this bug to this app", and a conversation you have to
 * scroll past to start the next one is a conversation. Each open is a fresh
 * sheet, and what persists is the row that got made.
 */

const SUGGESTIONS = [
  "Add a bug to Sleepy Cat: cat clips through the sofa",
  "Idea for Coding Mom: the 3am commit",
  "What's overdue?",
  "Where do I add a new social account?",
];

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

export function MontblancDrawer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const dismiss = () => setClosing(true);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setClosing(true);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      abortRef.current?.abort();
    };
  }, []);

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
        body: JSON.stringify({ turns: history }),
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
            <Opener onPick={ask} />
          ) : (
            entries.map((entry, index) =>
              entry.role === "user" ? (
                <p
                  key={index}
                  className="ml-auto max-w-[85%] animate-rise rounded-2xl bg-inset px-3.5 py-2 text-[13px] text-ink"
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
function Opener({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="animate-rise space-y-3 pt-2">
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
            return (
              <p
                key={index}
                className="animate-rise whitespace-pre-wrap text-[13px] leading-relaxed text-ink"
              >
                {event.text}
              </p>
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
