import assert from 'node:assert/strict';
import { NodeIO } from '@gltf-transform/core';
import { readFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { stripVTControlCharacters } from 'node:util';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const asset = name => fileURLToPath(new URL(`../src/assets/${name}`, import.meta.url));
test('ambient bundle preserves compatible source tracks without character meshes or textures', async () => {
  const io = new NodeIO();
  const source = (await io.read(asset('library/adventurers/animations/Rig_Medium_General.glb'))).getRoot();
  const reference = (await io.read(asset('models/Mage.glb'))).getRoot();
  const ambient = (await io.read(asset('models/ambient-animations.glb'))).getRoot();
  assert.deepEqual(ambient.listAnimations().map(clip => clip.getName()), ['Hit_B', 'Idle_B']);
  assert.equal(ambient.listMeshes().length, 0);
  assert.equal(ambient.listTextures().length, 0);
  assert.ok((await stat(asset('models/ambient-animations.glb'))).size < 320_000);
  for (const clip of ambient.listAnimations()) {
    const original = source.listAnimations().find(value => value.getName() === clip.getName());
    assert.equal(clip.listChannels().length, original.listChannels().length);
    clip.listChannels().forEach((channel, index) => {
      const old = original.listChannels()[index];
      const target = reference.listNodes().find(node => node.getName() === channel.getTargetNode().getName());
      assert.ok(target);
      assert.equal(channel.getTargetPath(), old.getTargetPath());
      assert.deepEqual(channel.getSampler().getInput().getArray(), old.getSampler().getInput().getArray());
      assert.deepEqual(channel.getSampler().getOutput().getArray(), old.getSampler().getOutput().getArray());
      target.getMatrix().forEach((value, index) => {
        assert.ok(Math.abs(value - channel.getTargetNode().getMatrix()[index]) < 1e-5);
      });
    });
  }
});

test('production includes only selected art, not the full imported library', async () => {
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.ok(Buffer.byteLength(html) < 10_900_000, 'Keep selected ambience and creator art below 10.9 MB (baseline 9.26 MB)');
  for (const marker of ['assetsPreview', 'Skeleton_Minion', 'Rig_Medium_MovementBasic', 'Biblioteca KayKit']) {
    assert.ok(!html.includes(marker), `Full library leaked: ${marker}`);
  }
});

const url = 'http://127.0.0.1:4178';
let server, browser;
before(async () => {
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4178', '--strictPort']);
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
async function open(query) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning' && /PropertyBinding|No target node/.test(message.text())) {
      if (message.location().url !== `${url}/favicon.ico`) errors.push(message.text());
    }
  });
  await page.addInitScript(() => {
    localStorage.setItem('brumaluz-ambient', 'off');
    localStorage.setItem('brumaluz-menu-music', 'off');
  });
  await page.goto(`${url}/${query}`);
  await page.waitForFunction(() => !!window.brumaluz || document.querySelector('#loading p')?.textContent?.startsWith('No se pudo cargar'), null, { timeout: 90000 });
  assert.deepEqual(errors, []);
  return { page, errors, close: () => context.close() };
}

test('gestures cancel on movement, hits alternate, ambient idles wait and death wins over overlays', { timeout: 120000 }, async () => {
  const { page, errors, close } = await open('?test&graphics=compatible');
  try {
    const failures = await page.evaluate(() => {
      const failures = [];
      const check = (condition, message) => { if (!condition) failures.push(message); };
      const base = window.brumaluz.char();
      const Character = base.constructor;
      for (const race of ['humano', 'elfo', 'pelso', 'lagto']) {
        const actor = new Character({ ...base.d, race }, { outfit: false });
        let time = 0;
        const tick = seconds => {
          for (let i = 0; i < Math.ceil(seconds * 60); i++) { time += 1 / 60; actor.update(time); }
        };
        const current = () => actor.oneShot?.getClip().name;
        actor.update(0);
        actor.pickUp();
        check(current() === 'PickUp', `${race}: pickup`);
        tick(.2);
        actor.setGait('walk');
        tick(.4);
        check(!actor.oneShot && actor.gait === 'walk', `${race}: cancel pickup while moving`);
        actor.useItem();
        check(!actor.oneShot, `${race}: no consume pose while walking`);
        actor.setGait('idle');
        actor.useItem();
        check(current() === 'Use_Item', `${race}: consume`);
        tick(2);
        check(!actor.oneShot, `${race}: return from consume`);
        actor.hit(); check(current() === 'Hit_A', `${race}: first hit`);
        actor.hit(); check(current() === 'Hit_B', `${race}: new hit`);
        tick(1.5);
        check(!actor.oneShot, `${race}: return from hit`);
        actor.nextIdleAt = time + .1;
        tick(.15);
        check(current() === 'Idle_B', `${race}: new idle`);
        actor.setGait('run'); tick(.4);
        check(!actor.oneShot && actor.gait === 'run', `${race}: cancel ambient idle while running`);
        actor.setGait('idle');
        actor.pickUp();
        actor.attack();
        check(current() !== 'PickUp', `${race}: attacks supersede gestures`);
        tick(2);
        actor.jump();
        tick(.15);
        actor.die();
        check(actor.jumpAction === null && actor.jumpTime < 0, `${race}: death cancels jump`);
        actor.hit(); actor.pickUp(); actor.useItem(); actor.wave(); actor.attack(); actor.setGait('walk');
        check(current() === 'Death_A', `${race}: death cannot be replaced`);
        check(actor.jump() === 0, `${race}: dead cannot jump`);
        tick(1.5);
        check(current() === 'Death_A', `${race}: death stays clamped`);
        actor.revive();
        tick(.4);
        check(!actor.dead && !actor.oneShot && actor.gait === 'walk', `${race}: revive to current gait`);
        for (const bone of actor.bones.values()) {
          check([...bone.position.toArray(), ...bone.quaternion.toArray(), ...bone.scale.toArray()].every(Number.isFinite), `${race}: finite bone transforms`);
        }
        actor.dispose();
      }
      return failures;
    });
    assert.deepEqual(failures, []);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('city details use all eight selected props, bounded instancing, grounded collision and clear objectives', { timeout: 120000 }, async () => {
  const { page, errors, close } = await open('?graphics=compatible');
  try {
    const result = await page.evaluate(() => {
      const city = window.brumaluz.city();
      const root = city.root.getObjectByName('city-details');
      const placements = root.userData.placements;
      const problems = [];
      const point = city.spawn.clone();
      const target = city.spawn.clone();
      for (const placement of placements) {
        if (Math.abs(placement.y - city.groundY(placement.x, placement.z)) > .12) problems.push('Floating/buried: ' + placement.prop);
        point.set(placement.x + placement.radius + 1, city.groundY(placement.x, placement.z), placement.z);
        target.set(placement.x, point.y, placement.z);
        const corrected = city.collide(point, target);
        if (Math.hypot(corrected.x - placement.x, corrected.z - placement.z) < placement.radius + .44) problems.push('No collider: ' + placement.prop);
        point.y = target.y = placement.topY + .2;
        const airborne = city.collide(point, target);
        if (Math.hypot(airborne.x - placement.x, airborne.z - placement.z) > .01) problems.push('Cannot jump over: ' + placement.prop);
        const rise = placement.topY - city.groundY(placement.x, placement.z);
        if (!['bush', 'rock'].includes(placement.prop) && rise >= .3 && rise <= 1.2 && placement.hx >= .3 && placement.hz >= .3) {
          if (Math.abs((city.platformY(placement.x, placement.z) ?? -100) - placement.topY) > .001) problems.push('Missing landing surface: ' + placement.prop);
        }
        for (const spot of city.vendorSpots) {
          if (Math.hypot(placement.x - spot.position.x, placement.z - spot.position.z) < placement.radius + 2) problems.push('Blocked service');
        }
      }
      for (const [x, z] of [[-6.4, -8.5], [15.8, -5.7], [-3.5, 0], [0, -62.35], [city.spawn.x, city.spawn.z]]) {
        if (placements.some(placement => Math.hypot(placement.x - x, placement.z - z) < placement.radius + 2)) problems.push('Blocked objective');
      }
      return { count: placements.length, props: [...new Set(placements.map(value => value.prop))].sort(),
        calls: root.children.length, instanced: root.children.every(mesh => mesh.isInstancedMesh), problems };
    });
    assert.ok(result.count >= 12 && result.count <= 24, JSON.stringify(result));
    assert.deepEqual(result.props, ['barrels', 'bush', 'iron', 'logs', 'planks', 'rock', 'tavern-table', 'textiles']);
    assert.ok(result.calls <= 8, JSON.stringify(result));
    assert.equal(result.instanced, true);
    assert.deepEqual(result.problems, []);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
