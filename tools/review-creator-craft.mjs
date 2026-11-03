import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const label = process.argv[2] ?? 'latest';
assert.match(label, /^[a-z0-9-]+$/);
const server = await createServer({ server: { host: '127.0.0.1', port: 4227, strictPort: true, hmr: false }, logLevel: 'error' });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/__craft', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;padding:18px;background:#293b35;color:#f4e5c9;font:16px Georgia,serif}h1{font-size:24px;margin:0 0 16px}
    main{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}article{background:#e7ca8e;color:#493a24;border:1px solid #b48a4b;border-radius:8px;overflow:hidden}
    h2{font-size:16px;text-align:center;margin:10px}.views{display:grid;grid-template-columns:repeat(3,1fr)}canvas{display:block;width:100%;height:auto}
    </style><h1>Brumaluz · detalle y encaje de personalización</h1><main></main>` }));
  await page.goto('http://127.0.0.1:4227/__craft');
  await page.evaluate(async () => {
    const { loadKits } = await import('/src/character/character.ts'); await loadKits();
    const source = await (await fetch('/src/character/portrait.ts')).text(), url = /from "([^"]*\/three\.js[^"]*)"/.exec(source)?.[1];
    const THREE = await import(url), renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    const { defaultChar } = await import('/src/data/data.ts');
    const { BEARDS, HAIR_STYLES } = await import('/src/character/head.ts');
    const { createCharacterPortrait } = await import('/src/character/portrait.ts');
    const card = (title, patch) => {
      const article = document.createElement('article'), h2 = document.createElement('h2'), views = document.createElement('div');
      h2.textContent = title; views.className = 'views'; article.append(h2, views); document.querySelector('main').append(article);
      for (const yaw of [0, Math.PI * .28, Math.PI / 2]) views.append(createCharacterPortrait({ ...defaultChar(), hair: 1, eyeShape: 9, brows: 8, hairColor: 2, ...patch }, renderer, { closeup: true, scale: 1.15, aspect: .8, yaw }));
    };
    window.reviewCraft = section => {
      document.querySelector('main').replaceChildren();
      if (section === 'beards') for (let beard = 0; beard < BEARDS.length; beard++) card(BEARDS[beard], { beard, hair: 0 });
      if (section === 'marks') for (const [title, detail] of [['Pecas', 2], ['Cicatriz', 3], ['Pecas de sol', 6], ['Constelación', 7], ['Hoja', 8], ['Cicatriz de ceja', 9], ['Runas', 10], ['Combinación', 179]]) card(title, { detail, hair: 0 });
      if (section === 'hair') for (const hair of [1, 2, 8, 11, 20, 24, 25, ...HAIR_STYLES.map((_, id) => id).filter(id => id >= 28)]) card(HAIR_STYLES[hair], { hair });
      if (section === 'lineages') for (const [race, face, hair, beard, detail, skin] of [['humano', 0, 28, 1, 6, 4], ['elfo', 1, 30, 0, 15, 3], ['lagto', 2, 31, 8, 10, 2], ['pelso', 3, 29, 0, 2, 3]]) card(race, { race, face, hair: Math.min(hair, HAIR_STYLES.length - 1), beard, detail, skin, acc: 11 });
    };
  });
  await mkdir('art/creator-craft-review', { recursive: true });
  const sections = process.argv.slice(3);
  for (const section of sections.length ? sections : ['beards', 'marks', 'hair', 'lineages']) {
    assert.ok(['beards', 'marks', 'hair', 'lineages'].includes(section));
    await page.evaluate(section => window.reviewCraft(section), section);
    await page.screenshot({ path: `art/creator-craft-review/${label}-${section}.png`, fullPage: true });
  }
  assert.deepEqual(errors, []);
  console.log(`Reviewed beards, marks, hair and four lineages: art/creator-craft-review/${label}-*.png`);
} finally { await browser?.close(); await server.close(); }
