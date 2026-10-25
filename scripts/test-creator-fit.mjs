// Focused source checks also work while unrelated game entry points are being edited.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';
import { chromium } from 'playwright';

let server, browser, page;
before(async () => {
  const html = (await readFile('index.html', 'utf8')).replace(/<script\b[^>]*src="\/src\/main\.ts"[^>]*><\/script>/, '');
  server = await createServer({ server: { host: '127.0.0.1', port: 4184, strictPort: true, hmr: false }, logLevel: 'error' });
  server.middlewares.use('/__creator', (_request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html);
  });
  await server.listen();
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://127.0.0.1:4184/__creator?test&graphics=compatible');
  await page.evaluate(async () => {
    const character = await import('/src/character/character.ts'); await character.loadKits();
    window.creatorTest = {
      ...character, THREE: await import('/node_modules/three/build/three.module.js'),
      data: await import('/src/data/data.ts'), head: await import('/src/character/head.ts'),
      npcs: await import('/src/data/npcs.ts'),
    };
  });
}, { timeout: 90000 });
after(async () => { await browser?.close(); await server?.close(); });

test('surface anchors still hit the final skull and hair after conversion to head bone coordinates', async () => {
  const failures = await page.evaluate(async () => {
    const { THREE, characterKit, head: { buildHead, FACE_KITS } } = window.creatorTest;
    const { loadGLB } = await import('/src/world/load.ts');
    const model = await loadGLB('/src/assets/models/creator-parts.glb'), parts = Object.fromEntries(['ranger-hair', 'rogue-fringe', 'rogue-mask'].map(name => [name, model.scene.getObjectByName(name).geometry]));
    const sources = Object.fromEntries(FACE_KITS.map(kit => {
      const mesh = characterKit(kit).scene.getObjectByName(`${kit}_Head`);
      const index = mesh.skeleton.bones.findIndex(bone => bone.name === 'head');
      return [kit, { kit, geometry: mesh.geometry, toBone: new THREE.Matrix4().multiplyMatrices(mesh.skeleton.boneInverses[index], mesh.bindMatrix) }];
    }));
    const failures = [], material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
    for (const face of FACE_KITS) for (const hair of [0, 5, 14, 17, 21]) {
      const head = buildHead(sources, { face, hair, beard: 0, eyeShape: 0, brows: 0, nose: 0,
        mouth: 0, detail: 0, eyeColor: '#45a6a0', flattenEars: false, hat: 'none', race: 'humano' }, () => material, () => material, parts);
      const surfaces = [], fromBone = head.toBone.clone().invert();
      head.group.traverse(node => {
        if (node.isMesh && ['character-skull', 'character-hair'].includes(node.name)) {
          const proxy = new THREE.Mesh(node.geometry.clone().applyMatrix4(fromBone), material); proxy.updateMatrixWorld(true); surfaces.push(proxy);
        }
      });
      for (const direction of [[1, .4, -.2], [-1, .4, -.2], [0, 1, 0], [0, .1, -1]]) {
        const n = new THREE.Vector3(...direction).normalize(), center = new THREE.Vector3(0, 1.62, -.02);
        const hit = new THREE.Raycaster(center.addScaledVector(n, 2), n.clone().negate()).intersectObjects(surfaces)[0];
        const anchor = head.anchors.surf(n, 0);
        if (!hit || hit.point.distanceTo(anchor.p) > .0001) failures.push(`${face}/${hair}: misplaced anchor ${direction}`);
      }
      surfaces.forEach(node => node.geometry.dispose());
      head.group.traverse(node => { if (node.isMesh) node.geometry.dispose(); });
      head.ownedMaterials.forEach(value => { if (value !== material) value.dispose(); });
    }
    material.dispose(); return failures;
  });
  assert.deepEqual(failures, []);
});

test('expanded appearances fit all skulls and lineages and neck accessories follow the chest during animation', { timeout: 180000 }, async () => {
  const failures = await page.evaluate(() => {
    const { Character, THREE, data: { defaultChar, sanitize, RACES, HAIR_ACC_VALUES }, npcs } = window.creatorTest;
    const failures = [], check = (ok, message) => { if (!ok) failures.push(message); };
    for (const race of Object.keys(RACES)) for (let face = 0; face < 4; face++) for (let variant = 0; variant < 11; variant++) {
      const selected = { ...defaultChar(), race, face, hair: 11 + variant, beard: 6 + variant % 3,
        eyeShape: 9 + variant % 4, brows: 6 + variant % 3, nose: 6 + variant % 3,
        mouth: 6 + variant % 3, detail: 6 + variant % 5, makeup: 7 + variant % 3,
        hairColor: 12 + variant % 6, eyeColor: 8 + variant % 4, hairAccColor: 9 + variant % 4,
        makeupColor: 9 + variant % 4, accColor: 9 + variant % 4,
        hairAcc: HAIR_ACC_VALUES[variant % HAIR_ACC_VALUES.length], acc: variant,
        skin: variant % RACES[race].skins.length, trait: variant % Math.max(1, RACES[race].traits.length),
        height: variant % 2, build: 1 - variant % 2 };
      const data = sanitize(selected), actor = new Character(data, { outfit: false });
      const label = `${race}/${face}/${variant}`;
      try {
        const npc = npcs.newNpc('creator_fit'); npc.appearance = npcs.npcAppearance(data); npcs.validateNpc(npc);
        for (const key of ['hair', 'beard', 'eyeShape', 'brows', 'nose', 'mouth', 'detail', 'makeup', 'hairAcc', 'acc', 'trait', 'skin']) check(data[key] === selected[key], `${label}: lost ${key}`);
        actor.root.traverse(node => {
          if (node.isMesh) check(node.geometry.attributes.position.array.every(Number.isFinite), `${label}: nonfinite mesh`);
          if (node.name === 'character-neck-accessory') check(node.parent === actor.bones.get('chest'), `${label}: wrong neck bone`);
          if (node.name === 'character-hair') {
            const bounds = new THREE.Box3().setFromBufferAttribute(node.geometry.attributes.position);
            check(bounds.min.x > -.7 && bounds.max.x < .7 && bounds.min.z > -.7 && bounds.max.z < .7, `${label}: excessive hair volume`);
          }
        });
        let animationTime = 0; actor.update(animationTime);
        for (const name of ['Idle_B', 'Running_A', 'Hit_B']) {
          animationTime += .3;
          actor.play(name); actor.update(animationTime); actor.root.updateMatrixWorld(true);
          check(actor.bones.get('head').matrixWorld.elements.every(Number.isFinite), `${label}: animation`);
        }
      } finally { actor.dispose(); }
    }
    return failures;
  });
  assert.deepEqual(failures, []);
});

test('creator selectors include new choices, expose color selection, and preserve appearance when changing body', async () => {
  await page.evaluate(async () => {
    const { session } = await import('/src/game/state.ts');
    const { installCreator, refreshUI } = await import('/src/ui/creator.ts');
    session.state = window.creatorTest.data.defaultChar(); installCreator(); refreshUI();
    document.body.className = ''; document.getElementById('loading').remove(); document.getElementById('account-gate').remove();
  });
  await page.locator('[data-tab="cabello"]').click();
  const hair = page.locator('.stepper[data-key="hair"] select');
  assert.equal(await hair.locator('option').count(), 22);
  await hair.selectOption('21');
  await page.locator('.stepper[data-key="hairAcc"] select').selectOption('11');
  await page.locator('[data-tab="rostro"]').click();
  await page.locator('.stepper[data-key="eyeShape"] select').selectOption('12');
  await page.locator('.stepper[data-key="makeup"] select').selectOption('9');
  assert.equal(await page.locator('#makeupColorBox').isVisible(), true);
  await page.locator('#tabs [data-tab="raza"]').click();
  await page.locator('#sex button[data-v="1"]').click();
  for (const [key, value] of Object.entries({ hair: '21', hairAcc: '11', eyeShape: '12', makeup: '9' }))
    assert.equal(await page.locator(`.stepper[data-key="${key}"] select`).inputValue(), value);
});
