import source from './uniqueWeapons.json';
import collections from './weaponCollections.json';
import type { WeaponDef } from './weapons';

/** Modelos originales completos, sin reutilizar las mallas de los conjuntos anteriores. */
export const ORIGINAL_WEAPONS = [...source, ...collections].map(item => ({
  ...item,
  weapon: {
    cls: item.cls, slot: item.slot, tier: item.tier, kind: item.kind,
    ...(item.power ? { power: item.power } : {}),
    ...(item.guard ? { guard: item.guard } : {}),
    ...(item.healing ? { healing: item.healing } : {}),
  } as WeaponDef,
}));

export function originalWeaponIcon(kind: WeaponDef['kind'], collection: string, offhand = false) {
  if (['roble', 'marea', 'forja'].includes(collection)) {
    const color = collection === 'roble' ? '#79ad66' : collection === 'marea' ? '#67bdcc' : '#eeaa54';
    const dark = collection === 'roble' ? '#66513b' : collection === 'marea' ? '#3b6476' : '#45404e';
    const icons: Record<WeaponDef['kind'], string> = {
      sword: collection === 'marea'
        ? `<path d="m8 18 2-9 3-6 6-1 2 4-3 6-4 1-2 6Z" fill="#dce5df" stroke="${dark}"/><path d="m6 17 6 3M6 23l3-5" stroke="${dark}" stroke-width="2"/>`
        : `<path d="m8 18 4-8 1-5 6-3 1 6-4 5-4 7Z" fill="#dce5df" stroke="${dark}"/><path d="m6 17 6 3M6 23l3-5" stroke="${dark}" stroke-width="2"/>`,
      shield: `<path d="m12 2 8 5-1 11-7 4-7-4L4 7Z" fill="${dark}" stroke="#dce5df"/><path d="m12 5 5 7-5 7-5-7Z" fill="${color}"/>`,
      staff: `<path d="M11 23V8M5 3v6l6 3 7-3V3M11 12V2" stroke="${dark}" stroke-width="2.5" fill="none"/><path d="m11 2 3 4-3 3-2-3Z" fill="${color}"/>`,
      dagger: `<path d="m8 17 1-9 5-4 5-2-3 8-3-1-2 9Z" fill="#dce5df" stroke="${dark}"/><path d="m5 16 8 3M6 23l3-6" stroke="${dark}" stroke-width="2"/>`,
      wand: `<path d="m6 22 8-13" stroke="${dark}" stroke-width="3"/><path d="m15 1 2 5 6 1-5 3 1 6-5-4-5 2 2-6-3-3 6 1Z" fill="${color}" stroke="#dce5df"/>`,
      book: `<path d="M4 3h15l1 18-15 1Z" fill="${dark}" stroke="#dce5df"/><path d="M8 3v18" stroke="#dce5df"/><path d="m14 6 4 6-4 6-4-6Z" fill="${color}"/>`,
      crossbow: `<path d="m7 22 9-18" stroke="${dark}" stroke-width="3"/><path d="M3 6 9 4l2 5 6 3 4 7-6-2-3-5-6-2Z" fill="${color}" stroke="#dce5df"/><path d="m3 6 18 13" stroke="${dark}"/>`,
    };
    return `<g stroke-linejoin="round" stroke-linecap="round">${icons[kind]}${offhand ? `<circle cx="19" cy="4" r="2" fill="${color}"/>` : ''}</g>`;
  }
  const color = collection === 'alba' ? '#70b7e4' : '#b28be4';
  const metal = collection === 'alba' ? '#d7e4df' : '#a6adc7';
  const dark = collection === 'alba' ? '#395f6d' : '#433353';
  const shapes: Record<WeaponDef['kind'], string> = {
    sword: collection === 'alba'
      ? `<path d="m8 16 9-13 4-1-1 7-9 10Z" fill="${metal}"/><path d="m11 15 7-10" stroke="${color}"/>`
      : `<path d="m8 16 7-11 5-3-2 6 3 1-10 10Z" fill="${metal}"/><path d="m11 15 6-8" stroke="${color}"/>`,
    shield: collection === 'alba'
      ? `<path d="m4 4 8-2 8 2-1 12-7 6-7-6Z" fill="${dark}" stroke="${metal}" stroke-width="2"/><path d="M12 5v13M7 11h10" stroke="${color}" stroke-width="2"/>`
      : `<path d="m12 2 7 3 3 7-3 7-7 3-7-3-3-7 3-7Z" fill="${dark}" stroke="${metal}"/><path d="M15 6c-9-1-9 13 0 12-5-4-5-8 0-12Z" fill="${color}"/>`,
    staff: `<path d="m8 22 6-17M13 12 8 7m6 3 5-4" stroke="#97734f" stroke-width="2.5"/><path d="m14 2 4 4-4 5-3-5Z" fill="${color}" stroke="${metal}"/>`,
    dagger: offhand
      ? `<path d="m8 16 3-8 8-5-3 7 3 1-8 8Z" fill="${metal}"/><path d="m11 14 4-5" stroke="${color}"/>`
      : `<path d="m8 16 3-7 3 1 1-5 4-3-1 8-3 1-4 8Z" fill="${metal}"/><path d="m11 14 5-7" stroke="${color}"/>`,
    wand: `<path d="m6 22 9-14" stroke="#97734f" stroke-width="2.5"/><path d="m16 2 3 4 4 1-4 3-2 5-3-5-4-2 5-2Z" fill="${metal}"/><circle cx="17" cy="8" r="2.5" fill="${color}"/>`,
    book: `<path d="m5 3 14-1 1 18-14 2Z" fill="${dark}" stroke="${metal}"/><path d="M8 4v16M10 7h6M10 17h6" stroke="${metal}"/><path d="m13 8 4 4-4 4-3-4Z" fill="${color}"/>`,
    crossbow: `<path d="m7 22 9-17" stroke="#97734f" stroke-width="3"/><path d="M3 7 8 3l8 7 5 8-5-1-5-6Z" fill="${metal}" stroke="${dark}"/><path d="m3 7 18 11M11 10l4 2" stroke="${color}"/>`,
  };
  const grip = kind === 'sword' || kind === 'dagger'
    ? `<path d="m6 14 7 5M5 22l5-6" stroke="${dark}" stroke-width="2.5"/><circle cx="6" cy="21" r="1.4" fill="${color}"/>` : '';
  return `<g stroke-linejoin="round" stroke-linecap="round">${shapes[kind]}${grip}</g>`;
}
