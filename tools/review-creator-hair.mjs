import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const label = process.argv[2] ?? 'latest';
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Invalid review label');
const server = await createServer({ server: { host: '127.0.0.1', port: 4214, strictPort: true, hmr: false }, logLevel: 'error' });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  const page = await browser.newPage({ viewport: { width: 1320, height: 900 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/__hair-review', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="es"><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;padding:20px;background:#29403a;color:#f3e7ce;font:14px Georgia,serif}
    h1{font-size:22px;margin:0 0 12px}article{margin:0 0 10px;background:#eddfbd;border:1px solid #ad8c53;border-radius:8px;overflow:hidden;color:#4b3927}
    h2{font-size:14px;margin:7px 12px}.views{display:grid;grid-template-columns:repeat(5,1fr)}figure{margin:0;text-align:center}canvas{display:block;width:100%;height:auto}figcaption{padding:5px;font-size:12px}
    </style><h1>Peinados: frente, ambos perfiles, nuca y coronilla</h1><main></main></html>` }));
  await page.goto('http://127.0.0.1:4214/__hair-review');
  await page.evaluate(async () => {
    const { Character, loadKits } = await import('/src/character/character.ts'); await loadKits();
    const transformed = await (await fetch('/src/character/portrait.ts')).text();
    const threeUrl = /from "([^"]*\/three\.js[^"]*)"/.exec(transformed)?.[1];
    if (!threeUrl) throw new Error('Cannot resolve shared Three module');
    const THREE = await import(threeUrl);
    const { defaultChar, sanitize } = await import('/src/data/data.ts');
    const { HAIR_STYLES } = await import('/src/character/head.ts');
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setSize(250, 225);
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#e8d4a6');
    scene.add(new THREE.HemisphereLight('#fff4dc', '#8a5a40', 1.5));
    const key = new THREE.DirectionalLight('#fff0d5', 2.2); key.position.set(-2, 3, 4); scene.add(key);
    const camera = new THREE.PerspectiveCamera(30, 250 / 225, .1, 20);
    window.reviewHair = (ids, face = 2, race = 'humano', showParts = false) => {
      document.querySelector('main').replaceChildren();
      for (const hair of ids) {
        const actor = new Character(sanitize({ ...defaultChar(), face, race, hair, hairColor: 2, beard: 0, acc: 0, hairAcc: 0, makeup: 0 }), { outfit: false });
        actor.update(0); scene.add(actor.root); scene.updateMatrixWorld(true);
        const diagnosticMaterials = [];
        if (showParts) actor.root.traverse(node => {
          if (node.name !== 'character-hair') return;
          const material = new THREE.MeshBasicMaterial({ color: diagnosticMaterials.length ? '#e53339' : '#32b753' });
          diagnosticMaterials.push(material); node.material = material;
        });
        const center = actor.headWorld().add(new THREE.Vector3(0, -.06, 0));
        const article = document.createElement('article'), title = document.createElement('h2'), views = document.createElement('div');
        title.textContent = `${hair}: ${HAIR_STYLES[hair]} / rostro ${face} / ${race}`; views.className = 'views'; article.append(title, views); document.querySelector('main').append(article);
        for (const [name, yaw, pitch] of [['Frente', 0, 0], ['Perfil izquierdo', -Math.PI / 2, 0], ['Perfil derecho', Math.PI / 2, 0], ['Espalda', Math.PI, 0], ['Coronilla', Math.PI, .85]]) {
          actor.root.rotation.y = yaw; scene.updateMatrixWorld(true);
          camera.position.copy(center).add(new THREE.Vector3(0, Math.sin(pitch) * 2.9, Math.cos(pitch) * 2.9)); camera.lookAt(center); camera.updateProjectionMatrix(); renderer.render(scene, camera);
          const figure = document.createElement('figure'), canvas = document.createElement('canvas'), caption = document.createElement('figcaption');
          canvas.width = 250; canvas.height = 225; canvas.getContext('2d').drawImage(renderer.domElement, 0, 0); caption.textContent = name; figure.append(canvas, caption); views.append(figure);
        }
        scene.remove(actor.root); actor.dispose(); diagnosticMaterials.forEach(material => material.dispose());
      }
    };
  });
  await mkdir('art/creator-studio-review', { recursive: true });
  for (let group = 0; group < 4; group++) {
    await page.evaluate(group => window.reviewHair(Array.from({ length: 7 }, (_, index) => group * 7 + index)), group);
    await page.screenshot({ path: `art/creator-studio-review/hair-${label}-${group}.png`, fullPage: true });
  }
  if (process.argv.includes('--fit')) for (let face = 0; face < 4; face++) {
    await page.evaluate(face => window.reviewHair([7, 12, 13, 14, 15, 21, 26], face), face);
    await page.screenshot({ path: `art/creator-studio-review/hair-${label}-fit-${face}.png`, fullPage: true });
  }
  if (process.argv.includes('--parts')) {
    await page.evaluate(() => window.reviewHair([12, 15], 2, 'humano', true));
    await page.screenshot({ path: `art/creator-studio-review/hair-${label}-parts.png`, fullPage: true });
  }
  assert.deepEqual(errors, []); console.log(`Reviewed all 28 hairstyles in five views (${label}).`);
} finally { await browser?.close(); await server.close(); }
