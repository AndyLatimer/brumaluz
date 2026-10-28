import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';
const label = process.argv[2] ?? 'latest';
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Invalid report label');
const server = await createServer({ server: { host: '127.0.0.1', port: 4213, strictPort: true, hmr: false }, logLevel: 'error' });
let browser;
try {
  await server.listen(); browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { localStorage.setItem('brumaluz-ambient', 'off'); localStorage.setItem('brumaluz-menu-music', 'off'); localStorage.setItem('brumaluz-language', 'es'); });
  await page.goto('http://127.0.0.1:4213/?test&graphics=compatible');
  await page.waitForFunction(() => !!window.brumaluz, null, { timeout: 180000 });
  await page.locator('#loading.hide').waitFor({ state: 'attached' });
  await page.evaluate(async () => { (await import('/src/ui/characterSelect.ts')).showEditor(); window.brumaluz.set({ hair: 25, beard: 0, acc: 0, hairAcc: 0, makeup: 0 }); });
  const cdp = await page.context().newCDPSession(page); await cdp.send('Profiler.enable'); await cdp.send('Profiler.start');
  const timings = await page.evaluate(() => {
    const cases = [{ eyeShape: 1 }, { eyeShape: 9 }, { hair: 23 }, { hair: 25 }, { hair: 1 }, { hair: 22 }, { eyeColor: 3 }, { clothA: 2 }], timings = [];
    for (let pass = 0; pass < 2; pass++) for (const patch of cases) {
      const start = performance.now(); window.brumaluz.set(patch);
      timings.push({ pass, patch, milliseconds: Math.round((performance.now() - start) * 10) / 10 });
    }
    return timings;
  });
  const { profile } = await cdp.send('Profiler.stop');
  const byId = new Map(profile.nodes.map(node => [node.id, node.callFrame])), samples = new Map();
  for (const id of profile.samples ?? []) { const frame = byId.get(id), key = `${frame?.functionName || '(anonymous)'} @ ${frame?.url?.replace(/^.*\/src\//, 'src/') || 'runtime'}`; samples.set(key, (samples.get(key) ?? 0) + 1); }
  const report = { timings, hotspots: [...samples].sort((a, b) => b[1] - a[1]).slice(0, 16), errors };
  await mkdir('art/creator-studio-review', { recursive: true });
  await writeFile(`art/creator-studio-review/performance-${label}.json`, JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []); console.log(JSON.stringify(report));
} finally { await browser?.close(); await server.close(); }
