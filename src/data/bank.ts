// Banco personal de la cuenta: compartido por todos sus personajes y abierto desde un baúl concreto.
// Las reglas viven en bank_action (supabase/server/); aquí solo se refleja su estado y la simulación de ?test.
import type { CharData } from './data';
import { INVENTORY_UNLOCKED, asStack as parseStack, type ItemStack } from './inventory';
import { ITEMS, itemStack } from './items';

export const BANK_SIZE = 50;
/** Distancia a la que aparece «Abrir el baúl» en el cliente; el servidor admite hasta `radius`. */
export const BANK_INTERACT_RADIUS = 1.8;
/** Debe coincidir con game_bank_spot en supabase/server/. */
export const BANK_SPOTS: Record<string, { x: number; z: number; radius: number }> = {
  casa_de_isberto_interior: { x: 2.25, z: 3.25, radius: 3 },
};

export interface BankState {
  items: (ItemStack | null)[];
  pelines: number;
  size: number;
}

const asStack = (v: unknown): ItemStack | null => {
  if (!v || typeof v !== 'object') return null;
  const { id, count, bound } = v as Record<string, unknown>;
  const n = Number(count);
  return typeof id === 'string' && id && Number.isSafeInteger(n) && n > 0 ? { id, count: n, ...(bound === true ? { bound: true } : {}) } : null;
};

export function sanitizeBank(v: unknown): BankState {
  const raw = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const size = Number.isSafeInteger(raw.size) && (raw.size as number) > 0 ? raw.size as number : BANK_SIZE;
  const list = Array.isArray(raw.items) ? raw.items : [];
  const pelines = Number(raw.pelines);
  return {
    size,
    pelines: Number.isSafeInteger(pelines) && pelines > 0 ? pelines : 0,
    items: Array.from({ length: size }, (_, i) => parseStack(list[i])),
  };
}

export const emptyBank = (): BankState => sanitizeBank({});
export const isBankable = (item: ItemStack) => item.bound !== true && ITEMS[item.id]?.bound !== true;

/** Igual que game_stack_into: llena montones iguales y luego huecos libres; null si no cabe entero. */
export function stackInto(slots: (ItemStack | null)[], item: ItemStack): (ItemStack | null)[] | null {
  const out = slots.map(slot => slot && { ...slot });
  const bound = item.bound === true, max = Math.max(1, itemStack(item.id));
  let left = item.count;
  for (const slot of out) {
    if (left <= 0) break;
    if (slot && slot.id === item.id && !slot.instanceId && !item.instanceId && (slot.bound === true) === bound && slot.count < max) {
      const room = Math.min(max - slot.count, left);
      slot.count += room; left -= room;
    }
  }
  for (let i = 0; i < out.length && left > 0; i++) {
    if (out[i]) continue;
    const room = Math.min(max, left);
    out[i] = { ...item, count: room, ...(bound ? { bound: true } : {}) };
    left -= room;
  }
  return left > 0 ? null : out;
}

/**
 * Igual que game_place_item: deja `item` en el hueco `index`. Libre: lo ocupa; montón igual: lo completa y devuelve
 * lo que no cabe; otro objeto: se intercambian y devuelve el que había.
 */
export function placeItem(slots: (ItemStack | null)[], index: number, item: ItemStack): ItemStack | null {
  const target = slots[index];
  if (!target) { slots[index] = { ...item }; return null; }
  if (target.id === item.id && !target.instanceId && !item.instanceId && (target.bound === true) === (item.bound === true)) {
    const moved = Math.min(Math.max(0, Math.max(1, itemStack(item.id)) - target.count), item.count);
    slots[index] = { ...target, count: target.count + moved };
    return item.count > moved ? { ...item, count: item.count - moved } : null;
  }
  slots[index] = { ...item };
  return target;
}

/** Simulación local (?test) de las acciones del banco. Lanza los mismos mensajes que el servidor. */
export function simulateBank(d: CharData, bank: BankState, action: 'deposit' | 'withdraw' | 'move' | 'deposit_pelines' | 'withdraw_pelines', value: number, target: number | null = null) {
  if (action === 'deposit') {
    const item = d.inventory[value];
    if (!item) throw new Error('Tu mochila ha cambiado. Vuelve a mover el objeto.');
    if (!isBankable(item)) throw new Error('Los objetos ligados no se pueden guardar en el banco.');
    if (target === null) {
      const next = stackInto(bank.items, item);
      if (!next) throw new Error('El banco está lleno.');
      bank.items = next; d.inventory[value] = null;
    } else d.inventory[value] = placeItem(bank.items, target, item);
  } else if (action === 'withdraw') {
    const item = bank.items[value];
    if (!item) throw new Error('El banco ha cambiado. Vuelve a intentarlo.');
    if (target === null) {
      const next = stackInto(d.inventory.slice(0, INVENTORY_UNLOCKED), item);
      if (!next) throw new Error('Tu mochila está llena.');
      next.forEach((slot, i) => { d.inventory[i] = slot; });
      bank.items[value] = null;
    } else {
      const displaced = d.inventory[target];
      if (displaced && !isBankable(displaced)) throw new Error('Los objetos ligados no se pueden guardar en el banco.');
      bank.items[value] = placeItem(d.inventory, target, item);
    }
  } else if (action === 'move') {
    const item = bank.items[value];
    if (!item || target === null || target === value) throw new Error('El banco ha cambiado. Vuelve a intentarlo.');
    bank.items[value] = null;
    bank.items[value] = placeItem(bank.items, target, item);
  } else if (action === 'deposit_pelines') {
    if (value <= 0 || d.wallet.pelines < value) throw new Error('No tienes suficientes pelines.');
    d.wallet.pelines -= value; bank.pelines += value;
  } else {
    if (value <= 0 || bank.pelines < value) throw new Error('No tienes tantos pelines guardados en el banco.');
    d.wallet.pelines += value; bank.pelines -= value;
  }
}
