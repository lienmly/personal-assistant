"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { RefreshCw, Sparkles, X } from "lucide-react";

import {
  DEFAULT_FILTER,
  JOURNAL_FILTERS,
  canBakeFilters,
  drawVignette,
  filterById,
  vignetteCss,
} from "@/lib/journal-filters";
import { cn } from "@/lib/utils";

/** Ten seconds, and it is a hard stop rather than a suggestion. A clip is
 *  stored in Postgres like everything else here, so its length is its cost:
 *  ten seconds at the bitrate below lands around 1.5–2MB, against ~75KB for a
 *  photo. Long enough for her to do the thing; short enough to keep. */
export const MAX_CLIP_MS = 10_000;

/** Modest on purpose — see above. 720p at 1.5Mbps is well past what a phone
 *  screen resolves for a ten-second clip of a baby. */
const VIDEO_BITS_PER_SECOND = 1_500_000;
const AUDIO_BITS_PER_SECOND = 64_000;

/** The longest edge kept, matching `MAX_EDGE` in the media input. */
const PHOTO_MAX_EDGE = 1600;
const VIDEO_MAX_EDGE = 1280;

/**
 * What `MediaRecorder` is asked for, best first.
 *
 * Safari produces MP4/H.264 and rejects WebM; Chrome and Firefox are the other
 * way round. Rather than sniff the browser, ask each in turn — `isTypeSupported`
 * is the question the browser can actually answer. The base type is what gets
 * stored; see `baseMime` in `lib/media-store.ts`.
 */
const RECORDER_TYPES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

export type CapturedMedia = {
  file: File;
  width: number;
  height: number;
  kind: "photo" | "video";
  durationMs: number | null;
};

/** The rectangle of the camera's frame that is actually on screen. */
type Crop = { sx: number; sy: number; sw: number; sh: number };

let recorderTypeCache: string | null | undefined;

function pickRecorderType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  if (recorderTypeCache === undefined) {
    recorderTypeCache =
      RECORDER_TYPES.find((type) => MediaRecorder.isTypeSupported?.(type)) ??
      null;
  }
  return recorderTypeCache;
}

/**
 * A browser capability, read the way `lib/theme-store.ts` reads the clock.
 *
 * Whether the canvas can bake a filter and whether `MediaRecorder` exists are
 * facts about the browser, which is an external system — so they are subscribed
 * to rather than assigned in an effect (the React Compiler rejects the latter,
 * correctly). `subscribe` is a no-op because the answer cannot change while the
 * page is open, and the server snapshot is `false` so the markup React renders
 * on the server matches the markup it hydrates against; the real answer arrives
 * a frame later and the control appears.
 */
const noSubscribe = () => () => {};
const serverFalse = () => false;

function useCapability(probe: () => boolean): boolean {
  return useSyncExternalStore(noSubscribe, probe, serverFalse);
}

const probeFilters = () => canBakeFilters();
const probeRecorder = () => pickRecorderType() !== null;

/** Wrapped so the React Compiler can see this is not a render-time read. Every
 *  caller is an event handler or a callback. */
function now(): number {
  return Date.now();
}

/** The shutter ring's geometry. One place, because the SVG and the arithmetic
 *  that fills it have to agree. */
const RING_RADIUS = 34;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/**
 * The in-app camera: a viewfinder that fills the screen, with everything else
 * floating over it.
 *
 * **The preview *is* the screen** (2026-08-09, modelled on TikTok's capture
 * layout). It used to be a stacked card — a header row, a 4:3 tile, a filter
 * row, two buttons — which spent well over half a phone's height on chrome
 * around a picture you are holding the phone up to take. Every native camera
 * puts the frame edge to edge and the controls on top of it, for the good reason
 * that the only thing you are looking at is the frame. So: a full-bleed preview,
 * a close and a flip floating in the corners, a mode strip and one big shutter
 * at the bottom, and the colour grades tucked behind a toggle so the default
 * state is just the picture.
 *
 * **The chrome is white-on-dark in both themes, deliberately.** This is the same
 * argument `--color-viewer` makes (CLAUDE.md §6, "A thumbnail is a promise"): a
 * viewfinder is dark everywhere, and a light-theme camera would put a pale bar
 * over live video. The one accent on the surface is the shutter, which is §9's
 * one-accent-per-region budget spent on the thing you came here to press.
 *
 * **What you see is what gets stored.** The preview covers its box, so a 16:9
 * camera in a portrait frame has its sides off screen — and the capture crops to
 * exactly the same rectangle rather than quietly storing the whole sensor frame.
 * That is the rule the filters already follow (one CSS string, two consumers, so
 * a preview cannot lie about the result), applied to geometry.
 *
 * **It is portalled to `<body>`, and that is load-bearing rather than tidy.**
 * `animate-rise` finishes on `transform: translateY(0)` under
 * `animation-fill-mode: both`, so every day section in the journal permanently
 * carries a transform — and a transformed ancestor is the containing block for
 * `position: fixed`. Rendered in place, a "full screen" camera is pinned inside
 * the day it was opened from: on a desktop the section is nearly the width of
 * the page and it looks almost right, and on a phone the viewfinder starts below
 * the tab strip and ends above the tab bar. Same mechanism the media viewer
 * portals around (CLAUDE.md §6, "A thumbnail is a promise"), found the same way
 * — by looking at it at 390px rather than by reading it.
 *
 * **What this cannot do, and says so on screen: save to the phone's camera
 * roll.** There is no web API that writes to the photo library, and a photo
 * captured here goes to the page rather than to Photos — on iOS especially,
 * that surprises people. What it can do is hand a finished photo to the native
 * share sheet, where "Save Image" is one tap; that lives on the entry itself
 * (`SaveToPhotos` in `journal.tsx`) rather than here, because it is worth having
 * for photos that arrived from the library too.
 *
 * Everything is torn down in one place — `stopStream()` — and it is called on
 * close, on unmount and before every camera flip. A `getUserMedia` stream that is
 * not explicitly stopped leaves the camera light on, which on a phone reads as
 * the app watching you.
 */
export function CameraSheet({
  onCapture,
  onClose,
}: {
  onCapture: (media: CapturedMedia) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const drawRef = useRef<number | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [filterId, setFilterId] = useState(DEFAULT_FILTER.id);
  const [mode, setMode] = useState<"photo" | "clip">("photo");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);

  // Both are capability questions with a stable answer, and both decide whether
  // a control is rendered at all.
  const canFilter = useCapability(probeFilters);
  const canRecord = useCapability(probeRecorder);

  const filter = filterById(filterId);

  const stopStream = useCallback(() => {
    if (drawRef.current !== null) {
      cancelAnimationFrame(drawRef.current);
      drawRef.current = null;
    }
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // Open the camera, and reopen it when the facing mode flips.
  useEffect(() => {
    let cancelled = false;

    async function open() {
      setReady(false);
      setError(null);

      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser has no camera access.");
        return;
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      // Audio up front, so a clip has sound and there is only ever one
      // permission prompt. If the mic is refused separately, a silent clip is a
      // great deal better than no camera.
      const stream = await navigator.mediaDevices
        .getUserMedia({ ...constraints, audio: true })
        .catch(() => navigator.mediaDevices.getUserMedia(constraints))
        .catch(() => null);

      if (cancelled) {
        stream?.getTracks().forEach((track) => track.stop());
        return;
      }

      if (!stream) {
        setError(
          "Couldn't open the camera. Check the site's camera permission and try again.",
        );
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        // iOS will not autoplay an inline video that isn't muted, and a preview
        // that plays its own microphone back is a feedback loop.
        await video.play().catch(() => undefined);
      }
      setReady(true);
    }

    open();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [facing, stopStream]);

  /**
   * The part of the camera's frame the preview is actually showing.
   *
   * The `<video>` is `object-cover` inside a frame that is rarely the camera's
   * own shape — a 16:9 webcam in a portrait window loses its sides. Capturing
   * the whole sensor frame would store a picture nobody composed, wider than the
   * one on screen, which is the same failure the filters go to some trouble to
   * avoid: **the preview must not lie about the result.**
   *
   * Read once per capture rather than per frame — `clientWidth` forces layout,
   * and a clip repainting through a canvas would ask thirty times a second.
   */
  function cropOf(): Crop {
    const video = videoRef.current;
    const sw = video?.videoWidth || 1280;
    const sh = video?.videoHeight || 720;

    const box = frameRef.current;
    if (!box?.clientWidth || !box.clientHeight) return { sx: 0, sy: 0, sw, sh };

    const shown = box.clientWidth / box.clientHeight;
    const source = sw / sh;
    // A hair of tolerance, so a frame that already matches takes the cheap path
    // rather than a 1px crop.
    if (Math.abs(source - shown) < 0.01) return { sx: 0, sy: 0, sw, sh };

    if (source > shown) {
      const width = Math.round(sh * shown);
      return { sx: Math.round((sw - width) / 2), sy: 0, sw: width, sh };
    }
    const height = Math.round(sw / shown);
    return { sx: 0, sy: Math.round((sh - height) / 2), sw, sh: height };
  }

  function isCropped(crop: Crop): boolean {
    const video = videoRef.current;
    return (
      crop.sw !== (video?.videoWidth || 1280) ||
      crop.sh !== (video?.videoHeight || 720)
    );
  }

  /** The stored size: the visible rectangle, scaled to fit `maxEdge`. Even, so
   *  no encoder has to round it. */
  function outputSize(crop: Crop, maxEdge: number) {
    const scale = Math.min(1, maxEdge / Math.max(crop.sw, crop.sh));
    return {
      width: Math.max(2, Math.round((crop.sw * scale) / 2) * 2),
      height: Math.max(2, Math.round((crop.sh * scale) / 2) * 2),
    };
  }

  function paint(
    context: CanvasRenderingContext2D,
    crop: Crop,
    width: number,
    height: number,
  ) {
    const video = videoRef.current;
    if (!video) return;
    context.filter = canFilter ? filter.css : "none";
    context.drawImage(
      video,
      crop.sx,
      crop.sy,
      crop.sw,
      crop.sh,
      0,
      0,
      width,
      height,
    );
    if (canFilter) drawVignette(context, width, height, filter.vignette);
  }

  async function takePhoto() {
    if (!ready || busy) return;
    setBusy(true);

    const crop = cropOf();
    const { width, height } = outputSize(crop, PHOTO_MAX_EDGE);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Couldn't capture that frame.");
      setBusy(false);
      return;
    }

    paint(context, crop, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    setBusy(false);
    if (!blob) {
      setError("Couldn't capture that frame.");
      return;
    }

    const name = `${stamp()}.jpg`;
    onCapture({
      file: new File([blob], name, { type: "image/jpeg" }),
      width,
      height,
      kind: "photo",
      durationMs: null,
    });
  }

  function startClip() {
    const stream = streamRef.current;
    const type = pickRecorderType();
    if (!ready || busy || recording || !stream || !type) return;

    const crop = cropOf();
    const { width, height } = outputSize(crop, VIDEO_MAX_EDGE);

    // The camera's own track is recorded directly whenever it is already the
    // picture on screen — better quality, and far less work than repainting
    // every frame through a canvas on a phone. A filter or a crop makes the
    // canvas the picture instead, so it becomes the source and the microphone is
    // added back. On a phone the preview usually matches the camera's shape, so
    // the cheap path is the common one.
    const filtered = canFilter && filter.id !== DEFAULT_FILTER.id;
    let source: MediaStream;
    let canvas: HTMLCanvasElement | null = null;

    if (!filtered && !isCropped(crop)) {
      source = stream;
    } else {
      canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        setError("Couldn't start recording.");
        return;
      }

      const draw = () => {
        paint(context, crop, width, height);
        drawRef.current = requestAnimationFrame(draw);
      };
      draw();

      source = canvas.captureStream(30);
      const audio = stream.getAudioTracks()[0];
      if (audio) source.addTrack(audio);
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(source, {
        mimeType: type,
        videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
      });
    } catch {
      setError("Couldn't start recording on this browser.");
      return;
    }

    const chunks: BlobPart[] = [];
    const startedAt = now();

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    recorder.onstop = () => {
      if (drawRef.current !== null) {
        cancelAnimationFrame(drawRef.current);
        drawRef.current = null;
      }
      // Only the canvas-derived stream is ours to stop; the camera's own tracks
      // belong to the preview and must survive the recording.
      if (canvas) source.getVideoTracks().forEach((track) => track.stop());

      setRecording(false);
      setElapsed(0);
      recorderRef.current = null;

      if (chunks.length === 0) {
        setError("That clip came back empty.");
        return;
      }

      const blob = new Blob(chunks, { type: recorder.mimeType || type });
      const extension = blob.type.includes("mp4") ? "mp4" : "webm";
      const name = `${stamp()}.${extension}`;

      onCapture({
        file: new File([blob], name, { type: blob.type }),
        width,
        height,
        kind: "video",
        durationMs: Math.min(MAX_CLIP_MS, now() - startedAt),
      });
    };

    recorderRef.current = recorder;
    // A timeslice, so a recording interrupted by the tab going away still has
    // most of its data rather than one pending blob that never arrives.
    recorder.start(500);
    setRecording(true);

    stopTimerRef.current = setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, MAX_CLIP_MS);
  }

  function stopClip() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }

  function press() {
    if (mode === "photo") {
      takePhoto();
      return;
    }
    if (recording) stopClip();
    else startClip();
  }

  // The countdown ring. A recording that stops by itself at ten seconds needs to
  // say so before it happens, or the cut reads as a failure.
  useEffect(() => {
    if (!recording) return;
    const started = now();
    const timer = setInterval(
      () => setElapsed(Math.min(MAX_CLIP_MS, now() - started)),
      100,
    );
    return () => clearInterval(timer);
  }, [recording]);

  // The page behind must not scroll under a full-screen viewfinder — the same
  // rule the media viewer follows, and for the same reason: on a phone a drag
  // meant for the camera would otherwise scroll the journal underneath it.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Escape closes, which is the one keyboard affordance a full-screen overlay
  // genuinely owes.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !recording) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, recording]);

  const remaining = Math.ceil((MAX_CLIP_MS - elapsed) / 1000);
  const modes: { id: "photo" | "clip"; label: string }[] = canRecord
    ? [
        { id: "photo", label: "Photo" },
        { id: "clip", label: "10s clip" },
      ]
    : [{ id: "photo", label: "Photo" }];

  /* Full screen on a phone, a phone-shaped window on a pointer device.
   *
   * A camera in a small landscape card is a camera you are looking at a third
   * of. Above `sm` there is a pointer, a large display and other things worth
   * still seeing, so it stays a window — but the *shape* is the same at both
   * sizes now, which is what lets one set of overlaid controls serve both.
   *
   * Portalled — see the note on the component. `CameraSheet` is only ever
   * rendered while open, so there is no `document` touched on the server. */
  return createPortal(
    <div
      className="animate-scrim-in fixed inset-0 z-50 bg-scrim sm:grid sm:place-items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Camera"
    >
      <div
        ref={frameRef}
        /* `animate-rise`, not `animate-panel-in`: this arrives, it does not
           slide in from the edge. The panel animation is the side panel's, and
           on a centred dialog it reads as the wrong thing coming from the wrong
           place (§10 — `animate-rise` is what cards and surfaces arrive with). */
        className="animate-rise relative h-full w-full overflow-hidden bg-black sm:h-[min(78vh,44rem)] sm:w-[min(26rem,92vw)] sm:rounded-card sm:shadow-float"
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 size-full object-cover"
          style={{ filter: canFilter ? filter.css : undefined }}
        />
        {canFilter && filter.vignette > 0 && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: vignetteCss(filter.vignette) }}
          />
        )}

        {/* Two gradients, and they are not decoration: white chrome over live
            video is legible against a face and invisible against a window. A
            scrim at each end costs nothing and makes every control readable
            whatever is being filmed. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />

        {!ready && !error && (
          <p className="absolute inset-0 grid place-items-center text-[13px] text-white/70">
            Opening the camera…
          </p>
        )}
        {error && (
          <p className="absolute inset-0 grid place-items-center px-8 text-center text-[13px] leading-relaxed text-white/80">
            {error}
          </p>
        )}

        {/* ── Top: close, and the recording clock ──────────────────────────── */}
        <div
          className="absolute inset-x-0 top-0 flex items-start justify-between p-3"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <GlassButton
            onClick={onClose}
            disabled={recording}
            label="Close camera"
          >
            <X className="size-5" strokeWidth={2} />
          </GlassButton>

          {recording && (
            <span className="mt-1 flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-white">
              <span className="size-1.5 animate-pulse rounded-full bg-white" />
              {`${remaining}s`}
            </span>
          )}

          {/* The rail. Flip, and the grades — both are things you do *to* the
              shot, which is why they sit together and away from the shutter. */}
          <div className="flex flex-col gap-2">
            <GlassButton
              onClick={() =>
                setFacing((value) => (value === "user" ? "environment" : "user"))
              }
              disabled={recording || !ready}
              label="Switch camera"
            >
              <RefreshCw className="size-4.5" strokeWidth={2} />
            </GlassButton>
            {canFilter && (
              <GlassButton
                onClick={() => setFiltersOpen((open) => !open)}
                disabled={recording}
                label={filtersOpen ? "Hide filters" : "Show filters"}
                active={filtersOpen || filter.id !== DEFAULT_FILTER.id}
              >
                <Sparkles className="size-4.5" strokeWidth={2} />
              </GlassButton>
            )}
          </div>
        </div>

        {/* ── Bottom: grades, mode, shutter ────────────────────────────────── */}
        <div
          className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-4 pt-4"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          {canFilter && filtersOpen && (
            <div className="no-scrollbar -mx-4 flex max-w-full gap-1.5 overflow-x-auto px-4">
              {JOURNAL_FILTERS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setFilterId(entry.id)}
                  className={cn(
                    "shrink-0 rounded-chip px-3 py-1.5 text-[12px] transition-[background-color,color] duration-(--duration-base) ease-soft active:scale-[0.97]",
                    entry.id === filterId
                      ? "bg-white font-medium text-black"
                      : "bg-white/15 text-white/85 backdrop-blur-sm hover:bg-white/25",
                  )}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          )}

          {/* The mode strip, and it replaces two buttons that both looked like
              the primary action. Naming the mode first and then pressing one
              shutter is how every camera works, and it is what makes room for a
              shutter big enough to hit one-handed. Hidden while recording: the
              answer is already committed and a live control that cannot be used
              is just noise. */}
          <div
            className={cn(
              "flex items-center gap-1 transition-opacity duration-(--duration-base) ease-soft",
              recording && "pointer-events-none opacity-0",
            )}
          >
            {modes.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setMode(entry.id)}
                aria-pressed={mode === entry.id}
                className={cn(
                  "rounded-chip px-3.5 py-1.5 text-[12.5px] transition-[background-color,color] duration-(--duration-base) ease-soft active:scale-[0.97]",
                  mode === entry.id
                    ? "bg-white font-semibold text-black"
                    : "text-white/80 hover:text-white",
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>

          <Shutter
            mode={mode}
            recording={recording}
            elapsed={elapsed}
            disabled={!ready || busy}
            onPress={press}
          />

          {/* Said plainly, because the alternative is finding out later. A web
              page cannot write to the photo library; the entry's "Save to
              photos" button is the nearest thing and it is one extra tap. */}
          <p className="max-w-xs text-center text-[11px] leading-relaxed text-white/65">
            Saved to the journal — use <strong>Save to photos</strong> on the
            entry for your camera roll.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * The one big round control, ringed.
 *
 * In clip mode the ring is also the countdown: a recording that cuts itself off
 * at ten seconds has to say so *before* it happens, or the stop reads as a
 * failure. The inner shape morphs circle → rounded square, which is the one
 * piece of universal camera vocabulary for "this is now a stop button" and needs
 * no label.
 */
function Shutter({
  mode,
  recording,
  elapsed,
  disabled,
  onPress,
}: {
  mode: "photo" | "clip";
  recording: boolean;
  elapsed: number;
  disabled: boolean;
  onPress: () => void;
}) {
  const progress = recording ? Math.min(1, elapsed / MAX_CLIP_MS) : 0;

  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={
        mode === "photo"
          ? "Take a photo"
          : recording
            ? "Stop recording"
            : "Record a ten-second clip"
      }
      className="relative grid size-[76px] shrink-0 place-items-center transition-transform duration-(--duration-base) ease-soft active:scale-[0.94] disabled:opacity-40"
    >
      <svg
        viewBox="0 0 76 76"
        className="absolute inset-0 size-full -rotate-90"
        aria-hidden
      >
        <circle
          cx="38"
          cy="38"
          r={RING_RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="4"
        />
        {recording && (
          <circle
            cx="38"
            cy="38"
            r={RING_RADIUS}
            fill="none"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - progress)}
          />
        )}
        {!recording && (
          <circle
            cx="38"
            cy="38"
            r={RING_RADIUS}
            fill="none"
            stroke="#ffffff"
            strokeWidth="4"
          />
        )}
      </svg>

      <span
        className={cn(
          "bg-accent transition-[width,height,border-radius] duration-(--duration-base) ease-soft",
          recording ? "size-[26px] rounded-[9px]" : "size-[58px] rounded-full",
        )}
      />
    </button>
  );
}

/** A floating icon button: legible over live video without putting a bar across
 *  it. Deliberately not one of the app's chip styles — those are tuned for a
 *  card, and this sits on whatever is in front of the lens. */
function GlassButton({
  onClick,
  disabled,
  label,
  active,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "grid size-10 place-items-center rounded-full backdrop-blur-sm transition-[background-color,color,transform] duration-(--duration-base) ease-soft active:scale-90 disabled:opacity-40",
        active ? "bg-white text-black" : "bg-black/35 text-white hover:bg-black/55",
      )}
    >
      {children}
    </button>
  );
}

/** A filename that sorts and never collides — the name is what pairs a file with
 *  its `meta:` entry in the FormData. */
function stamp(): string {
  return `${now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
