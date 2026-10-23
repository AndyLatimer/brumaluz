import { Document, NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const outDir = new URL('../src/assets/library/medieval-furniture/objects/', import.meta.url);
const io = new NodeIO();

// ---------------------------------------------------------------------------
// Paleta de colores estilo KayKit (misma que el resto de assets del juego)
// ---------------------------------------------------------------------------
const wood = '#8b5a34';
const woodDark = '#5c3820';
const woodLight = '#d8b780';
const iron = '#6b7280';
const ironDark = '#374151';
const gold = '#e6b445';
const straw = '#e9c46a';
const leather = '#a67c52';

const matDef = [
  ['wood', wood, 0.7, 0.1],
  ['woodDark', woodDark, 0.7, 0.1],
  ['woodLight', woodLight, 0.7, 0.1],
  ['iron', iron, 0.6, 0.6],
  ['ironDark', ironDark, 0.5, 0.8],
  ['gold', gold, 0.4, 0.9],
  ['straw', straw, 0.9, 0],
  ['leather', leather, 0.8, 0.1],
];

function buildMaterials(doc) {
  const map = new Map();
  for (const [name, color, rough, met] of matDef) {
    map.set(name, doc.createMaterial(name)
      .setBaseColorFactor([...new THREE.Color(color).toArray(), 1])
      .setRoughnessFactor(rough).setMetallicFactor(met));
  }
  return map;
}

function buildAccessors(doc, buf) {
  return (name, array, type) => doc.createAccessor(name).setType(type).setArray(array).setBuffer(buf);
}

function buildMesh(doc, acc, materials) {
  return (name, parts, parent) => {
    const output = doc.createMesh(name);
    for (const [materialName, geometry] of Object.entries(parts)) {
      const merged = mergeVertices(geometry.deleteAttribute('uv').deleteAttribute('normal'), 1e-4);
      merged.computeVertexNormals();
      output.addPrimitive(doc.createPrimitive()
        .setAttribute('POSITION', acc(`${name}:${materialName}:position`, Float32Array.from(merged.getAttribute('position').array), 'VEC3'))
        .setAttribute('NORMAL', acc(`${name}:${materialName}:normal`, Float32Array.from(merged.getAttribute('normal').array), 'VEC3'))
        .setIndices(acc(`${name}:${materialName}:indices`, Uint16Array.from(merged.index.array), 'SCALAR'))
        .setMaterial(materials.get(materialName)));
      geometry.dispose(); merged.dispose();
    }
    parent.addChild(doc.createNode(name).setMesh(output));
  };
}

function buildPlace() {
  return (geometry, t = {}) => geometry.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(t.x ?? 0, t.y ?? 0, t.z ?? 0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(t.rx ?? 0, t.ry ?? 0, t.rz ?? 0)),
    new THREE.Vector3(t.s ?? 1, t.s ?? 1, t.s ?? 1)
  ));
}

// ---------------------------------------------------------------------------
// 1. BAÚL MEDIEVAL (cofre con bandas de hierro)
// ---------------------------------------------------------------------------
function buildMedievalChest(ctx) {
  const { doc, mesh, place, scene, materials } = ctx;
  const root = doc.createNode('medieval-chest');
  scene.addChild(root);
  const body = place(new THREE.BoxGeometry(0.9, 0.55, 0.5), { y: 0.275 });
  const lid = place(new THREE.BoxGeometry(0.94, 0.08, 0.54), { y: 0.55 });
  const hinge = place(new THREE.BoxGeometry(0.06, 0.04, 0.42), { x: -0.42, y: 0.57 });
  const lock = place(new THREE.BoxGeometry(0.08, 0.06, 0.12), { x: 0, y: 0.555, z: 0.23 });
  const bandFront = place(new THREE.BoxGeometry(0.94, 0.03, 0.52), { y: 0.275 });
  const bandSide = place(new THREE.BoxGeometry(0.92, 0.03, 0.52), { y: 0.55 });
  mesh('chest-body', { wood: body }, root);
  mesh('chest-lid', { wood: lid }, root);
  mesh('chest-iron', { iron: mergeGeometries([hinge, lock, bandFront, bandSide]) }, root);
}

// ---------------------------------------------------------------------------
// 2. BARRIL DE MADERA
// ---------------------------------------------------------------------------
function buildMedievalBarrel(ctx) {
  const { doc, mesh, place, scene, materials } = ctx;
  const root = doc.createNode('medieval-barrel');
  scene.addChild(root);
  const profile = [
    [0, 0], [0.32, 0.02], [0.42, 0.15], [0.46, 0.45], [0.44, 0.75], [0.40, 0.9], [0, 0.92],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const barrel = new THREE.LatheGeometry(profile, 24);
  const top = place(new THREE.CylinderGeometry(0.44, 0.44, 0.05, 24), { y: 0.92 });
  const bottom = place(new THREE.CylinderGeometry(0.44, 0.44, 0.05, 24), { y: 0 });
  const hoop1 = place(new THREE.TorusGeometry(0.47, 0.018, 12, 32), { y: 0.12, rx: Math.PI / 2 });
  const hoop2 = place(new THREE.TorusGeometry(0.47, 0.018, 12, 32), { y: 0.8, rx: Math.PI / 2 });
  mesh('barrel-body', { wood: barrel }, root);
  mesh('barrel-caps', { woodDark: mergeGeometries([top, bottom]) }, root);
  mesh('barrel-hoops', { iron: mergeGeometries([hoop1, hoop2]) }, root);
}

// ---------------------------------------------------------------------------
// 3. CALDERO (hierro sobre tres patas)
// ---------------------------------------------------------------------------
function buildMedievalCauldron(ctx) {
  const { doc, mesh, place, scene, materials } = ctx;
  const root = doc.createNode('medieval-cauldron');
  scene.addChild(root);
  const pot = place(new THREE.CylinderGeometry(0.4, 0.5, 0.42, 24), { y: 0.42 });
  const rim = place(new THREE.TorusGeometry(0.52, 0.025, 12, 32), { y: 0.63, rx: Math.PI / 2 });
  const leg = (x, z) => place(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 10), { x, y: 0.25, z });
  mesh('cauldron-pot', { ironDark: mergeGeometries([pot, rim]) }, root);
  mesh('cauldron-legs', { iron: mergeGeometries([leg(-0.32, -0.28), leg(0.32, -0.28), leg(0, 0.56)]) }, root);
}

// ---------------------------------------------------------------------------
// 4. MESA DE BANQUETE LARGA
// ---------------------------------------------------------------------------
function buildMedievalBanquetTable(ctx) {
  const { doc, mesh, place, scene, materials } = ctx;
  const root = doc.createNode('medieval-banquet-table');
  scene.addChild(root);
  const top = place(new THREE.BoxGeometry(2.4, 0.1, 0.7), { y: 0.75 });
  const leg = (x, z) => place(new THREE.BoxGeometry(0.09, 0.7, 0.09), { x, y: 0.4, z });
  const stretcherX = place(new THREE.BoxGeometry(2.2, 0.05, 0.05), { y: 0.15 });
  const stretcherZ = place(new THREE.BoxGeometry(0.05, 0.05, 0.55), { y: 0.15 });
  mesh('table-top', { wood: top }, root);
  mesh('table-legs', { wood: mergeGeometries([leg(-1.05, -0.28), leg(1.05, -0.28), leg(-1.05, 0.28), leg(1.05, 0.28)]) }, root);
  mesh('table-stretchers', { woodDark: mergeGeometries([stretcherX, stretcherZ]) }, root);
}

// ---------------------------------------------------------------------------
// 5. TRONO
// ---------------------------------------------------------------------------
function buildMedievalThrone(ctx) {
  const { doc, mesh, place, scene, materials } = ctx;
  const root = doc.createNode('medieval-throne');
  scene.addChild(root);
  const seat = place(new THREE.BoxGeometry(0.7, 0.12, 0.55), { y: 0.5 });
  const back = place(new THREE.BoxGeometry(0.7, 0.8, 0.1), { y: 1.0, z: -0.22 });
  const leg = (x, z) => place(new THREE.BoxGeometry(0.08, 0.5, 0.08), { x, y: 0.25, z });
  const arm = (x) => place(new THREE.BoxGeometry(0.14, 0.08, 0.45), { x, y: 0.62, z: 0 });
  const carving = place(new THREE.BoxGeometry(0.3, 0.3, 0.04), { y: 1.15, z: -0.23 });
  mesh('throne-seat', { wood: seat }, root);
  mesh('throne-back', { wood: back }, root);
  mesh('throne-legs', { wood: mergeGeometries([leg(-0.28, -0.2), leg(0.28, -0.2), leg(-0.28, 0.2), leg(0.28, 0.2)]) }, root);
  mesh('throne-arms', { wood: mergeGeometries([arm(-0.3), arm(0.3)]) }, root);
  mesh('throne-carving', { gold: carving }, root);
}

// ---------------------------------------------------------------------------
// 6. ATRIL / PÓDIUM
// ---------------------------------------------------------------------------
function buildMedievalLectern(ctx) {
  const { doc, mesh, place, scene, materials } = ctx;
  const root = doc.createNode('medieval-lectern');
  scene.addChild(root);
  const base = place(new THREE.BoxGeometry(0.45, 0.12, 0.45), { y: 0.06 });
  const post = place(new THREE.BoxGeometry(0.09, 1.0, 0.09), { y: 0.6 });
  const top = place(new THREE.BoxGeometry(0.5, 0.06, 0.35), { y: 1.18 });
  const lip = place(new THREE.BoxGeometry(0.5, 0.04, 0.08), { y: 1.195, z: -0.135 });
  mesh('lectern-base', { wood: base }, root);
  mesh('lectern-post', { wood: post }, root);
  mesh('lectern-top', { wood: top }, root);
  mesh('lectern-lip', { woodDark: lip }, root);
}

// ---------------------------------------------------------------------------
// 7. PACA DE HENO
// ---------------------------------------------------------------------------
function buildMedievalHayBale(ctx) {
  const { doc, mesh, place, scene, materials } = ctx;
  const root = doc.createNode('medieval-hay-bale');
  scene.addChild(root);
  const bale = place(new THREE.BoxGeometry(0.9, 0.5, 0.9), { y: 0.25 });
  const strands = [];
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2;
    strands.push(place(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), {
      x: Math.cos(angle) * 0.38, y: 0.25, z: Math.sin(angle) * 0.38,
      ry: angle,
    }));
  }
  mesh('hay-bale', { straw: mergeGeometries([bale, ...strands]) }, root);
}

// ---------------------------------------------------------------------------
// 8. BANCO DE MADERA SIMPLE
// ---------------------------------------------------------------------------
function buildMedievalBench(ctx) {
  const { doc, mesh, place, scene, materials } = ctx;
  const root = doc.createNode('medieval-bench');
  scene.addChild(root);
  const seat = place(new THREE.BoxGeometry(1.4, 0.08, 0.4), { y: 0.48 });
  const leg = (x, z) => place(new THREE.BoxGeometry(0.07, 0.44, 0.07), { x, y: 0.22, z });
  const support = place(new THREE.BoxGeometry(1.2, 0.06, 0.06), { y: 0.22 });
  mesh('bench-seat', { wood: seat }, root);
  mesh('bench-legs', { wood: mergeGeometries([leg(-0.6, -0.14), leg(0.6, -0.14), leg(-0.6, 0.14), leg(0.6, 0.14)]) }, root);
  mesh('bench-support', { woodDark: support }, root);
}

// ---------------------------------------------------------------------------
// 9. COMEDERO DE ANIMALES (madera, abierto arriba)
// ---------------------------------------------------------------------------
function buildMedievalFeedingTrough(ctx) {
  const { doc, mesh, place, scene, materials } = ctx;
  const root = doc.createNode('medieval-feeding-trough');
  scene.addChild(root);
  const box = place(new THREE.BoxGeometry(1.0, 0.4, 0.5), { y: 0.2 });
  const rim = place(new THREE.BoxGeometry(1.0, 0.42, 0.52), { y: 0.21 });
  const leg = (x, z) => place(new THREE.BoxGeometry(0.07, 0.4, 0.07), { x, y: 0.2, z });
  mesh('trough-outer', { wood: rim }, root);
  mesh('trough-inner', { woodDark: box }, root);
  mesh('trough-legs', { wood: mergeGeometries([leg(-0.42, -0.22), leg(0.42, -0.22), leg(-0.42, 0.22), leg(0.42, 0.22)]) }, root);
}

// ---------------------------------------------------------------------------
// 10. CARRETA DE MADERA (ruedas + caja)
// ---------------------------------------------------------------------------
function buildMedievalCart(ctx) {
  const { doc, mesh, place, scene, materials } = ctx;
  const root = doc.createNode('medieval-cart');
  scene.addChild(root);
  const bed = place(new THREE.BoxGeometry(1.2, 0.35, 0.7), { y: 0.7 });
  const sideL = place(new THREE.BoxGeometry(0.06, 0.45, 0.72), { x: -0.63, y: 0.925, z: 0 });
  const sideR = place(new THREE.BoxGeometry(0.06, 0.45, 0.72), { x: 0.63, y: 0.925, z: 0 });
  const front = place(new THREE.BoxGeometry(1.2, 0.45, 0.06), { x: 0, y: 0.925, z: -0.39 });
  const back = place(new THREE.BoxGeometry(1.2, 0.45, 0.06), { x: 0, y: 0.925, z: 0.39 });
  const axle = place(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 10), { y: 0.5, rx: Math.PI / 2 });
  const wheel = (x, z) => place(new THREE.CylinderGeometry(0.32, 0.32, 0.1, 16), { x, y: 0.5, z, rx: Math.PI / 2 });
  const hub = (x, z) => place(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 12), { x, y: 0.5, z, rx: Math.PI / 2 });
  mesh('cart-bed', { wood: bed }, root);
  mesh('cart-sides', { wood: mergeGeometries([sideL, sideR, front, back]) }, root);
  mesh('cart-wheels', { woodDark: mergeGeometries([wheel(-0.65, 0), wheel(0.65, 0), hub(-0.65, 0), hub(0.65, 0)]) }, root);
  mesh('cart-axle', { iron: axle }, root);
}

// ---------------------------------------------------------------------------
// Registro de piezas y generación de un GLB independiente por mueble
// ---------------------------------------------------------------------------
const pieces = [
  { id: 'medieval-chest', build: buildMedievalChest },
  { id: 'medieval-barrel', build: buildMedievalBarrel },
  { id: 'medieval-cauldron', build: buildMedievalCauldron },
  { id: 'medieval-banquet-table', build: buildMedievalBanquetTable },
  { id: 'medieval-throne', build: buildMedievalThrone },
  { id: 'medieval-lectern', build: buildMedievalLectern },
  { id: 'medieval-hay-bale', build: buildMedievalHayBale },
  { id: 'medieval-bench', build: buildMedievalBench },
  { id: 'medieval-feeding-trough', build: buildMedievalFeedingTrough },
  { id: 'medieval-cart', build: buildMedievalCart },
];

const ctxFactory = () => {
  const doc = new Document();
  const buf = doc.createBuffer('piece');
  const scene = doc.createScene('piece');
  const materials = buildMaterials(doc);
  const acc = buildAccessors(doc, buf);
  const mesh = buildMesh(doc, acc, materials);
  const place = buildPlace();
  return { doc, buf, scene, materials, acc, mesh, place };
};

(async () => {
  await mkdir(fileURLToPath(outDir), { recursive: true });
  for (const { id, build } of pieces) {
    const ctx = ctxFactory();
    build(ctx);
    const doc = ctx.doc;
    const assetPath = fileURLToPath(new URL(`${id}.glb`, outDir));
    await io.write(assetPath, doc);
    const bytes = await readFile(assetPath);
    console.log(`${id}.glb: ${bytes.length} bytes`);
  }
  console.log(`\nGenerados ${pieces.length} muebles medievales en ${outDir}`);
})();




