import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ server: { host: '127.0.0.1', port: 4209, strictPort: true, hmr: false }, logLevel: 'error' });
const reviewHtml = `<!doctype html><html lang="es"><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;padding:24px;background:#263c35;color:#f2e5c5;font:14px Georgia,serif}
    h1{margin:0 0 8px;font-size:25px}p{margin:0 0 18px;color:#d5c7a8}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
    article{border:1px solid #b59b65;border-radius:10px;overflow:hidden;background:#efdfba;color:#493c29}
    h2{font-size:15px;text-align:center;margin:12px 8px}.views{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
    canvas{display:block;width:100%;height:auto}small{display:block;text-align:center;padding:7px;background:#e4cfa5}
  </style><h1>Taller de personajes · siluetas y complementos</h1><p>Frente, perfil y espalda · montaje compartido por creador, retratos y juego</p><div class="grid"></div></html>`;
let browser;
try {
  await server.listen(); browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/__creator-options', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: reviewHtml }));
  await page.goto('http://127.0.0.1:4209/__creator-options');
  await page.evaluate(async () => {
    const { loadKits } = await import('/src/character/character.ts'); await loadKits();
    const transformed = await (await fetch('/src/character/portrait.ts')).text();
    const threeUrl = /from "([^"]*\/three\.js[^\"]*)"/.exec(transformed)?.[1];
    if (!threeUrl) throw new Error('Cannot resolve shared Three module');
    const THREE = await import(threeUrl);
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    const { defaultChar } = await import('/src/data/data.ts');
    const { HAIR_STYLES } = await import('/src/character/head.ts');
    const { createCharacterPortrait } = await import('/src/character/portrait.ts');
    const { withAccessoryLayer } = await import('/src/character/head/accessoryLayers.ts');
    const grid = document.querySelector('.grid');
    const renderCard = (title, data, scale = .8) => {
      const card = document.createElement('article'), heading = document.createElement('h2'), views = document.createElement('div');
      heading.textContent = title; views.className = 'views'; card.append(heading, views); grid.append(card);
      for (const [label, yaw] of [['Frente', 0], ['Perfil', Math.PI / 2], ['Espalda', Math.PI]]) {
        const view = document.createElement('div'), caption = document.createElement('small'); caption.textContent = label;
        view.append(createCharacterPortrait(data, renderer, { scale, aspect: .8, closeup: true, yaw }), caption); views.append(view);
      }
    };
    for (let hair = 22; hair < 28; hair++) renderCard(HAIR_STYLES[hair], { ...defaultChar(), hair, hairColor: 2, eyeShape: 10, clothA: 12, clothB: 7 });
    let acc = withAccessoryLayer(0, 'eyewear', 11); acc = withAccessoryLayer(acc, 'neckwear', 12); acc = withAccessoryLayer(acc, 'earrings', 13);
    for (const race of ['humano', 'elfo', 'lagto', 'pelso']) renderCard(`Gafas, medallón y perlas · ${race}`, { ...defaultChar(), race, hair: 26, acc, accColor: 9, clothA: 3, clothB: 7 });
    renderCard('Pañuelo y gafas · barba conservada', { ...defaultChar(), hair: 22, beard: 8, acc: withAccessoryLayer(acc, 'mask', 7) });
    renderCard('Lazo de tela y bufanda', { ...defaultChar(), hair: 23, hairAcc: 2, hairAccColor: 3, acc: 6, accColor: 11 });
    renderCard('Pétalos y rizos', { ...defaultChar(), hair: 25, hairAcc: 1, hairAccColor: 12 });
    renderCard('Corona de flores', { ...defaultChar(), hair: 20, hairAcc: 4, hairAccColor: 7 });
    window.renderRefinedOptions = () => {
      grid.replaceChildren();
      for (const hair of [1, 2, 5, 18, 20, 24]) renderCard(HAIR_STYLES[hair], { ...defaultChar(), hair, hairColor: 2 });
      renderCard('Luna creciente y pendientes', { ...defaultChar(), hair: 23, hairAcc: 10, hairAccColor: 1, acc: 9, accColor: 1 });
      renderCard('Pasador de hojas', { ...defaultChar(), race: 'elfo', hair: 18, hairAcc: 9, hairAccColor: 10 });
      renderCard('Flequillo y recogido doble', { ...defaultChar(), hair: 27, hairColor: 12 });
    };
    window.renderCreatorDetails = () => {
      grid.replaceChildren(); grid.style.gridTemplateColumns = '1fr';
      renderCard('Rizos · relieve continuo y nacimiento', { ...defaultChar(), hair: 25, hairColor: 2 }, 2.2);
      renderCard('Moño · pliegues y raíces', { ...defaultChar(), hair: 23, hairColor: 2 }, 2.2);
      renderCard('Tela · lazo y bufanda con dobladillos', { ...defaultChar(), hair: 23, hairAcc: 2, hairAccColor: 3, acc: 6, accColor: 11 }, 2.2);
      renderer.dispose();
    };
  });
  await mkdir('art/creator-studio-review', { recursive: true });
  await page.screenshot({ path: 'art/creator-studio-review/expanded-options.png', fullPage: true });
  await page.evaluate(() => window.renderRefinedOptions());
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'art/creator-studio-review/refined-options.png', fullPage: true });
  await page.evaluate(() => window.renderCreatorDetails());
  await page.screenshot({ path: 'art/creator-studio-review/sculpted-details.png', fullPage: true });
  assert.deepEqual(errors, []); console.log('Reviewed six hairstyles and layered accessories in all four lineages.');
} finally { await browser?.close(); await server.close(); }
