/** Appearance IDs are shared with the server, portraits and the NPC editor. */
export const ACCESSORY_BASE_LABELS = ['Ninguno', 'Gafas redondas', 'Bufanda', 'Colgante', 'Pendientes', 'Monóculo', 'Gafas y bufanda', 'Pañuelo de viajero', 'Aros de cobre', 'Pendientes de luna', 'Gafas de boticario', 'Gafas cuadradas', 'Medallón', 'Pendientes de perla'];
export const ACCESSORY_LAYERS = [
  { key: 'eyewear', label: 'Gafas y monóculos', options: [0, 1, 5, 10, 11] },
  { key: 'neckwear', label: 'Cuello y colgantes', options: [0, 2, 3, 12] },
  { key: 'earrings', label: 'Pendientes', options: [0, 4, 8, 9, 13] },
  { key: 'mask', label: 'Pañuelo', options: [0, 7] },
] as const;
export type AccessoryLayer = typeof ACCESSORY_LAYERS[number]['key'];
export type AccessorySelection = Record<AccessoryLayer, number>;
const combinations: number[][] = [[], [1], [2], [3], [4], [5], [1, 2], [7], [8], [9], [10], [11], [12], [13]];
const signature = (parts: readonly number[]) => [...parts].filter(Boolean).sort((a, b) => a - b).join(',');
const ids = new Map(combinations.map((parts, id) => [signature(parts), id]));
// Version 1 product. Append future products without changing these arrays or IDs.
for (const eyewear of [0, 1, 5, 10, 11]) for (const neckwear of [0, 2, 3, 12])
  for (const earrings of [0, 4, 8, 9, 13]) for (const mask of [0, 7]) {
    const parts = [eyewear, neckwear, earrings, mask].filter(Boolean), key = signature(parts);
    if (!ids.has(key)) { ids.set(key, combinations.length); combinations.push(parts); }
  }
export const ACCESSORIES = combinations.map((parts, id) => ACCESSORY_BASE_LABELS[id] ?? parts.map(part => ACCESSORY_BASE_LABELS[part]).join(' · '));
export function accessoryParts(id: number): readonly number[] { return combinations[id] ?? []; }
export function accessorySelection(id: number): AccessorySelection {
  const parts = accessoryParts(id);
  return Object.fromEntries(ACCESSORY_LAYERS.map(layer => [layer.key, layer.options.find(value => value !== 0 && parts.includes(value)) ?? 0])) as AccessorySelection;
}
export function withAccessoryLayer(id: number, key: AccessoryLayer, value: number): number {
  const layer = ACCESSORY_LAYERS.find(layer => layer.key === key)!;
  if (!(layer.options as readonly number[]).includes(value)) return id;
  const parts = accessoryParts(id).filter(part => !(layer.options as readonly number[]).includes(part));
  if (value) parts.push(value);
  return ids.get(signature(parts)) ?? id;
}
export const hasTravelerMask = (id: number) => accessoryParts(id).includes(7);
