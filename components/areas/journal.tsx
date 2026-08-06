"use client";

import { useState, useTransition } from "react";
import { BookHeart, Download, Pencil, Play, Trash2, X } from "lucide-react";

import { MediaInput, type PreparedMedia } from "@/components/areas/media-input";
import { Markdown } from "@/components/ui/markdown";
import {
  deleteJournalEntry,
  deleteJournalMedia,
  saveJournalEntry,
} from "@/lib/journal-actions";
import type { JournalDayView, JournalEntryView } from "@/lib/journal";
import { cn } from "@/lib/utils";

/** Without a width, so a field can take its own. `field` used to bake in
 *  `w-full`, and `${field} w-auto` on a sibling lost — two width utilities have
 *  equal specificity, so the one Tailwind emits later wins and it is not the one
 *  at the end of your class string. See CLAUDE.md §9. */
const fieldBase =
  "rounded-chip bg-inset px-3 py-2 text-[13px] text-ink outline-none transition-[background-color,box-shadow] duration-(--duration-base) ease-soft placeholder:text-faint hover:bg-line/60 focus:bg-card focus:ring-2 focus:ring-accent/25";

const field = `w-full ${fieldBase}`;

/**
 * The Journal tab: a composer at the top, then everything written, grouped by
 * day, newest day first.
 *
 * **The composer is open, not behind a button.** Every other write in this app
 * goes through a panel, and a panel is right for a form you fill in
 * deliberately. This is the opposite case — the thing being recorded happened
 * thirty seconds ago and you are holding a baby, so the cost of one tap before
 * the cursor exists is the entry not getting written.
 *
 * **You can only write into today, and the date is not a field** (2026-08-06).
 * A day heading has no "+": a day that has passed is closed. What you *can* do
 * is edit what you already wrote — the words and the photos are yours to fix —
 * and that is the whole difference between correcting a record and back-filling
 * one. The point is that a time on an entry is a fact rather than a value
 * somebody chose, which is what makes reading it back years later worth
 * anything. See CLAUDE.md §6, "The date is not a field".
 *
 * Nothing here can be overdue, ticked, or counted against a target. That is the
 * point of the noun (CLAUDE.md §6, "The Baby area is a journal, not a backlog").
 */
export function Journal({
  areaId,
  areaName,
  days,
}: {
  areaId: string;
  areaName: string;
  days: JournalDayView[];
}) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <Composer areaId={areaId} />

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
              </div>

              <div className="flex flex-col gap-3">
                {day.entries.map((entry) =>
                  editing === entry.id ? (
                    <Composer
                      key={entry.id}
                      areaId={areaId}
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

      {entry.media.length > 0 && (
        <ul
          className={cn(
            "mt-4 grid gap-2",
            entry.media.length === 1
              ? "grid-cols-1 sm:max-w-md"
              : "grid-cols-2 sm:grid-cols-3",
          )}
        >
          {entry.media.map((item) => (
            <li key={item.id} className="group relative">
              {item.kind === "video" ? (
                <video
                  src={`/api/journal/media/${item.id}`}
                  controls
                  playsInline
                  preload="metadata"
                  width={item.width || undefined}
                  height={item.height || undefined}
                  className="w-full rounded-tile bg-inset shadow-card"
                />
              ) : (
                /* A plain <img>, not next/image: the bytes come from an
                   auth-gated route handler, and routing them through the image
                   optimiser would mean a second authenticated fetch of the same
                   private data for no gain — they are already downscaled to
                   ~1600px before they are stored. */
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`/api/journal/media/${item.id}`}
                  alt={item.caption ?? ""}
                  width={item.width || undefined}
                  height={item.height || undefined}
                  loading="lazy"
                  className="w-full rounded-tile object-cover shadow-card"
                />
              )}
              <SaveToPhotos item={item} />
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/**
 * Puts a copy of one photo or clip in the phone's camera roll.
 *
 * **This is a button rather than something automatic, and it has to be.** No web
 * API can write to the photo library — a photo taken through `getUserMedia`, or
 * through a file input's `capture`, goes to the page and nowhere else. The
 * nearest honest thing is the native share sheet, where "Save Image" / "Save
 * Video" is one tap, and that is what `navigator.share` with a file opens on
 * iOS and Android.
 *
 * Where the share sheet is unavailable — every desktop browser, and Firefox —
 * it falls back to a download, which on Android lands in the gallery and on a
 * desktop lands in Downloads. Both are the right answer for their platform, and
 * neither is worth a separate button.
 */
function SaveToPhotos({
  item,
}: {
  item: { id: string; kind: "photo" | "video" };
}) {
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const url = `/api/journal/media/${item.id}`;
      const response = await fetch(url);
      const blob = await response.blob();
      const extension = extensionFor(blob.type);
      const file = new File([blob], `journal-${item.id}.${extension}`, {
        type: blob.type,
      });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // A share the user dismissed throws `AbortError`, and so does a share of
      // a type the OS declines to handle. Neither is a failure worth a message
      // on top of a sheet they just closed.
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={save}
      disabled={busy}
      aria-label={item.kind === "video" ? "Save clip" : "Save to photos"}
      title="Save to photos"
      className={cn(
        "absolute right-2 grid size-8 place-items-center rounded-full bg-obsidian/75 text-white shadow-card backdrop-blur-sm transition-[opacity,transform] duration-(--duration-base) ease-soft active:scale-90 disabled:opacity-40",
        // Clear of a <video>'s own control bar, which owns the bottom edge.
        item.kind === "video" ? "top-2" : "bottom-2",
        // Hover is not an affordance on a phone (CLAUDE.md §9).
        "sm:opacity-0 sm:group-hover:opacity-100",
      )}
    >
      <Download className="size-4" strokeWidth={2} />
    </button>
  );
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("quicktime")) return "mov";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  return "jpg";
}

function Composer({
  areaId,
  entry,
  onDone,
}: {
  areaId: string;
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
      className={cn(
        "rounded-tile bg-card p-4 shadow-card sm:p-5",
        pending && "pointer-events-none opacity-45",
      )}
    >
      <input type="hidden" name="areaId" value={areaId} />
      {entry && <input type="hidden" name="id" value={entry.id} />}

      {/* No date field. A new entry lands on today, from the server's clock, and
          an edit never moves an existing one — the point of the journal is that
          its times are facts rather than choices. §6, "The date is not a field". */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
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
        className={`${field} resize-y leading-relaxed`}
      />

      {entry && entry.media.length > 0 && <ExistingMedia media={entry.media} />}

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <MediaInput media={media} onChange={setMedia} disabled={pending} />
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
        <li key={item.id} className="group relative">
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
            className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-obsidian text-white shadow-card transition-transform duration-(--duration-base) ease-soft active:scale-90 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <X className="size-3.5" strokeWidth={2.5} />
          </button>
        </li>
      ))}
    </ul>
  );
}
