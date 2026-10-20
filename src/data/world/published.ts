// Generado por el editor de mapas («Publicar en el juego»). No lo edites a mano.
import type { PublishedWorld, PublishedMapMeta, PublishedMapModule } from '../../world/mapCity';
import * as m0 from './maps/brumaluz';
import * as m1 from './maps/brumaluz_2';
import * as m2 from './maps/casa_de_isberto_interior';

const META: PublishedMapMeta[] = [{"id":"brumaluz","name":"Brumaluz","kind":"city","region":"Pompelín central","loadingTip":"Brumaluz es la capital de Pompelín.","publishedAt":"2026-10-20T20:31:08.650Z","objects":982,"assets":9,"bytes":709268},{"id":"brumaluz_2","name":"Brumaluz","kind":"city","region":"Pompelín central","loadingTip":"Brumaluz es la capital de Pompelín.","publishedAt":"2026-10-20T14:09:12.334Z","objects":982,"assets":9,"bytes":733028},{"id":"casa_de_isberto_interior","name":"Casa de Isberto","kind":"interior","region":"","loadingTip":"","publishedAt":"2026-10-20T20:31:17.191Z","objects":16,"assets":7,"bytes":537148}];
const MODULES: PublishedMapModule[] = [m0, m1, m2];
export const PUBLISHED_WORLD: PublishedWorld = Object.fromEntries(META.map((meta, index) => [meta.id, { ...meta, load: async () => MODULES[index] }]));
