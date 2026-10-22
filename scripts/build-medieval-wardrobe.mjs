import { NodeIO } from '@gltf-transform/core';
import { prune } from '@gltf-transform/functions';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';

// Offline pattern source for the classic medieval outfit (Clásico medieval). The exported GLB is the editable
// interchange asset, not geometry rebuilt by the game every time a character is created.
const io = new NodeIO();
const models = new URL('../src/assets/models/', import.meta.url);
const document = await io.read(fileURLToPath(new URL('Mage.glb', models)));
const root = document.getRoot();
const skin = root.listSkins()[0];
const rig = root.listNodes().find(node => node.getName() === 'Rig');
const joints = skin.listJoints().map(node => node.getName());
const buffer = root.listBuffers()[0].setName('Medieval wardrobe');

// Clean out existing meshes and animations from template Mage
for (const node of [...root.listNodes()]) if (node.getMesh()) node.dispose();
for (const animation of [...root.listAnimations()]) {
  animation.listChannels().forEach(channel => channel.dispose());
  animation.listSamplers().forEach(sampler => sampler.dispose());
  animation.dispose();
}

// Colors: classic medieval palette (forest green, warm linen, rich leather, brass)
const colors = {
  tunic: '#2f5a3a',         // Rich medieval forest green
  tunicTrim: '#bda052',     // Golden-straw woven trim
  linen: '#ebe0c8',         // Unbleached warm flax linen
  leather: '#613f28',       // Saddle leather belt & boots
  darkLeather: '#3c2415',   // Deep espresso leather for cuffs & sole
  sole: '#27170e',          // Sturdy boot bottom
  brass: '#d4af37',         // Antique brass buckle & studs
  trousers: '#7c705f',      // Medieval woven wool hose
  skin: '#f2c8a0',
};

const materials = new Map(Object.entries(colors).map(([name, color]) => [
  name, document.createMaterial(name)
    .setBaseColorFactor([...new THREE.Color(color).toArray(), 1])
    .setRoughnessFactor(name === 'brass' ? 0.38 : name === 'leather' || name === 'darkLeather' ? 0.75 : 0.9)
    .setMetallicFactor(name === 'brass' ? 0.5 : 0),
]));

const mix = (a, b, t) => [[a, 1 - t], [b, t]].filter(([, weight]) => weight > 0);
const torsoWeights = ([, y]) => y < .62
  ? mix('hips', 'spine', THREE.MathUtils.smoothstep(y, .43, .62))
  : mix('spine', 'chest', THREE.MathUtils.smoothstep(y, .67, 1.04));

const legWeights = side => ([, y]) => y > .42
  ? mix(`upperleg.${side}`, 'hips', THREE.MathUtils.smoothstep(y, .42, .57))
  : mix(`lowerleg.${side}`, `upperleg.${side}`, THREE.MathUtils.smoothstep(y, .24, .36));

const footWeights = side => ([, y]) => mix(`foot.${side}`, `lowerleg.${side}`, THREE.MathUtils.smoothstep(y, .13, .23));

const anatomy = await io.read(fileURLToPath(new URL('Mage.glb', models)));
const armSource = side => anatomy.getRoot().listNodes()
  .find(node => node.getName() === `Mage_Arm${side === 'l' ? 'Left' : 'Right'}`).getMesh().listPrimitives()[0];

function referenceWeights(source, index) {
  const indices = source.getAttribute('JOINTS_0').getElement(index, []);
  return source.getAttribute('WEIGHTS_0').getElement(index, [])
    .flatMap((weight, i) => weight > 0 ? [[joints[indices[i]], weight]] : []);
}

function transferArmWeights(side) {
  const source = armSource(side), positions = source.getAttribute('POSITION'), indices = source.getIndices();
  const triangles = [];
  for (let i = 0; i < (indices?.getCount() ?? positions.getCount()); i += 3) {
    const vertices = [0,1,2].map(offset => indices ? indices.getScalar(i + offset) : i + offset);
    triangles.push({
      vertices,
      triangle: new THREE.Triangle(...vertices.map(index => new THREE.Vector3(...positions.getElement(index, [])))),
    });
  }
  const point = new THREE.Vector3(), closest = new THREE.Vector3(), barycentric = new THREE.Vector3();
  return position => {
    point.fromArray(position);
    let distance = Infinity, match;
    for (const candidate of triangles) {
      candidate.triangle.closestPointToPoint(point, closest);
      const squared = point.distanceToSquared(closest);
      if (squared < distance) {
        distance = squared;
        match = candidate;
      }
    }
    if (!match) throw new Error(`No arm reference triangles for ${side}`);
    match.triangle.closestPointToPoint(point, closest);
    match.triangle.getBarycoord(closest, barycentric);
    const influences = new Map();
    match.vertices.forEach((index, vertex) => {
      for (const [bone, weight] of referenceWeights(source, index)) {
        influences.set(bone, (influences.get(bone) ?? 0) + weight * barycentric.getComponent(vertex));
      }
    });
    const arm = THREE.MathUtils.smoothstep(Math.abs(position[0]), .20, .38);
    for (const [bone, weight] of influences) influences.set(bone, weight * arm);
    influences.set('chest', (influences.get('chest') ?? 0) + 1 - arm);
    const result = [...influences].filter(([, weight]) => weight > 0).sort((a,b) => b[1]-a[1]).slice(0,4);
    const sum = result.reduce((total, [, weight]) => total + weight, 0);
    return result.map(([bone, weight]) => [bone, weight / sum]);
  };
}

function accessor(name, array, type) {
  return document.createAccessor(name).setType(type).setArray(array).setBuffer(buffer);
}

function mesh(name, components, weights, bone) {
  const output = document.createMesh(name);
  for (const [component, { geometry, material }] of components.entries()) {
    if (!geometry.hasAttribute('normal')) geometry.computeVertexNormals();
    const positions = geometry.getAttribute('position');
    const primitive = document.createPrimitive()
      .setAttribute('POSITION', accessor(`${name}:position`, Float32Array.from(positions.array), 'VEC3'))
      .setAttribute('NORMAL', accessor(`${name}:normal`, Float32Array.from(geometry.getAttribute('normal').array), 'VEC3'))
      .setMaterial(materials.get(material));
    if (geometry.index) primitive.setIndices(accessor(`${name}:indices`, Uint16Array.from(geometry.index.array), 'SCALAR'));
    if (weights) {
      const indices = [], values = [];
      for (let i = 0; i < positions.count; i++) {
        const influences = weights([positions.getX(i), positions.getY(i), positions.getZ(i)], i, component);
        const ji = [0, 0, 0, 0], w = [0, 0, 0, 0];
        influences.forEach(([joint, weight], index) => {
          const j = joints.indexOf(joint);
          if (j < 0) throw new Error(`Unknown joint: ${joint}`);
          ji[index] = j; w[index] = weight;
        });
        indices.push(...ji); values.push(...w);
      }
      primitive.setAttribute('JOINTS_0', accessor(`${name}:joints`, new Uint16Array(indices), 'VEC4'));
      primitive.setAttribute('WEIGHTS_0', accessor(`${name}:weights`, new Float32Array(values), 'VEC4'));
    }
    output.addPrimitive(primitive);
    geometry.dispose();
  }
  const node = document.createNode(name).setMesh(output);
  if (weights) node.setSkin(skin);
  if (bone) {
    node.setExtras({ attachment: bone });
    const anchor = skin.listJoints().find(joint => joint.getName() === bone);
    if (!anchor) throw new Error(`Unknown attachment: ${bone}`);
    anchor.addChild(node);
  } else rig.addChild(node);
}

function surface(rows, columns, at, wrap = false) {
  const positions = [], indices = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col <= columns; col++) {
    positions.push(...at(row, col / columns));
    if (row < rows - 1 && col < columns) {
      const a = row * (columns + 1) + col, b = a + columns + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  if (wrap) {
    const normals = geometry.getAttribute('normal');
    for (let row = 0; row < rows; row++) {
      const a = row * (columns + 1), b = a + columns;
      const n = new THREE.Vector3().fromBufferAttribute(normals, a)
        .add(new THREE.Vector3().fromBufferAttribute(normals, b)).normalize();
      normals.setXYZ(a, n.x, n.y, n.z); normals.setXYZ(b, n.x, n.y, n.z);
    }
  }
  return geometry;
}

// Cross-sections [y, radiusX, radiusZ, centerX, centerZ].
function loft(profile, columns = 32, { closeStart = false, closeEnd = false } = {}) {
  const sides = surface(profile.length, columns, (row, t) => {
    const [y, rx, rz, x = 0, z = 0] = profile[row], angle = -t * Math.PI * 2;
    return [x + Math.cos(angle) * rx, y, z + Math.sin(angle) * rz];
  }, true);
  if (!closeStart && !closeEnd) return sides;
  const components = [sides];
  for (const [enabled, section, upwards] of [[closeStart, profile[0], false], [closeEnd, profile.at(-1), true]]) {
    if (!enabled) continue;
    const [y, rx, rz, x = 0, z = 0] = section;
    const positions = [x, y, z], indices = [];
    for (let col = 0; col <= columns; col++) {
      const angle = -col / columns * Math.PI * 2;
      positions.push(x + Math.cos(angle) * rx, y, z + Math.sin(angle) * rz);
      if (col < columns) indices.push(0, upwards ? col + 1 : col + 2, upwards ? col + 2 : col + 1);
    }
    const cap = new THREE.BufferGeometry();
    cap.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    cap.setIndex(indices);
    cap.computeVertexNormals();
    components.push(cap);
  }
  const result = mergeGeometries(components);
  components.forEach(geometry => geometry.dispose());
  return result;
}

const piece = (geometry, material) => ({ geometry, material });
function seam(x, y, z, rx, rz, thickness) {
  return new THREE.TorusGeometry(1, thickness, 8, 36).rotateX(Math.PI / 2).scale(rx, 1, rz).translate(x, y, z);
}

// ==========================================
// Classic medieval outfit in the KayKit "starting clothes" spirit: a chunky tunic with a laced linen neckline, a wide
// leather belt with brass buckle and pouch, and sleeves, hose and boots cut from the canonical arm and leg. No hat.
// ==========================================
const SEGMENTS = 20;

// Cross-sections [y, radiusX, radiusZ]: from the rolled hem (mid-thigh) to the collar.
const tunicProfile = [
  [.47, .352, .300],
  [.53, .338, .288],
  [.62, .314, .264],
  [.74, .300, .252],
  [.80, .294, .248],
  [.86, .300, .252],
  [.97, .312, .260],
  [1.08, .304, .252],
  [1.16, .268, .222],
  [1.22, .178, .158],
  [1.25, .148, .138],
];
function tunicSection(y) {
  const index = tunicProfile.findIndex(section => section[0] >= y);
  if (index <= 0) return tunicProfile[Math.max(0, index)];
  const a = tunicProfile[index - 1], b = tunicProfile[index], t = (y - a[0]) / (b[0] - a[0]);
  return [y, THREE.MathUtils.lerp(a[1], b[1], t), THREE.MathUtils.lerp(a[2], b[2], t)];
}
/** Point on the tunic front at (x, y), pushed `clearance` outwards (for panels lying on the cloth). */
function onTunic(x, y, clearance) {
  const [, rx, rz] = tunicSection(y);
  const z = rz * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2));
  const normal = new THREE.Vector3(x / (rx * rx), 0, z / (rz * rz)).normalize();
  return new THREE.Vector3(x, y, z).addScaledVector(normal, clearance);
}

/**
 * Turns a piece so its faces point away from `inside(point)` (where the body is): mirrored and swapped patterns
 * otherwise end up inside-out and are culled.
 */
function faceOutward(geometry, inside) {
  const position = geometry.getAttribute('position'), index = geometry.index;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), normal = new THREE.Vector3();
  let score = 0;
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(position, index.getX(i)); b.fromBufferAttribute(position, index.getX(i + 1)); c.fromBufferAttribute(position, index.getX(i + 2));
    normal.subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b));
    const centroid = a.clone().add(b).add(c).multiplyScalar(1 / 3);
    score += Math.sign(normal.dot(centroid.sub(inside(centroid))));
  }
  if (score < 0) for (let i = 0; i < index.count; i += 3) { const first = index.getX(i); index.setX(i, index.getX(i + 1)); index.setX(i + 1, first); }
  geometry.computeVertexNormals();
  return geometry;
}
const towardSpine = point => new THREE.Vector3(0, point.y, 0);

// Laced neckline: a slit down the chest showing the linen shirt, edged with the woven trim and closed with crossed
// leather laces. The big head hides the neck itself, so the slit starts right under the chin.
const NECK_TOP = 1.175, NECK_BOTTOM = .965, NECK_HALF = .068;
const slitEdge = (sign, v) => [sign * NECK_HALF * (1 - v) ** 1.2, THREE.MathUtils.lerp(NECK_TOP, NECK_BOTTOM, v)];
const shirt = faceOutward(surface(9, 6, (row, t) => {
  const [edge, y] = slitEdge(1, row / 8);
  return onTunic(THREE.MathUtils.lerp(-edge - .004, edge + .004, t), y, .005).toArray();
}), towardSpine);
const cord = (points, radius) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(4, points.length * 3), radius, 6);
const slitTrim = [1, -1].map(sign => cord(Array.from({ length: 9 }, (_, i) => {
  const [x, y] = slitEdge(sign, i / 8);
  return onTunic(x, y, .011);
}), .0085));
const laceAt = (sign, v) => { const [x, y] = slitEdge(sign, v); return onTunic(x * 1.05, y, .019); };
const laces = [];
for (const [from, to] of [[.08, .3], [.3, .52], [.52, .72]]) {
  // One X per pair of eyelets: left-to-right and right-to-left.
  for (const sign of [1, -1]) {
    const a = laceAt(sign, from), b = laceAt(-sign, to), middle = a.clone().lerp(b, .5).addScaledVector(new THREE.Vector3(0, 0, 1), .004);
    laces.push(cord([a, middle, b], .0055));
  }
}
// The bow's loose ends hang just below the slit.
for (const sign of [1, -1]) {
  const knot = onTunic(0, NECK_BOTTOM + .03, .021);
  laces.push(cord([knot, onTunic(sign * .02, NECK_BOTTOM - .015, .02), onTunic(sign * .028, NECK_BOTTOM - .06, .018)], .005));
}

// Wide belt: a short band just outside the waist, a square brass buckle and a leather pouch on the right hip.
const belt = loft([[.775, .304, .258], [.79, .308, .262], [.835, .308, .262], [.85, .304, .258]], SEGMENTS);
const buckle = mergeGeometries([
  new THREE.BoxGeometry(.11, .022, .02).translate(0, .838, .272),
  new THREE.BoxGeometry(.11, .022, .02).translate(0, .787, .272),
  new THREE.BoxGeometry(.022, .07, .02).translate(-.044, .8125, .272),
  new THREE.BoxGeometry(.022, .07, .02).translate(.044, .8125, .272),
  new THREE.BoxGeometry(.012, .06, .012).translate(0, .8125, .276),
]);
const pouchAt = (geometry) => geometry.rotateY(-.85).translate(-.235, .73, .2);
const pouch = pouchAt(new THREE.BoxGeometry(.12, .1, .06, 2, 2, 1));
const pouchFlap = pouchAt(new THREE.BoxGeometry(.126, .04, .068).translate(0, .04, .002));
const hemRoll = seam(0, .47, 0, .352, .3, .022);

function medievalTunicWeights([x, y, z]) {
  if (y > 0.64) return torsoWeights([x, y, z]);
  const side = x >= 0 ? 'l' : 'r';
  const legInfluence = THREE.MathUtils.smoothstep(0.64 - y, 0, 0.18) * 0.42 * THREE.MathUtils.smoothstep(Math.abs(x), 0.04, 0.22);
  const base = torsoWeights([x, y, z]);
  const influences = new Map(base.map(([bone, w]) => [bone, w * (1 - legInfluence)]));
  influences.set(`upperleg.${side}`, (influences.get(`upperleg.${side}`) ?? 0) + legInfluence);
  return [...influences].filter(([, w]) => w > 0);
}

mesh('medieval-tunic', [
  piece(loft(tunicProfile, SEGMENTS), 'tunic'),
  piece(hemRoll, 'tunicTrim'),
  piece(seam(0, 1.24, 0, .15, .14, .02), 'tunicTrim'),
  piece(shirt, 'linen'),
  piece(mergeGeometries(slitTrim), 'tunicTrim'),
  piece(mergeGeometries(laces), 'leather'),
  piece(belt, 'leather'),
  piece(buckle, 'brass'),
  piece(pouch, 'leather'),
  piece(pouchFlap, 'darkLeather'),
], medievalTunicWeights);

/**
 * Re-uses a canonical KayKit body part so the garment fits it exactly and keeps its skin weights. Triangles are split
 * into materials by their texture-atlas cell (8×8 grid); vertices are shared unless their normals differ (hard edges).
 */
const atlasCell = (u, v) => Math.min(7, Math.floor(v * 8)) * 8 + Math.min(7, Math.floor(u * 8));
function fromSource(source, materialOf) {
  const positions = source.getAttribute('POSITION'), normals = source.getAttribute('NORMAL'), uv = source.getAttribute('TEXCOORD_0');
  const indices = source.getIndices(), parts = new Map();
  for (let i = 0; i < (indices?.getCount() ?? positions.getCount()); i += 3) {
    const triangle = [0, 1, 2].map(offset => indices ? indices.getScalar(i + offset) : i + offset);
    const [u, v] = triangle.reduce((sum, index) => { const t = uv.getElement(index, []); return [sum[0] + t[0] / 3, sum[1] + t[1] / 3]; }, [0, 0]);
    const y = triangle.reduce((sum, index) => sum + positions.getElement(index, [])[1] / 3, 0);
    const material = materialOf(atlasCell(u, v), y);
    if (!material) continue;
    if (!parts.has(material)) parts.set(material, { remap: new Map(), positions: [], normals: [], original: [], triangles: [] });
    const part = parts.get(material);
    for (const index of triangle) {
      const normal = normals ? normals.getElement(index, []) : [0, 1, 0];
      const id = [...positions.getElement(index, []), ...normal].map(value => Math.round(value * 1e4)).join(',');
      if (!part.remap.has(id)) {
        part.remap.set(id, part.original.length);
        part.positions.push(...positions.getElement(index, []));
        part.normals.push(...normal);
        part.original.push(index);
      }
      part.triangles.push(part.remap.get(id));
    }
  }
  return [...parts].map(([material, part]) => {
    const geometry = new THREE.BufferGeometry()
      .setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3))
      .setAttribute('normal', new THREE.Float32BufferAttribute(part.normals, 3));
    geometry.setIndex(part.triangles);
    return { ...piece(geometry, material), original: part.original };
  });
}
/** Garment node made from `fromSource` parts, skinned exactly like the source body part. */
function sourcedMesh(name, source, parts) {
  mesh(name, parts, (_position, index, component) => referenceWeights(source, parts[component].original[index]));
}

// Atlas cells of the KayKit arm and leg (see Mage.glb's texture): sleeve, cuff, hand; trousers, boot shaft, boot foot.
const HAND_CELLS = [0, 8, 39, 47], CUFF_CELLS = [4, 12];
const TROUSER_CELLS = [31], BOOT_SHAFT_CELLS = [35];

// Sleeves: the arm's own sleeve in tunic wool, with the linen shirt cuff showing at the wrist. Hands stay separate.
for (const [side, Side] of [['l', 'Left'], ['r', 'Right']]) {
  const source = armSource(side);
  sourcedMesh(`medieval-sleeve-${side}`, source, fromSource(source, cell => HAND_CELLS.includes(cell) ? null : CUFF_CELLS.includes(cell) ? 'linen' : 'tunic'));
  sourcedMesh(`anatomy-hand-${Side.toLowerCase()}`, source, fromSource(source, cell => HAND_CELLS.includes(cell) ? 'skin' : null));
}

// Legs: wool hose and leather boots in one piece, cut from the canonical leg so the boots sit exactly on the feet.
const legSource = side => anatomy.getRoot().listNodes()
  .find(node => node.getName() === `Mage_Leg${side === 'l' ? 'Left' : 'Right'}`).getMesh().listPrimitives()[0];
for (const side of ['l', 'r']) {
  const source = legSource(side);
  sourcedMesh(`medieval-leg-${side}`, source, fromSource(source, (cell, y) => TROUSER_CELLS.includes(cell) ? 'trousers'
    : y < .03 ? 'sole' : BOOT_SHAFT_CELLS.includes(cell) ? 'leather' : 'darkLeather'));
}

// Clean up and write GLB
await document.transform(prune());
for (const acc of [...root.listAccessors()]) {
  if (acc.listParents().every(parent => parent === root)) acc.dispose();
}

await mkdir(fileURLToPath(new URL('wardrobe/', models)), { recursive: true });
const targetGlb = fileURLToPath(new URL('wardrobe/medieval.glb', models));
await io.write(targetGlb, document);
console.log(`Successfully built medieval.glb: ${targetGlb}`);

