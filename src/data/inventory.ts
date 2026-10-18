// Inventario del personaje: tipos y constantes. Los objetos reales (catálogo) se añadirán más adelante.
/** Huecos de la mochila (el hueco bloqueado «+» de la UI es solo visual). */
export const INVENTORY_SIZE = 25;
/** Huecos utilizables ahora mismo; tras ellos se dibuja un hueco bloqueado «+» para futuras ampliaciones. */
export const INVENTORY_UNLOCKED = 25;

export interface ItemStack {
  /** Identificador del objeto en el futuro catálogo. */
  id: string;
  count: number;
  bound?: boolean;
}

export type InventorySlots = (ItemStack | null)[];

export const EQUIPMENT_SLOTS = ['head', 'pendant', 'chest', 'hands', 'ring', 'weapon', 'offhand', 'legs', 'feet', 'trinket'] as const;
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];
export type Equipment = Record<EquipmentSlot, ItemStack | null>;

export const emptyInventory = (): InventorySlots => Array.from({ length: INVENTORY_SIZE }, () => null);
export const emptyEquipment = (): Equipment => Object.fromEntries(EQUIPMENT_SLOTS.map((s) => [s, null])) as Equipment;

const asStack = (v: unknown): ItemStack | null => {
  if (!v || typeof v !== 'object') return null;
  const { id, count, bound } = v as Record<string, unknown>;
  const n = Number(count);
  return typeof id === 'string' && id && Number.isSafeInteger(n) && n > 0 ? { id, count: n, ...(bound === true ? { bound: true } : {}) } : null;
};

export function sanitizeInventory(v: unknown): InventorySlots {
  const out = emptyInventory();
  if (Array.isArray(v)) for (let i = 0; i < INVENTORY_UNLOCKED; i++) out[i] = asStack(v[i]);
  return out;
}

export function sanitizeEquipment(v: unknown): Equipment {
  const out = emptyEquipment();
  if (v && typeof v === 'object') for (const s of EQUIPMENT_SLOTS) out[s] = asStack((v as Record<string, unknown>)[s]);
  return out;
}
