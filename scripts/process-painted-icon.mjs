import sharp from 'sharp';

export async function processIconToWebp(inputPath, outputPath) {
  const { data, info } = await sharp(inputPath).raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const rgba = Buffer.alloc(width * height * 4);

  // 1. BFS to find connected background
  // Pixels with r,g,b > 245 are definitely background
  const visited = new Uint8Array(width * height);
  const queue = [];

  const isPureBg = (p) => {
    const r = data[p * 3], g = data[p * 3 + 1], b = data[p * 3 + 2];
    return r > 242 && g > 242 && b > 242;
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
        // BFS into anything light (> 230)
        if (nr > 230 && ng > 230 && nb > 230) {
          visited[n] = 1;
          queue.push(n);
        }
      }
    }
  }

  // Also find soft shadow pixels connected to the background
  // Shadows under objects have low saturation and brightness between 160 and 230
  // Expand visited/shadow
  const isShadow = (p) => {
    const r = data[p * 3], g = data[p * 3 + 1], b = data[p * 3 + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max > 0 ? (max - min) / max : 0;
    const bright = (r + g + b) / 3;
    // Lower half of image typically contains the ground shadow
    const y = Math.floor(p / width);
    return y > height * 0.5 && sat < 0.12 && bright > 150 && bright <= 230;
  };

  // 2. Build RGBA
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const outIdx = i * 4;

    if (visited[i]) {
      // Pure background
      rgba[outIdx] = 0;
      rgba[outIdx + 1] = 0;
      rgba[outIdx + 2] = 0;
      rgba[outIdx + 3] = 0;
    } else if (isShadow(i)) {
      // It is a ground shadow painted on white!
      // Convert it to dark warm contact shadow [35, 28, 24] with natural alpha
      const bright = (r + g + b) / 3;
      // Alpha: darker shadow = higher alpha
      const alpha = Math.max(0, Math.min(200, Math.round((240 - bright) * 1.5)));
      rgba[outIdx] = 32;
      rgba[outIdx + 1] = 26;
      rgba[outIdx + 2] = 22;
      rgba[outIdx + 3] = alpha;
    } else {
      // Subject pixel.
      // Check if it's on the edge touching visited (anti-aliasing fringe)
      const x = i % width;
      const y = Math.floor(i / width);
      let touchBg = false;
      if ((x > 0 && visited[i - 1]) || (x < width - 1 && visited[i + 1]) ||
          (y > 0 && visited[i - width]) || (y < height - 1 && visited[i + width])) {
        touchBg = true;
      }

      if (touchBg) {
        // If it's very light on the border, it's blended with white
        const bright = (r + g + b) / 3;
        if (bright > 180) {
          const alpha = Math.max(0, Math.min(255, Math.round((255 - bright) * 2.5)));
          // De-fringe: use darker tone instead of white fringe
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

  // Trim and resize like prepare-painted-inventory-icons.mjs
  return sharp(rgba, { raw: { width, height, channels: 4 } })
    .trim({ threshold: 8 })
    .resize(224, 224, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 16, bottom: 16, left: 16, right: 16, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 94, alphaQuality: 100 })
    .toFile(outputPath);
}

// Run for blacksmithing
processIconToWebp(
  'C:/Users/sevil/.gemini/antigravity/brain/820f133d-7bd5-41bf-8dee-1f128721b5f5/blacksmithing_component_icon_1793380978322.jpg',
  'src/assets/icons/inventory-painted/componente-herreria.webp'
).then(res => {
  console.log('Saved refined componente-herreria.webp:', res);
});
