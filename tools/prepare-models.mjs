// Prepara los modelos KayKit (CC0, Kay Lousberg): quita animaciones duplicadas,
// deja sólo las necesarias en el modelo base y comprime.
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup } from '@gltf-transform/functions';
import path from 'path';

const SRC = process.argv[2];
const OUT = 'src/assets/models';
const KEEP = new Set(['Idle', 'Unarmed_Idle', '2H_Melee_Idle', 'Cheer', 'Interact', 'Walking_A', 'Walking_B', 'Running_A',
  'Spellcasting', 'Spellcast_Raise', 'Jump_Full_Short', 'Sit_Chair_Idle', 'Sit_Floor_Idle', 'Use_Item', 'Block', 'PickUp',
  '1H_Melee_Attack_Slice_Diagonal', '2H_Melee_Attack_Spin', 'Hit_A', 'Death_A', 'Dodge_Forward']);
const io = new NodeIO();
for (const name of ['Mage', 'Knight', 'Rogue', 'Barbarian']) {
  const doc = await io.read(path.join(SRC, name + '.glb'));
  for (const a of doc.getRoot().listAnimations()) {
    if (name === 'Mage' && KEEP.has(a.getName())) continue;
    for (const s of a.listSamplers()) s.dispose();
    for (const c of a.listChannels()) c.dispose();
    a.dispose();
  }
  await doc.transform(prune(), dedup());
  await io.write(path.join(OUT, name + '.glb'), doc);
}
