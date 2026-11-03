import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { processIconToWebp } from './process-all-components.mjs';

/**
 * Generates tier variants (0 to 5) for a potion family,
 * enhancing glow, saturation, and luminous essence across tiers.
 */
export async function generatePotionFromJpg(inputJpgPath, kind, outputDir) {
  const { processIconToWebp } = await import('./process-all-components.mjs');
  const baseOut = join(outputDir, `potion-${kind}.webp`);
  await processIconToWebp(inputJpgPath, baseOut);

  // Read the newly created base WebP fully into a buffer to release file handle
  const fileBytes = await readFile(baseOut);
  const { data, info } = await sharp(fileBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const TIER_PARAMS = [
    { satMul: 1.0,  valMul: 1.0,  glowBias: 0 },
    { satMul: 1.08, valMul: 1.03, glowBias: 5 },
    { satMul: 1.15, valMul: 1.06, glowBias: 10 },
    { satMul: 1.22, valMul: 1.10, glowBias: 18 },
    { satMul: 1.30, valMul: 1.14, glowBias: 26 },
    { satMul: 1.38, valMul: 1.18, glowBias: 35 },
  ];

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

  for (let tier = 0; tier < 6; tier++) {
    const pixels = Buffer.from(data);
    const { satMul, valMul, glowBias } = TIER_PARAMS[tier];

    for (let p = 0; p < pixels.length; p += 4) {
      if (pixels[p + 3] < 20) continue;
      const [h, s, v] = hsv(pixels[p], pixels[p + 1], pixels[p + 2]);

      let isLiquid = false;
      if (kind === 'health' && (h > 325 || h < 35) && s > 0.25) isLiquid = true;
      if (kind === 'mana' && h >= 175 && h <= 260 && s > 0.25) isLiquid = true;
      if (kind === 'stamina' && h >= 65 && h <= 170 && s > 0.25) isLiquid = true;

      if (isLiquid && tier > 0) {
        const newS = Math.min(1.0, s * satMul);
        const newV = Math.min(1.0, v * valMul + (glowBias / 255));
        const [nr, ng, nb] = rgb(h, newS, newV);
        pixels[p] = nr;
        pixels[p + 1] = ng;
        pixels[p + 2] = nb;
      }
    }

    const outName = `potion-${kind}-${tier}.webp`;
    await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
      .webp({ quality: 94, alphaQuality: 100 })
      .toFile(join(outputDir, outName));
    console.log(`Saved ${outName}`);
  }
}

