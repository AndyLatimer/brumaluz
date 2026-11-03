import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

/**
 * Robust background extraction & soft contact shadow preservation
 * tailored specifically for inventory icons on solid white backgrounds.
 */
export async function processIconToWebp(inputPath, outputPath) {
  const { data, info } = await sharp(inputPath).raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const rgba = Buffer.alloc(width * height * 4);

  // 1. BFS flood-fill from all 4 borders to mark exterior background
  const visited = new Uint8Array(width * height);
  const queue = [];

  const isPureBg = (p) => {
    const r = data[p * 3], g = data[p * 3 + 1], b = data[p * 3 + 2];
    return r > 240 && g > 240 && b > 240;
  };

  for (let x = 0; x < width; x++) {
    if (isPureBg(x)) { queue.push(x); visited[x] = 1; }
    const b = (height - 1) * width + x;
    if (isPureBg(b)) { queue.push(b); visited[b] = 1; }
  }
  for (let y = 1; y < height - 1; y++) {
    const l = y * width;
    if (isPureBg(l)) { queue.push(l); visited[l] = 1; }
    const r = y * width + (width - 1);
    if (isPureBg(r)) { queue.push(r); visited[r] = 1; }
  }

  let head = 0;
  while (head < queue.length) {
    const p = queue[head++];
    const x = p % width;
    const y = Math.floor(p / width);

    const neighbors = [];
    if (x > 0) neighbors.push(p - 1);
    if (x < width - 1) neighbors.push(p + 1);
    if (y > 0) neighbors.push(p - width);
    if (y < height - 1) neighbors.push(p + width);

    for (const n of neighbors) {
      if (!visited[n]) {
        const nr = data[n * 3], ng = data[n * 3 + 1], nb = data[n * 3 + 2];
        if (nr > 225 && ng > 225 && nb > 225) {
          visited[n] = 1;
          queue.push(n);
        }
      }
    }
  }

  // Soft contact shadow detector (ground shadow on lower half, low saturation)
  const isShadow = (p) => {
    const r = data[p * 3], g = data[p * 3 + 1], b = data[p * 3 + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max > 0 ? (max - min) / max : 0;
    const bright = (r + g + b) / 3;
    const y = Math.floor(p / width);
    return y > height * 0.45 && sat < 0.14 && bright > 140 && bright <= 228;
  };

  for (let i = 0; i < width * height; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const outIdx = i * 4;

    if (visited[i]) {
      rgba[outIdx] = 0;
      rgba[outIdx + 1] = 0;
      rgba[outIdx + 2] = 0;
      rgba[outIdx + 3] = 0;
    } else if (isShadow(i)) {
      const bright = (r + g + b) / 3;
      const alpha = Math.max(0, Math.min(190, Math.round((235 - bright) * 1.6)));
      rgba[outIdx] = 32;
      rgba[outIdx + 1] = 26;
      rgba[outIdx + 2] = 22;
      rgba[outIdx + 3] = alpha;
    } else {
      const x = i % width;
      const y = Math.floor(i / width);
      let touchBg = false;
      if ((x > 0 && visited[i - 1]) || (x < width - 1 && visited[i + 1]) ||
          (y > 0 && visited[i - width]) || (y < height - 1 && visited[i + width])) {
        touchBg = true;
      }

      if (touchBg) {
        const bright = (r + g + b) / 3;
        if (bright > 180) {
          const alpha = Math.max(0, Math.min(255, Math.round((255 - bright) * 2.5)));
          rgba[outIdx] = Math.min(r, 120);
          rgba[outIdx + 1] = Math.min(g, 120);
          rgba[outIdx + 2] = Math.min(b, 120);
          rgba[outIdx + 3] = alpha;
        } else {
          rgba[outIdx] = r;
          rgba[outIdx + 1] = g;
          rgba[outIdx + 2] = b;
          rgba[outIdx + 3] = 255;
        }
      } else {
        rgba[outIdx] = r;
        rgba[outIdx + 1] = g;
        rgba[outIdx + 2] = b;
        rgba[outIdx + 3] = 255;
      }
    }
  }

  return sharp(rgba, { raw: { width, height, channels: 4 } })
    .trim({ threshold: 8 })
    .resize(224, 224, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 16, bottom: 16, left: 16, right: 16, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 94, alphaQuality: 100 })
    .toFile(outputPath);
}

// Color palettes for leather tiers 0 to 5
const LEATHER_PALETTES = [
  '#ab6b36', // 0: Aprendiz (warm cognac)
  '#7d655d', // 1: Iniciado (ash grey-brown)
  '#4a6b8a', // 2: Oficial (slate blue)
  '#74479c', // 3: Experto (royal violet)
  '#bd9124', // 4: Maestro (golden amber)
  '#b83939', // 5: Gran maestro (crimson red)
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

export async function generateLeatherTiers(basePeltWebpPath, outputDir) {
  const baseImg = sharp(basePeltWebpPath);
  const { data, info } = await baseImg.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  for (let tier = 0; tier < 6; tier++) {
    const pixels = Buffer.from(data);
    if (tier > 0) {
      const hex = LEATHER_PALETTES[tier];
      const targetR = parseInt(hex.slice(1, 3), 16);
      const targetG = parseInt(hex.slice(3, 5), 16);
      const targetB = parseInt(hex.slice(5, 7), 16);
      const [th, ts, tv] = hsv(targetR, targetG, targetB);

      for (let p = 0; p < pixels.length; p += 4) {
        if (pixels[p + 3] < 20) continue;
        const [h, s, v] = hsv(pixels[p], pixels[p + 1], pixels[p + 2]);
        // Tint leather body (exclude pale thread or dark border)
        if (s > 0.12 && v > 0.18) {
          const tinted = rgb(th, Math.min(0.85, s * 0.2 + ts * 0.8), v);
          pixels[p] = tinted[0];
          pixels[p + 1] = tinted[1];
          pixels[p + 2] = tinted[2];
        }
      }
    }
    const outName = `cuero-${tier}.webp`;
    await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
      .webp({ quality: 94, alphaQuality: 100 })
      .toFile(join(outputDir, outName));
    console.log(`Generated leather tier ${tier}: ${outName}`);
  }
}

