"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, Play, X } from "lucide-react";

import type { JournalMediaView } from "@/lib/journal";
import { cn } from "@/lib/utils";

/**
 * The photos and clips on one entry.
 *
 * **Every tile is the same shape, and that is the whole fix.** Before this each
 * item was rendered at its own aspect ratio inside a grid with automatic rows,
 * so four photos — one portrait, one panorama, one square — produced four
 * different heights and rows that did not line up. `object-cover` was already
 * on the image and did nothing, because a box with no fixed height is never the
 * wrong shape to cover. The grid is uniform squares now and the cover crop
 * finally has something to crop to.
 *
 * **A single item is the exception**, and deliberately: one photo is not a grid,
 * it is *the* photo, and cropping it to a square to make a tidy row of one is a
 * trade with nothing on the other side. It renders at its own ratio, capped in
 * height so a portrait shot cannot take a whole screen on its own.
 *
 * **Cropping is only honest because tapping opens the thing uncropped.** A
 * thumbnail grid without a viewer hides the top of somebody's head permanently;
 * with one, the crop is a contact sheet and the photo is still all there. That
 * is also where "Save to photos" moved to — on the tile it was a control on
 * every square of a grid whose whole job is to be quiet.
 */
export function MediaGrid({ media }: { media: JournalMediaView[] }) {
  const [viewing, setViewing] = useState<number | null>(null);

  if (media.length === 0) return null;

  const single = media.length === 1;

  return (
    <>
      <ul
        className={cn(
          // **Capped, because a tile stretches and a photo should not.** On a
          // desktop the journal column is ~1300px, so three tiles sharing it
          // are 420px each — a contact sheet rendered at poster size, which is
          // the same "all over the place" the uneven rows were, one size up.
          // The cap makes a thumbnail thumbnail-sized at every width; the
          // viewer is where a photo gets to be big.
          "mt-4 grid max-w-xl gap-2",
          single ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3",
        )}
      >
        {media.map((item, index) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setViewing(index)}
              aria-label={
                item.kind === "video" ? "Play clip" : "View photo full size"
              }
              className={cn(
                "group relative block w-full overflow-hidden rounded-tile bg-inset shadow-card transition-transform duration-(--duration-base) ease-soft active:scale-[0.985]",
                single ? "max-w-fit" : "aspect-square",
              )}
            >
              <Thumb item={item} single={single} />

              {item.kind === "video" && (
                <span className="pointer-events-none absolute inset-0 grid place-items-center">
                  <span className="grid size-10 place-items-center rounded-full bg-obsidian/70 text-white backdrop-blur-sm">
                    <Play className="size-4 translate-x-px fill-current" strokeWidth={0} />
                  </span>
                </span>
              )}

              {item.kind === "video" && item.durationMs ? (
                <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-full bg-obsidian/80 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
                  {`${Math.round(item.durationMs / 1000)}s`}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      {/* `media[viewing]` guards the case where the entry is edited and a photo
          deleted while the viewer is open — the index would otherwise outlive
          the thing it points at. */}
      {viewing !== null && media[viewing] && (
        <Viewer
          media={media}
          index={viewing}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}

function Thumb({
  item,
  single,
}: {
  item: JournalMediaView;
  single: boolean;
}) {
  const source = `/api/journal/media/${item.id}`;

  // A clip's own first frame is its thumbnail — `preload="metadata"` fetches
  // enough for the browser to paint one and no more. A separate poster image
  // would mean storing a second row of bytes per clip for a picture the file
  // already contains.
  if (item.kind === "video") {
    return (
      <video
        src={source}
        muted
        playsInline
        preload="metadata"
        className={cn(
          "bg-inset",
          single
            ? "max-h-[26rem] w-auto max-w-full"
            : "size-full object-cover",
        )}
      />
    );
  }

  return (
    /* A plain <img>, not next/image: the bytes come from an auth-gated route
       handler, and routing them through the image optimiser would mean a second
       authenticated fetch of the same private data for no gain — they are
       already downscaled to ~1600px before they are stored. */
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={source}
      alt={item.caption ?? ""}
      width={item.width || undefined}
      height={item.height || undefined}
      loading="lazy"
      className={cn(
        "transition-transform duration-(--duration-slow) ease-soft",
        single
          ? "max-h-[26rem] w-auto max-w-full"
          : "size-full object-cover sm:group-hover:scale-[1.03]",
      )}
    />
  );
}

/**
 * One photo or clip, full size, on its own ground.
 *
 * **Portalled to `<body>`, and that is not fussiness.** `animate-rise` finishes
 * with `transform: translateY(0)` under `animation-fill-mode: both`, so every
 * day section on this page permanently carries a transform — and a transformed
 * ancestor is a containing block for `position: fixed`, which would pin this to
 * the day it came from instead of the window. Rendering only when open keeps it
 * off the server, where there is no `document` to portal into.
 */
function Viewer({
  media,
  index,
  onIndex,
  onClose,
}: {
  media: JournalMediaView[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const [closing, setClosing] = useState(false);
  const item = media[index];

  useEffect(() => {
    // The page behind must not scroll under a full-screen photo — on a phone a
    // swipe meant for the next photo otherwise scrolls the journal.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setClosing(true);
      if (event.key === "ArrowRight" && index < media.length - 1) {
        onIndex(index + 1);
      }
      if (event.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, media.length, onIndex]);

  return createPortal(
    <div
      // §10: anything that closes animates out — hold `closing`, run the exit,
      // unmount on `animationend`, guarded so a child's animation ending does
      // not fire it early. `ContentPanel` is the reference implementation, and
      // this works identically through a portal: Next mounts React on
      // `document`, so the portal container is inside the root container and
      // the delegated listener sees the event bubble.
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-viewer p-4 sm:p-8",
        closing ? "animate-scrim-out" : "animate-scrim-in",
      )}
      onClick={() => setClosing(true)}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && closing) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      {item.kind === "video" ? (
        <video
          key={item.id}
          src={`/api/journal/media/${item.id}`}
          controls
          autoPlay
          playsInline
          onClick={(event) => event.stopPropagation()}
          className="max-h-full max-w-full rounded-tile"
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          key={item.id}
          src={`/api/journal/media/${item.id}`}
          alt={item.caption ?? ""}
          onClick={(event) => event.stopPropagation()}
          className="max-h-full max-w-full rounded-tile object-contain"
        />
      )}

      <ViewerButton
        label="Close"
        onClick={() => setClosing(true)}
        className="right-3 top-3 sm:right-5 sm:top-5"
      >
        <X className="size-4.5" strokeWidth={2} />
      </ViewerButton>

      <SaveToPhotos item={item} />

      {index > 0 && (
        <ViewerButton
          label="Previous"
          onClick={() => onIndex(index - 1)}
          className="left-3 top-1/2 -translate-y-1/2 sm:left-5"
        >
          <ChevronLeft className="size-5" strokeWidth={2} />
        </ViewerButton>
      )}
      {index < media.length - 1 && (
        <ViewerButton
          label="Next"
          onClick={() => onIndex(index + 1)}
          className="right-3 top-1/2 -translate-y-1/2 sm:right-5"
        >
          <ChevronRight className="size-5" strokeWidth={2} />
        </ViewerButton>
      )}

      {media.length > 1 && (
        <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/12 px-2.5 py-1 text-[12px] font-medium tabular-nums text-white/85 backdrop-blur-sm">
          {`${index + 1} / ${media.length}`}
        </span>
      )}
    </div>,
    document.body,
  );
}

/** White-on-dark regardless of theme: these sit on the viewer's own ground,
 *  which is dark in both (see `--color-viewer`), not on the page. */
function ViewerButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "absolute grid size-10 place-items-center rounded-full bg-white/12 text-white backdrop-blur-sm transition-[background-color,transform] duration-(--duration-quick) hover:bg-white/22 active:scale-90",
        className,
      )}
    >
      {children}
    </button>
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
function SaveToPhotos({ item }: { item: JournalMediaView }) {
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/journal/media/${item.id}`);
      const blob = await response.blob();
      const file = new File(
        [blob], `journal-${item.id}.${extensionFor(blob.type)}`,
        { type: blob.type },
      );

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
      onClick={(event) => {
        event.stopPropagation();
        void save();
      }}
      disabled={busy}
      aria-label={item.kind === "video" ? "Save clip" : "Save to photos"}
      title="Save to photos"
      className="absolute right-3 top-15 grid size-10 place-items-center rounded-full bg-white/12 text-white backdrop-blur-sm transition-[background-color,transform] duration-(--duration-quick) hover:bg-white/22 active:scale-90 disabled:opacity-40 sm:right-5 sm:top-19"
    >
      <Download className="size-4.5" strokeWidth={2} />
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
