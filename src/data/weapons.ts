import type { ClassId } from './data';
import type { Equipment } from './inventory';
import { ITEM_RARITIES, rarityForTier, type WeaponTier } from './itemRarity';
import { ADVANCED_WEAPONS } from './weaponProgression';
import { ORIGINAL_WEAPONS } from './uniqueWeapons';
import { armorGuard } from './outfits';
import { setBonuses } from './sets';
import { perceptionGuard } from './attributeCombat';

export interface WeaponDef {
  cls: ClassId;
  slot: 'weapon' | 'offhand';
  tier: WeaponTier;
  kind: 'sword' | 'shield' | 'staff' | 'dagger' | 'wand' | 'book' | 'crossbow';
  /** Base damage before character level; skills use their existing class coefficient. */
  power?: number;
  /** Defense rating; mitigation is capped at 60%, with diminishing returns. */
  guard?: number;
  /** Flat contribution to the cleric's healing, before skill rank. */
  healing?: number;
}

export const WEAPONS: Record<string, WeaponDef> = {
  espada_inicial: { cls: 'guerrero', slot: 'weapon', tier: 0, kind: 'sword', power: 10 },
  escudo_inicial: { cls: 'guerrero', slot: 'offhand', tier: 0, kind: 'shield', guard: 1 },
  baston_inicial: { cls: 'mago', slot: 'weapon', tier: 0, kind: 'staff', power: 10 },
  daga_inicial: { cls: 'picaro', slot: 'weapon', tier: 0, kind: 'dagger', power: 8 },
  daga_secundaria_inicial: { cls: 'picaro', slot: 'offhand', tier: 0, kind: 'dagger', guard: 1 },
  varita_inicial: { cls: 'clerigo', slot: 'weapon', tier: 0, kind: 'wand', power: 11, healing: 30 },
  libro_inicial: { cls: 'clerigo', slot: 'offhand', tier: 0, kind: 'book', healing: 2 },
  ballesta_inicial: { cls: 'explorador', slot: 'weapon', tier: 0, kind: 'crossbow', power: 10 },
  espada_cobre_t1: { cls: 'guerrero', slot: 'weapon', tier: 1, kind: 'sword', power: 11 },
  escudo_roble_t1: { cls: 'guerrero', slot: 'offhand', tier: 1, kind: 'shield', guard: 2 },
  baston_ambar_t1: { cls: 'mago', slot: 'weapon', tier: 1, kind: 'staff', power: 11 },
  daga_cazador_t1: { cls: 'picaro', slot: 'weapon', tier: 1, kind: 'dagger', power: 9 },
  daga_secundaria_cazador_t1: { cls: 'picaro', slot: 'offhand', tier: 1, kind: 'dagger', guard: 2 },
  varita_ambar_t1: { cls: 'clerigo', slot: 'weapon', tier: 1, kind: 'wand', power: 12, healing: 33 },
  grimorio_verde_t1: { cls: 'clerigo', slot: 'offhand', tier: 1, kind: 'book', healing: 3 },
  ballesta_roble_t1: { cls: 'explorador', slot: 'weapon', tier: 1, kind: 'crossbow', power: 11 },
  espada_cobre_t2: { cls: 'guerrero', slot: 'weapon', tier: 2, kind: 'sword', power: 12 },
  escudo_roble_t2: { cls: 'guerrero', slot: 'offhand', tier: 2, kind: 'shield', guard: 3 },
  baston_ambar_t2: { cls: 'mago', slot: 'weapon', tier: 2, kind: 'staff', power: 12 },
  daga_cazador_t2: { cls: 'picaro', slot: 'weapon', tier: 2, kind: 'dagger', power: 10 },
  daga_secundaria_cazador_t2: { cls: 'picaro', slot: 'offhand', tier: 2, kind: 'dagger', guard: 3 },
  varita_ambar_t2: { cls: 'clerigo', slot: 'weapon', tier: 2, kind: 'wand', power: 13, healing: 36 },
  grimorio_verde_t2: { cls: 'clerigo', slot: 'offhand', tier: 2, kind: 'book', healing: 4 },
  ballesta_roble_t2: { cls: 'explorador', slot: 'weapon', tier: 2, kind: 'crossbow', power: 12 },
  ...Object.fromEntries(ADVANCED_WEAPONS.map(item => [item.id, item.weapon])),
  ...Object.fromEntries(ORIGINAL_WEAPONS.map(item => [item.id, item.weapon])),
};

export function equippedWeapon(cls: ClassId, equipment: Equipment, slot: 'weapon' | 'offhand') {
  const stack = equipment[slot], def = stack && WEAPONS[stack.id];
  return def && stack?.count === 1 && def.cls === cls && def.slot === slot ? def : undefined;
}

export function guardedDamage(cls: ClassId, equipment: Equipment, incoming: number,data?:import('./data').CharData) {
  if (incoming <= 0) return 0;
  const guard = ((equippedWeapon(cls, equipment, 'offhand')?.guard ?? 0) + armorGuard(cls,equipment)) * (1 + setBonuses(cls,equipment).guard);
  return incoming * (1 - Math.min(.6,guard/(guard+20)))*(data?perceptionGuard(data):1);
}

export function weaponItemStats(id: string) {
  const w = WEAPONS[id];
  if (!w) return [];
  return [
    { label: 'Rareza', value: ITEM_RARITIES[rarityForTier(w.tier)].label },
    { label: 'Categoría de equipo', value: String(w.tier) },
    ...(w.power ? [{ label: 'Potencia del arma', value: String(w.power) }] : []),
    ...(w.guard ? [{ label: 'Guardia', value: `+${w.guard}` }] : []),
    ...(w.healing ? [{ label: 'Poder de curación', value: `+${w.healing}` }] : []),
  ];
}
