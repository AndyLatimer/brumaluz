// Recover the original amber revision as category 2. Keep every binary mesh/material buffer intact.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const archive = new URL('../.art-sources/brumaluz-weapons/before-reference-pass/', import.meta.url);
const output = new URL('../src/assets/models/items/tier2/', import.meta.url);
mkdirSync(output, { recursive: true });
const ids = ['espada_cobre', 'escudo_roble', 'baston_ambar', 'daga_cazador',
  'daga_secundaria_cazador', 'varita_ambar', 'grimorio_verde', 'ballesta_roble'];

for (const base of ids) {
  const original = readFileSync(new URL(`${base}_t1.glb`, archive));
  const chunks = [];
  for (let offset = 12; offset < original.length;) {
    const length = original.readUInt32LE(offset), type = original.readUInt32LE(offset + 4);
    let content = original.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) {
      const gltf = JSON.parse(content.toString('utf8'));
      for (const node of gltf.nodes ?? []) {
        if (node.name) node.name = node.name.replaceAll('_t1', '_t2');
        if (node.extras?.item_id) Object.assign(node.extras, {
          item_id: `${base}_t2`, tier: 2,
          display_name: node.extras.display_name?.replace('Category 1', 'Category 2'),
          model_revision: 'amber-original',
        });
      }
      for (const mesh of gltf.meshes ?? []) if (mesh.name) mesh.name = mesh.name.replaceAll('_t1', '_t2');
      const json = Buffer.from(JSON.stringify(gltf)), padding = (4 - json.length % 4) % 4;
      content = Buffer.concat([json, Buffer.alloc(padding, 0x20)]);
    }
    const header = Buffer.alloc(8); header.writeUInt32LE(content.length); header.writeUInt32LE(type, 4);
    chunks.push(header, content); offset += 8 + length;
  }
  const header = Buffer.from(original.subarray(0, 12));
  header.writeUInt32LE(12 + chunks.reduce((n, chunk) => n + chunk.length, 0), 8);
  writeFileSync(new URL(`${base}_t2.glb`, output), Buffer.concat([header, ...chunks]));
}

// Preserve the original procedural Blender source, with separate output paths and item identities.
const builder = readFileSync(new URL('build-tier1-weapons.py', archive), 'utf8')
  .replaceAll('category 1', 'category 2').replaceAll('Category 1', 'Category 2')
  .replaceAll('build-tier1-weapons.py', 'build-tier2-weapons.py')
  .replaceAll("'tier1'", "'tier2'").replaceAll('_t1', '_t2')
  .replace("root['tier']=1", "root['tier']=2").replaceAll('tier1_', 'tier2_');
writeFileSync(new URL('build-tier2-weapons.py', import.meta.url), builder);
console.log(`Recovered ${ids.length} original amber models to ${fileURLToPath(output)}`);
