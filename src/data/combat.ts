import type { CharData, ClassId } from './data';
import { emptyEquipment, type Equipment } from './inventory';
import { equippedWeapon } from './weapons';
import { attributeTotal } from './stats';
import { setBonuses } from './sets';
import { basicEnchantment } from './enchantments';
import cadence from './combatCadence.json';
import duration from './combatDuration.json';
import { strengthPower,expertisePower,intellectEfficiency,agilityTempo } from './attributeCombat';

export const primaryAttribute = (cls: ClassId) => cls === 'guerrero' ? 'fuerza' : cls === 'mago' || cls === 'clerigo' ? 'intelecto' : 'agilidad';
export const powerMultiplier = (d: CharData) => (1 + .01 * attributeTotal(d,primaryAttribute(d.cls))) * (1 + .02 * (d.level - 1));
export const weaponTempo = (id: string | undefined) => id && /sable|daga_luna|daga_espina/.test(id) ? .85 : id && /meteoro|forja|solar/.test(id) ? 1.15 : 1;
export const attackInterval = (cls: ClassId, equipment?: Equipment,data?:CharData) => Math.max(duration[cls].basic+.04,COMBAT_KITS[cls].interval * weaponTempo(equipment?.weapon?.id)*(data?agilityTempo(data):1));

export * from './skills';
import { type SkillId, type CombatSkill, type SkillProgress, CLASS_SKILLS, MAX_SKILL_RANK, skillPointsAllowed, skillById, skillFor, skillUnlocked } from './skills';

export const skillRankLevel = (rank: number, id: SkillId = 'heavy_strike') => {
  const definition = skillById(id);
  if (!definition) throw new Error('Esa habilidad no existe.');
  return definition.unlockLevel + rank - 1;
};
export interface CombatKit {
  weapon: string;
  offhand?: string;
  range: number;
  interval: number;
  damage: number;
  skill: CombatSkill;
  skills: readonly CombatSkill[];
}

/** Shared starting kit; cadence is also compiled into the authoritative SQL. */
export const COMBAT_KITS: Record<ClassId, CombatKit> = {
  guerrero: {
    weapon: 'espada_inicial', offhand: 'escudo_inicial', range: 1.8, interval: cadence.guerrero, damage: 10,
    skill: CLASS_SKILLS.guerrero[0], skills: CLASS_SKILLS.guerrero,
  },
  mago: {
    weapon: 'baston_inicial', range: 6, interval: cadence.mago, damage: 10,
    skill: CLASS_SKILLS.mago[0], skills: CLASS_SKILLS.mago,
  },
  picaro: {
    weapon: 'daga_inicial', offhand: 'daga_secundaria_inicial', range: 1.6, interval: cadence.picaro, damage: 8,
    skill: CLASS_SKILLS.picaro[0], skills: CLASS_SKILLS.picaro,
  },
  clerigo: {
    weapon: 'varita_inicial', offhand: 'libro_inicial', range: 6, interval: cadence.clerigo, damage: 11,
    skill: CLASS_SKILLS.clerigo[0], skills: CLASS_SKILLS.clerigo,
  },
  explorador: {
    weapon: 'ballesta_inicial', range: 8, interval: cadence.explorador, damage: 10,
    skill: CLASS_SKILLS.explorador[0], skills: CLASS_SKILLS.explorador,
  },
};

export function skillRank(data: SkillProgress, id = COMBAT_KITS[data.cls].skill.id) {
  const definition = skillFor(data.cls, id);
  if (!definition) return 1;
  const rank = data.skillRanks?.[id];
  const maxByLevel = Math.max(1, data.level - definition.unlockLevel + 1);
  return typeof rank === 'number' && Number.isInteger(rank)
    ? Math.max(1, Math.min(rank, MAX_SKILL_RANK, maxByLevel)) : 1;
}

export const unspentSkillPoints = (data: SkillProgress) => skillPointsAllowed(data.level)
  - Object.entries(data.skillRanks ?? {}).reduce((spent, [id, rank]) => {
    const skill = (CLASS_SKILLS[data.cls] as readonly CombatSkill[]).find(candidate => candidate.id === id);
    return skill && data.level >= skill.unlockLevel && typeof rank === 'number' && Number.isInteger(rank)
      ? spent + skillRank(data, skill.id) - 1 : spent;
  }, 0);

export function upgradeSkill(data: SkillProgress, id: SkillId, expectedRank: number) {
  const skill = skillFor(data.cls, id);
  if (!skill) throw new Error('Esa habilidad no pertenece a tu clase.');
  if (!skillUnlocked(data, id)) throw new Error('Aún no has aprendido esta habilidad.');
  const rank = skillRank(data, id);
  if (rank !== expectedRank) throw new Error('El rango ha cambiado. Revisa la habilidad antes de mejorarla.');
  if (rank >= MAX_SKILL_RANK) throw new Error('La habilidad ya tiene el rango máximo.');
  if (data.level < skillRankLevel(rank + 1, id)) throw new Error('Necesitas más nivel para mejorar esta habilidad.');
  if (unspentSkillPoints(data) < 1) throw new Error('No tienes puntos de habilidad suficientes.');
  data.skillRanks = { ...data.skillRanks, [id]: rank + 1 };
}

export function skillPower(cls: ClassId, rank = 1, equipment?: Equipment, data?: CharData, id = COMBAT_KITS[cls].skill.id) {
  const kit = COMBAT_KITS[cls], skill = skillFor(cls, id);
  if (!skill) throw new Error('Esa habilidad no pertenece a tu clase.');
  const bonus = equipment ? setBonuses(cls,equipment) : {power:0,healing:0,skillPower:0};
  const healing = skill.mode === 'healing';
  const multiplier = (data ? powerMultiplier(data)*expertisePower(data) : 1) * (1 + (healing ? bonus.healing : bonus.power)) * (1 + bonus.skillPower);
  if (equipment) {
    const main = equippedWeapon(cls, equipment, 'weapon');
    const offhand = equippedWeapon(cls, equipment, 'offhand');
    if (healing) return ((skill.baseHealing ?? 0) + (main?.healing ?? 0) + (offhand?.healing ?? 0) + (rank - 1) * skill.rankBonus) * (skill.power ?? 1) * multiplier;
    return (skill.baseDamage + (rank - 1) * skill.rankBonus)
      * (main?.power ?? 0) / kit.damage * multiplier;
  }
  if (healing) return ((skill.baseHealing ?? 0) + (rank - 1) * skill.rankBonus) * (skill.power ?? 1);
  return skill.baseDamage + (rank - 1) * skill.rankBonus;
}

export const skillCost = (d: CharData, id = COMBAT_KITS[d.cls].skill.id) => {
  const skill = skillFor(d.cls, id);
  if (!skill) throw new Error('Esa habilidad no pertenece a tu clase.');
  return skill.cost * (1 - setBonuses(d.cls,d.equipment).skillCost)*intellectEfficiency(d);
};

export const basicAttackDamage = (cls: ClassId, level = 1, equipment?: Equipment, data?: CharData) =>
  (equipment ? equippedWeapon(cls, equipment, 'weapon')?.power ?? 0 : COMBAT_KITS[cls].damage) * weaponTempo(equipment?.weapon?.id)
    * (data ? powerMultiplier(data)*strengthPower(data) : 1 + .02 * (level - 1)) * (1 + (equipment ? setBonuses(cls,equipment).power : 0));

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
  skillReadyAt?: Partial<Record<SkillId, number>>;
}
const validSkillDeadlines = (deadlines: CombatState['skillReadyAt']) =>
  deadlines === undefined || !!deadlines && !Array.isArray(deadlines)
    && Object.values(deadlines).every(deadline => typeof deadline === 'number' && Number.isFinite(deadline));
const validCombatState = (state: Readonly<CombatState>) =>
  [state.health,state.maxHealth,state.resource,state.enemyHealth,state.nextAttack,state.nextSkill].every(Number.isFinite)
    && validSkillDeadlines(state.skillReadyAt);
export type CombatCommand = 'attack' | 'skill' | SkillId;
export interface CombatResult {
  state: CombatState;
  damage: readonly number[];
  healing: number;
}

export const REGENERATION = { health: .01, combatHealth: .0025, mana: .02, stamina: .04, combatGrace: 5 };

export function isInCombat(encounter: { status: string; engaged: boolean;attackers?:number } | null | undefined): boolean {
  return (encounter?.attackers??0)>0 || encounter?.status === 'active' && encounter.engaged;
}

/** Fractional values are retained so low rates do not disappear between frames. */
export function regenerateCombat(
  state: Readonly<CombatState>, maxResource: number, resource: 'mana' | 'stamina', seconds: number, inCombat: boolean,
): CombatState {
  if (!Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(maxResource) || maxResource <= 0
    || !validCombatState(state) || state.maxHealth <= 0 || state.health < 0
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
    || !validCombatState(state) || state.maxHealth <= 0
    || state.health < 0 || state.health > state.maxHealth || state.resource < 0 || state.enemyHealth < 0
    || state.nextAttack < 0 || state.nextSkill < 0 || !Number.isInteger(level) || level < 1 || level > 50
    || !Number.isInteger(rank) || rank < 1 || rank > MAX_SKILL_RANK || rank > skillPointsAllowed(level) + 1) throw new Error('Estado de combate no válido.');
  if (state.health === 0) throw new Error('Debes volver a la vida para combatir.');
  if (equipment && !equippedWeapon(cls, equipment, 'weapon')) throw new Error('Debes equipar un arma de tu clase.');
  const kit = COMBAT_KITS[cls], skillId = command === 'skill' ? kit.skill.id : command === 'attack' ? null : command;
  const skill = skillId ? skillFor(cls, skillId) : null;
  if (command !== 'attack' && !skill) throw new Error('Acción de combate no válida.');
  if (skill && data && !skillUnlocked(data, skill.id)) throw new Error('Aún no has aprendido esta habilidad.');
  const healingSkill = skill?.mode === 'healing';
  if (!healingSkill && state.enemyHealth === 0) throw new Error('El objetivo ya está derrotado.');
  if (!healingSkill && distance > kit.range) throw new Error('El objetivo está fuera de alcance.');
  const skillDeadline = skillId ? state.skillReadyAt?.[skillId] ?? (skillId === kit.skill.id ? state.nextSkill : 0) : state.nextSkill;
  if (now < (skill ? skillDeadline : state.nextAttack)) throw new Error('La acción todavía se está recuperando.');
  const abilityRank = skill && data ? skillRank(data, skill.id) : rank;
  const cost = data && skill ? skillCost(data, skill.id) : skill?.cost ?? 0;
  if (skill && state.resource < cost) throw new Error('No tienes suficiente recurso.');
  if (healingSkill && state.health === state.maxHealth) throw new Error('Ya tienes la vida completa.');
  const next = { ...state };
  if (skill) {
    next.resource -= cost;
    next.skillReadyAt = { ...state.skillReadyAt, [skill.id]: now + skill.cooldown };
    if (skill.id === kit.skill.id) next.nextSkill = now + skill.cooldown;
  } else next.nextAttack = now + attackInterval(cls,equipment,data);
  const damage: number[] = [];
  let healing = 0;
  if (healingSkill) {
    healing = Math.min(state.maxHealth-state.health, skillPower(cls, abilityRank, equipment,data,skill.id)*(data?1:1+.02*(level-1)));
    next.health += healing;
  } else {
    for (let hit=0;hit<(skill?.hits ?? 1);hit++) {
      const amount = Math.min(next.enemyHealth, skill ? skillPower(cls, abilityRank, equipment,data,skill.id)*(data?1:1+.02*(level-1)) : basicAttackDamage(cls, level, equipment,data));
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
