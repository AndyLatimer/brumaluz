import projectCatalog from './npcs.json';
import { validateNpcCatalog, type WorldNpcId } from './npcs';

export function loadWorldNpcs() {
  const catalog = validateNpcCatalog(projectCatalog);
  const get = (id: WorldNpcId) => {
    const definition = catalog.npcs.find(npc => npc.id === id);
    if (!definition) throw new Error(`Falta el NPC del mundo "${id}" en src/data/npcs.json.`);
    return definition;
  };
  return { testiculos: get('testiculos'), gnomi: get('gnomi'), isberto: get('isberto') };
}
