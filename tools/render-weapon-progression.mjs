// Hoja de arte de los nuevos GLB sobre el rig del juego y catálogo de las seis rarezas.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium } from 'playwright';
const url = 'http://127.0.0.1:4187';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4187', '--strictPort']);
let browser;
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Vite timeout')), 20000);
    server.once('error', reject);
    server.once('exit', code => reject(new Error(`Vite exited ${code}`)));
    server.stdout.on('data', data => { if (data.toString().includes(url)) { clearTimeout(timer); resolve(); } });
  });
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1600 } });
  await page.goto(`${url}/render.html`);
  await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { Character, loadKits } = await import('/src/character/character.ts');
    const { defaultChar } = await import('/src/data/data.ts');
    const { WEAPONS } = await import('/src/data/weapons.ts');
    const { ORIGINAL_WEAPONS } = await import('/src/data/uniqueWeapons.ts');
    const originalIds = new Set(ORIGINAL_WEAPONS.map(item => item.id));
    const { emptyEquipment } = await import('/src/data/inventory.ts');
    await loadKits();
    const canvas = document.createElement('canvas'); document.body.replaceChildren(canvas);
    document.body.style.cssText = 'margin:0;overflow:hidden;background:#e4e1d8';
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); renderer.setSize(1920, 1600);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#e4e1d8');
    scene.add(new THREE.HemisphereLight('#fff6e4', '#71808b', 2.4));
    const key = new THREE.DirectionalLight('#fff3de', 3); key.position.set(-4, 10, 12); scene.add(key);
    const camera = new THREE.OrthographicCamera(-7.2, 7.2, 6, -6, .01, 100);
    camera.position.set(0, 4.5, 18); camera.lookAt(0, 4.5, 0);
    const classes = ['guerrero', 'mago', 'picaro', 'clerigo', 'explorador'];
    for (const tier of [3, 4, 5]) for (const [column, cls] of classes.entries()) {
      const equipment = emptyEquipment();
      for (const [id, w] of Object.entries(WEAPONS)) if (w.cls === cls && w.tier === tier && !originalIds.has(id)) equipment[w.slot] = { id, count: 1 };
      const actor = new Character({ ...defaultChar(), cls, equipment, clothA: column + 1, clothB: 8 }, { outfit: false });
      actor.root.position.set((column - 2) * 2.7, (5 - tier) * 3.15 + .15, 0); actor.root.rotation.y = -.65;
      actor.update(0); actor.update(.1); scene.add(actor.root);
    }
    renderer.render(scene, camera);
    const heading = document.createElement('div');
    heading.style.cssText = 'position:absolute;top:28px;left:80px;right:80px;text-align:center;font:25px system-ui;color:#35413c';
    heading.innerHTML = '<b>BRUMALUZ · PROGRESIÓN DE ARMAS</b><p style="font-size:18px">Modelos Blender sobre los personajes y agarres del juego</p><div style="display:flex;justify-content:space-around;margin-top:20px;font-size:20px"><span>Guerrero</span><span>Mago</span><span>Pícaro</span><span>Clérigo</span><span>Explorador</span></div>';
    document.body.append(heading);
    for (const [tier, text, color] of [[3, 'ÉPICO · SELLO VIOLETA', '#77429e'], [4, 'LEGENDARIO · AURORA', '#86600c'], [5, 'ARTEFACTO · FUEGO PRIMIGENIO', '#a34e17']]) {
      const point = new THREE.Vector3(0, (5 - tier) * 3.15 + 2.3, 0).project(camera);
      const label = document.createElement('div'); label.textContent = text;
      label.style.cssText = `position:absolute;top:${(1-point.y)*800}px;left:0;right:0;text-align:center;font:700 19px system-ui;color:${color}`;
      document.body.append(label);
    }
  });
  await page.screenshot({ path: 'src/assets/models/items/weapon_progression.png' });
  await page.setViewportSize({ width: 1920, height: 1600 });
  await page.evaluate(async () => {
    const { ITEMS, itemIcon } = await import('/src/data/items.ts');
    const { WEAPONS } = await import('/src/data/weapons.ts');
    const { ORIGINAL_WEAPONS } = await import('/src/data/uniqueWeapons.ts');
    const originalIds = new Set(ORIGINAL_WEAPONS.map(item => item.id));
    const { ITEM_RARITIES, rarityForTier } = await import('/src/data/itemRarity.ts');
    document.body.replaceChildren(); document.body.style.cssText = 'margin:0;padding:32px;box-sizing:border-box;background:#211c23;color:#eee4d3;font:14px system-ui;height:1600px';
    const heading = document.createElement('h1'); heading.textContent = 'BRUMALUZ · 48 ARMAS · SEIS RAREZAS'; heading.style.cssText = 'text-align:center;font-size:27px;margin:0 0 28px'; document.body.append(heading);
    for (let tier = 0; tier <= 5; tier++) {
      const rarity = ITEM_RARITIES[rarityForTier(tier)];
      const title = document.createElement('h2'); title.textContent = `${tier} · ${rarity.label}`; title.style.cssText = `font-size:18px;margin:18px 0 10px;color:${rarity.color}`; document.body.append(title);
      const row = document.createElement('div'); row.style.cssText = 'display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:14px';
      for (const [id, weapon] of Object.entries(WEAPONS)) if (weapon.tier === tier && !originalIds.has(id)) {
        const card = document.createElement('div'); card.style.cssText = `height:174px;padding:10px;box-sizing:border-box;border:1px solid ${rarity.color};border-radius:10px;background:#302730;text-align:center`;
        card.innerHTML = `<div style="width:86px;height:86px;margin:auto">${itemIcon(id)}</div><div style="color:${rarity.color};font-weight:600;margin:8px 0 5px">${ITEMS[id].label}</div><small>${weapon.power ? `Daño ${weapon.power}` : weapon.guard ? `Guardia ${weapon.guard}` : ''}${weapon.healing ? ` · Curación +${weapon.healing}` : ''}</small>`;
        row.append(card);
      }
      document.body.append(row);
    }
  });
  await page.screenshot({ path: 'src/assets/models/items/item_rarities.png' });
  console.log('Rendered weapon_progression.png and item_rarities.png');
} finally {
  await browser?.close();
  if (server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped; }
}
