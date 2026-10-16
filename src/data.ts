// Datos del creador de personaje: linajes, clases, paletas y opciones.

export type Race = 'humano' | 'elfo' | 'lagto' | 'pelso';
export type ClassId = 'guerrero' | 'mago' | 'picaro' | 'clerigo' | 'explorador';

export interface CharData {
  name: string;
  race: Race;
  sex: 0 | 1; // 0 hombre, 1 mujer
  height: number; // 0..1
  build: number; // 0..1
  skin: number;
  eyes: number;
  hair: number;
  hairColor: number;
  detail: number; // barba / pelaje / patrón según linaje
  eyeShape: number;
  brows: number;
  nose: number;
  mouth: number;
  cls: ClassId;
  primary: number;
  secondary: number;
}

export interface RaceDef {
  label: string;
  desc: string;
  skins: string[];
  skinNames: string[];
  skinKind: 'skin' | 'fur' | 'scales';
  height: number;
  slim: number;
  leg: number;
  head: number;
  tail: 0 | 1 | 2; // 0 sin cola, 1 cola de gato, 2 cola de lagarto
  slit: boolean;
  light?: string; // color de hocico / vientre
  hairLabel: string;
  hairStyles: string[];
  names: [string[], string[]];
}

const HUMAN_HAIR = ['Rapado', 'Corto', 'Melena', 'Coleta', 'Moño', 'Media melena', 'Trenzas', 'Cresta',
  'Despeinado', 'Rizos', 'Dos coletas', 'Raya al lado', 'Afro', 'Moño alto', 'Ondulado largo'];

export const RACES: Record<Race, RaceDef> = {
  humano: {
    label: 'Humano',
    desc: 'Gente de Brumaluz: artesanos, mercaderes y soñadores. Se adaptan a cualquier oficio.',
    skins: ['#f6dcc4', '#ecc3a0', '#d9a57c', '#b97f57', '#8e5a3a', '#5f3b28'],
    skinNames: ['Marfil', 'Melocotón', 'Miel', 'Canela', 'Cacao', 'Ébano'],
    skinKind: 'skin', height: 1, slim: 1, leg: 1, head: 1, tail: 0, slit: false,
    hairLabel: 'Peinado', hairStyles: HUMAN_HAIR,
    names: [['Al', 'Ber', 'Cor', 'Dar', 'El', 'Gar', 'Is', 'Mar', 'Rod', 'Tor', 'Ali', 'Ro'], ['ric', 'an', 'ina', 'mundo', 'wen', 'eth', 'iel', 'do', 'berto', 'lia', 'sa']],
  },
  elfo: {
    label: 'Elfo',
    desc: 'Guardianes de los bosques que rodean la ciudad. Esbeltos, longevos y amantes de la música.',
    skins: ['#f8e6d6', '#efd0b8', '#e2c3cf', '#c4b0d6', '#9a89c2', '#cdb894'],
    skinNames: ['Alba', 'Pétalo', 'Rosa', 'Lavanda', 'Crepúsculo', 'Trigo'],
    skinKind: 'skin', height: 1.05, slim: 0.9, leg: 1.06, head: 0.97, tail: 0, slit: false,
    hairLabel: 'Peinado', hairStyles: HUMAN_HAIR,
    names: [['Ae', 'Ela', 'Fae', 'Gal', 'Ith', 'Lae', 'Syl', 'Thal', 'Ny', 'Ara'], ['driel', 'lindra', 'rion', 'wyn', 'thas', 'nora', 'vael', 'neth', 'lia']],
  },
  lagto: {
    label: "Lagto'",
    desc: 'Gente lagarto de los pantanos del sur. Pescadores, alquimistas y los mejores nadadores del reino.',
    skins: ['#5f9a52', '#3e8a76', '#97a84c', '#c9813f', '#3f72a0', '#a5473f'],
    skinNames: ['Junco', 'Laguna', 'Musgo', 'Arena', 'Río', 'Brasa'],
    skinKind: 'scales', height: 1.03, slim: 1.05, leg: 0.96, head: 1, tail: 2, slit: true, light: '#efe0a8',
    hairLabel: 'Cresta', hairStyles: ['Ninguna', 'Púas', 'Abanico', 'Cuernos', 'Aleta', 'Corona', 'Cuernos largos'],
    names: [["Sss'", 'Ka', 'Zith', 'Ish', 'Tol', 'Xa', 'Rek', 'Ssa'], ["'ra", 'ssik', 'tek', "'li", 'zar', 'ko', 'thiss']],
  },
  pelso: {
    label: 'Pelso',
    desc: 'Gente gato de pelaje suave. Curiosos, ágiles y expertos en encontrar el rincón más soleado.',
    skins: ['#e39a55', '#9a9a9e', '#3e3838', '#f2ece2', '#d8bf98', '#7a5440'],
    skinNames: ['Naranja', 'Gris', 'Negro', 'Nieve', 'Crema', 'Chocolate'],
    skinKind: 'fur', height: 0.95, slim: 0.95, leg: 0.98, head: 1.06, tail: 1, slit: true, light: '#f7f0e6',
    hairLabel: 'Peinado', hairStyles: HUMAN_HAIR,
    names: [['Mi', 'Nu', 'Pi', 'Ro', 'Ca', 'Mo', 'Tis', 'Lu', 'Fe'], ['sha', 'ru', 'lo', 'mi', 'ki', 'fu', 'sia', 'nya', 'rra']],
  },
};

export const BEARDS = ['Ninguna', 'Bigote', 'Perilla', 'Corta', 'Completa', 'Larga'];
export const FUR = ['Liso', 'Atigrado', 'Hocico claro', 'Antifaz'];
export const SCALES = ['Liso', 'Rayas', 'Manchas'];

/** Opciones del rasgo facial según linaje y sexo (null = no aplica). */
export function detailOptions(race: Race, sex: 0 | 1): { label: string; list: string[] } | null {
  if (race === 'pelso') return { label: 'Pelaje', list: FUR };
  if (race === 'lagto') return { label: 'Patrón', list: SCALES };
  return sex === 0 ? { label: 'Barba', list: BEARDS } : null;
}

export const EYE_SHAPES = ['Redondos', 'Almendrados', 'Rasgados', 'Dulces', 'Grandes', 'Soñolientos'];
export const BROWS = ['Naturales', 'Finas', 'Gruesas', 'Arqueadas', 'Rectas', 'Enfadadas', 'Preocupadas'];

/** Opciones de la cara según linaje (null = no aplica). */
export function faceOptions(race: Race) {
  if (race === 'pelso') return {
    brows: BROWS,
    noseLabel: 'Nariz', nose: ['Rosa', 'Negra', 'Corazón', 'Canela'],
    mouth: ['Gatuna', 'Sonrisa', 'Colmillito', 'Abierta'],
  };
  if (race === 'lagto') return {
    brows: null,
    noseLabel: 'Hocico', nose: ['Normal', 'Corto', 'Largo', 'Romo', 'Cuerno nasal'],
    mouth: ['Línea', 'Sonrisa', 'Colmillos'],
  };
  return {
    brows: BROWS,
    noseLabel: 'Nariz', nose: ['Recta', 'Respingona', 'Ancha', 'Aguileña', 'Pequeña'],
    mouth: ['Sonrisa', 'Neutra', 'Pícara', 'Abierta', 'Sorpresa', 'Seria'],
  };
}

export interface ClassDef {
  label: string;
  desc: string;
  headgear: number;
  primary: number;
  secondary: number;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  guerrero: { label: 'Guerrero', desc: 'Armadura, yelmo, espada y escudo. Protege las murallas y a sus amigos.', headgear: 2, primary: 0, secondary: 6 },
  mago: { label: 'Mago', desc: 'Estudia las runas en la torre del reloj. Su bastón brilla con magia arcana.', headgear: 3, primary: 3, secondary: 4 },
  picaro: { label: 'Pícaro', desc: 'Se mueve entre tejados y callejones. Dagas gemelas y muchos secretos.', headgear: 1, primary: 5, secondary: 0 },
  clerigo: { label: 'Clérigo', desc: 'Sanador del templo del Sol. Su maza bendita reparte luz y consuelo.', headgear: 5, primary: 7, secondary: 4 },
  explorador: { label: 'Explorador', desc: 'Arquero de los caminos. Conoce cada sendero y cada criatura del bosque.', headgear: 4, primary: 2, secondary: 9 },
};

export const EYES = ['#3f7fd0', '#4fa45a', '#7a5230', '#c9a23a', '#8a4fc1', '#d0463a', '#3ab8b8', '#e8c040'];
export const EYE_NAMES = ['Zafiro', 'Esmeralda', 'Avellana', 'Ámbar', 'Amatista', 'Rubí', 'Turquesa', 'Oro'];
export const HAIR_COLORS = ['#2a1d16', '#5a3a22', '#8a5a2b', '#c48a3f', '#e8c97e', '#b23a22', '#e4e0d8', '#3a3a4a', '#5a86c8', '#8a5fb8', '#4f9a6a', '#d8608a'];
export const CLOTH = ['#8b2a2a', '#2f4f8b', '#3f6b3a', '#5f3a8b', '#c9a24a', '#5a3a22', '#2e2e38', '#e9e1cc', '#2f7a7a', '#c0622a'];
export const CLOTH_NAMES = ['Carmesí', 'Azul real', 'Bosque', 'Púrpura', 'Ocre', 'Castaño', 'Carbón', 'Lino', 'Turquesa', 'Calabaza'];

export function randomName(race: Race, r = Math.random) {
  const [a, b] = RACES[race].names;
  return a[Math.floor(r() * a.length)] + b[Math.floor(r() * b.length)];
}

export function defaultChar(): CharData {
  return {
    name: '', race: 'humano', sex: 0, height: 0.5, build: 0.45, skin: 1, eyes: 0,
    hair: 1, hairColor: 2, detail: 0, eyeShape: 0, brows: 0, nose: 0, mouth: 0, cls: 'guerrero', primary: 0, secondary: 6,
  };
}

/** Repara datos guardados de versiones anteriores. */
export function sanitize(d: Record<string, unknown>): CharData {
  const out = { ...defaultChar(), ...d } as CharData;
  if (!(out.race in RACES)) out.race = 'humano';
  if (!(out.cls in CLASSES)) out.cls = 'guerrero';
  if (out.sex !== 0 && out.sex !== 1) out.sex = 0;
  const R = RACES[out.race];
  out.hair = Math.min(Math.max(out.hair | 0, 0), R.hairStyles.length - 1);
  out.skin = Math.min(Math.max(out.skin | 0, 0), R.skins.length - 1);
  const det = detailOptions(out.race, out.sex);
  out.detail = det ? Math.min(Math.max(out.detail | 0, 0), det.list.length - 1) : 0;
  const F = faceOptions(out.race);
  const clamp = (n: number, len: number) => Math.min(Math.max(n | 0, 0), len - 1);
  out.eyeShape = clamp(out.eyeShape, EYE_SHAPES.length);
  out.brows = clamp(out.brows, BROWS.length);
  out.nose = clamp(out.nose, F.nose.length);
  out.mouth = clamp(out.mouth, F.mouth.length);
  delete (out as unknown as Record<string, unknown>).headgear;
  return out;
}

export function randomChar(): CharData {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
  const race = pick(Object.keys(RACES) as Race[]);
  const cls = pick(Object.keys(CLASSES) as ClassId[]);
  const sex = (Math.random() < 0.5 ? 0 : 1) as 0 | 1;
  const R = RACES[race];
  const det = detailOptions(race, sex);
  const F = faceOptions(race);
  const rnd = (n: number) => Math.floor(Math.random() * n);
  return {
    name: randomName(race), race, sex,
    height: Math.random(), build: Math.random(),
    skin: Math.floor(Math.random() * R.skins.length), eyes: Math.floor(Math.random() * EYES.length),
    hair: Math.floor(Math.random() * R.hairStyles.length), hairColor: Math.floor(Math.random() * HAIR_COLORS.length),
    detail: det ? rnd(det.list.length) : 0,
    eyeShape: rnd(EYE_SHAPES.length), brows: rnd(BROWS.length), nose: rnd(F.nose.length), mouth: rnd(F.mouth.length),
    cls, primary: rnd(CLOTH.length), secondary: rnd(CLOTH.length),
  };
}
