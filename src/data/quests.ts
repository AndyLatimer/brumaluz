import type { Race } from './data';

export type WelcomeStage = 'available' | 'active' | 'found' | 'completed';
export interface WelcomeProgress { origin: number | null; stage: WelcomeStage }
export type WelcomeAction = 'origin' | 'accept' | 'collect' | 'claim';
export const WELCOME_TITLE = 'Algo pequeño, algo importante';
export const WELCOME_REWARD = { experience: 40, pelines: 5 };
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
  'Siempre viene bien alguien con ganas de aprender. Yo también sigo aprendiendo… aunque a veces se me note demasiado.',
  'Un rumbo nuevo, ¿eh? Si necesitas orientación, estás en buenas manos. Pequeñas, pero buenas.',
  'Entonces empecemos por algo sencillo. Conocer a alguien que pueda echarte una mano.',
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
