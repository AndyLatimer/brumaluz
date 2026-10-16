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
  face: number;
  hairColor: number;
  trait: number; // rasgo propio del linaje (orejas, cresta…)
  cls: ClassId;
  primary: number;
  secondary: number;
}

export interface RaceDef {
  label: string;
  desc: string;
  skins: string[];
  skinNames: string[];
  traitLabel: string | null;
  traits: string[];
  names: [string[], string[]];
}

const HUMAN_SKINS = ['#f8ccab', '#ecb68e', '#d9a07a', '#b97f57', '#8e5a3a', '#5f3b28'];
const HUMAN_SKIN_NAMES = ['Marfil', 'Melocotón', 'Miel', 'Canela', 'Cacao', 'Ébano'];

export const RACES: Record<Race, RaceDef> = {
  humano: {
    label: 'Humano',
    desc: 'Gente de Brumaluz: artesanos, mercaderes y soñadores. Se adaptan a cualquier oficio.',
    skins: HUMAN_SKINS, skinNames: HUMAN_SKIN_NAMES,
    traitLabel: null, traits: [],
    names: [['Al', 'Ber', 'Cor', 'Dar', 'El', 'Gar', 'Is', 'Mar', 'Rod', 'Tor', 'Ali', 'Ro'], ['ric', 'an', 'ina', 'mundo', 'wen', 'eth', 'iel', 'do', 'berto', 'lia', 'sa']],
  },
  elfo: {
    label: 'Elfo',
    desc: 'Guardianes de los bosques que rodean la ciudad. Esbeltos, longevos y amantes de la música.',
    skins: ['#fbe0cc', '#f2cdb0', '#e8c4c8', '#c9b4d8', '#9f8fc6', '#d4bc94'],
    skinNames: ['Alba', 'Pétalo', 'Rosa', 'Lavanda', 'Crepúsculo', 'Trigo'],
    traitLabel: 'Orejas', traits: ['Largas', 'Cortas', 'Caídas'],
    names: [['Ae', 'Ela', 'Fae', 'Gal', 'Ith', 'Lae', 'Syl', 'Thal', 'Ny', 'Ara'], ['driel', 'lindra', 'rion', 'wyn', 'thas', 'nora', 'vael', 'neth', 'lia']],
  },
  lagto: {
    label: "Lagto'",
    desc: 'Gente lagarto de los pantanos del sur. Pescadores, alquimistas y los mejores nadadores del reino.',
    skins: ['#7cc06a', '#4fae94', '#a8c25a', '#e0a050', '#5d93c8', '#c86a5a'],
    skinNames: ['Junco', 'Laguna', 'Musgo', 'Arena', 'Río', 'Brasa'],
    traitLabel: 'Cresta', traits: ['Púas', 'Cuernos', 'Aleta', 'Ninguna'],
    names: [["Sss'", 'Ka', 'Zith', 'Ish', 'Tol', 'Xa', 'Rek', 'Ssa'], ["'ra", 'ssik', 'tek', "'li", 'zar', 'ko', 'thiss']],
  },
  pelso: {
    label: 'Pelso',
    desc: 'Gente gato de orejas suaves y cola inquieta. Curiosos, ágiles y expertos en encontrar el rincón más soleado.',
    skins: HUMAN_SKINS, skinNames: HUMAN_SKIN_NAMES,
    traitLabel: 'Orejas', traits: ['Puntiagudas', 'Redondas', 'Dobladas'],
    names: [['Mi', 'Nu', 'Pi', 'Ro', 'Ca', 'Mo', 'Tis', 'Lu', 'Fe'], ['sha', 'ru', 'lo', 'mi', 'ki', 'fu', 'sia', 'nya', 'rra']],
  },
};

/** Caras disponibles (cada una con su peinado) según el sexo. */
export const FACES: Record<0 | 1, { label: string; head: string }[]> = {
  0: [
    { label: 'Moreno de flequillo', head: 'Mage' },
    { label: 'Rubio despeinado', head: 'Knight' },
    { label: 'Barbudo', head: 'Barbarian' },
  ],
  1: [
    { label: 'Media melena', head: 'Rogue' },
  ],
};

export interface ClassDef {
  label: string;
  desc: string;
  primary: number;
  secondary: number;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  guerrero: { label: 'Guerrero', desc: 'Armadura, yelmo, espada y escudo. Protege las murallas y a sus amigos.', primary: 0, secondary: 4 },
  mago: { label: 'Mago', desc: 'Estudia las runas en la torre del reloj. Su bastón brilla con magia arcana.', primary: 3, secondary: 10 },
  picaro: { label: 'Pícaro', desc: 'Se mueve entre tejados y callejones. Dagas gemelas y muchos secretos.', primary: 2, secondary: 5 },
  clerigo: { label: 'Clérigo', desc: 'Sanador del templo del Sol. Varita, libro sagrado y mucha paciencia.', primary: 7, secondary: 4 },
  explorador: { label: 'Explorador', desc: 'Cazador de los caminos con gorro de oso y ballesta. Conoce cada sendero.', primary: 1, secondary: 5 },
};

export const HAIR_COLORS = ['#2a1d16', '#5a3a22', '#8a5a2b', '#c48a3f', '#e8c97e', '#b23a22', '#e4e0d8', '#3a3a4a', '#5a86c8', '#8a5fb8', '#4f9a6a', '#d8608a'];
export const HAIR_NAMES = ['Azabache', 'Castaño oscuro', 'Castaño', 'Cobrizo', 'Rubio', 'Pelirrojo', 'Plata', 'Grafito', 'Azul', 'Violeta', 'Verde', 'Rosa'];
export const CLOTH = ['#a8302e', '#3a64a8', '#2e8a4e', '#6a4aa8', '#d8a838', '#7a4a2a', '#34343e', '#ece4d0', '#2e8a8a', '#d0642a', '#c43a7a'];
export const CLOTH_NAMES = ['Carmesí', 'Azul real', 'Bosque', 'Púrpura', 'Oro', 'Castaño', 'Carbón', 'Lino', 'Turquesa', 'Calabaza', 'Fucsia'];

export function randomName(race: Race, r = Math.random) {
  const [a, b] = RACES[race].names;
  return a[Math.floor(r() * a.length)] + b[Math.floor(r() * b.length)];
}

export function defaultChar(): CharData {
  return {
    name: '', race: 'humano', sex: 0, height: 0.5, build: 0.5, skin: 1, face: 0,
    hairColor: 2, trait: 0, cls: 'guerrero', primary: 0, secondary: 4,
  };
}

/** Repara datos guardados de versiones anteriores. */
export function sanitize(d: Record<string, unknown>): CharData {
  const out = { ...defaultChar(), ...d } as CharData;
  if (!(out.race in RACES)) out.race = 'humano';
  if (!(out.cls in CLASSES)) out.cls = 'guerrero';
  if (out.sex !== 0 && out.sex !== 1) out.sex = 0;
  const R = RACES[out.race];
  const clamp = (n: unknown, len: number) => Math.min(Math.max((Number(n) | 0), 0), Math.max(len - 1, 0));
  out.skin = clamp(out.skin, R.skins.length);
  out.face = clamp(out.face, FACES[out.sex].length);
  out.trait = clamp(out.trait, R.traits.length);
  out.hairColor = clamp(out.hairColor, HAIR_COLORS.length);
  out.primary = clamp(out.primary, CLOTH.length);
  out.secondary = clamp(out.secondary, CLOTH.length);
  out.height = Math.min(Math.max(Number(out.height) || 0.5, 0), 1);
  out.build = Math.min(Math.max(Number(out.build) || 0.5, 0), 1);
  for (const k of Object.keys(out)) if (!(k in defaultChar())) delete (out as unknown as Record<string, unknown>)[k];
  return out;
}

export function randomChar(): CharData {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
  const rnd = (n: number) => Math.floor(Math.random() * n);
  const race = pick(Object.keys(RACES) as Race[]);
  const cls = pick(Object.keys(CLASSES) as ClassId[]);
  const sex = (Math.random() < 0.5 ? 0 : 1) as 0 | 1;
  const R = RACES[race];
  return {
    name: randomName(race), race, sex,
    height: Math.random(), build: Math.random(),
    skin: rnd(R.skins.length), face: rnd(FACES[sex].length), hairColor: rnd(HAIR_COLORS.length),
    trait: rnd(Math.max(R.traits.length, 1)),
    cls, primary: rnd(CLOTH.length), secondary: rnd(CLOTH.length),
  };
}
