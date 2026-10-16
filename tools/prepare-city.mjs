// Junta las piezas usadas del pack "KayKit Medieval Hexagon" (Kay Lousberg, CC0)
// en un único GLB: cada modelo queda como un nodo con su nombre de archivo.
import { NodeIO, Document } from '@gltf-transform/core';
import { mergeDocuments, prune, dedup, weld } from '@gltf-transform/functions';
import path from 'path';

const SRC = process.argv[2];
const OUT = 'src/assets/models/city.glb';
const FILES = [
  'tiles/base/hex_grass', 'tiles/base/hex_water',
  ...'ABCDEFGHIJKLM'.split('').map((c) => 'tiles/roads/hex_road_' + c),
  'tiles/rivers/hex_river_A', 'tiles/rivers/hex_river_crossing_A', 'tiles/rivers/hex_river_B',
  'tiles/coast/hex_coast_A', 'tiles/coast/hex_coast_B', 'tiles/coast/hex_coast_C',
  ...['home_A', 'home_B', 'tavern', 'market', 'blacksmith', 'church', 'castle', 'well', 'windmill', 'watermill',
    'tower_A', 'tower_B', 'lumbermill', 'barracks', 'archeryrange'].map((b) => `buildings/blue/building_${b}_blue`),
  ...['bridge_A', 'grain', 'stage_A', 'fence_wood_straight', 'fence_stone_straight', 'wall_straight', 'wall_straight_gate',
    'wall_corner_A_inside', 'wall_corner_A_outside'].map((b) => 'buildings/neutral/' + (b.startsWith('fence') || b.startsWith('wall') ? b : 'building_' + b)),
  ...['tree_single_A', 'tree_single_B', 'trees_A_large', 'trees_A_medium', 'trees_A_small', 'trees_B_large', 'trees_B_medium',
    'hills_A_trees', 'hills_B_trees', 'hills_C_trees', 'hill_single_A', 'hill_single_B', 'mountain_A_grass_trees', 'mountain_B_grass_trees',
    'mountain_C_grass', 'rock_single_A', 'rock_single_B', 'rock_single_C', 'cloud_big', 'cloud_small', 'waterlily_A', 'waterplant_A'].map((n) => 'decoration/nature/' + n),
  ...['barrel', 'bucket_water', 'crate_A_big', 'crate_A_small', 'crate_B_small', 'crate_long_A', 'flag_blue', 'flag_red', 'flag_yellow',
    'sack', 'tent', 'weaponrack', 'wheelbarrow', 'resource_lumber', 'resource_stone', 'pallet', 'target', 'ladder'].map((n) => 'decoration/props/' + n),
];

const io = new NodeIO();
const doc = new Document();
doc.createBuffer();
const main = doc.createScene('city');
for (const f of FILES) {
  const src = await io.read(path.join(SRC, f + '.gltf'));
  const map = mergeDocuments(doc, src);
  const name = path.basename(f).replace(/^building_/, '').replace(/_blue$/, '');
  const holder = doc.createNode(name);
  for (const s of src.getRoot().listScenes()) {
    const scene = map.get(s);
    for (const n of scene.listChildren()) holder.addChild(n);
    scene.dispose();
  }
  main.addChild(holder);
}
// un solo buffer
const buf = doc.getRoot().listBuffers()[0];
for (const a of doc.getRoot().listAccessors()) a.setBuffer(buf);
for (const b of doc.getRoot().listBuffers()) if (b !== buf) b.dispose();
doc.getRoot().setDefaultScene(main);
await doc.transform(dedup(), weld(), prune());
await io.write(OUT, doc);
console.log('ok', FILES.length, 'modelos');
