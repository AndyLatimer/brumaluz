import type { ClassId } from './data';
import type { Equipment } from './inventory';
import { ARMOR, ARMOR_SLOTS } from './outfits';

export const SET_NAMES: Record<ClassId, readonly [string, string]> = {
  guerrero: ['Bastión', 'Vanguardia'], picaro: ['Ofensiva', 'Duelista'],
  mago: ['Evocador', 'Arcanista'], clerigo: ['Custodio', 'Restaurador'],
  explorador: ['Quebrantador', 'Vigía'],
};
// Every visual collection belongs explicitly to one progression family. Existing models are preserved.
export const SET_FAMILIES: Record<string, number> = {
  novicio: 0, artesano: 0, ambar: 0, violeta: 0, aurora: 0, fuego: 0,
  roble: 1, alba: 1, eclipse: 1, marea: 1, forja: 1,
};
function bonusAt(cls:ClassId,family:number,threshold:2|4,tier:number){
 if(threshold===2){const stat=family===1?(cls==='guerrero'?'power':cls==='picaro'?'guard':'maxResource'):cls==='guerrero'?'guard':cls==='clerigo'?'healing':'power';return {stat,value:(tier+1)/100*(stat==='maxResource'?2:1)} as const;}
 const stat=cls==='guerrero'&&family===0?'maxHealth':family===1&&cls!=='guerrero'?'skillCost':'skillPower';
 return {stat,value:stat==='skillPower'?.09+(tier-2)*.05:.05+(tier-2)*.02} as const;
}
export function setBonusDescription(cls:ClassId,family:number,threshold:2|4,tier:number){
 const {stat,value}=bonusAt(cls,family,threshold,tier),percent=Math.round(value*100);
 const labels={power:'potencia de ataque',healing:'potencia de curación',guard:'Guardia',maxHealth:'vida máxima',maxResource:'recurso máximo',skillPower:cls==='clerigo'?'curación de la habilidad':'daño de la habilidad',skillCost:'coste de la habilidad'};
 return `${stat==='skillCost'?'−':'+'}${percent} % ${labels[stat]}`;
}
export function armorSet(id: string) {
  const item = ARMOR[id];
  return item ? { id: `${item.cls}:${SET_FAMILIES[item.collection] ?? 0}`, name: SET_NAMES[item.cls][SET_FAMILIES[item.collection] ?? 0], family: SET_FAMILIES[item.collection] ?? 0, tier: item.tier } : null;
}
export function activeSets(cls: ClassId, equipment: Equipment) {
  const groups = new Map<string, { name: string; family: number; tiers: number[] }>();
  for (const slot of ARMOR_SLOTS) {
    const stack = equipment[slot], item = stack && ARMOR[stack.id], set = stack && armorSet(stack.id);
    if (!item || item.cls !== cls || item.slot !== slot || stack?.count !== 1 || !set) continue;
    const group = groups.get(set.id) ?? { name: set.name, family: set.family, tiers: [] };
    group.tiers.push(set.tier); groups.set(set.id, group);
  }
  return [...groups].map(([id, group]) => {
    const tiers = group.tiers.sort((a, b) => b - a);
    return { id, ...group, count: tiers.length, two: tiers.length >= 2 ? tiers[1] : 0, four: tiers.length === 4 ? tiers[3] : 0 };
  });
}
export function setBonuses(cls: ClassId, equipment: Equipment) {
  const out = { power: 0, healing: 0, guard: 0, maxHealth: 0, maxResource: 0, skillPower: 0, skillCost: 0 };
  for (const set of activeSets(cls, equipment)) {
    if (set.two >= 1) {
      const {stat,value}=bonusAt(cls,set.family,2,set.two);out[stat]+=value;
    }
    if (set.four >= 2) {
      const {stat,value}=bonusAt(cls,set.family,4,set.four);out[stat]+=value;
    }
  }
  return out;
}
