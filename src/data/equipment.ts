import type { CharData, ClassId } from './data';
import { INVENTORY_UNLOCKED, type EquipmentSlot, type ItemStack } from './inventory';
import { WEAPONS } from './weapons';
import { OUTFITS } from './outfits';

export const EQUIPPABLE: Record<string, { slot: EquipmentSlot; cls: ClassId }> = { ...WEAPONS, ...OUTFITS };

export function hasCombatWeapon(data: Pick<CharData, 'cls' | 'equipment'>) {
  const id = data.equipment.weapon?.id;
  return !!id && data.equipment.weapon?.count === 1 && EQUIPPABLE[id]?.slot === 'weapon' && EQUIPPABLE[id].cls === data.cls;
}

export function transferEquipment(data: CharData, slot: EquipmentSlot, bag: number | null, expected: ItemStack) {
  if (data.health === 0) throw new Error('Debes volver a la vida para cambiar tu equipo.');
  const source = bag === null ? data.equipment[slot] : data.inventory[bag];
  if (!source || source.id !== expected.id || source.count !== expected.count || !!source.bound !== !!expected.bound)
    throw new Error('Tu equipo o mochila ha cambiado. Vuelve a intentarlo.');
  if (bag === null) {
    const free = data.inventory.findIndex((item, index) => index < INVENTORY_UNLOCKED && !item);
    if (free < 0) throw new Error('Tu mochila está llena.');
    data.inventory[free] = source; data.equipment[slot] = null;
  } else {
    if (!Number.isInteger(bag) || bag < 0 || bag >= INVENTORY_UNLOCKED) throw new Error('Ese objeto no existe.');
    if (source.count !== 1 || EQUIPPABLE[source.id]?.slot !== slot || EQUIPPABLE[source.id]?.cls !== data.cls)
      throw new Error('Ese objeto no se puede equipar en esta ranura con tu clase.');
    const target = data.equipment[slot];
    data.equipment[slot] = source; data.inventory[bag] = target;
  }
}
