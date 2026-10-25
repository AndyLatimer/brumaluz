// Reproducible visual review of the production character builder, without an account.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const server = await createServer({ server: { host: '127.0.0.1', port: 4196, strictPort: true, hmr: false }, logLevel: 'error' });
let browser;
try {
  await mkdir('art/creator-review', { recursive: true });
  await server.listen();
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1800, height: 1500 } });
  await page.goto('http://127.0.0.1:4196/render.html');
  for (const mode of ['hair', 'profiles', 'backs', 'details', 'accessories', 'lineages']) {
    await page.evaluate(async mode => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const { Character, loadKits } = await import('/src/character/character.ts');
      const { defaultChar, HAIR_ACCS, HAIR_ACC_VALUES, ACCS, MAKEUPS } = await import('/src/data/data.ts');
      const { HAIR_STYLES, EYE_SHAPES, DETAILS, BEARDS } = await import('/src/character/head.ts');
      await loadKits();
      document.body.replaceChildren(); document.body.style.cssText = 'margin:0;background:#e6dfcf;color:#493d31;font-family:Georgia';
      const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(1800, 1500); renderer.setScissorTest(true); document.body.append(renderer.domElement);
      const scene = new THREE.Scene(); scene.background = new THREE.Color('#e6dfcf');
      scene.add(new THREE.HemisphereLight('#fff1db', '#798599', 2.5));
      const sun = new THREE.DirectionalLight('#fff3df', 2.7); sun.position.set(-3, 6, 8); scene.add(sun);
      const camera = new THREE.OrthographicCamera(-0.76, 0.76, 0.76, -0.76, 0.01, 40);
      const items = ['hair', 'profiles', 'backs'].includes(mode) ? HAIR_STYLES.map((name, hair) => ({ name, hair }))
        : mode === 'lineages' ? ['elfo', 'pelso', 'lagto'].flatMap(race => Array.from({ length: race === 'lagto' ? 6 : 5 }, (_, trait) => ({ name: `${race} · ${trait + 1}`, race, trait, hair: 13 })))
        : mode === 'details' ? [...EYE_SHAPES.slice(9).map((name, i) => ({ name, eyeShape: i + 9 })),
          ...DETAILS.slice(6).map((name, i) => ({ name, detail: i + 6 })),
          ...BEARDS.slice(6).map((name, i) => ({ name, beard: i + 6 })),
          ...MAKEUPS.slice(7).map((name, i) => ({ name, makeup: i + 7, makeupColor: 10 }))]
        : [...HAIR_ACCS.map((name, i) => ({ name, hairAcc: HAIR_ACC_VALUES[i] })),
          ...ACCS.slice(1).map((name, i) => ({ name, acc: i + 1 })),
          { name: 'Pelso · luna', race: 'pelso', acc: 9, hairAcc: 10 },
          { name: 'Elfo · hojas', race: 'elfo', hairAcc: 9, acc: 8 },
          { name: 'Lagto · cuentas', race: 'lagto', hairAcc: 11, acc: 10 }];
      for (let i = 0; i < items.length; i++) {
        const { name, ...appearance } = items[i];
        const actor = new Character({ ...defaultChar(), hair: 13, hairColor: 2, eyeColor: 8, beard: 0, acc: 0,
          hairAcc: 0, sex: 1, ...appearance }, { outfit: false });
        scene.add(actor.root); actor.update(0); actor.root.rotation.y = mode === 'profiles' ? Math.PI / 2 : mode === 'backs' ? Math.PI : i % 3 === 2 ? 0.65 : -0.2;
        const x = i % 6 * 300, y = 1500 - (Math.floor(i / 6) + 1) * 375;
        renderer.setViewport(x, y, 300, 350); renderer.setScissor(x, y, 300, 350);
        actor.root.updateMatrixWorld(true);
        const center = new THREE.Box3().setFromObject(actor.root.getObjectByName('character-skull')).getCenter(new THREE.Vector3());
        camera.position.copy(center).add(new THREE.Vector3(0, 0.04, 6)); camera.lookAt(center); renderer.render(scene, camera);
        const label = document.createElement('div'); label.textContent = `${i + 1}. ${name}`;
        label.style.cssText = `position:absolute;left:${x}px;top:${1500 - y - 28}px;width:300px;text-align:center;font-size:17px`;
        document.body.append(label); actor.dispose();
      }
      const still = document.createElement('img'); still.src = renderer.domElement.toDataURL('image/png');
      await still.decode(); renderer.domElement.replaceWith(still); renderer.dispose();
    }, mode);
    await page.screenshot({ path: `art/creator-review/${mode}.png` });
    console.log(`Reviewed ${mode}`);
  }
} finally { await browser?.close(); await server.close(); }
