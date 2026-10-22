import { NodeIO } from '@gltf-transform/core';
import { getBounds } from '@gltf-transform/functions';

// Perfil lateral de una malla: para cada franja del eje X, el alto minimo y maximo
// de los vertices. Sirve para leer arcos, pendientes y la silueta de un asset.
const file = process.argv[2];
if (!file) {
  console.error('usage: node analyze-profile.mjs <path.glb> [axis=x|y|z] [slabs=12]');
  process.exit(1);
}
const axis = (process.argv[3] || 'x').toLowerCase();
const slabs = Number(process.argv[4] || 12);
const doc = await new NodeIO().read(file);
const root = doc.getRoot();
const index = { x: 0, y: 1, z: 2 }[axis];
const up = { x: 1, y: 2, z: 1 }[axis];

for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const bounds = getBounds(node);
  const min = bounds.min[index], max = bounds.max[index];
  const step = (max - min) / slabs || 1;
  const bins = Array.from({ length: slabs }, () => []);
  for (const primitive of mesh.listPrimitives()) {
    const attribute = primitive.getAttribute('POSITION');
    for (let i = 0; i < attribute.getCount(); i++) {
      const value = attribute.getElement(i, new Array(3));
      const slot = Math.min(slabs - 1, Math.max(0, Math.floor((value[index] - min) / step)));
      bins[slot].push(value[up]);
    }
  }
  console.log(`\n${node.getName()}  axis=${axis}  range=${min.toFixed(3)}..${max.toFixed(3)}`);
  bins.forEach((values, slot) => {
    if (!values.length) return;
    const lo = Math.min(...values), hi = Math.max(...values);
    const bar = '#'.repeat(Math.max(1, Math.round((hi - lo) / (step || 1) * 4)));
    console.log(`  ${(min + slot * step).toFixed(2).padStart(7)}  ${lo.toFixed(3).padStart(7)}..${hi.toFixed(3).padStart(7)}  ${bar}`);
  });
}
