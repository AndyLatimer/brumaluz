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

async function generateTextures() {
  const tex = {};
  tex.wood = await writeTexture('wood', 512, 512, makeWoodTexture());
  tex.woodDark = await writeTexture('wood-dark', 512, 512, makeWoodDarkTexture());

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
    const x = pos.getX(i), z = pos.getZ(i);
    uvs[i*2] = ((x - minX) / sizeX) % 1;
    uvs[i*2+1] = ((z - minZ) / sizeZ) % 1;
  }
  setUV(geometry, uvs);
  return geometry;
}

function latheUVs(geometry, height) {
  const pos = geometry.getAttribute('position');
  const count = pos.count;
  const uvs = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i);
    const angle = Math.atan2(z, x) / (Math.PI * 2) + 0.5;
    uvs[i*2] = angle; uvs[i*2+1] = y / height;
  }
  setUV(geometry, uvs);
  return geometry;
}

function buildPlace() {
  return (geometry, t = {}) => geometry.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(t.x ?? 0, t.y ?? 0, t.z ?? 0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(t.rx ?? 0, t.ry ?? 0, t.rz ?? 0)),
    new THREE.Vector3(t.s ?? 1, t.s ?? 1, t.s ?? 1)
  ));
}

function ctxFactory(doc, tex) {
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
      // Preservar UVs: no hacer deleteAttribute('uv')
      const merged = mergeVertices(geometry.deleteAttribute('normal'), 1e-4);
      merged.computeVertexNormals();
      // Si la geometría original tenía UVs, ya están en merged; si no, boxUVs
      if (!merged.getAttribute('uv')) boxUVs(merged);
      output.addPrimitive(doc.createPrimitive()
        .setAttribute('POSITION', acc(`${name}:${materialName}:position`, Float32Array.from(merged.getAttribute('position').array), 'VEC3'))
        .setAttribute('NORMAL', acc(`${name}:${materialName}:normal`, Float32Array.from(merged.getAttribute('normal').array), 'VEC3'))
        .setAttribute('TEXCOORD_0', acc(`${name}:${materialName}:uv`, Float32Array.from(merged.getAttribute('uv').array), 'VEC2'))
        .setIndices(acc(`${name}:${materialName}:indices`, Uint16Array.from(merged.index.array), 'SCALAR'))
        .setMaterial(materials.get(materialName)));
      geometry.dispose(); merged.dispose();
    }
    parent.addChild(doc.createNode(name).setMesh(output));
  };
  const place = buildPlace();
  return { doc, buf, scene, materials, acc, mesh, place };
}

  tex.iron = await writeTexture('iron', 512, 512, makeIronTexture());
  tex.gold = await writeTexture('gold', 512, 512, makeGoldTexture());
  tex.leather = await writeTexture('leather', 512, 512, makeLeatherTexture());
  tex.straw = await writeTexture('straw', 512, 512, makeStrawTexture());
  console.log('Texturas generadas:', Object.keys(tex).join(', '));
  return tex;
}

  const png = encodePNG(width, height, rgba);
  const filePath = fileURLToPath(new URL(`${name}.png`, texDir));
  await writeFile(filePath, png);
  return `medieval-furniture/textures/${name}.png`;
}
