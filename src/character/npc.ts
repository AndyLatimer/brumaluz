import { Character } from './character';
import { npcBuildOptions, npcCharacter, validateNpc, type NpcDefinition } from '../data/npcs';
import { loadNpcClothing, npcClothingRenderer } from './npcClothing';
import {loadCharacterModels} from './equipmentModels';

/** Instantiate a registered definition; placement and behavior remain the caller's responsibility. */
export async function createNpc(definition: NpcDefinition) {
  const npc = validateNpc(definition);
  const data=npcCharacter(npc);
  await Promise.all([loadNpcClothing(npc.render.clothing),loadCharacterModels(data)]);
  return new Character(data, { ...npcBuildOptions(npc), clothing: npcClothingRenderer(npc.render.clothing) });
}
