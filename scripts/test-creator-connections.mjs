import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';
import { chromium } from 'playwright';

let server, browser, page;
const errors = [], port = Number(process.env.CREATOR_CONNECTIONS_PORT ?? 4221);
const diagnostic = process.env.CREATOR_CONNECTIONS_DIAGNOSTIC === '1';
before(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port, strictPort: true, hmr: false }, logLevel: 'error' });
  server.middlewares.use('/__connections-test', (_request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end('<!doctype html><html><body></body></html>');
  });
  await server.listen(); browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  page = await browser.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/__connections-test`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.evaluate(async diagnostic => {
    const character = await import('/src/character/character.ts'); await character.loadKits();
    const source = await (await fetch('/src/character/portrait.ts')).text(), threeUrl = /from "([^"]*\/three\.js[^"]*)"/.exec(source)?.[1];
    const THREE = await import(threeUrl), data = await import('/src/data/data.ts');
    const head = await import('/src/character/head.ts'), layers = await import('/src/character/head/accessoryLayers.ts');
    const fromBone = {};
    for (const face of head.FACE_KITS) {
      const kit = face === 'Barbarian' ? 'Mage' : face;
      const mesh = character.characterKit(kit).scene.getObjectByName(`${kit}_Head`), index = mesh.skeleton.bones.findIndex(bone => bone.name === 'head');
      fromBone[face] = new THREE.Matrix4().multiplyMatrices(mesh.skeleton.boneInverses[index], mesh.bindMatrix).invert();
    }
    const appearance = (parts = {}) => Object.entries(parts).reduce((id, [key, value]) => layers.withAccessoryLayer(id, key, value), 0);
    const update = (actor, time) => { actor.update(time); actor.root.updateMatrixWorld(true); actor.root.traverse(mesh => { if (mesh.isSkinnedMesh) mesh.skeleton.update(); }); };
    const toBind = (actor, face) => fromBone[head.FACE_KITS[face]].clone().multiply(actor.bones.get('head').matrixWorld.clone().invert());
    window.connections = { ...character, THREE, data, head, layers, appearance, update, toBind, diagnostic };
  }, diagnostic);
}, { timeout: 120000 });
after(async () => { await browser?.close(); await server?.close(); });

test('eyewear and face covering stay separated across every lineage, trait and skull', { timeout: 180000 }, async () => {
  const failures = await page.evaluate(() => {
    const { Character, THREE, data: { defaultChar, sanitize, RACES }, appearance, update, toBind } = window.connections;
    const failures = [], material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), ray = new THREE.Raycaster();
    for (const race of Object.keys(RACES)) for (let trait = 0; trait < Math.max(1, RACES[race].traits.length); trait++) for (let face = 0; face < 4; face++) {
      const actor = new Character(sanitize({ ...defaultChar(), race, trait, face, hair: [0, 8, 12, 27][face], eyeShape: [1, 7, 10, 12][face], nose: 1,
        height: face % 2, build: 1 - face % 2, acc: appearance({ eyewear: [1, 10, 11, 5][face], mask: 7 }) }), { outfit: false });
      const label = `${race}/${trait}/${face}`;
      try {
        update(actor, 0); const fromWorld = toBind(actor, face);
        const skull = actor.root.getObjectByName('character-skull'), mask = actor.root.getObjectByName('traveler-mask');
        if (!mask) { failures.push(`${label}: missing saved face covering`); continue; }
        const proxy = new THREE.Mesh(mask.geometry.clone().applyMatrix4(fromWorld.clone().multiply(mask.matrixWorld)), material); proxy.updateMatrixWorld(true);
        const lenses = []; actor.root.traverse(node => { if (node.name === 'character-glasses-lens') lenses.push(node); });
        if (lenses.length !== (face === 3 ? 1 : 2)) failures.push(`${label}: missing eyewear`);
        for (const lens of lenses) {
          const center = lens.getWorldPosition(new THREE.Vector3()).applyMatrix4(fromWorld);
          ray.set(new THREE.Vector3(center.x, center.y, 3), new THREE.Vector3(0, 0, -1));
          const eyeHit = ray.intersectObject(proxy)[0];
          if (eyeHit && eyeHit.point.z >= center.z - .018) failures.push(`${label}: cloth covers optical centre`);
          const frame = lens.children.find(child => child.isMesh && child.geometry.type === 'TubeGeometry');
          if (!frame) { failures.push(`${label}: missing frame`); continue; }
          const p = frame.geometry.attributes.position;
          for (let i = 0; i < p.count; i += Math.max(1, Math.floor(p.count / 18))) {
            const v = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(frame.matrixWorld).applyMatrix4(fromWorld);
            ray.set(new THREE.Vector3(v.x, v.y, 3), new THREE.Vector3(0, 0, -1)); const hit = ray.intersectObject(proxy)[0];
            if (hit && v.z - hit.point.z < .003) { failures.push(`${label}: frame crosses cloth`); break; }
          }
        }
        if (actor.mouth.rest.parent.visible) failures.push(`${label}: face covering lost mouth occlusion`);
        proxy.geometry.dispose();
      } finally { actor.dispose(); }
    }
    material.dispose(); return failures;
  });
  assert.deepEqual(failures, []); assert.deepEqual(errors, []);
});

test('jewellery uses the actual ear landmarks and Pelso jewellery follows ear movement', { timeout: 180000 }, async () => {
  const failures = await page.evaluate(async () => {
    const { Character, THREE, data: { defaultChar, sanitize, RACES }, head: { FACE_KITS }, appearance, update, toBind } = window.connections;
    const { createHeadAnatomy } = await import('/src/character/head/anatomy.ts');
    const { buildSkull } = await import('/src/character/head/skull.ts');
    const failures = [], material = new THREE.MeshBasicMaterial();
    for (const race of Object.keys(RACES)) for (let trait = 0; trait < Math.max(1, RACES[race].traits.length); trait++) for (const face of [0, 3]) {
      const data = sanitize({ ...defaultChar(), race, trait, face, hair: face ? 8 : 0, acc: appearance({ earrings: 13 }) });
      const actor = new Character(data, { outfit: false }), label = `${race}/${trait}/${face}`;
      const o = { face: FACE_KITS[face], race, trait, hair: data.hair, hat: 'none', eyeShape: data.eyeShape, brows: data.brows, nose: data.nose };
      const skull = buildSkull({ o, A: { noseTip: new THREE.Vector3(0, 1.6, .4) }, material: () => material }), anatomy = createHeadAnatomy(o, skull.headAt);
      try {
        update(actor, 0); const earrings = [];
        actor.root.traverse(node => { if (node.name === 'character-earring') earrings.push(node); });
        if (earrings.length !== 2) failures.push(`${label}: lost earrings`);
        for (const earring of earrings) {
          const side = earring.userData.earSide;
          if (side !== -1 && side !== 1) { failures.push(`${label}: missing earring side`); continue; }
          const actual = earring.getWorldPosition(new THREE.Vector3()).applyMatrix4(toBind(actor, face)), expected = anatomy.ear(side).lobe;
          if (actual.distanceTo(expected) > .035) failures.push(`${label}/${side}: floating earring`);
          if (race === 'pelso') {
            const ear = earring.parent;
            if (ear.name !== 'character-ear') failures.push(`${label}/${side}: jewellery ignores animated ear`);
            const initial = ear.matrixWorld.clone().invert().multiply(earring.matrixWorld);
            update(actor, Math.PI / 1.4); const moved = ear.matrixWorld.clone().invert().multiply(earring.matrixWorld);
            if (initial.elements.some((value, i) => Math.abs(value - moved.elements[i]) > 1e-6)) failures.push(`${label}/${side}: earring slides during ear movement`);
            update(actor, 0);
          }
        }
      } finally { actor.dispose(); skull.headMesh.geometry.dispose(); skull.headRay.material.dispose(); skull.skinParts.forEach(g => g.dispose()); }
    }
    material.dispose(); return failures;
  });
  assert.deepEqual(failures, []); assert.deepEqual(errors, []);
});

test('covered anatomy stays behind closed headwear and returns with the original saved choices', { timeout: 120000 }, async () => {
  const failures = await page.evaluate(() => {
    const { Character, data: { defaultChar, sanitize }, appearance, update } = window.connections;
    const failures = [];
    for (const race of ['humano', 'elfo', 'pelso', 'lagto']) for (const cls of ['guerrero', 'explorador']) {
      const data = sanitize({ ...defaultChar(), race, cls, trait: race === 'lagto' ? 2 : 0, hair: 8, acc: appearance({ earrings: 8 }) });
      const actor = new Character(data, { outfit: true });
      try {
        update(actor, 0); const visible = [];
        actor.root.traverse(node => {
          if (!['character-ear', 'character-earring', 'character-lineage-fin', 'character-lineage-horn', 'character-lineage-crest'].includes(node.name)) return;
          let displayed = true; for (let p = node; p; p = p.parent) displayed &&= p.visible;
          if (displayed) visible.push(node.name);
        });
        if (visible.length) failures.push(`${race}/${cls}: covered feature escapes ${visible.join(',')}`);
        if (actor.d.trait !== data.trait || actor.d.acc !== data.acc || actor.d.hair !== 8) failures.push(`${race}/${cls}: saved choice deleted`);
      } finally { actor.dispose(); }
      const uncovered = new Character(data, { outfit: false });
      try { update(uncovered, 0); if (uncovered.root.getObjectsByProperty('name', 'character-earring').length !== 2) failures.push(`${race}/${cls}: earrings did not return`); }
      finally { uncovered.dispose(); }
    }
    const coveredPelso = new Character(sanitize({ ...defaultChar(), race: 'pelso', cls: 'mago', trait: 3, acc: appearance({ earrings: 4 }) }), { outfit: true });
    try {
      update(coveredPelso, 0);
      for (const name of ['character-ear', 'character-earring']) if (coveredPelso.root.getObjectsByProperty('name', name).some(node => {
        let displayed = true; for (let p = node; p; p = p.parent) displayed &&= p.visible; return displayed;
      })) failures.push(`pelso/mago: crown anatomy escapes ${name}`);
    } finally { coveredPelso.dispose(); }
    return failures;
  });
  assert.deepEqual(failures, []); assert.deepEqual(errors, []);
});

test('neckwear follows cloth weights and remains finite through body extremes and animations', { timeout: 180000 }, async () => {
  const failures = await page.evaluate(() => {
    const { Character, THREE, data: { defaultChar, sanitize }, appearance, update, diagnostic } = window.connections;
    const failures = [];
    for (const race of diagnostic ? ['humano'] : ['humano', 'elfo', 'pelso', 'lagto']) for (const shape of [0, 1]) for (const neckwear of [2, 3, 12]) {
      const actor = new Character(sanitize({ ...defaultChar(), race, face: shape ? 3 : 0, hair: 8, height: shape, build: 1 - shape, acc: appearance({ neckwear }) }), { outfit: false });
      const label = `${race}/${shape}/${neckwear}`;
      try {
        update(actor, 0); const neck = actor.root.getObjectsByProperty('name', 'character-neck-accessory').filter(node => node.isMesh);
        const garment = actor.model.getObjectByName('medieval-tunic'), ray = new THREE.Raycaster();
        if (!neck.length) failures.push(`${label}: lost neckwear`);
        for (const mesh of neck) {
          if (!mesh.isSkinnedMesh || mesh.parent !== actor.bones.get('chest')) { failures.push(`${label}: rigid or detached neckwear`); continue; }
          const weights = mesh.geometry.attributes.skinWeight;
          if (!weights) { failures.push(`${label}: missing weights`); continue; }
          for (let i = 0; i < weights.count; i++) {
            const sum = weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i);
            if (!Number.isFinite(sum) || Math.abs(sum - 1) > 1e-5) { failures.push(`${label}: invalid cloth weights`); break; }
          }
        }
        let time = 0;
        for (const animation of ['Idle_B', 'Running_A', 'Hit_B']) {
          actor.play(animation); update(actor, time += .4);
          // A world-Z ray confuses the back with the front when the torso leans.
          // Measure signed distance to the closest actual animated cloth triangle instead.
          const triangles = [], triangle = new THREE.Triangle(), closest = new THREE.Vector3(), normal = new THREE.Vector3();
          garment?.traverse(surface => {
            if (!surface.isMesh) return;
            const positions = surface.geometry.attributes.position, index = surface.geometry.index;
            const points = Array.from({ length: positions.count }, (_, i) => surface.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(surface.matrixWorld));
            for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
              const a = points[index ? index.getX(i) : i], b = points[index ? index.getX(i + 1) : i + 1], c = points[index ? index.getX(i + 2) : i + 2];
              triangles.push({ a, b, c, box: new THREE.Box3().setFromPoints([a, b, c]) });
            }
          });
          for (const mesh of neck) {
            const positions = mesh.geometry.attributes.position;
            for (let i = 0; i < positions.count; i += Math.max(1, Math.floor(positions.count / 12))) {
              const point = mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
              if (![point.x, point.y, point.z].every(Number.isFinite)) failures.push(label + '/' + animation + ': invalid animated neckwear');
              let distance = Infinity, signed = Infinity;
              for (const face of triangles) {
                if (face.box.distanceToPoint(point) > .12 * actor.model.scale.y) continue;
                triangle.set(face.a, face.b, face.c); triangle.closestPointToPoint(point, closest);
                const d = point.distanceTo(closest); if (d >= distance) continue;
                distance = d; triangle.getNormal(normal); signed = point.clone().sub(closest).dot(normal) < 0 ? -d : d;
              }
              const gap = signed / actor.model.scale.y;
              if (gap < -.008 || gap > .09) {
                failures.push(label + '/' + animation + ': neckwear pierces or floats above cloth (' + gap.toFixed(4) + ')'); break;
              }
            }
          }
        }
      } finally { actor.dispose(); }
    }
    return failures;
  });
  assert.deepEqual(failures, []); assert.deepEqual(errors, []);
});
