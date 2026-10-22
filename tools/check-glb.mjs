import { readFileSync } from 'node:fs';
import { Document, NodeIO } from '@gltf-transform/core';
import { getBounds } from '@gltf-transform/functions';

const file = process.argv[2] || 'x:/projects/brumaluz/src/assets/library/medieval-builder/objects/bridge_wooden.glb';
const doc = await new NodeIO().read(file);
const root = doc.getRoot();
console.log('file:', file);
console.log('scenes:', root.listScenes().map((s) => s.getName()));
const nodes = root.listNodes();
for (const scene of root.listScenes()) {
  console.log('nodes:', nodes.map((n) => n.getName()).join(', '));
}
console.log('meshes:', root.listMeshes().length);
const fmt = v => (Array.isArray(v) ? v : [v.x, v.y, v.z]).map(n => Number(n).toFixed(3)).join(', ');
const bounds = nodes
  .map((n) => {
    const b = getBounds(n);
    return `${n.getName()}: min(${fmt(b.min)}) max(${fmt(b.max)})`;
  })
  .join('\n  ');
console.log('node bounds:\n  ', bounds);
console.log('materials:', root.listMaterials().map((m) => `${m.getName()}[${m.getBaseColorFactor().map((v) => v.toFixed(3)).join(',')}]`).join(' | '));
