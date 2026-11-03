import type { CharData, ClassId } from './data';
import { INVENTORY_UNLOCKED, sameStack, type EquipmentSlot, type ItemStack } from './inventory';
import { WEAPONS } from './weapons';
import { ARMOR } from './outfits';
import { ACCESSORIES } from './accessories';
import { vitalsOf } from './stats';

import itemsCatalog from './itemsCatalog.json';

export const EQUIPPABLE: Record<string, { slot: EquipmentSlot; cls?: ClassId }> = { ...WEAPONS, ...ARMOR, ...ACCESSORIES };

for (const custom of ((itemsCatalog as any).items || [])) {
  if (custom && custom.active !== false && custom.equippable && custom.slot) {
    EQUIPPABLE[custom.id] = {
      ...EQUIPPABLE[custom.id],
      slot: custom.slot,
      cls: custom.requiredClass && custom.requiredClass !== 'any' ? custom.requiredClass : undefined,
    };
  }
}

export function hasCombatWeapon(data: Pick<CharData, 'cls' | 'equipment'>) {
  const id = data.equipment.weapon?.id;
  return !!id && data.equipment.weapon?.count === 1 && EQUIPPABLE[id]?.slot === 'weapon' && EQUIPPABLE[id].cls === data.cls;
}

export function transferEquipment(data: CharData, slot: EquipmentSlot, bag: number | null, expected: ItemStack) {
  const before=vitalsOf(data);
  if (data.health === 0) throw new Error('Debes volver a la vida para cambiar tu equipo.');
  const source = bag === null ? data.equipment[slot] : data.inventory[bag];
  if (!source || !sameStack(source,expected))
    throw new Error('Tu equipo o mochila ha cambiado. Vuelve a intentarlo.');
  if (bag === null) {
    const free = data.inventory.findIndex((item, index) => index < INVENTORY_UNLOCKED && !item);
    if (free < 0) throw new Error('Tu mochila está llena.');
    data.inventory[free] = source; data.equipment[slot] = null;
  } else {
    if (!Number.isInteger(bag) || bag < 0 || bag >= INVENTORY_UNLOCKED) throw new Error('Ese objeto no existe.');
    if (source.count !== 1 || EQUIPPABLE[source.id]?.slot !== slot || (EQUIPPABLE[source.id]?.cls && EQUIPPABLE[source.id].cls !== data.cls))
      throw new Error('Ese objeto no se puede equipar en esta ranura con tu clase.');
    const target = data.equipment[slot];
    data.equipment[slot] = { ...source, instanceId: source.instanceId ?? crypto.randomUUID(), bound: true }; data.inventory[bag] = target;
  }
  const after=vitalsOf(data);
  if(slot==='weapon')data.enchantState=undefined;
  data.health=Math.min(before.health,after.maxHealth);data.resource=Math.min(before.resource,after.maxResource);
  data.overheal=Math.min(data.overheal,Math.floor(after.maxHealth*.3));
}
