// Opciones del jugador persistidas en localStorage (ventana Opciones del menú del juego).
const KEY = 'brumaluz-settings';

export interface Settings {
  /** Volumen general (0-100): afectará a todos los sonidos del juego (ambiente, combate, etc.). */
  masterVolume: number;
  /** Volumen del sonido ambiental (0-100). */
  ambientVolume: number;
  /** Música ambiental durante la partida, independiente de aves, agua y viento. */
  musicEnabled: boolean;
  musicVolume: number;
  /** Muestra nombre y título sobre los personajes. */
  nameplates: boolean;
}

const DEFAULTS: Settings = { masterVolume: 80, ambientVolume: 80, musicVolume:55,musicEnabled:true,nameplates: true };
const clamp = (v: unknown, fallback: number) => (typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : fallback);

export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    return { masterVolume: clamp(raw.masterVolume, DEFAULTS.masterVolume), ambientVolume: clamp(raw.ambientVolume, DEFAULTS.ambientVolume), musicVolume:clamp(raw.musicVolume,DEFAULTS.musicVolume),musicEnabled:typeof raw.musicEnabled==='boolean'?raw.musicEnabled:DEFAULTS.musicEnabled,nameplates: typeof raw.nameplates === 'boolean' ? raw.nameplates : DEFAULTS.nameplates };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: Settings) {
  localStorage.setItem(KEY, JSON.stringify(settings));
}
