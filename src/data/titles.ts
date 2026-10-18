// Títulos de personaje. Para añadir uno nuevo: agrégalo a TITLES y traduce su etiqueta en ui/i18n.ts.
export const TITLES = {
  none: { label: 'Sin título' },
  recien_llegado: { label: 'Recién llegado' },
  rey_de_pompelin: { label: 'Rey de Pompelín', reserved: true },
  reina_de_pompelin: { label: 'Reina de Pompelín', reserved: true },
} as const satisfies Record<string, { label: string; reserved?: boolean }>;

export type TitleId = keyof typeof TITLES;

export const TITLE_ORDER = Object.keys(TITLES) as TitleId[];
export const DEFAULT_TITLE: TitleId = 'recien_llegado';

export const isReservedTitle = (id: TitleId) => 'reserved' in TITLES[id];

/** Títulos reservados que el servidor ha autorizado a la cuenta actual (solo para el selector). */
const granted = new Set<TitleId>();
export const setGrantedTitles = (ids: string[]) => { granted.clear(); for (const id of ids) if (isTitleId(id)) granted.add(id); };
export const isTitleAvailable = (id: TitleId) => !isReservedTitle(id) || granted.has(id);

/** Icono de fénix: distintivo del equipo de desarrollo. */
export const PHOENIX_ICON = '<svg class="phoenix" viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><path d="M12 1c1 1.200 1.200 2.400.5 3.600.9.500 1.500 1.200 1.500 2.100 0 .9-.6 1.600-1.400 1.900.9.700 1.600 1.800 1.600 3.200 0 1.700-.8 3-2.200 4.600-1.400-1.600-2.200-2.900-2.200-4.600 0-1.400.7-2.500 1.600-3.200C10.600 8.300 10 7.600 10 6.700c0-.9.600-1.600 1.500-2.100C10.800 3.400 11 2.200 12 1Z"/><path d="M9.8 10.5C7.5 8 4.5 6.5 1.5 1.5 1.8 5.5 3 8 5.5 10 3.5 10.5 2.2 11.8 1.2 14 3 13.5 4.5 13.5 6 13.8 4.5 14.5 3.5 15.5 3 17.2 6 16.5 8 15.8 9.8 14.6Z"/><g transform="matrix(-1 0 0 1 24 0)"><path d="M9.8 10.5C7.5 8 4.5 6.5 1.5 1.5 1.8 5.5 3 8 5.5 10 3.5 10.5 2.2 11.8 1.2 14 3 13.5 4.5 13.5 6 13.8 4.5 14.5 3.5 15.5 3 17.2 6 16.5 8 15.8 9.8 14.6Z"/></g><path d="M12 15c-1.200 2.200-1.600 5.200 0 8.500 1.600-3.300 1.200-6.300 0-8.500Z"/><path d="M10.300 15.500c-3 .8-4.500 3.500-3.600 6.500.8-1.200 2.200-1.500 3.200-1.200-.8-1.500-.8-3.200.4-5.300Z"/><path d="M13.700 15.500c3 .8 4.500 3.500 3.600 6.500-.8-1.200-2.200-1.500-3.200-1.200.8-1.500.8-3.200-.4-5.300Z"/></g></svg>';

export const isTitleId = (v: unknown): v is TitleId => typeof v === 'string' && Object.prototype.hasOwnProperty.call(TITLES, v);
