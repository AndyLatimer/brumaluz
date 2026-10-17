import { FACE_KITS, HAIR_STYLES, BEARDS, EYE_SHAPES, BROWS, NOSES, MOUTHS, DETAILS } from './head';
// Datos del creador de personaje: linajes, clases, paletas y opciones.

export type Race = 'humano' | 'elfo' | 'lagto' | 'pelso';
export type ClassId = 'guerrero' | 'mago' | 'picaro' | 'clerigo' | 'explorador';
export type AttributeId = 'fuerza' | 'intelecto' | 'corpulencia' | 'agilidad' | 'pericia' | 'presencia' | 'percepcion';

export interface AttributeDef {
  label: string;
  desc: string;
}

export const ATTRIBUTES: Record<AttributeId, AttributeDef> = {
  fuerza: { label: 'Fuerza', desc: 'Aumenta el daño general en combate.' },
  intelecto: { label: 'Intelecto', desc: 'Aumenta la reserva y el poder de la magia.' },
  corpulencia: { label: 'Corpulencia', desc: 'Aumenta la vida máxima y la resistencia al daño.' },
  agilidad: { label: 'Agilidad', desc: 'Aumenta la velocidad de movimiento y, ligeramente, la velocidad de ataque.' },
  pericia: { label: 'Pericia', desc: 'Mejora la artesanía y la alquimia: velocidad de creación y probabilidad de obtener mejores objetos.' },
  presencia: { label: 'Presencia', desc: 'Mejora el comercio, la negociación y las interacciones sociales.' },
  percepcion: { label: 'Percepción', desc: 'Ayuda a rastrear, encontrar recursos y descubrir objetos.' },
};

export type AttributeBonuses = Record<AttributeId, number>;
export const ATTRIBUTE_POINTS_AVAILABLE = 2;
export const ATTRIBUTE_BASE_VALUE = 5;
export const ATTRIBUTE_MAX_VALUE = 15;

const noBonuses = (): AttributeBonuses => ({
  fuerza: 0, intelecto: 0, corpulencia: 0, agilidad: 0, pericia: 0, presencia: 0, percepcion: 0,
});

export interface CharData {
  name: string;
  race: Race;
  attributePoints: AttributeBonuses;
  sex: 0 | 1; // 0 hombre, 1 mujer: el cuerpo es el mismo; al cambiarlo se ajusta la personalización
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
  bonuses: AttributeBonuses;
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
    desc: 'Nacidos en Brumaluz o llegados de tierras lejanas, los humanos destacan por su ingenio y por encontrar su propio camino en cualquier oficio.',
    bonuses: { ...noBonuses(), pericia: 3, presencia: 2 },
    skins: HUMAN_SKINS, skinNames: HUMAN_SKIN_NAMES,
    traitLabel: null, traits: [],
    names: [['Al', 'Ber', 'Cor', 'Dar', 'El', 'Gar', 'Is', 'Mar', 'Rod', 'Tor', 'Ali', 'Ro'], ['ric', 'an', 'ina', 'mundo', 'wen', 'eth', 'iel', 'do', 'berto', 'lia', 'sa']],
  },
  elfo: {
    label: 'Elfo',
    desc: 'Desde hace generaciones, los elfos protegen los bosques que abrazan Brumaluz. Su larga vida y conocimiento de la naturaleza los han convertido en hábiles alquimistas.',
    bonuses: { ...noBonuses(), intelecto: 2, pericia: 2, agilidad: 1 },
    skins: ['#fbe0cc', '#f2cdb0', '#e8c4c8', '#c9b4d8', '#9f8fc6', '#d4bc94'],
    skinNames: ['Alba', 'Pétalo', 'Rosa', 'Lavanda', 'Crepúsculo', 'Trigo'],
    traitLabel: 'Orejas', traits: ['Largas', 'Cortas', 'Caídas'],
    names: [['Ae', 'Ela', 'Fae', 'Gal', 'Ith', 'Lae', 'Syl', 'Thal', 'Ny', 'Ara'], ['driel', 'lindra', 'rion', 'wyn', 'thas', 'nora', 'vael', 'neth', 'lia']],
  },
  lagto: {
    label: "Lagto'",
    desc: 'Los Lagto’ hacen su hogar en montañas pedregosas, entre grietas estrechas y cavernas donde apenas llega la luz. Recios y pacientes, conocen los pasos ocultos de la roca mejor que nadie.',
    bonuses: { ...noBonuses(), fuerza: 2, corpulencia: 3 },
    skins: ['#7cc06a', '#4fae94', '#a8c25a', '#e0a050', '#5d93c8', '#c86a5a'],
    skinNames: ['Junco', 'Laguna', 'Musgo', 'Arena', 'Río', 'Brasa'],
    traitLabel: 'Cresta', traits: ['Púas', 'Cuernos', 'Aleta', 'Ninguna'],
    names: [["Sss'", 'Ka', 'Zith', 'Ish', 'Tol', 'Xa', 'Rek', 'Ssa'], ["'ra", 'ssik', 'tek', "'li", 'zar', 'ko', 'thiss']],
  },
  pelso: {
    label: 'Pelso',
    desc: 'Los Pelso’ siempre encuentran los rincones más cálidos, aunque rara vez se quedan quietos en ellos. Se dejan guiar por la pasión y el impulso: eso los lleva a vivir intensamente y, a veces, a meterse en líos de los que luego salen con una buena historia.',
    bonuses: { ...noBonuses(), fuerza: 1, corpulencia: 1, agilidad: 2, percepcion: 1 },
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
  guerrero: { label: 'Guerrero', desc: 'Caballeros, mercenarios o luchadores por cuenta propia: hay muchos caminos para un guerrero. Su honor no está en el título ni en las promesas, sino en las acciones que lleva a cabo.', primary: 0, secondary: 4 },
  mago: { label: 'Mago', desc: 'Los magos buscan comprender las fuerzas que dan forma al mundo. Algunos estudian durante años; otros aprenden a base de probar, fallar y volver a intentarlo. La magia exige curiosidad, disciplina… y aceptar que no siempre sale como uno espera.', primary: 3, secondary: 10 },
  picaro: { label: 'Pícaro', desc: 'Los pícaros conocen los atajos, las puertas traseras y el valor de escuchar antes de hablar. Algunos viven del ingenio, otros del sigilo o de saber a quién acudir; todos prefieren tener un plan de salida.', primary: 2, secondary: 5 },
  clerigo: { label: 'Clérigo', desc: 'Los clérigos encuentran en la fe una fuente de poder y propósito. Algunos ofrecen consuelo y curación; otros defienden sus creencias con firmeza.', primary: 7, secondary: 4 },
  explorador: { label: 'Explorador', desc: 'Los exploradores se sienten en casa lejos de los caminos transitados. Rastreadores, guías o viajeros solitarios, aprenden a leer el terreno y a arreglárselas con lo que encuentran.', primary: 1, secondary: 5 },
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
    name: '', race: 'humano', attributePoints: noBonuses(), sex: 0, height: 0.5, build: 0.5, skin: 1, face: 3,
    hair: 2, hairColor: 2, beard: 0, eyeShape: 7, eyeColor: 1, brows: 2, nose: 0, mouth: 0, detail: 0,
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
  const rawPoints = d.attributePoints && typeof d.attributePoints === 'object'
    ? d.attributePoints as Record<string, unknown>
    : {};
  let remainingPoints = ATTRIBUTE_POINTS_AVAILABLE;
  out.attributePoints = noBonuses();
  for (const key of Object.keys(ATTRIBUTES) as AttributeId[]) {
    const value = Number(rawPoints[key]);
    const maxPoints = Math.max(ATTRIBUTE_MAX_VALUE - ATTRIBUTE_BASE_VALUE - R.bonuses[key], 0);
    const points = Number.isFinite(value) ? Math.min(Math.max(Math.floor(value), 0), remainingPoints, maxPoints) : 0;
    out.attributePoints[key] = points;
    remainingPoints -= points;
  }
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
  out.cape = 0;
  out.clothA = clamp(out.clothA, CLOTH.length);
  out.clothB = clamp(out.clothB, CLOTH.length);
  out.hairAcc = clamp(out.hairAcc, HAIR_ACCS.length);
  out.acc = clamp(out.acc, ACCS.length);
  out.makeup = clamp(out.makeup, MAKEUPS.length);
  out.accColor = clamp(out.accColor, ACC_COLORS.length);
  out.cityWear = clamp(out.cityWear, CITY_WEAR.length);
  const height = Number(out.height);
  const build = Number(out.build);
  out.height = Math.min(Math.max(Number.isFinite(height) ? height : 0.5, 0), 1);
  out.build = Math.min(Math.max(Number.isFinite(build) ? build : 0.5, 0), 1);
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
    name: randomName(race), race, attributePoints: noBonuses(), sex,
    height: Math.random(), build: Math.random(),
    skin: rnd(R.skins.length), face: sex ? rnd(3) : [1, 2, 3][rnd(3)],
    hair: sex ? [3, 4, 5, 6, 8, 9, 10, 11, 12][rnd(9)] : [0, 1, 2, 7, 5, 11][rnd(6)], hairColor: rnd(HAIR_COLORS.length),
    beard: sex ? 0 : rnd(BEARDS.length), eyeShape: sex ? rnd(7) : [0, 2, 3, 7, 8][rnd(5)], eyeColor: rnd(EYE_COLORS.length),
    brows: rnd(BROWS.length), nose: rnd(NOSES.length), mouth: rnd(MOUTHS.length), detail: Math.random() < 0.5 ? 0 : rnd(DETAILS.length),
    trait: rnd(Math.max(R.traits.length, 1)),
    cls, primary: rnd(CLOTH.length), secondary: rnd(CLOTH.length),
    top: rnd(TOPS.length), arms: rnd(ARMS.length), legs: rnd(LEGS.length), cape: 0,
    clothA: rnd(CLOTH.length), clothB: rnd(CLOTH.length),
    hairAcc: Math.random() < 0.5 ? 0 : rnd(HAIR_ACCS.length), acc: Math.random() < 0.6 ? 0 : rnd(ACCS.length),
    makeup: sex ? 1 + (Math.random() < 0.5 ? 0 : rnd(MAKEUPS.length - 1)) : 0, accColor: rnd(ACC_COLORS.length), cityWear: 0,
  };
}
