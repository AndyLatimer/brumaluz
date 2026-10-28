import { type CharData, type AttributeId, sanitize, randomChar, RACES, ATTRIBUTE_POINTS_AVAILABLE, MAKEUPS } from './data';
import { primaryAttribute } from './combat';
import { BEARDS } from '../character/head';
import { withAccessoryLayer, hasTravelerMask, type AccessorySelection } from '../character/head/accessoryLayers';

/** Only cosmetic choices belong in a look; progression and account data never do. */
export const CREATOR_GROUPS = {
  raza: ['race', 'sex', 'height', 'build'],
  rostro: ['skin', 'face', 'eyeShape', 'eyeColor', 'brows', 'nose', 'mouth', 'beard', 'trait', 'detail', 'makeup', 'makeupColor'],
  cabello: ['hair', 'hairColor', 'hairAcc', 'hairAccColor'],
  ropa: ['clothA', 'clothB', 'acc', 'accColor'],
  clase: ['cls', 'primary', 'secondary'],
} as const;
export type CreatorTab = keyof typeof CREATOR_GROUPS;
export const LOOK_KEYS = Object.values(CREATOR_GROUPS).flat();
export type LookKey = typeof LOOK_KEYS[number];
export type Look = Pick<CharData, LookKey>;
/** Reveal the edited feature in thumbnails without altering the saved appearance. */
export function creatorOptionPreview(data: CharData, key: string): CharData {
  return ['mouth', 'beard', 'makeup', 'detail'].includes(key) && hasTravelerMask(data.acc)
    ? { ...data, acc: withAccessoryLayer(data.acc, 'mask', 0) } : data;
}
export function captureLook(data: CharData): Look {
  return Object.fromEntries(LOOK_KEYS.map(key => [key, data[key]])) as Look;
}
export function applyLook(data: CharData, look: Partial<Look>, locked: ReadonlySet<string> = new Set()): CharData {
  const patch = Object.fromEntries(LOOK_KEYS.filter(key => !locked.has(key) && Object.hasOwn(look, key)).map(key => [key, look[key]]));
  return sanitize({ ...data, ...patch });
}
export function varyLook(data: CharData, tab: CreatorTab | 'all', locked: ReadonlySet<string>): CharData {
  // Generate in the current lineage so skin/ear ranges remain meaningful when lineage is locked.
  const candidate = randomChar();
  candidate.beard = Math.random() < .5 ? 0 : Math.floor(Math.random() * BEARDS.length);
  candidate.makeup = Math.random() < .5 ? 0 : Math.floor(Math.random() * MAKEUPS.length);
  if (tab !== 'all' || locked.has('race')) candidate.race = data.race;
  candidate.skin = Math.floor(Math.random() * RACES[candidate.race].skins.length);
  candidate.trait = Math.floor(Math.random() * Math.max(1, RACES[candidate.race].traits.length));
  const keys = tab === 'all' ? LOOK_KEYS : CREATOR_GROUPS[tab];
  return applyLook(data, Object.fromEntries(keys.map(key => [key, candidate[key]])), locked);
}
const accessories = (choices: Partial<AccessorySelection>) => Object.entries(choices).reduce((id, [key, value]) => withAccessoryLayer(id, key as keyof AccessorySelection, value), 0);
export const STYLE_PRESETS: { label: string; desc: string; look: Partial<Look> }[] = [
  { label: 'Lino y avellana', desc: 'Tonos cálidos, pecas y un recogido sencillo.', look: { hair: 18, hairColor: 12, eyeShape: 10, eyeColor: 10, brows: 8, mouth: 6, beard: 0, detail: 6, makeup: 0, hairAcc: 0, acc: 3, clothA: 7, clothB: 5, accColor: 9 } },
  { label: 'Verde de bosque', desc: 'Trenzas, hojas y verdes apagados.', look: { hair: 17, hairColor: 16, eyeShape: 9, eyeColor: 9, brows: 6, mouth: 0, beard: 0, detail: 8, makeup: 8, makeupColor: 10, hairAcc: 9, hairAccColor: 10, acc: 8, accColor: 9, clothA: 2, clothB: 16 } },
  { label: 'Cobre y carbón', desc: 'Un corte corto y detalles de cobre.', look: { hair: 13, hairColor: 3, eyeShape: 8, eyeColor: 4, brows: 7, mouth: 8, beard: 7, detail: 9, makeup: 0, hairAcc: 0, acc: 8, accColor: 9, clothA: 6, clothB: 9 } },
  { label: 'Bruma de lavanda', desc: 'Ondas suaves, plata y una mirada serena.', look: { hair: 20, hairColor: 15, eyeShape: 11, eyeColor: 11, brows: 8, mouth: 6, beard: 0, detail: 7, makeup: 9, makeupColor: 12, hairAcc: 10, hairAccColor: 1, acc: 9, accColor: 1, clothA: 14, clothB: 7 } },
  { label: 'Azul de viaje', desc: 'Flequillo, pañuelo y colores de cielo.', look: { hair: 15, hairColor: 1, eyeShape: 12, eyeColor: 2, brows: 0, mouth: 4, beard: 0, detail: 2, makeup: 0, hairAcc: 0, acc: 7, accColor: 11, clothA: 1, clothB: 13 } },
  { label: 'Rosa de jardín', desc: 'Rizos, flores y un toque de rubor.', look: { hair: 11, hairColor: 17, eyeShape: 4, eyeColor: 3, brows: 6, mouth: 1, beard: 0, detail: 11, makeup: 1, hairAcc: 4, hairAccColor: 12, acc: 4, accColor: 0, clothA: 11, clothB: 12 } },
  { label: 'Tinta y plata', desc: 'Una silueta sobria con gafas de boticario.', look: { hair: 12, hairColor: 7, eyeShape: 0, eyeColor: 7, brows: 7, mouth: 2, beard: 0, detail: 5, makeup: 6, hairAcc: 7, hairAccColor: 1, acc: 10, accColor: 1, clothA: 6, clothB: 7 } },
  { label: 'Sol de otoño', desc: 'Trenza lateral, miel y tejidos de calabaza.', look: { hair: 16, hairColor: 13, eyeShape: 10, eyeColor: 4, brows: 8, mouth: 0, beard: 0, detail: 14, makeup: 0, hairAcc: 1, hairAccColor: 0, acc: 3, accColor: 9, clothA: 9, clothB: 15 } },
  { label: 'Perla y medianoche', desc: 'Un moño trenzado, perlas y un medallón sobre lino oscuro.', look: { hair: 23, hairColor: 0, hairAcc: 0, beard: 0, eyeShape: 5, eyeColor: 2, brows: 8, mouth: 6, detail: 5, makeup: 9, makeupColor: 12, acc: accessories({ neckwear: 12, earrings: 13 }), accColor: 1, clothA: 6, clothB: 7 } },
  { label: 'Menta y lino', desc: 'Rizos cortos, gafas cuadradas y tejidos suaves.', look: { hair: 25, hairColor: 12, hairAcc: 0, beard: 0, eyeShape: 6, eyeColor: 9, brows: 6, mouth: 0, detail: 11, makeup: 0, acc: accessories({ eyewear: 11, earrings: 13 }), accColor: 9, clothA: 12, clothB: 7 } },
  { label: 'Cobre de invierno', desc: 'Una trenza alta, aros y bufanda en tonos de cobre.', look: { hair: 22, hairColor: 5, hairAcc: 7, hairAccColor: 9, beard: 0, eyeShape: 3, eyeColor: 4, brows: 7, mouth: 8, detail: 6, makeup: 0, acc: accessories({ neckwear: 2, earrings: 8 }), accColor: 9, clothA: 13, clothB: 6 } },
  { label: 'Salvia y lavanda', desc: 'Dos moños trenzados, pendientes de luna y tonos de jardín.', look: { hair: 27, hairColor: 15, hairAcc: 9, hairAccColor: 10, beard: 0, eyeShape: 1, eyeColor: 3, brows: 8, mouth: 6, detail: 15, makeup: 8, makeupColor: 10, acc: accessories({ earrings: 9, neckwear: 3 }), accColor: 1, clothA: 14, clothB: 12 } },
  { label: 'Tiza y tinta', desc: 'Trenzas recogidas, monóculo y un medallón discreto.', look: { hair: 26, hairColor: 6, hairAcc: 0, beard: 8, eyeShape: 7, eyeColor: 7, brows: 7, mouth: 2, detail: 9, makeup: 0, acc: accessories({ eyewear: 5, neckwear: 12 }), accColor: 1, clothA: 7, clothB: 6 } },
  { label: 'Grana y crema', desc: 'Melena de lado, pequeñas perlas y tejidos cálidos.', look: { hair: 24, hairColor: 1, hairAcc: 10, hairAccColor: 0, beard: 0, eyeShape: 12, eyeColor: 10, brows: 6, mouth: 8, detail: 17, makeup: 3, makeupColor: 3, acc: accessories({ earrings: 13, neckwear: 3 }), accColor: 0, clothA: 0, clothB: 15 } },
  { label: 'Ocre y musgo', desc: 'Pelo corto, patillas, gafas y una bufanda de color musgo.', look: { hair: 13, hairColor: 3, hairAcc: 0, beard: 6, eyeShape: 8, eyeColor: 9, brows: 2, mouth: 0, detail: 2, makeup: 0, acc: accessories({ eyewear: 1, neckwear: 2, earrings: 8 }), accColor: 10, clothA: 9, clothB: 2 } },
  { label: 'Berenjena y plata', desc: 'Ondas oscuras, gafas finas y pendientes sobre tejidos púrpura.', look: { hair: 20, hairColor: 7, hairAcc: 11, hairAccColor: 1, beard: 0, eyeShape: 11, eyeColor: 5, brows: 6, mouth: 6, detail: 13, makeup: 2, makeupColor: 7, acc: accessories({ eyewear: 10, earrings: 9 }), accColor: 1, clothA: 3, clothB: 6 } },
];
export const COLOR_STORIES = [
  { label: 'Lino y cuero', colors: [7, 5, 9] }, { label: 'Bosque y arena', colors: [2, 16, 10] },
  { label: 'Cielo y crema', colors: [13, 15, 1] }, { label: 'Brezo y lino', colors: [14, 7, 7] },
  { label: 'Vino y oro', colors: [0, 4, 0] }, { label: 'Rosa y menta', colors: [11, 12, 12] },
  { label: 'Carbón y cobre', colors: [6, 9, 9] }, { label: 'Mar y espuma', colors: [8, 7, 11] },
  { label: 'Perla y medianoche', colors: [6, 7, 1] }, { label: 'Menta y lino', colors: [12, 7, 9] },
  { label: 'Cobre de invierno', colors: [13, 6, 9] }, { label: 'Salvia y lavanda', colors: [14, 12, 10] },
  { label: 'Tiza y tinta', colors: [7, 6, 1] }, { label: 'Grana y crema', colors: [0, 15, 0] },
  { label: 'Ocre y musgo', colors: [9, 2, 10] }, { label: 'Berenjena y plata', colors: [3, 6, 1] },
];
export function suggestedAttributes(data: CharData, balanced: boolean) {
  const points = Object.fromEntries(Object.keys(data.attributePoints).map(key => [key, 0])) as Record<AttributeId, number>;
  points[primaryAttribute(data.cls)] = balanced ? 1 : ATTRIBUTE_POINTS_AVAILABLE;
  if (balanced) points.corpulencia = ATTRIBUTE_POINTS_AVAILABLE - 1;
  return points;
}

export class CreatorHistory {
  private entries: string[] = [];
  private cursor = -1;
  reset(data: CharData) { this.entries = []; this.cursor = -1; this.record(data); }
  record(data: CharData, coalesce = false) {
    const next = JSON.stringify({ ...captureLook(data), name: data.name, attributePoints: data.attributePoints });
    if (next === this.entries[this.cursor]) return;
    this.entries.splice(this.cursor + 1);
    if (coalesce && this.cursor > 0) this.entries[this.cursor] = next;
    else { this.entries.push(next); this.cursor++; }
    if (this.entries.length > 80) { this.entries.shift(); this.cursor--; }
  }
  get canUndo() { return this.cursor > 0; }
  get canRedo() { return this.cursor < this.entries.length - 1; }
  move(data: CharData, direction: -1 | 1) {
    if (direction < 0 ? !this.canUndo : !this.canRedo) return data;
    this.cursor += direction;
    return sanitize({ ...data, ...JSON.parse(this.entries[this.cursor]) });
  }
}
