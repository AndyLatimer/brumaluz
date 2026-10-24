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
  instanceId?: string;
  enchantment?: { id: 'fire' | 'vampirism' | 'frost' | 'lightning' | 'dark'; grade: number };
  durability?: number;
  maxDurability?: number;
  originalDurability?: number;
}

export type InventorySlots = (ItemStack | null)[];

export const EQUIPMENT_SLOTS = ['head', 'pendant', 'chest', 'hands', 'ring', 'weapon', 'offhand', 'legs', 'trinket'] as const;
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];
export type Equipment = Record<EquipmentSlot, ItemStack | null>;

export const emptyInventory = (): InventorySlots => Array.from({ length: INVENTORY_SIZE }, () => null);
export const emptyEquipment = (): Equipment => Object.fromEntries(EQUIPMENT_SLOTS.map((s) => [s, null])) as Equipment;

export const asStack = (v: unknown): ItemStack | null => {
  if (!v || typeof v !== 'object') return null;
  const { id, count, bound, instanceId, enchantment, durability, maxDurability, originalDurability } = v as Record<string, unknown>;
  const n = Number(count);
  if (typeof id !== 'string' || !id || !Number.isSafeInteger(n) || n <= 0) return null;
  const out: ItemStack = { id, count: n, ...(bound === true ? { bound: true } : {}) };
  if (typeof instanceId === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(instanceId)) out.instanceId = instanceId;
  if (enchantment && typeof enchantment === 'object') {
    const e = enchantment as Record<string, unknown>;
    if (['fire','vampirism','frost','lightning','dark'].includes(String(e.id)) && Number.isInteger(e.grade) && Number(e.grade) >= 1 && Number(e.grade) <= 5)
      out.enchantment = { id: e.id as NonNullable<ItemStack['enchantment']>['id'], grade: Number(e.grade) };
  }
  for (const [key, value] of Object.entries({ durability, maxDurability, originalDurability }))
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100000) (out as unknown as Record<string, unknown>)[key] = value;
  return out;
};

export const sameStack = (a: ItemStack | null, b: ItemStack | null) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

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
