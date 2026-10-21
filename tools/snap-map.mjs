// Capturas del editor de mapas sin tocar src/data: node tools/snap-map.mjs <mapa.json> <dir> [vistas.json]
// Cada vista: { name, target: [x,y,z], position: [x,y,z] }.
import { mkdtemp, copyFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mapEditorPlugin } from './map-editor-plugin.mjs';

const [file, out, viewsFile] = process.argv.slice(2);
const map = JSON.parse(await readFile(file, 'utf8'));
const views = viewsFile ? JSON.parse(await readFile(viewsFile, 'utf8')) : [
  { name: 'top', target: [0, 0, 0], position: [0, 520, 1] },
];
const dir = await mkdtemp(join(tmpdir(), 'snap-maps-')), pub = await mkdtemp(join(tmpdir(), 'snap-world-'));
await copyFile(file, join(dir, `${map.id}.json`));
await mkdir(out, { recursive: true });
const port = 4197;
const server = await createServer({
  configFile: false, logLevel: 'error', assetsInclude: ['**/*.glb'],
  plugins: [mapEditorPlugin({ mapsDir: dir, publishDir: pub, sqlFile: join(pub, 'world.sql') })],
  server: { host: '127.0.0.1', port, strictPort: true, fs: { allow: [process.cwd(), dir, pub] } },
});
await server.listen();
const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  page.on('pageerror', error => console.error('pageerror', error.message));
  await page.addInitScript(id => localStorage.setItem('brumaluz.mapEditor.last', id), map.id);
  await page.goto(`http://127.0.0.1:${port}/maps.html`);
  await page.waitForFunction(() => document.getElementById('loading')?.hidden, null, { timeout: 300000 });
  await page.addStyleTag({ content: '#topbar,#tools,#left,#right,#statusbar,#tool-options{display:none!important} body>*{grid-template:"view" 1fr / 1fr!important} #viewport{grid-area:view!important;width:100vw;height:100vh}' });
  await page.evaluate(async () => { const core = await import('/src/dev/mapEditor/core.ts'); core.state.view.grid = false; window.dispatchEvent(new Event('resize')); await core.objectLayer.ready(); });
  for (const view of views) {
    await page.evaluate(async view => {
      const core = await import('/src/dev/mapEditor/core.ts');
      core.state.view.markers = view.markers ?? false;
      core.controls.target.set(...view.target);
      core.camera.position.set(...view.position);
      core.controls.update();
    }, view);
    await page.waitForTimeout(1500);
    await page.locator('#viewport canvas').first().screenshot({ path: join(out, `${view.name}.png`) });
    await page.waitForTimeout(1500);
    console.log('saved', view.name, await page.evaluate(() => document.getElementById('scene-info')?.textContent));
  }
} finally { await browser.close(); await server.close(); }
