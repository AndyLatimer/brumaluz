// Focused source checks also work while unrelated game entry points are being edited.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';
import { chromium } from 'playwright';

let server, browser, page;
const port = Number(process.env.CREATOR_FIT_PORT ?? 4184);
before(async () => {
  const html = (await readFile('index.html', 'utf8')).replace(/<script\b[^>]*src="\/src\/main\.ts"[^>]*><\/script>/, '');
  server = await createServer({ server: { host: '127.0.0.1', port, strictPort: true, hmr: false }, logLevel: 'error' });
  server.middlewares.use('/__creator', (_request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html);
  });
  await server.listen();
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`http://127.0.0.1:${port}/__creator?test&graphics=compatible`, { waitUntil: 'domcontentloaded', timeout: 60000 });
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

test('hair surfaces have closed edges and outward winding, including the crest, crown and legacy backing', { timeout: 120000 }, async () => {
  const failures = await page.evaluate(async () => {
    const { THREE, head: { FACE_KITS } } = window.creatorTest;
    const { buildSkull } = await import('/src/character/head/skull.ts');
    const { buildHair } = await import('/src/character/head/hair.ts');
    const { sculptedHair } = await import('/src/character/head/sculptedHair.ts');
    const { hairLining } = await import('/src/character/head/hairLining.ts');
    const { cellOfUV } = await import('/src/character/head/geometry.ts');
    const material = new THREE.MeshBasicMaterial(), failures = [];
    const checkSurface = (geometry, label) => {
      const p = geometry.attributes.position, ix = geometry.index, edges = new Map(); let volume = 0;
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), origin = new THREE.Vector3(0, 1.66, -.01);
      const key = i => [p.getX(i), p.getY(i), p.getZ(i)].map(n => Math.round(n * 1e6)).join(',');
      for (let t = 0; t < (ix?.count ?? p.count); t += 3) {
        const ids = [0, 1, 2].map(j => ix ? ix.getX(t + j) : t + j);
        a.fromBufferAttribute(p, ids[0]).sub(origin); b.fromBufferAttribute(p, ids[1]).sub(origin); c.fromBufferAttribute(p, ids[2]).sub(origin);
        volume += a.dot(b.cross(c)) / 6;
        for (let j = 0; j < 3; j++) {
          const x = key(ids[j]), y = key(ids[(j + 1) % 3]); if (x === y) continue;
          const edge = x < y ? `${x}/${y}` : `${y}/${x}`, value = edges.get(edge) ?? { count: 0, winding: 0 };
          value.count++; value.winding += x < y ? 1 : -1; edges.set(edge, value);
        }
      }
      if ([...edges.values()].some(edge => edge.count !== 2 || edge.winding !== 0)) failures.push(`${label}: open edge or reversed face`);
      if (!(volume > 1e-9)) failures.push(`${label}: inward surface (${volume})`);
      if (!p.array.every(Number.isFinite) || !geometry.attributes.normal.array.every(Number.isFinite)) failures.push(`${label}: nonfinite surface`);
    };
    for (const face of FACE_KITS) {
      const o = { face, hair: 0, hat: 'none', race: 'humano', eyeShape: 0, brows: 0, nose: 0 };
      const skull = buildSkull({ o, A: { noseTip: new THREE.Vector3(0, 1.6, .4) }, material: () => material });
      const lining = hairLining(face, skull.headAt); checkSurface(lining, `${face}/legacy lining`); lining.dispose();
      const crest = buildHair({ o: { ...o, hair: 7 }, ...skull, sources: {}, parts: {} });
      crest.hairPieces.forEach(piece => { checkSurface(piece.geo, `${face}/crest`); piece.geo.dispose(); });
      for (let hair = 1; hair < 28; hair++) {
        const pieces = sculptedHair({ ...o, hair }, skull.headAt);
        pieces?.forEach((piece, i) => { checkSurface(piece.geo, `${face}/${hair}/${i}`); piece.geo.dispose(); });
      }
      for (const hair of [12, 13, 14, 15]) {
        const base = buildSkull({ o: { ...o, hair }, A: { noseTip: new THREE.Vector3(0, 1.6, .4) }, material: () => material });
        const uv = base.headMesh.geometry.attributes.uv;
        if (Array.from({ length: uv.count }, (_, i) => cellOfUV(uv.getX(i), uv.getY(i))).some(cell => cell !== 0)) failures.push(`${face}/${hair}: painted scalp`);
        base.headMesh.geometry.dispose(); base.headRay.material.dispose(); base.skinParts.forEach(g => g.dispose());
      }
      skull.headMesh.geometry.dispose(); skull.headRay.material.dispose(); skull.skinParts.forEach(g => g.dispose());
    }
    material.dispose(); return failures;
  });
  assert.deepEqual(failures, []);
});

test('braids stay above the finished hair around the crown and across the nape', { timeout: 120000 }, async () => {
  const failures = await page.evaluate(async () => {
    const { THREE, head: { FACE_KITS } } = window.creatorTest;
    const { buildSkull } = await import('/src/character/head/skull.ts');
    const { sculptedHair } = await import('/src/character/head/sculptedHair.ts');
    const failures = [], material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const center = new THREE.Vector3(0, 1.66, -.01), ray = new THREE.Raycaster();
    for (const face of FACE_KITS) for (const hair of [21, 26]) {
      const o = { face, hair, hat: 'none', race: 'humano', eyeShape: 0, brows: 0, nose: 0 };
      const skull = buildSkull({ o, A: { noseTip: new THREE.Vector3(0, 1.6, .4) }, material: () => material });
      const pieces = sculptedHair(o, skull.headAt), shell = new THREE.Mesh(pieces[0].geo, material); shell.updateMatrixWorld(true);
      for (const piece of pieces.slice(1)) {
        const p = piece.geo.attributes.position, rings = p.count / 12;
        for (let row = Math.ceil(rings * .15); row < rings * .85; row += 12) for (const side of [0, 6]) {
          const vertex = new THREE.Vector3().fromBufferAttribute(p, row * 12 + side), direction = vertex.clone().sub(center).normalize();
          ray.set(center.clone().addScaledVector(direction, 2), direction.clone().negate());
          const hit = ray.intersectObject(shell)[0];
          const gap = hit ? vertex.distanceTo(center) - hit.point.distanceTo(center) : -99;
          if (gap < -.008 || gap > .085) failures.push(`${face}/${hair}: braid disappears or floats (${gap.toFixed(4)})`);
        }
      }
      pieces.forEach(piece => piece.geo.dispose()); skull.headMesh.geometry.dispose(); skull.headRay.material.dispose(); skull.skinParts.forEach(g => g.dispose());
    }
    material.dispose(); return failures;
  });
  assert.deepEqual(failures, []);
});

test('geometry templates own their buffers, survive consumer disposal and evict within their memory budget', async () => {
  const result = await page.evaluate(async () => {
    const { GeometryTemplates } = await import('/src/character/head/geometryCache.ts');
    const { THREE } = window.creatorTest;
    const cache = new GeometryTemplates(100, 2), source = new THREE.BufferGeometry();
    source.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    source.setIndex([0, 1, 2]); // 42 bytes, including the index.
    cache.set('a', [source]); source.translate(5, 0, 0);
    const first = cache.get('a')[0], originalX = first.attributes.position.getX(0);
    first.translate(10, 0, 0); first.index.setX(0, 2); first.dispose(); source.dispose();
    const second = cache.get('a')[0];
    const independent = originalX === 0 && second.attributes.position.getX(0) === 0 && second.index.getX(0) === 0;
    cache.set('b', [second]); cache.get('a').forEach(g => g.dispose()); cache.set('c', [second]);
    const lru = !cache.get('b') && !!cache.get('a') && !!cache.get('c');
    const oversized = new THREE.BoxGeometry(); cache.set('huge', [oversized]);
    const bounded = !cache.get('huge') && !!cache.get('a');
    oversized.dispose(); second.dispose();
    return { independent, lru, bounded };
  });
  assert.deepEqual(result, { independent: true, lru: true, bounded: true });
});

test('cached face projections match fresh intersections for every skull and cannot be mutated by a consumer', async () => {
  const failures = await page.evaluate(async () => {
    const { THREE, head: { FACE_KITS } } = window.creatorTest;
    const { buildSkull } = await import('/src/character/head/skull.ts');
    const material = new THREE.MeshBasicMaterial(), failures = [];
    for (const face of FACE_KITS) {
      const skull = buildSkull({ o: { face, hair: 0, hat: 'none', race: 'humano', eyeShape: 0, brows: 0, nose: 0 },
        A: { noseTip: new THREE.Vector3(0, 1.6, .4) }, material: () => material });
      for (const [x, y] of [[.1731, 1.71], [-.2947, 1.49], [.031, 1.37]]) {
        const direction = new THREE.Vector3(0, 0, -1), origin = new THREE.Vector3(x, y, 2);
        const first = skull.rayHead(origin, direction), fresh = skull.rayHead(new THREE.Vector3(x, y, 3), direction);
        if (!first || !fresh) { failures.push(`${face}: missed surface`); continue; }
        first.point.set(99, 99, 99); first.normal.set(0, 0, 0);
        const next = skull.rayHead(origin, direction);
        if (next.point.distanceTo(fresh.point) > 1e-7 || next.normal.distanceTo(fresh.normal) > 1e-6) failures.push(`${face}: cached projection drifted`);
      }
      skull.headMesh.geometry.dispose(); skull.headRay.material.dispose(); skull.skinParts.forEach(geo => geo.dispose());
    }
    material.dispose(); return failures;
  });
  assert.deepEqual(failures, []);
});

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
    for (const face of FACE_KITS) for (const hair of [0, 5, 12, 14, 17, 21]) {
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
      if (hair === 12) for (const phi of [Math.PI - .12, Math.PI, Math.PI + .12]) for (const theta of [2.12, 2.22]) {
        const direction = new THREE.Vector3(Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi));
        const center = new THREE.Vector3(0, 1.66, -.01);
        const hit = new THREE.Raycaster(center.clone().addScaledVector(direction, 2), direction.clone().negate()).intersectObjects(surfaces)[0];
        const gap = hit ? hit.point.distanceTo(center) - head.skullSurface(direction).distanceTo(center) : -99;
        if (gap < .005) failures.push(`${face}: nape exposes scalp (${gap.toFixed(4)})`);
      }
      surfaces.forEach(node => node.geometry.dispose());
      head.group.traverse(node => { if (node.isMesh) node.geometry.dispose(); });
      head.ownedMaterials.forEach(value => { if (value !== material) value.dispose(); });
    }
    material.dispose(); return failures;
  });
  assert.deepEqual(failures, []);
});

test('expanded appearances fit all skulls and lineages and neck accessories follow the chest during animation', { timeout: 300000 }, async () => {
  const failures = await page.evaluate(async () => {
    const { Character, THREE, data: { defaultChar, sanitize, RACES, HAIR_ACC_VALUES }, npcs } = window.creatorTest;
    const { withAccessoryLayer, hasTravelerMask } = await import('/src/character/head/accessoryLayers.ts');
    const failures = [], check = (ok, message) => { if (!ok) failures.push(message); };
    for (const race of Object.keys(RACES)) for (let face = 0; face < 4; face++) for (let variant = 0; variant < 17; variant++) {
      let acc = variant;
      if (variant > 10) {
        acc = withAccessoryLayer(0, 'eyewear', [1, 5, 10, 11][variant % 4]);
        acc = withAccessoryLayer(acc, 'neckwear', [2, 3, 12][variant % 3]);
        acc = withAccessoryLayer(acc, 'earrings', [4, 8, 9, 13][variant % 4]);
        acc = withAccessoryLayer(acc, 'mask', variant % 2 ? 7 : 0);
      }
      const selected = { ...defaultChar(), race, face, hair: 11 + variant, beard: 6 + variant % 3,
        eyeShape: 9 + variant % 4, brows: 6 + variant % 3, nose: 6 + variant % 3,
        mouth: 6 + variant % 3, detail: 6 + variant % 5, makeup: 7 + variant % 3,
        hairColor: 12 + variant % 6, eyeColor: 8 + variant % 4, hairAccColor: 9 + variant % 4,
        makeupColor: 9 + variant % 4, accColor: 9 + variant % 4,
        hairAcc: HAIR_ACC_VALUES[variant % HAIR_ACC_VALUES.length], acc,
        skin: variant % RACES[race].skins.length, trait: variant % Math.max(1, RACES[race].traits.length),
        height: variant % 2, build: 1 - variant % 2 };
      const data = sanitize(selected), actor = new Character(data, { outfit: false });
      const label = `${race}/${face}/${variant}`;
      try {
        check(actor.root.getObjectByName('character-mouth-rig').visible === !hasTravelerMask(acc), `${label}: mask must hide mouth`);
        check(!!actor.root.getObjectByName('character-beard') === !hasTravelerMask(acc), `${label}: mask must hide beard`);
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
  assert.equal(await hair.locator('option').count(), 28);
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

test('short curls remain on the final hair shell across every skull and lineage', { timeout: 120000 }, async () => {
  const failures = await page.evaluate(() => {
    const { Character, THREE, data: { defaultChar, sanitize, RACES } } = window.creatorTest;
    const failures = [];
    for (const race of Object.keys(RACES)) for (let face = 0; face < 4; face++) {
      const actor = new Character(sanitize({ ...defaultChar(), race, face, hair: 25, height: face % 2, build: 1 - face % 2 }), { outfit: false });
      try {
        let hairs = 0;
        actor.root.traverse(node => {
          if (node.name !== 'character-hair') return;
          hairs++;
          const positions = node.geometry.attributes.position;
          if (!positions.array.every(Number.isFinite)) failures.push(`${race}/${face}: nonfinite curls`);
          const bounds = new THREE.Box3().setFromBufferAttribute(positions);
          if (bounds.min.x < -.7 || bounds.max.x > .7 || bounds.min.z < -.7 || bounds.max.z > .7) failures.push(`${race}/${face}: curl volume`);
        });
        if (!hairs) failures.push(`${race}/${face}: missing hair`);
        actor.play('Running_A'); actor.update(.3);
      } finally { actor.dispose(); }
    }
    return failures;
  });
  assert.deepEqual(failures, []);
});

test('sculpted shells are closed and skulls no longer carry the rectangular hair patch', { timeout: 120000 }, async () => {
  const failures = await page.evaluate(async () => {
    const { THREE } = window.creatorTest;
    const { sculptedHair } = await import('/src/character/head/sculptedHair.ts');
    const { cellOfUV } = await import('/src/character/head/geometry.ts');
    const failures = [];
    // Get the actual supported skull radius via the public head builder, not a copied shape formula.
    const { buildHead, FACE_KITS } = await import('/src/character/head.ts');
    const { loadGLB } = await import('/src/world/load.ts');
    const model = await loadGLB('/src/assets/models/creator-parts.glb');
    const parts = Object.fromEntries(['ranger-hair', 'rogue-fringe', 'rogue-mask'].map(name => [name, model.scene.getObjectByName(name).geometry]));
    const sources = Object.fromEntries(FACE_KITS.map(kit => {
      const mesh = window.creatorTest.characterKit(kit).scene.getObjectByName(`${kit}_Head`), index = mesh.skeleton.bones.findIndex(b => b.name === 'head');
      return [kit, { kit, geometry: mesh.geometry, toBone: new THREE.Matrix4().multiplyMatrices(mesh.skeleton.boneInverses[index], mesh.bindMatrix) }];
    }));
    const material = new THREE.MeshStandardMaterial();
    for (const face of FACE_KITS) {
      const options = { face, hair: 25, beard: 0, eyeShape: 0, brows: 0, nose: 0, mouth: 0, detail: 0, eyeColor: '#554433', flattenEars: false, hat: 'none', race: 'humano' };
      const head = buildHead(sources, options, () => material, () => material, parts);
      const uv = head.group.getObjectByName('character-skull').geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) if (cellOfUV(uv.getX(i), uv.getY(i)) === 1) { failures.push(`${face}: painted scalp patch`); break; }
      for (const hair of [5, 8, 11, 22, 23, 24, 25, 26, 27]) {
        const meshes = sculptedHair({ ...options, hair }, (direction, out = 0) => head.skullSurface(direction).addScaledVector(direction.clone().normalize(), out));
        const geo = meshes[0].geo, p = geo.attributes.position, idx = geo.index, edges = new Map();
        const key = i => [p.getX(i), p.getY(i), p.getZ(i)].map(n => Math.round(n * 100000)).join(',');
        for (let i = 0; i < idx.count; i += 3) for (let j = 0; j < 3; j++) {
          const a = key(idx.getX(i + j)), b = key(idx.getX(i + (j + 1) % 3)); if (a === b) continue;
          const edge = a < b ? `${a}/${b}` : `${b}/${a}`; edges.set(edge, (edges.get(edge) ?? 0) + 1);
        }
        if ([...edges.values()].some(count => count !== 2)) failures.push(`${face}/${hair}: open shell`);
        if (!p.array.every(Number.isFinite)) failures.push(`${face}/${hair}: nonfinite`);
        meshes.forEach(mesh => mesh.geo.dispose());
      }
      const center = new THREE.Vector3(0, 1.66, -.01);
      for (let brows = 0; brows < 9; brows++) {
        const faceHead = buildHead(sources, { ...options, hair: 0, brows, eyeShape: 1 }, () => material, () => material, parts);
        faceHead.group.traverse(node => {
          if (node.name !== 'character-eyebrow') return;
          const positions = node.geometry.attributes.position;
          for (let i = 0; i < positions.count; i++) {
            const point = new THREE.Vector3().fromBufferAttribute(positions, i), direction = point.clone().sub(center).normalize();
            const gap = point.distanceTo(center) - faceHead.skullSurface(direction).distanceTo(center);
            if (gap > .02 || gap < -.003) { failures.push(`${face}/${brows}: eyebrow floats or sinks (${gap.toFixed(4)})`); break; }
          }
        });
        faceHead.group.traverse(node => { if (node.isMesh) node.geometry.dispose(); }); faceHead.ownedMaterials.forEach(m => { if (m !== material) m.dispose(); });
      }
      head.group.traverse(node => { if (node.isMesh) node.geometry.dispose(); }); head.ownedMaterials.forEach(m => { if (m !== material) m.dispose(); });
    }
    material.dispose(); return failures;
  });
  assert.deepEqual(failures, []);
});
