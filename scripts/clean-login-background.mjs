/*
 * Removes the login card that is painted into the login page artwork.
 *
 * The artwork Najib supplied with the prototype is a full page mock-up: the
 * photograph, the headline, the navigation, the footer strip and a login card,
 * all flattened into one 1536x1024 image. The prototype laid that image out
 * full bleed and drew a real, working card on top of it. The painted card is
 * exactly 470px wide, the same as the real card's CSS width, so the two line
 * up only at a 1536x1024 viewport; at any other size the image scales to
 * cover while the real card stays 470px, and the painted card shows out from
 * behind it. That is the duplicate card visible on the deployed site.
 *
 * Run against the original artwork to regenerate public/chigari-login-background.png:
 *   node scripts/clean-login-background.mjs <original.png> public/chigari-login-background.png
 */

import fs from 'node:fs';
import { PNG } from 'pngjs';

const [SRC, OUT] = process.argv.slice(2);
if (!SRC || !OUT) {
  console.error('usage: node scripts/clean-login-background.mjs <source.png> <output.png>');
  process.exit(1);
}

const png = PNG.sync.read(fs.readFileSync(SRC));
const { width: W, height: H } = png;
const src = png.data;
const out = Buffer.from(src);
const idx = (x, y) => (y * W + x) << 2;

/*
 * The artwork is a full page mock-up with a login card painted into it at
 * x 977-1446, y 153-842. The real sign-in card is drawn on top of the image,
 * so the two only coincide at a 1536x1024 viewport and the painted one shows
 * out from behind the real one at every other size. This paints it out.
 *
 * SOLID is replaced outright and covers the card plus its drop shadow, so no
 * pixel of the card can survive in a blend. Its colour is interpolated down
 * each column from the photograph immediately above and below the patch,
 * which makes the top and bottom seams continuous by construction. Only the
 * left seam needs a long fade, because there the interpolation runs against
 * real detail (the mallam's robe) rather than the dark edge of the frame.
 *
 * The patch has to clear the navigation words along the top (they end at
 * about y 90) and the coat of arms along the bottom (it starts at about
 * y 905), so the anchors are sampled inside those bounds.
 */
const SOLID = { x0: 952, x1: W - 1, y0: 133, y1: 872 };
const FADE = { left: 160, top: 23, bottom: 20 };
const ANCHOR = 15;

const PATCH_X0 = SOLID.x0 - FADE.left;
const PATCH_Y0 = SOLID.y0 - FADE.top;
const PATCH_Y1 = Math.min(H - 1, SOLID.y1 + FADE.bottom);

function columnAvg(x, y0, y1) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = y0; y <= y1; y++)
    for (let xx = Math.max(0, x - 5); xx <= Math.min(W - 1, x + 5); xx++) {
      const i = idx(xx, y); r += src[i]; g += src[i + 1]; b += src[i + 2]; n++;
    }
  return [r / n, g / n, b / n];
}

const top = [], bottom = [];
for (let x = PATCH_X0; x <= SOLID.x1; x++) {
  top.push(columnAvg(x, PATCH_Y0 - ANCHOR, PATCH_Y0 - 1));
  bottom.push(columnAvg(x, PATCH_Y1 + 1, PATCH_Y1 + ANCHOR));
}

const smooth = (t) => t * t * (3 - 2 * t);

for (let y = PATCH_Y0; y <= PATCH_Y1; y++) {
  const t = smooth((y - PATCH_Y0) / (PATCH_Y1 - PATCH_Y0));
  for (let x = PATCH_X0; x <= SOLID.x1; x++) {
    const T = top[x - PATCH_X0], B = bottom[x - PATCH_X0];
    const w = smooth(Math.min(1, (x - PATCH_X0) / FADE.left));
    const i = idx(x, y);
    for (let c = 0; c < 3; c++) {
      const fill = T[c] * (1 - t) + B[c] * t;
      out[i + c] = fill * w + src[i + c] * (1 - w);
    }
  }
}

/*
 * Interpolated colour alone reads as pale fog. Darkening the middle of the
 * patch, tapering to nothing at its edges, turns it into the same kind of
 * vignette the photograph already has at its corners, and gives the white
 * sign-in card something to sit against.
 */
const VIGNETTE = 0.3;
for (let y = PATCH_Y0; y <= PATCH_Y1; y++) {
  const fy = smooth(Math.min(1, Math.min(y - PATCH_Y0, PATCH_Y1 - y) / 150));
  for (let x = PATCH_X0; x <= SOLID.x1; x++) {
    const fx = smooth(Math.min(1, (x - PATCH_X0) / (FADE.left + 90)));
    const k = 1 - VIGNETTE * fx * fy;
    const i = idx(x, y);
    for (let c = 0; c < 3; c++) out[i + c] = out[i + c] * k;
  }
}

const dst = new PNG({ width: W, height: H });
out.copy(dst.data);
fs.writeFileSync(OUT, PNG.sync.write(dst));

// Check nothing card-shaped survives: the card was a 470px run of near-white
// pixels on every one of its rows.
let worst = 0;
for (let y = 0; y < H; y++) {
  let run = 0;
  for (let x = W >> 1; x < W; x++) {
    const i = idx(x, y);
    const mn = Math.min(out[i], out[i + 1], out[i + 2]);
    const mx = Math.max(out[i], out[i + 1], out[i + 2]);
    run = mn > 195 && mx - mn < 45 ? run + 1 : 0;
    if (run > worst) worst = run;
  }
}
console.log('written', OUT, '| longest light run in right half:', worst, 'px (was 470)');
