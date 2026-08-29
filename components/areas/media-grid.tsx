"use client";

import { useEffect, useRef, useState } from "react";
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

/** The finger currently on the glass. A ref rather than state: it changes on
 *  every pointermove and nothing rendered reads it. */
type Gesture = {
  x: number;
  y: number;
  id: number;
  /** Which way the finger committed. Until it has moved far enough to tell,
   *  `null` — a vertical drag then abandons rather than sliding the photo
   *  sideways by however much the thumb wandered. */
  axis: "x" | "y" | null;
  width: number;
  /** How far the track has been pulled. It is on the gesture rather than read
   *  back off the `drag` state when the finger lifts, because that would make
   *  committing depend on React having re-rendered between the last move and
   *  the release — true of a real finger, and not something to rest on. */
  travel: number;
  /**
   * The offset this press started from, set only when the photo was already
   * zoomed in — and then the drag moves the **photo** rather than the track.
   * With the picture larger than its frame, the only thing a drag can sensibly
   * mean is "show me the rest of it", and a swipe to the next photo instead
   * would take the zoom away at exactly the moment it is being used.
   */
  pan: { x: number; y: number } | null;
};

/** How far a swipe has to travel before it counts, and 48px is the floor so a
 *  narrow phone doesn't make it trivially easy. */
function commitThreshold(width: number) {
  return Math.max(48, width * 0.18);
}

/** How far into a photo you are, and where. `scale: 1` with no offset is the
 *  photo at rest, which is where every one starts and returns to. */
type Zoom = { scale: number; x: number; y: number };

const REST: Zoom = { scale: 1, x: 0, y: 0 };

/** Past this there is nothing left to see: a photo is downscaled to 1600px on
 *  the long edge before it is stored (§6, "Photos live in Postgres"), so on a
 *  phone 5× is already well into magnifying the compression rather than the
 *  picture. */
const MAX_SCALE = 5;

/** Where a double tap lands. Deliberately short of the maximum — a double tap
 *  means "let me see that bit", and 5× puts you somewhere you then have to pan
 *  your way back out of. */
const TAP_SCALE = 2.5;

/** Two fingers, mid-pinch. */
type Pinch = {
  ids: [number, number];
  /** The spread and midpoint the pinch began at, and the zoom it began from.
   *  Every frame is computed from the start rather than accumulated onto the
   *  last one, so nothing drifts over a long gesture. */
  distance: number;
  midpoint: { x: number; y: number };
  from: Zoom;
  /** Where this photo's centre sits with no transform on it, in client
   *  coordinates — the fixed frame every other number here is measured
   *  against. Read once at the start: `getBoundingClientRect` forces layout,
   *  and this is the one number in the gesture that cannot change during it. */
  centre: { x: number; y: number };
};

/**
 * A new zoom that keeps one point of the photo under the same point of the
 * screen.
 *
 * This is the whole of pinching, and scaling about the centre instead is what
 * makes a zoom feel wrong: whatever you were looking at slides out from under
 * your fingers and you spend the gesture chasing it back. `grabbed` is the
 * screen point whose place on the photo is being held; `to` is where that place
 * has to end up. They are the same point for a pinch that only scales, and
 * differ by however far the fingers also travelled.
 */
function zoomAbout(
  from: Zoom,
  centre: { x: number; y: number },
  grabbed: { x: number; y: number },
  to: { x: number; y: number },
  scale: number,
): Zoom {
  const px = (grabbed.x - centre.x - from.x) / from.scale;
  const py = (grabbed.y - centre.y - from.y) / from.scale;
  return {
    scale,
    x: to.x - centre.x - scale * px,
    y: to.y - centre.y - scale * py,
  };
}

/** Wrapped so the React Compiler can see this is not a render-time read. Every
 *  caller is an event handler. */
function now(): number {
  return Date.now();
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
 *
 * **It swipes, and the swipe is the only way through on a phone.** The arrows
 * are a pointer device's affordance; on a touchscreen a photo viewer that
 * cannot be flicked reads as broken, because every other one can. So the
 * current item and its two neighbours sit on one track and the whole track
 * follows the finger — the next photo is *visible* while you are dragging
 * toward it, which is what tells you the gesture is working before you have
 * committed to it. Committing just moves the index: the neighbour keeps its
 * key, so React keeps the same DOM node and the transition carries it from
 * ±100% to 0 by itself. There is no separate "animate the slide" path to keep
 * in step with the arrows, which take exactly the same route.
 *
 * Only three slides are rendered rather than all ten, so opening a viewer
 * fetches one photo and pre-warms the two you might go to next.
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
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [zoom, setZoom] = useState<Zoom>(REST);
  /** True while a hand is actually moving the photo, so the transform follows
   *  it exactly and only the settle at the end of the gesture is animated. */
  const [zooming, setZooming] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  const pinch = useRef<Pinch | null>(null);
  /** Every pointer currently down. A pinch needs two of them and an event only
   *  ever carries one, so they are collected here rather than inferred. */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastTap = useRef(0);
  const photo = useRef<HTMLImageElement | null>(null);
  /** Set once a gesture becomes a swipe, and read by the background click that
   *  closes the viewer — a flick that ends over the backdrop must not also be
   *  a tap on it. */
  const swiped = useRef(false);
  const videos = useRef(new Map<string, HTMLVideoElement>());
  const item = media[index];

  // **A zoom belongs to the photo, not to the viewer**, so moving to the next
  // one puts it back to rest: arriving at a picture already magnified and
  // off-centre is arriving somewhere you did not go, and the counter would be
  // the only thing saying you had moved at all. Adjusted during render rather
  // than in an effect — this is React's own "a prop changed, reset the state
  // derived from it" case, and the effect version is the synchronous `setState`
  // in an effect the compiler's lint correctly refuses (§9).
  const [shown, setShown] = useState(item.id);
  if (shown !== item.id) {
    setShown(item.id);
    setZoom(REST);
    setZooming(false);
  }

  /**
   * A zoom the photo can actually hold.
   *
   * The pan bound is the photo's own edges: at `scale` the picture is exactly
   * that much larger than the box it was laid out in, so half the difference
   * each way reaches every part of it and one pixel further is empty ground
   * being dragged into view. Reading the layout box rather than the window is
   * also what makes it right for a photo narrower than the screen — the frame
   * that has to stay covered is the photo's, not the viewport's.
   */
  function clampZoom(next: Zoom): Zoom {
    const element = photo.current;
    const scale = Math.min(MAX_SCALE, Math.max(1, next.scale));
    if (!element) return { ...next, scale };
    const maxX = (element.clientWidth * (scale - 1)) / 2;
    const maxY = (element.clientHeight * (scale - 1)) / 2;
    return {
      scale,
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }

  /** Where the current photo's centre would be with no transform on it. The
   *  rect it reads is the transformed one, and `translate` moves a centred
   *  origin by exactly the offset — so subtracting it gives the frame back. */
  function restingCentre(element: HTMLImageElement) {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.x + rect.width / 2 - zoom.x,
      y: rect.y + rect.height / 2 - zoom.y,
    };
  }

  function beginPinch() {
    const element = photo.current;
    const points = [...pointers.current.entries()];
    if (!element || points.length < 2) return;
    const [first, second] = points;
    pinch.current = {
      ids: [first[0], second[0]],
      distance: Math.hypot(first[1].x - second[1].x, first[1].y - second[1].y) || 1,
      midpoint: {
        x: (first[1].x + second[1].x) / 2,
        y: (first[1].y + second[1].y) / 2,
      },
      from: zoom,
      centre: restingCentre(element),
    };
    // A pinch is never also a tap on the ground behind the photo.
    swiped.current = true;
    setZooming(true);
  }

  function movePinch() {
    const active = pinch.current;
    if (!active) return;
    const a = pointers.current.get(active.ids[0]);
    const b = pointers.current.get(active.ids[1]);
    if (!a || !b) return;
    const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const scale = (active.from.scale * distance) / active.distance;
    setZoom(
      clampZoom(
        zoomAbout(active.from, active.centre, active.midpoint, midpoint, scale),
      ),
    );
  }

  function endPinch() {
    pinch.current = null;
    // A finger still down when the other lifts carries straight on as a pan,
    // rather than the photo stopping dead under a hand that is still moving.
    const [remaining] = [...pointers.current.entries()];
    if (remaining && zoom.scale > 1) {
      gesture.current = {
        x: remaining[1].x,
        y: remaining[1].y,
        id: remaining[0],
        axis: null,
        width: window.innerWidth,
        travel: 0,
        pan: { x: zoom.x, y: zoom.y },
      };
    } else {
      setZooming(false);
    }
    // A pinch that ended at life size springs the whole way back, so a photo
    // is never left sitting fractionally off-centre at a scale of 1.
    setZoom((current) => (current.scale <= 1 ? REST : clampZoom(current)));
  }

  /**
   * A double tap, measured on the clock because no browser fires `dblclick` for
   * touch. It is the other way in and out of a zoom — the gesture every phone
   * photo viewer has, and the only one a mouse has at all.
   */
  function tap(x: number, y: number) {
    const at = now();
    const quick = at - lastTap.current < 300;
    lastTap.current = quick ? 0 : at;
    if (!quick) return;
    const element = photo.current;
    if (!element) return;
    setZooming(false);
    if (zoom.scale > 1) {
      setZoom(REST);
      return;
    }
    const point = { x, y };
    setZoom(
      clampZoom(zoomAbout(zoom, restingCentre(element), point, point, TAP_SCALE)),
    );
  }

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

  // A clip used to arrive with `autoPlay`, which only fires on mount — and a
  // neighbour slide is mounted long before it becomes the one you are looking
  // at. So the play is driven from the index instead, which also stops the clip
  // you just swiped away from carrying on playing off screen.
  useEffect(() => {
    for (const [id, element] of videos.current) {
      if (id === item.id) void element.play().catch(() => {});
      else if (!element.paused) element.pause();
    }
  }, [item.id]);

  function endGesture(commit: boolean) {
    const current = gesture.current;
    gesture.current = null;
    setDragging(false);
    setDrag(0);
    if (current?.pan) {
      setZooming(false);
      return;
    }
    if (!current || current.axis !== "x" || !commit) return;
    const threshold = commitThreshold(current.width);
    if (current.travel <= -threshold && index < media.length - 1) {
      onIndex(index + 1);
    } else if (current.travel >= threshold && index > 0) {
      onIndex(index - 1);
    }
  }

  function release(id: number, commit: boolean) {
    pointers.current.delete(id);
    if (pinch.current) {
      // The second finger going up ends the pinch; the first one going up just
      // leaves a pinch with one finger left in it, which the remaining one
      // finishes when it lifts in its turn.
      if (pointers.current.size < 2) endPinch();
      return;
    }
    if (gesture.current && gesture.current.id !== id) return;
    endGesture(commit);
  }

  return createPortal(
    <div
      // §10: anything that closes animates out — hold `closing`, run the exit,
      // unmount on `animationend`, guarded so a child's animation ending does
      // not fire it early. `ContentPanel` is the reference implementation, and
      // this works identically through a portal: Next mounts React on
      // `document`, so the portal container is inside the root container and
      // the delegated listener sees the event bubble.
      className={cn(
        "fixed inset-0 z-50 overflow-hidden bg-viewer",
        closing ? "animate-scrim-out" : "animate-scrim-in",
      )}
      onClick={(event) => {
        if (swiped.current) return;
        // A tap on the photo is not a tap on the ground behind it — the ground
        // closes, the photo doesn't, and a second tap on the photo inside 300ms
        // is the double tap. This lives here rather than on the image because a
        // pan takes pointer capture, which redirects the click to the capture
        // element; a gesture that got that far has set `swiped` and has already
        // returned above.
        if ((event.target as HTMLElement).tagName === "IMG") {
          tap(event.clientX, event.clientY);
          return;
        }
        setClosing(true);
      }}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && closing) onClose();
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        pointers.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        });
        if (pointers.current.size === 1) swiped.current = false;

        // **Two fingers on a photo is a pinch, and it takes over whatever the
        // first one had begun.** A swipe half-committed when the second finger
        // lands is a swipe you changed your mind about, so the track goes back
        // to nought rather than being left hanging between two photos.
        if (pointers.current.size === 2 && item.kind === "photo") {
          gesture.current = null;
          setDragging(false);
          setDrag(0);
          beginPinch();
          return;
        }
        if (pointers.current.size !== 1) return;
        // A gesture that starts on the clip's own controls belongs to the clip:
        // scrubbing is a horizontal drag too, and it is the one the finger
        // meant. Same for the chrome, where a press is a press.
        if ((event.target as HTMLElement).closest("video, button")) return;
        const zoomed = zoom.scale > 1;
        gesture.current = {
          x: event.clientX,
          y: event.clientY,
          id: event.pointerId,
          axis: null,
          width: event.currentTarget.clientWidth || window.innerWidth,
          travel: 0,
          pan: zoomed ? { x: zoom.x, y: zoom.y } : null,
        };
        if (zoomed) setZooming(true);
      }}
      onPointerMove={(event) => {
        const point = pointers.current.get(event.pointerId);
        if (point) {
          point.x = event.clientX;
          point.y = event.clientY;
        }
        if (pinch.current) {
          movePinch();
          return;
        }
        const current = gesture.current;
        if (!current || event.pointerId !== current.id) return;
        const dx = event.clientX - current.x;
        const dy = event.clientY - current.y;

        // **A zoomed photo pans instead of sliding**, in both directions and
        // with no axis to commit to: you are moving a picture around inside a
        // window, and a window has no grain. Capture is taken the first time it
        // genuinely moves, for the same reason the swipe takes it late — a drag
        // that turned out to be a tap still has a click to deliver.
        const pan = current.pan;
        if (pan) {
          if (!swiped.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
            swiped.current = true;
            try {
              event.currentTarget.setPointerCapture(current.id);
            } catch {
              // The capture is a convenience; the drag under it is the control.
            }
          }
          setZoom((z) => clampZoom({ scale: z.scale, x: pan.x + dx, y: pan.y + dy }));
          return;
        }

        if (current.axis === null) {
          if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
          if (Math.abs(dy) >= Math.abs(dx)) {
            gesture.current = null;
            return;
          }
          current.axis = "x";
          setDragging(true);
          // Captured here rather than on `pointerdown`, and that ordering is
          // the point: a captured pointer sends its `click` to the capture
          // element, so capturing every press would make a tap on the photo
          // read as a tap on the backdrop — which closes the viewer. A gesture
          // that has already become a swipe has no click left to protect, and
          // gains a finger that can slide off the element and still deliver its
          // `up`. It throws `NotFoundError` on a pointer that is no longer
          // active, and unguarded that would take the whole gesture with it
          // (§6, "One button, and the gesture chooses").
          try {
            event.currentTarget.setPointerCapture(current.id);
          } catch {
            // The capture is a convenience; the swipe under it is the control.
          }
        }
        swiped.current = true;
        // Resistance at either end, so a swipe with nowhere to go says so by
        // barely moving rather than by doing nothing at all.
        const atEdge =
          (dx > 0 && index === 0) || (dx < 0 && index === media.length - 1);
        current.travel = atEdge ? dx * 0.35 : dx;
        setDrag(current.travel);
      }}
      onPointerUp={(event) => release(event.pointerId, true)}
      onPointerCancel={(event) => release(event.pointerId, false)}
      role="dialog"
      aria-modal="true"
    >
      {/* Only the current slide and its two neighbours. The offsets are
          relative to the current index, so a missing neighbour at either end is
          simply a slide that isn't rendered — no special case, and no track
          whose alignment shifts at the ends. */}
      {[-1, 0, 1].map((offset) => {
        const slide = media[index + offset];
        if (!slide) return null;
        const current = offset === 0;
        return (
          <div
            key={slide.id}
            className={cn(
              "absolute inset-0 flex touch-none select-none items-center justify-center p-4 sm:p-8",
              dragging
                ? "transition-none"
                : "transition-transform duration-(--duration-base) ease-soft",
              !current && "pointer-events-none",
            )}
            style={{
              transform: `translate3d(calc(${offset * 100}% + ${offset * 16}px + ${drag}px), 0, 0)`,
            }}
          >
            {slide.kind === "video" ? (
              <video
                ref={(element) => {
                  if (element) videos.current.set(slide.id, element);
                  else videos.current.delete(slide.id);
                }}
                src={`/api/journal/media/${slide.id}`}
                controls={current}
                playsInline
                preload="metadata"
                onClick={(event) => event.stopPropagation()}
                className="max-h-full max-w-full touch-auto rounded-tile"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                /* Only the slide you are looking at is measurable — the two
                   neighbours are off screen and are not the thing being
                   zoomed. React detaches every changed ref before it attaches
                   any, so moving to the next photo hands this over cleanly. */
                ref={current ? photo : null}
                src={`/api/journal/media/${slide.id}`}
                alt={slide.caption ?? ""}
                draggable={false}
                className={cn(
                  "max-h-full max-w-full rounded-tile object-contain",
                  zooming
                    ? "transition-none"
                    : "transition-transform duration-(--duration-base) ease-soft",
                )}
                style={
                  current && zoom.scale !== 1
                    ? {
                        transform: `translate3d(${zoom.x}px, ${zoom.y}px, 0) scale(${zoom.scale})`,
                      }
                    : undefined
                }
              />
            )}
          </div>
        );
      })}

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
