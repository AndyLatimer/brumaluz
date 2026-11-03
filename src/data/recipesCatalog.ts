import type { ItemRarity } from './itemRarity';

/**
 * Definición de una estación de trabajo o fabricación (administrativa).
 */
export interface CraftingStationDef {
  id: string;
  label: string;
  description: string;
  icon: string;
  job?: string; // Profesión asociada (opcional)
  category?: string; // ej: 'Taller', 'Hogar', 'Especial'
  active: boolean;
}

/**
 * Ingrediente requerido para fabricar una receta.
 */
export interface RecipeIngredientDef {
  itemId: string;
  count: number;
}

/**
 * Objeto resultante de la fabricación.
 */
export interface RecipeOutputDef {
  itemId: string;
  count: number;
  chance?: number; // 0 - 100 %, por defecto 100
  isPrimary?: boolean;
}

/**
 * Requisitos y condiciones de desbloqueo opcionales.
 */
export interface RecipeRequirementDef {
  minCharacterLevel?: number;
  requiredProfession?: string;
  requiredRank?: number; // 0: Aprendiz, 1: Iniciado, 2: Oficial, 3: Experto, 4: Maestro, 5: Gran maestro
  requiredQuestId?: string;
  requiredRecipeId?: string;
  customNote?: string;
}

/**
 * Registro completo de una receta de fabricación.
 */
export interface RecipeCatalogItem {
  id: string;
  label: string;
  description: string;
  category: string; // ej: 'muebles', 'armas', 'armaduras', 'alimentos', 'pociones', 'componentes', 'herramientas'
  folder?: string; // Carpeta u organización temática (ej: "Mobiliario básico", "Forja de acero")
  icon?: string; // SVG o identificador visual opcional (si se omite, hereda del resultado)
  active: boolean;
  ingredients: RecipeIngredientDef[];
  output: RecipeOutputDef;
  extraOutputs?: RecipeOutputDef[]; // Subproductos opcionales
  craftingTime: number; // Tiempo en segundos (ej: 30)
  successRate: number; // Probabilidad de éxito (0 - 100 %)
  stations: string[]; // Identificadores de estaciones admitidas (ej: ['banco_carpinteria'])
  requirements: RecipeRequirementDef;
  tags: string[];
  notes?: string;
}

/**
 * Estructura raíz del catálogo de recetas y estaciones del editor.
 */
export interface RecipeCatalog {
  version: 1;
  stations: CraftingStationDef[];
  recipes: RecipeCatalogItem[];
  folders?: string[];
}

/**
 * Referencias de sistemas existentes del juego para autocompletado y auditoría.
 */
export interface RecipeReferences {
  items: {
    id: string;
    label: string;
    category: string;
    rarity: ItemRarity | string;
    icon?: string;
    value?: number;
    stack?: number;
  }[];
  quests: {
    id: string;
    title: string;
  }[];
  professions: Record<string, string>;
  ranks: string[];
  existingRecipes?: Record<string, { id: string; label: string; job: string; output: string; ingredients: Record<string, number> }>;
}

/**
 * Lista de profesiones existentes del MMORPG Brumaluz (canon oficial de professions.ts).
 */
export const PROFESSIONS_LIST: { id: string; label: string; icon: string }[] = [
  { id: 'carpinteria', label: 'Carpintería', icon: '🪚' },
  { id: 'ebanisteria', label: 'Ebanistería', icon: '🪑' },
  { id: 'herreria', label: 'Herrería', icon: '🔨' },
  { id: 'peleteria', label: 'Peletería', icon: '🧤' },
  { id: 'sastreria', label: 'Sastrería', icon: '🧵' },
  { id: 'joyeria', label: 'Joyería', icon: '💍' },
  { id: 'alquimia', label: 'Alquimia', icon: '🧪' },
  { id: 'encantamiento', label: 'Encantamiento', icon: '✨' },
  { id: 'cocina', label: 'Cocina', icon: '🍲' },
  { id: 'minero', label: 'Minero', icon: '⛏️' },
  { id: 'lenador', label: 'Leñador', icon: '🪓' },
  { id: 'recolector', label: 'Recolector', icon: '🌿' },
];

export const PROFESSION_LABELS: Record<string, string> = Object.fromEntries(
  PROFESSIONS_LIST.map(p => [p.id, p.label])
);

export const PROFESSION_RANKS = [
  'Aprendiz',
  'Iniciado',
  'Oficial',
  'Experto',
  'Maestro',
  'Gran maestro',
] as const;

/**
 * Categorías estándar de recetas.
 */
export const RECIPE_CATEGORIES = [
  { id: 'mueble', label: 'Muebles y decoración', icon: '🪑' },
  { id: 'arma', label: 'Armas y combate', icon: '⚔️' },
  { id: 'armadura', label: 'Armaduras y prendas', icon: '🛡️' },
  { id: 'alimento', label: 'Alimentos y cocina', icon: '🍞' },
  { id: 'pocion', label: 'Pociones y elixires', icon: '🧪' },
  { id: 'componente', label: 'Componentes y materiales', icon: '⚙️' },
  { id: 'herramienta', label: 'Herramientas de oficio', icon: '⛏️' },
  { id: 'pergamino', label: 'Pergaminos y magia', icon: '📜' },
  { id: 'especial', label: 'Objetos especiales', icon: '🗝️' },
] as const;

/**
 * Estaciones de fabricación predeterminadas recomendadas por el MMORPG.
 */
export const DEFAULT_STATIONS: CraftingStationDef[] = [
  {
    id: 'banco_carpinteria',
    label: 'Banco de carpintería',
    description: 'Mesa de corte, cepillado y ensamblaje de maderas y muebles.',
    icon: '<path d="M4 10h16v3H4zm2 3v7m12-7v7M7 10V6h10v4" fill="none" stroke="#d5b075" stroke-width="2"/>',
    job: 'carpinteria',
    category: 'Taller',
    active: true,
  },
  {
    id: 'forja',
    label: 'Forja y yunque',
    description: 'Yunque de acero endurecido y fragua de carbón para fundir y modelar metales.',
    icon: '<path d="M6 7h12l3 4-4 2v6H7v-6L3 11Z" fill="#c49b67" stroke="#483321" stroke-width="1.5"/><circle cx="12" cy="11" r="2" fill="#e55a3c"/>',
    job: 'herreria',
    category: 'Taller',
    active: true,
  },
  {
    id: 'cocina',
    label: 'Fogón y cocina',
    description: 'Horno de piedra y cazuelas para guisos, asados y panadería.',
    icon: '<rect x="4" y="6" width="16" height="14" rx="2" fill="#68564c"/><circle cx="9" cy="11" r="2.5" fill="#e57b32"/><circle cx="15" cy="11" r="2.5" fill="#e57b32"/>',
    job: 'cocina',
    category: 'Taller',
    active: true,
  },
  {
    id: 'mesa_alquimia',
    label: 'Mesa de alquimia',
    description: 'Alambique de cobre, matraces graduados y mortero para pociones y elixires.',
    icon: '<path d="M9 3h6v5l5 10H4l5-10V3Z" fill="#7ba395" stroke="#374843" stroke-width="1.5"/><circle cx="12" cy="14" r="2" fill="#b9f0d8"/>',
    job: 'alquimia',
    category: 'Taller',
    active: true,
  },
  {
    id: 'telar',
    label: 'Telar y rueca',
    description: 'Estructura de madera para hilar lino, lana y tejer telas finas.',
    icon: '<path d="M5 4v16m14-16v16M5 8h14M5 12h14M5 16h14" stroke="#d1b894" stroke-width="2"/>',
    job: 'sastreria',
    category: 'Taller',
    active: true,
  },
  {
    id: 'banco_ebanisteria',
    label: 'Banco de ebanistería',
    description: 'Puesto de trabajo de precisión para muebles finos, tallas ornamentadas y ensambles.',
    icon: '<rect x="3" y="8" width="18" height="5" rx="1" fill="#8e5d36"/><path d="M5 13v7m14-7v7M7 8V4h4v4" stroke="#e0c293" stroke-width="1.5"/>',
    job: 'ebanisteria',
    category: 'Taller',
    active: true,
  },
  {
    id: 'mesa_encantamiento',
    label: 'Mesa de encantamiento',
    description: 'Atril arcano con runas grabadas para imbuir equipo y crear pergaminos.',
    icon: '<circle cx="12" cy="12" r="8" fill="none" stroke="#9d86d6" stroke-width="2"/><path d="m12 6 2 4 4 2-4 2-2 4-2-4-4-2 4-2Z" fill="#e2c8ff"/>',
    job: 'encantamiento',
    category: 'Taller',
    active: true,
  },
  {
    id: 'curtiduria',
    label: 'Bastidor de curtido',
    description: 'Tableros de estiramiento y raspado para pieles, cuero reforzado y correajes.',
    icon: '<path d="m7 4 5 2 5-2 3 5-3 9-5 2-5-2-3-9Z" fill="#a87f52" stroke="#54371f" stroke-width="1.5"/>',
    job: 'peleteria',
    category: 'Taller',
    active: true,
  },
  {
    id: 'banco_joyeria',
    label: 'Banco de orfebre y joyería',
    description: 'Mesa con lupas, engastadores y crisol para gemas, anillos y amuletos.',
    icon: '<path d="m12 3 6 5-6 13L6 8Z" fill="#71b5d1" stroke="#2c5163" stroke-width="1.5"/><path d="M6 8h12M12 3v18" stroke="#ffffff" opacity="0.6"/>',
    job: 'joyeria',
    category: 'Taller',
    active: true,
  },
  {
    id: 'fabricacion_manual',
    label: 'Fabricación manual (sin estación)',
    description: 'Trabajos sencillos que el personaje puede realizar en cualquier lugar sin herramientas pesadas.',
    icon: '<circle cx="12" cy="12" r="7" fill="none" stroke="#a3b899" stroke-width="2"/><path d="m9 12 2 2 4-4" stroke="#a3b899" stroke-width="2" fill="none"/>',
    category: 'General',
    active: true,
  },
];

/**
 * Plantillas predefinidas para acelerar la creación de cientos de recetas.
 */
export const RECIPE_TEMPLATES: {
  id: string;
  name: string;
  description: string;
  category: string;
  recipe: Omit<RecipeCatalogItem, 'id' | 'label'>;
}[] = [
  {
    id: 'mesa_madera',
    name: 'Mesa de madera (Carpintería)',
    description: 'Mesa robusta de cuatro patas para hogares o posadas (ejemplo de canon).',
    category: 'mueble',
    recipe: {
      description: 'Mesa artesanal de madera ensamblada con clavos y tablones de abedul.',
      category: 'mueble',
      folder: 'Muebles de carpintería',
      active: true,
      ingredients: [
        { itemId: 'madera', count: 8 },
        { itemId: 'tablones', count: 4 },
        { itemId: 'clavos', count: 2 },
      ],
      output: { itemId: 'mesa_madera', count: 1, chance: 100, isPrimary: true },
      craftingTime: 30,
      successRate: 100,
      stations: ['banco_carpinteria'],
      requirements: {
        requiredProfession: 'carpinteria',
        requiredRank: 0,
        minCharacterLevel: 1,
      },
      tags: ['mueble', 'madera', 'carpinteria', 'mesa', 'hogar'],
    },
  },
  {
    id: 'espada_acero',
    name: 'Espada de acero templado (Herrería)',
    description: 'Arma de una mano forjada con lingotes de metal y empuñadura de cuero.',
    category: 'arma',
    recipe: {
      description: 'Hoja equilibrada y afilada en el yunque de la forja.',
      category: 'arma',
      folder: 'Armas de forja',
      active: true,
      ingredients: [
        { itemId: 'lingote_acero', count: 4 },
        { itemId: 'tira_cuero', count: 2 },
        { itemId: 'mango_madera', count: 1 },
      ],
      output: { itemId: 'espada_acero_templado', count: 1, chance: 100, isPrimary: true },
      craftingTime: 45,
      successRate: 100,
      stations: ['forja'],
      requirements: {
        requiredProfession: 'herreria',
        requiredRank: 1,
        minCharacterLevel: 5,
      },
      tags: ['arma', 'herreria', 'espada', 'acero'],
    },
  },
  {
    id: 'coraza_hierro',
    name: 'Coraza de placas de hierro (Herrería)',
    description: 'Pieza de torso de protección pesada para guerreros.',
    category: 'armadura',
    recipe: {
      description: 'Placas martilladas y remachadas con forro interior protector.',
      category: 'armadura',
      folder: 'Armaduras de forja',
      active: true,
      ingredients: [
        { itemId: 'lingote_hierro', count: 6 },
        { itemId: 'remaches_hierro', count: 4 },
        { itemId: 'cuero_curtido', count: 2 },
      ],
      output: { itemId: 'coraza_placas_hierro', count: 1, chance: 100, isPrimary: true },
      craftingTime: 60,
      successRate: 95,
      stations: ['forja'],
      requirements: {
        requiredProfession: 'herreria',
        requiredRank: 1,
        minCharacterLevel: 8,
      },
      tags: ['armadura', 'herreria', 'placas', 'pecho'],
    },
  },
  {
    id: 'pocion_vital',
    name: 'Poción reconstituyente (Alquimia)',
    description: 'Brebaje medicinal que restaura salud al consumirse.',
    category: 'pocion',
    recipe: {
      description: 'Destilado de hierbas silvestres y agua de manantial.',
      category: 'pocion',
      folder: 'Elixires y pociones',
      active: true,
      ingredients: [
        { itemId: 'hierbas_silvestres', count: 3 },
        { itemId: 'vial_vidrio', count: 1 },
        { itemId: 'agua_pura', count: 1 },
      ],
      output: { itemId: 'pocion_salud_menor', count: 1, chance: 100, isPrimary: true },
      craftingTime: 15,
      successRate: 100,
      stations: ['mesa_alquimia'],
      requirements: {
        requiredProfession: 'alquimia',
        requiredRank: 0,
      },
      tags: ['pocion', 'alquimia', 'salud', 'consumible'],
    },
  },
  {
    id: 'pan_centeno',
    name: 'Pan de centeno artesanal (Cocina)',
    description: 'Alimento nutritivo horneado que concede energía y bienestar.',
    category: 'alimento',
    recipe: {
      description: 'Hogaza crujiente elaborada con masa madre y cocida en fogón.',
      category: 'alimento',
      folder: 'Panadería y repostería',
      active: true,
      ingredients: [
        { itemId: 'harina_centeno', count: 3 },
        { itemId: 'agua_pura', count: 1 },
        { itemId: 'levadura', count: 1 },
      ],
      output: { itemId: 'pan_centeno_horneado', count: 2, chance: 100, isPrimary: true },
      craftingTime: 20,
      successRate: 100,
      stations: ['cocina'],
      requirements: {
        requiredProfession: 'cocina',
        requiredRank: 0,
      },
      tags: ['comida', 'cocina', 'pan', 'alimento'],
    },
  },
  {
    id: 'tunica_lino',
    name: 'Túnica de lino bordada (Sastrería)',
    description: 'Prenda ligera tejida con fibras textiles para eruditos y magos.',
    category: 'armadura',
    recipe: {
      description: 'Tejido suave cortado en telar y decorado con puntadas finas.',
      category: 'armadura',
      folder: 'Prendas y telas',
      active: true,
      ingredients: [
        { itemId: 'tela_lino', count: 4 },
        { itemId: 'hilo_dorado', count: 2 },
      ],
      output: { itemId: 'tunica_lino_magica', count: 1, chance: 100, isPrimary: true },
      craftingTime: 40,
      successRate: 100,
      stations: ['telar'],
      requirements: {
        requiredProfession: 'sastreria',
        requiredRank: 0,
        minCharacterLevel: 3,
      },
      tags: ['sastreria', 'tunica', 'ropa', 'mago'],
    },
  },
  {
    id: 'banco_descanso',
    name: 'Banco rústico de descanso (Ebanistería)',
    description: 'Asiento de madera tallada con molduras para decoración de interiores.',
    category: 'mueble',
    recipe: {
      description: 'Banco amplio de dos plazas tallado en madera maciza.',
      category: 'mueble',
      folder: 'Muebles de ebanistería',
      active: true,
      ingredients: [
        { itemId: 'madera_roble', count: 6 },
        { itemId: 'clavos', count: 4 },
        { itemId: 'barniz_madera', count: 1 },
      ],
      output: { itemId: 'banco_rustico_roble', count: 1, chance: 100, isPrimary: true },
      craftingTime: 35,
      successRate: 100,
      stations: ['banco_ebanisteria'],
      requirements: {
        requiredProfession: 'ebanisteria',
        requiredRank: 1,
      },
      tags: ['mueble', 'ebanisteria', 'asiento', 'hogar'],
    },
  },
  {
    id: 'componente_forja',
    name: 'Piezas de ensamblaje (Herrería)',
    description: 'Remaches, clavos y grapas de metal indispensables para otras recetas.',
    category: 'componente',
    recipe: {
      description: 'Lote de componentes metálicos forjados a partir de lingotes.',
      category: 'componente',
      folder: 'Componentes de forja',
      active: true,
      ingredients: [
        { itemId: 'lingote_cobre', count: 2 },
      ],
      output: { itemId: 'piezas_ensamblaje_metal', count: 4, chance: 100, isPrimary: true },
      craftingTime: 12,
      successRate: 100,
      stations: ['forja'],
      requirements: {
        requiredProfession: 'herreria',
        requiredRank: 0,
      },
      tags: ['componente', 'herreria', 'metal'],
    },
  },
];

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

/**
 * Sanitiza un string para convertirlo en un ID técnico snake_case seguro.
 */
export function sanitizeId(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'nueva_receta';
}

/**
 * Valida la definición de una estación de fabricación.
 */
export function validateStation(val: unknown): CraftingStationDef {
  if (!val || typeof val !== 'object' || Array.isArray(val)) {
    fail('La estación de fabricación debe ser un objeto válido.');
  }
  const s = val as Record<string, any>;
  const id = str(s.id, 'ID de estación', 64).trim();
  if (!ID_REGEX.test(id)) {
    fail(`El ID de estación "${id}" no es válido. Debe contener solo minúsculas, números y guiones bajos (2-64 caracteres).`);
  }
  const label = str(s.label, 'Nombre de la estación', 100);
  const description = typeof s.description === 'string' ? s.description.slice(0, 1000) : '';
  const icon = typeof s.icon === 'string' ? s.icon : '';
  const job = typeof s.job === 'string' && s.job.trim() ? s.job.trim() : undefined;
  const category = typeof s.category === 'string' && s.category.trim() ? s.category.trim() : undefined;
  const active = s.active !== false;

  return { id, label, description, icon, job, category, active };
}

/**
 * Valida un ingrediente de una receta.
 */
export function validateIngredient(val: unknown, index = 0): RecipeIngredientDef {
  if (!val || typeof val !== 'object' || Array.isArray(val)) {
    fail(`El ingrediente #${index + 1} debe ser un registro válido.`);
  }
  const ing = val as Record<string, any>;
  const itemId = str(ing.itemId, `Ingrediente #${index + 1}: ID de objeto`, 64).trim();
  const count = Math.floor(num(ing.count ?? 1, `Ingrediente #${index + 1} (${itemId}): Cantidad`, 1, 9999));

  return { itemId, count };
}

/**
 * Valida el objeto resultante de una receta.
 */
export function validateOutput(val: unknown, where = 'Resultado'): RecipeOutputDef {
  if (!val || typeof val !== 'object' || Array.isArray(val)) {
    fail(`${where} debe ser un registro válido.`);
  }
  const out = val as Record<string, any>;
  const itemId = str(out.itemId, `${where}: ID de objeto resultante`, 64).trim();
  const count = Math.floor(num(out.count ?? 1, `${where}: Cantidad`, 1, 9999));
  const chance = out.chance !== undefined ? Math.min(100, Math.max(0, num(out.chance, `${where}: Probabilidad`, 0, 100))) : 100;
  const isPrimary = out.isPrimary !== false;

  return { itemId, count, chance, isPrimary };
}

/**
 * Valida una receta individual completa.
 */
export function validateRecipe(
  val: unknown,
  knownItemIds?: Set<string>,
  knownStationIds?: Set<string>
): RecipeCatalogItem {
  if (!val || typeof val !== 'object' || Array.isArray(val)) {
    fail('La receta debe ser un objeto válido.');
  }
  const r = val as Record<string, any>;

  const id = str(r.id, 'ID de receta', 64).trim();
  if (!ID_REGEX.test(id)) {
    fail(`El ID de receta "${id}" no es válido. Debe contener solo minúsculas, números y guiones bajos (2-64 caracteres).`);
  }

  const label = str(r.label, 'Nombre de la receta', 120);
  const description = typeof r.description === 'string' ? r.description.slice(0, 1000) : '';
  const category = str(r.category, 'Categoría de receta', 64);
  const folder = typeof r.folder === 'string' && r.folder.trim() ? r.folder.trim().slice(0, 64) : undefined;
  const icon = typeof r.icon === 'string' ? r.icon : undefined;
  const active = r.active !== false;

  if (!Array.isArray(r.ingredients) || r.ingredients.length === 0) {
    fail(`La receta "${label}" debe tener al menos un ingrediente.`);
  }

  const seenIngredients = new Set<string>();
  const ingredients: RecipeIngredientDef[] = r.ingredients.map((ingVal, idx) => {
    const ing = validateIngredient(ingVal, idx);
    if (seenIngredients.has(ing.itemId)) {
      fail(`La receta "${label}" contiene el ingrediente "${ing.itemId}" duplicado.`);
    }
    seenIngredients.add(ing.itemId);
    return ing;
  });

  const output = validateOutput(r.output ?? { itemId: r.id, count: 1 });

  const extraOutputs: RecipeOutputDef[] = [];
  if (Array.isArray(r.extraOutputs)) {
    for (let i = 0; i < r.extraOutputs.length; i++) {
      extraOutputs.push(validateOutput(r.extraOutputs[i], `Subproducto #${i + 1}`));
    }
  }

  const craftingTime = num(r.craftingTime ?? 0, 'Tiempo de fabricación (segundos)', 0, 86400);
  const successRate = num(r.successRate ?? 100, 'Probabilidad de éxito (%)', 0, 100);

  const stations = Array.isArray(r.stations)
    ? r.stations.filter(s => typeof s === 'string' && s.trim()).map(s => String(s).trim())
    : [];

  const reqObj = (r.requirements && typeof r.requirements === 'object') ? r.requirements : {};
  const requirements: RecipeRequirementDef = {
    minCharacterLevel: reqObj.minCharacterLevel ? num(reqObj.minCharacterLevel, 'Nivel mínimo', 1, 1000) : undefined,
    requiredProfession: typeof reqObj.requiredProfession === 'string' && reqObj.requiredProfession.trim() ? reqObj.requiredProfession.trim() : undefined,
    requiredRank: reqObj.requiredRank !== undefined ? num(reqObj.requiredRank, 'Rango requerido', 0, 5) : undefined,
    requiredQuestId: typeof reqObj.requiredQuestId === 'string' && reqObj.requiredQuestId.trim() ? reqObj.requiredQuestId.trim() : undefined,
    requiredRecipeId: typeof reqObj.requiredRecipeId === 'string' && reqObj.requiredRecipeId.trim() ? reqObj.requiredRecipeId.trim() : undefined,
    customNote: typeof reqObj.customNote === 'string' && reqObj.customNote.trim() ? reqObj.customNote.trim().slice(0, 300) : undefined,
  };

  const tags = Array.isArray(r.tags)
    ? r.tags.filter(t => typeof t === 'string' && t.trim()).map(t => String(t).trim().slice(0, 32))
    : [];

  const notes = typeof r.notes === 'string' ? r.notes.slice(0, 1000) : undefined;

  return {
    id,
    label,
    description,
    category,
    folder,
    icon,
    active,
    ingredients,
    output,
    extraOutputs: extraOutputs.length > 0 ? extraOutputs : undefined,
    craftingTime,
    successRate,
    stations,
    requirements,
    tags,
    notes,
  };
}

/**
 * Valida un catálogo completo de recetas y estaciones.
 */
export function validateRecipeCatalog(
  val: unknown,
  references?: RecipeReferences
): RecipeCatalog {
  if (!val || typeof val !== 'object' || Array.isArray(val)) {
    fail('El catálogo de recetas debe ser un objeto válido.');
  }
  const root = val as Record<string, any>;
  if (root.version !== 1) {
    fail(`Versión de catálogo incompatible: ${root.version}. Se esperaba version 1.`);
  }

  // Estaciones
  const stationsRaw = Array.isArray(root.stations) ? root.stations : DEFAULT_STATIONS;
  const stations: CraftingStationDef[] = [];
  const stationIds = new Set<string>();

  for (const s of stationsRaw) {
    const station = validateStation(s);
    if (stationIds.has(station.id)) {
      fail(`ID de estación duplicado: "${station.id}".`);
    }
    stationIds.add(station.id);
    stations.push(station);
  }

  // Si no se incluyeron estaciones, cargar al menos las por defecto
  if (stations.length === 0) {
    for (const s of DEFAULT_STATIONS) {
      stations.push({ ...s });
      stationIds.add(s.id);
    }
  }

  // Carpetas organizativas
  const folders = Array.isArray(root.folders)
    ? root.folders.filter(f => typeof f === 'string' && f.trim()).map(f => String(f).trim().slice(0, 64))
    : [];

  // Recetas
  const recipesRaw = Array.isArray(root.recipes) ? root.recipes : [];
  const recipes: RecipeCatalogItem[] = [];
  const recipeIds = new Set<string>();

  const knownItemIds = references?.items ? new Set(references.items.map(i => i.id)) : undefined;

  for (const r of recipesRaw) {
    const recipe = validateRecipe(r, knownItemIds, stationIds);
    if (recipeIds.has(recipe.id)) {
      fail(`ID de receta duplicado: "${recipe.id}". Cada receta debe tener un identificador técnico único.`);
    }
    recipeIds.add(recipe.id);
    recipes.push(recipe);
  }

  return {
    version: 1,
    stations,
    recipes,
    folders: folders.length > 0 ? Array.from(new Set(folders)) : undefined,
  };
}

/**
 * Crea una nueva receta vacía con valores por defecto.
 */
export function createEmptyRecipe(customId?: string, label = 'Nueva receta'): RecipeCatalogItem {
  const id = sanitizeId(customId || label);
  return {
    id,
    label,
    description: 'Descripción de la receta de fabricación.',
    category: 'mueble',
    active: true,
    ingredients: [
      { itemId: 'madera', count: 1 },
    ],
    output: {
      itemId: id,
      count: 1,
      chance: 100,
      isPrimary: true,
    },
    craftingTime: 30,
    successRate: 100,
    stations: ['banco_carpinteria'],
    requirements: {
      requiredProfession: 'carpinteria',
      requiredRank: 0,
      minCharacterLevel: 1,
    },
    tags: ['artesania'],
  };
}

/**
 * Crea una nueva receta basada en una plantilla.
 */
export function createRecipeFromTemplate(templateId: string, customId?: string): RecipeCatalogItem {
  const tpl = RECIPE_TEMPLATES.find(t => t.id === templateId) ?? RECIPE_TEMPLATES[0];
  const baseId = customId || sanitizeId(tpl.name);
  return {
    id: baseId,
    label: tpl.name,
    description: tpl.recipe.description,
    category: tpl.recipe.category,
    folder: tpl.recipe.folder,
    active: tpl.recipe.active,
    ingredients: tpl.recipe.ingredients.map(i => ({ ...i })),
    output: { ...tpl.recipe.output, itemId: tpl.recipe.output.itemId || baseId },
    extraOutputs: tpl.recipe.extraOutputs ? tpl.recipe.extraOutputs.map(o => ({ ...o })) : undefined,
    craftingTime: tpl.recipe.craftingTime,
    successRate: tpl.recipe.successRate,
    stations: [...tpl.recipe.stations],
    requirements: { ...tpl.recipe.requirements },
    tags: [...tpl.recipe.tags],
    notes: tpl.recipe.notes,
  };
}

/**
 * Crea una estación de fabricación vacía.
 */
export function createEmptyStation(customId?: string, label = 'Nueva estación'): CraftingStationDef {
  const id = sanitizeId(customId || label);
  return {
    id,
    label,
    description: 'Estación de trabajo personalizada para fabricación.',
    icon: '<rect x="4" y="6" width="16" height="12" rx="2" fill="#586f68" stroke="#374843" stroke-width="1.5"/><circle cx="12" cy="12" r="3" fill="#e5c386"/>',
    category: 'Personalizada',
    active: true,
  };
}

/**
 * Mapeo de profesión a estaciones de trabajo estándar.
 */
export function mapJobToStation(job?: string): string[] {
  const map: Record<string, string[]> = {
    herreria: ['forja'],
    alquimia: ['mesa_alquimia'],
    cocina: ['cocina'],
    sastreria: ['telar'],
    ebanisteria: ['banco_ebanisteria'],
    encantamiento: ['mesa_encantamiento'],
    peleteria: ['curtiduria'],
    joyeria: ['banco_joyeria'],
    carpinteria: ['banco_carpinteria'],
  };
  return (job && map[job]) ? [...map[job]] : ['fabricacion_manual'];
}

/**
 * Mapeo de profesión a carpeta organizativa por defecto.
 */
export function mapJobToFolder(job?: string): string {
  const map: Record<string, string> = {
    herreria: 'Herrería y forja',
    alquimia: 'Alquimia y elixires',
    cocina: 'Cocina y banquetes',
    sastreria: 'Sastrería y confección',
    ebanisteria: 'Ebanistería y muebles',
    encantamiento: 'Encantamiento y pergaminos',
    peleteria: 'Peletería y cueros',
    joyeria: 'Joyería y orfebrería',
    carpinteria: 'Carpintería básica',
  };
  return (job && map[job]) ? map[job] : 'General';
}

/**
 * Mapeo de categoría de ítem a categoría del editor de recetas.
 */
export function mapItemCategoryToRecipeCategory(itemCategory?: string, job?: string): string {
  if (itemCategory === 'Mueble') return 'mueble';
  if (itemCategory === 'Comida') return 'alimento';
  if (itemCategory === 'Consumible') return job === 'alquimia' ? 'pocion' : 'alimento';
  if (itemCategory === 'Herramienta') return 'herramienta';
  if (itemCategory === 'Pergamino de encantamiento') return 'pergamino';
  if (itemCategory === 'Componente de artesanía' || itemCategory === 'Material de oficio') return 'componente';
  if (job === 'herreria') return 'arma';
  if (job === 'alquimia') return 'pocion';
  if (job === 'cocina') return 'alimento';
  if (job === 'ebanisteria' || job === 'carpinteria') return 'mueble';
  if (job === 'encantamiento') return 'pergamino';
  if (job === 'peleteria' || job === 'sastreria') return 'armadura';
  if (job === 'joyeria') return 'especial';
  return 'especial';
}

/**
 * Convierte una receta del catálogo RPG canónico al formato estructurado del editor.
 */
export function convertRpgRecipeToCatalogItem(
  r: {
    id: string;
    label?: string;
    job?: string;
    tier?: number;
    output: string;
    count?: number;
    seconds?: number;
    ingredients?: Record<string, number>;
    source?: string;
    price?: number;
  },
  rpgItem?: {
    label?: string;
    category?: string;
    description?: string;
    icon?: string;
  }
): RecipeCatalogItem {
  const cat = mapItemCategoryToRecipeCategory(rpgItem?.category, r.job);
  const stations = mapJobToStation(r.job);
  const folder = mapJobToFolder(r.job);

  const ingredients: RecipeIngredientDef[] = Object.entries(r.ingredients || {}).map(([itemId, count]) => ({
    itemId,
    count: Math.max(1, Number(count) || 1),
  }));

  const desc = rpgItem?.description || `Receta oficial de ${r.job || 'fabricación'} para crear ${r.label || r.id}.`;

  return {
    id: r.id,
    label: r.label || r.id,
    description: desc,
    category: cat,
    folder,
    icon: rpgItem?.icon || undefined,
    active: true,
    ingredients,
    output: {
      itemId: r.output,
      count: Math.max(1, Number(r.count) || 1),
      chance: 100,
      isPrimary: true,
    },
    craftingTime: Math.max(0, typeof r.seconds === 'number' && Number.isFinite(r.seconds) ? r.seconds : 10),
    successRate: 100,
    stations,
    requirements: {
      requiredProfession: r.job || undefined,
      requiredRank: typeof r.tier === 'number' ? r.tier : 0,
      minCharacterLevel: r.tier ? r.tier * 5 : 1,
    },
    tags: [r.job, cat, 'canon_rpg'].filter(Boolean) as string[],
    notes: r.source ? `Origen en juego: ${r.source}${r.price ? ` (${r.price} Pelines)` : ''}` : undefined,
  };
}

/**
 * Sincroniza e incorpora todas las recetas del catálogo RPG a un catálogo de recetas existente
 * sin sobrescribir las recetas ya modificadas o añadidas.
 */
export function syncRpgRecipesIntoCatalog(
  catalog: RecipeCatalog,
  rpgRecipes: Record<string, any>,
  rpgItems: Record<string, any> = {}
): { added: number; existing: number; total: number } {
  const existingIds = new Set(catalog.recipes.map(r => r.id));
  let added = 0;
  let existing = 0;

  const currentFolders = new Set(catalog.folders || []);

  for (const [id, r] of Object.entries(rpgRecipes || {})) {
    if (existingIds.has(id)) {
      existing++;
      continue;
    }
    const item = rpgItems[r.output];
    const converted = convertRpgRecipeToCatalogItem(r, item);
    catalog.recipes.push(converted);
    existingIds.add(id);
    if (converted.folder) currentFolders.add(converted.folder);
    added++;
  }

  catalog.folders = Array.from(currentFolders);
  return { added, existing, total: catalog.recipes.length };
}
