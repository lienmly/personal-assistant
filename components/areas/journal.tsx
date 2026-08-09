"use client";

import { useState, useTransition } from "react";
import { BookHeart, Pencil, Play, Plus, Trash2, X } from "lucide-react";

import { MediaGrid } from "@/components/areas/media-grid";
import { MediaInput, type PreparedMedia } from "@/components/areas/media-input";
import { Markdown } from "@/components/ui/markdown";
import {
  deleteJournalEntry,
  deleteJournalMedia,
  saveJournalEntry,
} from "@/lib/journal-actions";
import type {
  JournalDayView,
  JournalEntryView,
  JournalOwner,
} from "@/lib/journal";
import { cn } from "@/lib/utils";

/** Without a width, so a field can take its own. `field` used to bake in
 *  `w-full`, and `${field} w-auto` on a sibling lost — two width utilities have
 *  equal specificity, so the one Tailwind emits later wins and it is not the one
 *  at the end of your class string. See CLAUDE.md §9. */
const fieldBase =
  "rounded-chip bg-inset px-3 py-2 text-[13px] text-ink outline-none transition-[background-color,box-shadow] duration-(--duration-base) ease-soft placeholder:text-faint hover:bg-line/60 focus:bg-card focus:ring-2 focus:ring-accent/25";

const field = `w-full ${fieldBase}`;

/**
 * The Journal tab: one card per day, newest day first, and inside each card the
 * day itself — everything written in it, in the order it was written, on a
 * single thread.
 *
 * **A day is a flow, not a list of filings** (2026-08-06). Each entry used to be
 * its own floating card, which made two thoughts about one afternoon look
 * exactly like two thoughts about two afternoons — identical tiles, one date
 * printed twice. They are now nodes on one thread under one heading: same rows,
 * same timestamps, but the shape on screen finally says the thing that is true,
 * which is that a day is one train of thought you add to as it goes.
 *
 * That is also why the thread runs **down** while the days run **up**. The list
 * of days is a list and reads newest-first like everything else here; a day is
 * not a list, and a train of thought read bottom-up is not one.
 *
 * **The composer is the last node of today**, where the next thought goes,
 * rather than a form floating above the whole page. It sits open when today has
 * nothing in it yet — the thing being recorded happened thirty seconds ago and
 * you are holding a baby, so a tap before the cursor exists is the entry not
 * getting written — and behind a "+" once the day has started, because by then
 * the day is something you are *reading* and a permanently open form halfway
 * down it is noise.
 *
 * **You can only write into today, and the date is not a field.** No past day
 * has a "+": a day that has gone is closed. What you can do is edit what you
 * wrote — the words and the photos are yours to fix — and that is the whole
 * difference between correcting a record and back-filling one. See CLAUDE.md
 * §6, "The date is not a field".
 *
 * Nothing here can be overdue, ticked, or counted against a target. That is the
 * point of the noun (CLAUDE.md §6, "The Baby area is a journal, not a backlog").
 *
 * **`owner` is an area or a project**, and the component does not care which —
 * it hands the pair straight to the action, the same way `DocsTab` does. A
 * project's journal is its devlog; an area's is the Baby area's. Same noun, same
 * screen, one component.
 */
export function Journal({
  owner,
  ownerName,
  days,
}: {
  owner: JournalOwner;
  ownerName: string;
  days: JournalDayView[];
}) {
  const [editing, setEditing] = useState<string | null>(null);

  // `getJournal` always returns today, empty or not — so a day with nothing in
  // it is not "no journal", it is a day you have not written in yet.
  const total = days.reduce((count, day) => count + day.entries.length, 0);

  return (
    <div className="flex flex-col gap-4">
      {days.map((day, dayIndex) => (
        <section
          key={day.key}
          className="animate-rise rounded-tile bg-card p-4 shadow-card sm:p-5"
          style={{ animationDelay: `${Math.min(dayIndex, 8) * 45}ms` }}
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-semibold tracking-tight text-ink">
              {day.dayLabel}
            </h3>
            {day.isToday && (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                Today
              </span>
            )}
            {day.entries.length > 1 && (
              <span className="text-[12px] text-faint">
                {`${day.entries.length} entries`}
              </span>
            )}
          </div>

          <ol className="flex flex-col">
            {day.entries.map((entry, index) => (
              <Node
                key={entry.id}
                // The thread continues past this node if anything follows it —
                // another entry, or today's composer.
                connected={index < day.entries.length - 1 || day.isToday}
              >
                {editing === entry.id ? (
                  <Composer
                    owner={owner}
                    entry={entry}
                    onDone={() => setEditing(null)}
                  />
                ) : (
                  <Entry entry={entry} onEdit={() => setEditing(entry.id)} />
                )}
              </Node>
            ))}

            {day.isToday && (
              <AddNode owner={owner} startOpen={day.entries.length === 0} />
            )}
          </ol>
        </section>
      ))}

      {total === 0 && (
        <div className="flex flex-col items-center justify-center rounded-tile bg-inset px-6 py-10 text-center">
          <span className="mb-3 grid size-10 place-items-center rounded-full bg-card text-faint shadow-card">
            <BookHeart className="size-4.5" strokeWidth={1.8} />
          </span>
          <p className="text-sm font-medium text-ink">Nothing written yet</p>
          {/* Deliberately not baby-specific. Every area has one of these, and
              copy about what she did last week reads as a bug on the Work
              area. What is true everywhere is the *shape* of the noun. */}
          <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">
            {`What happened, what changed, what you want to remember about ${ownerName}. Nothing here can be overdue or ticked off — it is a record, not a list.`}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * One node on the day's thread: a dot, a line down to whatever follows, and the
 * thing itself.
 *
 * The line is drawn per-node rather than once down the whole `<ol>` because the
 * nodes are different heights and the thread has to stop at the last dot — a
 * single rail spanning the list would either overshoot the end or need to know
 * heights it cannot know. It is one of the few places §9's "separation by
 * contrast, not borders" gives way, and for the reason the rule allows: the
 * line is not a divider between things, it is the statement that they are
 * connected.
 */
function Node({
  connected,
  accent,
  children,
}: {
  connected: boolean;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className={cn("group relative pl-6 sm:pl-7", connected && "pb-5")}>
      <span
        aria-hidden
        className={cn(
          "absolute left-[3px] top-[7px] size-[7px] rounded-full sm:left-[7px]",
          accent ? "bg-accent" : "bg-line",
        )}
      />
      {connected && (
        <span
          aria-hidden
          className="absolute bottom-0 left-[6px] top-[18px] w-px bg-line sm:left-[10px]"
        />
      )}
      {children}
    </li>
  );
}

function Entry({
  entry,
  onEdit,
}: {
  entry: JournalEntryView;
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className={cn(pending && "pointer-events-none opacity-45")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* The day is the heading above; what an entry adds is *when* in that
              day it was written. `timeLabel` is only a clock time when the two
              dates agree — see `lib/journal.ts`. */}
          <span
            className={cn(
              "text-[12px] font-medium tabular-nums",
              entry.sameDay ? "text-muted" : "text-faint",
            )}
          >
            {entry.timeLabel}
          </span>
          {entry.title && (
            <h4 className="mt-0.5 text-[16px] font-semibold leading-snug tracking-tight text-ink">
              {entry.title}
            </h4>
          )}
        </div>

        {/* Hover is not an affordance on a phone (CLAUDE.md §9) — visible
            outright below `sm`, revealed on hover on a pointer device. */}
        <div className="flex shrink-0 items-center gap-1 transition-opacity duration-(--duration-quick) sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit entry"
            className="grid size-8 place-items-center rounded-full text-faint transition-colors duration-(--duration-quick) hover:bg-inset hover:text-ink active:scale-90"
          >
            <Pencil className="size-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (!confirming) {
                setConfirming(true);
                return;
              }
              startTransition(() => deleteJournalEntry(entry.id));
            }}
            aria-label={confirming ? "Confirm delete" : "Delete entry"}
            title={confirming ? "Tap again to delete" : "Delete entry"}
            className={cn(
              "grid size-8 place-items-center rounded-full transition-colors duration-(--duration-quick) active:scale-90",
              confirming
                ? "bg-accent-soft text-accent"
                : "text-faint hover:text-accent",
            )}
          >
            <Trash2 className="size-4" strokeWidth={1.9} />
          </button>
        </div>
      </div>

      {entry.body && (
        <div className="mt-1.5">
          <Markdown source={entry.body} />
        </div>
      )}

      <MediaGrid media={entry.media} />
    </div>
  );
}

/**
 * The last node of today: either the composer, or the "+" that opens it.
 *
 * `startOpen` is the day being empty, and it is the one conditional worth
 * having. An unwritten day should cost nothing to write into; a day already
 * under way is something you scroll to read, and an open form sitting in the
 * middle of it is a form you have to scroll past.
 */
function AddNode({
  owner,
  startOpen,
}: {
  owner: JournalOwner;
  startOpen: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (startOpen || open) {
    return (
      <Node connected={false} accent>
        <Composer
          owner={owner}
          // No cancel and no collapse on the always-open one: there is nothing
          // to go back to on a day with nothing in it.
          onDone={open ? () => setOpen(false) : undefined}
        />
      </Node>
    );
  }

  return (
    <Node connected={false} accent>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="-my-1 flex items-center gap-1.5 rounded-chip py-1 pr-3 text-[13px] font-medium text-muted transition-colors duration-(--duration-quick) hover:text-accent active:scale-[0.97]"
      >
        <Plus className="size-4" strokeWidth={2.2} />
        Add to today
      </button>
    </Node>
  );
}

function Composer({
  owner,
  entry,
  onDone,
}: {
  owner: JournalOwner;
  entry?: JournalEntryView;
  onDone?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [media, setMedia] = useState<PreparedMedia[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Bumped on a successful save so React remounts the form and clears every
  // uncontrolled field — simpler and less fragile than resetting each by hand.
  const [round, setRound] = useState(0);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    // The prepared files, plus what the browser already measured about each.
    // The file input itself is unnamed, so nothing else is attached.
    for (const item of media) {
      form.append("media", item.file, item.name);
      form.append(
        `meta:${item.name}`,
        `${item.width}x${item.height}:${item.kind}:${item.durationMs ?? 0}`,
      );
    }

    setError(null);
    startTransition(async () => {
      try {
        await saveJournalEntry(form);
        setMedia([]);
        setRound((value) => value + 1);
        onDone?.();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not save");
      }
    });
  }

  return (
    <form
      key={round}
      onSubmit={submit}
      className={cn(pending && "pointer-events-none opacity-45")}
    >
      {/* Whichever half of the owner this journal has. The action reads the
          pair as a union, so exactly one of these ever exists. */}
      {"areaId" in owner ? (
        <input type="hidden" name="areaId" value={owner.areaId} />
      ) : (
        <input type="hidden" name="projectId" value={owner.projectId} />
      )}
      {entry && <input type="hidden" name="id" value={entry.id} />}

      {/* No date field. A new entry lands on today, from the server's clock, and
          an edit never moves an existing one — the point of the journal is that
          its times are facts rather than choices. §6, "The date is not a field". */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="title"
          defaultValue={entry?.title ?? ""}
          placeholder="A headline, if it deserves one"
          className={`${fieldBase} min-w-0 flex-1`}
        />
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            aria-label="Cancel"
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition-[background-color,color,transform] duration-(--duration-base) ease-soft hover:rotate-90 hover:bg-inset hover:text-ink"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <textarea
        name="body"
        defaultValue={entry?.body ?? ""}
        rows={entry ? 8 : 3}
        placeholder="What happened?"
        className={`${field} mt-2 resize-y leading-relaxed`}
      />

      {entry && entry.media.length > 0 && <ExistingMedia media={entry.media} />}

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <MediaInput
          media={media}
          onChange={setMedia}
          disabled={pending}
          existingCount={entry?.media.length ?? 0}
        />
        <button
          type="submit"
          className="rounded-chip bg-accent px-4 py-2 text-[13px] font-medium text-white transition-[background-color,transform] duration-(--duration-base) ease-soft hover:bg-accent-hover active:scale-[0.97]"
        >
          {pending ? "Saving…" : entry ? "Save" : "Add entry"}
        </button>
      </div>

      {error && <p className="mt-2 text-[12.5px] text-accent">{error}</p>}
    </form>
  );
}

/** The photos and clips already on an entry being edited. Separate from
 *  `MediaInput`, which only ever holds files not yet sent — mixing the two
 *  would mean one list where removing a thumbnail sometimes calls the server
 *  and sometimes doesn't. */
function ExistingMedia({ media }: { media: JournalEntryView["media"] }) {
  const [pending, startTransition] = useTransition();

  return (
    <ul
      className={cn(
        "mt-3 flex flex-wrap gap-2",
        pending && "pointer-events-none opacity-45",
      )}
    >
      {media.map((item) => (
        <li key={item.id} className="group/thumb relative">
          {item.kind === "video" ? (
            <>
              <video
                src={`/api/journal/media/${item.id}`}
                muted
                playsInline
                preload="metadata"
                className="size-20 rounded-tile bg-inset object-cover shadow-card"
              />
              <span className="pointer-events-none absolute bottom-1 left-1 flex items-center gap-0.5 rounded-full bg-obsidian/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
                <Play className="size-2.5 fill-current" strokeWidth={0} />
                {`${Math.round((item.durationMs ?? 0) / 1000)}s`}
              </span>
            </>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={`/api/journal/media/${item.id}`}
              alt={item.caption ?? ""}
              loading="lazy"
              className="size-20 rounded-tile object-cover shadow-card"
            />
          )}
          <button
            type="button"
            onClick={() => startTransition(() => deleteJournalMedia(item.id))}
            aria-label="Remove"
            className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-obsidian text-white shadow-card transition-transform duration-(--duration-base) ease-soft active:scale-90 sm:opacity-0 sm:group-hover/thumb:opacity-100"
          >
            <X className="size-3.5" strokeWidth={2.5} />
          </button>
        </li>
      ))}
    </ul>
  );
}
