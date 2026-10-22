// Art sheet: the complete original silhouettes, not recolours of the previous items.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium } from 'playwright';
const url = 'http://127.0.0.1:4188';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4188', '--strictPort']);
let browser;
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Vite timeout')), 20000);
    server.once('error', reject); server.once('exit', code => reject(new Error(`Vite exited ${code}`)));
    server.stdout.on('data', data => { if (data.toString().includes(url)) { clearTimeout(timer); resolve(); } });
  });
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 2400, height: 1200 } });
  await page.goto(`${url}/render.html`);
  await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const { ORIGINAL_WEAPONS } = await import('/src/data/uniqueWeapons.ts');
    const canvas = document.createElement('canvas'); document.body.replaceChildren(canvas);
    document.body.style.cssText = 'margin:0;overflow:hidden;background:#e4e1d8;font-family:system-ui;color:#35413c';
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); renderer.setSize(2400, 1200);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#e4e1d8');
    scene.add(new THREE.HemisphereLight('#fff5e4', '#7e8c9a', 2.4));
    const key = new THREE.DirectionalLight('#fff2d9', 3.2); key.position.set(-5, 10, 12); scene.add(key);
    const camera = new THREE.OrthographicCamera(-10, 10, 5, -5, .01, 100); camera.position.set(0, 0, 20); camera.lookAt(0, 0, 0);
    const loader = new GLTFLoader();
    function text(value, x, y, size = 18, color = '#35413c', width = 280) {
      const p = new THREE.Vector3(x, y, 0).project(camera), label = document.createElement('div'); label.textContent = value;
      label.style.cssText = `position:absolute;left:${(p.x+1)*1200-width/2}px;top:${(1-p.y)*600}px;width:${width}px;text-align:center;font-size:${size}px;color:${color};font-weight:600`;
      document.body.append(label);
    }
    for (const [i, item] of ORIGINAL_WEAPONS.filter(item => ['alba', 'eclipse'].includes(item.collection)).entries()) {
      const model = (await loader.loadAsync(`/src/assets/models/items/unique/${item.collection}/${item.id}.glb`)).scene;
      if (item.weapon.kind === 'book') model.rotation.y = Math.PI / 2 - .2;
      else if (item.weapon.kind === 'crossbow') model.rotation.x = Math.PI / 3;
      else model.rotation.y = -.24;
      const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
      const scale = 1.8 / Math.max(size.x, size.y, size.z);
      model.scale.multiplyScalar(scale); model.position.sub(center.multiplyScalar(scale));
      const holder = new THREE.Group(); holder.add(model);
      holder.position.set((i % 8 - 3.5) * 2.4, i < 8 ? 1.7 : -2.0, 0); scene.add(holder);
      text(item.label, holder.position.x, holder.position.y - 1.15, 17, i < 8 ? '#286491' : '#77429e', 270);
    }
    renderer.render(scene, camera);
    text('BRUMALUZ · 16 ARMAS CON MODELOS ORIGINALES', 0, 4.7, 28, '#35413c', 1800);
    text('Guardia del Alba · Raro azul', 0, 3.35, 23, '#286491', 1200);
    text('Reliquias del Eclipse · Épico morado', 0, -.35, 23, '#77429e', 1200);
    text('Cada silueta se construye desde cero · Los conjuntos anteriores permanecen intactos', 0, -4.25, 19, '#62675f', 1800);
  });
  await page.screenshot({ path: 'src/assets/models/items/unique/original_weapons.png' });
  console.log('Rendered original_weapons.png');
} finally {
  await browser?.close();
  if (server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped; }
}
