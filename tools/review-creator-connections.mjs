import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const label = process.argv[2] ?? 'latest';
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Invalid review label');
const server = await createServer({ server: { host: '127.0.0.1', port: 4220, strictPort: true, hmr: false }, logLevel: 'error' });
let browser;
try {
  await server.listen(); browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/__connections', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;padding:18px;background:#29403a;color:#f4e4c5;font:14px Georgia,serif}h1{font-size:22px;margin:0 0 10px}
    article{margin-bottom:10px;background:#ead6ad;color:#47351f;border:1px solid #b08b51;border-radius:8px;overflow:hidden}h2{font-size:14px;margin:8px 12px}
    .views{display:grid;grid-template-columns:repeat(4,1fr)}figure{margin:0;text-align:center}canvas{display:block;width:100%;height:auto}figcaption{padding:5px}
    </style><h1>Conexiones de apariencia: orejas, pelo, monturas y cuello</h1><main></main>` }));
  await page.goto('http://127.0.0.1:4220/__connections', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const { Character, loadKits } = await import('/src/character/character.ts'); await loadKits();
    const source = await (await fetch('/src/character/portrait.ts')).text(), threeUrl = /from "([^"]*\/three\.js[^"]*)"/.exec(source)?.[1];
    if (!threeUrl) throw new Error('Cannot resolve Three module');
    const THREE = await import(threeUrl), { defaultChar, sanitize, RACES } = await import('/src/data/data.ts');
    const { withAccessoryLayer } = await import('/src/character/head/accessoryLayers.ts');
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setSize(325, 270);
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#e8d4a6'); scene.add(new THREE.HemisphereLight('#fff4dc', '#8a5a40', 1.5));
    const key = new THREE.DirectionalLight('#fff0d5', 2.2); key.position.set(-2, 3, 4); scene.add(key);
    const camera = new THREE.PerspectiveCamera(30, 325 / 270, .1, 20);
    window.connectionReport = [];
    window.renderConnections = inputRace => {
      document.querySelector('main').replaceChildren();
      const equipped = inputRace === 'equipment', outfits = [
        { race: 'humano', cls: 'guerrero', trait: 0, hair: 23 }, { race: 'elfo', cls: 'guerrero', trait: 4, hair: 8 },
        { race: 'pelso', cls: 'mago', trait: 3, hair: 27 }, { race: 'lagto', cls: 'explorador', trait: 2, hair: 12 },
      ];
      const count = equipped ? outfits.length : Math.max(inputRace === 'humano' ? 4 : 0, RACES[inputRace].traits.length);
      for (let index = 0; index < count; index++) {
        const race = equipped ? outfits[index].race : inputRace, trait = equipped ? outfits[index].trait : index;
        const hair = equipped ? outfits[index].hair : [0, 8, 12, 23, 25, 27][trait], face = index % 4;
        let acc = 0; for (const [part, value] of Object.entries({ eyewear: trait % 3 === 1 ? 1 : 11, earrings: [8, 9, 13, 4, 8, 9][trait], neckwear: trait % 2 ? 2 : 12, mask: trait % 2 ? 7 : 0 })) acc = withAccessoryLayer(acc, part, value);
        const data = sanitize({ ...defaultChar(), race, cls: equipped ? outfits[index].cls : 'guerrero', trait: race === 'humano' ? 0 : trait, face, hair, hairColor: 2, beard: 0, eyeShape: trait % 2 ? 1 : 12, nose: 8,
          acc, accColor: 9, hairAcc: [1, 9, 10, 4, 2, 3][trait], hairAccColor: 1, makeup: 0, height: trait % 2, build: 1 - trait % 2 });
        const actor = new Character(data, { outfit: equipped }); actor.update(0); scene.add(actor.root); scene.updateMatrixWorld(true);
        const article = document.createElement('article'), title = document.createElement('h2'), views = document.createElement('div'); views.className = 'views';
        title.textContent = `${race} / ${RACES[race].traits[trait] ?? `rostro ${face}`} / pelo ${hair} / ${equipped ? data.cls : trait % 2 ? 'bufanda y paño' : 'medallón'} / proporción ${data.height},${data.build}`;
        article.append(title, views); document.querySelector('main').append(article);
        const center = actor.headWorld().add(new THREE.Vector3(0, -.17, 0));
        for (const [name, yaw, pitch] of [['Frente', 0, 0], ['Perfil izquierdo', -Math.PI / 2, 0], ['Perfil derecho', Math.PI / 2, 0], ['Nuca', Math.PI, .2]]) {
          actor.root.rotation.y = yaw; scene.updateMatrixWorld(true); camera.position.copy(center).add(new THREE.Vector3(0, Math.sin(pitch) * 3, Math.cos(pitch) * 3)); camera.lookAt(center); camera.updateProjectionMatrix();
          renderer.render(scene, camera); const canvas = document.createElement('canvas'); canvas.width = 325; canvas.height = 270; canvas.getContext('2d').drawImage(renderer.domElement, 0, 0);
          const figure = document.createElement('figure'), caption = document.createElement('figcaption'); caption.textContent = name; figure.append(canvas, caption); views.append(figure);
        }
        actor.root.rotation.y = 0; scene.updateMatrixWorld(true);
        const skull = actor.root.getObjectByName('character-skull'), fromWorld = skull.matrixWorld.clone().invert(), geometry = skull.geometry;
        geometry.computeBoundingBox(); const skullCenter = geometry.boundingBox.getCenter(new THREE.Vector3());
        const proxyMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), proxy = new THREE.Mesh(geometry, proxyMat), ray = new THREE.Raycaster(); proxy.updateMatrixWorld(true);
        const gaps = { lens: [], mask: [] };
        const sample = (node, list) => node.traverse(mesh => {
          if (!mesh.isMesh) return; const p = mesh.geometry.attributes.position;
          for (let i = 0; i < p.count; i += Math.max(1, Math.floor(p.count / 20))) {
            const point = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(fromWorld), dir = point.clone().sub(skullCenter).normalize();
            ray.set(skullCenter.clone().addScaledVector(dir, 3), dir.clone().negate()); const hit = ray.intersectObject(proxy)[0];
            if (hit) list.push(point.distanceTo(skullCenter) - hit.point.distanceTo(skullCenter));
          }
        });
        actor.root.traverse(node => { if (node.name === 'character-glasses-lens') sample(node, gaps.lens); if (node.name === 'traveler-mask') sample(node, gaps.mask); });
        window.connectionReport.push({ race, trait: data.trait, face, hair, acc, minimumLensSkullGap: Math.min(...gaps.lens), minimumMaskSkullGap: gaps.mask.length ? Math.min(...gaps.mask) : null });
        proxyMat.dispose(); scene.remove(actor.root); actor.dispose();
      }
    };
  });
  await mkdir('art/creator-connections-review', { recursive: true });
  for (const race of process.argv.includes('--equipment-only') ? ['equipment'] : ['humano', 'elfo', 'lagto', 'pelso', 'equipment']) {
    await page.evaluate(race => window.renderConnections(race), race);
    await page.screenshot({ path: `art/creator-connections-review/${label}-${race}.png`, fullPage: true });
  }
  const report = await page.evaluate(() => window.connectionReport);
  await writeFile(`art/creator-connections-review/${label}.json`, JSON.stringify({ report, errors }, null, 2));
  assert.deepEqual(errors, []); console.log(JSON.stringify({ label, cases: report.length, report }));
} finally { await browser?.close(); await server.close(); }
