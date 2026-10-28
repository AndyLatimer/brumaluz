import type { Race } from './data';

export type WelcomeStage = 'available' | 'active' | 'found' | 'completed';
export interface WelcomeProgress { origin: number | null; stage: WelcomeStage }
export type WelcomeAction = 'arrive' | 'origin' | 'accept' | 'collect' | 'claim';
export const WELCOME_TITLE = 'Algo pequeño, algo importante';
export const WELCOME_REWARD = { experience: 40, pelines: 5 };
export type ShadowQuest = 'active' | 'defeated' | 'returning' | 'returned';
export type ShadowAction = 'report' | 'return';
/** Plaza del pozo: allí vuelve Gnomi cuando Isberto se lleva al jugador a su casa. */
export const SHADOW_RETURN = { x: -3.5, z: 0 };
export const SHADOW_TITLE = 'Una sombra junto a la fragua';
export type FairyDustQuest = 'ask_gnomi' | 'arboleda';
export const FAIRY_DUST_QUEST_TITLE = 'Un polvo misterioso';
export function parseFairyDustQuest(value: unknown): FairyDustQuest | null {
  if (value === undefined || value === null) return null;
  if (value !== 'ask_gnomi' && value !== 'arboleda') throw new Error('Progreso del polvo de hada no válido.');
  return value;
}
export function fairyDustObjective(stage: FairyDustQuest) {
  return stage === 'ask_gnomi' ? 'Pregunta a Gnomi por el polvo de hada que has encontrado.'
    : 'Gnomi te ha recomendado visitar La Arboleda para saber más sobre el polvo de hada.';
}
/** `looted`: si ya se registraron los restos de la criatura (solo cuenta tras derrotarla). */
export function shadowObjective(stage: ShadowQuest | null, looted = true, location = 'brumaluz') {
  return stage === 'returned' ? 'Isberto te ha dado cobijo: usa su cama para descansar y el cofre de la esquina para guardar tus cosas.'
    : stage === 'returning' ? location === ISBERTO_HOUSE ? 'Habla con Isberto para que te enseñe la cama y el cofre.' : 'Sigue a Isberto hasta su casa y entra con él.'
    : stage === 'defeated' ? looted ? 'Habla con Isberto sobre la criatura derrotada.' : 'Registra los restos de la criatura.'
    : stage === 'active' ? 'Derrota a la criatura que ronda la herrería de Isberto, al sur.'
    : 'Habla con Isberto, el herrero de las afueras.';
}
// Mantener en sincronía con create_character, welcome_action, shadow_action, world_travel y rest_action (supabase/server/).
/** Puerta del Este: los personajes nuevos aparecen aquí, entrando a la ciudad (`yaw`: el de la cámara). */
export const INTRO_GATE = { x: 177, z: 0, yaw: Math.PI / 2 };
/** Hasta dónde camina el personaje al entrar en la cinemática inicial. */
export const INTRO_ENTRY = { x: 156.5, z: 0 };
/** De dónde sale Gnomi, buscando su distintivo, en la cinemática inicial. */
export const INTRO_GNOMI_FROM = { x: 143.5, z: 2.2 };
/** Casa de Isberto: mapa interior, su puerta en Brumaluz y lo que hay dentro. */
export const ISBERTO_HOUSE = 'casa_de_isberto_interior';
export const ISBERTO_DOOR = { x: 23.5, z: -48.5 };
/** Camino que sigue Isberto desde su herrería hasta su puerta (en el último punto espera al jugador). */
export const ISBERTO_WAY = [{ x: 10, z: -58 }, { x: 19, z: -54.5 }, { x: 25.5, z: -51.5 }, { x: 25.6, z: -49.9 }];
export const ISBERTO_INSIDE = { x: .9, z: .55 };
export const HOUSE_BED = { x: -1.5, z: -2.5 };
export const BED_RADIUS = 2.2;
export const SHADOW_REPORT_RADIUS = 8;
export const ISBERTO_TALK_RADIUS = 4;
export function parseShadowQuest(value: unknown): ShadowQuest | null {
  if (value === undefined || value === null) return null;
  // Earlier releases completed the quest on looting, before its closing conversation existed.
  if (value === 'completed') return 'defeated';
  if (value !== 'active' && value !== 'defeated' && value !== 'returning' && value !== 'returned') throw new Error('Progreso de Isberto no válido.');
  return value;
}
export function questItems(progress: WelcomeProgress | null) {
  return progress?.stage === 'found' ? [{
    id: 'gnomi-guild-badge',
    name: 'Distintivo del Gremio de Ayudantes',
    description: 'Distintivo de Gnomi, miembro del Gremio de Ayudantes.',
    quest: WELCOME_TITLE,
    objective: 'Devuélveselo a Gnomi.',
  }] : [];
}
// Keep these interaction points in sync with welcome_action in supabase/server/.
/** Donde Gnomi se encuentra con el jugador, recién cruzada la Puerta del Este. */
export const WELCOME_START = { x: 153.5, z: 0 };
/** El distintivo perdido, junto al mercado de la plaza del Levante. */
export const WELCOME_BADGE = { x: 138.6, z: -2.6 };
/** Distancia a Gnomi para presentarse y aceptar su misión. */
export const WELCOME_TALK_RADIUS = 5;
export const ORIGINS: Record<Race, readonly [string, string, string]> = {
  humano: ['Soy de Brumaluz y busco mi primer oficio.', 'He venido a probar suerte.', 'Quiero aprender de sus talleres.'],
  elfo: ['Vengo de la Arboleda para aprender.', 'Quiero conocer la vida de la capital.', 'Vivo aquí y busco un nuevo rumbo.'],
  lagto: ['He bajado de las Cumbres de Cobre para aprender un oficio.', 'Quiero conocer qué hay más allá de las montañas.', 'Vivo aquí y busco un nuevo rumbo.'],
  pelso: ['He llegado desde Luna Argéntea para conocer la capital.', 'Busco oportunidades en tierra firme.', 'Vivo aquí y busco un nuevo rumbo.'],
};
export const ORIGIN_REPLIES: Record<Race, readonly [string, string, string]> = {
  "humano": [
    "¡Vecino, entonces! No te voy a explicar dónde está cada plaza. Para el primer oficio sí puedo ayudarte: vamos a los talleres y preguntamos. Preguntar sale barato; los pergaminos, ya menos.",
    "Probar suerte… Sí, eso hago yo algunas mañanas. Por aquí puedes empezar con los encargos de los maestros y ver si te gusta algún oficio. No prometo hacerte rico; encontrar el taller sí entra en mis competencias.",
    "Entonces has venido con tarea para mí. Los talleres están en el Barrio de los Artesanos. Te enseño las puertas; de lo que pasa dentro sabe más cada maestro. Yo prefiero avisarlo antes de que me pregunten cómo se hace una ballesta."
  ],
  "elfo": [
    "¿De La Arboleda? Y has venido a aprender aquí. Pues voy a procurar que merezca la pena el paseo. En los talleres puedes probar distintos oficios; no tienes que quedarte con el primero que te abra la puerta.",
    "La capital… Dicho así parece que tenga que enseñártela entera antes de comer. Mejor empezamos por el mercado y los talleres, que los tengo bien aprendidos. Lo demás lo vamos viendo.",
    "¿Vives aquí? Menos mal que he preguntado antes de darte la bienvenida por segunda vez. Si buscas otro rumbo, podemos empezar por los oficios. Cambiar de idea también está permitido; lo digo porque yo cambio bastante."
  ],
  "lagto": [
    "Desde las Cumbres de Cobre hasta nuestros talleres… Como el primer maestro que veamos te diga que vuelvas otro día, le voy a preguntar yo. Por las buenas, eso sí. Primero vemos qué te interesa aprender.",
    "Fuera de las montañas, pues de momento me has encontrado a mí. No sé si eso compensa el viaje. Brumaluz tiene bastante más: mercado, talleres y vecinos de varias regiones. Vamos por partes.",
    "Entonces no necesitas una visita a Brumaluz; necesitas encontrar algo que te apetezca hacer en ella. Eso me gusta más. Vamos a mirar los talleres sin decidir todavía nada."
  ],
  "pelso": [
    "¿Desde Luna Argéntea? Pues no voy a despacharte con señalar una calle. Podemos empezar por el mercado y el Barrio de los Artesanos. Si me alargo explicando, me lo dices; cuando me dejan llevar una bienvenida, me entusiasmo.",
    "Para ganarte unos pelines, los maestros pagan por suministros. Para gastártelos, también venden recetas. Yo te enseño dónde están y tú decides en qué dirección van a moverse los tuyos.",
    "¿Otro rumbo sin salir de Brumaluz? Eso sí puedo enseñártelo. En los talleres puedes probar varios oficios. Si alguno no te gusta, nos vamos al siguiente; no tengo encargo de convencerte a la fuerza."
  ]
};
export function parseWelcome(value: unknown): WelcomeProgress | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Progreso de bienvenida no válido.');
  const row = value as Record<string, unknown>;
  if (typeof row.stage !== 'string' || !['available', 'active', 'found', 'completed'].includes(row.stage)
    || (row.origin !== null && (!Number.isInteger(row.origin) || Number(row.origin) < 0 || Number(row.origin) > 2))
    || (row.stage !== 'available' && row.origin === null)) throw new Error('Progreso de bienvenida no válido.');
  return { origin: row.origin === null ? null : Number(row.origin), stage: row.stage as WelcomeStage };
}
export const welcomeComplete = (progress: WelcomeProgress | null) => progress === null || progress.stage === 'completed';
export function welcomeObjective(progress: WelcomeProgress) {
  if (progress.stage === 'completed') return 'Has devuelto el distintivo de Gnomi.';
  if (progress.stage === 'found') return 'Habla con Gnomi y devuélvele su distintivo.';
  if (progress.stage === 'active') return 'Recoge el distintivo junto al mercado de la plaza del Levante.';
  return progress.origin === null ? 'Habla con Gnomi y cuéntale qué te trae por aquí.' : 'Habla con Gnomi para comenzar la búsqueda.';
}
