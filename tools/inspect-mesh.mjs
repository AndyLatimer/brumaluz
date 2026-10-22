import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const file = process.argv[2];
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(file);
const root = doc.getRoot();
console.log('file:', file);
console.log('textures:', root.listTextures().map(t =>
  `${t.getName()}[${t.getSize()?.join('x') ?? '?'} mime=${t.getMimeType()}]`).join(' | ') || '(none)');
console.log('materials:');
for (const m of root.listMaterials()) {
  console.log(`  ${m.getName()} base=${m.getBaseColorFactor().map(v => v.toFixed(3)).join(',')} rough=${m.getRoughnessFactor()}` +
    ` tex=${m.getBaseColorTexture() ? 'yes' : 'no'} alpha=${m.getAlphaMode()}`);
}
console.log('meshes:');
for (const mesh of root.listMeshes()) {
  console.log(`  ${mesh.getName()} primitives=${mesh.listPrimitives().length}`);
  for (const p of mesh.listPrimitives()) {
    const attrs = p.listSemantics();
    const uv = p.getAttribute('TEXCOORD_0');
    const color = p.getAttribute('COLOR_0');
    console.log(`    ${p.getMaterial()?.getName()} attrs=[${attrs}] verts=${p.getAttribute('POSITION').getCount()}` +
      ` uv=${uv ? 'yes' : 'no'} color=${color ? 'yes' : 'no'}` +
      (uv ? ` uvRange=[${Math.min(...uv.getArray()).toFixed(3)}, ${Math.max(...uv.getArray()).toFixed(3)}]` : ''));
    if (color) {
      const arr = color.getArray();
      const uniq = new Set();
      for (let i = 0; i < arr.length; i += 4) uniq.add(`${arr[i].toFixed(2)},${arr[i+1].toFixed(2)},${arr[i+2].toFixed(2)}`);
      console.log(`      colors=${uniq.size} sample=${[...uniq].slice(0, 4).join(' | ')}`);
    }
  }
}
