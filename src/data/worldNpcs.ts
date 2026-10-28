import projectCatalog from './npcs.json';
import { validateNpcCatalog, WORLD_NPC_IDS, type NpcDefinition, type WorldNpcId } from './npcs';

export function loadWorldNpcs() {
  const catalog = validateNpcCatalog(projectCatalog);
  const get = (id: WorldNpcId) => {
    const definition = catalog.npcs.find(npc => npc.id === id);
    if (!definition) throw new Error(`Falta el NPC del mundo "${id}" en src/data/npcs.json.`);
    return definition;
  };
  return Object.fromEntries(WORLD_NPC_IDS.map(id => [id, get(id)])) as Record<WorldNpcId, NpcDefinition>;
}
