/*
 * Turns the supplied login artwork into a plain photograph.
 *
 * The file Najib supplied with the prototype is a flattened page mock-up: the
 * photograph with a logo, a top navigation, a headline, a strapline, a footer
 * strip, an emblem and a login card all painted into it. Because that content
 * is pixels rather than markup it cannot be re-worded, it does not re-flow,
 * and it gets cropped wherever the window is a different shape from the
 * artwork. The login page now draws all of it as real markup, so the image
 * underneath has to be only the photograph.
 *
 * Painted text is thin, bright and sits on a darker photograph, so it is found
 * by colour rather than by blanking rectangles, and the surrounding photograph
 * is diffused into the gaps it leaves. That keeps the veranda, the courtyard
 * and the children intact. The login card is the one exception: it is far too
 * large to diffuse into, so its area is interpolated down each column from the
 * photograph above and below it and quietly vignetted.
 *
 *   node scripts/build-login-photo.mjs <artwork.png> public/chigari-login-photo.png
 */
import fs from 'node:fs';
import { PNG } from 'pngjs';

const [SRC, OUT] = process.argv.slice(2);
if (!SRC || !OUT) {
  console.error('usage: node scripts/build-login-photo.mjs <artwork.png> <output.png>');
  process.exit(1);
}

const png = PNG.sync.read(fs.readFileSync(SRC));
const { width: W, height: H } = png;
const src = png.data;
const out = Buffer.from(src);
const idx = (x, y) => (y * W + x) << 2;
const clampX = (x) => Math.min(W - 1, Math.max(0, x));
const clampY = (y) => Math.min(H - 1, Math.max(0, y));
const smooth = (t) => t * t * (3 - 2 * t);

/* ---------------------------------------------------------------- 1. the card */

// Measured: the painted card occupies x 977-1446, y 153-842, exactly 470px
// wide — the same as the real card's CSS width, which is why the two only
// coincide at a 1536x1024 viewport.
const CARD = { x0: 952, y0: 133, y1: 872 };
const CARD_FADE = { left: 160, top: 23, bottom: 20 };
const CARD_ANCHOR = 15;
{
  const px0 = CARD.x0 - CARD_FADE.left;
  const py0 = CARD.y0 - CARD_FADE.top;
  const py1 = clampY(CARD.y1 + CARD_FADE.bottom);

  const columnAvg = (x, y0, y1) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = y0; y <= y1; y++)
      for (let xx = clampX(x - 5); xx <= clampX(x + 5); xx++) {
        const i = idx(xx, y); r += src[i]; g += src[i + 1]; b += src[i + 2]; n++;
      }
    return [r / n, g / n, b / n];
  };

  const top = [], bottom = [];
  for (let x = px0; x < W; x++) {
    top.push(columnAvg(x, py0 - CARD_ANCHOR, py0 - 1));
    bottom.push(columnAvg(x, py1 + 1, py1 + CARD_ANCHOR));
  }

  for (let y = py0; y <= py1; y++) {
    const t = smooth((y - py0) / (py1 - py0));
    const fy = smooth(Math.min(1, Math.min(y - py0, py1 - y) / 150));
    for (let x = px0; x < W; x++) {
      const T = top[x - px0], B = bottom[x - px0];
      const w = smooth(Math.min(1, (x - px0) / CARD_FADE.left));
      const vignette = 1 - 0.3 * smooth(Math.min(1, (x - px0) / (CARD_FADE.left + 90))) * fy;
      const i = idx(x, y);
      for (let c = 0; c < 3; c++) {
        const fill = T[c] * (1 - t) + B[c] * t;
        out[i + c] = (fill * w + src[i + c] * (1 - w)) * vignette;
      }
    }
  }
}

/* -------------------------------------------------------------- 2. the text */

// Zones the painted overlay lives in, measured off the artwork. Confining the
// search stops the search from chasing highlights elsewhere in the photograph.
const TEXT_ZONES = [
  { name: 'wordmark',  x0: 88,   y0: 33,  x1: 400,  y1: 136 },
  { name: 'nav',       x0: 1020, y0: 50,  x1: 1445, y1: 95  },
  { name: 'headline',  x0: 88,   y0: 155, x1: 548,  y1: 402 },
  // The footer strip sits on the courtyard floor, where the lettering, the
  // icons and the hairline separators between them are all dark in absolute
  // terms and only stand out against what surrounds them.
  { name: 'footer',    x0: 80,   y0: 891, x1: 884,  y1: 970, mode: 'contrast' },
];
// The emblem is red, green and white at once, so colour cannot separate it
// from the courtyard floor. It is small, and taken wholesale instead.
const SOLID_ZONES = [{ name: 'emblem', x0: 1216, y0: 903, x1: 1444, y1: 964 }];

const bright = new Uint8Array(W * H);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const i = idx(x, y);
    const mn = Math.min(out[i], out[i + 1], out[i + 2]);
    const mx = Math.max(out[i], out[i + 1], out[i + 2]);
    bright[y * W + x] = mn > 178 && mx - mn < 34 ? 1 : 0;
  }

// Summed-area table, so "how bright is the neighbourhood" is a constant-time
// question. The mallam's robe is a large bright field; lettering is not.
const sat = new Int32Array((W + 1) * (H + 1));
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++)
    sat[(y + 1) * (W + 1) + x + 1] =
      bright[y * W + x] + sat[y * (W + 1) + x + 1] + sat[(y + 1) * (W + 1) + x] - sat[y * (W + 1) + x];

const R = 22;
function brightFraction(x, y) {
  const x0 = clampX(x - R), x1 = clampX(x + R), y0 = clampY(y - R), y1 = clampY(y + R);
  const s = sat[(y1 + 1) * (W + 1) + x1 + 1] - sat[y0 * (W + 1) + x1 + 1]
          - sat[(y1 + 1) * (W + 1) + x0] + sat[y0 * (W + 1) + x0];
  return s / ((x1 - x0 + 1) * (y1 - y0 + 1));
}

const isBrandGreen = (r, g, b) => g > 105 && g - r > 32 && g - b > 20;

// A second summed-area table, over luminance, answers "is this pixel lighter
// than its surroundings" — which is what separates a hairline rule on a dark
// floor from the floor itself.
const lumSat = new Float64Array((W + 1) * (H + 1));
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const i = idx(x, y);
    const l = (out[i] + out[i + 1] + out[i + 2]) / 3;
    lumSat[(y + 1) * (W + 1) + x + 1] =
      l + lumSat[y * (W + 1) + x + 1] + lumSat[(y + 1) * (W + 1) + x] - lumSat[y * (W + 1) + x];
  }

const LR = 30;
function localMean(x, y) {
  const x0 = clampX(x - LR), x1 = clampX(x + LR), y0 = clampY(y - LR), y1 = clampY(y + LR);
  const s = lumSat[(y1 + 1) * (W + 1) + x1 + 1] - lumSat[y0 * (W + 1) + x1 + 1]
          - lumSat[(y1 + 1) * (W + 1) + x0] + lumSat[y0 * (W + 1) + x0];
  return s / ((x1 - x0 + 1) * (y1 - y0 + 1));
}

const mask = new Uint8Array(W * H);
for (const z of TEXT_ZONES)
  for (let y = z.y0; y <= z.y1; y++)
    for (let x = z.x0; x <= z.x1; x++) {
      const i = idx(x, y);
      const green = isBrandGreen(out[i], out[i + 1], out[i + 2]);
      // Lettering is bright against a mostly darker neighbourhood; a robe or a
      // sunlit wall is bright against a bright one.
      const lettering = z.mode === 'contrast'
        ? (out[i] + out[i + 1] + out[i + 2]) / 3 - localMean(x, y) > 11
        : bright[y * W + x] === 1 && brightFraction(x, y) < 0.42;
      if (green || lettering) mask[y * W + x] = 1;
    }
for (const z of SOLID_ZONES)
  for (let y = z.y0; y <= z.y1; y++)
    for (let x = z.x0; x <= z.x1; x++) mask[y * W + x] = 1;

// Grow the mask to take the anti-aliasing and drop shadow with it.
const DILATE = 5;
const grown = new Uint8Array(mask);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    if (!mask[y * W + x]) continue;
    for (let dy = -DILATE; dy <= DILATE; dy++)
      for (let dx = -DILATE; dx <= DILATE; dx++) {
        if (dx * dx + dy * dy > DILATE * DILATE) continue;
        grown[clampY(y + dy) * W + clampX(x + dx)] = 1;
      }
  }

const masked = grown.reduce((a, v) => a + v, 0);

/* ------------------------------------------------------------ 3. diffuse in */

// Grow the photograph inwards from the edge of each gap, a ring at a time,
// until the gap is closed.
const known = new Uint8Array(W * H);
for (let i = 0; i < known.length; i++) known[i] = grown[i] ? 0 : 1;

let remaining = masked;
let rings = 0;
while (remaining > 0 && rings < 600) {
  const filled = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (known[y * W + x]) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = clampX(x + dx), yy = clampY(y + dy);
          if (!known[yy * W + xx]) continue;
          const i = idx(xx, yy);
          // Diagonals contribute less, which keeps the fill from developing
          // a square grain.
          const wgt = dx && dy ? 0.707 : 1;
          r += out[i] * wgt; g += out[i + 1] * wgt; b += out[i + 2] * wgt; n += wgt;
        }
      if (n > 0) filled.push([x, y, r / n, g / n, b / n]);
    }
  if (!filled.length) break;
  for (const [x, y, r, g, b] of filled) {
    const i = idx(x, y);
    out[i] = r; out[i + 1] = g; out[i + 2] = b;
    known[y * W + x] = 1;
  }
  remaining -= filled.length;
  rings++;
}

// Ring-by-ring filling leaves faint contours; a short blur confined to the
// gaps and their rim settles them.
{
  const RB = 3;
  const rim = new Uint8Array(grown);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!grown[y * W + x]) continue;
      for (let dy = -RB; dy <= RB; dy++)
        for (let dx = -RB; dx <= RB; dx++) rim[clampY(y + dy) * W + clampX(x + dx)] = 1;
    }
  const before = Buffer.from(out);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!rim[y * W + x]) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -RB; dy <= RB; dy++)
        for (let dx = -RB; dx <= RB; dx++) {
          const i = idx(clampX(x + dx), clampY(y + dy));
          r += before[i]; g += before[i + 1]; b += before[i + 2]; n++;
        }
      const i = idx(x, y);
      out[i] = r / n; out[i + 1] = g / n; out[i + 2] = b / n;
    }
}

const dst = new PNG({ width: W, height: H });
out.copy(dst.data);
fs.writeFileSync(OUT, PNG.sync.write(dst));
console.log(`wrote ${OUT} | ${masked} px of painted overlay removed in ${rings} rings`);
