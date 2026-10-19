import type { ClassId } from './data';
import { emptyEquipment, type Equipment } from './inventory';

export interface CombatKit {
  weapon: string;
  offhand?: string;
  range: number;
  interval: number;
  damage: number;
  skill: { label: string; cost: number; cooldown: number; hits: number; power: number; healing?: boolean };
}

/** Initial balance for the isolated combat workbench; not a client damage authority. */
export const COMBAT_KITS: Record<ClassId, CombatKit> = {
  guerrero: {
    weapon: 'espada_inicial', offhand: 'escudo_inicial', range: 1.8, interval: 1.5, damage: 10,
    skill: { label: 'Golpe contundente', cost: 15, cooldown: 6, hits: 1, power: 1.8 },
  },
  mago: {
    weapon: 'baston_inicial', range: 6, interval: 1.8, damage: 10,
    skill: { label: 'Descarga arcana', cost: 20, cooldown: 7, hits: 1, power: 1.8 },
  },
  picaro: {
    weapon: 'daga_inicial', offhand: 'daga_secundaria_inicial', range: 1.6, interval: .9, damage: 8,
    skill: { label: 'Corte doble', cost: 15, cooldown: 4.5, hits: 2, power: 1 },
  },
  clerigo: {
    weapon: 'varita_inicial', offhand: 'libro_inicial', range: 6, interval: 1.8, damage: 11,
    skill: { label: 'Curación', cost: 12, cooldown: 6, hits: 1, power: 32/11, healing: true },
  },
  explorador: {
    weapon: 'ballesta_inicial', range: 8, interval: 1.7, damage: 10,
    skill: { label: 'Disparo preciso', cost: 15, cooldown: 6, hits: 1, power: 1.9 },
  },
};

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
): CombatResult {
  if (!Number.isFinite(now) || now < 0 || !Number.isFinite(distance) || distance < 0
    || !Object.values(state).every(Number.isFinite) || state.maxHealth <= 0
    || state.health < 0 || state.health > state.maxHealth || state.resource < 0 || state.enemyHealth < 0
    || state.nextAttack < 0 || state.nextSkill < 0) throw new Error('Estado de combate no válido.');
  if (state.health === 0) throw new Error('Debes volver a la vida para combatir.');
  const kit = COMBAT_KITS[cls], skill = command === 'skill' ? kit.skill : null;
  if (command !== 'attack' && command !== 'skill') throw new Error('Acción de combate no válida.');
  if (!skill?.healing && state.enemyHealth === 0) throw new Error('El objetivo ya está derrotado.');
  if (!skill?.healing && distance > kit.range) throw new Error('El objetivo está fuera de alcance.');
  if (now < (skill ? state.nextSkill : state.nextAttack)) throw new Error('La acción todavía se está recuperando.');
  if (skill && state.resource < skill.cost) throw new Error('No tienes suficiente recurso.');
  if (skill?.healing && state.health === state.maxHealth) throw new Error('Ya tienes la vida completa.');
  const next = { ...state };
  if (skill) {
    next.resource -= skill.cost;
    next.nextSkill = now + skill.cooldown;
  } else next.nextAttack = now + kit.interval;
  const damage: number[] = [];
  let healing = 0;
  if (skill?.healing) {
    healing = Math.min(state.maxHealth-state.health, Math.round(kit.damage*skill.power));
    next.health += healing;
  } else {
    for (let hit=0;hit<(skill?.hits ?? 1);hit++) {
      const amount = Math.min(next.enemyHealth, Math.round(kit.damage*(skill?.power ?? 1)));
      damage.push(amount); next.enemyHealth -= amount;
    }
  }
  return { state: next, damage, healing };
}
