import { NodeIO } from '@gltf-transform/core';
import { prune } from '@gltf-transform/functions';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';

// Script to build the classic medieval outfit (Túnica medieval clásica).
// Preserves all existing models, rigs, and assets without deleting anything.
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
  feather: '#d62828',       // Classic crimson feather accent on bycocket
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
function ellipsoid(x, y, z, rx, ry, rz) {
  return new THREE.SphereGeometry(1, 18, 12).scale(rx, ry, rz).translate(x, y, z);
}
function seam(x, y, z, rx, rz, thickness) {
  return new THREE.TorusGeometry(1, thickness, 8, 36).rotateX(Math.PI / 2).scale(rx, 1, rz).translate(x, y, z);
}

// ==========================================
// 1. MEDIEVAL TUNIC & WAISTBELT
// ==========================================
// Profile of the tunic: starts below the knees/mid-thigh (y = .46), expands smoothly over hips,
// is pulled inward at the waist belt (y = .80-.83), expands over chest, and closes cleanly at collar.
const tunicProfile = [
  [.46, .345, .295],          // Flared hem skirt edge
  [.52, .335, .285],          // Lower thigh
  [.62, .310, .260],          // Hips
  [.74, .298, .250],          // Mid torso
  [.80, .290, .245],          // Waist belt level
  [.84, .295, .248],          // Above belt
  [.96, .305, .255],          // Lower chest
  [1.08, .300, .248],         // Mid chest
  [1.16, .265, .218],         // Collarbone
  [1.22, .175, .155],         // Neck base
  [1.25, .145, .135],         // High collar
];

const tunicHem = [
  [.455, .348, .298],
  [.470, .345, .295],
  [.485, .342, .292],
];

// Belt geometry (torus-like band around waist)
const beltBand = seam(0, 0.815, 0, 0.296, 0.252, 0.024);

// Brass Buckle at center-front: x = 0, y = 0.815, z = 0.255
const buckleFrame = new THREE.BoxGeometry(0.08, 0.065, 0.02)
  .translate(0, 0.815, 0.268);
const buckleProng = new THREE.CylinderGeometry(0.005, 0.005, 0.05, 8)
  .translate(0, 0.815, 0.274);
const buckle = mergeGeometries([buckleFrame, buckleProng]);

// Hanging leather belt strap dangling on the left-front
const strapProfile = [
  [0.815, 0.022, 0.006, -0.045, 0.272],
  [0.760, 0.021, 0.006, -0.052, 0.274],
  [0.700, 0.020, 0.006, -0.058, 0.276],
  [0.640, 0.019, 0.006, -0.062, 0.278],
  [0.580, 0.018, 0.006, -0.065, 0.279],
];
const beltStrap = loft(strapProfile, 12, { closeEnd: true });

// Split collar linen underlayer & neck trim
const collarTrim = seam(0, 1.24, 0, 0.146, 0.136, 0.016);
const vNotchLinen = surface(6, 8, (row, t) => {
  const v = row / 5;
  const y = 1.23 - v * 0.12;
  const width = (1 - v * 0.7) * 0.045;
  const x = (t * 2 - 1) * width;
  return [x, y, 0.218 + v * 0.012];
});

// Weighting for the tunic: upper body is chest/spine, waist is spine/hips,
// lower skirt sways gracefully with hips and upper legs
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
  piece(loft(tunicProfile, 36), 'tunic'),
  piece(loft(tunicHem, 36), 'tunicTrim'),
  piece(collarTrim, 'tunicTrim'),
  piece(vNotchLinen, 'linen'),
  piece(beltBand, 'leather'),
  piece(beltStrap, 'leather'),
  piece(buckle, 'brass'),
], medievalTunicWeights);

// ==========================================
// 2. SLEEVES (Tailored wool with linen cuffs)
// ==========================================
for (const [side, sign] of [['l', 1], ['r', -1]]) {
  // Sleeve profiles: start wide at shoulder, taper elegantly towards wrist
  const sleeveWool = loft([
    [.08, .142, .142],
    [.20, .148, .148],
    [.32, .140, .140],
    [.44, .132, .132],
    [.56, .118, .118],
    [.68, .106, .106],
    [.78, .098, .098],
    [.80, .105, .105], // Cuff fold
  ], 24);

  // Inner linen ruffle extending slightly at wrist
  const cuffLinen = loft([
    [.79, .097, .097],
    [.81, .102, .102],
  ], 24);

  const mergedSleeves = mergeGeometries([sleeveWool, cuffLinen]);
  sleeveWool.dispose();
  cuffLinen.dispose();

  // Position along the arm axis
  const pos = mergedSleeves.getAttribute('position');
  const nrm = mergedSleeves.getAttribute('normal');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setXYZ(i, sign * y, 1.107 + x, pos.getZ(i));
    const nx = nrm.getX(i), ny = nrm.getY(i);
    nrm.setXYZ(i, sign * ny, nx, nrm.getZ(i));
  }
  if (sign > 0) {
    const idx = mergedSleeves.index;
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i); idx.setX(i, idx.getX(i + 1)); idx.setX(i + 1, a);
    }
  }

  mesh(`medieval-sleeve-${side}`, [
    piece(mergedSleeves, 'tunic'),
  ], transferArmWeights(side));
}

// ==========================================
// 3. ANATOMY HANDS (From canonical Mage.glb)
// ==========================================
for (const side of ['Left', 'Right']) {
  const source = armSource(side === 'Left' ? 'l' : 'r');
  const positions = source.getAttribute('POSITION'), uv = source.getAttribute('TEXCOORD_0');
  const indices = source.getIndices(), values = [], originalVertices = [];
  for (let i = 0; i < (indices?.getCount() ?? positions.getCount()); i += 3) {
    const triangle = [0,1,2].map(offset => indices ? indices.getScalar(i + offset) : i + offset);
    if (!triangle.every(index => {
      const tex = uv.getElement(index, []);
      return [0,8,39,47].includes(Math.min(7,Math.floor(tex[1]*8))*8+Math.min(7,Math.floor(tex[0]*8)));
    })) continue;
    for (const index of triangle) {
      values.push(...positions.getElement(index, []));
      originalVertices.push(index);
    }
  }
  const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(values, 3));
  mesh(`anatomy-hand-${side.toLowerCase()}`, [piece(geometry, 'skin')], (_position, index) => referenceWeights(source, originalVertices[index]));
}

// ==========================================
// 4. TROUSERS / MEDIEVAL HOSE (Calzas)
// ==========================================
for (const [side, sign] of [['l', 1], ['r', -1]]) {
  const x = sign * .171;
  const trouser = surface(9, 32, (row, t) => {
    const angle = -t * Math.PI * 2, cosine = Math.cos(angle), sine = Math.sin(angle);
    const lower = [x + sign * cosine * .113, .22, sine * .123];
    if (row === 0) return [x + sign * cosine * .105, .195, sine * .115];
    const blend = (row - 1) / 7;
    const upper = [sign * Math.max(0, cosine) * .30, .62 + Math.min(0, cosine) * .27, sine * .25];
    return lower.map((value, axis) => THREE.MathUtils.lerp(value, upper[axis], blend));
  }, true);

  if (sign < 0) {
    const index = trouser.index;
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i); index.setX(i, index.getX(i + 1)); index.setX(i + 1, a);
    }
    const normals = trouser.getAttribute('normal');
    for (let i = 0; i < normals.count; i++) normals.setXYZ(i, -normals.getX(i), -normals.getY(i), -normals.getZ(i));
  }

  mesh(`medieval-trouser-${side}`, [
    piece(trouser, 'trousers'),
  ], (position, index) => {
    const blend = THREE.MathUtils.smoothstep(Math.floor(index / 33), 2, 8);
    const weights = legWeights(side)(position);
    const influences = new Map(weights.map(([bone, weight]) => [bone, weight * (1 - blend)]));
    influences.set('hips', (influences.get('hips') ?? 0) + blend);
    return [...influences].filter(([, weight]) => weight > 0);
  });

  // ==========================================
  // 5. MEDIEVAL CUFFED BOOTS (Turnshoes)
  // ==========================================
  // Elegant cuffed ankle boots with folded leather turnover top
  const bootBody = loft([
    [.018, .082, .152, x, .06],
    [.035, .136, .206, x, .065],
    [.090, .140, .206, x, .065],
    [.140, .128, .170, x, .045],
    [.180, .117, .125, x],
    [.230, .120, .125, x],
    [.250, .125, .130, x],
  ], 32, { closeStart: true });

  // Folded turnover leather cuff around the upper boot
  const bootCuff = loft([
    [.245, .124, .128, x],
    [.265, .135, .140, x],
    [.255, .138, .143, x],
  ], 32);

  // Closed opaque sole with outward-facing bottom cap at y = .012
  const bootSole = loft([
    [.012, .090, .160, x, .065],
    [.025, .140, .212, x, .065],
    [.052, .140, .212, x, .065],
  ], 32, { closeStart: true, closeEnd: true });

  const bootCuffRim = seam(x, .260, 0, .132, .138, .016);

  mesh(`medieval-boot-${side}`, [
    piece(bootBody, 'leather'),
    piece(bootSole, 'sole'),
    piece(bootCuff, 'darkLeather'),
    piece(bootCuffRim, 'darkLeather'),
  ], footWeights(side));
}

// ==========================================
// 6. CLASSIC MEDIEVAL BYCOCKET HAT (Gorro medieval con pluma)
// ==========================================
// Robin Hood / medieval traveler bycocket: stylish folded brim upturned at the back,
// sharp forward-pointing brim, resting naturally on head bone (hairFit: 'cap')
const hatProfile = [
  [.56, .460, .440, 0, -.015],
  [.60, .470, .445, 0, -.015],
  [.68, .465, .440, 0, -.020],
  [.78, .410, .360, -.010, -.025],
  [.90, .340, .290, -.025, -.030],
  [1.02, .260, .220, -.050, -.040],
  [1.12, .180, .150, -.080, -.045],
  [1.20, .090, .070, -.120, -.050],
  [1.24, .010, .010, -.140, -.050],
];

const hatPath = new THREE.CatmullRomCurve3(hatProfile.map(([y,,,x,z]) => new THREE.Vector3(x, y + 0.08, z)));
const hatRadius = new THREE.CatmullRomCurve3(hatProfile.map(([,rx,rz]) => new THREE.Vector3(rx, rz, 0)));
const bycocketCrown = surface(41, 36, (row, fraction) => {
  const t = row / 40, center = hatPath.getPoint(t), radius = hatRadius.getPoint(t);
  const tangent = hatPath.getTangent(t);
  const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 0, 1)).normalize();
  const forward = new THREE.Vector3().crossVectors(right, tangent).normalize();
  const angle = -fraction * Math.PI * 2;
  return center.addScaledVector(right, Math.cos(angle) * Math.max(0, radius.x))
    .addScaledVector(forward, Math.sin(angle) * Math.max(0, radius.y)).toArray();
}, true);

// Upturned brim at back & pointed front
const brimProfile = [
  [.62, .465, .440, 0, -.015],
  [.64, .485, .460, 0, -.010],
  [.68, .490, .480, 0, .020], // extended forward peak
  [.72, .470, .450, 0, -.010],
];
const bycocketBrim = loft(brimProfile, 36);

// Crimson feather on the left brim
const featherCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-0.35, 0.70, 0.0),
  new THREE.Vector3(-0.38, 0.85, -0.08),
  new THREE.Vector3(-0.39, 1.02, -0.20),
  new THREE.Vector3(-0.37, 1.15, -0.32),
]);
const featherGeometry = new THREE.TubeGeometry(featherCurve, 16, 0.018, 8, false);

// Brass clasp pin securing feather
const brooch = ellipsoid(-0.35, 0.70, 0.0, 0.035, 0.035, 0.02);

mesh('medieval-hat', [
  piece(bycocketCrown, 'tunic'),
  piece(bycocketBrim, 'darkLeather'),
  piece(featherGeometry, 'feather'),
  piece(brooch, 'brass'),
], null, 'head');

// Clean up and write GLB
await document.transform(prune());
for (const acc of [...root.listAccessors()]) {
  if (acc.listParents().every(parent => parent === root)) acc.dispose();
}

await mkdir(fileURLToPath(new URL('wardrobe/', models)), { recursive: true });
const targetGlb = fileURLToPath(new URL('wardrobe/medieval.glb', models));
await io.write(targetGlb, document);
console.log(`Successfully built medieval.glb: ${targetGlb}`);

