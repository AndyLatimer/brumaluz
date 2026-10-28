import { COLLECTIBLES, type CollectibleSpot } from './collectibles';

export type CoinBagSpot = CollectibleSpot;

export const COIN_BAGS: readonly CoinBagSpot[] = COLLECTIBLES.filter(spot => spot.kind === 'coin-bag');

/** Alcance de recogida; el servidor admite hasta 3 m por el retardo de presencia. */
export const COIN_BAG_REACH = 2.2;

export const isCoinBagId = (id: unknown): id is string =>
  typeof id === 'string' && COIN_BAGS.some(spot => spot.id === id);
