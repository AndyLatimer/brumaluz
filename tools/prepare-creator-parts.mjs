import { Document, NodeIO } from '@gltf-transform/core';
import { dedup } from '@gltf-transform/functions';
import { fileURLToPath } from 'node:url';

const asset = name => fileURLToPath(new URL(`../src/assets/${name}`, import.meta.url));
const io = new NodeIO();
const output = new Document();
const buffer = output.createBuffer('Creator');
const scene = output.createScene('Creator parts');
const material = output.createMaterial('Palette supplied by character');
const parts = [
  ['Ranger', 'Ranger_Head', 'ranger-hair', new Set([1, 9])],
  ['Rogue_Hooded', 'RogueHooded_Head', 'rogue-fringe', new Set([1, 9])],
  ['Rogue_Hooded', 'RogueHooded_Mask', 'rogue-mask', null],
];
for (const [character, name, id, cells] of parts) {
  const document = await io.read(asset(`library/adventurers/characters/${character}.glb`));
  const node = document.getRoot().listNodes().find(node => node.getName() === name);
  if (!node || node.getMesh().listPrimitives().length !== 1) throw new Error(`Unexpected source: ${name}`);
  if (node.getMatrix().some((value, index) => Math.abs(value - (index % 5 === 0 ? 1 : 0)) > 1e-5)) {
    throw new Error(`Expected identity mesh transform: ${name}`);
  }
  const source = node.getMesh().listPrimitives()[0];
  const uv = source.getAttribute('TEXCOORD_0'), indices = source.getIndices();
  const count = indices?.getCount() ?? source.getAttribute('POSITION').getCount();
  const selected = [];
  for (let triangle = 0; triangle < count; triangle += 3) {
    const ids = [0, 1, 2].map(offset => indices ? indices.getScalar(triangle + offset) : triangle + offset);
    const palette = ids.map(index => {
      const [u, v] = uv.getElement(index, []);
      return Math.min(7, Math.max(0, Math.floor(v * 8))) * 8 + Math.min(7, Math.max(0, Math.floor(u * 8)));
    });
    const cell = palette[0] === palette[1] || palette[0] === palette[2] ? palette[0] : palette[1];
    if (!cells || cells.has(cell)) selected.push(...ids);
  }
  if (!selected.length) throw new Error(`No selected triangles: ${name}`);
  const primitive = output.createPrimitive().setMaterial(material);
  for (const [semantic, type] of [['POSITION', 'VEC3'], ['NORMAL', 'VEC3'], ['TEXCOORD_0', 'VEC2']]) {
    const accessor = source.getAttribute(semantic);
    const array = new Float32Array(selected.flatMap(index => accessor.getElement(index, [])));
    primitive.setAttribute(semantic, output.createAccessor(`${id}:${semantic}`).setBuffer(buffer).setType(type).setArray(array));
  }
  scene.addChild(output.createNode(id).setMesh(output.createMesh(id).addPrimitive(primitive))
    .setExtras({ source: `adventurers/characters/${character}.glb`, sourceNode: name }));
  console.log(`${id}: ${selected.length / 3} original triangles`);
}
await output.transform(dedup());
await io.write(asset('models/creator-parts.glb'), output);
