import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

/**
 * Processes rendered 3D scroll PNGs into crisp, centered 256x256 WebP icons
 * and generates tiers 1 to 5 with progressive runic luminescence and arcane saturation.
 */
export async function generateScrollFromPng(inputPngPath, element, outputDir) {
  const inputBuffer = await readFile(inputPngPath);

  // 1. Trim transparent padding
  const trimmed = await sharp(inputBuffer)
    .trim({ threshold: 5 })
    .toBuffer({ resolveWithObject: true });

  // 2. Resize inside 220x220 bounding box
  const resized = await sharp(trimmed.data)
    .resize(220, 220, { fit: 'inside' })
    .toBuffer({ resolveWithObject: true });

  // 3. Center into 256x256 transparent square
  const padLeft = Math.floor((256 - resized.info.width) / 2);
  const padTop = Math.floor((256 - resized.info.height) / 2);
  const padRight = 256 - resized.info.width - padLeft;
  const padBottom = 256 - resized.info.height - padTop;

  const base256 = await sharp(resized.data)
    .extend({
      top: padTop,
      bottom: padBottom,
      left: padLeft,
      right: padRight,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = base256;

  // Save base scroll
  await sharp(data, { raw: { width: 256, height: 256, channels: 4 } })
    .webp({ quality: 94, alphaQuality: 100 })
    .toFile(join(outputDir, `scroll-${element}.webp`));

  // Tiers 1 to 5 (Iniciado, Oficial, Experto, Maestro, Gran maestro)
  const TIER_PARAMS = {
    1: { satMul: 1.0,  valMul: 1.0,  glowBias: 0 },
    2: { satMul: 1.10, valMul: 1.05, glowBias: 8 },
    3: { satMul: 1.20, valMul: 1.10, glowBias: 18 },
    4: { satMul: 1.30, valMul: 1.15, glowBias: 28 },
    5: { satMul: 1.42, valMul: 1.22, glowBias: 40 },
  };

  function hsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = !d ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(h * 60 + 360) % 360, max ? d / max : 0, max];
  }

  function rgb(h, s, v) {
    const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    const p = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return p.map(n => Math.round((n + m) * 255));
  }

  for (let tier = 1; tier <= 5; tier++) {
    const pixels = Buffer.from(data);
    const { satMul, valMul, glowBias } = TIER_PARAMS[tier];

    for (let p = 0; p < pixels.length; p += 4) {
      if (pixels[p + 3] < 20) continue;
      const [h, s, v] = hsv(pixels[p], pixels[p + 1], pixels[p + 2]);

      // Detect magical rune and elemental seal pixels according to element
      let isRuneOrSeal = false;
      if (element === 'fire' && (h >= 10 && h <= 55) && s > 0.35 && v > 0.35) isRuneOrSeal = true;
      if (element === 'frost' && (h >= 170 && h <= 245) && s > 0.25 && v > 0.35) isRuneOrSeal = true;
      if (element === 'lightning' && ((h >= 45 && h <= 65) || (h >= 190 && h <= 230)) && s > 0.25 && v > 0.4) isRuneOrSeal = true;
      if (element === 'vampirism' && (h >= 340 || h <= 25) && s > 0.35 && v > 0.25) isRuneOrSeal = true;
      if (element === 'dark' && (h >= 260 && h <= 325) && s > 0.22 && v > 0.25) isRuneOrSeal = true;

      if (isRuneOrSeal && tier > 1) {
        const newS = Math.min(1.0, s * satMul);
        const newV = Math.min(1.0, v * valMul + (glowBias / 255));
        const [nr, ng, nb] = rgb(h, newS, newV);
        pixels[p] = nr;
        pixels[p + 1] = ng;
        pixels[p + 2] = nb;
      }
    }

    const outName = `scroll-${element}-${tier}.webp`;
    await sharp(pixels, { raw: { width: 256, height: 256, channels: 4 } })
      .webp({ quality: 94, alphaQuality: 100 })
      .toFile(join(outputDir, outName));
    console.log(`Saved ${outName}`);
  }
}
