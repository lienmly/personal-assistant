"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ChevronDown, ImagePlus, Play, Plus, X } from "lucide-react";

import {
  CameraSheet,
  type CapturedMedia,
} from "@/components/areas/camera-sheet";
import {
  ACCEPTED_IMAGE_MIME,
  MAX_MEDIA_PER_ENTRY,
  baseMime,
} from "@/lib/media-rules";
import { cn } from "@/lib/utils";

/** The longest edge we keep. A 4032×3024 phone photo becomes 1600×1200, which
 *  is still more than any screen this is read on and about a tenth the bytes. */
const MAX_EDGE = 1600;

/** The same constant the action enforces, imported rather than mirrored — so the
 *  cap is a disabled button here *and* an error there, never two numbers. */
const MAX_PER_ENTRY = MAX_MEDIA_PER_ENTRY;

export type PreparedMedia = {
  /** A stable key for React, and what pairs the file with its metadata in the
   *  FormData — see `metaFor` in `lib/journal-actions.ts`. */
  name: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  kind: "photo" | "video";
  durationMs: number | null;
  /** The base type, decided here and sent alongside the file rather than read
   *  off its `Content-Type` on the server — see the note in `journal.tsx`. */
  mimeType: string;
};

/**
 * Picks photos from the library, or takes one — or a ten-second clip — with the
 * camera, and **downscales anything picked before it is ever sent.**
 *
 * The downscale is not an optimisation, it is what makes the feature work at
 * all. A modern phone photo is 3–8MB; a server action's default body limit is
 * 1MB, and these are being stored in Postgres, where every byte is a byte of
 * database. Resizing here means the network, the action and the table all only
 * ever see ~300KB, and the browser has already decoded the image, so measuring
 * it is free — which is why the server is told the dimensions rather than
 * parsing them out of the file with an image library it would otherwise need.
 *
 * **Two routes to a photo, and both are worth having.** The library picker
 * attaches something you shot with the native camera app, which is the only way
 * a photo ends up in your camera roll without a second step. The in-app camera
 * is for the shot you are taking *because* you are writing the entry, and it can
 * apply a filter and record a clip, neither of which the picker can.
 *
 * If a browser cannot decode a picked file (an older iOS handing over HEIC), the
 * original is kept and flagged. `putMedia` refuses unknown types server-side, so
 * the failure is a message rather than a corrupt row.
 */
export function MediaInput({
  media,
  onChange,
  disabled,
  existingCount = 0,
}: {
  media: PreparedMedia[];
  onChange: (media: PreparedMedia[]) => void;
  disabled?: boolean;
  /** How many the entry already holds. Only non-zero when editing, and it has
   *  to be counted here or the cap would be per-*submit* rather than per-entry:
   *  ten photos, save, ten more. The server counts the same way. */
  existingCount?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [working, setWorking] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [overflowed, setOverflowed] = useState(false);

  const remaining = Math.max(0, MAX_PER_ENTRY - existingCount - media.length);
  const full = remaining === 0;

  // A menu that stays open after you have clicked elsewhere is a menu you close
  // by accident later. `pointerdown` rather than `click` so it beats the focus
  // change, and Escape because a popup owes you that.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Object URLs are a manual allocation; without this every pick leaks one per
  // item for as long as the page lives.
  useEffect(() => {
    return () => {
      for (const item of media) URL.revokeObjectURL(item.previewUrl);
    };
    // Intentionally on unmount only — revoking on every change would kill the
    // previews still on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const all = [...(event.target.files ?? [])];
    event.target.value = "";
    if (all.length === 0) return;

    // Take what fits and say what didn't, rather than refusing the whole pick —
    // selecting twelve photos and getting none is a worse answer than getting
    // ten and being told.
    const files = all.slice(0, remaining);
    setOverflowed(all.length > files.length);

    setWorking(true);
    setRejected([]);

    const prepared: PreparedMedia[] = [];
    const bad: string[] = [];

    for (const file of files) {
      const result = await prepare(file);
      if (result) prepared.push(result);
      else bad.push(file.name);
    }

    setRejected(bad);
    setWorking(false);
    onChange([...media, ...prepared]);
  }

  function captured(item: CapturedMedia) {
    setCameraOpen(false);
    onChange([
      ...media,
      {
        name: item.file.name,
        file: item.file,
        previewUrl: URL.createObjectURL(item.file),
        width: item.width,
        height: item.height,
        kind: item.kind,
        durationMs: item.durationMs,
        mimeType: item.mimeType,
      },
    ]);
  }

  function remove(name: string) {
    const going = media.find((item) => item.name === name);
    if (going) URL.revokeObjectURL(going.previewUrl);
    onChange(media.filter((item) => item.name !== name));
  }

  return (
    <div>
      {/* One control, two routes. They were two buttons side by side, which put
          three things ("Add photos", "Camera", the counter) across the top of a
          composer whose whole point is that it is quiet enough to type into.
          The choice between library and camera is real (see the note above) but
          it is not one you make often enough to spend a permanent row on. */}
      <div className="flex flex-wrap items-center gap-2">
        <div ref={menuRef} className="relative">
          <button
            type="button"
            disabled={disabled || working || full}
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-1.5 rounded-chip bg-inset px-3 py-2 text-[12.5px] text-muted transition-colors duration-(--duration-quick) hover:text-ink active:scale-[0.97] disabled:opacity-50"
          >
            <Plus className="size-4" strokeWidth={2} />
            {working ? "Preparing…" : "Add media"}
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform duration-(--duration-base) ease-soft",
                menuOpen && "rotate-180",
              )}
              strokeWidth={2}
            />
          </button>

          {/* Opens **upward**, and that is not a taste call. Every day in the
              journal is a section carrying a transform from `animate-rise`
              (`fill-mode: both` pins it), and a transform makes a stacking
              context — so a menu dropped below this button is painted over by
              the *next* day's card whatever its z-index says. That is the same
              mechanism the media viewer has to portal around (§6). Upward, the
              menu stays inside its own day, and no portal or position maths is
              needed for a two-item list. */}
          {menuOpen && (
            <div
              role="menu"
              className="absolute bottom-full left-0 z-30 mb-1.5 flex w-48 animate-rise flex-col overflow-hidden rounded-tile bg-card p-1 shadow-float"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  inputRef.current?.click();
                }}
                className="flex items-center gap-2.5 rounded-tile px-3 py-2 text-left text-[12.5px] text-ink transition-colors duration-(--duration-quick) hover:bg-inset"
              >
                <ImagePlus className="size-4 shrink-0 text-faint" strokeWidth={2} />
                Photos
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setCameraOpen(true);
                }}
                className="flex items-center gap-2.5 rounded-tile px-3 py-2 text-left text-[12.5px] text-ink transition-colors duration-(--duration-quick) hover:bg-inset"
              >
                <Camera className="size-4 shrink-0 text-faint" strokeWidth={2} />
                Camera
              </button>
            </div>
          )}
        </div>

        {(media.length > 0 || existingCount > 0) && (
          <span className="text-[11.5px] text-faint">
            {`${existingCount + media.length} of ${MAX_PER_ENTRY}`}
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        // Deliberately unnamed: the form serialises with `new FormData(form)`,
        // and a named input here would attach the *originals* alongside the
        // downscaled copies — every photo stored twice, the large one included.
        accept="image/*"
        multiple
        hidden
        onChange={pick}
      />

      {rejected.length > 0 && (
        <p className="mt-2 text-[12px] text-accent">
          {`Couldn't read ${rejected.join(", ")} — try saving it as a JPEG first.`}
        </p>
      )}

      {/* The cap is per entry and a day holds as many entries as you like, so
          the message says where the rest go rather than just refusing them. */}
      {(overflowed || full) && (
        <p className="mt-2 text-[12px] text-muted">
          {`That's ${MAX_PER_ENTRY} — the most one entry holds. Add another entry for the rest; they read as one day.`}
        </p>
      )}

      {media.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {media.map((item) => (
            <li key={item.name} className="group relative">
              {item.kind === "video" ? (
                <>
                  <video
                    src={item.previewUrl}
                    muted
                    playsInline
                    preload="metadata"
                    className="size-20 rounded-tile object-cover shadow-card"
                  />
                  <span className="pointer-events-none absolute bottom-1 left-1 flex items-center gap-0.5 rounded-full bg-obsidian/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    <Play className="size-2.5 fill-current" strokeWidth={0} />
                    {`${Math.round((item.durationMs ?? 0) / 1000)}s`}
                  </span>
                </>
              ) : (
                /* Deliberately a plain <img>: the source is a blob: URL that
                   exists only in this tab, which next/image cannot optimise and
                   would warn about. */
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={item.previewUrl}
                  alt=""
                  className="size-20 rounded-tile object-cover shadow-card"
                />
              )}
              <button
                type="button"
                onClick={() => remove(item.name)}
                aria-label="Remove"
                className={cn(
                  "absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-obsidian text-white shadow-card transition-transform duration-(--duration-base) ease-soft active:scale-90",
                  // Hover is not an affordance on a phone (CLAUDE.md §9).
                  "sm:opacity-0 sm:group-hover:opacity-100",
                )}
              >
                <X className="size-3.5" strokeWidth={2.5} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {cameraOpen && (
        <CameraSheet
          onCapture={captured}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  );
}

async function prepare(file: File): Promise<PreparedMedia | null> {
  const bitmap = await createImageBitmap(file, {
    // Without this, a photo taken in portrait arrives rotated on the desktop
    // and upright on the phone, because only some decoders apply the EXIF tag.
    imageOrientation: "from-image",
  }).catch(() => null);

  if (!bitmap) {
    // Undecodable. Keep it only if the server would accept it as-is.
    const mimeType = baseMime(file.type);
    if (!(ACCEPTED_IMAGE_MIME as readonly string[]).includes(mimeType))
      return null;
    return {
      name: uniqueName(file.name),
      file,
      previewUrl: URL.createObjectURL(file),
      width: 0,
      height: 0,
      kind: "photo",
      durationMs: null,
      mimeType,
    };
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return null;
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.82),
  );
  if (!blob) return null;

  const name = uniqueName(file.name.replace(/\.[^.]+$/, "") + ".jpg");
  return {
    name,
    file: new File([blob], name, { type: "image/jpeg" }),
    previewUrl: URL.createObjectURL(blob),
    width,
    height,
    kind: "photo",
    durationMs: null,
    // Not `file.type` — this is the JPEG we just encoded, whatever came in.
    mimeType: "image/jpeg",
  };
}

/** Two photos picked from a camera roll can share a filename, and the name is
 *  what pairs a file with its `meta:` entry — so it has to be unique per pick. */
function uniqueName(base: string): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${base}`;
}
