/*
 * Prepares the Chigari Foundation mark for use on a light surface.
 *
 * The mark came out of the prototype flattened onto a white rectangle. The
 * dashboard hides that by sitting it on a white chip of its own, but on the
 * login card the rectangle reads as a faint box around the logo, because the
 * card is a hair off pure white. This lifts the white field to transparency,
 * keeping a soft edge so the artwork does not acquire a hard outline, and
 * trims the surrounding margin so the mark fills the box it is given.
 *
 *   node scripts/build-foundation-logo.mjs <source.png> public/chigari-logo.png
 */
import fs from 'node:fs';
import { PNG } from 'pngjs';

const [SRC, OUT] = process.argv.slice(2);
if (!SRC || !OUT) {
  console.error('usage: node scripts/build-foundation-logo.mjs <source.png> <output.png>');
  process.exit(1);
}

const png = PNG.sync.read(fs.readFileSync(SRC));
const { width: W, height: H, data } = png;

const OPAQUE = 226; // at or below this on any channel, the pixel is artwork
const CLEAR = 249;  // at or above this on every channel, the pixel is the field

const alpha = new Float64Array(W * H);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) << 2;
    const mn = Math.min(data[i], data[i + 1], data[i + 2]);
    // Ramp rather than cut, so anti-aliased edges keep their softness.
    alpha[y * W + x] = mn >= CLEAR ? 0 : mn <= OPAQUE ? 1 : (CLEAR - mn) / (CLEAR - OPAQUE);
  }

let x0 = W, x1 = -1, y0 = H, y1 = -1;
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++)
    if (alpha[y * W + x] > 0.05) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }

const ow = x1 - x0 + 1, oh = y1 - y0 + 1;
const out = new PNG({ width: ow, height: oh });
for (let y = 0; y < oh; y++)
  for (let x = 0; x < ow; x++) {
    const s = ((y + y0) * W + (x + x0)) << 2;
    const t = (y * ow + x) << 2;
    const a = alpha[(y + y0) * W + (x + x0)];
    // Un-multiply against the white field so the artwork keeps its own colour
    // where it is only partly opaque.
    for (let c = 0; c < 3; c++) out.data[t + c] = a > 0 ? Math.max(0, Math.min(255, (data[s + c] - 255 * (1 - a)) / a)) : 255;
    out.data[t + 3] = Math.round(a * 255);
  }

fs.writeFileSync(OUT, PNG.sync.write(out));
console.log(`wrote ${OUT} | ${W}x${H} trimmed to ${ow}x${oh}`);
