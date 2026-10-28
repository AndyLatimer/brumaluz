/**
 * Deriva de los puentes canonicos de medieval-builder (bridge y bridge_roofed)
 * variantes con textura PBR de piedra.
 *
 * Los GLB de `src/assets/library/` son un espejo verificado byte a byte de los
 * packs CC0 de KayKit: este script NUNCA los modifica, solo los lee. Las
 * variantes se escriben en `src/assets/models/props/`, siguiendo la misma
 * convencion que `scripts/build-wooden-bridge.mjs`.
 *
 * Ademas de la textura, se reproyectan las UV: el original trae una proyeccion
 * global 0..1 que estiraria la piedra, asi que se calcula una proyeccion en
 * escala de mundo (una repeticion por metro) segun la cara dominante de cada
 * normal, igual que hace `scripts/build-wooden-bridge.mjs`.
 *
 * Uso: node scripts/build-medieval-bridges.mjs
 */

import { NodeIO } from '@gltf-transform/core';
import { deflateSync, inflateSync } from 'node:zlib';
import { mkdir } from 'node:fs/promises';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LIBRARY = path.join(ROOT, 'src', 'assets', 'library', 'medieval-builder', 'objects');
const OUTPUT = path.join(ROOT, 'src', 'assets', 'models', 'props');
const SIZE = 256;
const clamp255 = value => Math.round(Math.max(0, Math.min(255, value)));

/* ---------------------------------------------------------------- PNG ---- */

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

function chunk(type, data) {
  const len = new DataView(new ArrayBuffer(4));
  len.setUint32(0, data.byteLength, false);
  const typeBytes = new TextEncoder().encode(type);
  const crcData = new Uint8Array(typeBytes.length + data.byteLength);
  crcData.set(typeBytes);
  crcData.set(data, typeBytes.length);
  const crc = crc32(crcData);
  const crcBytes = new DataView(new ArrayBuffer(4));
  crcBytes.setUint32(0, crc >>> 0, false);
  return new Uint8Array([...new Uint8Array(len.buffer), ...typeBytes, ...data, ...new Uint8Array(crcBytes.buffer)]);
}

function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/** Serializa un buffer RGB (3 canales) como PNG sin dependencias externas. */
function writePNG(width, height, rgb) {
  const rowBytes = width * 3;
  const raw = new Uint8Array(height * (1 + rowBytes));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0;
    raw.set(rgb.subarray(y * rowBytes, (y + 1) * rowBytes), offset);
    offset += rowBytes;
  }
  const idat = deflateSync(raw);
  const ihdrData = new Uint8Array(13);
  const ihdrView = new DataView(ihdrData.buffer);
  ihdrView.setUint32(0, width, false);
  ihdrView.setUint32(4, height, false);
  ihdrData[8] = 8;   // profundidad de bits
  ihdrData[9] = 2;   // color truecolour RGB
  ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;
  const chunks = [chunk('IHDR', ihdrData), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))];
  const total = PNG_SIGNATURE.byteLength + chunks.reduce((sum, part) => sum + part.byteLength, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  out.set(PNG_SIGNATURE, cursor);
  cursor += PNG_SIGNATURE.byteLength;
  for (const part of chunks) { out.set(part, cursor); cursor += part.byteLength; }
  return out;
}


/* -------------------------------------------------------------- ruido ---- */

/**
 * Ruido de valor con wrap entero: `period` celdas en cada eje, para que la
 * textura repita sin costura al proyectarse en UV de mundo.
 */
function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = t => t * t * (3 - 2 * t);

function valueNoise(x, y, seed, period) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const wrap = value => ((value % period) + period) % period;
  const x0 = wrap(xi), x1 = wrap(xi + 1), y0 = wrap(yi), y1 = wrap(yi + 1);
  const a = hash(x0, y0, seed), b = hash(x1, y0, seed);
  const c = hash(x0, y1, seed), d = hash(x1, y1, seed);
  return (a + (b - a) * xf) * (1 - yf) + (c + (d - c) * xf) * yf;
}

/** Ruido fractal tileable: cada octava dobla frecuencia y periodo. */
function fbm(x, y, seed, period, octaves = 4) {
  let sum = 0, amplitude = 0.5, frequency = 1, norm = 0;
  for (let octave = 0; octave < octaves; octave++) {
    sum += valueNoise(x * frequency, y * frequency, seed + octave * 101, period * frequency) * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return sum / norm;
}

/**
 * Mapa de detalle de piedra: sillares en hiladas con juntas oscuras y veta
 * por pieza. Se guarda en escala de grises con 255 como valor neutro, de modo
 * que al multiplicarse por el color base del material solo anade detalle y no
 * sustituye el tono canonico.
 */
function makeStoneDetail(size, seed) {
  const pixels = Buffer.alloc(size * size * 3);
  const courses = 4;                       // hiladas de sillares por tile
  const blockHeight = size / courses;
  const period = 16;
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / blockHeight);
    // Hiladas alternas desplazadas media pieza: aparejo de obra.
    const offset = (row % 2) * 0.5 + hash(row, 0, seed) * 0.18;
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      // Coordenadas locales dentro del sillar, en unidades de anchura de piedra.
      const scaled = (u + offset) * courses * 1.5;
      const column = Math.floor(scaled);
      const cellX = scaled - column;
      const cellY = (y - row * blockHeight) / blockHeight;
      const edge = Math.min(cellX, 1 - cellX, cellY, 1 - cellY);
      // Junta: cuanto mas cerca del borde de la pieza, mas oscura la piedra.
      const joint = 1 - Math.min(1, edge / 0.05);
      // Tono propio de cada sillar, estable por bloque.
      const tone = (hash(column, row, seed) - 0.5) * 0.16;
      // Quiet stone grain: isolated dark texels and a strong normal derivative
      // shimmered into speckled bands on the continent's long, shallow bridge.
      const grain = (fbm(u * period, v * period, seed + 7, period, 3) - 0.5) * 0.06;
      const value = clamp255(255 * (1 + tone * .65 + grain) * (1 - joint * 0.3));
      const index = (y * size + x) * 3;
      pixels[index] = value; pixels[index + 1] = value; pixels[index + 2] = value;
    }
  }
  return writePNG(size, size, pixels);
}

/**
 * Empaquetado para glTF: R = oclusion, G = rugosidad, B = metallicidad.
 */
function makeRoughnessTexture(size, seed, low, high, scale = 8) {
  const pixels = Buffer.alloc(size * size * 3);
  const period = 8;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm((x / size) * scale, (y / size) * scale, seed, period, 3);
      const roughness = clamp255(low + (high - low) * n);
      const index = (y * size + x) * 3;
      pixels[index] = 255;          // oclusion
      pixels[index + 1] = roughness;
      pixels[index + 2] = 0;        // metallicidad
    }
  }
  return writePNG(size, size, pixels);
}


/** Mapa de detalle de madera: vetas longitudinales y nudos, para postes y vigas. */
function makeWoodDetail(size, seed) {
  const pixels = Buffer.alloc(size * size * 3);
  const period = 16;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      // Veta: ruido anisotropo (mucha frecuencia en X, poca en Y).
      const grainValue = fbm(u * period * 4, v * period / 4, seed, period, 4);
      const ring = Math.abs(Math.sin((grainValue * 6 + v * 3) * Math.PI));
      const knot = fbm(u * period / 2, v * period / 2, seed + 5, period, 3);
      const value = clamp255(255 * (1 + (ring - 0.5) * 0.22 + (knot - 0.5) * 0.26
        + (hash(x, y, seed + 17) - 0.5) * 0.08));
      const index = (y * size + x) * 3;
      pixels[index] = value; pixels[index + 1] = value; pixels[index + 2] = value;
    }
  }
  return writePNG(size, size, pixels);
}

/** Mapa de detalle de tejas: filas escalonadas con sombra entre ellas. */
function makeRoofDetail(size, seed) {
  const pixels = Buffer.alloc(size * size * 3);
  const rows = 8, columns = 10;
  const period = 8;
  for (let y = 0; y < size; y++) {
    const row = Math.floor((y / size) * rows);
    const offset = (row % 2) * 0.5;
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const scaled = (u + offset) * columns;
      const column = Math.floor(scaled);
      const cellX = scaled - column;
      const cellY = (y / size) * rows - row;
      // Sombra bajo el alero de cada hilada y junta lateral entre tejas.
      const lip = Math.min(1, Math.max(0, (cellY - 0.82) / 0.18));
      const side = Math.min(1, Math.max(0, (0.06 - cellX) / 0.06))
        + Math.min(1, Math.max(0, (cellX - 0.94) / 0.06));
      const shade = (hash(column, row, seed) - 0.5) * 0.18
        + (fbm(u * period, v * period, seed + 3, period, 3) - 0.5) * 0.14;
      const value = clamp255(255 * (1 + shade) * (1 - Math.min(1, lip * 0.55 + side * 0.35) * 0.5));
      const index = (y * size + x) * 3;
      pixels[index] = value; pixels[index + 1] = value; pixels[index + 2] = value;
    }
  }
  return writePNG(size, size, pixels);
}

/** Relieve suave derivado del detalle; PNG estándar con compresión zlib, no DEFLATE crudo. */
function normalMap(png, strength = 2.5) {
  const idat = [], view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  for (let offset = 8; offset < png.length;) {
    const length = view.getUint32(offset);
    if (Buffer.from(png.subarray(offset + 4, offset + 8)).toString() === 'IDAT') idat.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const pixels = inflateSync(Buffer.concat(idat)), output = Buffer.alloc(SIZE * SIZE * 3);
  const height = (x, y) => pixels[((y + SIZE) % SIZE) * (SIZE * 3 + 1) + 1 + ((x + SIZE) % SIZE) * 3] / 255;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const nx = (height(x - 1, y) - height(x + 1, y)) * strength;
    const ny = (height(x, y - 1) - height(x, y + 1)) * strength;
    const length = Math.hypot(nx, ny, 1), i = (y * SIZE + x) * 3;
    output[i] = clamp255((nx / length * 0.5 + 0.5) * 255);
    output[i + 1] = clamp255((ny / length * 0.5 + 0.5) * 255);
    output[i + 2] = clamp255((1 / length * 0.5 + 0.5) * 255);
  }
  return writePNG(SIZE, SIZE, output);
}

/** Costuras por cara: ningún vértice comparte UV entre planos de proyección distintos. */
function projectGeometry(geometry, scale = 1) {
  const output = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const positions = output.getAttribute('position'), uv = new Float32Array(positions.count * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), normal = new THREE.Vector3();
  for (let i = 0; i < positions.count; i += 3) {
    a.fromBufferAttribute(positions, i); b.fromBufferAttribute(positions, i + 1); c.fromBufferAttribute(positions, i + 2);
    normal.crossVectors(b.sub(a), c.sub(a));
    const nx = Math.abs(normal.x), ny = Math.abs(normal.y), nz = Math.abs(normal.z);
    for (let j = i; j < i + 3; j++) {
      const x = positions.getX(j), y = positions.getY(j), z = positions.getZ(j);
      uv[j * 2] = (ny >= nx && ny >= nz ? x : nx >= nz ? z : x) * scale;
      uv[j * 2 + 1] = (ny >= nx && ny >= nz ? z : y) * scale;
    }
  }
  output.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return output;
}

function primitiveGeometry(primitive) {
  const geometry = new THREE.BufferGeometry();
  for (const [semantic, attribute] of [['POSITION', 'position'], ['NORMAL', 'normal']]) {
    const accessor = primitive.getAttribute(semantic);
    geometry.setAttribute(attribute, new THREE.BufferAttribute(Float32Array.from(accessor.getArray()), 3));
  }
  if (primitive.getIndices()) geometry.setIndex(Array.from(primitive.getIndices().getArray()));
  return geometry;
}

/** Pequeños sillares con cantos biselados; las medidas siguen la silueta y escala del original. */
function copingStone(width, depth) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -depth / 2); shape.lineTo(width / 2, -depth / 2);
  shape.lineTo(width / 2, depth / 2); shape.lineTo(-width / 2, depth / 2); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.022, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1, steps: 1 });
  geometry.rotateX(-Math.PI / 2).translate(0, -0.018, 0);
  return geometry;
}

await mkdir(OUTPUT, { recursive: true });
const io = new NodeIO();
for (const name of ['bridge', 'bridge_roofed']) {
  const document = await io.read(path.join(LIBRARY, `${name}.glb`));
  const root = document.getRoot(), buffer = root.listBuffers()[0], mesh = root.listMeshes()[0];
  const sourcePrimitives = [...mesh.listPrimitives()];
  const sourceGeometries = sourcePrimitives.map(primitiveGeometry);
  const accessor = (label, array, type) => document.createAccessor(label).setBuffer(buffer).setType(type).setArray(array);
  function primitive(geometry, material, label, scale = 1) {
    const projected = projectGeometry(geometry, scale);
    const result = document.createPrimitive().setMaterial(material);
    for (const [attribute, semantic, type] of [['position', 'POSITION', 'VEC3'], ['normal', 'NORMAL', 'VEC3'], ['uv', 'TEXCOORD_0', 'VEC2']]) {
      result.setAttribute(semantic, accessor(`${label}:${attribute}`, Float32Array.from(projected.getAttribute(attribute).array), type));
    }
    mesh.addPrimitive(result);
    projected.dispose();
  }
  function surfaceMaterial(material, detail, label, roughness) {
    const texture = (suffix, png) => document.createTexture(`${label}-${suffix}`).setImage(png).setMimeType('image/png');
    material.setBaseColorTexture(texture('color', detail));
    const stoneSurface = label === 'stone';
    material.setNormalTexture(texture('normal', normalMap(detail, stoneSurface ? .8 : 2.5))).setNormalScale(stoneSurface ? .2 : .45);
    material.setMetallicRoughnessTexture(texture('roughness', makeRoughnessTexture(SIZE, 17, roughness - 12, roughness + 12)));
    material.setMetallicFactor(0).setRoughnessFactor(1);
    for (const info of [material.getBaseColorTextureInfo(), material.getNormalTextureInfo(), material.getMetallicRoughnessTextureInfo()]) info.setWrapS(10497).setWrapT(10497);
  }
  const stone = root.listMaterials().find(material => material.getName() === 'Stone');
  surfaceMaterial(stone, makeStoneDetail(SIZE, 11), 'stone', 215);
  const wood = root.listMaterials().find(material => material.getName() === 'Brown');
  const darkWood = root.listMaterials().find(material => material.getName() === 'BrownDark');
  let roof;
  if (wood) {
    surfaceMaterial(wood, makeWoodDetail(SIZE, 23), 'timber', 200);
    surfaceMaterial(darkWood, makeWoodDetail(SIZE, 29), 'dark-timber', 220);
    roof = document.createMaterial('Roof').setBaseColorFactor(wood.getBaseColorFactor());
    surfaceMaterial(roof, makeRoofDetail(SIZE, 31), 'terracotta', 210);
  }
  sourcePrimitives.forEach((source, i) => {
    const geometry = sourceGeometries[i], sourceMaterial = source.getMaterial();
    if (sourceMaterial === wood) {
      // El material Brown original reúne tejado y carpintería: separar por caras evita tejas en los postes.
      const expanded = geometry.toNonIndexed(), positions = expanded.getAttribute('position');
      const bins = { roof: [], wood: [] }, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), normal = new THREE.Vector3();
      for (let j = 0; j < positions.count; j += 3) {
        a.fromBufferAttribute(positions, j); b.fromBufferAttribute(positions, j + 1); c.fromBufferAttribute(positions, j + 2);
        const y = (a.y + b.y + c.y) / 3;
        normal.crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
        const bin = y > 0.3 && Math.abs(normal.y) > 0.35 ? bins.roof : bins.wood;
        bin.push(j, j + 1, j + 2);
      }
      for (const [kind, indices] of Object.entries(bins)) {
        if (!indices.length) continue;
        const part = expanded.clone(); part.setIndex(indices);
        primitive(part, kind === 'roof' ? roof : wood, kind, kind === 'roof' ? 0.9 : 1.8);
        part.dispose();
      }
      expanded.dispose();
    } else primitive(geometry, sourceMaterial, sourceMaterial.getName(), sourceMaterial === stone ? 0.75 : 1.8);
    mesh.removePrimitive(source);
    source.dispose();
  });
  const ray = new THREE.Raycaster(), probeMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const probe = new THREE.Mesh(sourceGeometries[0], probeMaterial);
  const topAt = (x, z, target = probe) => {
    ray.set(new THREE.Vector3(x, 2, z), new THREE.Vector3(0, -1, 0));
    return ray.intersectObject(target)[0]?.point.y;
  };
  const coping = [];
  for (const sign of [-1, 1]) for (let i = 0; i < 9; i++) {
    const x = (i - 4) * 0.205, z = sign * 0.235, y = topAt(x, z);
    if (y === undefined) continue;
    const slope = Math.atan2((topAt(x + 0.01, z) ?? y) - (topAt(x - 0.01, z) ?? y), 0.02);
    coping.push(copingStone(0.191, 0.108).rotateZ(slope).translate(x, y + 0.002, z));
  }
  if (coping.length) {
    const geometry = mergeGeometries(coping);
    primitive(geometry, stone, 'bevelled-coping', 0.75);
    geometry.dispose(); coping.forEach(part => part.dispose());
  }
  if (roof) {
    const roofProbe = new THREE.Mesh(sourceGeometries[1], probeMaterial), ridge = [];
    for (let i = 0; i < 11; i++) {
      const x = (i - 5) * 0.18, y = topAt(x, 0, roofProbe);
      if (y === undefined) continue;
      const slope = Math.atan2((topAt(x + 0.01, 0, roofProbe) ?? y) - (topAt(x - 0.01, 0, roofProbe) ?? y), 0.02);
      ridge.push(copingStone(0.165, 0.045).rotateZ(slope).translate(x, y + 0.002, 0));
    }
    if (ridge.length) {
      const geometry = mergeGeometries(ridge);
      primitive(geometry, roof, 'ridge-tiles', 0.9);
      geometry.dispose(); ridge.forEach(part => part.dispose());
    }
  }
  probeMaterial.dispose(); sourceGeometries.forEach(geometry => geometry.dispose());
  // Eliminar accesores antiguos sin tocar los originales de la biblioteca.
  for (const old of root.listAccessors()) if (!mesh.listPrimitives().some(part => part.listAttributes().includes(old) || part.getIndices() === old)) old.dispose();
  const output = path.join(OUTPUT, `medieval-${name}.glb`);
  await io.write(output, document);
  const triangles = mesh.listPrimitives().reduce((sum, part) => sum + part.getAttribute('POSITION').getCount() / 3, 0);
  console.log(`Generado ${output}: ${triangles} triángulos, ${root.listTextures().length} texturas`);
}
