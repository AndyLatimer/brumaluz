// Bolsas de pelines repartidas por Brumaluz. Cada personaje recoge cada bolsa una sola vez;
// la cantidad (aleatoria en un rango) la decide el servidor en collect_coin_bag.
// Mantener ids y posiciones iguales a game_coin_bag en supabase/server/.

export interface CoinBagSpot {
  id: string;
  realm: 'Brumaluz';
  area: 'Brumaluz' | 'Alrededores de Brumaluz';
  x: number;
  z: number;
  yaw: number; // giro de la bolsa en el suelo, solo decorativo
}

export const COIN_BAGS: readonly CoinBagSpot[] = [
  { id: 'plaza_pozo', realm: 'Brumaluz', area: 'Brumaluz', x: 3.6, z: -3.2, yaw: .6 },
  // Junto a Testículos, delante de la casa más cercana al punto de aparición.
  { id: 'testiculos_debugger', realm: 'Brumaluz', area: 'Brumaluz', x: -9.2, z: 5.028203230275508, yaw: 1.2 },
];

/** Distancia (m) a la que aparece «Recoger»; el servidor admite hasta 3 m por el retardo de la posición. */
export const COIN_BAG_REACH = 2.2;

export const isCoinBagId = (id: unknown): id is string => typeof id === 'string' && COIN_BAGS.some(bag => bag.id === id);
