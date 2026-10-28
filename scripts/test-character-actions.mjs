// Regression checks against the actual rig: gestures must not steal locomotion or combat.
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';
import { chromium } from 'playwright';

let server, browser, page;
before(async () => {
  server = await createServer({ cacheDir: 'node_modules/.vite-character-actions', server: { host: '127.0.0.1', port: 4196, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
  server.middlewares.use('/__actions', (_request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end('<!doctype html><title>Character actions</title>');
  });
  await server.listen();
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
  page = await browser.newPage();
  await page.goto('http://127.0.0.1:4196/__actions');
  await page.evaluate(async () => {
    const { Character, loadKits } = await import('/src/character/character.ts');
    const { defaultChar } = await import('/src/data/data.ts');
    await loadKits();
    window.actor = () => new Character(defaultChar(), { outfit: false });
  });
}, { timeout: 120000 });
after(async () => { await browser?.close(); await server?.close(); });

test('using an item while walking animates the hands without changing the leg pose or gait', async () => {
  const result = await page.evaluate(() => {
    const control = actor(), using = actor();
    for (const a of [control, using]) { a.setGait('walk'); a.setLocomotionSpeed(2.4); a.update(0); a.update(.1); }
    using.useItem();
    for (let t = .2; t <= .8; t += .1) { control.update(t); using.update(t); }
    const bone = (a,name) => a.bones.get(name) ?? a.bones.get(name.replaceAll('.',''));
    const angle = name => bone(control,name).quaternion.angleTo(bone(using,name).quaternion);
    const result = { gait: using.gait, legs: ['upperleg.l','lowerleg.l','upperleg.r','lowerleg.r'].map(angle), hand: angle('upperarm.r'), overlay: !!using.itemAction };
    control.dispose(); using.dispose(); return result;
  });
  assert.equal(result.gait, 'walk');
  assert.ok(result.legs.every(angle => angle < .00001), 'Hands-only action must preserve the walking feet');
  assert.ok(result.hand > .01, 'An item gesture must actually move the upper body');
  assert.equal(result.overlay, true);
});

test('gathering repeats until movement and its cleanup cannot cancel a newer attack', async () => {
  const result = await page.evaluate(() => {
    const a = actor(); a.update(0);
    const began = a.beginGathering(), clip = a.oneShot.getClip();
    for (let t = .1; t < clip.duration * 3; t += .1) a.update(t);
    const repeated = a.oneShot?.getClip().name === 'Interact';
    a.setGait('walk'); const cancelledByMovement = a.oneShot === null;
    a.setGait('idle'); a.beginGathering(); a.attack(); const combat = a.oneShot; a.endGathering();
    const result = { began, repeated, cancelledByMovement, combatPreserved: a.oneShot === combat && combat.getClip().name.startsWith('Combat_') };
    a.dispose(); return result;
  });
  assert.deepEqual(result, { began: true, repeated: true, cancelledByMovement: true, combatPreserved: true });
});

test('repeated hits do not restart reactions, and damage or an item cannot replace an attack', async () => {
  const result = await page.evaluate(() => {
    const a = actor(); a.update(0); a.hit(); a.update(.1); const reaction = a.oneShot, time = reaction.time;
    a.hit(); const reactionContinues = a.oneShot === reaction && reaction.time === time;
    a.attack(); const attack = a.oneShot; a.hit(); a.useItem();
    const result = { reactionContinues, attackPreserved: a.oneShot === attack, noItemOverlay: !a.itemAction };
    a.dispose(); return result;
  });
  assert.deepEqual(result, { reactionContinues: true, attackPreserved: true, noItemOverlay: true });
});

test('collecting replaces a cosmetic idle and repeated gestures stay finite through death and revival', async () => {
  const result = await page.evaluate(() => {
    const a = actor(); a.update(0); a.play('Idle_B', true); a.pickUp(); const pickedUp = a.oneShot.getClip().name === 'PickUp';
    a.stopGesture(); a.useItem(); a.update(.1); a.die(); const overlayStopped = !a.itemAction;
    a.revive(); a.setGait('run'); a.setLocomotionSpeed(6.2);
    let finite = true;
    for (let t = .2; t <= 3; t += .1) {
      a.update(t); a.root.updateMatrixWorld(true);
      a.root.traverse(node => { finite &&= node.matrixWorld.elements.every(Number.isFinite); });
    }
    const result = { pickedUp, overlayStopped, finite }; a.dispose(); return result;
  });
  assert.deepEqual(result, { pickedUp: true, overlayStopped: true, finite: true });
});
