// Títulos de personaje. Para añadir uno nuevo: agrégalo a TITLES y traduce su etiqueta en ui/i18n.ts.
export const TITLES = {
  none: { label: 'Sin título' },
  recien_llegado: { label: 'Recién llegado' },
} as const;

export type TitleId = keyof typeof TITLES;

export const TITLE_ORDER = Object.keys(TITLES) as TitleId[];
export const DEFAULT_TITLE: TitleId = 'recien_llegado';

export const isTitleId = (v: unknown): v is TitleId => typeof v === 'string' && Object.prototype.hasOwnProperty.call(TITLES, v);
