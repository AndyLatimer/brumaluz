import { FACE_KITS, HAIR_STYLES, BEARDS, EYE_SHAPES, BROWS, NOSES, MOUTHS, DETAILS } from './head';
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
  hair: number;
  hairColor: number;
  beard: number;
  eyeShape: number;
  eyeColor: number;
  brows: number;
  nose: number;
  mouth: number;
  detail: number;
  trait: number; // rasgo propio del linaje (orejas, cresta…)
  // ropa de diario (pestaña Ropa) y complementos
  top: number;
  arms: number;
  legs: number;
  cape: number;
  clothA: number;
  clothB: number;
  hairAcc: number;
  acc: number;
  makeup: number;
  accColor: number;
  /** Qué se pone para pasear por la ciudad: 0 traje de clase, 1 ropa de diario. */
  cityWear: number;
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

export const EYE_COLORS = ['#1c1418', '#5a3420', '#2e66b0', '#2f8a46', '#b07a1a', '#6a3fa0', '#a83030', '#7d8c98'];
export const EYE_COLOR_NAMES = ['Negro', 'Castaño', 'Azul', 'Verde', 'Ámbar', 'Violeta', 'Rubí', 'Gris'];

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
export const CLOTH = ['#a8302e', '#3a64a8', '#2e8a4e', '#6a4aa8', '#d8a838', '#7a4a2a', '#34343e', '#ece4d0', '#2e8a8a', '#d0642a', '#c43a7a', '#e8a0b4', '#9ed4b8', '#9cc4ec', '#bca8e0', '#f2d6a0', '#c4b49a'];
export const CLOTH_NAMES = ['Carmesí', 'Azul real', 'Bosque', 'Púrpura', 'Oro', 'Castaño', 'Carbón', 'Lino', 'Turquesa', 'Calabaza', 'Fucsia', 'Rosa palo', 'Menta', 'Cielo', 'Lavanda', 'Crema', 'Arena'];

// Ropa de diario: cada pieza sale de uno de los cuatro modelos de KayKit
export const OUTFIT_KITS = ['Rogue', 'Mage', 'Knight', 'Barbarian'] as const;
export const TOPS = ['Túnica con capucha', 'Abrigo de botones', 'Cota acolchada', 'Jubón de cazador'];
export const ARMS = ['Guantes de cuero', 'Mangas con puños', 'Guanteletes', 'Mangas con pelo'];
export const LEGS = ['Calzas y zapatos', 'Botas de viaje', 'Grebas', 'Botas de pelo'];
export const CAPES = ['Sin capa', 'Capa corta', 'Capa de mago', 'Capa noble', 'Capa de piel'];
export const HAIR_ACCS = ['Ninguno', 'Flor', 'Lazo', 'Horquilla de estrella', 'Corona de flores', 'Diadema', 'Pluma'];
export const ACCS = ['Ninguno', 'Gafas redondas', 'Bufanda', 'Colgante', 'Pendientes', 'Monóculo', 'Gafas y bufanda'];
export const CITY_WEAR = ['Traje de clase', 'Ropa de diario'];
export const MAKEUPS = ['Ninguno', 'Pestañas', 'Sombra de ojos', 'Labios', 'Sombra y labios', 'Brillitos', 'Rabillo gatuno'];
export const ACC_COLORS = ['#e8b84a', '#c8ccd4', '#f08aa8', '#d0404a', '#4a7ad8', '#4aa86a', '#f4f0e6', '#9a6ad0', '#3a3036'];
export const ACC_COLOR_NAMES = ['Oro', 'Plata', 'Rosa', 'Rojo', 'Azul', 'Verde', 'Blanco', 'Lila', 'Negro'];

export function randomName(race: Race, r = Math.random) {
  const [a, b] = RACES[race].names;
  return a[Math.floor(r() * a.length)] + b[Math.floor(r() * b.length)];
}

export function defaultChar(): CharData {
  return {
    name: '', race: 'humano', sex: 0, height: 0.5, build: 0.5, skin: 1, face: 1,
    hair: 1, hairColor: 2, beard: 0, eyeShape: 0, eyeColor: 1, brows: 0, nose: 0, mouth: 0, detail: 0,
    trait: 0, cls: 'guerrero', primary: 0, secondary: 4,
    top: 0, arms: 0, legs: 0, cape: 0, clothA: 7, clothB: 5, hairAcc: 0, acc: 0, makeup: 0, accColor: 0, cityWear: 0,
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
  out.face = clamp(out.face, FACE_KITS.length);
  out.hair = clamp(out.hair, HAIR_STYLES.length);
  out.beard = clamp(out.beard, BEARDS.length);
  out.eyeShape = clamp(out.eyeShape, EYE_SHAPES.length);
  out.eyeColor = clamp(out.eyeColor, EYE_COLORS.length);
  out.brows = clamp(out.brows, BROWS.length);
  out.nose = clamp(out.nose, NOSES.length);
  out.mouth = clamp(out.mouth, MOUTHS.length);
  out.detail = clamp(out.detail, DETAILS.length);
  out.trait = clamp(out.trait, R.traits.length);
  out.hairColor = clamp(out.hairColor, HAIR_COLORS.length);
  out.primary = clamp(out.primary, CLOTH.length);
  out.secondary = clamp(out.secondary, CLOTH.length);
  out.top = clamp(out.top, TOPS.length);
  out.arms = clamp(out.arms, ARMS.length);
  out.legs = clamp(out.legs, LEGS.length);
  out.cape = clamp(out.cape, CAPES.length);
  out.clothA = clamp(out.clothA, CLOTH.length);
  out.clothB = clamp(out.clothB, CLOTH.length);
  out.hairAcc = clamp(out.hairAcc, HAIR_ACCS.length);
  out.acc = clamp(out.acc, ACCS.length);
  out.makeup = clamp(out.makeup, MAKEUPS.length);
  out.accColor = clamp(out.accColor, ACC_COLORS.length);
  out.cityWear = clamp(out.cityWear, CITY_WEAR.length);
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
    skin: rnd(R.skins.length), face: rnd(3),
    hair: rnd(HAIR_STYLES.length), hairColor: rnd(HAIR_COLORS.length),
    beard: sex ? 0 : rnd(BEARDS.length), eyeShape: rnd(EYE_SHAPES.length), eyeColor: rnd(EYE_COLORS.length),
    brows: rnd(BROWS.length), nose: rnd(NOSES.length), mouth: rnd(MOUTHS.length), detail: Math.random() < 0.5 ? 0 : rnd(DETAILS.length),
    trait: rnd(Math.max(R.traits.length, 1)),
    cls, primary: rnd(CLOTH.length), secondary: rnd(CLOTH.length),
    top: rnd(TOPS.length), arms: rnd(ARMS.length), legs: rnd(LEGS.length), cape: Math.random() < 0.6 ? 0 : rnd(CAPES.length),
    clothA: rnd(CLOTH.length), clothB: rnd(CLOTH.length),
    hairAcc: Math.random() < 0.5 ? 0 : rnd(HAIR_ACCS.length), acc: Math.random() < 0.6 ? 0 : rnd(ACCS.length),
    makeup: Math.random() < 0.4 ? rnd(MAKEUPS.length) : 0, accColor: rnd(ACC_COLORS.length), cityWear: 0,
  };
}
