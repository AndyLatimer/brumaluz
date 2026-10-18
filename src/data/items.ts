// Catálogo de objetos y mercancías de los vendedores. Los precios y efectos REALES viven en supabase/server.sql
// (game_item / game_vendor_stock): estos datos solo sirven para mostrarlos. Si cambias uno, cambia el otro.

export interface ItemDef {
  id: string;
  label: string; // en español (se traduce con t())
  description: string;
  /** Valor base en pelines: lo que cuesta comprarlo; el vendedor paga la mitad al vendérselo. */
  value: number;
  /** Máximo de unidades por hueco de la mochila (por defecto DEFAULT_STACK). */
  stack?: number;
  /** Se puede usar desde la mochila (el efecto real lo decide el servidor). */
  usable?: boolean;
  /** SVG interior (viewBox 0 0 24 24, trazo con currentColor). */
  icon: string;
}

export const ITEMS: Record<string, ItemDef> = {
  pocion_vida_minuscula: {
    id: 'pocion_vida_minuscula',
    label: 'Poción de vida minúscula',
    description: 'Un trago diminuto de líquido rojo. Cura un 5 % de tu vida máxima. Haz clic en ella en la mochila para usarla.',
    value: 10,
    usable: true,
    icon: '<path d="M10 3h4M10.500 3v4.500L6 17a3 3 0 0 0 2.700 4.500h6.600A3 3 0 0 0 18 17l-4.500-9.500V3"/><path d="M7.600 14.500h8.800" /><path d="M12 16.200c.9 1 1.400 1.700 1.400 2.300a1.400 1.400 0 0 1-2.800 0c0-.6.500-1.300 1.400-2.300Z"/>',
  },
};

export const DEFAULT_STACK = 99;
export const itemStack = (id: string) => ITEMS[id]?.stack ?? DEFAULT_STACK;
export const itemDef = (id: string): ItemDef | undefined => ITEMS[id];
export const itemLabel = (id: string) => ITEMS[id]?.label ?? id;
export const itemIcon = (id: string) => (ITEMS[id] ? `<svg viewBox="0 0 24 24" aria-hidden="true">${ITEMS[id].icon}</svg>` : '');

/** Lo que paga un vendedor por un objeto. */
export const sellPrice = (id: string) => Math.max(1, Math.floor((ITEMS[id]?.value ?? 0) / 2));

/** Mercancía de cada vendedor (por id de NPC). Los pelines del vendedor son infinitos: no se muestran. */
export const VENDOR_STOCK: Record<string, string[]> = {
  testiculos: ['pocion_vida_minuscula'],
};
