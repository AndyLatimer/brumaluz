// Sistema de estadísticas derivadas del personaje (vida, maná, estamina, experiencia).
// Todos los números de equilibrado están en las tablas de abajo: edítalos aquí y se aplican
// en todo el juego. Explicación completa en docs/STATS.md.
import { CharData, ClassId, AttributeId, RACES, ATTRIBUTE_BASE_VALUE } from './data';
import { foodEffect } from './food';
import { equipmentVitalBonus } from './accessories';
import { setBonuses } from './sets';

export type ResourceKind = 'mana' | 'stamina';

/** Recurso que usa cada clase junto a la vida. */
export const CLASS_RESOURCE: Record<ClassId, ResourceKind> = {
  guerrero: 'stamina',
  mago: 'mana',
  picaro: 'stamina',
  clerigo: 'mana',
  explorador: 'stamina',
};

/** Fórmula lineal: base + Σ(atributo × peso) + (nivel - 1) × porNivel. */
export interface StatFormula {
  base: number;
  perLevel: number;
  attributes: Partial<Record<AttributeId, number>>;
}

export const MAX_HEALTH: StatFormula = { base: 60, perLevel: 12, attributes: {} };
export const MAX_RESOURCE: Record<ResourceKind, StatFormula> = {
  mana: { base: 30, perLevel: 6, attributes: { intelecto: 7 } },
  stamina: { base: 50, perLevel: 6, attributes: { agilidad: 3, corpulencia: 3 } },
};

/** Experiencia para pasar del nivel L al L+1: round(base × L ^ exponent). */
export const XP_CURVE = { base: 100, exponent: 1.5 };

/** Valor total de un atributo: base + bonificación racial + puntos asignados. */
export const attributeTotal = (d: CharData, id: AttributeId) =>
  ATTRIBUTE_BASE_VALUE + RACES[d.race].bonuses[id] + d.attributePoints[id];

export function evaluate(formula: StatFormula, d: CharData) {
  let total = formula.base + (Math.max(d.level, 1) - 1) * formula.perLevel;
  for (const [id, weight] of Object.entries(formula.attributes) as [AttributeId, number][]) total += attributeTotal(d, id) * weight;
  return Math.round(total);
}

/** Sobrecuración: vida curada por encima del máximo. Tope = fracción de la vida máxima; se pierde decayPerSecond por segundo. Igual que en supabase/server/. */
export const OVERHEAL = { maxFraction: 0.3, decayPerSecond: 1 };
export const maxOverhealOf = (d: CharData) => Math.floor(maxHealthOf(d) * OVERHEAL.maxFraction);

export const experienceToNextLevel = (level: number) => Math.round(XP_CURVE.base * Math.pow(Math.max(level, 1), XP_CURVE.exponent));
export const resourceKindOf = (cls: ClassId): ResourceKind => CLASS_RESOURCE[cls];
const withPartyBonus = (value: number, d: CharData) =>
  Math.floor(value * (1000 + Math.min(Math.max(d.partyPeers ?? 0, 0), 3) * 15) / 1000);
export const maxHealthOf = (d: CharData) => Math.floor(withPartyBonus((evaluate(MAX_HEALTH, d) + equipmentVitalBonus(d.cls,d.equipment,'maxHealth')) * (1 + .02 * attributeTotal(d,'corpulencia')) * (1 + setBonuses(d.cls,d.equipment).maxHealth), d) + (foodEffect(d.foodBuff)?.maxHealth ?? 0));
export const maxResourceOf = (d: CharData) => Math.floor(withPartyBonus((evaluate(MAX_RESOURCE[resourceKindOf(d.cls)], d) + equipmentVitalBonus(d.cls,d.equipment,'maxResource')) * (1 + setBonuses(d.cls,d.equipment).maxResource), d) + (foodEffect(d.foodBuff)?.maxResource ?? 0));

export interface Vitals {
  health: number; maxHealth: number; overheal: number;
  resource: number; maxResource: number;
  resourceKind: ResourceKind;
  experience: number; experienceNeeded: number;
}

/** Valores actuales y máximos para la interfaz. `health`/`resource` = -1 significa "al máximo". */
export function vitalsOf(d: CharData): Vitals {
  const maxHealth = maxHealthOf(d), maxResource = maxResourceOf(d);
  const experienceNeeded = experienceToNextLevel(d.level);
  const fit = (value: number, max: number) => (value < 0 ? max : Math.min(value, max));
  return {
    health: fit(d.health, maxHealth), maxHealth, overheal: Math.min(Math.max(d.overheal, 0), maxOverhealOf(d)),
    resource: fit(d.resource, maxResource), maxResource, resourceKind: resourceKindOf(d.cls),
    experience: Math.min(d.experience, experienceNeeded), experienceNeeded,
  };
}
