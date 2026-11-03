import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

/**
 * Processes rendered 3D furniture PNGs into crisp, centered 256x256 WebP icons
 * and generates tiers 0 to 5 reflecting authentic wood progressions:
 * - T0 (Aprendiz): Madera común / pino cálido rústico
 * - T1 (Iniciado): Roble miel dorado con herrajes de bronce
 * - T2 (Oficial): Abedul / madera noble clara satinada
 * - T3 (Experto): Nogal oscuro profundo con orfebrería de latón
 * - T4 (Maestro): Ébano / caoba con lustre regio
 * - T5 (Gran maestro): Madera ancestral mística con orfebrería y vetas luminosas
 */
export async function generateFurnitureFromPng(inputPngPath, kind, outputDir) {
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

  // Save base icon
  await sharp(data, { raw: { width: 256, height: 256, channels: 4 } })
    .webp({ quality: 94, alphaQuality: 100 })
    .toFile(join(outputDir, `mueble-${kind}.webp`));

  // Tiers 0 to 5
  const TIER_PARAMS = [
    { satMul: 1.0,  valMul: 1.0,  hueShift: 0,  glow: 0 },   // T0: Pino natural
    { satMul: 1.08, valMul: 1.04, hueShift: -2, glow: 5 },   // T1: Roble dorado
    { satMul: 0.88, valMul: 1.15, hueShift: 4,  glow: 10 },  // T2: Abedul claro
    { satMul: 1.18, valMul: 0.84, hueShift: -4, glow: 0 },   // T3: Nogal oscuro
    { satMul: 1.25, valMul: 0.72, hueShift: -6, glow: 0 },   // T4: Ébano / caoba
    { satMul: 1.35, valMul: 1.12, hueShift: 0,  glow: 24 },  // T5: Madera ancestral mística
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

  for (let tier = 0; tier <= 5; tier++) {
    const pixels = Buffer.from(data);
    const { satMul, valMul, hueShift, glow } = TIER_PARAMS[tier];

    if (tier > 0) {
      for (let p = 0; p < pixels.length; p += 4) {
        if (pixels[p + 3] < 20) continue;
        const [h, s, v] = hsv(pixels[p], pixels[p + 1], pixels[p + 2]);

        // Shift wood tones, keep metals/greens/shadows distinct
        const isWoodOrGeneral = s > 0.15;
        if (isWoodOrGeneral) {
          const newH = (h + hueShift + 360) % 360;
          const newS = Math.min(1.0, s * satMul);
          const newV = Math.min(1.0, Math.max(0.04, v * valMul + (glow / 255)));
          const [nr, ng, nb] = rgb(newH, newS, newV);
          pixels[p] = nr;
          pixels[p + 1] = ng;
          pixels[p + 2] = nb;
        }
      }
    }

    const outName = `mueble-${kind}-${tier}.webp`;
    await sharp(pixels, { raw: { width: 256, height: 256, channels: 4 } })
      .webp({ quality: 94, alphaQuality: 100 })
      .toFile(join(outputDir, outName));
    console.log(`Saved ${outName}`);
  }
}

