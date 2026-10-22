// Hora del mundo. La marca el servidor (public.world_clock en supabase/server/) y llega con cada
// sincronización; entre una y otra el cliente la deja correr sola. Sin conexión (pruebas, modo local) se
// calcula con la misma fórmula y el reloj del ordenador, así que coincide con la del servidor.

/** Segundos reales que dura una hora del mundo (10 minutos). */
export const SECONDS_PER_WORLD_HOUR = 600;
/** Mismo origen que server_config.world_clock: el 1 de enero de 2026 (UTC) eran las 8:00 en el mundo. */
const EPOCH = 1767225600, START_HOUR = 8;

export interface WorldClockSample { hour: number; secondsPerHour: number }

let base: { hour: number; at: number; secondsPerHour: number } | null = null;

const wrap = (hour: number) => ((hour % 24) + 24) % 24;

/** Hora calculada en el propio ordenador (solo si el servidor aún no ha dicho nada). */
export function localWorldHour(now = Date.now()) {
  return wrap(START_HOUR + (now / 1000 - EPOCH) / SECONDS_PER_WORLD_HOUR);
}

/** Lee el reloj que manda el servidor; `null` si la respuesta no lo trae o no es válido. */
export function parseWorldClock(value: unknown): WorldClockSample | null {
  if (!value || typeof value !== 'object') return null;
  const { hour, secondsPerHour } = value as Record<string, unknown>;
  const h = Number(hour), s = Number(secondsPerHour);
  return Number.isFinite(h) && Number.isFinite(s) && s > 0 ? { hour: wrap(h), secondsPerHour: s } : null;
}

/**
 * Ajusta el reloj a la hora del servidor. Las diferencias de menos de un minuto del mundo (la latencia de la red)
 * se ignoran para que el cielo no dé tirones; si el servidor cambia de hora o de ritmo, se salta a la suya.
 */
export function syncWorldClock(sample: WorldClockSample, now = performance.now()) {
  if (base && base.secondsPerHour === sample.secondsPerHour) {
    let diff = sample.hour - worldHour(now);
    diff -= Math.round(diff / 24) * 24;
    if (Math.abs(diff) < 1 / 60) return;
  }
  base = { hour: sample.hour, at: now, secondsPerHour: sample.secondsPerHour };
}

/** Hora del mundo, de 0 a 24 (con decimales). */
export function worldHour(now = performance.now()) {
  if (!base) return localWorldHour();
  return wrap(base.hour + (now - base.at) / 1000 / base.secondsPerHour);
}

/** «07:05» */
export function formatWorldTime(hour: number) {
  const minutes = Math.floor(wrap(hour) * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
