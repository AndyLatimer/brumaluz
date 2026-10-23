import { Document, NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = new URL('../src/assets/library/medieval-furniture/objects/', import.meta.url);
const texDir = new URL('../src/assets/library/medieval-furniture/textures/', import.meta.url);
const io = new NodeIO();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function writePNGChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(crcData), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, rgba) {
  const raw = new Uint8Array(width * height * 5);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * 4;
    const rawOffset = y * width * 5;
    raw[rawOffset] = 0;
    raw.set(rgba.subarray(rowOffset, rowOffset + width * 4), rawOffset + 1);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    writePNGChunk('IHDR', ihdr),
    writePNGChunk('IDAT', compressed),
    writePNGChunk('IEND', Buffer.alloc(0)),
  ]);
}

async function writeTexture(name, width, height, rgba) {
  await mkdir(fileURLToPath(texDir), { recursive: true });
  const png = encodePNG(width, height, rgba);
  const filePath = fileURLToPath(new URL(`${name}.png`, texDir));
  await writeFile(filePath, png);
  return `medieval-furniture/textures/${name}.png`;
}

function makeWoodTexture(w = 512, h = 512) {
  const rgba = new Uint8Array(w * h * 4);
  const base = [139, 90, 52];
  const grainDark = [92, 56, 32];
  const grainLight = [216, 183, 128];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const plank = (x % 120) < 105 ? 0 : 1;
      let noise = Math.sin(x * 0.03) * 0.5 + Math.sin(y * 0.02 + x * 0.01) * 0.3;
      noise += Math.sin(x * 0.1 + y * 0.05) * 0.2;
      let c = base.slice();
      if (plank === 1) c = c.map((v, k) => v * 0.85 + grainDark[k] * 0.15);
      const grain = Math.abs(Math.sin((x * 0.07 + y * 0.02) * (1 + noise))) > 0.85 ? 1 : 0;
      if (grain) c = c.map((v, k) => v * 0.7 + grainDark[k] * 0.3);
      const edge = Math.sin((x % 120) / 105 * Math.PI) > 0.95 ? 1 : 0;
      if (edge) c = c.map((v, k) => Math.min(255, v + grainLight[k] * 0.3));
      rgba[i] = c[0]; rgba[i+1] = c[1]; rgba[i+2] = c[2]; rgba[i+3] = 255;
    }
  }
  return rgba;
}

function makeWoodDarkTexture(w = 512, h = 512) {
  const rgba = new Uint8Array(w * h * 4);
  const base = [92, 56, 32];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const noise = Math.sin(x * 0.05) * 0.4 + Math.cos(y * 0.03) * 0.3;
      const c = base.map((v, k) => Math.min(255, Math.max(0, v + noise * 30)));
      rgba[i] = c[0]; rgba[i+1] = c[1]; rgba[i+2] = c[2]; rgba[i+3] = 255;
    }
  }
  return rgba;
}

function makeIronTexture(w = 512, h = 512) {
  const rgba = new Uint8Array(w * h * 4);
  const base = [107, 114, 128];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const noise = Math.sin(x * 0.1) * 0.3 + Math.cos(y * 0.08) * 0.2;
      let c = base.map((v, k) => Math.min(255, Math.max(0, v + noise * 40)));
      const rx = x % 60, ry = y % 60;
      const nearRivet = (rx > 25 && rx < 35 && ry > 25 && ry < 35) ? 0.4 : 0;
      c = c.map((v, k) => v * (1 - nearRivet) + 55 * nearRivet);
      rgba[i] = c[0]; rgba[i+1] = c[1]; rgba[i+2] = c[2]; rgba[i+3] = 255;
    }
  }
  return rgba;
}

function makeGoldTexture(w = 512, h = 512) {
  const rgba = new Uint8Array(w * h * 4);
  const base = [230, 180, 69];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const noise = Math.sin(x * 0.04 + y * 0.02) * 0.3;
      const shine = Math.abs(Math.sin(x * 0.02)) > 0.9 ? 0.3 : 0;
      const c = base.map((v, k) => Math.min(255, v + noise * 50 + shine * 60));
      rgba[i] = c[0]; rgba[i+1] = c[1]; rgba[i+2] = c[2]; rgba[i+3] = 255;
    }
  }
  return rgba;
}

function makeLeatherTexture(w = 512, h = 512) {
  const rgba = new Uint8Array(w * h * 4);
  const base = [166, 124, 82];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const noise = Math.sin(x * 0.03) * 0.25 + Math.cos(y * 0.04) * 0.2;
      const c = base.map((v, k) => Math.min(255, Math.max(0, v + noise * 35)));
      rgba[i] = c[0]; rgba[i+1] = c[1]; rgba[i+2] = c[2]; rgba[i+3] = 255;
    }
  }
  return rgba;
}

function makeStrawTexture(w = 512, h = 512) {
  const rgba = new Uint8Array(w * h * 4);
  const base = [233, 196, 106];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const noise = Math.sin(x * 0.08) * 0.3 + Math.sin(y * 0.05 + x * 0.02) * 0.2;
      const c = base.map((v, k) => Math.min(255, Math.max(0, v + noise * 45)));
      rgba[i] = c[0]; rgba[i+1] = c[1]; rgba[i+2] = c[2]; rgba[i+3] = 255;
    }
  }
  return rgba;
}

// ---------------------------------------------------------------------------
// Generar todas las texturas y devolver rutas relativas
// ---------------------------------------------------------------------------
async function generateTextures() {
  const tex = {};
  tex.wood = await writeTexture('wood', 512, 512, makeWoodTexture());
  tex.woodDark = await writeTexture('wood-dark', 512, 512, makeWoodDarkTexture());
  tex.iron = await writeTexture('iron', 512, 512, makeIronTexture());
  tex.gold = await writeTexture('gold', 512, 512, makeGoldTexture());
  tex.leather = await writeTexture('leather', 512, 512, makeLeatherTexture());
  tex.straw = await writeTexture('straw', 512, 512, makeStrawTexture());
  console.log('Texturas generadas:', Object.keys(tex).join(', '));
  return tex;
}

// ---------------------------------------------------------------------------
// Helper: crear material con textura
// ---------------------------------------------------------------------------
function createTexturedMaterial(doc, name, texPath, roughness = 0.7, metallic = 0.1) {
  const m = doc.createMaterial(name)
    .setRoughnessFactor(roughness)
    .setMetallicFactor(metallic);
  if (texPath) {
    const img = doc.createImage(name + '-tex').setMimeType('image/png');
    // Leer la textura desde disco y asignar al image
    const { readFile } = require('node:fs/promises');
    // Nota: se asignarán bytes después
    m.setBaseColorTexture(doc.createTexture(name + '-tex').setImage(img));
  }
  return m;
}

// ---------------------------------------------------------------------------
// UVs proyección tipo caja (box UV) para geometría procedural
// ---------------------------------------------------------------------------
function setUV(geometry, uvs) {
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geometry;
}

function boxUVs(geometry) {
  const pos = geometry.getAttribute('position');
  const count = pos.count;
  const uvs = new Float32Array(count * 2);
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const sizeX = maxX - minX, sizeZ = maxZ - minZ;
  for (let i = 0; i < count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // Usar las dos caras más grandes para UV (XY para top/bottom, XZ para sides)
    const u = ((x - minX) / sizeX) % 1;
    const v = ((z - minZ) / sizeZ) % 1;
    uvs[i*2] = u; uvs[i*2+1] = v;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geometry;
}

function mergeWithUVs(parts) {
  const geoms = Object.values(parts);
  const merged = mergeGeometries(geoms);
  return mergeVertices(merged.deleteAttribute('uv').deleteAttribute('normal'), 1e-4);
}

// ---------------------------------------------------------------------------
// 1. BAÚL MEDIEVAL - tablones, esquineros metálicos, asas, cerradura
// ---------------------------------------------------------------------------
function buildMedievalChest(ctx) {
  const { doc, mesh, place, scene, tex } = ctx;
  const root = doc.createNode('medieval-chest');
  scene.addChild(root);

  // Cuerpo principal: tablones de madera
  const body = place(new THREE.BoxGeometry(0.95, 0.55, 0.55), { y: 0.275 });
  boxUVs(body);
  const lid = place(new THREE.BoxGeometry(0.99, 0.09, 0.59), { y: 0.575 });
  boxUVs(lid);

  // Asienta el cuerpo un poco más bajo para que la tapa encaje
  body.translate(0, -0.02, 0);

  // Esquineros de hierro (8 esquinas)
  const corners = [];
  const cornerGeo = new THREE.BoxGeometry(0.04, 0.55, 0.04);
  boxUVs(cornerGeo);
  for (const sx of [-0.455, 0.455]) {
    for (const sz of [-0.265, 0.265]) {
      corners.push(place(cornerGeo.clone(), { x: sx, y: 0.275, z: sz }));
    }
  }
  // Esquinero superior (en la tapa)
  const topCorners = [];
  for (const sx of [-0.475, 0.475]) {
    for (const sz of [-0.285, 0.285]) {
      topCorners.push(place(new THREE.BoxGeometry(0.04, 0.09, 0.04).clone(), { x: sx, y: 0.575, z: sz }));
    }
  }

  // Asa central en frente
  const handle = place(new THREE.BoxGeometry(0.12, 0.18, 0.03), { x: 0, y: 0.42, z: 0.265 });
  boxUVs(handle);
  const handlePlate = place(new THREE.BoxGeometry(0.16, 0.05, 0.05), { x: 0, y: 0.345, z: 0.26 });
  boxUVs(handlePlate);

  // Cerradura en la tapa
  const lock = place(new THREE.BoxGeometry(0.08, 0.1, 0.06), { x: 0, y: 0.58, z: 0.28 });
  boxUVs(lock);
  const lockPlate = place(new THREE.BoxGeometry(0.14, 0.04, 0.1), { x: 0, y: 0.575, z: 0.28 });
  boxUVs(lockPlate);

  // Banda frontal
  const bandFront = place(new THREE.BoxGeometry(0.99, 0.04, 0.59), { y: 0.275 });
  boxUVs(bandFront);

  mesh('chest-body', { wood: body }, root);
  mesh('chest-lid', { wood: lid }, root);
  mesh('chest-corners', { iron: mergeGeometries([...corners, ...topCorners]) }, root);
  mesh('chest-handle', { iron: mergeGeometries([handle, handlePlate]) }, root);
  mesh('chest-lock', { iron: mergeGeometries([lock, lockPlate]) }, root);
  mesh('chest-band', { iron: bandFront }, root);
}

// ---------------------------------------------------------------------------
// 2. BARRIL DE MADERA - duelas, aros metálicos, tapas
// ---------------------------------------------------------------------------
function buildMedievalBarrel(ctx) {
  const { doc, mesh, place, scene, tex } = ctx;
  const root = doc.createNode('medieval-barrel');
  scene.addChild(root);

  // Cuerpo: lathe con barriga pronunciada
  const profile = [
    [0, 0], [0.34, 0.03], [0.43, 0.18], [0.47, 0.45], [0.45, 0.72], [0.41, 0.9], [0, 0.93],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const barrel = new THREE.LatheGeometry(profile, 32);
  // UVs para lathe: u = ángulo, v = altura
  const pos = barrel.getAttribute('position');
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i);
    const angle = Math.atan2(z, x) / (Math.PI * 2) + 0.5;
    uvs[i*2] = angle; uvs[i*2+1] = y / 0.93;
  }
  barrel.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  barrel.computeVertexNormals();

  // Tapas superior e inferior
  const top = place(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 32), { y: 0.93 });
  boxUVs(top);
  const bottom = place(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 32), { y: 0 });
  boxUVs(bottom);

  // Aros de hierro (3)
  const hoops = [];
  for (const y of [0.12, 0.465, 0.81]) {
    hoops.push(place(new THREE.TorusGeometry(0.5, 0.02, 16, 40), { y, rx: Math.PI / 2 }));
  }

  // Orificio de tapón (bung)
  const bung = place(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 12), { x: 0.43, y: 0.465, z: 0, rz: Math.PI / 4 });

  mesh('barrel-body', { wood: barrel }, root);
  mesh('barrel-caps', { woodDark: mergeGeometries([top, bottom]) }, root);
  mesh('barrel-hoops', { iron: mergeGeometries(hoops) }, root);
  mesh('barrel-bung', { wood: bung }, root);
}

// ---------------------------------------------------------------------------
// 3. CALDERO - caldero de hierro con tres patas, asa y remaches
// ---------------------------------------------------------------------------
function buildMedievalCauldron(ctx) {
  const { doc, mesh, place, scene, tex } = ctx;
  const root = doc.createNode('medieval-cauldron');
  scene.addChild(root);

  // Cuerpo del caldero: más ancho abajo, estrecho arriba
  const potProfile = [
    [0.28, 0], [0.4, 0.1], [0.48, 0.3], [0.5, 0.4], [0.48, 0.5], [0.52, 0.52], [0, 0.52],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const pot = new THREE.LatheGeometry(potProfile, 24);
  const pPos = pot.getAttribute('position');
  const pUvs = new Float32Array(pPos.count * 2);
  for (let i = 0; i < pPos.count; i++) {
    const x = pPos.getX(i), z = pPos.getZ(i), y = pPos.getY(i);
    const angle = Math.atan2(z, x) / (Math.PI * 2) + 0.5;
    pUvs[i*2] = angle; pUvs[i*2+1] = y / 0.52;
  }
  pot.setAttribute('uv', new THREE.BufferAttribute(pUvs, 2));
  pot.computeVertexNormals();

  // Borde superior reforzado
  const rim = place(new THREE.TorusGeometry(0.54, 0.025, 16, 32), { y: 0.52, rx: Math.PI / 2 });
  boxUVs(rim);

  // Asa de hierro en los lados
  const handle1 = place(new THREE.TorusGeometry(0.18, 0.02, 8, 16), { x: -0.5, y: 0.35, z: 0, rx: Math.PI / 2 });
  const handle2 = place(new THREE.TorusGeometry(0.18, 0.02, 8, 16), { x: 0.5, y: 0.35, z: 0, rx: Math.PI / 2 });

  // Tres patas cónicas
  const legs = [];
  for (let i = 0; i < 3; i++) {
    const angle = i * 2 * Math.PI / 3;
    const x = Math.cos(angle) * 0.35;
    const z = Math.sin(angle) * 0.35;
    const leg = new THREE.CylinderGeometry(0.035, 0.015, 0.45, 10);
    const lPos = leg.getAttribute('position');
    const lUvs = new Float32Array(lPos.count * 2);
    for (let j = 0; j < lPos.count; j++) {
      const yy = lPos.getY(j);
      lUvs[j*2] = 0.5; lUvs[j*2+1] = yy / 0.45;
    }
    setUV(leg, lUvs);
    leg.computeVertexNormals();
    legs.push(place(leg, { x, y: 0.225, z, ry: angle }));
  }

  mesh('cauldron-pot', { ironDark: pot }, root);
  mesh('cauldron-rim', { iron: rim }, root);
  mesh('cauldron-handle-L', { iron: handle1 }, root);
  mesh('cauldron-handle-R', { iron: handle2 }, root);
  for (let i = 0; i < legs.length; i++) mesh(`cauldron-leg-${i}`, { iron: legs[i] }, root);
}

// ---------------------------------------------------------------------------
// 4. MESA DE BANQUETE - tablero grueso, patas con travesaños y listones
// ---------------------------------------------------------------------------
function buildMedievalBanquetTable(ctx) {
  const { doc, mesh, place, scene, tex } = ctx;
  const root = doc.createNode('medieval-banquet-table');
  scene.addChild(root);

  // Tablero grueso de tablones
  const top = place(new THREE.BoxGeometry(2.6, 0.8, 0.14), { y: 0.82 });
  boxUVs(top);

  // Patas macizas con ligera caída (splayed legs)
  const legGeo = new THREE.CylinderGeometry(0.1, 0.13, 0.8, 12);
  const lPos = legGeo.getAttribute('position');
  const lUvs = new Float32Array(lPos.count * 2);
  for (let i = 0; i < lPos.count; i++) {
    lUvs[i*2] = 0.5; lUvs[i*2+1] = lPos.getY(i) / 0.8;
  }
  setUV(legGeo, lUvs);
  legGeo.computeVertexNormals();

  const legs = [];
  const legPositions = [
    [-1.1, -0.3], [1.1, -0.3], [-1.1, 0.3], [1.1, 0.3],
  ];
  for (const [lx, lz] of legPositions) {
    legs.push(place(legGeo.clone(), { x: lx, y: 0.4, z: lz, rx: 0.05 })); // ligera caída hacia fuera
  }

  // Travesaños entre patas
  const stretcherX = place(new THREE.BoxGeometry(2.1, 0.05, 0.05), { y: 0.15 });
  boxUVs(stretcherX);
  const stretcherZ = place(new THREE.BoxGeometry(0.05, 0.05, 0.6), { y: 0.15 });
  boxUVs(stretcherZ);

  // Listón decorativo en el borde del tablero
  const edgeTrim = place(new THREE.BoxGeometry(2.62, 0.84, 0.02), { y: 0.82, z: -0.41 });
  boxUVs(edgeTrim);
  const edgeTrim2 = place(new THREE.BoxGeometry(2.62, 0.84, 0.02), { y: 0.82, z: 0.41 });
  boxUVs(edgeTrim2);
  const edgeTrim3 = place(new THREE.BoxGeometry(0.02, 0.84, 0.82), { y: 0.82, x: -1.31 });
  boxUVs(edgeTrim3);
  const edgeTrim4 = place(new THREE.BoxGeometry(0.02, 0.84, 0.82), { y: 0.82, x: 1.31 });
  boxUVs(edgeTrim4);

  mesh('table-top', { wood: top }, root);
  mesh('table-legs', { wood: mergeGeometries(legs) }, root);
  mesh('table-stretchers', { woodDark: mergeGeometries([stretcherX, stretcherZ]) }, root);
  mesh('table-trim', { woodDark: mergeGeometries([edgeTrim, edgeTrim2, edgeTrim3, edgeTrim4]) }, root);
}

// ---------------------------------------------------------------------------
// 5. TRONO - respaldo alto, brazos, tallado dorado, cojín
// ---------------------------------------------------------------------------
function buildMedievalThrone(ctx) {
  const { doc, mesh, place, scene, tex } = ctx;
  const root = doc.createNode('medieval-throne');
  scene.addChild(root);

  // Asiento con cojín de cuero
  const seat = place(new THREE.BoxGeometry(0.75, 0.1, 0.6), { y: 0.55 });
  boxUVs(seat);
  const cushion = place(new THREE.BoxGeometry(0.65, 0.04, 0.5), { y: 0.61 });
  boxUVs(cushion);

  // Respaldo alto con curvatura
  const backProfile = [
    [0, 0], [0.32, 0.05], [0.35, 0.5], [0.32, 0.95], [0, 1.0],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const back = new THREE.LatheGeometry(backProfile, 16);
  const bPos = back.getAttribute('position');
  const bUvs = new Float32Array(bPos.count * 2);
  for (let i = 0; i < bPos.count; i++) {
    const x = bPos.getX(i), z = bPos.getZ(i), y = bPos.getY(i);
    const angle = Math.atan2(z, x) / (Math.PI * 2) + 0.5;
    bUvs[i*2] = angle; bUvs[i*2+1] = y;
  }
  setUV(back, bUvs);
  back.computeVertexNormals();
  // Mover el respaldo atrás y arriba
  back.translate(0, 0.55, -0.15);

  // Patas delanteras y traseras
  const legGeo = new THREE.BoxGeometry(0.07, 0.55, 0.07);
  boxUVs(legGeo);
  const legs = [];
  for (const x of [-0.3, 0.3]) {
    for (const z of [-0.22, 0.22]) {
      legs.push(place(legGeo.clone(), { x, y: 0.275, z }));
    }
  }

  // Brazos reposabrazos
  const armL = place(new THREE.BoxGeometry(0.12, 0.06, 0.5), { x: -0.36, y: 0.7, z: 0 });
  boxUVs(armL);
  const armR = place(new THREE.BoxGeometry(0.12, 0.06, 0.5), { x: 0.36, y: 0.7, z: 0 });
  boxUVs(armR);

  // Tallado dorado en el centro del respaldo
  const carving = place(new THREE.BoxGeometry(0.35, 0.35, 0.03), { y: 1.05, z: -0.17 });
  boxUVs(carving);

  // Esquineros de hierro en patas traseras
  const ironCorner = place(new THREE.BoxGeometry(0.05, 0.1, 0.05), { x: 0.3, y: 0.85, z: -0.22 });
  boxUVs(ironCorner);
  const ironCorner2 = place(new THREE.BoxGeometry(0.05, 0.1, 0.05), { x: -0.3, y: 0.85, z: -0.22 });
  boxUVs(ironCorner2);

  mesh('throne-seat', { wood: seat }, root);
  mesh('throne-cushion', { leather: cushion }, root);
  mesh('throne-back', { wood: back }, root);
  mesh('throne-legs', { wood: mergeGeometries(legs) }, root);
  mesh('throne-arms', { wood: mergeGeometries([armL, armR]) }, root);
  mesh('throne-carving', { gold: carving }, root);
  mesh('throne-iron', { iron: mergeGeometries([ironCorner, ironCorner2]) }, root);
}

// ---------------------------------------------------------------------------
// 6. ATRIL - superficie inclinada, base sólida, listón frontal
// ---------------------------------------------------------------------------
function buildMedievalLectern(ctx) {
  const { doc, mesh, place, scene, tex } = ctx;
  const root = doc.createNode('medieval-lectern');
  scene.addChild(root);

  // Base maciza
  const base = place(new THREE.BoxGeometry(0.5, 0.14, 0.5), { y: 0.07 });
  boxUVs(base);

  // Poste central
  const post = place(new THREE.BoxGeometry(0.1, 1.0, 0.1), { y: 0.62 });
  boxUVs(post);

  // Superficie inclinada (atril)
  const topShape = new THREE.Shape();
  topShape.moveTo(-0.28, 0); topShape.lineTo(0.28, 0);
  topShape.lineTo(0.22, -0.45); topShape.lineTo(-0.22, -0.45);
  topShape.closePath();
  const extrude = { depth: 0.06, bevelEnabled: false };
  const topGeo = new THREE.ExtrudeGeometry(topShape, extrude);
  boxUVs(topGeo);
  const top = place(topGeo, { y: 1.18, z: -0.18, rx: -0.35 });
  top.rotateX(-0.35);

  // Listón frontal para evitar que los libros se caigan
  const lip = place(new THREE.BoxGeometry(0.56, 0.05, 0.08), { y: 1.18, z: -0.39 });
  boxUVs(lip);

  // Estante inferior
  const shelf = place(new THREE.BoxGeometry(0.4, 0.04, 0.4), { y: 0.25 });
  boxUVs(shelf);

  mesh('lectern-base', { wood: base }, root);
  mesh('lectern-post', { wood: post }, root);
  mesh('lectern-top', { wood: top }, root);
  mesh('lectern-lip', { woodDark: lip }, root);
  mesh('lectern-shelf', { woodDark: shelf }, root);
}

// ---------------------------------------------------------------------------
// 7. PACA DE HENO - forma irregular, hebras de paja sobresalientes
// ---------------------------------------------------------------------------
function buildMedievalHayBale(ctx) {
  const { doc, mesh, place, scene, tex } = ctx;
  const root = doc.createNode('medieval-hay-bale');
  scene.addChild(root);

  // Cuerpo principal ligeramente irregular
  const bale = place(new THREE.BoxGeometry(0.95, 0.55, 0.95), { y: 0.275 });
  boxUVs(bale);

  // Hebras de paja alrededor
  const strands = [];
  for (let i = 0; i < 20; i++) {
    const angle = (i / 20) * Math.PI * 2;
    const r = 0.42 + Math.sin(i * 1.3) * 0.05;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const y = 0.275 + Math.sin(i * 2.1) * 0.1;
    const strand = place(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 5), { x, y, z });
    strand.rotateZ(angle);
    strand.rotateX(Math.PI / 2 + Math.sin(i) * 0.3);
    strands.push(strand);
  }

  // Hebras en la parte superior
  const topStrands = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const x = Math.cos(angle) * 0.38;
    const z = Math.sin(angle) * 0.38;
    const strand = place(new THREE.CylinderGeometry(0.018, 0.018, 0.2, 5), { x, y: 0.58, z });
    strand.rotateX(Math.PI / 2);
    topStrands.push(strand);
  }

  mesh('hay-bale', { straw: mergeGeometries([bale, ...strands, ...topStrands]) }, root);
}

// ---------------------------------------------------------------------------
// 8. BANCO DE MADERA - patas abiertas, travesaño central
// ---------------------------------------------------------------------------
function buildMedievalBench(ctx) {
  const { doc, mesh, place, scene } = ctx;
  const root = doc.createNode('medieval-bench');
  scene.addChild(root);
  const seat = place(new THREE.BoxGeometry(1.5, 0.1, 0.4), { y: 0.5 });
  boxUVs(seat);
  const legGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.46, 10);
  const lPos = legGeo.getAttribute('position');
  const lUvs = new Float32Array(lPos.count * 2);
  for (let i = 0; i < lPos.count; i++) { lUvs[i*2]=0.5; lUvs[i*2+1]=lPos.getY(i)/0.46; }
  setUV(legGeo, lUvs); legGeo.computeVertexNormals();
  const legs = [];
  for (const x of [-0.68, 0.68]) for (const z of [-0.16, 0.16]) {
    legs.push(place(legGeo.clone(), { x, y: 0.23, z, rx: x > 0 ? 0.08 : -0.08 }));
  }
  const support = place(new THREE.BoxGeometry(1.3, 0.05, 0.05), { y: 0.23 }); boxUVs(support);
  const backSlat = place(new THREE.BoxGeometry(1.4, 0.25, 0.03), { y: 0.7, z: -0.185 }); boxUVs(backSlat);
  mesh('bench-seat', { wood: seat }, root);
  mesh('bench-legs', { wood: mergeGeometries(legs) }, root);
  mesh('bench-support', { woodDark: support }, root);
  mesh('bench-back', { woodDark: backSlat }, root);
}

// ---------------------------------------------------------------------------
// 9. COMEDERO DE ANIMALES - tablones, patas, borde reforzado
// ---------------------------------------------------------------------------
function buildMedievalFeedingTrough(ctx) {
  const { doc, mesh, place, scene } = ctx;
  const root = doc.createNode('medieval-feeding-trough');
  scene.addChild(root);
  const outer = place(new THREE.BoxGeometry(1.1, 0.45, 0.55), { y: 0.225 }); boxUVs(outer);
  const inner = place(new THREE.BoxGeometry(0.98, 0.38, 0.43), { y: 0.225 }); boxUVs(inner);
  const rim = place(new THREE.BoxGeometry(1.12, 0.05, 0.57), { y: 0.45 }); boxUVs(rim);
  const legGeo = new THREE.BoxGeometry(0.07, 0.42, 0.07); boxUVs(legGeo);
  const legs = [];
  for (const x of [-0.48, 0.48]) for (const z of [-0.22, 0.22]) legs.push(place(legGeo.clone(), { x, y: 0.21, z }));
  const stretcherX = place(new THREE.BoxGeometry(0.95, 0.04, 0.04), { y: 0.15 }); boxUVs(stretcherX);
  const stretcherZ = place(new THREE.BoxGeometry(0.04, 0.04, 0.4), { y: 0.15 }); boxUVs(stretcherZ);
  mesh('trough-outer', { wood: outer }, root);
  mesh('trough-inner', { woodDark: inner }, root);
  mesh('trough-rim', { woodDark: rim }, root);
  mesh('trough-legs', { wood: mergeGeometries(legs) }, root);
  mesh('trough-stretchers', { woodDark: mergeGeometries([stretcherX, stretcherZ]) }, root);
}

// ---------------------------------------------------------------------------
// 10. CARRETA DE MADERA - ruedas con radios, caja, eje de hierro
// ---------------------------------------------------------------------------
function buildMedievalCart(ctx) {
  const { doc, mesh, place, scene } = ctx;
  const root = doc.createNode('medieval-cart');
  scene.addChild(root);
  const bed = place(new THREE.BoxGeometry(1.3, 0.4, 0.75), { y: 0.75 }); boxUVs(bed);
  const sideL = place(new THREE.BoxGeometry(0.07, 0.5, 0.77), { x: -0.65, y: 1.0, z: 0 }); boxUVs(sideL);
  const sideR = place(new THREE.BoxGeometry(0.07, 0.5, 0.77), { x: 0.65, y: 1.0, z: 0 }); boxUVs(sideR);
  const front = place(new THREE.BoxGeometry(1.3, 0.5, 0.07), { x: 0, y: 1.0, z: -0.41 }); boxUVs(front);
  const back = place(new THREE.BoxGeometry(1.3, 0.5, 0.07), { x: 0, y: 1.0, z: 0.41 }); boxUVs(back);
  const makeWheel = () => {
    const wheel = new THREE.CylinderGeometry(0.35, 0.35, 0.12, 16);
    const wPos = wheel.getAttribute('position');
    const wUvs = new Float32Array(wPos.count * 2);
    for (let i = 0; i < wPos.count; i++) { const x = wPos.getX(i), z = wPos.getZ(i); const angle = Math.atan2(z, x) / (Math.PI * 2) + 0.5; wUvs[i*2]=angle; wUvs[i*2+1]=0.5; }
    setUV(wheel, wUvs); wheel.computeVertexNormals(); return wheel;
  };
  const spokes = [];
  for (let i = 0; i < 8; i++) { const angle = i * Math.PI / 4; spokes.push(place(new THREE.BoxGeometry(0.025, 0.32, 0.025), { x: Math.cos(angle)*0.16, z: Math.sin(angle)*0.16, y: 0.5 })); }
  const wheels = [], hubs = [];
  for (const x of [-0.72, 0.72]) {
    wheels.push(place(makeWheel(), { x, y: 0.5, z: 0, rx: Math.PI / 2 }));
    hubs.push(place(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 12), { x, y: 0.5, z: 0, rx: Math.PI / 2 }));
  }
  const axle = place(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8), { y: 0.5, rx: Math.PI / 2 }); boxUVs(axle);
  const pole = place(new THREE.BoxGeometry(0.08, 0.08, 0.7), { x: 0, y: 0.85, z: -0.8 }); boxUVs(pole);
  mesh('cart-bed', { wood: bed }, root);
  mesh('cart-sides', { wood: mergeGeometries([sideL, sideR, front, back]) }, root);
  mesh('cart-wheels', { woodDark: mergeGeometries([...wheels, ...spokes]) }, root);
  mesh('cart-hubs', { iron: mergeGeometries(hubs) }, root);
  mesh('cart-axle', { iron: axle }, root);
  mesh('cart-pole', { wood: pole }, root);
}

// ---------------------------------------------------------------------------
// Registro y generación de un GLB independiente por mueble
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

const ctxFactory = (tex) => {
  const doc = new Document();
  const buf = doc.createBuffer('piece');
  const scene = doc.createScene('piece');
  const materials = new Map();
  const matDef = [
    ['wood', tex.wood, 0.8, 0.05],
    ['woodDark', tex.woodDark, 0.8, 0.05],
    ['iron', tex.iron, 0.5, 0.7],
    ['ironDark', tex.iron, 0.4, 0.8],
    ['gold', tex.gold, 0.3, 0.9],
    ['leather', tex.leather, 0.9, 0.1],
    ['straw', tex.straw, 0.95, 0],
  ];
  for (const [name, texPath, rough, met] of matDef) {
    const m = doc.createMaterial(name).setRoughnessFactor(rough).setMetallicFactor(met);
    // Leer bytes del archivo de textura
    const filePath = path.join(root, 'src', 'assets', 'library', texPath);
    const imgBytes = readFileSync(filePath);
    const texObj = doc.createTexture(name + '-tex').setMimeType('image/png').setImage(imgBytes);
    m.setBaseColorTexture(texObj);
    materials.set(name, m);
  }
  const acc = (name, array, type) => doc.createAccessor(name).setType(type).setArray(array).setBuffer(buf);
  const mesh = (name, parts, parent) => {
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
  const place = (geometry, t = {}) => geometry.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(t.x ?? 0, t.y ?? 0, t.z ?? 0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(t.rx ?? 0, t.ry ?? 0, t.rz ?? 0)),
    new THREE.Vector3(t.s ?? 1, t.s ?? 1, t.s ?? 1)
  ));
  return { doc, buf, scene, materials, acc, mesh, place };
};

(async () => {
  const tex = await generateTextures();
  await mkdir(fileURLToPath(outDir), { recursive: true });
  const entries = [];
  for (const { id, build } of pieces) {
    const ctx = ctxFactory(tex);
    build(ctx);
    const doc = ctx.doc;
    const assetPath = fileURLToPath(new URL(`${id}.glb`, outDir));
    await io.write(assetPath, doc);
    const bytes = await readFile(assetPath);
    console.log(`${id}.glb: ${bytes.length} bytes`);
    entries.push({ id, path: `medieval-furniture/objects/${id}.glb`, bytes: bytes.length });
  }
  // Escribir archivo de entradas para actualizar catálogo
  await writeFile('./medieval-furniture-entries-v2.json', JSON.stringify(entries, null, 2));
  console.log(`\nGenerados ${pieces.length} muebles medievales con texturas en ${outDir}`);
})();
