import source from './accessories.json';
import type { ClassId } from './data';
import { ARMOR } from './outfits';
import type { Equipment } from './inventory';
import type { WeaponTier } from './itemRarity';

export const ACCESSORIES=Object.fromEntries(source.map(item=>[item.id,{...item,tier:item.tier as WeaponTier,slot:item.slot as 'pendant'|'ring'|'trinket'}]));
export function equipmentVitalBonus(cls:ClassId,equipment:Equipment,stat:'maxHealth'|'maxResource') {
  let total=0;
  for(const [slot,stack] of Object.entries(equipment)) {
    if(!stack||stack.count!==1)continue;
    const item=ARMOR[stack.id]??ACCESSORIES[stack.id];
    if(item&&item.slot===slot&&(!('cls' in item)||item.cls===cls))total+=item[stat]??0;
  }
  return total;
}
