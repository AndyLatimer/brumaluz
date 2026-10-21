import { NodeIO } from '@gltf-transform/core';
import { mergeDocuments, prune } from '@gltf-transform/functions';
import { fileURLToPath } from 'node:url';

const io = new NodeIO();
const asset = name => fileURLToPath(new URL(`../src/assets/${name}`, import.meta.url));
const reference = (await io.read(asset('models/Mage.glb'))).getRoot();
const targets = new Map(reference.listNodes().map(node => [node.getName(), node]));
/** Clips que se añaden al personaje, por archivo de origen. Crawling se usa, tumbado a ras de agua, para nadar. */
const SOURCES = [
  ['library/adventurers/animations/Rig_Medium_General.glb', ['Idle_B', 'Hit_B']],
  ['library/character-animations/animations/Rig_Medium_MovementAdvanced.glb', ['Crawling']],
];

const document = await io.read(asset(SOURCES[0][0]));
const skeleton = new Map(document.getRoot().listNodes().map(node => [node.getName(), node]));
for (const [index, [file]] of SOURCES.entries()) {
  if (index === 0) continue;
  const extra = await io.read(asset(file));
  mergeDocuments(document, extra);
}
const keep = new Set(SOURCES.flatMap(([, clips]) => clips));
const kept = new Set();
for (const animation of document.getRoot().listAnimations()) {
  if (!keep.has(animation.getName()) || kept.has(animation.getName())) { animation.dispose(); continue; }
  kept.add(animation.getName());
  for (const channel of animation.listChannels()) {
    const source = channel.getTargetNode();
    const target = targets.get(source.getName());
    if (!target || source.getMatrix().some((value, i) => Math.abs(value - target.getMatrix()[i]) > 1e-5)) {
      throw new Error(`Incompatible animation target: ${source.getName()}`);
    }
    // Todos los clips animan el mismo esqueleto (el del primer archivo): los nodos repetidos se descartan.
    channel.setTargetNode(skeleton.get(source.getName()));
  }
}
for (const name of keep) if (!kept.has(name)) throw new Error(`Falta el clip ${name}.`);
for (const scene of document.getRoot().listScenes().slice(1)) scene.dispose();
for (const node of document.getRoot().listNodes()) {
  node.setMesh(null).setSkin(null);
  if (skeleton.get(node.getName()) !== node) node.dispose();
}
// Un GLB solo admite un búfer: todo pasa al primero.
const [buffer] = document.getRoot().listBuffers();
for (const accessor of document.getRoot().listAccessors()) accessor.setBuffer(buffer);
await document.transform(prune());
await io.write(asset('models/ambient-animations.glb'), document);
console.log(`ambient-animations.glb: ${[...keep].join(', ')}; compatible rig, no meshes or textures.`);
