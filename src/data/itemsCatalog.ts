import type { ItemRarity } from './itemRarity';
import type { EquipmentSlot } from './inventory';
import type { ClassId } from './data';

export const ITEM_CATEGORIES = [
  { id: 'weapon', label: 'Armas', icon: '⚔️' },
  { id: 'armor', label: 'Armaduras', icon: '🛡️' },
  { id: 'clothing', label: 'Cosméticos y ropa', icon: '👘' },
  { id: 'tool', label: 'Herramientas', icon: '⛏️' },
  { id: 'food', label: 'Alimentos y bebidas', icon: '🍞' },
  { id: 'resource', label: 'Materiales y recursos', icon: '🪵' },
  { id: 'crafting', label: 'Objetos de fabricación', icon: '⚙️' },
  { id: 'furniture', label: 'Muebles y decoración', icon: '🪑' },
  { id: 'quest', label: 'Objetos de misión', icon: '📜' },
  { id: 'consumable', label: 'Consumibles', icon: '🧪' },
  { id: 'special', label: 'Llaves y especiales', icon: '🗝️' },
  { id: 'pet_mount', label: 'Mascotas y monturas', icon: '🐎' },
] as const;

export type ItemCategoryId = (typeof ITEM_CATEGORIES)[number]['id'];

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  ITEM_CATEGORIES.map(c => [c.id, c.label])
);

export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  head: 'Cabeza (casco, capucha, tiara)',
  pendant: 'Colgante / Amuleto',
  chest: 'Pecho / Torso (túnica, coraza)',
  hands: 'Manos (guantes, brazales)',
  ring: 'Anillo',
  weapon: 'Arma principal (espada, bastón, arco)',
  offhand: 'Mano secundaria (escudo, daga, grimorio)',
  legs: 'Piernas y calzado',
  trinket: 'Abalorio / Reliquia',
};

export const CLASS_LABELS: Record<ClassId | 'any', string> = {
  any: 'Cualquier clase',
  guerrero: 'Guerrero',
  mago: 'Mago',
  picaro: 'Pícaro',
  clerigo: 'Clérigo',
  explorador: 'Explorador',
};

export const EFFECT_TYPES = [
  { id: 'restore_health', label: 'Restaurar salud (%)', param: 'percent', unit: '%' },
  { id: 'restore_health_flat', label: 'Restaurar salud (puntos fijos)', param: 'value', unit: 'PV' },
  { id: 'restore_mana', label: 'Restaurar maná (%)', param: 'percent', unit: '%' },
  { id: 'restore_stamina', label: 'Restaurar estamina (%)', param: 'percent', unit: '%' },
  { id: 'buff_food', label: 'Provisión nutritiva (+Salud y +Recurso máx.)', param: 'duration', unit: 'seg' },
  { id: 'grant_item', label: 'Entregar otro objeto', param: 'targetItem', unit: 'ID' },
  { id: 'teleport', label: 'Teletransporte a la posada', param: 'location', unit: 'destino' },
  { id: 'learn_recipe', label: 'Aprender receta de oficio', param: 'recipeId', unit: 'receta' },
  { id: 'audio_visual', label: 'Efecto audiovisual de celebración', param: 'effectName', unit: 'efecto' },
] as const;

export type EffectTypeId = (typeof EFFECT_TYPES)[number]['id'];

export interface ItemEffectDef {
  type: EffectTypeId | string;
  value?: number;
  percent?: number;
  duration?: number;
  extraStats?: { maxHealth?: number; maxResource?: number };
  targetItem?: string;
  count?: number;
  description?: string;
}

export interface ItemStatDef {
  label: string;
  value: string;
  key?: 'health' | 'resource' | 'power' | 'guard' | 'fuerza' | 'intelecto' | 'corpulencia' | 'agilidad' | 'pericia' | 'presencia' | 'percepcion';
  amount?: number;
}

export interface ItemCatalogItem {
  id: string;
  label: string;
  description: string;
  category: ItemCategoryId | string;
  subcategory?: string;
  rarity: ItemRarity;
  icon: string;
  model?: string;
  active: boolean;
  tags: string[];

  // Propiedades generales y de inventario:
  value: number;
  sellPrice?: number;
  stack: number;
  weight?: number;
  bound: boolean;
  sellable: boolean;
  tradable: boolean;
  storable: boolean;
  droppable: boolean;

  // Equipamiento:
  equippable: boolean;
  slot?: EquipmentSlot;
  requiredClass?: ClassId | 'any';
  minLevel?: number;
  durability?: number;
  maxDurability?: number;
  stats: ItemStatDef[];

  // Consumibles / Efectos:
  usable: boolean;
  effects: ItemEffectDef[];
  effectText?: string[];

  // Metadatos por categoría:
  food?: { duration: number; maxHealth: number; maxResource: number };
  furniture?: { kind: string; size?: number; complexity?: number };
  tool?: { kind: 'minero' | 'lenador' | 'recolector'; wearReduction?: number };
  questItem?: boolean;
}

export interface ItemCatalog {
  version: 1;
  items: ItemCatalogItem[];
}

export interface ItemReferences {
  quests: { id: string; title: string; objectiveItems: string[]; rewardItems: string[] }[];
  vendors: { id: string; name: string; items: string[] }[];
  recipes: { id: string; output: string; ingredients: string[] }[];
  coreItemIds: string[];
  models?: { id: string; name: string; path: string }[];
}

const ID_REGEX = /^[a-z0-9][a-z0-9_]{1,63}$/;

function fail(message: string): never {
  throw new Error(message);
}

function str(val: unknown, where: string, max = 2000, allowEmpty = false): string {
  if (typeof val !== 'string' || val.length > max || (!allowEmpty && !val.trim())) {
    fail(`${where}: texto no válido o excede ${max} caracteres.`);
  }
  return val;
}

function num(val: unknown, where: string, min = 0, max = 10_000_000): number {
  if (typeof val !== 'number' || !Number.isFinite(val) || val < min || val > max) {
    fail(`${where}: debe ser un número entre ${min} y ${max}.`);
  }
  return val;
}

export function sanitizeId(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'nuevo_objeto';
}

export function validateItem(val: unknown): ItemCatalogItem {
  if (!val || typeof val !== 'object' || Array.isArray(val)) {
    fail('El objeto debe ser un registro válido.');
  }
  const item = val as Record<string, any>;

  const id = str(item.id, 'ID de objeto', 64).trim();
  if (!ID_REGEX.test(id)) {
    fail(`El ID "${id}" no es válido. Debe contener solo minúsculas, números o guiones bajos (2-64 caracteres).`);
  }

  const label = str(item.label, 'Nombre del objeto', 120);
  const description = typeof item.description === 'string' ? item.description.slice(0, 1000) : '';
  const category = str(item.category, 'Categoría', 64);
  const subcategory = typeof item.subcategory === 'string' ? item.subcategory.slice(0, 64) : '';

  const validRarities: ItemRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'artifact'];
  const rarity: ItemRarity = validRarities.includes(item.rarity) ? item.rarity : 'common';

  const icon = typeof item.icon === 'string' ? item.icon : '';
  const model = typeof item.model === 'string' ? item.model.slice(0, 255) : undefined;
  const active = item.active !== false;
  const tags = Array.isArray(item.tags)
    ? item.tags.filter(t => typeof t === 'string' && t.trim()).map(t => String(t).trim().slice(0, 32))
    : [];

  const value = num(item.value ?? 0, 'Precio de compra (Pelines)', 0, 10_000_000);
  const sellPrice = item.sellPrice !== undefined ? num(item.sellPrice, 'Precio de venta', 0, 10_000_000) : Math.max(1, Math.floor(value / 2));
  const stack = num(item.stack ?? 1, 'Cantidad máxima por pila', 1, 9999);
  const weight = item.weight !== undefined ? num(item.weight, 'Peso', 0, 1000) : undefined;

  const bound = Boolean(item.bound);
  const sellable = item.sellable !== false;
  const tradable = item.tradable !== false;
  const storable = item.storable !== false;
  const droppable = item.droppable !== false;

  const equippable = Boolean(item.equippable);
  let slot: EquipmentSlot | undefined;
  let requiredClass: ClassId | 'any' | undefined;
  let minLevel: number | undefined;
  let durability: number | undefined;
  let maxDurability: number | undefined;

  if (equippable) {
    const validSlots: EquipmentSlot[] = ['head', 'pendant', 'chest', 'hands', 'ring', 'weapon', 'offhand', 'legs', 'trinket'];
    if (!item.slot || !validSlots.includes(item.slot)) {
      fail(`Ranura de equipamiento no válida para el objeto equipable "${label}".`);
    }
    slot = item.slot;
    const validClasses = ['any', 'guerrero', 'mago', 'picaro', 'clerigo', 'explorador'];
    requiredClass = validClasses.includes(item.requiredClass) ? item.requiredClass : 'any';
    minLevel = item.minLevel !== undefined ? num(item.minLevel, 'Nivel requerido', 1, 50) : 1;
    if (item.maxDurability !== undefined) {
      maxDurability = num(item.maxDurability, 'Durabilidad máxima', 1, 10000);
      durability = item.durability !== undefined ? num(item.durability, 'Durabilidad actual', 0, maxDurability) : maxDurability;
    }
  }

  const stats: ItemStatDef[] = Array.isArray(item.stats)
    ? item.stats.map((s, index) => {
        if (!s || typeof s !== 'object') fail(`Estadística ${index + 1} no válida.`);
        return {
          label: str(s.label, `Etiqueta estadística ${index + 1}`, 60),
          value: str(s.value, `Valor estadística ${index + 1}`, 40),
          key: s.key,
          amount: typeof s.amount === 'number' ? s.amount : undefined,
        };
      })
    : [];

  const usable = Boolean(item.usable);
  const effects: ItemEffectDef[] = Array.isArray(item.effects)
    ? item.effects.map((e, index) => {
        if (!e || typeof e !== 'object') fail(`Efecto ${index + 1} no válido.`);
        return {
          type: str(e.type, `Tipo de efecto ${index + 1}`, 60),
          value: typeof e.value === 'number' ? e.value : undefined,
          percent: typeof e.percent === 'number' ? e.percent : undefined,
          duration: typeof e.duration === 'number' ? e.duration : undefined,
          targetItem: typeof e.targetItem === 'string' ? e.targetItem : undefined,
          count: typeof e.count === 'number' ? e.count : undefined,
          description: typeof e.description === 'string' ? e.description : undefined,
          extraStats: e.extraStats && typeof e.extraStats === 'object' ? e.extraStats : undefined,
        };
      })
    : [];

  const effectText: string[] = Array.isArray(item.effectText)
    ? item.effectText.map(t => String(t))
    : effects.map(e => e.description || `${e.type}: ${e.percent ? e.percent + '%' : e.value ?? ''}`).filter(Boolean);

  let food: ItemCatalogItem['food'];
  if (item.food && typeof item.food === 'object') {
    food = {
      duration: num(item.food.duration ?? 900, 'Duración de comida', 10, 86400),
      maxHealth: num(item.food.maxHealth ?? 5, 'Vida adicional por comida', 0, 1000),
      maxResource: num(item.food.maxResource ?? 3, 'Recurso adicional por comida', 0, 1000),
    };
  }

  let furniture: ItemCatalogItem['furniture'];
  if (item.furniture && typeof item.furniture === 'object') {
    furniture = {
      kind: str(item.furniture.kind, 'Tipo de mueble', 60),
      size: typeof item.furniture.size === 'number' ? item.furniture.size : 1,
      complexity: typeof item.furniture.complexity === 'number' ? item.furniture.complexity : 1,
    };
  }

  let tool: ItemCatalogItem['tool'];
  if (item.tool && typeof item.tool === 'object') {
    const validTools = ['minero', 'lenador', 'recolector'];
    if (validTools.includes(item.tool.kind)) {
      tool = {
        kind: item.tool.kind,
        wearReduction: typeof item.tool.wearReduction === 'number' ? item.tool.wearReduction : 0,
      };
    }
  }

  return {
    id,
    label,
    description,
    category,
    subcategory: subcategory || undefined,
    rarity,
    icon,
    model: model || undefined,
    active,
    tags,
    value,
    sellPrice,
    stack,
    weight,
    bound,
    sellable,
    tradable,
    storable,
    droppable,
    equippable,
    slot,
    requiredClass,
    minLevel,
    durability,
    maxDurability,
    stats,
    usable,
    effects,
    effectText: effectText.length ? effectText : undefined,
    food,
    furniture,
    tool,
    questItem: Boolean(item.questItem),
  };
}

export function validateItemCatalog(val: unknown, refs?: ItemReferences): ItemCatalog {
  if (!val || typeof val !== 'object' || Array.isArray(val)) {
    fail('El catálogo de objetos debe ser un objeto JSON.');
  }
  const root = val as Record<string, any>;
  if (root.version !== 1) {
    fail('Versión de catálogo de objetos no compatible (se esperaba version 1).');
  }
  if (!Array.isArray(root.items)) {
    fail('El catálogo debe contener una lista de "items".');
  }

  const items: ItemCatalogItem[] = [];
  const ids = new Set<string>();

  for (let i = 0; i < root.items.length; i++) {
    const item = validateItem(root.items[i]);
    if (ids.has(item.id)) {
      fail(`ID duplicado en el catálogo: "${item.id}" (ítem #${i + 1}).`);
    }
    ids.add(item.id);
    items.push(item);
  }

  return { version: 1, items };
}

/** Comprueba en qué sistemas del juego está en uso un objeto. */
export function getItemUsageReferences(itemId: string, refs?: ItemReferences): string[] {
  if (!refs) return [];
  const usedIn: string[] = [];

  if (refs.coreItemIds.includes(itemId)) {
    usedIn.push('Sistema base del juego');
  }

  for (const q of refs.quests) {
    if (q.objectiveItems.includes(itemId)) {
      usedIn.push(`Misión: "${q.title}" (objetivo)`);
    }
    if (q.rewardItems.includes(itemId)) {
      usedIn.push(`Misión: "${q.title}" (recompensa)`);
    }
  }

  for (const v of refs.vendors) {
    if (v.items.includes(itemId)) {
      usedIn.push(`Comercio de NPC: ${v.name}`);
    }
  }

  for (const r of refs.recipes) {
    if (r.output === itemId) {
      usedIn.push(`Receta de artesanía (resultado: ${r.id})`);
    }
    if (r.ingredients.includes(itemId)) {
      usedIn.push(`Receta de artesanía (ingrediente de: ${r.id})`);
    }
  }

  return usedIn;
}

export const ITEM_TEMPLATES = [
  {
    id: 'material_apilable',
    name: 'Material o recurso apilable',
    description: 'Recurso básico para oficios y recolección. Se apila hasta 99 unidades.',
    item: {
      category: 'resource',
      rarity: 'common' as ItemRarity,
      value: 4,
      stack: 99,
      bound: false,
      sellable: true,
      tradable: true,
      storable: true,
      droppable: true,
      equippable: false,
      usable: false,
      stats: [],
      effects: [],
      tags: ['material', 'artesania'],
    },
  },
  {
    id: 'arma_guerrero',
    name: 'Arma cuerpo a cuerpo (Guerrero)',
    description: 'Espada de combate con potencia física. Ranura weapon.',
    item: {
      category: 'weapon',
      rarity: 'uncommon' as ItemRarity,
      value: 120,
      stack: 1,
      bound: false,
      sellable: true,
      tradable: true,
      storable: true,
      droppable: true,
      equippable: true,
      slot: 'weapon' as EquipmentSlot,
      requiredClass: 'guerrero' as ClassId,
      minLevel: 1,
      stats: [
        { label: 'Potencia de arma', value: '+14', key: 'power' as const, amount: 14 },
        { label: 'Fuerza', value: '+2', key: 'fuerza' as const, amount: 2 },
      ],
      usable: false,
      effects: [],
      tags: ['arma', 'espada', 'guerrero'],
    },
  },
  {
    id: 'arma_mago',
    name: 'Bastón mágico (Mago)',
    description: 'Arma canalizadora de maná y hechizos. Ranura weapon.',
    item: {
      category: 'weapon',
      rarity: 'uncommon' as ItemRarity,
      value: 130,
      stack: 1,
      bound: false,
      sellable: true,
      tradable: true,
      storable: true,
      droppable: true,
      equippable: true,
      slot: 'weapon' as EquipmentSlot,
      requiredClass: 'mago' as ClassId,
      minLevel: 1,
      stats: [
        { label: 'Poder de hechizo', value: '+16', key: 'power' as const, amount: 16 },
        { label: 'Maná máximo', value: '+15', key: 'resource' as const, amount: 15 },
      ],
      usable: false,
      effects: [],
      tags: ['arma', 'baston', 'mago'],
    },
  },
  {
    id: 'armadura_pecho',
    name: 'Armadura de torso (Protección)',
    description: 'Pieza de equipo para el pecho que otorga Guardia y Vida máxima.',
    item: {
      category: 'armor',
      rarity: 'uncommon' as ItemRarity,
      value: 150,
      stack: 1,
      bound: false,
      sellable: true,
      tradable: true,
      storable: true,
      droppable: true,
      equippable: true,
      slot: 'chest' as EquipmentSlot,
      requiredClass: 'any' as const,
      minLevel: 1,
      stats: [
        { label: 'Guardia', value: '+8', key: 'guard' as const, amount: 8 },
        { label: 'Vida máxima', value: '+20', key: 'health' as const, amount: 20 },
      ],
      usable: false,
      effects: [],
      tags: ['armadura', 'pecho', 'guardia'],
    },
  },
  {
    id: 'herramienta_minero',
    name: 'Herramienta de recolección (Pico)',
    description: 'Pico para extraer minerales de los filones en Pompelín.',
    item: {
      category: 'tool',
      rarity: 'common' as ItemRarity,
      value: 50,
      stack: 1,
      bound: false,
      sellable: true,
      tradable: true,
      storable: true,
      droppable: true,
      equippable: true,
      slot: 'offhand' as EquipmentSlot,
      requiredClass: 'any' as const,
      minLevel: 1,
      maxDurability: 100,
      durability: 100,
      tool: { kind: 'minero' as const, wearReduction: 0 },
      stats: [
        { label: 'Oficio', value: 'Minero' },
        { label: 'Desgaste por uso', value: 'Normal' },
      ],
      usable: true,
      effects: [],
      tags: ['herramienta', 'minero', 'recoleccion'],
    },
  },
  {
    id: 'pocion_curativa',
    name: 'Poción curativa (Consumible)',
    description: 'Brebaje alquímico que restaura salud al consumirse.',
    item: {
      category: 'consumable',
      rarity: 'common' as ItemRarity,
      value: 15,
      stack: 50,
      bound: false,
      sellable: true,
      tradable: true,
      storable: true,
      droppable: true,
      equippable: false,
      usable: true,
      effects: [
        {
          type: 'restore_health',
          percent: 25,
          description: 'Restaura un 25 % de tu vida máxima.',
        },
      ],
      effectText: ['Restaura un 25 % de tu vida máxima al instante.'],
      stats: [],
      tags: ['consumible', 'pocion', 'curacion'],
    },
  },
  {
    id: 'comida_vital',
    name: 'Provisión nutritiva (Alimento)',
    description: 'Comida apetitosa que otorga aumento de salud durante 15 minutos.',
    item: {
      category: 'food',
      rarity: 'common' as ItemRarity,
      value: 10,
      stack: 50,
      bound: false,
      sellable: true,
      tradable: true,
      storable: true,
      droppable: true,
      equippable: false,
      usable: true,
      food: { duration: 900, maxHealth: 15, maxResource: 10 },
      effects: [
        {
          type: 'buff_food',
          duration: 900,
          extraStats: { maxHealth: 15, maxResource: 10 },
          description: '+15 de vida máx. y +10 de recurso máx. durante 15 minutos.',
        },
      ],
      effectText: ['+15 de vida máxima y +10 de maná/estamina durante 15 minutos de conexión.'],
      stats: [],
      tags: ['comida', 'nutricion', 'cocina'],
    },
  },
  {
    id: 'mueble_hogar',
    name: 'Mobiliario para el hogar',
    description: 'Mueble artesanal para decorar la habitación de la posada o casa.',
    item: {
      category: 'furniture',
      rarity: 'uncommon' as ItemRarity,
      value: 80,
      stack: 1,
      bound: false,
      sellable: true,
      tradable: true,
      storable: true,
      droppable: true,
      equippable: false,
      usable: false,
      furniture: { kind: 'chair', size: 1, complexity: 1 },
      stats: [{ label: 'Decoración de hogar', value: 'Confort acogedor' }],
      effects: [],
      tags: ['mueble', 'hogar', 'decoracion'],
    },
  },
  {
    id: 'objeto_mision',
    name: 'Objeto de misión clave',
    description: 'Artículo ligado que forma parte de un encargo o misterio.',
    item: {
      category: 'quest',
      rarity: 'rare' as ItemRarity,
      value: 0,
      stack: 1,
      bound: true,
      sellable: false,
      tradable: false,
      storable: true,
      droppable: false,
      equippable: false,
      usable: false,
      questItem: true,
      stats: [],
      effects: [],
      tags: ['mision', 'clave', 'historia'],
    },
  },
  {
    id: 'joya_accesorio',
    name: 'Joya o accesorio (Anillo / Colgante)',
    description: 'Adorno valioso con propiedades místicas.',
    item: {
      category: 'armor',
      rarity: 'rare' as ItemRarity,
      value: 300,
      stack: 1,
      bound: false,
      sellable: true,
      tradable: true,
      storable: true,
      droppable: true,
      equippable: true,
      slot: 'ring' as EquipmentSlot,
      requiredClass: 'any' as const,
      minLevel: 5,
      stats: [
        { label: 'Vida máxima', value: '+30', key: 'health' as const, amount: 30 },
        { label: 'Recurso máximo', value: '+20', key: 'resource' as const, amount: 20 },
      ],
      usable: false,
      effects: [],
      tags: ['joya', 'anillo', 'accesorio'],
    },
  },
];

export function createItemFromTemplate(templateId: string, customId = '', customName = ''): ItemCatalogItem {
  const tpl = ITEM_TEMPLATES.find(t => t.id === templateId) || ITEM_TEMPLATES[0];
  const id = sanitizeId(customId || customName || tpl.id);
  const label = customName || tpl.name;

  return validateItem({
    id,
    label,
    description: tpl.description,
    ...tpl.item,
    icon: '<circle cx="12" cy="12" r="8" fill="#586c55" stroke="#9bb18d" stroke-width="1.5"/>',
    active: true,
  });
}
