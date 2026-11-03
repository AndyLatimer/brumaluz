import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';
import { chromium } from 'playwright';

let server, browser, page;
before(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 4228, strictPort: true, hmr: false }, optimizeDeps: { noDiscovery: true }, logLevel: 'error' });
  server.middlewares.use('/__craft-test', (_request, response) => { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><title>Creator craft</title>'); });
  await server.listen();
  browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  page = await browser.newPage(); await page.goto('http://127.0.0.1:4228/__craft-test');
  await page.evaluate(async () => {
    const source = await (await fetch('/src/character/head/geometry.ts')).text(), url = /from "([^"]*\/three\.js[^"]*)"/.exec(source)?.[1];
    window.craft = { THREE: await import(url), ...(await import('/src/character/head/skull.ts')), ...(await import('/src/character/head/sculptedBeard.ts')),
      ...(await import('/src/character/head/faceDetails.ts')), ...(await import('/src/character/head/options.ts')) };
  });
}, { timeout: 90000 });
after(async () => { await browser?.close(); await server?.close(); });

test('facial hair is closed, faces outwards, and embeds its upper roots on every jaw', { timeout: 120000 }, async () => {
  const failures = await page.evaluate(() => {
    const { THREE, FACE_KITS, buildSkull, sculptedBeard } = window.craft, failures = [];
    const center = new THREE.Vector3(0, 1.66, -.01), material = new THREE.MeshStandardMaterial();
    for (const face of FACE_KITS) {
      const skull = buildSkull({ o: { face, hat: 'none', hair: 0, race: 'humano', eyeShape: 0, brows: 0, nose: 0 }, A: { noseTip: new THREE.Vector3(0, 1.55, .4) }, material: () => material });
      for (const beard of [1, 2, 3, 4, 5, 6, 8]) {
        const pieces = sculptedBeard({ face, beard }, 1.445, skull.headR, skull.rayHead);
        for (const geometry of pieces) {
          const p = geometry.attributes.position, ix = geometry.index, edges = new Map(); let volume = 0;
          const point = i => new THREE.Vector3().fromBufferAttribute(p, i), key = i => point(i).toArray().map(n => Math.round(n * 1e6)).join(',');
          for (let i = 0; i < ix.count; i += 3) {
            const ids = [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)];
            volume += point(ids[0]).sub(center).dot(point(ids[1]).sub(center).cross(point(ids[2]).sub(center))) / 6;
            for (let j = 0; j < 3; j++) {
              const a = key(ids[j]), b = key(ids[(j + 1) % 3]); if (a === b) continue;
              const k = a < b ? `${a}/${b}` : `${b}/${a}`, edge = edges.get(k) ?? { count: 0, winding: 0 };
              edge.count++; edge.winding += a < b ? 1 : -1; edges.set(k, edge);
            }
          }
          if ([...edges.values()].some(edge => edge.count !== 2 || edge.winding !== 0) || volume <= 0) failures.push(`${face}/${beard}: open or inward solid`);
          for (let i = 0; i < p.count; i += 7) {
            const d = point(i).sub(center), length = d.length(); d.normalize();
            const gap = length - skull.headR(d);
            if (gap < -.002 || gap > .13) { failures.push(`${face}/${beard}: sunk or floating (${gap})`); break; }
          }
          if (!p.array.every(Number.isFinite) || !geometry.attributes.normal.array.every(Number.isFinite)) failures.push(`${face}/${beard}: invalid normal`);
          geometry.dispose();
        }
        // Templates must survive a consumer changing and disposing its buffers.
        const fresh = sculptedBeard({ face, beard }, 1.445, skull.headR, skull.rayHead);
        if (!fresh.length || !fresh[0].attributes.position.array.every(Number.isFinite)) failures.push(`${face}/${beard}: invalid cached template`);
        fresh.forEach(g => g.dispose());
      }
      skull.headMesh.geometry.dispose(); skull.headRay.material.dispose(); skull.skinParts.forEach(g => g.dispose());
    }
    material.dispose(); return failures;
  });
  assert.deepEqual(failures, []);
});

test('fine markings stay on curved skin with outward triangles across all faces and lineages', { timeout: 90000 }, async () => {
  const failures = await page.evaluate(() => {
    const { THREE, FACE_KITS, buildSkull, buildFaceDetails } = window.craft, material = new THREE.MeshStandardMaterial(), failures = [];
    const origin = new THREE.Vector3(0, 1.66, -.01);
    for (const face of FACE_KITS) for (const race of ['humano', 'elfo', 'lagto', 'pelso']) {
      const o = { face, race, hat: 'none', hair: 0, eyeShape: 0, brows: 0, nose: 0, detail: 0 }, nose = new THREE.Vector3(0, 1.55, .4);
      const skull = buildSkull({ o, A: { noseTip: nose }, material: () => material });
      for (const detail of [2, 3, 5, 6, 7, 8, 9, 10, 179]) {
        const decals = [];
        const result = buildFaceDetails({ o: { ...o, detail }, extraMat: () => material, facing: () => new THREE.Euler(), onFace: () => new THREE.Vector3(), conform: () => {}, decals, rayHead: skull.rayHead, nose, mouthY: 1.445, eyeX: .19, eyeY: 1.69 });
        const ink = decals.filter(node => node.name === 'character-face-mark');
        if (!ink.length) failures.push(`${face}/${race}/${detail}: missing ink`);
        for (const node of ink) {
          const p = node.geometry.attributes.position, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
          for (let i = 0; i < p.count; i += 3) {
            a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
            const normal = b.clone().sub(a).cross(c.clone().sub(a));
            if (normal.lengthSq() > 1e-16 && normal.dot(a.clone().sub(origin)) < 0) { failures.push(`${face}/${race}/${detail}: invisible stroke`); break; }
            const dir = a.clone().sub(origin).normalize(), gap = a.distanceTo(origin) - skull.headR(dir);
            if (gap < .0015 || gap > .014) { failures.push(`${face}/${race}/${detail}: ink gap ${gap}`); break; }
          }
        }
        decals.forEach(node => node.traverse(mesh => { if (mesh.isMesh) mesh.geometry.dispose(); })); result.blushMat.dispose();
      }
      skull.headMesh.geometry.dispose(); skull.headRay.material.dispose(); skull.skinParts.forEach(g => g.dispose());
    }
    material.dispose(); return failures;
  });
  assert.deepEqual(failures, []);
});
