"use client";

import { useState, useTransition } from "react";
import { BookHeart, Pencil, Trash2, X } from "lucide-react";

import { PhotoInput, type PreparedPhoto } from "@/components/areas/photo-input";
import { Markdown } from "@/components/ui/markdown";
import {
  deleteJournalEntry,
  deleteJournalPhoto,
  saveJournalEntry,
} from "@/lib/journal-actions";
import type { JournalEntryView } from "@/lib/journal";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-chip bg-inset px-3 py-2 text-[13px] text-ink outline-none transition-[background-color,box-shadow] duration-(--duration-base) ease-soft placeholder:text-faint hover:bg-line/60 focus:bg-card focus:ring-2 focus:ring-accent/25";

/**
 * The Journal tab: a composer at the top, then everything written, newest first.
 *
 * **The composer is open, not behind a button.** Every other write in this app
 * goes through a panel, and a panel is right for a form you fill in
 * deliberately. This is the opposite case — the thing being recorded happened
 * thirty seconds ago and you are holding a baby, so the cost of one tap before
 * the cursor exists is the entry not getting written. Same argument as the idea
 * box on Today, one size up.
 *
 * Nothing here can be overdue, ticked, or counted against a target. That is the
 * point of the noun (CLAUDE.md §6, "The Baby area is a journal, not a backlog").
 */
export function Journal({
  areaId,
  areaName,
  entries,
  today,
}: {
  areaId: string;
  areaName: string;
  entries: JournalEntryView[];
  /** "YYYY-MM-DD" computed on the server, so the date input starts on the day
   *  the rest of the page agrees is today rather than the browser's UTC guess. */
  today: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <Composer areaId={areaId} today={today} />

      {entries.length === 0 ? (
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
        <ul className="flex flex-col gap-3">
          {entries.map((entry, index) => (
            <li
              key={entry.id}
              className="animate-rise"
              style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
            >
              {editing === entry.id ? (
                <Composer
                  areaId={areaId}
                  today={today}
                  entry={entry}
                  onDone={() => setEditing(null)}
                />
              ) : (
                <Entry entry={entry} onEdit={() => setEditing(entry.id)} />
              )}
            </li>
          ))}
        </ul>
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] font-medium text-muted">
              {entry.dayLabel}
            </span>
            {entry.isToday && (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                Today
              </span>
            )}
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
  today,
  entry,
  onDone,
}: {
  areaId: string;
  today: string;
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
          defaultValue={entry?.happenedOn ?? today}
          aria-label="The day this is about"
          className={`${field} w-auto`}
        />
        {/* Full width on a phone, beside the date from `sm` up. Sharing a row
            with the date picker at 390px leaves the headline about twelve
            characters wide, which is not a field you would type into. */}
        <input
          name="title"
          defaultValue={entry?.title ?? ""}
          placeholder="A headline, if it deserves one"
          className={`${field} min-w-0 basis-full sm:flex-1 sm:basis-auto`}
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
