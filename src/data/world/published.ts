// Generado por el editor de mapas («Publicar en el juego»). No lo edites a mano.
import type { PublishedWorld, PublishedMapMeta, PublishedMapModule } from '../../world/mapCity';
import * as m0 from './maps/brumaluz';
import * as m1 from './maps/brumaluz_2';
import * as m2 from './maps/casa_de_isberto_interior';
import * as m3 from './maps/pompelin';

const META: PublishedMapMeta[] = [{"id":"brumaluz","name":"Brumaluz","kind":"city","region":"Pompelín central","loadingTip":"Brumaluz es la capital de Pompelín.","publishedAt":"2026-10-21T08:51:57.108Z","objects":3559,"assets":77,"bytes":4831580},{"id":"brumaluz_2","name":"Brumaluz","kind":"city","region":"Pompelín central","loadingTip":"Brumaluz es la capital de Pompelín.","publishedAt":"2026-10-20T14:09:12.334Z","objects":982,"assets":9,"bytes":733028},{"id":"casa_de_isberto_interior","name":"Casa de Isberto","kind":"interior","region":"","loadingTip":"","publishedAt":"2026-10-21T01:54:26.266Z","objects":38,"assets":26,"bytes":1677496},{"id":"pompelin","name":"Pompelín","kind":"world","region":"Continente de Pompelín","loadingTip":"Brumaluz es la capital. Sus puertas conectan la ciudad con el continente.","publishedAt":"2026-10-21T01:45:17.227Z","objects":495,"assets":6,"bytes":321436}];
const MODULES: PublishedMapModule[] = [m0, m1, m2, m3];
export const PUBLISHED_WORLD: PublishedWorld = Object.fromEntries(META.map((meta, index) => [meta.id, { ...meta, load: async () => MODULES[index] }]));
