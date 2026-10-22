import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { stripVTControlCharacters } from 'node:util';
import { chromium } from 'playwright';

const url = 'http://127.0.0.1:4184';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4184', '--strictPort']);
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('server timeout')), 20000);
  server.stdout.on('data', data => {
    if (stripVTControlCharacters(data.toString()).includes(url)) { clearTimeout(timer); resolve(); }
  });
  server.stderr.on('data', data => process.stderr.write(data));
});
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.on('pageerror', e => console.log('pageerror:', e.message));
await page.goto(`${url}/render.html`);
const files = process.argv.slice(2);
for (const file of files) {
  const name = file.split('/').pop().replace('.glb', '');
  const info = await page.evaluate(async (src) => {
    await window.__resize();
    return await window.__renderAsset(src);
  }, `/src/${file}`);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.screenshot({ path: `tools/render-${name}.png` });
  console.log('rendered', name, JSON.stringify(info.size));
}
await browser.close();
server.kill();
await once(server, 'exit');
