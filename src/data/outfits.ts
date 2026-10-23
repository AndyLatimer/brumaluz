import source from './outfits.json';
import type { ClassId } from './data';
import type { Equipment } from './inventory';
import { rarityForTier, ITEM_RARITIES, type WeaponTier } from './itemRarity';

export const ARMOR_SLOTS = ['head', 'chest', 'hands', 'legs'] as const;
export type ArmorSlot = typeof ARMOR_SLOTS[number];

export const OUTFITS = Object.fromEntries(source.map(item => [item.id, {
  ...item, cls: item.cls as ClassId, slot: 'chest' as const, tier: item.tier as WeaponTier,
}]));
const names: Record<ArmorSlot,string> = {head:'Tocado',chest:'Pechera',hands:'Guantes',legs:'Piernas y calzado'};
export const ARMOR = Object.fromEntries(Object.values(OUTFITS).flatMap(set => {
  const chest = Math.ceil(set.guard/2), hands = Math.ceil((set.guard-chest)/2);
  const guards = {head:0,chest,hands,legs:set.guard-chest-hands};
  return ARMOR_SLOTS.map(slot => {
    const id=slot==='chest'?set.id:`${set.id}_${slot}`;
    return [id, {...set,id,setId:set.id,slot,label:slot==='chest'?set.label:`${names[slot]} · ${set.label}`,
      guard:guards[slot],maxHealth:slot==='head'?2+set.tier*2:0,maxResource:slot==='legs'?2+set.tier*2:0,
      value:slot==='legs'?Math.max(1,Math.round(set.value*.2))+Math.max(1,Math.round(set.value*.15)):Math.max(1,Math.round(set.value*({head:.15,chest:.5,hands:.15}[slot])))}];
  });
}));
export function equippedArmor(cls: ClassId, equipment: Equipment, slot: ArmorSlot) {
  const stack=equipment[slot],item=stack&&ARMOR[stack.id];
  return stack?.count===1&&item?.cls===cls&&item.slot===slot?item:undefined;
}
export const armorGuard = (cls:ClassId,equipment:Equipment) => ARMOR_SLOTS.reduce((sum,slot)=>sum+(equippedArmor(cls,equipment,slot)?.guard??0),0);
export function equippedOutfit(cls: ClassId, equipment: Equipment) {
  return equippedArmor(cls,equipment,'chest');
}
export const outfitItemStats = (id: string) => {
  const item = ARMOR[id];
  return [
    { label: 'Rareza', value: ITEM_RARITIES[rarityForTier(item.tier)].label },
    { label: 'Categoría de equipo', value: String(item.tier) },
    ...(item.guard ? [{ label: 'Guardia', value: `−${item.guard} daño cuerpo a cuerpo` }] : []),
    ...(item.maxHealth ? [{label:'Vida máxima',value:`+${item.maxHealth}`}] : []),
    ...(item.maxResource ? [{label:'Recurso máximo',value:`+${item.maxResource}`}] : []),
  ];
};
