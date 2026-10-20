import {
  defaultChar, RACES, CLASSES, ATTRIBUTES, HAIR_COLORS, EYE_COLORS, CLOTH, ACCS,
  ACC_COLORS, HAIR_ACC_VALUES, MAKEUPS, ATTRIBUTE_BASE_VALUE, type CharData, type AttributeBonuses,
} from './data';
import { FACE_KITS, HAIR_STYLES, BEARDS, EYE_SHAPES, BROWS, NOSES, MOUTHS, DETAILS } from '../character/head';
import { STARTER_MODELS } from './starterItems';
import { EQUIPPABLE } from './equipment';
import type { BuildOpts } from '../character/character';
import { NPC_CLOTHING_SLOTS, REQUIRED_CLOTHING_SLOTS, clothingPiece, defaultNpcClothing, type NpcClothing } from './npcClothing';
import { NPC_BADGE_ID } from './npcBadges';

export const WORLD_NPC_IDS = ['testiculos', 'gnomi', 'isberto'] as const;
export type WorldNpcId = typeof WORLD_NPC_IDS[number];
export const isWorldNpcId = (id: string): id is WorldNpcId => WORLD_NPC_IDS.some(value => value === id);

export const NPC_APPEARANCE_KEYS = [
  'race', 'cls', 'sex', 'height', 'build', 'skin', 'face', 'hair', 'hairColor', 'beard',
  'eyeShape', 'eyeColor', 'brows', 'nose', 'mouth', 'detail', 'trait',
  'hairAcc', 'hairAccColor', 'acc', 'makeup', 'makeupColor', 'accColor',
] as const;
export type NpcAppearance = Pick<CharData, typeof NPC_APPEARANCE_KEYS[number]>;
export interface NpcDefinition {
  id: string;
  name: string;
  subtitle: string;
  notes: string;
  badgeIcon: string;
  appearance: NpcAppearance;
  stats: { level: number; maxHealth: number; health: number; attributes: AttributeBonuses };
  render: {
    clothing: NpcClothing;
    scale: number;
    width: number;
    height: number;
    weapon: string;
    offhand: string;
  };
}
export interface NpcCatalog { version: 1; npcs: NpcDefinition[] }
export const NPC_ID = /^[a-z][a-z0-9_-]{0,63}$/;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}: se esperaba un objeto.`);
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: readonly string[], label: string) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${label}: campo desconocido "${key}".`);
  for (const key of allowed) if (!(key in value)) throw new Error(`${label}: falta "${key}".`);
}
function text(value: unknown, label: string, max: number, required = false): string {
  if (typeof value !== 'string' || value.length > max || required && !value.trim()) throw new Error(`${label}: texto ${required ? 'obligatorio, ' : ''}de hasta ${max} caracteres.`);
  return value;
}
function number(value: unknown, label: string, min: number, max: number, integer = true): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || integer && !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label}: debe estar entre ${min} y ${max}${integer ? ' (entero)' : ''}.`);
  }
  return value;
}
function choice<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) throw new Error(`${label}: opción no válida.`);
  return value as T;
}
export function validateNpc(value: unknown): NpcDefinition {
  let npc = record(value, 'NPC');
  // Earlier workshop files predate custom badge icons.
  if (!Object.hasOwn(npc, 'badgeIcon')) npc = { ...npc, badgeIcon: '' };
  keys(npc, ['id', 'name', 'subtitle', 'notes', 'badgeIcon', 'appearance', 'stats', 'render'], 'NPC');
  const badgeIcon = text(npc.badgeIcon, 'Icono del recuadro', 64);
  if (badgeIcon && !NPC_BADGE_ID.test(badgeIcon)) throw new Error('Icono del recuadro: usa un identificador como herrero, sin extensión ni ruta.');
  npc = upgradeLegacyClothing(npc);
  const id = text(npc.id, 'ID', 64, true);
  if (!NPC_ID.test(id)) throw new Error('ID: usa una letra minúscula inicial, letras, números, guion o guion bajo (hasta 64).');
  const appearance = record(npc.appearance, 'Apariencia');
  keys(appearance, NPC_APPEARANCE_KEYS, 'Apariencia');
  const race = choice(appearance.race, Object.keys(RACES) as CharData['race'][], 'Linaje');
  choice(appearance.cls, Object.keys(CLASSES) as CharData['cls'][], 'Clase');
  const lists = {
    sex: 2, skin: RACES[race].skins.length, face: FACE_KITS.length, hair: HAIR_STYLES.length,
    hairColor: HAIR_COLORS.length, beard: BEARDS.length, eyeShape: EYE_SHAPES.length,
    eyeColor: EYE_COLORS.length, brows: BROWS.length, nose: NOSES.length, mouth: MOUTHS.length,
    detail: DETAILS.length, trait: Math.max(1, RACES[race].traits.length), hairAccColor: ACC_COLORS.length,
    acc: ACCS.length, makeup: MAKEUPS.length, makeupColor: ACC_COLORS.length, accColor: ACC_COLORS.length,
  };
  for (const [key, length] of Object.entries(lists)) number(appearance[key], key, 0, length - 1);
  number(appearance.height, 'Altura', 0, 1, false);
  number(appearance.build, 'Complexión', 0, 1, false);
  if (!HAIR_ACC_VALUES.includes(number(appearance.hairAcc, 'Adorno', 0, 8))) throw new Error('Adorno de pelo no válido.');
  const stats = record(npc.stats, 'Estadísticas');
  keys(stats, ['level', 'maxHealth', 'health', 'attributes'], 'Estadísticas');
  number(stats.level, 'Nivel', 1, 10000);
  const maxHealth = number(stats.maxHealth, 'Vida máxima', 1, 1_000_000_000);
  number(stats.health, 'Vida actual', 0, maxHealth);
  const attributes = record(stats.attributes, 'Atributos');
  keys(attributes, Object.keys(ATTRIBUTES), 'Atributos');
  for (const key of Object.keys(ATTRIBUTES)) number(attributes[key], ATTRIBUTES[key as keyof typeof ATTRIBUTES].label, 0, 10000);
  const render = record(npc.render, 'Montaje');
  keys(render, ['clothing', 'scale', 'width', 'height', 'weapon', 'offhand'], 'Montaje');
  const clothing = record(render.clothing, 'Ropa');
  keys(clothing, Object.keys(NPC_CLOTHING_SLOTS), 'Ropa');
  for (const [slot, raw] of Object.entries(clothing)) {
    const item = record(raw, slot);
    keys(item, ['piece', 'primary', 'secondary'], slot);
    const id = text(item.piece, slot, 100);
    if (!id && REQUIRED_CLOTHING_SLOTS.includes(slot as keyof NpcClothing)) throw new Error(`${slot}: selecciona una prenda.`);
    if (id && clothingPiece(id).slot !== slot) throw new Error(`${slot}: esa prenda no corresponde a esta parte del cuerpo.`);
    number(item.primary, `${slot}: color principal`, -1, CLOTH.length - 1);
    number(item.secondary, `${slot}: color secundario`, -1, CLOTH.length - 1);
  }
  number(render.scale, 'Escala', .1, 3, false);
  number(render.width, 'Anchura adicional', .5, 1.5, false);
  number(render.height, 'Altura adicional', .5, 1.5, false);
  for (const slot of ['weapon', 'offhand'] as const) {
    const item = text(render[slot], slot, 64);
    if (item && (!Object.hasOwn(STARTER_MODELS, item) || EQUIPPABLE[item]?.slot !== slot)) throw new Error(`${slot}: modelo no disponible para esa mano.`);
  }
  function upgradeLegacyClothing(npc: Record<string, unknown>): Record<string, unknown> {
    const render = record(npc.render, 'Montaje');
    if (!Object.hasOwn(render, 'outfit')) return npc;
    keys(render, ['outfit', 'scale', 'width', 'height', 'hat', 'cape', 'weapon', 'offhand'], 'Montaje anterior');
    const outfit = choice(render.outfit, ['villager', 'class', 'helpers'], 'Atuendo anterior');
    if (typeof render.hat !== 'boolean') throw new Error('Sombrero anterior no válido.');
    const cape = choice(render.cape, ['none', ...FACE_KITS], 'Capa anterior');
    const appearance = record(npc.appearance, 'Apariencia anterior');
    keys(appearance, [...NPC_APPEARANCE_KEYS, 'clothA', 'clothB', 'primary', 'secondary'], 'Apariencia anterior');
    for (const key of ['clothA', 'clothB', 'primary', 'secondary']) number(appearance[key], key, 0, CLOTH.length - 1);
    const cls = choice(appearance.cls, Object.keys(CLASSES) as CharData['cls'][], 'Clase');
    const source = outfit === 'helpers' ? 'helpers' : outfit === 'villager' ? 'Rogue'
      : ({ guerrero: 'Knight', mago: 'Mage', picaro: 'Rogue', clerigo: 'Mage', explorador: 'Barbarian' } as const)[cls];
    const clothing = defaultNpcClothing(source,
      outfit === 'helpers' ? -1 : Number(appearance[outfit === 'class' ? 'primary' : 'clothA']),
      outfit === 'helpers' ? -1 : Number(appearance[outfit === 'class' ? 'secondary' : 'clothB']));
    if (outfit === 'helpers') for (const slot of ['overlay', 'footwear'] as const) clothing[slot].piece = `helpers.${slot}`;
    if (render.hat && (outfit === 'helpers' || outfit === 'class' && ['Mage', 'Knight', 'Barbarian'].includes(source))) clothing.head.piece = `${source}.head`;
    if (cape !== 'none') clothing.cape = { piece: `${cape}.cape`, primary: clothing.torso.primary, secondary: clothing.torso.secondary };
    const cleanAppearance = Object.fromEntries(NPC_APPEARANCE_KEYS.map(key => [key, appearance[key]]));
    return { ...npc, appearance: cleanAppearance, render: { clothing, scale: render.scale, width: render.width, height: render.height, weapon: render.weapon, offhand: render.offhand } };
  }
  // Return a detached, JSON-only record; callers cannot mutate the validated input.
  return JSON.parse(JSON.stringify({
    ...npc, name: text(npc.name, 'Nombre', 80, true),
    subtitle: text(npc.subtitle, 'Subtítulo', 120), notes: text(npc.notes, 'Notas', 4000),
  })) as NpcDefinition;
}
export function validateNpcCatalog(value: unknown): NpcCatalog {
  const catalog = record(value, 'Catálogo');
  keys(catalog, ['version', 'npcs'], 'Catálogo');
  if (catalog.version !== 1 || !Array.isArray(catalog.npcs) || catalog.npcs.length > 1000) throw new Error('Catálogo: versión 1 y hasta 1000 NPCs.');
  const npcs = catalog.npcs.map(validateNpc), ids = new Set<string>();
  for (const npc of npcs) {
    if (ids.has(npc.id)) throw new Error(`ID duplicado: ${npc.id}.`);
    ids.add(npc.id);
  }
  return { version: 1, npcs };
}
export function npcAppearance(data: CharData): NpcAppearance {
  return Object.fromEntries(NPC_APPEARANCE_KEYS.map(key => [key, data[key]])) as NpcAppearance;
}
export function newNpc(id = 'nuevo_npc'): NpcDefinition {
  return {
    id, name: 'Nuevo NPC', subtitle: '', notes: '', badgeIcon: '', appearance: npcAppearance(defaultChar()),
    stats: { level: 1, maxHealth: 100, health: 100, attributes: { fuerza: 5, intelecto: 5, corpulencia: 5, agilidad: 5, pericia: 5, presencia: 5, percepcion: 5 } },
    render: { clothing: defaultNpcClothing(), scale: 1, width: 1, height: 1, weapon: '', offhand: '' },
  };
}
export function npcCharacter(npc: NpcDefinition): CharData {
  const attributePoints = { ...npc.stats.attributes };
  for (const key of Object.keys(attributePoints) as (keyof AttributeBonuses)[]) {
    attributePoints[key] -= ATTRIBUTE_BASE_VALUE + RACES[npc.appearance.race].bonuses[key];
  }
  return { ...defaultChar(), ...npc.appearance, name: npc.name, level: npc.stats.level, health: npc.stats.health,
    attributePoints,
    equipment: { ...defaultChar().equipment,
      weapon: npc.render.weapon ? { id: npc.render.weapon, count: 1 } : null,
      offhand: npc.render.offhand ? { id: npc.render.offhand, count: 1 } : null,
    },
  };
}
export function npcBuildOptions(npc: NpcDefinition): BuildOpts {
  return {
    outfit: false,
    proportions: { width: npc.render.width, height: npc.render.height },
    scale: npc.render.scale,
    useEquipment: true,
  };
}
