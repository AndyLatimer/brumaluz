// Medidas (sin escalar) de las piezas de city.glb y de la biblioteca: node tools/asset-bounds.mjs [filtro]
import { NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { readLibraryCatalog } from './library-catalog.mjs';

/** Igual que FOOTPRINT_HEIGHT en src/world/mapAssetsCore.ts. */
const FOOTPRINT_HEIGHT = 0.3;
const SKIP = /windmill_top_fan|watermill_wheel/;

/** Caja de todos los vértices de unos nodos y, con `footprint`, planta solo de los de abajo (ver `footprintOf`). */
function measure(nodes, footprint) {
  const points = [], element = [];
  for (const root of nodes) root.traverse(node => {
    if (SKIP.test(node.getName())) return;
    const matrix = new THREE.Matrix4().fromArray(node.getWorldMatrix());
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      const positions = primitive.getAttribute('POSITION');
      if (!positions) continue;
      for (let i = 0; i < positions.getCount(); i++) points.push(new THREE.Vector3().fromArray(positions.getElement(i, element)).applyMatrix4(matrix));
    }
  });
  const box = new THREE.Box3().setFromPoints(points);
  if (!footprint || box.isEmpty()) return box;
  const cut = box.min.y + (box.max.y - box.min.y) * FOOTPRINT_HEIGHT;
  const foot = new THREE.Box3().setFromPoints(points.filter(point => point.y <= cut));
  box.min.x = foot.min.x; box.max.x = foot.max.x; box.min.z = foot.min.z; box.max.z = foot.max.z;
  return box;
}

/**
 * Cajas de las piezas. Con `footprint` son las de colisión del juego (planta a ras de suelo); `only` limita las
 * piezas de la biblioteca que se leen enteras (sin él se usan las medidas del catálogo).
 */
export async function assetBoxes({ footprint = false, only } = {}) {
  const boxes = new Map();
  const city = await new NodeIO().read('src/assets/models/city.glb');
  for (const root of city.getRoot().listScenes()[0].listChildren()) {
    root.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
    boxes.set(`city/${root.getName()}`, measure([root], footprint));
  }
  boxes.set('builtin/bench', footprint
    ? new THREE.Box3(new THREE.Vector3(-.63, 0, -.19), new THREE.Vector3(.63, 1.09, .19))
    : new THREE.Box3(new THREE.Vector3(-.725, 0, -.21), new THREE.Vector3(.725, 1.09, .21)));
  boxes.set('builtin/lamppost', footprint
    ? new THREE.Box3(new THREE.Vector3(-.09, 0, -.09), new THREE.Vector3(.09, 3.15, .09))
    : new THREE.Box3(new THREE.Vector3(-.14, 0, -.14), new THREE.Vector3(.14, 3.15, .14)));
  const catalog = await readLibraryCatalog('src/assets/library');
  for (const asset of catalog.assets) {
    if (footprint && only?.has(asset.id)) {
      const doc = await new NodeIO().read(`src/assets/library/${asset.path}`);
      boxes.set(asset.id, measure(doc.getRoot().listScenes()[0].listChildren(), true));
    } else boxes.set(asset.id, new THREE.Box3(new THREE.Vector3(...asset.bounds.min), new THREE.Vector3(...asset.bounds.max)));
  }
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
