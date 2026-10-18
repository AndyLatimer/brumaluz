// Simulación local de las acciones del servidor, solo para el modo ?test (sin cuenta ni base de datos).
// Las reglas reales viven en supabase/server.sql.
import { MAX_LEVEL, unspentAttributePoints, ATTRIBUTE_MAX_VALUE, type CharData, type AttributeId } from '../data/data';
import { attributeTotal, experienceToNextLevel, maxOverhealOf, vitalsOf } from '../data/stats';
import { addCurrency, spendCurrency } from '../data/currency';
import { ITEMS, VENDOR_STOCK, sellPrice, itemStack } from '../data/items';
import { INVENTORY_UNLOCKED } from '../data/inventory';
import type { CharacterAction } from './account';
import { FOOD_EFFECTS } from '../data/food';

export function simulateAction(d: CharData, action: CharacterAction) {
  if (action === 'respawn') {
    if (d.health === 0) { d.health = -1; d.overheal = 0; d.position = null; }
    return;
  }
  if (d.health === 0) return;
  const v = vitalsOf(d);
  if (action === 'money') {
    addCurrency(d.wallet, 'pelines', 100);
  } else if (action === 'damage') {
    const absorbed = Math.min(v.overheal, 10);
    d.overheal = v.overheal - absorbed;
    if (absorbed < 10) d.health = Math.max(0, v.health - (10 - absorbed));
  } else if (action === 'heal') {
    const total = v.health + 10;
    d.health = Math.min(v.maxHealth, total);
    d.overheal = Math.min(v.overheal + Math.max(total - v.maxHealth, 0), maxOverhealOf(d));
  } else if (d.level < MAX_LEVEL) {
    d.experience += (d.partyPeers ?? 0)>0 ? 204 : 200;
    while (d.level < MAX_LEVEL && d.experience >= experienceToNextLevel(d.level)) { d.experience -= experienceToNextLevel(d.level); d.level++; }
    if (d.level >= MAX_LEVEL) d.experience = experienceToNextLevel(MAX_LEVEL);
  }
}

export function simulateSpend(d: CharData, points: Partial<Record<AttributeId, number>>) {
  const total = Object.values(points).reduce<number>((sum, n) => sum + (n ?? 0), 0);
  if (total > unspentAttributePoints(d)) return;
  for (const [id, n] of Object.entries(points) as [AttributeId, number][]) {
    if (attributeTotal(d, id) + n <= ATTRIBUTE_MAX_VALUE) d.attributePoints[id] += n;
  }
}

function addItem(d: CharData, id: string) {
  const stack = itemStack(id);
  const bound = ITEMS[id]?.bound === true;
  const slot = d.inventory.findIndex((s) => s && s.id === id && !!s.bound === bound && s.count < stack);
  if (slot >= 0) { d.inventory[slot]!.count++; return; }
  const free = d.inventory.findIndex((s, i) => !s && i < INVENTORY_UNLOCKED);
  if (free < 0) throw new Error('Tu mochila está llena.');
  d.inventory[free] = { id, count: 1, ...(bound ? { bound: true } : {}) };
}

function removeItem(d: CharData, slot: number) {
  const item = d.inventory[slot];
  if (!item || !ITEMS[item.id]) throw new Error('Ese objeto no existe.');
  if (item.count <= 1) d.inventory[slot] = null; else item.count--;
  return item.id;
}

export function simulateBuy(d: CharData, vendor: string, item: string) {
  if (d.health === 0) return;
  if (!VENDOR_STOCK[vendor]?.includes(item)) throw new Error('Ese vendedor no vende ese objeto.');
  if (!spendCurrency(d.wallet, 'pelines', ITEMS[item].value)) throw new Error('No tienes suficientes pelines.');
  try { addItem(d, item); } catch (e) { addCurrency(d.wallet, 'pelines', ITEMS[item].value); throw e; }
}

export function simulateSell(d: CharData, slot: number) {
  if (d.health === 0) return;
  const id = removeItem(d, slot);
  addCurrency(d.wallet, 'pelines', sellPrice(id));
}

export function simulateUse(d: CharData, slot: number) {
  if (d.health === 0) return;
  const v = vitalsOf(d);
  const item = d.inventory[slot];
  if (!item || !ITEMS[item.id]) throw new Error('Ese objeto no existe.');
  const food = ITEMS[item.id].food;
  if (food) {
    removeItem(d, slot);
    d.health = v.health;
    d.resource = v.resource;
    d.foodBuff = { itemId: food, remaining: FOOD_EFFECTS[food].duration };
    d.foodRevision++;
    return;
  }
  const restore = ITEMS[item.id].restore;
  if (!restore) throw new Error('Ese objeto no se puede usar.');
  if (restore.kind !== 'health' && restore.kind !== v.resourceKind) throw new Error('Esta poción no corresponde al recurso de tu clase.');
  const health = restore.kind === 'health';
  const current = health ? v.health : v.resource, max = health ? v.maxHealth : v.maxResource;
  if (current >= max) throw new Error(health ? 'Ya tienes la vida completa.' : 'Ya tienes el recurso completo.');
  removeItem(d, slot);
  const total = Math.min(max, current + Math.max(1, Math.ceil(max * restore.percent / 100)));
  d[health ? 'health' : 'resource'] = total >= max ? -1 : total;
}
