import catalog from './world/collectibles.json';

export interface CollectibleSpot {
  id: string;
  kind: 'coin-bag' | 'fairy-dust';
  mapId: string;
  realm: 'Brumaluz';
  area: 'Brumaluz' | 'Alrededores de Brumaluz';
  x: number;
  z: number;
  yaw: number;
  min: number;
  max: number;
}

/** Generated together with world.sql by Publish in the map editor. */
export const COLLECTIBLES = catalog as readonly CollectibleSpot[];
