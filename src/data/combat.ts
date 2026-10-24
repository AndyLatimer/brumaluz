import type { CharData, ClassId } from './data';
import { emptyEquipment, type Equipment } from './inventory';
import { equippedWeapon } from './weapons';
import { attributeTotal } from './stats';
import { setBonuses } from './sets';
import { basicEnchantment } from './enchantments';
import cadence from './combatCadence.json';

export const primaryAttribute = (cls: ClassId) => cls === 'guerrero' ? 'fuerza' : cls === 'mago' || cls === 'clerigo' ? 'intelecto' : 'agilidad';
export const powerMultiplier = (d: CharData) => (1 + .01 * attributeTotal(d,primaryAttribute(d.cls))) * (1 + .02 * (d.level - 1));
export const weaponTempo = (id: string | undefined) => id && /sable|daga_luna|daga_espina/.test(id) ? .85 : id && /meteoro|forja|solar/.test(id) ? 1.15 : 1;
export const attackInterval = (cls: ClassId, equipment?: Equipment) => COMBAT_KITS[cls].interval * weaponTempo(equipment?.weapon?.id);
export const skillCost = (d: CharData) => COMBAT_KITS[d.cls].skill.cost * (1 - setBonuses(d.cls,d.equipment).skillCost);

export type SkillId = 'heavy_strike' | 'arcane_discharge' | 'double_slash' | 'healing' | 'precise_shot';
export const MAX_SKILL_RANK = 5;
export type SkillRanks = Partial<Record<SkillId, number>>;
type SkillProgress = Pick<CharData, 'cls' | 'level' | 'skillRanks'>;
export const skillPointsAllowed = (level: number) => Math.floor(Math.min(50, Math.max(1, level)) / 2);
export const skillRankLevel = (rank: number) => rank === 1 ? 1 : (rank - 1) * 2;
export interface CombatKit {
  weapon: string;
  offhand?: string;
  range: number;
  interval: number;
  damage: number;
  skill: { id: SkillId; label: string; cost: number; cooldown: number; hits: number; power: number; healing?: boolean };
}

/** Shared starting kit; cadence is also compiled into the authoritative SQL. */
export const COMBAT_KITS: Record<ClassId, CombatKit> = {
  guerrero: {
    weapon: 'espada_inicial', offhand: 'escudo_inicial', range: 1.8, interval: cadence.guerrero, damage: 10,
    skill: { id: 'heavy_strike', label: 'Golpe contundente', cost: 15, cooldown: 6, hits: 1, power: 1.8 },
  },
  mago: {
    weapon: 'baston_inicial', range: 6, interval: cadence.mago, damage: 10,
    skill: { id: 'arcane_discharge', label: 'Descarga arcana', cost: 20, cooldown: 7, hits: 1, power: 1.8 },
  },
  picaro: {
    weapon: 'daga_inicial', offhand: 'daga_secundaria_inicial', range: 1.6, interval: cadence.picaro, damage: 8,
    skill: { id: 'double_slash', label: 'Corte doble', cost: 15, cooldown: 4.5, hits: 2, power: 1 },
  },
  clerigo: {
    weapon: 'varita_inicial', offhand: 'libro_inicial', range: 6, interval: cadence.clerigo, damage: 11,
    skill: { id: 'healing', label: 'Curación', cost: 12, cooldown: 6, hits: 1, power: 32/11, healing: true },
  },
  explorador: {
    weapon: 'ballesta_inicial', range: 8, interval: cadence.explorador, damage: 10,
    skill: { id: 'precise_shot', label: 'Disparo preciso', cost: 15, cooldown: 6, hits: 1, power: 1.9 },
  },
};

export function skillRank(data: SkillProgress) {
  const rank = data.skillRanks?.[COMBAT_KITS[data.cls].skill.id];
  return typeof rank === 'number' && Number.isInteger(rank)
    ? Math.max(1, Math.min(rank, MAX_SKILL_RANK, skillPointsAllowed(data.level) + 1)) : 1;
}

export const unspentSkillPoints = (data: SkillProgress) => skillPointsAllowed(data.level) - (skillRank(data) - 1);

export function upgradeSkill(data: SkillProgress, id: SkillId, expectedRank: number) {
  const rank = skillRank(data);
  if (id !== COMBAT_KITS[data.cls].skill.id) throw new Error('Esa habilidad no pertenece a tu clase.');
  if (rank !== expectedRank) throw new Error('El rango ha cambiado. Revisa la habilidad antes de mejorarla.');
  if (rank >= MAX_SKILL_RANK) throw new Error('La habilidad ya tiene el rango máximo.');
  if (data.level < skillRankLevel(rank + 1)) throw new Error('Necesitas más nivel para mejorar esta habilidad.');
  if (unspentSkillPoints(data) < 1) throw new Error('No tienes puntos de habilidad suficientes.');
  data.skillRanks = { ...data.skillRanks, [id]: rank + 1 };
}

export function skillPower(cls: ClassId, rank = 1, equipment?: Equipment, data?: CharData) {
  const kit = COMBAT_KITS[cls];
  const bonus = equipment ? setBonuses(cls,equipment) : {power:0,healing:0,skillPower:0};
  const multiplier = (data ? powerMultiplier(data) : 1) * (1 + (kit.skill.healing ? bonus.healing : bonus.power)) * (1 + bonus.skillPower);
  if (equipment) {
    const main = equippedWeapon(cls, equipment, 'weapon');
    const offhand = equippedWeapon(cls, equipment, 'offhand');
    if (kit.skill.healing) return ((main?.healing ?? 0) + (offhand?.healing ?? 0) + (rank - 1) * 4) * multiplier;
    return (Math.round(kit.damage * kit.skill.power) + (rank - 1) * (cls === 'picaro' ? 1 : 2))
      * (main?.power ?? 0) / kit.damage * multiplier;
  }
  const base = Math.round(kit.damage * kit.skill.power);
  return base + (rank - 1) * (kit.skill.healing ? 4 : cls === 'picaro' ? 1 : 2);
}

export const basicAttackDamage = (cls: ClassId, level = 1, equipment?: Equipment, data?: CharData) =>
  (equipment ? equippedWeapon(cls, equipment, 'weapon')?.power ?? 0 : COMBAT_KITS[cls].damage) * weaponTempo(equipment?.weapon?.id)
    * (data ? powerMultiplier(data) : 1 + .02 * (level - 1)) * (1 + (equipment ? setBonuses(cls,equipment).power : 0));

export function starterEquipment(cls: ClassId): Equipment {
  const kit = COMBAT_KITS[cls], equipment = emptyEquipment();
  equipment.weapon = { id: kit.weapon, count: 1, bound: true };
  if (kit.offhand) equipment.offhand = { id: kit.offhand, count: 1, bound: true };
  return equipment;
}

export interface CombatState {
  health: number;
  maxHealth: number;
  resource: number;
  enemyHealth: number;
  nextAttack: number;
  nextSkill: number;
}
export type CombatCommand = 'attack' | 'skill';
export interface CombatResult {
  state: CombatState;
  damage: readonly number[];
  healing: number;
}

export const REGENERATION = { health: .01, combatHealth: .0025, mana: .02, stamina: .04, combatGrace: 5 };

export function isInCombat(encounter: { status: string; engaged: boolean } | null | undefined): boolean {
  return encounter?.status === 'active' && encounter.engaged;
}

/** Fractional values are retained so low rates do not disappear between frames. */
export function regenerateCombat(
  state: Readonly<CombatState>, maxResource: number, resource: 'mana' | 'stamina', seconds: number, inCombat: boolean,
): CombatState {
  if (!Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(maxResource) || maxResource <= 0
    || !Object.values(state).every(Number.isFinite) || state.maxHealth <= 0 || state.health < 0
    || state.health > state.maxHealth || state.resource < 0 || state.resource > maxResource
    || (resource !== 'mana' && resource !== 'stamina')) throw new Error('Estado de regeneración no válido.');
  if (state.health === 0) return { ...state };
  return {
    ...state,
    health: Math.min(state.maxHealth,state.health+state.maxHealth*(inCombat?REGENERATION.combatHealth:REGENERATION.health)*seconds),
    resource: Math.min(maxResource,state.resource+maxResource*REGENERATION[resource]*seconds),
  };
}

/** Pure prototype resolver. Production must resolve commands on the server. */
export function resolveCombat(
  cls: ClassId, state: Readonly<CombatState>, command: CombatCommand, now: number, distance: number,
  level = 1, rank = 1, equipment?: Equipment, data?: CharData,
): CombatResult {
  if (!Number.isFinite(now) || now < 0 || !Number.isFinite(distance) || distance < 0
    || !Object.values(state).every(Number.isFinite) || state.maxHealth <= 0
    || state.health < 0 || state.health > state.maxHealth || state.resource < 0 || state.enemyHealth < 0
    || state.nextAttack < 0 || state.nextSkill < 0 || !Number.isInteger(level) || level < 1 || level > 50
    || !Number.isInteger(rank) || rank < 1 || rank > MAX_SKILL_RANK || rank > skillPointsAllowed(level) + 1) throw new Error('Estado de combate no válido.');
  if (state.health === 0) throw new Error('Debes volver a la vida para combatir.');
  if (equipment && !equippedWeapon(cls, equipment, 'weapon')) throw new Error('Debes equipar un arma de tu clase.');
  const kit = COMBAT_KITS[cls], skill = command === 'skill' ? kit.skill : null;
  if (command !== 'attack' && command !== 'skill') throw new Error('Acción de combate no válida.');
  if (!skill?.healing && state.enemyHealth === 0) throw new Error('El objetivo ya está derrotado.');
  if (!skill?.healing && distance > kit.range) throw new Error('El objetivo está fuera de alcance.');
  if (now < (skill ? state.nextSkill : state.nextAttack)) throw new Error('La acción todavía se está recuperando.');
  const cost = data ? skillCost(data) : skill?.cost ?? 0;
  if (skill && state.resource < cost) throw new Error('No tienes suficiente recurso.');
  if (skill?.healing && state.health === state.maxHealth) throw new Error('Ya tienes la vida completa.');
  const next = { ...state };
  if (skill) {
    next.resource -= cost;
    next.nextSkill = now + skill.cooldown;
  } else next.nextAttack = now + attackInterval(cls,equipment);
  const damage: number[] = [];
  let healing = 0;
  if (skill?.healing) {
    healing = Math.min(state.maxHealth-state.health, skillPower(cls, rank, equipment,data)*(data?1:1+.02*(level-1)));
    next.health += healing;
  } else {
    for (let hit=0;hit<(skill?.hits ?? 1);hit++) {
      const amount = Math.min(next.enemyHealth, skill ? skillPower(cls, rank, equipment,data)*(data?1:1+.02*(level-1)) : basicAttackDamage(cls, level, equipment,data));
      damage.push(amount); next.enemyHealth -= amount;
    }
    if(!skill&&data){
      const extra=basicEnchantment(data,basicAttackDamage(cls,level,equipment,data),damage[0]??0,'local-shadowling',now);
      const added=Math.min(next.enemyHealth,extra.damage);if(added>0){damage.push(added);next.enemyHealth-=added;}
      healing=Math.min(state.maxHealth-next.health,extra.healing);next.health+=healing;
    }
  }
  return { state: next, damage, healing };
}
