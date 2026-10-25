// Polvos de hada repartidos por Brumaluz. Cada personaje recoge cada montón una sola vez;
// la recompensa (aleatoria en un rango) la decide el servidor en collect_fairy_dust.
// Mantener ids y posiciones iguales a game_fairy_dust en supabase/server/.

export interface FairyDustSpot {
  id: string;
  realm: 'Brumaluz';
  area: 'Brumaluz' | 'Alrededores de Brumaluz';
  x: number;
  z: number;
  yaw: number; // giro del montón en el suelo, solo decorativo
}

export const FAIRY_DUST_SPOTS: readonly FairyDustSpot[] = [
  // Junto a la fuente de la plaza.
  { id: 'plaza_fuente', realm: 'Brumaluz', area: 'Brumaluz', x: -2.4, z: 1.8, yaw: 0 },
  // Junto al arco de entrada de la ciudad, cerca del punto de aparición.
  { id: 'arco_entrada', realm: 'Brumaluz', area: 'Brumaluz', x: 7.2, z: -6.5, yaw: 2.1 },
];

/** Distancia (m) a la que aparece «Recoger»; el servidor admite hasta 3 m por el retardo de la posición. */
export const FAIRY_DUST_REACH = 2.2;

export const isFairyDustId = (id: unknown): id is string =>
  typeof id === 'string' && FAIRY_DUST_SPOTS.some(dust => dust.id === id);
