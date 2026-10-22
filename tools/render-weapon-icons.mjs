import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ server: { host: '127.0.0.1', port: 4192, strictPort: true }, logLevel: 'error' });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1230 } });
  await page.goto('http://127.0.0.1:4192/render.html');
  await page.evaluate(async () => {
    const { ITEMS, itemIcon } = await import('/src/data/items.ts');
    const { WEAPONS } = await import('/src/data/weapons.ts');
    document.body.innerHTML = '<h1>Brumaluz · Iconos de armas</h1><p>Retratos de cada modelo · Madera, bronce y luz cálida</p><main></main>';
    const style = document.createElement('style');
    style.textContent = 'body{margin:0;padding:28px 36px;background:#e6ddca;color:#4b3c31;font:14px Georgia}h1{margin:0 0 8px;font-size:30px}p{margin:0 0 20px}main{display:grid;grid-template-columns:repeat(11,1fr);gap:14px 10px}.cell{text-align:center;min-width:0}.cell svg{display:block;width:82px;height:82px;margin:0 auto 5px;stroke:none}.cell span{font-size:11px;line-height:1.15;display:block;height:26px}';
    document.head.append(style);
    for (const id of Object.keys(WEAPONS)) {
      const cell = document.createElement('div'); cell.className = 'cell';
      cell.innerHTML = itemIcon(id) + '<span></span>'; cell.querySelector('span').textContent = ITEMS[id].label;
      document.querySelector('main').append(cell);
    }
    await Promise.all([...document.querySelectorAll('image')].map(image => new Promise(resolve => { const img = new Image(); img.onload = img.onerror = resolve; img.src = image.getAttribute('href'); })));
  });
  await page.screenshot({ path: 'src/assets/icons/weapons/weapon_icons.png', fullPage: true });
  console.log('Rendered weapon_icons.png');
} finally { await browser?.close(); await server.close(); }
