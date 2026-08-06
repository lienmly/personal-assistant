"use client";

import { useState, useTransition } from "react";
import { BookHeart, Pencil, Plus, Trash2, X } from "lucide-react";

import { PhotoInput, type PreparedPhoto } from "@/components/areas/photo-input";
import { Markdown } from "@/components/ui/markdown";
import {
  deleteJournalEntry,
  deleteJournalPhoto,
  saveJournalEntry,
} from "@/lib/journal-actions";
import type { JournalDayView, JournalEntryView } from "@/lib/journal";
import { cn } from "@/lib/utils";

/** Without a width, so the date input can take its own. `field` used to bake in
 *  `w-full`, and `${field} w-auto` on the date picker lost — two width utilities
 *  have equal specificity, so the one Tailwind emits later wins and it is not
 *  the one at the end of your class string. The date input was quietly claiming
 *  a whole row, which pushed the title to the next one and the composer's
 *  cancel × to a third. */
const fieldBase =
  "rounded-chip bg-inset px-3 py-2 text-[13px] text-ink outline-none transition-[background-color,box-shadow] duration-(--duration-base) ease-soft placeholder:text-faint hover:bg-line/60 focus:bg-card focus:ring-2 focus:ring-accent/25";

const field = `w-full ${fieldBase}`;

/**
 * The Journal tab: a composer at the top, then everything written, grouped by
 * the day it is about, newest day first.
 *
 * **The composer is open, not behind a button.** Every other write in this app
 * goes through a panel, and a panel is right for a form you fill in
 * deliberately. This is the opposite case — the thing being recorded happened
 * thirty seconds ago and you are holding a baby, so the cost of one tap before
 * the cursor exists is the entry not getting written. Same argument as the idea
 * box on Today, one size up.
 *
 * **A day is the unit you add to, so each day heading carries its own "+".**
 * A day is not one thing that happened; it is a morning, an afternoon and
 * whatever woke you at 3am. Before this, a second thought about Tuesday meant
 * either opening Tuesday's entry and editing a paragraph onto the end of it —
 * losing when each part was written — or a new entry that sorted in beside the
 * first with nothing saying they were the same day. Each entry now carries the
 * **time** it was written, and the day heading gathers them.
 *
 * Today's heading is the one without a "+", because the open composer directly
 * above it already is that button, and two identical forms on screen for the
 * same day reads as a bug rather than a choice.
 *
 * Nothing here can be overdue, ticked, or counted against a target. That is the
 * point of the noun (CLAUDE.md §6, "The Baby area is a journal, not a backlog").
 */
export function Journal({
  areaId,
  areaName,
  days,
  today,
}: {
  areaId: string;
  areaName: string;
  days: JournalDayView[];
  /** "YYYY-MM-DD" computed on the server, so the date input starts on the day
   *  the rest of the page agrees is today rather than the browser's UTC guess. */
  today: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  /** The day whose "+" is open, as a day key. One at a time: two open composers
   *  is two half-written entries and a question about which one you are in. */
  const [adding, setAdding] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <Composer areaId={areaId} defaultDay={today} />

      {days.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-tile bg-inset px-6 py-12 text-center">
          <span className="mb-3 grid size-10 place-items-center rounded-full bg-card text-faint shadow-card">
            <BookHeart className="size-4.5" strokeWidth={1.8} />
          </span>
          <p className="text-sm font-medium text-ink">Nothing written yet</p>
          {/* Deliberately not baby-specific. Every area has one of these, and
              copy about what she did last week reads as a bug on the Work
              area. What is true everywhere is the *shape* of the noun. */}
          <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">
            {`What happened, what changed, what you want to remember about ${areaName}. Nothing here can be overdue or ticked off — it is a record, not a list.`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {days.map((day, dayIndex) => (
            <section
              key={day.key}
              className="animate-rise"
              style={{ animationDelay: `${Math.min(dayIndex, 8) * 45}ms` }}
            >
              <div className="mb-2.5 flex items-center gap-2 px-1">
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

                {/* Beside the date rather than pushed to the far edge: at this
                    width `ml-auto` would leave it a foot away from the day it
                    adds to, reading as a page control rather than a day's.
                    Quiet, not crimson — §9 allows one accent per region and the
                    composer's Save button already spends it. */}
                {!day.isToday && (
                  <button
                    type="button"
                    onClick={() =>
                      setAdding((open) => (open === day.key ? null : day.key))
                    }
                    aria-label={`Add another entry for ${day.dayLabel}`}
                    title="Add another entry for this day"
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full transition-[background-color,color,transform] duration-(--duration-base) ease-soft active:scale-90",
                      adding === day.key
                        ? "rotate-45 bg-inset text-ink"
                        : "text-faint hover:bg-inset hover:text-ink",
                    )}
                  >
                    <Plus className="size-4" strokeWidth={2.2} />
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-3">
                {adding === day.key && (
                  <Composer
                    areaId={areaId}
                    defaultDay={day.key}
                    onDone={() => setAdding(null)}
                  />
                )}

                {day.entries.map((entry) =>
                  editing === entry.id ? (
                    <Composer
                      key={entry.id}
                      areaId={areaId}
                      defaultDay={today}
                      entry={entry}
                      onDone={() => setEditing(null)}
                    />
                  ) : (
                    <Entry
                      key={entry.id}
                      entry={entry}
                      onEdit={() => setEditing(entry.id)}
                    />
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
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
    <article
      className={cn(
        "rounded-tile bg-card p-4 shadow-card sm:p-5",
        pending && "pointer-events-none opacity-45",
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* The day is the heading above; what an entry adds is *when* in that
              day it was written. `timeLabel` is only a clock time when the two
              dates agree — see `lib/journal.ts`. */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "text-[12.5px] font-medium tabular-nums",
                entry.sameDay ? "text-muted" : "text-faint",
              )}
            >
              {entry.timeLabel}
            </span>
          </div>
          {entry.title && (
            <h3 className="mt-1.5 text-[17px] font-semibold leading-snug tracking-tight text-ink">
              {entry.title}
            </h3>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
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

      {entry.body && <Markdown source={entry.body} />}

      {entry.photos.length > 0 && (
        <ul
          className={cn(
            "mt-4 grid gap-2",
            entry.photos.length === 1
              ? "grid-cols-1 sm:max-w-md"
              : "grid-cols-2 sm:grid-cols-3",
          )}
        >
          {entry.photos.map((photo) => (
            <li key={photo.id}>
              {/* A plain <img>, not next/image: the bytes come from an
                  auth-gated route handler, and routing them through the image
                  optimiser would mean a second authenticated fetch of the same
                  private data for no gain — they are already downscaled to
                  ~1600px before they are stored. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/journal/photo/${photo.id}`}
                alt={photo.caption ?? ""}
                width={photo.width || undefined}
                height={photo.height || undefined}
                loading="lazy"
                className="w-full rounded-tile object-cover shadow-card"
              />
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function Composer({
  areaId,
  defaultDay,
  entry,
  onDone,
}: {
  areaId: string;
  /** The day the date input starts on: today for the open composer at the top,
   *  and that day's key for one opened from a day's "+". Still an editable
   *  field either way — writing up Tuesday's afternoon on Thursday is the case
   *  the whole `happenedOn` column exists for. */
  defaultDay: string;
  entry?: JournalEntryView;
  onDone?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Bumped on a successful save so React remounts the form and clears every
  // uncontrolled field — simpler and less fragile than resetting each by hand.
  const [round, setRound] = useState(0);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    // The prepared (downscaled) files, plus the dimensions the browser already
    // measured. The file input itself is unnamed, so nothing else is attached.
    for (const photo of photos) {
      form.append("photos", photo.file, photo.name);
      form.append(`dim:${photo.name}`, `${photo.width}x${photo.height}`);
    }

    setError(null);
    startTransition(async () => {
      try {
        await saveJournalEntry(form);
        setPhotos([]);
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
      className={cn(
        "rounded-tile bg-card p-4 shadow-card sm:p-5",
        pending && "pointer-events-none opacity-45",
      )}
    >
      <input type="hidden" name="areaId" value={areaId} />
      {entry && <input type="hidden" name="id" value={entry.id} />}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="date"
          name="happenedOn"
          defaultValue={entry?.happenedOn ?? defaultDay}
          aria-label="The day this is about"
          className={`${fieldBase} w-auto shrink-0`}
        />
        {/* Full width on a phone, beside the date from `sm` up. Sharing a row
            with the date picker at 390px leaves the headline about twelve
            characters wide, which is not a field you would type into.
            `fieldBase`, not `field`: a `width: 100%` in a wrapping flex row
            takes a whole line whatever the basis says, which is what put this
            below the date at every width rather than only on a phone. */}
        <input
          name="title"
          defaultValue={entry?.title ?? ""}
          placeholder="A headline, if it deserves one"
          className={`${fieldBase} min-w-0 basis-full sm:flex-1 sm:basis-auto`}
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
        className={`${field} resize-y leading-relaxed`}
      />

      {entry && entry.photos.length > 0 && (
        <ExistingPhotos photos={entry.photos} />
      )}

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <PhotoInput photos={photos} onChange={setPhotos} disabled={pending} />
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

/** The photos already on an entry being edited. Separate from `PhotoInput`,
 *  which only ever holds files not yet sent — mixing the two would mean one
 *  list where removing a thumbnail sometimes calls the server and sometimes
 *  doesn't. */
function ExistingPhotos({
  photos,
}: {
  photos: JournalEntryView["photos"];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <ul
      className={cn(
        "mt-3 flex flex-wrap gap-2",
        pending && "pointer-events-none opacity-45",
      )}
    >
      {photos.map((photo) => (
        <li key={photo.id} className="group relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/journal/photo/${photo.id}`}
            alt={photo.caption ?? ""}
            loading="lazy"
            className="size-20 rounded-tile object-cover shadow-card"
          />
          <button
            type="button"
            onClick={() => startTransition(() => deleteJournalPhoto(photo.id))}
            aria-label="Remove photo"
            className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-obsidian text-white shadow-card transition-transform duration-(--duration-base) ease-soft active:scale-90 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <X className="size-3.5" strokeWidth={2.5} />
          </button>
        </li>
      ))}
    </ul>
  );
}
