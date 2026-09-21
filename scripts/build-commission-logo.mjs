/*
 * Prepares the National Commission logo for use on the login page.
 *
 * The supplied file is a JPEG of a circular seal on a white field, so it
 * arrives with soft edges and compression speckle around the artwork. This
 * finds the seal, crops to it squarely, cleans the near-white field to true
 * white so it sits flush on a white chip, and writes a square PNG. The page
 * clips it to a circle, which is why the crop has to be square and centred.
 *
 *   node scripts/build-commission-logo.mjs <source.jpeg> public/national-commission-logo.png
 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const [SRC, OUT] = process.argv.slice(2);
if (!SRC || !OUT) {
  console.error('usage: node scripts/build-commission-logo.mjs <source> <output.png>');
  process.exit(1);
}

const SIZE = 512;          // exported square, comfortably above any display size
const PAD = 0.02;          // breathing room around the seal, as a fraction of it
const WHITE_CUTOFF = 232;  // above this on every channel, treat as the white field

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
const dataUrl = `data:image/jpeg;base64,${fs.readFileSync(SRC).toString('base64')}`;

const result = await page.evaluate(
  async ({ dataUrl, SIZE, PAD, WHITE_CUTOFF }) => {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();

    const w = img.naturalWidth, h = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, w, h).data;

    // The seal is everything that is not the white field.
    let x0 = w, x1 = -1, y0 = h, y1 = -1;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) << 2;
        if (px[i] < WHITE_CUTOFF || px[i + 1] < WHITE_CUTOFF || px[i + 2] < WHITE_CUTOFF) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }

    // Square crop centred on the seal, so a circular clip stays concentric.
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const side = Math.max(x1 - x0, y1 - y0) * (1 + PAD * 2);

    const out = document.createElement('canvas');
    out.width = SIZE; out.height = SIZE;
    const octx = out.getContext('2d', { willReadFrequently: true });
    octx.fillStyle = '#fff';
    octx.fillRect(0, 0, SIZE, SIZE);
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(img, cx - side / 2, cy - side / 2, side, side, 0, 0, SIZE, SIZE);

    // Flatten the field to true white so JPEG speckle does not show against
    // the chip the logo sits on.
    const od = octx.getImageData(0, 0, SIZE, SIZE);
    const d = od.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] >= WHITE_CUTOFF && d[i + 1] >= WHITE_CUTOFF && d[i + 2] >= WHITE_CUTOFF) {
        d[i] = d[i + 1] = d[i + 2] = 255;
      }
    }
    octx.putImageData(od, 0, 0);

    return {
      source: `${w}x${h}`,
      seal: `x ${x0}-${x1}  y ${y0}-${y1}`,
      png: out.toDataURL('image/png'),
    };
  },
  { dataUrl, SIZE, PAD, WHITE_CUTOFF }
);

await browser.close();
fs.writeFileSync(OUT, Buffer.from(result.png.split(',')[1], 'base64'));
console.log(`source ${result.source} | seal ${result.seal} | wrote ${OUT} at ${SIZE}x${SIZE}`);
