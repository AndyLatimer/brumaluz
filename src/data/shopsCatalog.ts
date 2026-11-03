/**
 * shopsCatalog.ts - Esquema, validación y gestión de tiendas y comerciantes para Brumaluz.
 */

import { type CurrencyId, CURRENCY_ORDER } from './currency';

export interface ShopItem {
  itemId: string;
  buyPrice?: number | null; // Precio en la moneda seleccionada (null o ausente = precio base del objeto)
  sellPrice?: number | null; // Precio al que el comerciante lo compra (null o ausente = 50% de valor base)
  stock?: number | null; // Cantidad disponible (null o ausente = ilimitado)
  currency?: CurrencyId; // Moneda específica para este objeto (opcional, por defecto hereda la de la tienda)
  notes?: string;
}

export interface ShopDefinition {
  id: string; // snake_case identificador único
  name: string; // Nombre visible de la tienda
  description: string; // Ambientación y descripción
  category: string; // Categoría comercial (general, weapons_armor, potions_alchemy, etc.)
  npcId: string; // ID del NPC comerciante asociado de npcs.json (o '' si no tiene)
  currency: CurrencyId; // Moneda comercial por defecto ('pelines' | 'lagrimas')
  icon?: string; // Icono o emblema comercial (SVG o clave)
  active: boolean; // Si la tienda está activa en el mundo
  items: ShopItem[]; // Productos disponibles en la tienda
  tags?: string[]; // Etiquetas organizativas y de búsqueda
  folder?: string; // Carpeta o agrupación
}

export interface ShopCatalog {
  version: 1;
  shops: ShopDefinition[];
}

export interface ShopItemReference {
  id: string;
  label: string;
  category: string;
  rarity: string;
  icon: string;
  value: number;
  sellPrice: number;
  stack?: number;
}

export interface ShopNpcReference {
  id: string;
  name: string;
  subtitle: string;
  badgeIcon?: string;
}

export interface ShopReferences {
  items: ShopItemReference[];
  npcs: ShopNpcReference[];
  currencies?: Array<{ id: CurrencyId; label: string; icon: string; premium: boolean }>;
}

export interface ShopAuditIssue {
  type: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  itemId?: string;
}

export interface ShopAuditReport {
  shopId: string;
  valid: boolean;
  issues: ShopAuditIssue[];
  totalItems: number;
  missingItems: string[];
  missingNpc: boolean;
}

// Regex para IDs válidos en el proyecto (snake_case)
export const SHOP_ID_REGEX = /^[a-z0-9][a-z0-9_]{1,63}$/;

export function sanitizeId(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

// Categorías comerciales canónicas
export const SHOP_CATEGORIES: Record<string, { label: string; icon: string; description: string }> = {
  general: {
    label: 'Suministros generales',
    icon: '<path d="M3 10h18l-2-7H5zM5 10v11h14V10M9 21v-7h6v7M3 10c0 4 5 4 5 0 0 4 8 4 8 0 0 4 5 4 5 0"/>',
    description: 'Víveres, provisiones básicas y artículos para el camino.',
  },
  weapons_armor: {
    label: 'Armería y forja',
    icon: '<path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l2 2M16 16l2 2M19 13l2 2M8 12l4 4"/>',
    description: 'Armas templadas, escudos de madera y protecciones de combate.',
  },
  potions_alchemy: {
    label: 'Alquimia y brebajes',
    icon: '<path d="M9 3h6v3H9zM10 6v5l-4 7a2 2 0 0 0 2 3h8a2 2 0 0 0 2-3l-4-7V6"/>',
    description: 'Pociones reconstituyentes, viales y elixires mágicos.',
  },
  tailoring: {
    label: 'Sastrería y paños',
    icon: '<path d="M12 2C7 2 3 6 3 11c0 6 7 11 9 11s9-5 9-11c0-5-4-9-9-9zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/>',
    description: 'Telas hiladas, prendas confortables y vestimenta de viaje.',
  },
  carpentry_furniture: {
    label: 'Carpintería y mobiliario',
    icon: '<path d="M4 18v3h2v-3h12v3h2v-3a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2zm16-8H4a2 2 0 0 0-2 2v2h20v-2a2 2 0 0 0-2-2z"/>',
    description: 'Muebles de roble, mesas, alacenas y enseres para el hogar.',
  },
  food_tavern: {
    label: 'Taberna y alimentos',
    icon: '<path d="M18 8h1a4 4 0 0 1 0 8h-1M3 8h15v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"/>',
    description: 'Pan campesino, pasteles, estofados y bebidas reconstituyentes.',
  },
  tools: {
    label: 'Herramientas de oficio',
    icon: '<path d="m14 7 3-3 4 4-3 3M11 10 3 18l3 3 8-8"/>',
    description: 'Picos de minero, hachas de leñador, hoces y cañas de pesca.',
  },
  jewels_magic: {
    label: 'Joyería y rarezas',
    icon: '<path d="M6 3h12l4 7-10 11L2 10l4-7z"/>',
    description: 'Gemas talladas, sortijas, amuletos y objetos insólitos.',
  },
  exotic: {
    label: 'Mercader errante y exóticos',
    icon: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
    description: 'Tesoros de tierras lejanas, monturas y artículos singulares.',
  },
};

// Plantillas temáticas de tiendas
export const SHOP_TEMPLATES = [
  {
    id: 'tienda_provisiones_pompelin',
    name: 'Puesto de provisiones de Pompelín',
    description: 'Puesto comercial céntrico donde los aventureros adquieren suministros básicos para sus travesías.',
    category: 'general',
    npcId: 'testiculos',
    currency: 'pelines' as CurrencyId,
    active: true,
    items: [
      { itemId: 'pan_duro', buyPrice: 4, sellPrice: 2, stock: null },
      { itemId: 'pocion_vida_minuscula', buyPrice: 15, sellPrice: 7, stock: null },
      { itemId: 'pocion_mana_minuscula', buyPrice: 15, sellPrice: 7, stock: null },
      { itemId: 'pocion_estamina_minuscula', buyPrice: 15, sellPrice: 7, stock: null },
    ],
  },
  {
    id: 'tienda_fragua_isberto',
    name: 'Fragua y suministros de Isberto',
    description: 'Armas auxiliares de cobre, escudos y herramientas templadas al calor del fuego.',
    category: 'weapons_armor',
    npcId: 'isberto',
    currency: 'pelines' as CurrencyId,
    active: true,
    items: [
      { itemId: 'espada_cobre_t1', buyPrice: 50, sellPrice: 25, stock: null },
      { itemId: 'escudo_roble_t1', buyPrice: 40, sellPrice: 20, stock: null },
      { itemId: 'daga_cazador_t1', buyPrice: 45, sellPrice: 22, stock: null },
      { itemId: 'baston_ambar_t1', buyPrice: 50, sellPrice: 25, stock: null },
    ],
  },
  {
    id: 'tienda_botica_alquimia',
    name: 'Botica del Maestro Alquimista',
    description: 'Extractos naturales, elixires revitalizantes y frascos herméticos preparados en el taller.',
    category: 'potions_alchemy',
    npcId: 'maestro_alquimia',
    currency: 'pelines' as CurrencyId,
    active: true,
    items: [
      { itemId: 'pocion_vida_minuscula', buyPrice: 15, sellPrice: 7, stock: 20 },
      { itemId: 'pocion_mana_minuscula', buyPrice: 15, sellPrice: 7, stock: 20 },
    ],
  },
  {
    id: 'tienda_telas_sastreria',
    name: 'Telas y paños de la Maestra',
    description: 'Ropajes cómodos para el trabajo diario en la villa y paños resistentes al viento.',
    category: 'tailoring',
    npcId: 'maestro_sastreria',
    currency: 'pelines' as CurrencyId,
    active: true,
    items: [],
  },
  {
    id: 'tienda_ebanisteria_muebles',
    name: 'Mobiliario y descanso de Ebanistería',
    description: 'Sillas, mesas robustas y cómodos enseres para habilitar las casas de Brumaluz.',
    category: 'carpentry_furniture',
    npcId: 'maestro_ebanisteria',
    currency: 'pelines' as CurrencyId,
    active: true,
    items: [],
  },
];

export function createEmptyShop(customId?: string, customName?: string): ShopDefinition {
  const id = customId ? sanitizeId(customId) : 'nueva_tienda';
  return {
    id,
    name: customName || 'Nueva tienda comercial',
    description: 'Establecimiento comercial de Brumaluz.',
    category: 'general',
    npcId: '',
    currency: 'pelines',
    active: true,
    items: [],
    tags: [],
  };
}

export function createShopFromTemplate(templateId: string, customId?: string): ShopDefinition {
  const tpl = SHOP_TEMPLATES.find(t => t.id === templateId) || SHOP_TEMPLATES[0];
  const id = customId ? sanitizeId(customId) : `${tpl.id}_${Date.now().toString(36)}`;
  return {
    ...structuredClone(tpl),
    id,
  };
}

export function duplicateShop(source: ShopDefinition, existingIds: string[]): ShopDefinition {
  let candidate = `${source.id}_copia`;
  let counter = 2;
  while (existingIds.includes(candidate)) {
    candidate = `${source.id}_copia_${counter++}`;
  }
  return {
    ...structuredClone(source),
    id: candidate,
    name: `${source.name} (Copia)`,
  };
}

export function validateShop(val: unknown, refs?: ShopReferences): ShopDefinition {
  if (!val || typeof val !== 'object') {
    throw new Error('La definición de tienda debe ser un objeto válido.');
  }
  const s = val as Record<string, unknown>;

  if (typeof s.id !== 'string' || !SHOP_ID_REGEX.test(s.id)) {
    throw new Error(`ID de tienda no válido: "${s.id}". Debe ser snake_case de 2 a 64 caracteres.`);
  }

  if (typeof s.name !== 'string' || !s.name.trim() || s.name.length > 120) {
    throw new Error(`Nombre de tienda no válido en "${s.id}". Debe tener entre 1 y 120 caracteres.`);
  }

  const description = typeof s.description === 'string' ? s.description.slice(0, 1000) : '';
  const category = typeof s.category === 'string' && s.category in SHOP_CATEGORIES ? s.category : 'general';
  const npcId = typeof s.npcId === 'string' ? s.npcId.trim() : '';
  const currency: CurrencyId = typeof s.currency === 'string' && CURRENCY_ORDER.includes(s.currency as CurrencyId)
    ? (s.currency as CurrencyId)
    : 'pelines';
  const icon = typeof s.icon === 'string' ? s.icon.slice(0, 500) : undefined;
  const active = typeof s.active === 'boolean' ? s.active : true;
  const folder = typeof s.folder === 'string' ? s.folder.trim().slice(0, 60) : undefined;
  const tags = Array.isArray(s.tags)
    ? Array.from(new Set(s.tags.filter(t => typeof t === 'string' && t.trim()).map(t => (t as string).trim())))
    : [];

  if (!Array.isArray(s.items)) {
    throw new Error(`Los productos de la tienda "${s.id}" deben ser una lista.`);
  }

  const seenItems = new Set<string>();
  const items: ShopItem[] = [];

  for (let i = 0; i < s.items.length; i++) {
    const rawItem = s.items[i];
    if (!rawItem || typeof rawItem !== 'object') continue;
    const it = rawItem as Record<string, unknown>;
    const itemId = typeof it.itemId === 'string' ? it.itemId.trim() : '';
    if (!itemId) continue;

    if (seenItems.has(itemId)) {
      throw new Error(`El objeto "${itemId}" está duplicado en la tienda "${s.id}". Cada producto debe listarse una sola vez.`);
    }
    seenItems.add(itemId);

    let buyPrice: number | null = null;
    if (it.buyPrice !== undefined && it.buyPrice !== null) {
      const num = Number(it.buyPrice);
      if (Number.isFinite(num) && num >= 0) {
        buyPrice = Math.floor(num);
      }
    }

    let sellPrice: number | null = null;
    if (it.sellPrice !== undefined && it.sellPrice !== null) {
      const num = Number(it.sellPrice);
      if (Number.isFinite(num) && num >= 0) {
        sellPrice = Math.floor(num);
      }
    }

    let stock: number | null = null;
    if (it.stock !== undefined && it.stock !== null) {
      const num = Number(it.stock);
      if (Number.isFinite(num) && num >= 0) {
        stock = Math.floor(num);
      }
    }

    const itemCurrency: CurrencyId | undefined = typeof it.currency === 'string' && CURRENCY_ORDER.includes(it.currency as CurrencyId)
      ? (it.currency as CurrencyId)
      : undefined;

    const notes = typeof it.notes === 'string' ? it.notes.slice(0, 300) : undefined;

    items.push({
      itemId,
      buyPrice,
      sellPrice,
      stock,
      currency: itemCurrency,
      notes,
    });
  }

  return {
    id: s.id,
    name: s.name.trim(),
    description,
    category,
    npcId,
    currency,
    icon,
    active,
    items,
    tags,
    folder,
  };
}

export function validateShopCatalog(val: unknown, refs?: ShopReferences): ShopCatalog {
  if (!val || typeof val !== 'object') {
    throw new Error('El catálogo de tiendas debe ser un objeto JSON válido.');
  }
  const root = val as Record<string, unknown>;
  if (root.version !== 1) {
    throw new Error(`Versión de catálogo de tiendas no soportada: ${root.version}. Se esperaba version: 1.`);
  }
  if (!Array.isArray(root.shops)) {
    throw new Error('El campo "shops" debe ser un array de tiendas.');
  }

  const seenIds = new Set<string>();
  const shops: ShopDefinition[] = [];

  for (const raw of root.shops) {
    const shop = validateShop(raw, refs);
    if (seenIds.has(shop.id)) {
      throw new Error(`ID de tienda repetido en el catálogo: "${shop.id}". Todos los IDs deben ser únicos.`);
    }
    seenIds.add(shop.id);
    shops.push(shop);
  }

  return {
    version: 1,
    shops,
  };
}

/**
 * Audita una tienda contra las referencias del proyecto (catálogo de objetos y NPCs).
 */
export function auditShop(shop: ShopDefinition, refs: ShopReferences): ShopAuditReport {
  const issues: ShopAuditIssue[] = [];
  const missingItems: string[] = [];
  let missingNpc = false;

  const itemMap = new Map<string, ShopItemReference>();
  for (const it of refs.items || []) {
    itemMap.set(it.id, it);
  }

  const npcMap = new Map<string, ShopNpcReference>();
  for (const n of refs.npcs || []) {
    npcMap.set(n.id, n);
  }

  // 1. Comprobar NPC
  if (shop.npcId) {
    if (!npcMap.has(shop.npcId)) {
      missingNpc = true;
      issues.push({
        type: 'warning',
        code: 'MISSING_NPC',
        message: `El NPC comerciante "${shop.npcId}" no existe en el catálogo de NPCs (npcs.json).`,
      });
    }
  } else {
    issues.push({
      type: 'info',
      code: 'NO_NPC',
      message: 'La tienda no tiene ningún NPC comerciante asignado actualmente.',
    });
  }

  // 2. Comprobar productos
  if (shop.items.length === 0) {
    issues.push({
      type: 'warning',
      code: 'EMPTY_SHOP',
      message: 'La tienda no tiene ningún producto configurado a la venta.',
    });
  }

  for (const item of shop.items) {
    const ref = itemMap.get(item.itemId);
    if (!ref) {
      missingItems.push(item.itemId);
      issues.push({
        type: 'error',
        code: 'MISSING_ITEM',
        message: `El objeto "${item.itemId}" no existe en el catálogo de objetos del juego o ha sido eliminado.`,
        itemId: item.itemId,
      });
      continue;
    }

    const effectiveBuy = item.buyPrice ?? ref.value;
    const effectiveSell = item.sellPrice ?? ref.sellPrice;

    if (effectiveBuy <= 0) {
      issues.push({
        type: 'warning',
        code: 'FREE_ITEM',
        message: `El producto "${ref.label}" tiene un precio de compra de 0. Se entregará gratis a los jugadores.`,
        itemId: item.itemId,
      });
    }

    if (effectiveSell > effectiveBuy && effectiveBuy > 0) {
      issues.push({
        type: 'error',
        code: 'EXPLOIT_PRICE',
        message: `El precio de venta (${effectiveSell}) del producto "${ref.label}" es superior al precio de compra (${effectiveBuy}), lo que permitiría dinero infinito.`,
        itemId: item.itemId,
      });
    }
  }

  const valid = issues.filter(i => i.type === 'error').length === 0;

  return {
    shopId: shop.id,
    valid,
    issues,
    totalItems: shop.items.length,
    missingItems,
    missingNpc,
  };
}

