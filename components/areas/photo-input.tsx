"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

import { cn } from "@/lib/utils";

/** Mirrors `ACCEPTED_MIME` in `lib/photo-store.ts`. Kept as a literal rather
 *  than imported, because that module imports `lib/db` and this is a client
 *  bundle — the same rule `lib/tracks.ts` and `lib/calendar-keys.ts` follow. */
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

/** The longest edge we keep. A 4032×3024 phone photo becomes 1600×1200, which
 *  is still more than any screen this is read on and about a tenth the bytes. */
const MAX_EDGE = 1600;

export type PreparedPhoto = {
  /** A stable key for React, and what pairs the file with its dimensions in the
   *  FormData — see `dimensionsFor` in `lib/journal-actions.ts`. */
  name: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
};

/**
 * Picks photos and **downscales them in the browser before they are ever sent.**
 *
 * This is not an optimisation, it is what makes the feature work at all. A
 * modern phone photo is 3–8MB; a server action's default body limit is 1MB, and
 * these are being stored in Postgres, where every byte is a byte of database.
 * Resizing here means the network, the action and the table all only ever see
 * ~300KB, and the browser has already decoded the image, so measuring it is
 * free — which is why the server is told the dimensions rather than parsing
 * them out of the file with an image library it would otherwise need.
 *
 * If a browser cannot decode the file (an older iOS handing over HEIC), the
 * original is kept and flagged. `putPhoto` refuses unknown types server-side, so
 * the failure is a message rather than a corrupt row.
 */
export function PhotoInput({
  photos,
  onChange,
  disabled,
}: {
  photos: PreparedPhoto[];
  onChange: (photos: PreparedPhoto[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);

  // Object URLs are a manual allocation; without this every pick leaks one per
  // photo for as long as the page lives.
  useEffect(() => {
    return () => {
      for (const photo of photos) URL.revokeObjectURL(photo.previewUrl);
    };
    // Intentionally on unmount only — revoking on every change would kill the
    // previews still on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (files.length === 0) return;

    setWorking(true);
    setRejected([]);

    const prepared: PreparedPhoto[] = [];
    const bad: string[] = [];

    for (const file of files) {
      const result = await prepare(file);
      if (result) prepared.push(result);
      else bad.push(file.name);
    }

    setRejected(bad);
    setWorking(false);
    onChange([...photos, ...prepared]);
  }

  function remove(name: string) {
    const going = photos.find((photo) => photo.name === name);
    if (going) URL.revokeObjectURL(going.previewUrl);
    onChange(photos.filter((photo) => photo.name !== name));
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled || working}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-chip bg-inset px-3 py-2 text-[12.5px] text-muted transition-colors duration-(--duration-quick) hover:text-ink active:scale-[0.97] disabled:opacity-50"
        >
          <ImagePlus className="size-4" strokeWidth={2} />
          {working ? "Preparing…" : "Add photos"}
        </button>
        {photos.length > 0 && (
          <span className="text-[11.5px] text-faint">
            {photos.length} {photos.length === 1 ? "photo" : "photos"}
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

      {photos.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {photos.map((photo) => (
            <li key={photo.name} className="group relative">
              {/* Deliberately a plain <img>: the source is a blob: URL that
                  exists only in this tab, which next/image cannot optimise and
                  would warn about. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.previewUrl}
                alt=""
                className="size-20 rounded-tile object-cover shadow-card"
              />
              <button
                type="button"
                onClick={() => remove(photo.name)}
                aria-label="Remove photo"
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
    </div>
  );
}

async function prepare(file: File): Promise<PreparedPhoto | null> {
  const bitmap = await createImageBitmap(file, {
    // Without this, a photo taken in portrait arrives rotated on the desktop
    // and upright on the phone, because only some decoders apply the EXIF tag.
    imageOrientation: "from-image",
  }).catch(() => null);

  if (!bitmap) {
    // Undecodable. Keep it only if the server would accept it as-is.
    if (!ACCEPTED.includes(file.type)) return null;
    return {
      name: uniqueName(file.name),
      file,
      previewUrl: URL.createObjectURL(file),
      width: 0,
      height: 0,
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
  };
}

/** Two photos picked from a camera roll can share a filename, and the name is
 *  what pairs a file with its `dim:` entry — so it has to be unique per pick. */
function uniqueName(base: string): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${base}`;
}
