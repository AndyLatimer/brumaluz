// Medidas (sin escalar) de las piezas de city.glb y de la biblioteca: node tools/asset-bounds.mjs [filtro]
import { readFile } from 'node:fs/promises';
import { NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';

export async function assetBoxes() {
  const boxes = new Map();
  const city = await new NodeIO().read('src/assets/models/city.glb');
  for (const root of city.getRoot().listScenes()[0].listChildren()) {
    root.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
    const box = new THREE.Box3();
    root.traverse(node => {
      if (/windmill_top_fan|watermill_wheel/.test(node.getName())) return;
      for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
        const positions = primitive.getAttribute('POSITION');
        if (!positions) continue;
        box.union(new THREE.Box3(new THREE.Vector3(...positions.getMin([])), new THREE.Vector3(...positions.getMax([])))
          .applyMatrix4(new THREE.Matrix4().fromArray(node.getWorldMatrix())));
      }
    });
    boxes.set(`city/${root.getName()}`, box);
  }
  boxes.set('builtin/bench', new THREE.Box3(new THREE.Vector3(-.725, 0, -.21), new THREE.Vector3(.725, 1.09, .21)));
  boxes.set('builtin/lamppost', new THREE.Box3(new THREE.Vector3(-.14, 0, -.14), new THREE.Vector3(.14, 3.15, .14)));
  const catalog = JSON.parse(await readFile('src/assets/library/catalog.json', 'utf8'));
  for (const asset of catalog.assets) boxes.set(asset.id, new THREE.Box3(new THREE.Vector3(...asset.bounds.min), new THREE.Vector3(...asset.bounds.max)));
  return boxes;
}

if (process.argv[1]?.endsWith('asset-bounds.mjs')) {
  const filter = new RegExp(process.argv[2] ?? '.');
  const f = v => v.toFixed(2);
  for (const [id, box] of await assetBoxes()) {
    if (!filter.test(id)) continue;
    const s = box.getSize(new THREE.Vector3());
    console.log(`${id}  size ${f(s.x)} x ${f(s.y)} x ${f(s.z)}  min ${f(box.min.x)},${f(box.min.y)},${f(box.min.z)}`);
  }
}
