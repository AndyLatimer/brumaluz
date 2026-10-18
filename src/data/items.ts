// Catálogo de objetos y mercancías de los vendedores. Los precios y efectos REALES viven en supabase/server.sql
// (game_item / game_vendor_stock): estos datos solo sirven para mostrarlos. Si cambias uno, cambia el otro.
import type { FoodId } from './food';

export interface ItemDef {
  id: string;
  bound?: boolean;
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

export const ITEMS: Record<string, ItemDef> = {
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

export const DEFAULT_STACK = 99;
export const itemStack = (id: string) => ITEMS[id]?.stack ?? DEFAULT_STACK;
export const itemDef = (id: string): ItemDef | undefined => ITEMS[id];
export const itemLabel = (id: string) => ITEMS[id]?.label ?? id;
export const itemIcon = (id: string) => (ITEMS[id] ? `<svg class="item-art" viewBox="0 0 24 24" aria-hidden="true">${ITEMS[id].icon}</svg>` : '');

/** Lo que paga un vendedor por un objeto. */
export const sellPrice = (id: string) => Math.max(1, Math.floor((ITEMS[id]?.value ?? 0) / 2));

/** Mercancía de cada vendedor (por id de NPC). Los pelines del vendedor son infinitos: no se muestran. */
export const VENDOR_STOCK: Record<string, string[]> = {
  testiculos: ['pocion_vida_minuscula', 'pocion_mana_minuscula', 'pocion_estamina_minuscula', 'pan_duro'],
};
