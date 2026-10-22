// Generado por el editor de mapas («Publicar en el juego»). No lo edites a mano.
import type { PublishedWorld, PublishedMapMeta, PublishedMapModule } from '../../world/mapCity';
import * as m0 from './maps/brumaluz';
import * as m1 from './maps/brumaluz_2';
import * as m2 from './maps/casa_de_isberto_interior';
import * as m3 from './maps/habitacion_posada_lucero_del_alba';
import * as m4 from './maps/pompelin';

const META: PublishedMapMeta[] = [{"id":"brumaluz","name":"Brumaluz","kind":"city","region":"Pompelín central","loadingTip":"Brumaluz es la capital de Pompelín.","publishedAt":"2026-10-21T23:11:17.987Z","objects":3909,"assets":30,"bytes":2218508},{"id":"brumaluz_2","name":"Brumaluz","kind":"city","region":"Pompelín central","loadingTip":"Brumaluz es la capital de Pompelín.","publishedAt":"2026-10-20T14:09:12.334Z","objects":982,"assets":9,"bytes":733028},{"id":"casa_de_isberto_interior","name":"Casa de Isberto","kind":"interior","region":"","loadingTip":"","publishedAt":"2026-10-21T01:54:26.266Z","objects":38,"assets":26,"bytes":1677496},{"id":"habitacion_posada_lucero_del_alba","name":"Habitación posada Lucero del alba","kind":"interior","region":"","loadingTip":"","publishedAt":"2026-10-22T00:03:59.745Z","objects":12,"assets":9,"bytes":663376},{"id":"pompelin","name":"Pompelín","kind":"world","region":"Continente de Pompelín","loadingTip":"Brumaluz es la capital. Sus puertas conectan la ciudad con el continente.","publishedAt":"2026-10-21T01:45:17.227Z","objects":495,"assets":6,"bytes":321436}];
const MODULES: PublishedMapModule[] = [m0, m1, m2, m3, m4];
export const PUBLISHED_WORLD: PublishedWorld = Object.fromEntries(META.map((meta, index) => [meta.id, { ...meta, load: async () => MODULES[index] }]));
