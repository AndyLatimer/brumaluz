import { Document, NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';

// Offline pattern source for small world props, like build-wardrobe.mjs: the GLB
// is the editable interchange asset (Blender: File > Import > glTF 2.0).
const props = new URL('../src/assets/models/props/', import.meta.url);
const io = new NodeIO();
const document = new Document();
const buffer = document.createBuffer('Props');
const scene = document.createScene('Props');

const palette = {
  leather: ['#8b5a34', .92, 0], leatherDark: ['#5c3820', .95, 0],
  cord: ['#d8b780', .9, 0], gold: ['#e6b445', .38, .55], goldDark: ['#a8762a', .45, .45],
};
const materials = new Map(Object.entries(palette).map(([name, [color, roughness, metallic]]) => [
  name, document.createMaterial(name)
    .setBaseColorFactor([...new THREE.Color(color).toArray(), 1])
    .setRoughnessFactor(roughness).setMetallicFactor(metallic)
    // El cuero es una sola lámina: el volante de la boca se ve por dentro.
    .setDoubleSided(name === 'leather'),
]));

const accessor = (name, array, type) => document.createAccessor(name).setType(type).setArray(array).setBuffer(buffer);
function mesh(name, parts, parent) {
  const output = document.createMesh(name);
  for (const [material, geometry] of Object.entries(parts)) {
    const merged = mergeVertices(geometry.deleteAttribute('uv').deleteAttribute('normal'), 1e-4);
    merged.computeVertexNormals();
    output.addPrimitive(document.createPrimitive()
      .setAttribute('POSITION', accessor(`${name}:${material}:position`, Float32Array.from(merged.getAttribute('position').array), 'VEC3'))
      .setAttribute('NORMAL', accessor(`${name}:${material}:normal`, Float32Array.from(merged.getAttribute('normal').array), 'VEC3'))
      .setIndices(accessor(`${name}:${material}:indices`, Uint16Array.from(merged.index.array), 'SCALAR'))
      .setMaterial(materials.get(material)));
    geometry.dispose(); merged.dispose();
  }
  parent.addChild(document.createNode(name).setMesh(output));
}
const place = (geometry, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1 } = {}) => geometry
  .applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s)));

// ---------------- Bolsa de pelines ----------------
// Saco de cuero cerrado con cordel, boca fruncida con volantes y unas monedas caídas.
// Origen en el suelo, altura ~0.5 m (la insignia de Gnomi mide 0.28 m de diámetro).
function coinBag() {
  const root = document.createNode('coin-bag');
  scene.addChild(root);
  // Perfil (radio, altura) de abajo arriba: base plana, panza, cuello fruncido y boca abierta.
  const profile = [
    [0, 0], [.1, .004], [.17, .03], [.205, .08], [.215, .14], [.2, .21], [.165, .27],
    [.11, .32], [.072, .35], [.066, .37], [.085, .395], [.12, .43], [.135, .46], [.128, .475],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const sack = new THREE.LatheGeometry(profile, 40);
  const p = sack.getAttribute('position'), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const angle = Math.atan2(v.z, v.x), belly = Math.sin(Math.PI * THREE.MathUtils.clamp(v.y / .34, 0, 1));
    // Bultos de monedas en la panza y pliegues en el volante de la boca.
    const lumps = 1 + belly * (.06 * Math.sin(3 * angle + .4) + .035 * Math.sin(5 * angle + 1.3));
    const ruffle = THREE.MathUtils.smoothstep(v.y, .38, .47);
    const fold = Math.sin(7 * angle) * .6 + Math.sin(11 * angle + 1.1) * .4;
    p.setXYZ(i, v.x * lumps * (1 + ruffle * .06 * fold), v.y + ruffle * .012 * fold, v.z * lumps * .94);
  }
  // El interior de la boca: un disco oscuro hundido para que no se vea a través.
  const mouth = place(new THREE.CircleGeometry(.1, 20), { y: .43, rx: -Math.PI / 2 });

  const cord = place(new THREE.TorusGeometry(.073, .014, 8, 28), { y: .362, rx: Math.PI / 2 });
  const knot = place(new THREE.SphereGeometry(.024, 10, 8), { x: .02, y: .36, z: .074 });
  const tail = (side) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(.02, .36, .078), new THREE.Vector3(.02 + side * .03, .32, .1),
      new THREE.Vector3(.02 + side * .045, .26, .118), new THREE.Vector3(.02 + side * .04, .22, .12),
    ]);
    return new THREE.TubeGeometry(curve, 10, .009, 6);
  };
  const tassels = [-1, 1].map(side => place(new THREE.SphereGeometry(.016, 8, 6), { x: .02 + side * .04, y: .215, z: .12 }));

  // Moneda cosida al frente como emblema y montón de pelines caídos al lado.
  const coin = (x, y, z, rx = 0, rz = 0) => place(new THREE.CylinderGeometry(.045, .045, .011, 18), { x, y, z, rx, rz });
  // Emblema: moneda de frente (eje hacia +Z), inclinada como la panza, con aro y la estrella del pelín.
  const tilt = -.12;
  const emblem = coin(0, .17, .205, Math.PI / 2 + tilt);
  const emblemRim = place(new THREE.TorusGeometry(.039, .004, 5, 20), { y: .17, z: .2115, rx: tilt });
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .011 : .025;
    star[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  const emblemStar = place(new THREE.ExtrudeGeometry(star, { depth: .004, bevelEnabled: false }), { y: .17, z: .21, rx: tilt });
  const spilled = [
    coin(.25, .006, .1), coin(.27, .017, .06, .05), coin(.205, .006, .2, 0, .08),
    coin(.29, .006, -.04), coin(.16, .03, .27, 1.2, .3), coin(.06, .44, .03, .5, .2),
  ];

  mesh('coin-bag-sack', { leather: sack }, root);
  mesh('coin-bag-mouth', { leatherDark: mouth }, root);
  mesh('coin-bag-cord', { cord: mergeGeometries([cord, knot, tail(-1), tail(1), ...tassels]) }, root);
  mesh('coin-bag-coins', { gold: mergeGeometries([emblem, ...spilled]), goldDark: mergeGeometries([emblemRim.toNonIndexed(), emblemStar]) }, root);
}

coinBag();
await mkdir(fileURLToPath(props), { recursive: true });
await io.write(fileURLToPath(new URL('coin-bag.glb', props)), document);
console.log('props: coin-bag.glb');
