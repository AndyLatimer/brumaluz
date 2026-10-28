/** Stable appearance IDs shared by players, portraits and NPCs. Never reorder. */
export const DETAIL_BASE_LABELS = ['Ninguno', 'Rubor', 'Pecas', 'Cicatriz', 'Pintura de guerra', 'Lunar', 'Pecas de sol', 'Constelación', 'Marca de hoja', 'Cicatriz de ceja', 'Runas de la Arboleda', 'Pecas y rubor', 'Pecas y cicatriz de ceja', 'Constelación y lunar', 'Pecas de sol y lunar', 'Hojas y rubor', 'Runas y cicatriz', 'Pecas y lunar'];
export const DETAIL_LAYERS = [
  { key: 'freckles', label: 'Pecas', options: [0, 2, 6] },
  { key: 'scar', label: 'Cicatrices', options: [0, 3, 9] },
  { key: 'mark', label: 'Marcas y adornos', options: [0, 7, 8, 10, 4] },
  { key: 'mole', label: 'Lunar', options: [0, 5] },
  { key: 'blush', label: 'Rubor', options: [0, 1] },
] as const;
export type DetailLayer = typeof DETAIL_LAYERS[number]['key'];
export type DetailSelection = Record<DetailLayer, number>;
const legacy: number[][] = [[], [1], [2], [3], [4], [5], [6], [7], [8], [9], [10], [2, 1], [2, 9], [7, 5], [6, 5], [8, 1], [10, 3], [2, 5]];
const signature = (parts: readonly number[]) => [...parts].filter(Boolean).sort((a, b) => a - b).join(',');
const ids = new Map(legacy.map((parts, id) => [signature(parts), id]));
const combinations = legacy.map(parts => [...parts]);
// This versioned product is a persistence contract, independent of UI option order.
// Future products must append IDs, never extend or reorder these five arrays.
for (const freckles of [0, 2, 6]) for (const scar of [0, 3, 9])
  for (const mark of [0, 7, 8, 10, 4]) for (const mole of [0, 5]) for (const blush of [0, 1]) {
    const parts = [freckles, scar, mark, mole, blush].filter(Boolean), key = signature(parts);
    if (!ids.has(key)) { ids.set(key, combinations.length); combinations.push(parts); }
  }
export const DETAILS = combinations.map((parts, id) => DETAIL_BASE_LABELS[id] ?? parts.map(part => DETAIL_BASE_LABELS[part]).join(' · '));
export function detailParts(id: number): readonly number[] { return combinations[id] ?? []; }
export function detailSelection(id: number): DetailSelection {
  const parts = detailParts(id);
  return Object.fromEntries(DETAIL_LAYERS.map(layer => [layer.key, layer.options.find(value => value !== 0 && parts.includes(value)) ?? 0])) as DetailSelection;
}
export function withDetailLayer(id: number, key: DetailLayer, value: number): number {
  const layer = DETAIL_LAYERS.find(layer => layer.key === key)!;
  if (!(layer.options as readonly number[]).includes(value)) return id;
  // Preserve unusual legacy combinations (e.g. constellation + beauty mark).
  const parts = detailParts(id).filter(part => !(layer.options as readonly number[]).includes(part));
  if (value) parts.push(value);
  return ids.get(signature(parts)) ?? id;
}
