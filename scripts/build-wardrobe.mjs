import { NodeIO } from '@gltf-transform/core';
import { prune } from '@gltf-transform/functions';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';

// Offline pattern source. The exported GLB is the editable interchange asset,
// not geometry rebuilt by the game every time a character is created.
const io = new NodeIO();
const models = new URL('../src/assets/models/', import.meta.url);
const document = await io.read(fileURLToPath(new URL('Mage.glb', models)));
const root = document.getRoot();
const skin = root.listSkins()[0];
const rig = root.listNodes().find(node => node.getName() === 'Rig');
const joints = skin.listJoints().map(node => node.getName());
const buffer = root.listBuffers()[0].setName('Helpers wardrobe');
for (const node of [...root.listNodes()]) if (node.getMesh()) node.dispose();
for (const animation of [...root.listAnimations()]) {
  animation.listChannels().forEach(channel => channel.dispose());
  animation.listSamplers().forEach(sampler => sampler.dispose());
  animation.dispose();
}

const colors = {
  linen: '#f3dfb5', blue: '#467baf', trim: '#2b527e',
  leather: '#79523e', sole: '#49372f', brass: '#dbaf58',
  red: '#c94f48', redTrim: '#a73c3b', skin: '#f2c8a0',
};
const materials = new Map(Object.entries(colors).map(([name, color]) => [
  name, document.createMaterial(name)
    .setBaseColorFactor([...new THREE.Color(color).toArray(), 1])
    .setRoughnessFactor(name === 'brass' ? .45 : .9)
    .setMetallicFactor(name === 'brass' ? .35 : 0),
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
    // Recompute after the search: temporary vectors are reused by later candidates.
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
  // Reverse the angular direction so that the garment surface faces outwards.
  const sides = surface(profile.length, columns, (row, t) => {
    const [y, rx, rz, x = 0, z = 0] = profile[row], angle = -t * Math.PI * 2;
    return [x + Math.cos(angle) * rx, y, z + Math.sin(angle) * rz];
  }, true);
  if (!closeStart && !closeEnd) return sides;
  const components = [sides];
  for (const [enabled, section, upwards] of [[closeStart, profile[0], false], [closeEnd, profile.at(-1), true]]) {
    if (!enabled) continue;
    const [y, rx, rz, x = 0, z = 0] = section;
    const positions = [x,y,z], indices = [];
    for (let col = 0; col <= columns; col++) {
      const angle = -col / columns * Math.PI * 2;
      positions.push(x + Math.cos(angle)*rx, y, z + Math.sin(angle)*rz);
      if (col < columns) indices.push(0, upwards ? col+1 : col+2, upwards ? col+2 : col+1);
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
  return new THREE.SphereGeometry(1, 20, 12).scale(rx, ry, rz).translate(x, y, z);
}
function seam(x, y, z, rx, rz, thickness) {
  return new THREE.TorusGeometry(1, thickness, 8, 40).rotateX(Math.PI / 2).scale(rx, 1, rz).translate(x, y, z);
}

const shirtProfile = [[.64,.292,.242],[.82,.31,.26],[1.02,.30,.25],[1.14,.27,.22],[1.22,.17,.15],[1.25,.14,.13]];
function shirtSection(y) {
  const index=shirtProfile.findIndex(section=>section[0]>=y);
  if(index===0)return shirtProfile[0];
  const before=shirtProfile[index-1],after=shirtProfile[index];
  const blend=(y-before[0])/(after[0]-before[0]);
  return [y,THREE.MathUtils.lerp(before[1],after[1],blend),THREE.MathUtils.lerp(before[2],after[2],blend)];
}
const denseShirt = Array.from({length:62},(_,i)=>shirtSection(.64+i*.01));
const shirtSurface = loft(denseShirt);
const fittingMaterial = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
const fittingMesh = new THREE.Mesh(shirtSurface, fittingMaterial);
fittingMesh.updateMatrixWorld(true);
const shoulderSurfaces = [];
const fittingRay = new THREE.Raycaster();
function fitToShirt(x, y, direction, clearance, shoulders = false) {
  fittingRay.set(new THREE.Vector3(x,y,0), direction);
  const hits = fittingRay.intersectObjects(shoulders ? [fittingMesh, ...shoulderSurfaces] : [fittingMesh]);
  const hit = hits.at(-1);
  if (!hit) throw new Error(`No shirt surface at ${x}, ${y}, direction ${direction.toArray()}`);
  return hit.point.addScaledVector(direction, clearance);
}
function bibPoint(x, y, clearance = .012) {
  return fitToShirt(x,y,new THREE.Vector3(0,0,1),clearance).toArray();
}
mesh('helpers-shirt', [
  piece(loft(denseShirt.filter(section=>section[0]>=.85)), 'linen'),
  piece(seam(0,1.235,0,.15,.14,.035), 'linen'),
], torsoWeights);
for (const [side, sign] of [['l', 1], ['r', -1]]) {
  const sleeves = loft([[.08,.14,.14],[.20,.15,.15],[.30,.145,.145],[.38,.14,.14],[.44,.13,.13],[.55,.115,.115],[.70,.105,.105],[.81,.10,.105]], 24);
  // Sleeve patterns use their longitudinal coordinate as the horizontal arm axis.
  const p = sleeves.getAttribute('position');
  const normals = sleeves.getAttribute('normal');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setXYZ(i, sign * y, 1.107 + x, p.getZ(i));
    const nx = normals.getX(i), ny = normals.getY(i);
    normals.setXYZ(i, sign * ny, nx, normals.getZ(i));
  }
  // Mirroring one axis reverses the winding.
  if (sign > 0) {
    const index = sleeves.index;
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i); index.setX(i, index.getX(i + 1)); index.setX(i + 1, a);
    }
  }
  const shoulder = new THREE.Mesh(sleeves.clone(), fittingMaterial);
  shoulder.updateMatrixWorld(true);
  shoulderSurfaces.push(shoulder);
  mesh(`helpers-sleeve-${side}`, [piece(sleeves, 'linen')], transferArmWeights(side));
}

const overalls = [piece(loft([
  [.62,.30,.25],[.82,.316,.266],[.84,.315,.265],
]), 'blue')];
// The bib is a curved panel, not a painted patch on the shirt.
overalls.push(piece(surface(9, 16, (row, t) => {
  const v = row / 8, x = (t * 2 - 1) * (.225 - v * .025);
  return bibPoint(x, .79 + v * .34);
}), 'blue'));
for (const sign of [-1, 1]) {
  overalls.push(piece(surface(33, 4, (row, t) => {
    const angle = row / 32 * Math.PI;
    const x = sign * .165 + (t - .5) * .04;
    const z = Math.abs(Math.cos(angle)) < 1e-10 ? 0 : Math.cos(angle);
    return fitToShirt(x,.82,new THREE.Vector3(0,Math.sin(angle),z),.012,true).toArray();
  }), 'trim'));
  const button = bibPoint(sign*.165,1.085,.019);
  overalls.push(piece(ellipsoid(...button,.027,.027,.012), 'brass'));
}
overalls.push(piece(surface(6, 12, (row, t) => {
  const x = (t * 2 - 1) * .125;
  return bibPoint(x, .87 + row / 5 * .13, .019);
}), 'trim'));
mesh('helpers-overalls', overalls, (position,_index,component) => {
  if (component !== 0) return torsoWeights(position);
  const blend = THREE.MathUtils.smoothstep(position[1],.62,.82);
  const influences = new Map(torsoWeights(position).map(([bone,weight])=>[bone,weight*blend]));
  influences.set('hips',(influences.get('hips')??0)+1-blend);
  return [...influences].filter(([,weight])=>weight>0);
});
shirtSurface.dispose();
shoulderSurfaces.forEach(surface => surface.geometry.dispose());
fittingMaterial.dispose();
for (const [side, sign] of [['l', 1], ['r', -1]]) {
  const x = sign * .171;
  // Both legs share the same hip-weighted crotch boundary; their outer arcs
  // meet the waistband exactly, rather than disappearing into a separate shell.
  const trouser = surface(9,32,(row,t)=>{
    const angle=-t*Math.PI*2, cosine=Math.cos(angle), sine=Math.sin(angle);
    const lower=[x+sign*cosine*.113,.25,sine*.123];
    if(row===0)return [x+sign*cosine*.105,.205,sine*.115];
    const blend=(row-1)/7;
    const upper=[sign*Math.max(0,cosine)*.30,.62+Math.min(0,cosine)*.27,sine*.25];
    return lower.map((value,axis)=>THREE.MathUtils.lerp(value,upper[axis],blend));
  },true);
  if(sign<0){
    const index=trouser.index;
    for(let i=0;i<index.count;i+=3){
      const a=index.getX(i);index.setX(i,index.getX(i+1));index.setX(i+1,a);
    }
    const normals=trouser.getAttribute('normal');
    for(let i=0;i<normals.count;i++)normals.setXYZ(i,-normals.getX(i),-normals.getY(i),-normals.getZ(i));
  }
  mesh(`helpers-trouser-${side}`, [
    piece(trouser, 'blue'),
  ], (position,index)=>{
    const blend=THREE.MathUtils.smoothstep(Math.floor(index/33),2,8);
    const weights=legWeights(side)(position);
    const influences=new Map(weights.map(([bone,weight])=>[bone,weight*(1-blend)]));
    influences.set('hips',(influences.get('hips')??0)+blend);
    return [...influences].filter(([,weight])=>weight>0);
  });
  mesh(`helpers-boot-${side}`, [
    piece(loft([[.018,.08,.15,x,.06],[.035,.135,.205,x,.065],[.09,.14,.205,x,.065],[.14,.128,.17,x,.045],[.18,.117,.125,x],[.25,.12,.125,x],[.265,.125,.13,x]], 32, { closeStart: true }), 'leather'),
    piece(loft([[.012,.09,.16,x,.065],[.025,.14,.212,x,.065],[.052,.14,.212,x,.065]], 32, { closeStart: true, closeEnd: true }), 'sole'),
    piece(seam(x,.25,0,.123,.128,.022), 'leather'),
  ], footWeights(side));
}

// A new cloth silhouette in head-bone space: no KayKit hat geometry.
const hatProfile = [
  [.56,.475,.45,0,-.015],[.60,.48,.45,0,-.015],[.68,.475,.445,0,-.02],
  [.80,.42,.37,-.015,-.025],[.94,.37,.32,-.035,-.035],
  [1.08,.30,.26,-.065,-.045],[1.20,.235,.20,-.11,-.055],
  [1.29,.17,.145,-.17,-.065],[1.32,.12,.105,-.24,-.07],
  [1.29,.08,.075,-.31,-.07],[1.23,.045,.045,-.35,-.065],
  [1.19,.003,.003,-.355,-.06],
];
const crownPath = new THREE.CatmullRomCurve3(hatProfile.map(([y,,,x,z]) => new THREE.Vector3(x,y+.1,z)));
const crownRadius = new THREE.CatmullRomCurve3(hatProfile.map(([,rx,rz]) => new THREE.Vector3(rx,rz,0)));
const smoothCrown = surface(49, 40, (row, fraction) => {
  const t = row / 48, center = crownPath.getPoint(t), radius = crownRadius.getPoint(t);
  const tangent = crownPath.getTangent(t);
  const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0,0,1)).normalize();
  const forward = new THREE.Vector3().crossVectors(right, tangent).normalize();
  const angle = -fraction * Math.PI * 2;
  return center.addScaledVector(right, Math.cos(angle) * Math.max(0,radius.x))
    .addScaledVector(forward, Math.sin(angle) * Math.max(0,radius.y)).toArray();
}, true);
mesh('helpers-soft-cap', [
  piece(smoothCrown, 'red'),
  piece(loft([[.65,.475,.45,0,-.015],[.665,.493,.465,0,-.015],[.70,.495,.465,0,-.015],[.745,.48,.453,0,-.015]],40), 'redTrim'),
], null, 'head');

// Keep only exposed anatomy from the CC0 source, never its clothing.
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
await document.transform(prune());
for (const accessor of [...root.listAccessors()]) {
  if (accessor.listParents().every(parent => parent === root)) accessor.dispose();
}
await mkdir(fileURLToPath(new URL('wardrobe/', models)), { recursive: true });
await io.write(fileURLToPath(new URL('wardrobe/helpers.glb', models)), document);
console.log('Built helpers.glb: independent garments + soft cap, canonical KayKit rig, no runtime pattern generation.');
