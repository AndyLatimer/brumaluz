// Weapon icon art pipeline: actual mesh, warm studio light, transparent 256px art.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const root = process.cwd();
const output = path.join(root, 'src/assets/icons/weapons');
fs.mkdirSync(output, { recursive: true });
const cachePath = path.join(output, 'sources.json');
const cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : {};
const version = 'warm-model-portrait-v2-skinned-bounds';
const server = await createServer({ server: { host: '127.0.0.1', port: 4191, strictPort: true, watch: { ignored: ['**/*.zip', '**/*.blend', '**/.art-sources/**'] } }, logLevel: 'error' });
let browser;
try {
  const { WEAPONS } = await server.ssrLoadModule('/src/data/weapons.ts');
  const { ARMOR } = await server.ssrLoadModule('/src/data/outfits.ts');
  const { ACCESSORIES } = await server.ssrLoadModule('/src/data/accessories.ts');
  const equipment = { ...WEAPONS, ...ACCESSORIES, ...Object.fromEntries(Object.entries(ARMOR).map(([id, item]) => [id, { ...item, kind: item.slot }])) };
  const models = new Map();
  function scan(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(file);
      else if (entry.name.endsWith('.glb')) models.set(entry.name.slice(0, -4), file);
    }
  }
  scan(path.join(root, 'src/assets/models/items'));
  scan(path.join(root, 'src/assets/models/wardrobe/classes'));
  // Modular pecheras retain the old IDs; prefer their individual models over the old ensemble.
  scan(path.join(root, 'src/assets/models/wardrobe/classes/modular'));
  const pending = [];
  for (const [id, weapon] of Object.entries(equipment)) {
    const file = models.get(id);
    if (!file) throw new Error(`Weapon ${id} needs its own GLB before generating its icon.`);
    const hash = crypto.createHash('sha256').update(version).update(JSON.stringify(weapon)).update(fs.readFileSync(file)).digest('hex');
    if (cache[id] !== hash || !fs.existsSync(path.join(output, `${id}.png`))) pending.push({ id, weapon, file, hash });
  }
  if (pending.length) {
    await server.listen();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:4191/render.html');
    await page.evaluate(async () => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(256, 256); renderer.setClearColor(0, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight('#fff0d0', '#55576b', 2.4));
      for (const [color, intensity, position] of [['#fff0cc', 3.5, [-3, 5, 6]], ['#c1dbef', 1.7, [4, 1, -2]]]) {
        const light = new THREE.DirectionalLight(color, intensity); light.position.set(...position); scene.add(light);
      }
      const camera = new THREE.OrthographicCamera(-1.15, 1.15, 1.15, -1.15, .01, 30);
      camera.position.set(0, 0, 10);
      window.__weaponPortrait = async (url, kind) => {
        const model = (await new GLTFLoader().loadAsync(url)).scene;
        if (['outfit','head','chest','hands','legs','feet','pendant','ring','trinket'].includes(kind)) model.rotation.set(0, kind==='ring'?.75:-.28, 0);
        else if (kind === 'book') model.rotation.set(.12, Math.PI / 2 - .35, -.12);
        else if (kind === 'crossbow') model.rotation.set(.85, -.18, -.48);
        else if (kind === 'shield') model.rotation.set(.08, -.30, -.12);
        else model.rotation.set(.06, -.32, -.62);
        model.updateMatrixWorld(true);
        model.traverse(object=>{if(object.isSkinnedMesh)object.skeleton.update()});
        const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3());
        const scale = 1.96 / Math.max(size.x, size.y);
        model.scale.multiplyScalar(scale);
        model.position.sub(bounds.getCenter(new THREE.Vector3()).multiplyScalar(scale));
        scene.add(model);model.updateMatrixWorld(true);model.traverse(object=>{if(object.isSkinnedMesh)object.skeleton.update()});renderer.render(scene, camera);
        const png = renderer.domElement.toDataURL('image/png').split(',')[1];
        scene.remove(model);
        const textures = new Set();
        model.traverse(o => { if (o.isMesh) { o.geometry.dispose(); for (const m of [].concat(o.material)) { for (const v of Object.values(m)) if (v?.isTexture) textures.add(v); m.dispose(); } } });
        for (const texture of textures) texture.dispose();
        return png;
      };
    });
    for (const item of pending) {
      const url = '/' + path.relative(root, item.file).replaceAll('\\', '/');
      const png = await page.evaluate(({ url, kind }) => window.__weaponPortrait(url, kind), { url, kind: item.weapon.kind });
      fs.writeFileSync(path.join(output, `${item.id}.png`), Buffer.from(png, 'base64'));
      cache[item.id] = item.hash;
    }
  }
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2) + '\n');
  console.log(`Equipment portraits: ${pending.length} generated; ${Object.keys(equipment).length} ready.`);
} finally {
  await browser?.close();
  await server.close();
}
