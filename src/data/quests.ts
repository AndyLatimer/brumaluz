import type { Race } from './data';

export type WelcomeStage = 'available' | 'active' | 'found' | 'completed';
export interface WelcomeProgress { origin: number | null; stage: WelcomeStage }
export type WelcomeAction = 'origin' | 'accept' | 'collect' | 'claim';
export const WELCOME_TITLE = 'Algo pequeño, algo importante';
export const WELCOME_REWARD = { experience: 40, pelines: 5 };
export type ShadowQuest = 'active' | 'defeated' | 'completed';
export const SHADOW_TITLE = 'Una sombra entre el ganado';
export function shadowObjective(stage: ShadowQuest | null) {
  return stage === 'completed' ? 'Has recogido una esencia desconocida.'
    : stage === 'defeated' ? 'Abre el cuerpo de la criatura y recoge sus restos.'
    : stage === 'active' ? 'Investiga y derrota a la criatura junto al ganado.'
    : 'Habla con Isberto, el granjero de las afueras.';
}
export function parseShadowQuest(value: unknown): ShadowQuest | null {
  if (value === undefined || value === null) return null;
  if (value !== 'active' && value !== 'defeated' && value !== 'completed') throw new Error('Progreso de Isberto no válido.');
  return value;
}
export function questItems(progress: WelcomeProgress | null) {
  return progress?.stage === 'found' ? [{
    id: 'gnomi-guild-badge',
    name: 'Distintivo del Gremio de Ayudantes',
    description: 'El distintivo de Gnomi. Un poco torcido, pero todavía digno del gremio.',
    quest: WELCOME_TITLE,
    objective: 'Devuélveselo a Gnomi.',
  }] : [];
}
// Keep these interaction points in sync with welcome_action in server.sql.
export const WELCOME_START = { x: -6.4, z: -8.5 };
export const WELCOME_BADGE = { x: 15.8, z: -5.7 };
export const ORIGINS: Record<Race, readonly [string, string, string]> = {
  humano: ['Soy de Brumaluz y busco mi primer oficio.', 'He venido a probar suerte.', 'Quiero aprender de sus talleres.'],
  elfo: ['Vengo de la Arboleda para aprender.', 'Quiero conocer la vida de la capital.', 'Vivo aquí y busco un nuevo rumbo.'],
  lagto: ['He bajado de las Cumbres de Cobre para aprender un oficio.', 'Quiero conocer qué hay más allá de las montañas.', 'Vivo aquí y busco un nuevo rumbo.'],
  pelso: ['He llegado desde Luna Argéntea para conocer la capital.', 'Busco oportunidades en tierra firme.', 'Vivo aquí y busco un nuevo rumbo.'],
};
export const ORIGIN_REPLIES = [
  '¡Pues me alegro de haberte encontrado! Una cara amiga siempre viene bien al empezar.',
  'Un rumbo nuevo, ¿eh? Si necesitas orientación, estás en buenas manos. Pequeñas, pero buenas.',
  'Entonces habrá que buscarte un buen comienzo. Y, si no te importa, empezar por echarme una mano a mí.',
] as const;
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
  if (progress.stage === 'active') return 'Recoge el distintivo junto al mercado.';
  return progress.origin === null ? 'Habla con Gnomi y cuéntale qué te trae por aquí.' : 'Habla con Gnomi para comenzar la búsqueda.';
}
