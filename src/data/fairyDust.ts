import { COLLECTIBLES, type CollectibleSpot } from './collectibles';

export type FairyDustSpot = CollectibleSpot;

export const FAIRY_DUST_SPOTS: readonly FairyDustSpot[] = COLLECTIBLES.filter(spot => spot.kind === 'fairy-dust');

/** Alcance de recogida; el servidor admite hasta 3 m por el retardo de presencia. */
export const FAIRY_DUST_REACH = 2.2;

export const isFairyDustId = (id: unknown): id is string =>
  typeof id === 'string' && FAIRY_DUST_SPOTS.some(spot => spot.id === id);
