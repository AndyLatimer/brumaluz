import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ server: { host: '127.0.0.1', port: 4223, strictPort: true, hmr: false }, logLevel: 'error' });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/__expressions', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;padding:20px;background:#263c35;color:#f2e5c5;font:16px Georgia}
    h1{font-size:24px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
    article{overflow:hidden;border:1px solid #b59b65;border-radius:9px;background:#efdfba;color:#493c29;text-align:center}
    canvas{display:block;width:100%;height:auto}h2{font-size:16px;margin:10px}
    </style><h1>Brumaluz</h1><div class="grid"></div>` }));
  await page.goto('http://127.0.0.1:4223/__expressions');
  const report = await page.evaluate(async () => {
    const { loadKits } = await import('/src/character/character.ts'); await loadKits();
    const transformed = await (await fetch('/src/character/portrait.ts')).text();
    const THREE = await import(/from "([^"]*\/three\.js[^\"]*)"/.exec(transformed)[1]);
    const { createCharacterPortrait } = await import('/src/character/portrait.ts');
    const { defaultChar } = await import('/src/data/data.ts');
    const { EYE_SHAPES, BROWS, MOUTHS } = await import('/src/character/head.ts');
    const { STYLE_PRESETS, applyLook } = await import('/src/data/creatorStudio.ts');
    const { eyeBounds, eyePatch } = await import('/src/character/head/eyeContours.ts');
    const { withAccessoryLayer } = await import('/src/character/head/accessoryLayers.ts');
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    const base = { ...defaultChar(), face: 0, hair: 13, hairColor: 2, eyeColor: 9, beard: 0, acc: 0, detail: 0, makeup: 0, brows: 0, mouth: 0 };
    const render = (name, data, yaw = 0) => {
      const card = document.createElement('article'), title = document.createElement('h2'); title.textContent = name;
      card.append(createCharacterPortrait(data, renderer, { closeup: true, scale: 1.5, aspect: 1, yaw }), title);
      document.querySelector('.grid').append(card);
    };
    const groups = {
      eyes: () => EYE_SHAPES.forEach((name, eyeShape) => render(name, { ...base, eyeShape })),
      brows: () => BROWS.forEach((name, brows) => render(name, { ...base, brows, eyeShape: 9 })),
      mouths: () => MOUTHS.forEach((name, mouth) => render(name, { ...base, mouth, eyeShape: 4 })),
      combinations: () => STYLE_PRESETS.forEach(p => render(p.label, applyLook(base, p.look))),
      lineages: () => {
        for (const race of ['humano', 'elfo', 'pelso', 'lagto']) for (const eyeShape of [1, 5, 8, 12]) {
          const eyewear = withAccessoryLayer(0, 'eyewear', eyeShape === 8 ? 11 : 1);
          render(`${race} / ${EYE_SHAPES[eyeShape]}`, { ...base, race, face: eyeShape % 4, eyeShape, brows: eyeShape % 9, makeup: 6, acc: eyewear }, .22);
        }
      },
    };
    window.expressionReview = name => {
      document.querySelector('.grid').replaceChildren(); document.querySelector('h1').textContent = `Brumaluz / ${name}`; groups[name]();
    };
    // Every coloured layer must stay inside its eyelids, even with slit pupils.
    let samples = 0;
    const signatures = new Set();
    for (let id = 0; id < EYE_SHAPES.length; id++) {
      signatures.add(JSON.stringify(Array.from({ length: 9 }, (_, i) => eyeBounds(id, (i - 4) / 5))));
      for (const side of [-1, 1]) for (const ellipse of [undefined, { rx: .034, ry: .05, x: -.02, y: .035 }, { rx: .010, ry: .06, x: 0, y: 0 }]) {
        const geometry = eyePatch(id, .07, .08, side, ellipse), p = geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), b = eyeBounds(id, x / .07 * side);
          if (![x, y, p.getZ(i)].every(Number.isFinite) || y > b.top * .08 + 1e-5 || y < b.bottom * .08 - 1e-5) throw new Error(`Eye ${id}: layer escaped eyelid`);
          samples++;
        }
        geometry.dispose();
      }
    }
    return { samples, uniqueContours: signatures.size };
  });
  assert.equal(report.uniqueContours, 13);
  await mkdir('art/creator-expression-review', { recursive: true });
  for (const name of ['eyes', 'brows', 'mouths', 'combinations', 'lineages']) {
    await page.evaluate(name => window.expressionReview(name), name);
    await page.screenshot({ path: `art/creator-expression-review/${name}.png`, fullPage: true });
  }
  assert.deepEqual(errors, []); console.log(JSON.stringify(report));
} finally { await browser?.close(); await server.close(); }
