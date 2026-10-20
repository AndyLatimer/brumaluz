import assert from 'node:assert/strict';
import { NodeIO } from '@gltf-transform/core';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { chromium } from 'playwright';

const asset = name => fileURLToPath(new URL(`../src/assets/${name}`, import.meta.url));
test('creator bundle preserves authored triangles and contains no extra bodies, rigs, animations or textures', async () => {
  const io = new NodeIO();
  const root = (await io.read(asset('models/creator-parts.glb'))).getRoot();
  assert.deepEqual(root.listNodes().map(node => node.getName()), ['ranger-hair', 'rogue-fringe', 'rogue-mask']);
  assert.equal(root.listSkins().length, 0);
  assert.equal(root.listAnimations().length, 0);
  assert.equal(root.listTextures().length, 0);
  assert.ok((await stat(asset('models/creator-parts.glb'))).size < 170_000);
  const counts = { 'ranger-hair': 1022, 'rogue-fringe': 320, 'rogue-mask': 304 };
  for (const node of root.listNodes()) {
    const { source, sourceNode } = node.getExtras();
    const reference = (await io.read(asset(`library/${source}`))).getRoot().listNodes()
      .find(value => value.getName() === sourceNode).getMesh().listPrimitives()[0];
    const primitive = node.getMesh().listPrimitives()[0];
    const expanded = (p, semantic) => {
      const indices = p.getIndices(), attribute = p.getAttribute(semantic);
      return Array.from({ length: indices?.getCount() ?? attribute.getCount() },
        (_, index) => attribute.getElement(indices ? indices.getScalar(index) : index, []));
    };
    const expected = { POSITION: [], NORMAL: [], TEXCOORD_0: [] };
    const sourceAttributes = Object.fromEntries(Object.keys(expected).map(key => [key, expanded(reference, key)]));
    for (let triangle = 0; triangle < sourceAttributes.POSITION.length; triangle += 3) {
      const cells = sourceAttributes.TEXCOORD_0.slice(triangle, triangle + 3).map(([u, v]) =>
        Math.min(7, Math.max(0, Math.floor(v * 8))) * 8 + Math.min(7, Math.max(0, Math.floor(u * 8))));
      const cell = cells[0] === cells[1] || cells[0] === cells[2] ? cells[0] : cells[1];
      if (node.getName() !== 'rogue-mask' && cell !== 1 && cell !== 9) continue;
      for (const semantic of Object.keys(expected)) expected[semantic].push(...sourceAttributes[semantic].slice(triangle, triangle + 3));
    }
    assert.equal(expected.POSITION.length / 3, counts[node.getName()]);
    for (const semantic of Object.keys(expected)) assert.deepEqual(expanded(primitive, semantic), expected[semantic], `${node.getName()}:${semantic}`);
    assert.deepEqual(primitive.listSemantics().sort(), ['NORMAL', 'POSITION', 'TEXCOORD_0']);
  }
});

const url = 'http://127.0.0.1:4180';
let server, browser;
before(async () => {
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4180', '--strictPort']);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Preview did not start')), 15000);
    server.once('error', reject);
    server.once('exit', code => reject(new Error(`Preview exited: ${code}`)));
    server.stdout.on('data', data => {
      if (stripVTControlCharacters(data.toString()).includes(url)) { clearTimeout(timer); resolve(); }
    });
    server.stderr.on('data', data => process.stderr.write(data));
  });
  assert.equal((await fetch(url)).status, 200);
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
});
after(async () => {
  await browser?.close();
  if (server && server.exitCode === null) {
    const stopped = once(server, 'exit');
    server.kill();
    await stopped;
  }
});

test('creator options, colors, head attachments and animations work across all races and faces', { timeout: 180000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && message.location().url !== `${url}/favicon.ico`
      || message.type() === 'warning' && /PropertyBinding|No target node/.test(message.text())) errors.push(message.text());
  });
  try {
    await page.addInitScript(() => {
      localStorage.setItem('brumaluz-ambient', 'off');
      localStorage.setItem('brumaluz-menu-music', 'off');
      localStorage.setItem('brumaluz-language', 'es');
    });
    await page.goto(`${url}/?test&graphics=compatible`);
    await page.waitForFunction(() => !!window.brumaluz, null, { timeout: 90000 });
    const failures = await page.evaluate(() => {
      const failures = [], check = (condition, message) => { if (!condition) failures.push(message); };
      const base = window.brumaluz.char(), Character = base.constructor;
      for (const race of ['humano', 'elfo', 'pelso', 'lagto']) for (const face of [0, 1, 2, 3]) for (const hair of [12, 13, 14, 15]) {
        const actor = new Character({ ...base.d, race, skin: 0, face, hair, hairColor: 8, acc: 7, accColor: 4, beard: 2,
          hairAcc: [0, 4, 7, 8][face], height: face % 2, build: face % 2 }, { outfit: false });
        try {
          actor.update(0);
          const label = `${race}/${face}/${hair}`;
          const mask = actor.root.getObjectByName('traveler-mask');
          check(!!mask && mask.parent.parent === actor.bones.get('head'), `${label}: rigid mask`);
          check(!actor.mouth.rest.parent.visible, `${label}: mask hides lips and talking mouth`);
          const hairs = [];
          actor.root.traverse(mesh => {
            if (mesh.name === 'character-hair') hairs.push(mesh);
            if (!mesh.isMesh) return;
            for (const value of mesh.geometry.attributes.position.array) check(Number.isFinite(value), `${label}: finite vertex`);
          });
          check(hairs.length > 0, `${label}: authored hair exists`);
          for (const mesh of hairs) {
            const positions = mesh.geometry.attributes.position;
            check(positions.count > 300, `${label}: detailed strands`);
            mesh.geometry.computeBoundingBox();
            const bounds = mesh.geometry.boundingBox;
            check(bounds.min.x > -.7 && bounds.max.x < .7 && bounds.min.z > -.7 && bounds.max.z < .7
              && bounds.min.y > -.25 && bounds.max.y < 1.15, `${label}: hair stays within head bounds`);
            let maxEdge = 0;
            for (let i = 0; i < positions.count; i += 3) for (let k = 0; k < 3; k++) {
              const a = i + k, b = i + (k + 1) % 3;
              maxEdge = Math.max(maxEdge, Math.hypot(positions.getX(a) - positions.getX(b),
                positions.getY(a) - positions.getY(b), positions.getZ(a) - positions.getZ(b)));
            }
            check(maxEdge < .35, `${label}: no stretched triangles from interleaved source attributes`);
            const originalY = 1.2414254546165466;
            for (let t = 0; t < positions.count; t += 3) {
              const x = (positions.getX(t) + positions.getX(t + 1) + positions.getX(t + 2)) / 3;
              const y = (positions.getY(t) + positions.getY(t + 1) + positions.getY(t + 2)) / 3 + originalY;
              const z = (positions.getZ(t) + positions.getZ(t + 1) + positions.getZ(t + 2)) / 3;
              check(!(z > .3 && y < 1.55 && Math.abs(x) < .3), `${label}: imported facial hair stays separate from hairstyle`);
            }
            const image = mesh.material.map.image;
            const pixel = image.getContext('2d').getImageData(Math.floor(image.width * 1.5 / 8), 8, 1, 1).data;
            check(Math.abs(pixel[0] - 0x5a) < 4 && Math.abs(pixel[1] - 0x86) < 4 && Math.abs(pixel[2] - 0xc8) < 4,
              `${label}: shared palette recolors imported hair`);
          }
          check(mask.material.color.getHexString() === '4a7ad8', `${label}: accessory color`);
          for (const animation of ['Idle_B', 'Hit_B', 'PickUp', 'Running_A']) {
            actor.play(animation);
            actor.update(.3);
            actor.root.updateMatrixWorld(true);
            check(mask.matrixWorld.elements.every(Number.isFinite), `${label}: ${animation} attachment`);
          }
        } finally { actor.dispose(); }
      }
      for (const cls of ['guerrero', 'mago', 'picaro', 'explorador', 'clerigo']) {
        const actor = new Character({ ...base.d, cls, hair: 14, acc: 7 }, { outfit: true });
        try {
          check(cls === 'guerrero' ? !actor.root.getObjectByName('character-hair') : !!actor.root.getObjectByName('character-hair'), `${cls}: hat fitting`);
        } finally { actor.dispose(); }
      }
      const helper = new Character({ ...base.d, hair: 15, acc: 7 }, { outfit: false, wardrobe: 'helpers' });
      check(!!helper.root.getObjectByName('character-hair'), 'Helper cap fitting');
      helper.dispose();
      for (let hair = 0; hair < 16; hair++) {
        window.brumaluz.set({ hair });
        check(window.brumaluz.char().d.hair === hair, `Saved hair ID ${hair} is preserved by sanitization`);
      }
      return failures;
    });
    assert.deepEqual(failures, []);
    await page.evaluate(() => { window.brumaluz.tab('cabello'); window.brumaluz.set({ hair: 13, acc: 7, beard: 2, race: 'humano', face: 1 }); });
    const hair = page.locator('.stepper[data-key="hair"]');
    assert.match(await hair.innerText(), /Corto pegado.*14 \/ 16/s);
    await hair.locator('button').last().click();
    assert.match(await hair.innerText(), /Melena de explorador.*15 \/ 16/s);
    await hair.locator('button').last().click();
    assert.match(await hair.innerText(), /Flequillo de viajero.*16 \/ 16/s);
    await page.waitForFunction(() => window.brumaluz.char().d.hair === 15);
    await hair.locator('button').last().click();
    assert.match(await hair.innerText(), /Rapado.*1 \/ 16/s);
    const maskChoice = page.locator('.stepper[data-key="acc"]');
    assert.match(await maskChoice.innerText(), /Pañuelo de viajero.*8 \/ 8/s);
    await page.evaluate(() => window.brumaluz.set({ acc: 0 }));
    assert.equal(await page.evaluate(() => {
      const actor = window.brumaluz.char();
      return actor.d.beard === 2 && !actor.root.getObjectByName('traveler-mask') && actor.mouth.rest.parent.visible;
    }), true, 'Removing mask restores saved beard and mouth');
    if (process.env.CREATOR_SCREENSHOT_DIR) {
      for (const [race, hair, angle] of [['humano', 12, 0], ['humano', 13, 0], ['humano', 14, 0], ['humano', 15, 0],
        ['humano', 15, 1.57], ['humano', 15, 3.14], ['pelso', 14, 0], ['lagto', 15, 0]]) {
        await page.evaluate(({ race, hair, angle }) => {
          window.brumaluz.set({ race, skin: 0, face: 1, hair, hairColor: 2, beard: 0, acc: race === 'humano' ? 0 : 7, hairAcc: 0, makeup: 0 });
          window.brumaluz.spin(angle);
        }, { race, hair, angle });
        await page.waitForTimeout(250);
        await page.screenshot({ path: join(process.env.CREATOR_SCREENSHOT_DIR, `creator-${race}-${hair}-${angle}.png`) });
      }
    }
    const frame = await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => {
      const gl = document.getElementById('scene').getContext('webgl2'), pixels = new Uint8Array(64 * 64 * 4);
      gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      resolve({ error: gl.getError(), lost: gl.isContextLost(), colors: new Set(Array.from({ length: 4096 }, (_, i) => pixels.slice(i * 4, i * 4 + 3).toString())).size });
    })));
    assert.equal(frame.error, 0); assert.equal(frame.lost, false); assert.ok(frame.colors > 20);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
