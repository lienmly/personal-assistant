/**
 * Renders Clan Centurio's home-screen icons from the moogle mark.
 *
 *   node scripts/generate-icons.mjs
 *
 * The mark itself lives in `components/brand/moogle-mark.tsx` as an SVG, and
 * the shapes below are the same three primitives redrawn analytically: a pom
 * (circle), an antenna (capsule) and a body (a circle clipped by a rounded
 * rectangle, which is what that one `c`-heavy path is). Keeping them in sync is
 * a five-line job and is the reason this is a script rather than four binaries
 * somebody has to reverse-engineer later.
 *
 * It writes PNGs rather than pointing the manifest at the SVG on purpose:
 * `apple-touch-icon` has never supported SVG, and Chrome's support for SVG
 * manifest icons is patchy enough that an icon that fails to decode shows up as
 * a blank square on the one screen this whole change exists to improve.
 *
 * No dependency: Node has `zlib`, and a PNG is a CRC-tagged chunk stream around
 * deflated scanlines. Coverage is supersampled 4x4 per pixel, which is what
 * gives the curves clean edges at 180px.
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- palette (globals.css) --------------------------------------------------

const OBSIDIAN = [0x14, 0x11, 0x0f]; // --color-ink, the warm near-black
const CREAM = [0xf7, 0xf6, 0xf4]; // --color-stage
const CRIMSON = [0xde, 0x1f, 0x4c]; // --color-accent

// --- the mark, in the SVG's 24-unit space -----------------------------------

const POM = { cx: 12, cy: 5, r: 3 };
const ANTENNA = { x: 12, y0: 8, y1: 11.2, w: 1.6 };
const BODY = { cx: 12, cy: 17.7, r: 6.4, x0: 5.6, x1: 18.4, y0: 11.2, y1: 19, corner: 1.3 };

/** The mark's bounding box: pom top to body bottom. */
const ART = { x0: BODY.x0, x1: BODY.x1, y0: POM.cy - POM.r, y1: BODY.y1 };

function inCircle(x, y, cx, cy, r) {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

/** A line with round caps — the antenna, and the only stroke in the mark. */
function inCapsule(x, y, x0, y0, x1, y1, width) {
  const vx = x1 - x0;
  const vy = y1 - y0;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - x0) * vx + (y - y0) * vy) / len2));
  return inCircle(x, y, x0 + t * vx, y0 + t * vy, width / 2);
}

/** Rounded rectangle with independent bottom corners; the top two are square. */
function inRoundRect(x, y, x0, y0, x1, y1, rBottom) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cy = y1 - rBottom;
  if (y <= cy) return true;
  if (x >= x0 + rBottom && x <= x1 - rBottom) return true;
  const cx = x < x0 + rBottom ? x0 + rBottom : x1 - rBottom;
  return inCircle(x, y, cx, cy, rBottom);
}

/** The body: a circle cut off flat at the bottom, with the cut corners rounded. */
function inBody(x, y) {
  return (
    inCircle(x, y, BODY.cx, BODY.cy, BODY.r) &&
    inRoundRect(x, y, BODY.x0, BODY.y0, BODY.x1, BODY.y1, BODY.corner)
  );
}

// --- rasteriser -------------------------------------------------------------

const SAMPLES = 4; // per axis, so 16 per pixel

/**
 * @param size      pixels, square
 * @param artHeight the mark's height as a fraction of `size`
 * @param bgRadius  background corner radius as a fraction of `size`; 0 is a
 *                  full square, which is what iOS and a maskable icon want
 *                  because both apply their own mask on top
 */
function render(size, { artHeight, bgRadius }) {
  const rgba = Buffer.alloc(size * size * 4);

  // Map the 24-unit art space onto the canvas: scale so the mark's bbox is
  // `artHeight` tall, then centre it.
  const scale = (size * artHeight) / (ART.y1 - ART.y0);
  const offsetX = size / 2 - ((ART.x0 + ART.x1) / 2) * scale;
  const offsetY = size / 2 - ((ART.y0 + ART.y1) / 2) * scale;
  const toArt = (px) => (px - offsetX) / scale;
  const toArtY = (py) => (py - offsetY) / scale;

  const radius = size * bgRadius;
  const step = 1 / SAMPLES;
  const perSample = 1 / (SAMPLES * SAMPLES);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = px + (sx + 0.5) * step;
          const y = py + (sy + 0.5) * step;

          // Outside the background shape the icon is transparent.
          if (radius > 0 && !inRoundRect(x, y, 0, 0, size, size, radius)) continue;
          // (a square background needs no test: every sample is inside)

          const ax = toArt(x);
          const ay = toArtY(y);

          let colour = OBSIDIAN;
          if (inCircle(ax, ay, POM.cx, POM.cy, POM.r)) colour = CRIMSON;
          else if (inBody(ax, ay)) colour = CREAM;
          else if (inCapsule(ax, ay, ANTENNA.x, ANTENNA.y0, ANTENNA.x, ANTENNA.y1, ANTENNA.w))
            colour = CREAM;

          r += colour[0] * perSample;
          g += colour[1] * perSample;
          b += colour[2] * perSample;
          a += 255 * perSample;
        }
      }

      const i = (py * size + px) * 4;
      // Premultiplied accumulation divided back out, so an edge pixel keeps its
      // colour instead of fading toward black.
      const scaleBack = a > 0 ? 255 / a : 0;
      rgba[i] = Math.round(r * scaleBack);
      rgba[i + 1] = Math.round(g * scaleBack);
      rgba[i + 2] = Math.round(b * scaleBack);
      rgba[i + 3] = Math.round(a);
    }
  }

  return rgba;
}

// --- PNG encoding -----------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  // One filter byte (0 = none) in front of each scanline.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- outputs ----------------------------------------------------------------

const OUTPUTS = [
  // Rounded square, transparent outside — how a "any"-purpose icon is shown
  // unmasked (desktop Chrome, the install prompt, a browser tab).
  { file: "public/icons/icon-192.png", size: 192, artHeight: 0.6, bgRadius: 0.22 },
  { file: "public/icons/icon-512.png", size: 512, artHeight: 0.6, bgRadius: 0.22 },

  // Maskable: full bleed, and the mark pulled in to survive Android's circle.
  // The safe zone is the middle 80%, so the art has to fit a centred circle of
  // radius 0.4 x size — at this height its half-diagonal is ~0.28 x size.
  { file: "public/icons/icon-maskable-512.png", size: 512, artHeight: 0.46, bgRadius: 0 },

  // iOS applies its own superellipse and does not honour transparency, so this
  // is a plain opaque square.
  { file: "public/apple-touch-icon.png", size: 180, artHeight: 0.6, bgRadius: 0 },
];

for (const { file, size, artHeight, bgRadius } of OUTPUTS) {
  const path = join(ROOT, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePng(size, render(size, { artHeight, bgRadius })));
  console.log(`  ${file}  ${size}x${size}`);
}
