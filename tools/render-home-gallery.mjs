import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir } from 'node:fs/promises';

const outDir = 'art/home-model-review';
await mkdir(outDir, { recursive: true });

const server = await createServer({
  server: { host: '127.0.0.1', port: 4296, strictPort: true, hmr: false, watch: null },
  logLevel: 'error'
});
await server.listen();

const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
  headless: true
});

try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  await page.route(/https:\/\/[^/]+\.supabase\.co\//, route => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  
  await page.goto('http://127.0.0.1:4296/');
  await page.setContent(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
body { margin: 0; padding: 24px; background: #262320; color: #ede3d4; font-family: sans-serif; }
h1 { margin: 0 0 16px; font-size: 24px; text-align: center; color: #f0cf8e; }
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.card { background: #332f2b; border: 1px solid #574e44; border-radius: 8px; padding: 12px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
.card img { width: 100%; height: 210px; object-fit: contain; }
.card h3 { margin: 8px 0 2px; font-size: 15px; color: #ebd4a8; }
.card p { margin: 0; font-size: 11px; color: #a69886; }
</style>
</head>
<body>
<h1>Brumaluz · Un rincón propio · Muebles con historia</h1>
<div class="grid" id="container"></div>
<script type="module">
import * as THREE from '/node_modules/three/build/three.module.js';
import { furnitureGeometry } from '/src/world/homeFurniture.ts';
import { furnitureMaterial, prepareFurnitureMaterials } from '/src/world/homeFurnitureMaterial.ts';
await prepareFurnitureMaterials();

const list = [
  ['taburete', 'Taburete de taller', 'Asiento ahuecado, cantos suaves y patas abiertas'],
  ['mesa', 'Mesa de artesano', 'Camino bordado, pan en cerámica y faldón tallado'],
  ['biblioteca', 'Biblioteca tallada', 'Cornisa escalonada, libros encuadernados y mantas'],
  ['estacion', 'Banco de trabajo', 'Tablero ensamblado, prensa, formones y garlopa'],
  ['silla', 'Silla de respaldo trenzado', 'Asiento y respaldo de lino, estructura torneada'],
  ['banco', 'Banco de ventana', 'Tapizado bordado, manta con caída y reposabrazos'],
  ['mesita', 'Mesita de lectura', 'Tablero con borde redondeado, pedestal y trípode'],
  ['arcon', 'Arcón de mantas', 'Tapa abovedada con flejes de hierro y remaches de latón'],
  ['alfombra', 'Alfombra de espigas', 'Tejido y dibujo integrados, bordes suaves y 32 flecos'],
  ['farol', 'Farol de sobremesa', 'Forja, paneles de ámbar luminosos y asa de transporte'],
  ['macetero', 'Macetero de hojas', 'Terracota torneada, interior modelado y hojas redondas'],
  ['biombo', 'Biombo de lino', 'Tres hojas articuladas, lino tensado y bisagras'],
  ['butaca', 'Butaca de las tardes', 'Tapizado con costuras, cojín y manta de lectura'],
  ['aparador', 'Aparador de la vajilla', 'Puertas talladas, tiradores, loza pintada y paño'],
  ['escritorio', 'Escritorio de cartas', 'Casillero, cartas atadas, sello de cera y pluma'],
  ['perchero', 'Perchero de bienvenida', 'Ganchos curvos, capa con pliegues y sombrero'],
  ['costurero', 'Costurero de los ovillos', 'Cesta de mimbre, ovillos, agujas, tijeras y tejido'],
  ['jardinera', 'Jardinera de aromáticas', 'Cajón tallado, tiestos, aromáticas y etiquetas'],
];

const width = 360, height = 300;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(width, height);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
const hemi = new THREE.HemisphereLight('#fff5e3', '#685d4c', 2.2);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff2d4', 2.8);
sun.position.set(4, 7, 5);
scene.add(sun);
const fill = new THREE.DirectionalLight('#a3c2e6', 1.0);
fill.position.set(-4, 3, -4);
scene.add(fill);

const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 20);

const container = document.getElementById('container');
for (const [kind, title, desc] of list) {
  const geom = furnitureGeometry(kind, 0);
  const mat = furnitureMaterial();
  const mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  geom.computeBoundingBox();
  const center = new THREE.Vector3();
  geom.boundingBox.getCenter(center);
  const size = new THREE.Vector3();
  geom.boundingBox.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);

  const dist = maxDim * 1.95;
  camera.position.set(center.x + dist * 0.85, center.y + dist * 0.72, center.z - dist * 0.95);
  camera.lookAt(center.x, center.y, center.z);
  renderer.render(scene, camera);

  const url = renderer.domElement.toDataURL();
  scene.remove(mesh);

  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = \`<img src="\${url}"><h3>\${title}</h3><p>\${desc}</p>\`;
  container.appendChild(card);
}
window.__READY__ = true;
</script>
</body>
</html>`);

  await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 15000 });
  const galleryPath = `${outDir}/gallery-brumaluz-home.png`;
  await page.screenshot({ path: galleryPath, fullPage: true });
  console.log('Rendered gallery:', galleryPath);
  
} finally {
  await browser.close();
  await server.close();
}

