import { Character } from './character';
import { npcBuildOptions, npcCharacter, validateNpc, type NpcDefinition } from '../data/npcs';
import { loadNpcClothing, npcClothingRenderer } from './npcClothing';

/** Instantiate a registered definition; placement and behavior remain the caller's responsibility. */
export async function createNpc(definition: NpcDefinition) {
  const npc = validateNpc(definition);
  await loadNpcClothing(npc.render.clothing);
  return new Character(npcCharacter(npc), { ...npcBuildOptions(npc), clothing: npcClothingRenderer(npc.render.clothing) });
}
