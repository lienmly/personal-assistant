"use client";

import {
  useCallback,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Plus } from "lucide-react";

import type { ContentView } from "@/components/studio/types";
import { FORMATS, STAGES, type StageId } from "@/lib/platforms";
import { moveContentItem } from "@/lib/studio-actions";
import { cn } from "@/lib/utils";

/**
 * The pipeline, as five columns.
 *
 * Extracted out of `StudioBoard` on 2026-08-28 so a project page could show its
 * own social media content the same way. Two copies of a kanban is how the two
 * come to disagree about what a stage is called and which way the arrow moves —
 * the same argument `groupByTrack` is shared for on the Tasks tab.
 *
 * **A card no longer wears its channels.** Every card used to carry a row of
 * platform lettermarks, so the board read as a wall of TT/IG/YT before it read
 * as a list of things worth saying — and where a piece goes is the *last*
 * decision about it, not the first. The destination is a field inside the item
 * now (see `ContentPanel`), and all a card keeps of the fan-out is the one fact
 * it can add here: how much of it has actually gone out.
 */

/** How long a finger rests on a card before it lifts. Short enough not to feel
 *  like waiting, long enough that a flick past a card is a scroll. */
const HOLD_MS = 220;
/** A mouse has no hold — it is dragging as soon as it has clearly moved. */
const MOUSE_SLOP = 4;
/** How far a finger may drift during the hold before it counts as a scroll. */
const TOUCH_SLOP = 8;
/** The strip at each end of the board that scrolls it while you hover there. */
const EDGE = 72;
const EDGE_SPEED = 16;

type Pickup = {
  item: ContentView;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  /** Pointer to the card's top-left, so the card does not jump under the
   *  finger at the moment it lifts. */
  offsetX: number;
  offsetY: number;
  width: number;
  timer: number | null;
};

type Drag = {
  item: ContentView;
  width: number;
  offsetX: number;
  offsetY: number;
  /** The stage under the pointer right now, `null` off the board entirely. */
  over: StageId | null;
};

export function ContentColumns({
  items,
  onOpen,
  onNew,
}: {
  items: ContentView[];
  onOpen: (item: ContentView) => void;
  /** Omitted where the surface has no "new item" of its own to offer. */
  onNew?: () => void;
}) {
  const [, startTransition] = useTransition();

  // **The card lands before the server has heard about it.** A stage move is
  // one column over and the round trip is a second or so; without this the card
  // sits where it was, under a finger that has already let go, which reads as a
  // drop that did not take. React reverts this by itself if the action throws,
  // so a failed move snaps back rather than lying.
  const [shown, applyMove] = useOptimistic(
    items,
    (state, move: { id: string; stage: StageId }) =>
      state.map((item) =>
        item.id === move.id ? { ...item, stage: move.stage } : item,
      ),
  );

  const moveTo = useCallback(
    (item: ContentView, stage: StageId) => {
      if (stage === item.stage) return;
      startTransition(async () => {
        applyMove({ id: item.id, stage });
        await moveContentItem(item.id, stage);
      });
    },
    [applyMove],
  );

  const [drag, setDrag] = useState<Drag | null>(null);

  const scroller = useRef<HTMLDivElement | null>(null);
  const ghost = useRef<HTMLDivElement | null>(null);
  const pickup = useRef<Pickup | null>(null);
  // The listeners are created inside `onPointerDown`, so they close over the
  // drag as it was *then*. Everything they need to read back live goes in a ref
  // beside the state rather than in it.
  const live = useRef<Drag | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const teardown = useRef<(() => void) | null>(null);
  const edge = useRef(0);
  const frame = useRef<number | null>(null);

  const setDragState = useCallback((next: Drag | null) => {
    live.current = next;
    setDrag(next);
  }, []);

  const placeGhost = useCallback(() => {
    const node = ghost.current;
    const current = live.current;
    if (!node || !current) return;
    node.style.transform = `translate3d(${pointer.current.x - current.offsetX}px, ${
      pointer.current.y - current.offsetY
    }px, 0)`;
  }, []);

  /** Which column is under the pointer. The ghost is `pointer-events-none`, so
   *  this reads the board rather than the thing being carried over it. */
  const updateOver = useCallback(() => {
    const current = live.current;
    if (!current) return;
    const under = document
      .elementFromPoint(pointer.current.x, pointer.current.y)
      ?.closest("[data-stage]");
    const over = (under?.getAttribute("data-stage") as StageId | null) ?? null;
    if (over !== current.over) setDragState({ ...current, over });
  }, [setDragState]);

  const stopEdgeScroll = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    edge.current = 0;
  }, []);

  const runEdgeScroll = useCallback(() => {
    if (frame.current !== null) return;
    const step = () => {
      frame.current = null;
      const box = scroller.current;
      if (!live.current || !box || edge.current === 0) return;
      box.scrollLeft += edge.current;
      // The finger has not moved but the board has, so the column underneath it
      // has changed — without this the highlight lags a whole column behind.
      updateOver();
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }, [updateOver]);

  const endGesture = useCallback(() => {
    const from = pickup.current;
    if (from?.timer != null) window.clearTimeout(from.timer);
    teardown.current?.();
    teardown.current = null;
    pickup.current = null;
    stopEdgeScroll();
    // **A drag that began on a card ends in a `click` on it**, so without this
    // every drop would also open the panel for the thing you just moved.
    //
    // It swallows exactly *that* click and then stands down. The first version
    // was a sticky ref cleared by the next click on a card, and it was wrong in
    // the commonest case there is: a drop lands on a different column, no click
    // is ever delivered to the source card, and the flag sits armed until you
    // next tap anything — which ate a real click, minutes later, on something
    // unrelated. The timeout is what stands it down when no click arrives;
    // `once` is what stands it down when one does.
    if (live.current) {
      const swallow = (click: MouseEvent) => {
        click.stopPropagation();
        click.preventDefault();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
      window.setTimeout(
        () => window.removeEventListener("click", swallow, { capture: true }),
        0,
      );
    }
    setDragState(null);
  }, [setDragState, stopEdgeScroll]);

  const lift = useCallback(
    (from: Pickup, x: number, y: number) => {
      if (from.timer !== null) window.clearTimeout(from.timer);
      pointer.current = { x, y };
      setDragState({
        item: from.item,
        width: from.width,
        offsetX: from.offsetX,
        offsetY: from.offsetY,
        over: from.item.stage as StageId,
      });
    },
    [setDragState],
  );

  function onPointerDown(
    event: React.PointerEvent<HTMLDivElement>,
    item: ContentView,
  ) {
    // A right-click is a context menu, and a second finger is a pinch.
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (pickup.current || live.current) return;
    // **A gesture that never got its `pointerup` would otherwise leave its
    // listeners behind** — the window loses focus mid-drag, the tab is
    // switched, a devtools overlay eats the release — and the next press would
    // then run two of everything, with the stale copy holding the *previous*
    // card. Tearing down unconditionally costs nothing when there is nothing
    // to tear down, and it is the only place that can be sure.
    teardown.current?.();
    teardown.current = null;

    const box = event.currentTarget.getBoundingClientRect();
    const from: Pickup = {
      item,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - box.left,
      offsetY: event.clientY - box.top,
      width: box.width,
      timer: null,
    };
    pickup.current = from;

    const onMove = (moved: PointerEvent) => {
      const current = pickup.current;
      if (!current || moved.pointerId !== current.pointerId) return;

      if (!live.current) {
        const dx = moved.clientX - current.startX;
        const dy = moved.clientY - current.startY;
        if (current.pointerType === "mouse") {
          if (Math.abs(dx) < MOUSE_SLOP && Math.abs(dy) < MOUSE_SLOP) return;
          lift(current, moved.clientX, moved.clientY);
        } else {
          // A finger that moves before the hold fires is scrolling, and that is
          // the commoner gesture by far — so it wins, and the card stays put.
          if (Math.abs(dx) > TOUCH_SLOP || Math.abs(dy) > TOUCH_SLOP) {
            endGesture();
          }
          return;
        }
      }

      pointer.current = { x: moved.clientX, y: moved.clientY };
      placeGhost();
      updateOver();

      const box2 = scroller.current?.getBoundingClientRect();
      if (box2) {
        const fromLeft = moved.clientX - box2.left;
        const fromRight = box2.right - moved.clientX;
        edge.current =
          fromLeft < EDGE
            ? -Math.ceil(EDGE_SPEED * (1 - Math.max(fromLeft, 0) / EDGE))
            : fromRight < EDGE
              ? Math.ceil(EDGE_SPEED * (1 - Math.max(fromRight, 0) / EDGE))
              : 0;
        if (edge.current !== 0) runEdgeScroll();
        else stopEdgeScroll();
      }
    };

    const onUp = (up: PointerEvent) => {
      const current = live.current;
      if (current && up.pointerId === from.pointerId) {
        const target = current.over;
        if (target) moveTo(current.item, target);
      }
      endGesture();
    };

    const onCancel = () => endGesture();

    const onKey = (key: KeyboardEvent) => {
      if (key.key === "Escape") endGesture();
    };

    // Losing the window mid-drag means the release will never arrive here. Drop
    // the card where it is rather than leaving it stuck to a pointer that has
    // gone somewhere else.
    const onBlur = () => endGesture();

    // **`touch-action` cannot be changed mid-gesture** — the browser fixes it
    // when the finger lands — so the only way to stop the page scrolling out
    // from under a card already in the air is to refuse the `touchmove`
    // outright, which needs a non-passive listener. It is safe to refuse here
    // *because* a finger only gets this far by holding still: no scroll has
    // begun, so nothing is being interrupted.
    const blockScroll = (touch: TouchEvent) => {
      if (live.current) touch.preventDefault();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onBlur);
    window.addEventListener("touchmove", blockScroll, { passive: false });
    teardown.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("touchmove", blockScroll);
    };

    if (from.pointerType !== "mouse") {
      from.timer = window.setTimeout(
        () => lift(from, from.startX, from.startY),
        HOLD_MS,
      );
    }
  }

  return (
    <>
      <div
        ref={scroller}
        className="-mx-4 overflow-x-auto px-4 pb-3 md:mx-0 md:px-0"
      >
        <div className="flex min-w-max gap-4">
          {STAGES.map((stage, stageIndex) => {
            const column = shown.filter((item) => item.stage === stage.id);
            const landing =
              drag !== null &&
              drag.over === stage.id &&
              drag.item.stage !== stage.id;
            return (
              <div
                key={stage.id}
                data-stage={stage.id}
                /* Columns arrive left to right, so the board reads as a
                   pipeline rather than five things appearing at once. */
                style={{ animationDelay: `${stageIndex * 45}ms` }}
                className={cn(
                  "flex w-[248px] animate-rise flex-col rounded-card bg-card p-3.5 shadow-card transition-shadow duration-(--duration-base) ease-soft",
                  landing && "ring-2 ring-accent/35",
                )}
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <div>
                    <span className="text-[13px] font-semibold tracking-tight text-ink">
                      {stage.label}
                    </span>
                    <p className="text-[11px] text-faint">{stage.hint}</p>
                  </div>
                  <span className="rounded-full bg-inset px-2 py-0.5 text-[11px] font-medium text-muted">
                    {column.length}
                  </span>
                </div>

                <div className="flex min-h-[180px] flex-1 flex-col gap-2">
                  {column.map((item, cardIndex) => (
                    <ContentCard
                      key={item.id}
                      item={item}
                      /* Cards are keyed on id, so this replays whenever a card
                         genuinely mounts — filtering by brand, or arriving in a
                         new column after a stage move — and not on re-render. */
                      delayMs={stageIndex * 45 + cardIndex * 35}
                      carried={drag?.item.id === item.id}
                      onOpen={() => onOpen(item)}
                      onPointerDown={(event) => onPointerDown(event, item)}
                      onAdvance={(next) => moveTo(item, next)}
                    />
                  ))}

                  {/* Where the card will land, at the end of the column it is
                      being carried into. A highlighted column says *which*; this
                      says *that it will go somewhere*, which is the half a ring
                      around a full column cannot say. */}
                  {landing && (
                    <div className="h-[52px] shrink-0 animate-rise rounded-tile border border-dashed border-accent/50 bg-accent-soft/40" />
                  )}

                  {column.length === 0 &&
                    !landing &&
                    (onNew ? (
                      <button
                        type="button"
                        onClick={onNew}
                        className="flex flex-1 animate-rise items-center justify-center rounded-tile border border-dashed border-line text-faint transition-colors duration-(--duration-quick) hover:border-muted hover:text-muted"
                      >
                        <Plus className="size-4" strokeWidth={2} />
                      </button>
                    ) : (
                      <div className="flex-1 rounded-tile border border-dashed border-line" />
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* **Portalled, and that is not fussiness.** `animate-rise` ends on
          `translateY(0)` under `fill-mode: both`, so every column permanently
          carries a transform — and a transformed ancestor is the containing
          block for `position: fixed`, which would pin the card being carried
          inside the column it came from. The board's own `overflow-x-auto`
          would then clip it as well. Same mechanism §9 records for the media
          viewer, the journal's dropdown and the camera sheet. */}
      {drag !== null &&
        createPortal(
          <div
            ref={(node) => {
              ghost.current = node;
              if (node) placeGhost();
            }}
            style={{ width: drag.width }}
            className="pointer-events-none fixed left-0 top-0 z-[60] rotate-[1.5deg] rounded-tile bg-card p-3 shadow-float"
          >
            <CardFace item={drag.item} />
          </div>,
          document.body,
        )}
    </>
  );
}

function ContentCard({
  item,
  delayMs,
  carried,
  onOpen,
  onPointerDown,
  onAdvance,
}: {
  item: ContentView;
  delayMs: number;
  /** True while this is the card in the air — what is left here is its hole. */
  carried: boolean;
  onOpen: () => void;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onAdvance: (stage: StageId) => void;
}) {
  const stageIndex = STAGES.findIndex((stage) => stage.id === item.stage);
  const next = STAGES[stageIndex + 1];
  const untitled = item.title.trim() === "";

  return (
    <div
      onPointerDown={onPointerDown}
      onContextMenu={(event) => {
        // Android raises a context menu on the same long press that lifts a
        // card, and iOS raises the selection callout. `contextmenu` is typed as
        // a plain MouseEvent, but a touch-raised one carries `pointerType` —
        // which is the only way to tell it from a right-click.
        const native = event.nativeEvent as MouseEvent & {
          pointerType?: string;
        };
        if (native.pointerType !== "mouse") event.preventDefault();
      }}
      style={{ animationDelay: `${delayMs}ms`, WebkitTouchCallout: "none" }}
      className={cn(
        "group animate-rise select-none rounded-tile bg-inset p-3 text-left transition-[background-color,box-shadow,transform,opacity] duration-(--duration-base) ease-soft",
        // A 1px lift and the barely-there shadow — same trick the reference uses
        // for depth. Anything larger reads as a different design.
        "hover:-translate-y-px hover:bg-card hover:shadow-card",
        untitled && "border border-dashed border-line bg-transparent",
        // The card is in the air; this is the space it will come back to if the
        // drag is abandoned, so it stays exactly the size it was.
        carried && "opacity-30 hover:translate-y-0 hover:bg-inset hover:shadow-none",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left transition-transform duration-(--duration-quick) ease-soft active:scale-[0.985]"
      >
        <CardFace item={item} />
      </button>

      {next && (
        <button
          type="button"
          onClick={() => onAdvance(next.id)}
          className="group/next mt-2 flex w-full items-center justify-center gap-1 rounded-chip py-1 text-[11px] text-faint opacity-0 transition-[opacity,background-color,color] duration-(--duration-base) ease-soft hover:bg-inset hover:text-ink group-hover:opacity-100 disabled:opacity-40 max-md:opacity-100"
        >
          {next.label}
          {/* The arrow nudges toward the column the card is about to land in. */}
          <ChevronRight
            className="size-3 transition-transform duration-(--duration-base) ease-soft group-hover/next:translate-x-0.5"
            strokeWidth={2.4}
          />
        </button>
      )}
    </div>
  );
}

/** What a card says, in one place — because it is said twice: once in the
 *  column, and once more on the copy that follows your finger. Two renderings
 *  of a card is how the thing you are carrying stops looking like the thing you
 *  picked up. */
function CardFace({ item }: { item: ContentView }) {
  const untitled = item.title.trim() === "";
  const postedCount = item.channels.filter(
    (row) => row.state === "published",
  ).length;

  return (
    <>
      <div className="mb-1.5 flex items-center gap-1.5">
        <span
          className="size-1.5 shrink-0 rounded-full"
          style={{ background: item.brand.color }}
        />
        <span className="truncate text-[11px] font-medium text-muted">
          {item.brand.name}
        </span>
        {item.sourceItemId && (
          <span
            title="Repurposed from another piece"
            className="text-[11px] text-faint"
          >
            &#8629;
          </span>
        )}
      </div>

      <p
        className={cn(
          "text-[13px] font-medium leading-snug",
          untitled ? "text-faint" : "text-ink",
        )}
      >
        {untitled
          ? item.series
            ? `${item.series.name} — empty slot`
            : "Untitled"
          : item.title}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-faint">
        <span>{FORMATS[item.format].label}</span>
        {item.project && (
          <>
            <span>·</span>
            <span className="truncate">{item.project.name}</span>
          </>
        )}
        {item.publishLabel && (
          <>
            <span>·</span>
            <span className={cn(item.isToday && "font-medium text-accent")}>
              {item.isToday ? "Today" : item.publishLabel}
            </span>
          </>
        )}
        {/* The one thing the fan-out is still worth saying on a card: how
            much of it has gone out. *Which* accounts is a question you ask
            inside the item, on the day you post it. */}
        {postedCount > 0 && postedCount < item.channels.length && (
          <>
            <span>·</span>
            <span>
              {postedCount}/{item.channels.length} posted
            </span>
          </>
        )}
      </div>
    </>
  );
}
