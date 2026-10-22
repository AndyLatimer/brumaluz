import source from './outfits.json';
import type { ClassId } from './data';
import type { Equipment } from './inventory';
import { rarityForTier, ITEM_RARITIES, type WeaponTier } from './itemRarity';

export const OUTFITS = Object.fromEntries(source.map(item => [item.id, {
  ...item, cls: item.cls as ClassId, slot: 'chest' as const, tier: item.tier as WeaponTier,
}]));
export function equippedOutfit(cls: ClassId, equipment: Equipment) {
  const stack = equipment.chest, outfit = stack && OUTFITS[stack.id];
  return stack?.count === 1 && outfit?.cls === cls ? outfit : undefined;
}
export const outfitItemStats = (id: string) => {
  const item = OUTFITS[id];
  return [
    { label: 'Rareza', value: ITEM_RARITIES[rarityForTier(item.tier)].label },
    { label: 'Categoría de equipo', value: String(item.tier) },
    { label: 'Guardia', value: `−${item.guard} daño cuerpo a cuerpo` },
  ];
};
