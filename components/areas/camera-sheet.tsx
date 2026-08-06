"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Camera, RefreshCw, Video, X } from "lucide-react";

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

/**
 * The in-app camera: a live preview, a filter row, a shutter and a ten-second
 * clip button.
 *
 * **What this cannot do, and says so on screen: save to the phone's camera
 * roll.** There is no web API that writes to the photo library, and a photo
 * captured here goes to the page rather than to Photos — on iOS especially,
 * that surprises people. What it can do is hand a finished photo to the native
 * share sheet, where "Save Image" is one tap; that lives on the entry itself
 * (`SaveToPhotos` in `journal.tsx`) rather than here, because it is worth having
 * for photos that arrived from the library too.
 *
 * Everything is torn down in one place — `stop()` — and it is called on close,
 * on unmount and before every camera flip. A `getUserMedia` stream that is not
 * explicitly stopped leaves the camera light on, which on a phone reads as the
 * app watching you.
 */
export function CameraSheet({
  onCapture,
  onClose,
}: {
  onCapture: (media: CapturedMedia) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const drawRef = useRef<number | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [filterId, setFilterId] = useState(DEFAULT_FILTER.id);
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

  /** The frame the video is currently showing, scaled to fit `maxEdge`. */
  function frameSize(maxEdge: number) {
    const video = videoRef.current;
    const width = video?.videoWidth || 1280;
    const height = video?.videoHeight || 720;
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    return {
      width: Math.max(2, Math.round((width * scale) / 2) * 2),
      height: Math.max(2, Math.round((height * scale) / 2) * 2),
    };
  }

  function paint(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) {
    const video = videoRef.current;
    if (!video) return;
    context.filter = canFilter ? filter.css : "none";
    context.drawImage(video, 0, 0, width, height);
    if (canFilter) drawVignette(context, width, height, filter.vignette);
  }

  async function takePhoto() {
    if (!ready || busy) return;
    setBusy(true);

    const { width, height } = frameSize(PHOTO_MAX_EDGE);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Couldn't capture that frame.");
      setBusy(false);
      return;
    }

    paint(context, width, height);

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

    const { width, height } = frameSize(VIDEO_MAX_EDGE);

    // With no filter there is nothing to bake, so the camera's own track is
    // recorded directly — better quality and far less work than repainting every
    // frame through a canvas on a phone. With a filter, the canvas *is* the
    // picture, so it becomes the source and the microphone is added back.
    let source: MediaStream;
    let canvas: HTMLCanvasElement | null = null;

    if (!canFilter || filter.id === DEFAULT_FILTER.id) {
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
        paint(context, width, height);
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

  return (
    <div
      className="animate-scrim-in fixed inset-0 z-50 flex items-center justify-center bg-scrim p-3"
      role="dialog"
      aria-modal="true"
      aria-label="Camera"
    >
      <div className="animate-panel-in flex w-full max-w-lg flex-col overflow-hidden rounded-tile bg-card shadow-card">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <span className="text-[13px] font-medium text-ink">
            {recording ? `Recording · ${remaining}s` : "Camera"}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                setFacing((value) =>
                  value === "user" ? "environment" : "user",
                )
              }
              disabled={recording || !ready}
              aria-label="Switch camera"
              className="grid size-8 place-items-center rounded-full text-faint transition-colors duration-(--duration-quick) hover:bg-inset hover:text-ink active:scale-90 disabled:opacity-40"
            >
              <RefreshCw className="size-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={recording}
              aria-label="Close camera"
              className="grid size-8 place-items-center rounded-full text-faint transition-[background-color,color,transform] duration-(--duration-base) ease-soft hover:rotate-90 hover:bg-inset hover:text-ink disabled:opacity-40"
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="relative aspect-[4/3] w-full overflow-hidden bg-inset">
          <video
            ref={videoRef}
            playsInline
            muted
            className="size-full object-cover"
            style={{ filter: canFilter ? filter.css : undefined }}
          />
          {canFilter && filter.vignette > 0 && (
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: vignetteCss(filter.vignette) }}
            />
          )}

          {recording && (
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-white">
              <span className="size-1.5 animate-pulse rounded-full bg-white" />
              {`${remaining}s`}
            </div>
          )}

          {!ready && !error && (
            <div className="absolute inset-0 grid place-items-center text-[13px] text-muted">
              Opening the camera…
            </div>
          )}
          {error && (
            <div className="absolute inset-0 grid place-items-center px-6 text-center text-[13px] leading-relaxed text-muted">
              {error}
            </div>
          )}
        </div>

        {canFilter && (
          <div className="flex gap-1.5 overflow-x-auto px-4 py-3">
            {JOURNAL_FILTERS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setFilterId(entry.id)}
                className={cn(
                  "shrink-0 rounded-chip px-3 py-1.5 text-[12px] transition-[background-color,color] duration-(--duration-base) ease-soft active:scale-[0.97]",
                  entry.id === filterId
                    ? "bg-obsidian font-medium text-white"
                    : "bg-inset text-muted hover:text-ink",
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-3 px-4 pb-4 pt-1">
          <button
            type="button"
            onClick={takePhoto}
            disabled={!ready || busy || recording}
            className="flex items-center gap-2 rounded-chip bg-accent px-5 py-2.5 text-[13px] font-medium text-white transition-[background-color,transform] duration-(--duration-base) ease-soft hover:bg-accent-hover active:scale-[0.97] disabled:opacity-40"
          >
            <Camera className="size-4" strokeWidth={2} />
            Photo
          </button>

          {canRecord && (
            <button
              type="button"
              onClick={recording ? stopClip : startClip}
              disabled={!ready || busy}
              className={cn(
                "flex items-center gap-2 rounded-chip px-5 py-2.5 text-[13px] font-medium transition-[background-color,color,transform] duration-(--duration-base) ease-soft active:scale-[0.97] disabled:opacity-40",
                recording
                  ? "bg-obsidian text-white"
                  : "bg-inset text-muted hover:text-ink",
              )}
            >
              <Video className="size-4" strokeWidth={2} />
              {recording ? "Stop" : "10s clip"}
            </button>
          )}
        </div>

        <p className="px-4 pb-4 text-center text-[11.5px] leading-relaxed text-faint">
          {/* Said plainly, because the alternative is finding out later. A web
              page cannot write to the photo library; the entry's "Save to
              photos" button is the nearest thing and it is one extra tap. */}
          Saved to the journal. Use <strong>Save to photos</strong> on the entry
          to put a copy in your camera roll.
        </p>
      </div>
    </div>
  );
}

/** A filename that sorts and never collides — the name is what pairs a file with
 *  its `meta:` entry in the FormData. */
function stamp(): string {
  return `${now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
