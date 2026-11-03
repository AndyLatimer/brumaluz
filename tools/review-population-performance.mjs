// Local real-game measurements, separate CPU work from the headless software renderer's frame rate.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const normal = process.argv.includes('--normal');
const baseLabel = process.argv.includes('--baseline') ? 'baseline-18' : normal ? 'expanded-normal' : 'expanded';
const label = baseLabel + (process.argv.includes('--fixes') ? '-fixes' : '');
const output = 'art/population-review/performance';
await mkdir(output, { recursive: true });
const server = await createServer({ cacheDir: 'node_modules/.vite-population-performance', logLevel: 'error',
  server: { host: '127.0.0.1', port: 4277, strictPort: true, hmr: false, watch: null } });
let browser;
const errors = [], report = { label, samples: [], errors };
try {
  await server.listen();
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('brumaluz-language', 'es'); localStorage.setItem('brumaluz-ambient', 'off');
    localStorage.setItem('brumaluz-menu-music', 'off');
  });
  await page.route(/https:\/\/[^/]+\.supabase\.co\//, route => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  const started = performance.now();
  await page.goto(`http://127.0.0.1:4277/?test&welcome${normal ? '' : '&graphics=compatible'}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => !!window.brumaluz, null, { timeout: 180000 });
  report.readyMs = performance.now() - started;
  await page.evaluate(async () => {
    (await import('/src/data/worldClock.ts')).syncWorldClock({ hour: 11, secondsPerHour: 100000 });
    window.brumaluz.set({ introSeen: true, welcome: { stage: 'completed', origin: 0 }, shadowQuest: 'returned', position: { x: 136, z: 0, yaw: Math.PI / 2 } });
    window.brumaluz.play();
    const { npcActors, cityPopulation } = await import('/src/game/cities.ts');
    const { isAmbientResident } = await import('/src/data/cityPopulation.ts');
    const residents = npcActors.filter(actor => isAmbientResident(actor.id));
    const meter = window.populationMeter = { updates: 0, animationMs: 0, simulationMs: 0, presentationMs: 0, residents: residents.length };
    for (const actor of residents) {
      const update = actor.character.update.bind(actor.character);
      actor.character.update = t => { const before = performance.now(); update(t); meter.animationMs += performance.now() - before; meter.updates++; };
    }
    const update = cityPopulation.update.bind(cityPopulation);
    cityPopulation.update = (...args) => { const before = performance.now(); update(...args); meter.simulationMs += performance.now() - before; };
    if (cityPopulation.updatePresentation) {
      const present = cityPopulation.updatePresentation.bind(cityPopulation);
      cityPopulation.updatePresentation = (...args) => {
        const before = performance.now(), animations = meter.animationMs; present(...args);
        meter.presentationMs += Math.max(0, performance.now() - before - (meter.animationMs - animations));
      };
    }
  });
  const locations = normal ? [['jardin', 32, 31, 1.2]]
    : [['levante', 136, 0, Math.PI / 2], ['centro', 0, 0, Math.PI / 2], ['jardin', 32, 31, 1.2], ['ronda', -70, -121, .5]];
  for (const [name, x, z, yaw] of locations) {
    await page.evaluate(({ x, z, yaw }) => { window.brumaluz.move(x, z); window.brumaluz.view(yaw, .6, 16); }, { x, z, yaw });
    await page.waitForTimeout(1300);
    const result = await page.evaluate(async () => {
      const { npcActors, cityPopulation } = await import('/src/game/cities.ts');
      const { isAmbientResident } = await import('/src/data/cityPopulation.ts');
      const { renderer } = window.brumaluz.debug(), meter = window.populationMeter;
      const { graphics } = await import('/src/game/stage.ts');
      meter.updates = 0; meter.animationMs = 0; meter.simulationMs = 0; meter.presentationMs = 0;
      const before = renderer.info.render.frame, begun = performance.now();
      const calls = [], triangles = [];
      await new Promise(resolve => {
        const sample = () => {
          calls.push(renderer.info.render.calls); triangles.push(renderer.info.render.triangles);
          if (performance.now() - begun >= 3000 && renderer.info.render.frame - before >= 12) resolve(); else requestAnimationFrame(sample);
        }; requestAnimationFrame(sample);
      });
      const frames = renderer.info.render.frame - before;
      return { graphics: graphics.compatible ? 'compatible' : 'normal', total: meter.residents, visible: npcActors.filter(actor => isAmbientResident(actor.id) && actor.character.root.visible).length,
        frames, elapsedMs: performance.now() - begun, animationUpdatesPerFrame: meter.updates / frames,
        animationMsPerFrame: meter.animationMs / frames, simulationMsPerFrame: meter.simulationMs / frames, presentationOverheadMsPerFrame: meter.presentationMs / frames,
        drawCalls: calls.reduce((a, b) => a + b, 0) / calls.length, triangles: triangles.reduce((a, b) => a + b, 0) / triangles.length,
        presentation: cityPopulation.presentationStats?.() ?? null };
    });
    report.samples.push({ name, ...result });
    if (label.startsWith('expanded')) {
      assert.equal(result.total, 54);
      assert.ok(result.visible <= (normal ? 24 : 16)); assert.ok(result.animationUpdatesPerFrame <= (normal ? 24 : 16));
    }
    await page.screenshot({ path: `${output}/${label}-${name}.png` });
    console.log(JSON.stringify({ name, ...result }));
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}/${label}.json`, JSON.stringify(report, null, 2) + '\n');
} finally { await browser?.close(); await server.close(); }
