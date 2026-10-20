import { NodeIO } from '@gltf-transform/core';
import { prune } from '@gltf-transform/functions';
import { fileURLToPath } from 'node:url';

const io = new NodeIO();
const asset = name => fileURLToPath(new URL(`../src/assets/${name}`, import.meta.url));
const reference = (await io.read(asset('models/Mage.glb'))).getRoot();
const document = await io.read(asset('library/adventurers/animations/Rig_Medium_General.glb'));
const targets = new Map(reference.listNodes().map(node => [node.getName(), node]));
const keep = new Set(['Idle_B', 'Hit_B']);
for (const animation of document.getRoot().listAnimations()) {
  if (!keep.has(animation.getName())) { animation.dispose(); continue; }
  for (const channel of animation.listChannels()) {
    const source = channel.getTargetNode();
    const target = targets.get(source.getName());
    if (!target || source.getMatrix().some((value, index) => Math.abs(value - target.getMatrix()[index]) > 1e-5)) {
      throw new Error(`Incompatible animation target: ${source.getName()}`);
    }
  }
}
for (const node of document.getRoot().listNodes()) node.setMesh(null).setSkin(null);
await document.transform(prune());
await io.write(asset('models/ambient-animations.glb'), document);
console.log('ambient-animations.glb: Idle_B, Hit_B; compatible rig, no meshes or textures.');
