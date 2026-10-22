// Catálogo de objetos y mercancías de los vendedores. Los precios y efectos REALES viven en supabase/server/
// (game_item / game_vendor_stock): estos datos solo sirven para mostrarlos. Si cambias uno, cambia el otro.
import type { FoodId } from './food';
import { WEAPONS, weaponItemStats } from './weapons';
import { ADVANCED_WEAPONS } from './weaponProgression';
import { ITEM_RARITIES, rarityForTier, type ItemRarity } from './itemRarity';
import { ORIGINAL_WEAPONS, originalWeaponIcon } from './uniqueWeapons';
import { weaponPortrait, weaponIconFrame } from '../art/weaponIcons';
import { OUTFITS, outfitItemStats } from './outfits';

export interface ItemDef {
  id: string;
  rarity?: ItemRarity;
  bound?: boolean;
  sellable?: boolean;
  label: string; // en español (se traduce con t())
  category: string;
  description: string;
  effects?: readonly string[];
  stats?: readonly { label: string; value: string }[];
  /** Valor base en pelines: lo que cuesta comprarlo; el vendedor paga la mitad al vendérselo. */
  value: number;
  /** Máximo de unidades por hueco de la mochila (por defecto DEFAULT_STACK). */
  stack?: number;
  /** Se puede usar desde la mochila (el efecto real lo decide el servidor). */
  usable?: boolean;
  restore?: { kind: 'health' | 'mana' | 'stamina'; percent: number };
  food?: FoodId;
  /** SVG interior (viewBox 0 0 24 24). */
  icon: string;
}

const NOVICE_SWORD_ICON = `<g transform="scale(.375)" stroke-linejoin="round" stroke-linecap="round">
  <ellipse cx="30" cy="56" rx="22" ry="4" fill="#291f24" opacity=".2"/>
  <path d="m20 42 25-31 13-6-3 14-27 29Z" fill="#302f36" opacity=".2"/>
  <path d="m22 38 25-31 11-4-2 12-28 29Z" fill="#4a5057" stroke="#39343a" stroke-width="2.4"/>
  <path d="M23 37 48 8l8-3-4 9-26 28Z" fill="#bdcbd0"/>
  <path d="M48 8 56 5 27 40l-4-3Z" fill="#e9f0e7"/>
  <path d="m56 5-2 10-28 29 1-4Z" fill="#79929c"/>
  <path d="m29 34 18-21" fill="none" stroke="#f8f8de" stroke-width="1.2"/>
  <path d="m35 31 2 1m6-13 2 1m-15 6 2 .6" fill="none" stroke="#6b838d" stroke-width="1"/>
  <path d="m19 32 15 12-3 6-5-5-4-4-8-3Z" fill="#49362b" stroke="#49362b" stroke-width="2.8"/>
  <path d="m18 32 4 2 12 10-3 3-6-6-9-5Z" fill="#b28b47"/>
  <path d="m19 32 3 2 12 10-1 2-13-10-4-1Z" fill="#f4d18a"/>
  <path d="m16 36 9 5 6 6-1 2-7-7-8-4Z" fill="#80603c"/>
  <path d="m21 40 5 4-10 13-6-5Z" fill="#674635" stroke="#3e302b" stroke-width="2"/>
  <path d="m20 43 4 3m-7 1 4 3m-7 1 4 3" fill="none" stroke="#b28b62" stroke-width="1.8"/>
  <path d="m23 44-10 12" fill="none" stroke="#d0aa73" stroke-width=".7"/>
  <path d="m10 50 8 7-5 5-8-7Z" fill="#b28b47" stroke="#49362b" stroke-width="2"/>
  <path d="m10 51 6 6-3 3-6-6Z" fill="#e5bd72"/>
  <path d="m11 54 2 2-1 2-2-2Z" fill="#7e946f"/>
  <path d="m18 33 3 2m10 9 1 1" stroke="#fff0bf" stroke-width="1.4"/>
</g>`;
const NOVICE_SHIELD_ICON = `<g transform="scale(.375)" stroke-linejoin="round" stroke-linecap="round">
  <ellipse cx="32" cy="58" rx="23" ry="4" fill="#291f24" opacity=".2"/>
  <path d="M9 10q23-11 46 0l-2 25c-2 12-12 20-21 25C20 54 12 46 11 35Z" fill="#3c3430" stroke="#3c3430" stroke-width="2.5"/>
  <path d="M9 9q23-11 46 0l-2 25c-2 12-12 20-21 25C20 53 12 45 11 34Z" fill="#ae884e" stroke="#513b2c" stroke-width="1.5"/>
  <path d="M12 11q20-9 40 0l-2 23c-2 10-9 17-18 22-9-5-16-12-18-22Z" fill="#e2c484"/>
  <path d="M15 13q17-7 34 0l-2 20c-1 9-8 15-15 20-8-5-14-12-15-20Z" fill="#81543b" stroke="#69462f" stroke-width="1.5"/>
  <path d="M16 14q7-3 14-3v39c-7-5-12-11-13-19Z" fill="#ab7950"/>
  <path d="M32 11q7 0 15 3l-2 19c-1 7-6 13-13 18Z" fill="#8e603f"/>
  <path d="m22 14 1 28m8-30v38m9-36-2 29" fill="none" stroke="#603e2d" stroke-width="1.3"/>
  <path d="m19 20 1 12m6-16 1 22m8-20v8m8-6-1 12" fill="none" stroke="#d0a271" stroke-width=".8"/>
  <path d="M16 16q16-7 31 0M18 36c2 7 8 12 14 16" fill="none" stroke="#c49b67" stroke-width=".9"/>
  <path d="M13 13q19-9 38-1M12 13l2 19" fill="none" stroke="#fff0bd" stroke-width="1.2"/>
  <path d="m50 35-2 6c-4 6-9 11-16 15" fill="none" stroke="#84643a" stroke-width="1.8"/>
  <path d="M18 27h28l-1 7H19Z" fill="#5d684e" stroke="#3f4939" stroke-width="1.2"/>
  <path d="M20 28h24" stroke="#a5b88a" stroke-width="1"/>
  <path d="m32 21 8 10-8 11-8-11Z" fill="#9f7a41" stroke="#4c3d2d" stroke-width="1.5"/>
  <path d="m32 23 6 8-6 8-6-8Z" fill="#e2c586"/>
  <path d="m32 25 3 6-3 6-3-6Z" fill="#7d9469"/>
  <path d="m32 26-1 6 1 3" fill="none" stroke="#c4d4a5" stroke-width=".8"/>
  <g fill="#f0dba1" stroke="#886638" stroke-width="1">
    <circle cx="13" cy="12" r="1.6"/><circle cx="32" cy="7" r="1.6"/><circle cx="51" cy="12" r="1.6"/>
    <circle cx="15" cy="33" r="1.5"/><circle cx="49" cy="33" r="1.5"/><circle cx="32" cy="53" r="1.5"/>
  </g>
</g>`;

export const ITEMS: Record<string, ItemDef> = {
  esencia_sombria: {
    id: 'esencia_sombria', label: 'Esencia sombría', category: 'Objeto desconocido',
    description: 'Un resto oscuro dejado por una extraña criatura. No sabes qué es ni para qué sirve.',
    value: 0, bound: true, sellable: false,
    icon: '<path d="M12 2c5 5 8 9 7 14-1 5-12 7-14 0C3 11 9 8 12 2Z" fill="#443258" stroke="#bb9cd5" stroke-width="1.2"/><path d="M12 7c3 4 4 7 2 10-3 3-6 0-5-3" fill="#9170b2"/><path d="m12 10 2 3-2 5-2-4Z" fill="#dac4ee"/><path d="m4 5 1 2m14-1 1-2M3 18l2-1" stroke="#c7a8e0"/>',
  },
  ...Object.fromEntries([
    ['espada_inicial', 'Espada de principiante', 'Espada', NOVICE_SWORD_ICON],
    ['escudo_inicial', 'Escudo de principiante', 'Escudo', NOVICE_SHIELD_ICON],
    ['baston_inicial', 'Bastón de principiante', 'Bastón', '<path d="m7 21 9-17" stroke="#8c623e" stroke-width="3"/><circle cx="16" cy="5" r="3" fill="#9b8bd0"/>'],
    ['daga_inicial', 'Daga de principiante', 'Daga', '<path d="m8 15 9-12 1 7-7 8Z" fill="#c0cad0" stroke="#725338"/><path d="m5 14 7 5M5 21l4-5" stroke="#8c623e" stroke-width="2"/>'],
    ['daga_secundaria_inicial', 'Daga secundaria de principiante', 'Daga', '<path d="m8 15 9-12 1 7-7 8Z" fill="#c0cad0" stroke="#725338"/><path d="m5 14 7 5M5 21l4-5" stroke="#8c623e" stroke-width="2"/>'],
    ['varita_inicial', 'Varita de principiante', 'Varita', '<path d="m5 21 11-15" stroke="#8c623e" stroke-width="3"/><path d="m17 2 1 3 3 1-3 2-1 3-2-3-3-2 3-1Z" fill="#ead191"/>'],
    ['libro_inicial', 'Libro de principiante', 'Libro', '<path d="M5 3h13v18H5Z" fill="#7d729e" stroke="#c7ac73"/><path d="M8 3v18M11 8h5M11 11h5" stroke="#e7d8b2"/>'],
    ['ballesta_inicial', 'Ballesta de principiante', 'Ballesta', '<path d="m7 21 8-16M4 7q9-6 16 7M4 7l16 7M11 11l-3 6" fill="none" stroke="#8c623e" stroke-width="2"/>'],
  ].map(([id,label,category,icon]) => [id, {
    id, label, category, icon, bound: true, sellable: false, stack: 1, value: 0, stats: weaponItemStats(id),
    description: 'Equipo básico de tu clase, ligado a tu personaje.',
    effects: ['No se puede vender ni intercambiar.'],
  }])),
  ...Object.fromEntries([
    ['espada_cobre_t1', 'Espada de la Hoja de Cobre', 'Espada', 'espada_inicial', 100],
    ['escudo_roble_t1', 'Escudo de roble reforzado', 'Escudo', 'escudo_inicial', 70],
    ['baston_ambar_t1', 'Bastón de ámbar', 'Bastón', 'baston_inicial', 110],
    ['daga_cazador_t1', 'Daga del cazador', 'Daga', 'daga_inicial', 90],
    ['daga_secundaria_cazador_t1', 'Daga secundaria del cazador', 'Daga', 'daga_secundaria_inicial', 60],
    ['varita_ambar_t1', 'Varita de ámbar', 'Varita', 'varita_inicial', 100],
    ['grimorio_verde_t1', 'Grimorio del sello verde', 'Libro', 'libro_inicial', 70],
    ['ballesta_roble_t1', 'Ballesta de roble reforzada', 'Ballesta', 'ballesta_inicial', 110],
  ].map(([id, label, category, starter, value]) => [id, {
    id: String(id), label: String(label), category: String(category), value: Number(value), stack: 1,
    description: 'Equipo poco común, elaborado con mejores materiales para tus primeras aventuras.',
    stats: weaponItemStats(String(id)),
    // Same icon family, with the amber and forest colours of the new models.
    icon: '',
    starterIcon: String(starter),
  }])),
  ...Object.fromEntries([
    ['espada_cobre_t2', 'Espada de la Hoja de Cobre labrada', 'Espada', 'espada_inicial', 200],
    ['escudo_roble_t2', 'Escudo de roble con herrajes', 'Escudo', 'escudo_inicial', 140],
    ['baston_ambar_t2', 'Bastón de ámbar tallado', 'Bastón', 'baston_inicial', 220],
    ['daga_cazador_t2', 'Daga del cazador veterano', 'Daga', 'daga_inicial', 180],
    ['daga_secundaria_cazador_t2', 'Daga secundaria del cazador veterano', 'Daga', 'daga_secundaria_inicial', 120],
    ['varita_ambar_t2', 'Varita de ámbar tallada', 'Varita', 'varita_inicial', 200],
    ['grimorio_verde_t2', 'Grimorio del sello de ámbar', 'Libro', 'libro_inicial', 140],
    ['ballesta_roble_t2', 'Ballesta de roble labrada', 'Ballesta', 'ballesta_inicial', 220],
  ].map(([id, label, category, starter, value]) => [id, {
    id: String(id), label: String(label), category: String(category), value: Number(value), stack: 1,
    description: 'Equipo raro del conjunto de ámbar, una mejora sobre el equipo de artesano.',
    stats: weaponItemStats(String(id)), icon: '', starterIcon: String(starter),
  }])),
  pan_duro: {
    id: 'pan_duro', label: 'Pan duro', category: 'Comida',
    description: 'Una hogaza humilde, de corteza firme y miga tenaz. No es un banquete, pero ayuda a seguir adelante.',
    effects: ['+5 de vida máxima y +3 de maná o estamina máximos durante 15 minutos de conexión.',
      'No cura ni rellena el recurso. Comer otro renueva la duración, sin acumular el efecto.'],
    value: 4, usable: true, food: 'pan_duro',
    icon: '<ellipse cx="12" cy="21" rx="9" ry="1.5" fill="#6e452c" opacity=".2"/><path d="M3 16C1 10 5 5 12 4c6-1 10 4 9 10l-1 5c-4 3-13 3-17-1Z" fill="#b5793e" stroke="#70452c" stroke-width="1.2"/><path d="M4 15C2 10 7 6 13 5c5 0 8 4 7 9-4 3-12 4-16 1Z" fill="#deae61" stroke="#b77a3c" stroke-width=".8"/><path d="m8 8 2 5m3-6 2 5m2-3 1 3" stroke="#f7d694" stroke-width="2.2" stroke-linecap="round"/><path d="M6 18c3 1 8 1 12-1" stroke="#e6b96c" fill="none"/><circle cx="7" cy="16" r=".6" fill="#8a542d"/><circle cx="16" cy="14" r=".5" fill="#8a542d"/>',
  },
  pocion_vida_minuscula: {
    id: 'pocion_vida_minuscula',
    label: 'Poción de vida minúscula',
    category: 'Consumible',
    description: 'Un pequeño frasco de cristal con un reconfortante brebaje rojo. Un sorbo de calma para seguir el camino.',
    effects: ['Restaura un 5 % de tu vida máxima.'],
    value: 10,
    usable: true,
    restore: { kind: 'health', percent: 5 },
    icon: '<ellipse cx="12" cy="21.5" rx="7" ry="1.3" fill="#59321e" opacity=".18" stroke="none"/><path d="M9 5h6v4l3.8 7.3A3.3 3.3 0 0 1 15.9 21H8.1a3.3 3.3 0 0 1-2.9-4.7L9 9Z" fill="#e3f0df" stroke="#6a4935" stroke-width="1.2"/><path d="m7.1 14-1.3 2.7A2.5 2.5 0 0 0 8.1 20h7.8a2.5 2.5 0 0 0 2.3-3.3L16.9 14c-3.8 1.5-6-1.5-9.8 0Z" fill="#c94b51" stroke="#9e3844" stroke-width=".6"/><path d="M8 16.5c2-1 5 1 8.2-.2" fill="none" stroke="#ef8b83" stroke-width="1"/><rect x="8.5" y="2" width="7" height="3.5" rx="1" fill="#b88546" stroke="#6a4935" stroke-width="1.1"/><path d="M10 3h3M8.7 9.5l-2 5" fill="none" stroke="#fff6dc" stroke-width="1.3" stroke-linecap="round"/><path d="M10.5 17h3M12 15.5v3" stroke="#fff0ca" stroke-width="1.1" stroke-linecap="round"/><circle cx="15" cy="11.7" r=".8" fill="#fff9de" stroke="none"/>',
  },
  pocion_mana_minuscula: {
    id: 'pocion_mana_minuscula', label: 'Poción de maná minúscula', category: 'Consumible',
    description: 'Un frasco azul con destellos plateados. Un pequeño respiro para volver a tejer magia.',
    effects: ['Restaura un 5 % de tu maná máximo. Solo para clases que usan maná.'],
    value: 10, usable: true, restore: { kind: 'mana', percent: 5 },
    icon: '<path d="M9 3h6v6l4 6v4l-3 3H8l-3-3v-4l4-6Z" fill="#dfedf4" stroke="#5c5363"/><path d="M6 14h12v5l-2 2H8l-2-2Z" fill="#568bd1" stroke="#426bab"/><path d="m12 14 1 2 2 1-2 1-1 2-1-2-2-1 2-1Z" fill="#f0e7c9" stroke="none"/><rect x="8" y="2" width="8" height="4" rx="1" fill="#b69765" stroke="#6a4935"/><path d="M8 12 7 15M10 3h3" stroke="#fff7df" fill="none" stroke-linecap="round"/>',
  },
  pocion_estamina_minuscula: {
    id: 'pocion_estamina_minuscula', label: 'Poción de estamina minúscula', category: 'Consumible',
    description: 'Un brebaje verde de aroma fresco y herbal. Un impulso para continuar la aventura.',
    effects: ['Restaura un 5 % de tu estamina máxima. Solo para clases que usan estamina.'],
    value: 10, usable: true, restore: { kind: 'stamina', percent: 5 },
    icon: '<path d="M9 4h6v5c5 2 6 5 5 9l-3 4H7l-3-4c-1-4 0-7 5-9Z" fill="#e3edda" stroke="#59634b"/><path d="M5 14q7 2 14 0v4l-3 3H8l-3-3Z" fill="#87ad52" stroke="#63833f"/><path d="m13 14-4 4h3l-1 3 5-5h-3Z" fill="#fff0b6" stroke="none"/><rect x="8" y="2" width="8" height="4" rx="1" fill="#b69765" stroke="#6a4935"/><path d="m8 11-2 4M10 3h3" stroke="#fff7df" fill="none" stroke-linecap="round"/>',
  },
};

for (const item of ADVANCED_WEAPONS) {
  const source = ITEMS[item.starter];
  ITEMS[item.id] = {
    id: item.id, label: item.label, category: source.category, stack: 1, value: item.value,
    rarity: rarityForTier(item.weapon.tier), stats: weaponItemStats(item.id),
    description: item.weapon.tier === 5
      ? 'Un artefacto excepcional del Fuego Primigenio, forjado con un núcleo de poder antiguo.'
      : item.weapon.tier === 4
        ? 'Equipo legendario de la Aurora, con metales nobles, engastes y runas de gran maestría.'
        : 'Equipo épico del Sello Violeta, con metal trabajado y focos rúnicos de poder.',
    icon: source.icon + `<path d="m19 14 3 4-3 4-3-4Z" fill="${ITEM_RARITIES[rarityForTier(item.weapon.tier)].color}" stroke="#332d36" stroke-width=".7"/>`,
  };
}

for (const item of ORIGINAL_WEAPONS) {
  ITEMS[item.id] = {
    id: item.id, label: item.label, category: ITEMS[item.starter].category, stack: 1, value: item.value,
    rarity: rarityForTier(item.weapon.tier), stats: weaponItemStats(item.id),
    description: ({
      alba: 'Una pieza de la Guardia del Alba, construida con acero claro, roble y engastes celestes.',
      eclipse: 'Una reliquia del Eclipse, de formas lunares, metal oscuro y cristales violetas.',
      roble: 'Artesanía del Roble Errante: madera curtida, hojas de acero y herrajes de caminante.',
      marea: 'Una pieza legendaria de la Marea Real, con formas de concha, coral y tridente.',
      forja: 'Un artefacto de la Forja Estelar, ensamblado con metal oscuro y núcleos de luz ámbar.',
    } as Record<string, string>)[item.collection],
    icon: originalWeaponIcon(item.weapon.kind, item.collection, item.weapon.slot === 'offhand'),
  };
}

export const DEFAULT_STACK = 50;
for (const outfit of Object.values(OUTFITS)) {
  ITEMS[outfit.id] = {
    id: outfit.id, label: outfit.label, category: 'Traje completo', stack: 1, value: outfit.value,
    rarity: rarityForTier(outfit.tier), stats: outfitItemStats(outfit.id),
    description: 'Un conjunto completo de tu clase. Se equipa en el pecho y sustituye la ropa visible; al retirarlo recuperas tu túnica habitual.',
    icon: weaponPortrait(outfit.id) ?? `<path d="m7 3 5 2 5-2 5 5-4 3-1 11H7L6 11 2 8Z" fill="${outfit.cloth}" stroke="${outfit.trim}"/>`,
  };
}
for (const item of Object.values(ITEMS)) {
  item.rarity ??= WEAPONS[item.id] ? rarityForTier(WEAPONS[item.id].tier) : 'common';
  const source = (item as ItemDef & { starterIcon?: string }).starterIcon;
  if (source) item.icon = ITEMS[source].icon + '<path d="m19 16 1 2 2 1-2 1-1 2-1-2-2-1 2-1Z" fill="#dba75b" stroke="#486d52" stroke-width=".7"/>'
    + (item.id.endsWith('_t2') ? '<path d="m19 9 1 2 2 1-2 1-1 2-1-2-2-1 2-1Z" fill="#edb64f" stroke="#714b2a" stroke-width=".7"/>' : '');
  if (WEAPONS[item.id]) item.icon = weaponPortrait(item.id) ?? item.icon;
}
export const itemStack = (id: string) => ITEMS[id]?.stack ?? DEFAULT_STACK;
export const itemDef = (id: string): ItemDef | undefined => ITEMS[id];
export const itemLabel = (id: string) => ITEMS[id]?.label ?? id;
export const itemRarity = (id: string) => ITEMS[id]?.rarity ?? 'common';
export const itemIcon = (id: string) => (ITEMS[id] ? `<svg class="item-art" data-rarity="${itemRarity(id)}" style="--item-rarity:${ITEM_RARITIES[itemRarity(id)].color}" viewBox="0 0 24 24" aria-hidden="true">${WEAPONS[id] || OUTFITS[id] ? weaponIconFrame(ITEM_RARITIES[itemRarity(id)].color) : `<rect x=".7" y=".7" width="22.6" height="22.6" rx="3" fill="${ITEM_RARITIES[itemRarity(id)].color}" fill-opacity=".09" stroke="${ITEM_RARITIES[itemRarity(id)].color}" stroke-width="1.2"/>`}${ITEMS[id].icon}</svg>` : '');

/** Lo que paga un vendedor por un objeto. */
export const sellPrice = (id: string) => Math.max(1, Math.floor((ITEMS[id]?.value ?? 0) / 2));

/** Mercancía de cada vendedor (por id de NPC). Los pelines del vendedor son infinitos: no se muestran. */
export const VENDOR_STOCK: Record<string, string[]> = {
  testiculos: ['pocion_vida_minuscula', 'pocion_mana_minuscula', 'pocion_estamina_minuscula', 'pan_duro',
    'espada_cobre_t1', 'escudo_roble_t1', 'baston_ambar_t1', 'daga_cazador_t1',
    'daga_secundaria_cazador_t1', 'varita_ambar_t1', 'grimorio_verde_t1', 'ballesta_roble_t1',
    'espada_cobre_t2', 'escudo_roble_t2', 'baston_ambar_t2', 'daga_cazador_t2',
    'daga_secundaria_cazador_t2', 'varita_ambar_t2', 'grimorio_verde_t2', 'ballesta_roble_t2',
    ...ADVANCED_WEAPONS.map(item => item.id), ...ORIGINAL_WEAPONS.map(item => item.id), ...Object.keys(OUTFITS)],
};
