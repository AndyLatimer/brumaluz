/** Exterior forest on Pompelín. The future elven city will be a separate map. */
export const ARBOLEDA_WORLD = {
  center: [660, -225],
  radii: [235, 185],
  approach: [600, -195],
  arrival: [625, -195],
  arrivalRadius: 15,
  reservationId: 'reserva_ciudad_arboleda',
} as const;

export function arboledaDistance(x: number, z: number) {
  return Math.hypot((x - ARBOLEDA_WORLD.center[0]) / ARBOLEDA_WORLD.radii[0], (z - ARBOLEDA_WORLD.center[1]) / ARBOLEDA_WORLD.radii[1]);
}
