// Deterministic 30 Hz movement in the real game, including profession-world collisions and real rigs.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const output = 'art/population-review/movement';
await mkdir(output, { recursive: true });
const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 4278, strictPort: true, hmr: false, watch: null } });
let browser;
const errors = [], report = { scope: 'Real city and character models, deterministic 30 Hz routines; CPU timings exclude GPU rendering and do not measure hardware FPS.', locations: [], errors };
try {
  await server.listen();
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('brumaluz-language', 'es'); localStorage.setItem('brumaluz-ambient', 'off'); localStorage.setItem('brumaluz-menu-music', 'off');
  });
  await page.route(/https:\/\/[^/]+\.supabase\.co\//, route => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await page.goto('http://127.0.0.1:4278/?test&welcome&graphics=compatible', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => !!window.brumaluz, null, { timeout: 180000 });
  await page.evaluate(async () => {
    (await import('/src/data/worldClock.ts')).syncWorldClock({ hour: 11, secondsPerHour: 100000 });
    window.brumaluz.set({ introSeen: true, welcome: { stage: 'completed', origin: 0 }, shadowQuest: 'returned' });
    window.brumaluz.play();
    const stage = await import('/src/game/stage.ts'), cities = await import('/src/game/cities.ts'), state = await import('/src/game/state.ts');
    const { updateNameplate } = await import('/src/game/hud.ts');
    const { isAmbientResident } = await import('/src/data/cityPopulation.ts');
    stage.renderer.setAnimationLoop(null);
    const population = cities.cityPopulation, residents = cities.npcActors.filter(actor => isAmbientResident(actor.id));
    const originalPresent = population.updatePresentation.bind(population);
    let time = stage.clock.getElapsedTime(), maxVisible = 0;
    const history = new Map(), flips = new Map(), reversals = new Map(), timings = [], presentation = [], trails = [], slowPlans = [];
    const plan = population.plan.bind(population);
    population.plan = (resident, goal, recover) => {
      const begun = performance.now(), result = plan(resident, goal, recover), ms = performance.now() - begun;
      if (ms > 8) slowPlans.push({ id: resident.id, ms, recover: !!recover, found: result });
      return result;
    };
    for (const actor of residents) {
      const setGait = actor.character.setGait.bind(actor.character);
      actor.character.setGait = gait => { actor.reviewGait = gait; setGait(gait); };
    }
    window.movementReview = {
      place(x, z) {
        window.brumaluz.move(x + 4, z + 6);
        stage.camTarget.set(x, state.play.city.groundY(x, z) + 1, z);
        stage.camera.clearViewOffset(); stage.camera.position.set(x + 12, stage.camTarget.y + 14, z + 24);
        stage.camera.lookAt(stage.camTarget); stage.camera.updateMatrixWorld();
      },
      advance(seconds) {
        const ctx = { player: stage.holder.position, playerSeated: false, quiet: true,
          blockers: cities.npcActors.filter(npc => !isAmbientResident(npc.id) && npc.character.root.visible).map(npc => npc.character.root.position), say() {} };
        for (let frame = 0; frame < seconds * 30; frame++) {
          const begun = performance.now(); population.update(1 / 30, ctx); timings.push(performance.now() - begun);
          time += 1 / 30;
          const before = performance.now(); originalPresent(time, stage.camera, stage.holder.position, true, true); presentation.push(performance.now() - before);
          maxVisible = Math.max(maxVisible, population.presentationStats().visible);
          const snapshots = population.snapshot();
          for (const resident of snapshots) {
            const actor = residents.find(actor => actor.id === resident.id), old = history.get(resident.id);
            const [x, , z] = resident.position, dx = old ? x - old.x : 0, dz = old ? z - old.z : 0;
            const moving = Math.hypot(dx, dz) > .002;
            if (old?.activity === 'walking' && resident.activity === 'walking') {
              if (old.gait !== actor.reviewGait) flips.set(resident.id, (flips.get(resident.id) ?? 0) + 1);
              if (moving && old.moving && (dx * old.dx + dz * old.dz) / (Math.hypot(dx, dz) * Math.hypot(old.dx, old.dz)) < .5)
                reversals.set(resident.id, (reversals.get(resident.id) ?? 0) + 1);
            }
            history.set(resident.id, { x, z, dx, dz, moving, gait: actor.reviewGait, activity: resident.activity });
          }
          if (frame % 15 === 0) {
            for (let a = 0; a < snapshots.length; a++) {
              const actor = residents.find(actor => actor.id === snapshots[a].id);
              if (snapshots[a].activity !== 'seated') {
                const point = actor.character.root.position;
                if (state.play.city.collide(point, point.clone()).distanceTo(point) > .004)
                  throw Error(`Resident intersects the real world: ${snapshots[a].id}`);
              }
              for (let b = a + 1; b < snapshots.length; b++) {
                if (snapshots[a].activity === 'seated' || snapshots[b].activity === 'seated') continue;
                if (Math.hypot(snapshots[a].position[0] - snapshots[b].position[0], snapshots[a].position[2] - snapshots[b].position[2]) < 1.075)
                  throw Error(`Residents overlap: ${snapshots[a].id} / ${snapshots[b].id}`);
              }
            }
            trails.push({ time, residents: snapshots });
          }
        }
        state.play.char.update(time); state.play.city.update(time, stage.holder.position); updateNameplate();
        stage.renderer.render(stage.scene, stage.camera);
        return { total: residents.length, presentation: population.presentationStats(), time };
      },
      finish() {
        const stats = values => {
          const sorted = [...values].sort((a, b) => a - b);
          return { mean: values.reduce((a, b) => a + b, 0) / values.length, p95: sorted[Math.floor(sorted.length * .95)], max: sorted.at(-1) };
        };
        return { maxVisible, routinesMs: stats(timings), presentationAndAnimationMs: stats(presentation),
          slowPlans, flips: [...flips].sort((a, b) => b[1] - a[1]), reversals: [...reversals].sort((a, b) => b[1] - a[1]), trails };
      },
    };
  });
  for (const [name, x, z] of [['pozo', -8, 0], ['jardin', 32, 31], ['levante', 136, 0], ['huertas', -12, 76]]) {
    await page.evaluate(({ x, z }) => window.movementReview.place(x, z), { x, z });
    const frames = [];
    for (let slice = 0; slice < 3; slice++) {
      frames.push(await page.evaluate(() => window.movementReview.advance(15)));
      await page.screenshot({ path: `${output}/${name}-${slice + 1}.png` });
    }
    assert.ok(frames.every(frame => frame.total === 54 && frame.presentation.visible <= 16));
    report.locations.push({ name, frames }); console.log(`Movement: ${name} checked.`);
  }
  const result = await page.evaluate(() => window.movementReview.finish());
  const { trails, ...summary } = result;
  Object.assign(report, summary);
  assert.ok(report.maxVisible <= 16);
  assert.ok(report.flips.every(([, count]) => count < 30), `walking/idle thrashing: ${JSON.stringify(report.flips.slice(0, 5))}`);
  assert.ok(report.reversals.every(([, count]) => count < 60), `rapid reversals: ${JSON.stringify(report.reversals.slice(0, 5))}`);
  assert.deepEqual(errors, []);
  await writeFile(`${output}/trails.json`, JSON.stringify(trails) + '\n');
  await writeFile(`${output}/review.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(summary));
} finally { await browser?.close(); await server.close(); }
