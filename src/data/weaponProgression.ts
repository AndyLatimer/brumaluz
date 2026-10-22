import source from './weaponProgression.json';
import type { ClassId } from './data';
import type { WeaponTier } from './itemRarity';

/** Fuente compartida por el catálogo de juego y el generador Blender de los 24 modelos nuevos. */
export const ADVANCED_WEAPONS = source.tiers.flatMap(tier => source.families.map(family => ({
  id: `${family.stem}_t${tier.tier}`,
  label: `${family.label} ${tier.suffix}`,
  reference: family.reference,
  starter: family.starter,
  value: family.value * tier.priceMultiplier,
  weapon: {
    cls: family.cls as ClassId,
    slot: family.slot as 'weapon' | 'offhand',
    kind: family.kind as 'sword' | 'shield' | 'staff' | 'dagger' | 'wand' | 'book' | 'crossbow',
    tier: tier.tier as WeaponTier,
    ...(family.power ? { power: family.power + tier.power } : {}),
    ...(family.kind === 'shield' || (family.kind === 'dagger' && family.slot === 'offhand') ? { guard: tier.guard } : {}),
    ...(family.kind === 'wand' ? { healing: tier.wandHealing } : family.kind === 'book' ? { healing: tier.bookHealing } : {}),
  },
})));
