import type { ClassId } from './data';

export type SkillId =
  | 'heavy_strike' | 'shield_rush' | 'sweeping_edge' | 'mountain_breaker'
  | 'arcane_discharge' | 'firefly_burst' | 'frost_lance' | 'starfall'
  | 'double_slash' | 'swift_flurry' | 'opportunist_strike' | 'shadow_combo'
  | 'healing' | 'radiant_bolt' | 'sanctified_bolt' | 'dawn_strike'
  | 'precise_shot' | 'quick_volley' | 'piercing_bolt' | 'horizon_shot';

export const MAX_SKILL_RANK = 5;
export type SkillRanks = Partial<Record<SkillId, number>>;
export type SkillProgress = { cls: ClassId; level: number; skillRanks?: SkillRanks };
export const skillPointsAllowed = (level: number) => Math.floor(Math.min(50, Math.max(1, level))) - 1;

export interface CombatSkill {
  id: SkillId;
  label: string;
  description: string;
  unlockLevel: number;
  mode: 'damage' | 'healing';
  baseDamage: number;
  hits: number;
  rankBonus: number;
  cost: number;
  cooldown: number;
  power?: number;
  baseHealing?: number;
  healing?: boolean;
}

const skill = (definition: CombatSkill): CombatSkill => ({ ...definition, healing: definition.mode === 'healing' });

export const CLASS_SKILLS: Record<ClassId, readonly CombatSkill[]> = {
  guerrero: [
    skill({ id:'heavy_strike',label:'Golpe contundente',description:'Concentras tu fuerza en un golpe certero contra un enemigo cercano.',unlockLevel:1,mode:'damage',baseDamage:18,hits:1,rankBonus:2,cost:15,cooldown:6 }),
    skill({ id:'shield_rush',label:'Arremetida de escudo',description:'Avanzas con el escudo y respondes con un impacto firme.',unlockLevel:5,mode:'damage',baseDamage:13,hits:1,rankBonus:1.5,cost:12,cooldown:5 }),
    skill({ id:'sweeping_edge',label:'Tajo envolvente',description:'Encadenas tres cortes para mantener la presión sobre el objetivo.',unlockLevel:12,mode:'damage',baseDamage:6,hits:3,rankBonus:.67,cost:18,cooldown:8 }),
    skill({ id:'mountain_breaker',label:'Quebrantamontañas',description:'Preparas un golpe lento y poderoso contra un solo enemigo.',unlockLevel:20,mode:'damage',baseDamage:25,hits:1,rankBonus:2,cost:26,cooldown:10 }),
  ],
  mago: [
    skill({ id:'arcane_discharge',label:'Descarga arcana',description:'Canalizas energía arcana y la liberas en una descarga a distancia.',unlockLevel:1,mode:'damage',baseDamage:18,hits:1,rankBonus:2,cost:20,cooldown:7 }),
    skill({ id:'firefly_burst',label:'Ráfaga de luciérnagas',description:'Lanzas tres destellos arcanos seguidos contra el objetivo.',unlockLevel:5,mode:'damage',baseDamage:6,hits:3,rankBonus:.67,cost:15,cooldown:5 }),
    skill({ id:'frost_lance',label:'Lanza de escarcha',description:'Condensas la bruma en un proyectil arcano preciso.',unlockLevel:12,mode:'damage',baseDamage:23,hits:1,rankBonus:2,cost:24,cooldown:9 }),
    skill({ id:'starfall',label:'Caída estelar',description:'Reúnes energía antes de descargar un potente impacto mágico.',unlockLevel:20,mode:'damage',baseDamage:31,hits:1,rankBonus:2,cost:30,cooldown:12 }),
  ],
  picaro: [
    skill({ id:'double_slash',label:'Corte doble',description:'Encadenas dos cortes rápidos sobre el mismo enemigo.',unlockLevel:1,mode:'damage',baseDamage:8,hits:2,rankBonus:1,cost:15,cooldown:4.5 }),
    skill({ id:'swift_flurry',label:'Danza de dagas',description:'Encadenas cuatro tajos ligeros sin perder el ritmo.',unlockLevel:5,mode:'damage',baseDamage:4,hits:4,rankBonus:.25,cost:13,cooldown:4 }),
    skill({ id:'opportunist_strike',label:'Golpe oportuno',description:'Aprovechas una apertura para asestar un golpe directo.',unlockLevel:12,mode:'damage',baseDamage:15,hits:1,rankBonus:1,cost:18,cooldown:6.5 }),
    skill({ id:'shadow_combo',label:'Combinación sombría',description:'Terminas una secuencia veloz con tres impactos precisos.',unlockLevel:20,mode:'damage',baseDamage:6,hits:3,rankBonus:.34,cost:24,cooldown:9 }),
  ],
  clerigo: [
    skill({ id:'healing',label:'Curación',description:'Reúnes una luz reparadora para recuperar tu vida o la de un compañero del grupo a 6 m, sin sobrecuración.',unlockLevel:1,mode:'healing',baseDamage:0,baseHealing:32,hits:1,rankBonus:4,cost:12,cooldown:6,power:1 }),
    skill({ id:'radiant_bolt',label:'Rayo sereno',description:'Proyectas una chispa luminosa contra un enemigo a distancia.',unlockLevel:5,mode:'damage',baseDamage:14,hits:1,rankBonus:2,cost:12,cooldown:5 }),
    skill({ id:'sanctified_bolt',label:'Rayo votivo',description:'Concentras una chispa sagrada y la lanzas contra un enemigo.',unlockLevel:12,mode:'damage',baseDamage:20,hits:1,rankBonus:2,cost:18,cooldown:7 }),
    skill({ id:'dawn_strike',label:'Golpe del alba',description:'Liberas una descarga de luz concentrada contra el objetivo.',unlockLevel:20,mode:'damage',baseDamage:29,hits:1,rankBonus:2,cost:26,cooldown:11 }),
  ],
  explorador: [
    skill({ id:'precise_shot',label:'Disparo preciso',description:'Apuntas con cuidado y lanzas un disparo certero a larga distancia.',unlockLevel:1,mode:'damage',baseDamage:19,hits:1,rankBonus:2,cost:15,cooldown:6 }),
    skill({ id:'quick_volley',label:'Ráfaga de virotes',description:'Disparas tres virotes seguidos para sostener la presión.',unlockLevel:5,mode:'damage',baseDamage:6,hits:3,rankBonus:.67,cost:15,cooldown:5 }),
    skill({ id:'piercing_bolt',label:'Virote penetrante',description:'Lanzas un virote pesado que atraviesa la guardia del objetivo.',unlockLevel:12,mode:'damage',baseDamage:22,hits:1,rankBonus:2,cost:21,cooldown:8 }),
    skill({ id:'horizon_shot',label:'Disparo del horizonte',description:'Tensas la ballesta y disparas con toda tu precisión.',unlockLevel:20,mode:'damage',baseDamage:30,hits:1,rankBonus:2,cost:27,cooldown:11 }),
  ],
};

export const skillFor = (cls: ClassId, id: SkillId) => CLASS_SKILLS[cls].find(candidate => candidate.id === id);
export const skillById = (id: SkillId) => Object.values(CLASS_SKILLS).flat().find(candidate => candidate.id === id);
export const parseSkillId = (value: unknown) => typeof value === 'string'
  ? Object.values(CLASS_SKILLS).flat().find(candidate => candidate.id === value)?.id : undefined;
export function parseSkillCooldowns(value: unknown): Partial<Record<SkillId, number>> | undefined {
  if (value === undefined || value === null) return;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Recargas de habilidades no válidas.');
  const parsed: Partial<Record<SkillId, number>> = {};
  for (const [id, deadline] of Object.entries(value)) {
    const skill = Object.values(CLASS_SKILLS).flat().find(candidate => candidate.id === id);
    if (!skill) continue;
    if (typeof deadline !== 'number' || !Number.isFinite(deadline)) throw new Error('Recargas de habilidades no válidas.');
    parsed[skill.id] = deadline;
  }
  return parsed;
}
export const skillUnlocked = (data: SkillProgress, id: SkillId) => {
  const definition = skillFor(data.cls, id);
  return !!definition && data.level >= definition.unlockLevel;
};
