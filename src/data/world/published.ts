// Generado por el editor de mapas («Publicar en el juego»). No lo edites a mano.
import type { PublishedWorld, PublishedMapMeta, PublishedMapModule } from '../../world/mapCity';

const META: PublishedMapMeta[] = [];
const MODULES: PublishedMapModule[] = [];
export const PUBLISHED_WORLD: PublishedWorld = Object.fromEntries(META.map((meta, index) => [meta.id, { ...meta, load: async () => MODULES[index] }]));
