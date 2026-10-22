import { Document, NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

// Puente de madera troceado, al estilo de los props originales (scripts/build-props.mjs):
// el GLB es el asset de intercambio editable en Blender (Archivo > Importar > glTF 2.0).
// Medidas en metros, con el maniqui humano (1,55 m) como referencia:
// tablero de 4,0 x 1,6 m a 0,50 m del suelo, barandilla hasta 0,95 m sobre el tablero.
const outFile = path.join(fileURLToPath(new URL('..', import.meta.url)),
  'src', 'assets', 'models', 'props', 'wooden-bridge.glb');

const doc = new Document();
const buffer = doc.createBuffer('WoodenBridge');
const scene = doc.createScene('wooden-bridge');

/* Generador de PNG en memoria */
const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
function chunk(type, data) {
  const len = new DataView(new ArrayBuffer(4)); len.setUint32(0, data.byteLength, false);
  const typeBytes = new TextEncoder().encode(type);
  const crcData = new Uint8Array(typeBytes.length + data.byteLength);
  crcData.set(typeBytes); crcData.set(data, typeBytes.length);
  const crc = crc32(crcData); const crcBytes = new DataView(new ArrayBuffer(4));
  crcBytes.setUint32(0, crc >>> 0, false);
  return new Uint8Array([...new Uint8Array(len.buffer), ...typeBytes, ...data, ...new Uint8Array(crcBytes.buffer)]);
}
function crc32(data) { let crc = 0xFFFFFFFF; for (let i = 0; i < data.length; i++) { crc ^= data[i]; for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1)); } return (crc ^ 0xFFFFFFFF) >>> 0; }
function writePNG(width, height, rgba) {
  const rowBytes = width * 4; const rawLen = height * (1 + rowBytes); const raw = new Uint8Array(rawLen); let offset = 0;
  for (let y = 0; y < height; y++) { raw[offset++] = 0; raw.set(rgba.subarray(y * rowBytes, (y + 1) * rowBytes), offset); offset += rowBytes; }
  const idat = deflateSync(raw); const ihdrData = new Uint8Array(13); const ihdrView = new DataView(ihdrData.buffer);
  ihdrView.setUint32(0, width, false); ihdrView.setUint32(4, height, false); ihdrData[8] = 8; ihdrData[9] = 6; ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;
  const chunks = [chunk('IHDR', ihdrData), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))];
  const total = PNG_SIGNATURE.byteLength + chunks.reduce((s, c) => s + c.byteLength, 0); const out = new Uint8Array(total); let o = 0;
  out.set(PNG_SIGNATURE, o); o += PNG_SIGNATURE.byteLength; for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  return out;
}
/* Texturas PBR */
const SIZE = 512;
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 8) / 16777216; }; };

function makeWoodTexture() {
  const rand = rng(2);
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let i = 0; i < data.length; i += 4) {
    const tone = 135 + rand() * 50;
    const v = Math.min(255, Math.max(0, tone + (rand() - 0.5) * 40));
    data[i] = v;
    data[i + 1] = Math.min(255, Math.max(0, v * 0.75));
    data[i + 2] = Math.min(255, Math.max(0, v * 0.55));
    data[i + 3] = 255;
  }
  for (let x = 0; x < SIZE; x += 3 + Math.floor(rng(3)() * 4)) {
    const w = 1 + Math.floor(rng(4)() * 2);
    for (let dx = 0; dx < w && x + dx < SIZE; dx++) {
      for (let y = 0; y < SIZE; y++) {
        const idx = ((y * SIZE) + (x + dx)) * 4;
        data[idx] *= 0.55;
        data[idx + 1] *= 0.45;
        data[idx + 2] *= 0.35;
      }
    }
  }
  return writePNG(SIZE, SIZE, data);
}

function makeWoodDarkTexture() {
  const rand = rng(7);
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let i = 0; i < data.length; i += 4) {
    const tone = 85 + rand() * 30;
    const v = Math.min(255, Math.max(0, tone + (rand() - 0.5) * 25));
    data[i] = v;
    data[i + 1] = Math.min(255, Math.max(0, v * 0.65));
    data[i + 2] = Math.min(255, Math.max(0, v * 0.45));
    data[i + 3] = 255;
  }
  for (let x = 0; x < SIZE; x += 4 + Math.floor(rng(8)() * 3)) {
    const w = 1 + Math.floor(rng(9)() * 2);
    for (let dx = 0; dx < w && x + dx < SIZE; dx++) {
      for (let y = 0; y < SIZE; y++) {
        const idx = ((y * SIZE) + (x + dx)) * 4;
        data[idx] *= 0.5;
        data[idx + 1] *= 0.4;
        data[idx + 2] *= 0.3;
      }
    }
  }
  return writePNG(SIZE, SIZE, data);
}

function makeStoneTexture() {
  const rand = rng(11);
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let i = 0; i < data.length; i += 4) {
    const base = 140 + rand() * 35;
    const v = Math.min(255, Math.max(0, base + (rand() - 0.5) * 30));
    data[i] = v;
    data[i + 1] = Math.min(255, Math.max(0, v * 0.9));
    data[i + 2] = Math.min(255, Math.max(0, v * 0.8));
    data[i + 3] = 255;
  }
  return writePNG(SIZE, SIZE, data);
}

function makeMetallicRoughnessTexture(metallic, roughness, variation) {
  const rand = rng(13);
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let i = 0; i < data.length; i += 4) {
    const r = Math.min(255, Math.max(0, metallic + (rand() - 0.5) * variation * 60));
    const g = Math.min(255, Math.max(0, roughness + (rand() - 0.5) * variation * 255));
    data[i] = 255;
    data[i + 1] = g;
    data[i + 2] = r;
    data[i + 3] = 255;
  }
  return writePNG(SIZE, SIZE, data);
}

const textures = {};
const materialBuffers = {
  'bridge-wood-base': makeWoodTexture(),
  'bridge-wood-dark-base': makeWoodDarkTexture(),
  'bridge-stone-base': makeStoneTexture(),
  'bridge-wood-metallicRoughness': makeMetallicRoughnessTexture(5, 170, 0.3),
  'bridge-stone-metallicRoughness': makeMetallicRoughnessTexture(10, 140, 0.2),
};

for (const [name, pngData] of Object.entries(materialBuffers)) {
  const tex = doc.createTexture(name).setImage(pngData).setMimeType('image/png');
  textures[name] = tex;
}

const materials = new Map([
  ['wood', doc.createMaterial('wood').setBaseColorTexture(textures['bridge-wood-base']).setMetallicRoughnessTexture(textures['bridge-wood-metallicRoughness']).setMetallicFactor(0.05).setRoughnessFactor(0.75)],
  ['woodDark', doc.createMaterial('woodDark').setBaseColorTexture(textures['bridge-wood-dark-base']).setMetallicRoughnessTexture(textures['bridge-wood-metallicRoughness']).setMetallicFactor(0.05).setRoughnessFactor(0.80)],
  ['stone', doc.createMaterial('stone').setBaseColorTexture(textures['bridge-stone-base']).setMetallicRoughnessTexture(textures['bridge-stone-metallicRoughness']).setMetallicFactor(0.02).setRoughnessFactor(0.85)],
]);

const acc = (name, array, type) => doc.createAccessor(name).setType(type).setArray(array).setBuffer(buffer);
/**
 * Reproyecta las UVs en escala de mundo (una repetición por metro) usando la
 * cara dominante de cada normal, para que la veta de la madera y la textura de
 * la piedra encajen con el tamaño real de la pieza y no se estiren.
 */
function projectUV(geometry, scale = 1) {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const nx = Math.abs(normal.getX(i)), ny = Math.abs(normal.getY(i)), nz = Math.abs(normal.getZ(i));
    let u, v;
    if (ny >= nx && ny >= nz) { u = x; v = z; }        // horizontal
    else if (nx >= nz) { u = z; v = y; }                // laterales en X
    else { u = x; v = y; }                             // laterales en Z
    uv[i * 2] = u * scale;
    uv[i * 2 + 1] = v * scale;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function mesh(name, parts, parent) {
  const output = doc.createMesh(name);
  for (const [material, geometry] of Object.entries(parts)) {
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    projectUV(geometry, material === 'stone' ? 0.6 : 1.1);
    const merged = mergeVertices(geometry.deleteAttribute('normal'), 1e-4);
    merged.computeVertexNormals();
    output.addPrimitive(doc.createPrimitive()
      .setAttribute('POSITION', acc(`${name}:${material}:position`, Float32Array.from(merged.getAttribute('position').array), 'VEC3'))
      .setAttribute('NORMAL', acc(`${name}:${material}:normal`, Float32Array.from(merged.getAttribute('normal').array), 'VEC3'))
      .setAttribute('TEXCOORD_0', acc(`${name}:${material}:uv`, Float32Array.from(merged.getAttribute('uv').array), 'VEC2'))
      .setIndices(acc(`${name}:${material}:indices`, Uint16Array.from(merged.index.array), 'SCALAR'))
      .setMaterial(materials.get(material)));
    geometry.dispose(); merged.dispose();
  }
  parent.addChild(doc.createNode(name).setMesh(output));
}

/** Viga entre dos puntos, para patas y tirantes inclinados. */
function beam(p1, p2, width, height = width) {
  const direction = new THREE.Vector3().copy(p2).sub(p1);
  const length = direction.length();
  const geometry = new THREE.BoxGeometry(length, height, width, Math.max(2, Math.floor(length / 0.2)), 2, 2);
  const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction.clone().normalize());
  geometry.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3().copy(p1).addScaledVector(direction, 0.5), rotation, new THREE.Vector3(1, 1, 1)));
  return geometry;
}

const DECK = { length: 4.0, width: 1.6, thick: 0.08, top: 0.50 };
const UNDER = DECK.top - DECK.thick;
const RAIL = { height: 0.95, post: 0.08, offset: DECK.width / 2 - 0.06 };

/** Tablero de tablas atravesadas, con juntas y algo de espesor en los bordes. */
function deck() {
  const count = 16, plank = 0.26, gap = 0.035;
  const total = count * plank + (count - 1) * gap;
  const parts = [];
  for (let i = 0; i < count; i++) {
    const x = -total / 2 + plank / 2 + i * (plank + gap);
    const board = new THREE.BoxGeometry(plank, DECK.thick, DECK.width);
    board.translate(x, DECK.top - DECK.thick / 2 + (i % 3 === 0 ? 0.005 : 0), 0);
    parts.push(board);
  }
  const fascia = new THREE.BoxGeometry(DECK.length, 0.05, DECK.width + 0.04);
  fascia.translate(0, DECK.top - DECK.thick - 0.025, 0);
  parts.push(fascia);
  return mergeGeometries(parts, 1e-4);
}

/** Vigas longitudinales (stringers) que sostienen el tablero. */
function stringers() {
  const parts = [];
  for (const sign of [-1, 1]) {
    const girder = new THREE.BoxGeometry(DECK.length, 0.16, 0.12, 8, 2, 2);
    girder.translate(0, UNDER - 0.08, sign * (DECK.width / 2 - 0.18));
    parts.push(girder);
  }
  const center = new THREE.BoxGeometry(DECK.length, 0.10, 0.08, 8, 2, 2);
  center.translate(0, UNDER - 0.18, 0);
  parts.push(center);
  return mergeGeometries(parts, 1e-4);
}
/** Pila de madera: cuatro patas, travesaños, cruces de San Andrés y refuerzos. */
function trestle(centerX) {
  const parts = [];
  const legTop = UNDER - 0.16;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push(beam(
        new THREE.Vector3(centerX + sx * 0.22, 0, sz * 0.70),
        new THREE.Vector3(centerX + sx * 0.16, legTop, sz * 0.70), 0.11));
    }
  }
  parts.push(beam(new THREE.Vector3(centerX, legTop, -0.75), new THREE.Vector3(centerX, legTop, 0.75), 0.14, 0.14));
  parts.push(beam(new THREE.Vector3(centerX, 0.12, -0.75), new THREE.Vector3(centerX, 0.12, 0.75), 0.10, 0.10));
  parts.push(beam(new THREE.Vector3(centerX, (legTop + 0.12) / 2, -0.60), new THREE.Vector3(centerX, (legTop + 0.12) / 2, 0.60), 0.09, 0.09));
  for (const sz of [-1, 1]) {
    parts.push(beam(new THREE.Vector3(centerX - 0.18, 0.16, sz * 0.70), new THREE.Vector3(centerX + 0.18, legTop - 0.04, sz * 0.70), 0.08, 0.08));
    parts.push(beam(new THREE.Vector3(centerX + 0.18, 0.16, sz * 0.70), new THREE.Vector3(centerX - 0.18, legTop - 0.04, sz * 0.70), 0.08, 0.08));
  }
  parts.push(beam(new THREE.Vector3(centerX - 0.16, legTop - 0.04, -0.60), new THREE.Vector3(centerX, 0.20, -0.60), 0.07, 0.07));
  parts.push(beam(new THREE.Vector3(centerX + 0.16, legTop - 0.04, -0.60), new THREE.Vector3(centerX, 0.20, -0.60), 0.07, 0.07));
  parts.push(beam(new THREE.Vector3(centerX - 0.16, legTop - 0.04, 0.60), new THREE.Vector3(centerX, 0.20, 0.60), 0.07, 0.07));
  parts.push(beam(new THREE.Vector3(centerX + 0.16, legTop - 0.04, 0.60), new THREE.Vector3(centerX, 0.20, 0.60), 0.07, 0.07));
  return mergeGeometries(parts, 1e-4);
}

/** Barandilla: montantes, travesaños superiores e inferiores, y refuerzo central. */
function railings() {
  const parts = [];
  const postTop = DECK.top + RAIL.height;
  for (const sign of [-1, 1]) {
    const z = sign * RAIL.offset;
    for (const x of [-1.75, -1.05, -0.35, 0.35, 1.05, 1.75]) {
      const post = new THREE.BoxGeometry(RAIL.post, RAIL.height, RAIL.post);
      post.translate(x, DECK.top + RAIL.height / 2, z);
      parts.push(post);
    }
    parts.push(beam(new THREE.Vector3(-1.79, postTop - 0.04, z), new THREE.Vector3(1.79, postTop - 0.04, z), 0.10, 0.11));
    parts.push(beam(new THREE.Vector3(-1.79, DECK.top + 0.50, z), new THREE.Vector3(1.79, DECK.top + 0.50, z), 0.08, 0.09));
    parts.push(beam(new THREE.Vector3(-1.79, DECK.top + 0.15, z), new THREE.Vector3(1.79, DECK.top + 0.15, z), 0.07, 0.08));
  }
  for (const sign of [-1, 1]) {
    const z = sign * RAIL.offset;
    parts.push(beam(new THREE.Vector3(-1.79, DECK.top + 0.15, z), new THREE.Vector3(-1.55, postTop - 0.04, z), 0.06, 0.06));
    parts.push(beam(new THREE.Vector3(1.79, DECK.top + 0.15, z), new THREE.Vector3(1.55, postTop - 0.04, z), 0.06, 0.06));
  }
  return mergeGeometries(parts, 1e-4);
}

/** Estribos de piedra con base escalonada que reciben los extremos del tablero. */
function abutments() {
  const parts = [];
  for (const sign of [-1, 1]) {
    const base = new THREE.BoxGeometry(0.60, 0.14, 1.70);
    base.translate(sign * 1.78, 0.07, 0);
    parts.push(base);
    const block = new THREE.BoxGeometry(0.48, UNDER - 0.14, 1.55);
    block.translate(sign * 1.78, 0.07 + (UNDER - 0.14) / 2, 0);
    parts.push(block);
    const cap = new THREE.BoxGeometry(0.52, 0.06, 1.60);
    cap.translate(sign * 1.78, UNDER - 0.03, 0);
    parts.push(cap);
  }
  return mergeGeometries(parts, 1e-4);
}

const root = doc.createNode('wooden-bridge');
scene.addChild(root);
mesh('deck', { wood: deck() }, root);
mesh('stringers', { woodDark: stringers() }, root);
mesh('trestle-right', { woodDark: trestle(1.05) }, root);
mesh('trestle-left', { woodDark: trestle(-1.05) }, root);
mesh('railings', { wood: railings() }, root);
mesh('abutments', { stone: abutments() }, root);

const io = new NodeIO();
await mkdir(path.dirname(outFile), { recursive: true });
await io.write(outFile, doc);
console.log('wrote', outFile, 'meshes:', doc.getRoot().listMeshes().length);
