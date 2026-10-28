import { FACE_KITS, HAIR_STYLES, BEARDS, EYE_SHAPES, BROWS, NOSES, MOUTHS, DETAILS } from '../character/head';
import { emptyWallet, sanitizeWallet, type Wallet } from './currency';
import { DEFAULT_TITLE, isTitleId, type TitleId } from './titles';
import { emptyEquipment, emptyInventory, sanitizeEquipment, sanitizeInventory, type Equipment, type InventorySlots } from './inventory';
import { parseFoodBuff, type FoodBuff } from './food';
import { parseWelcome, parseShadowQuest, parseFairyDustQuest, type FairyDustQuest, type ShadowQuest, type WelcomeProgress } from './quests';
import { COMBAT_KITS, skillRank, type SkillRanks } from './combat';
import { isCoinBagId } from './coinBags';
import { isFairyDustId } from './fairyDust';
import { ACCESSORIES } from '../character/head/accessoryLayers';
import { professionState, type RpgState } from './professions';
// Datos del creador de personaje: linajes, clases, paletas y opciones.

export type Race = 'humano' | 'elfo' | 'lagto' | 'pelso';
export type ClassId = 'guerrero' | 'mago' | 'picaro' | 'clerigo' | 'explorador';
/** Mapa (lugar de Pompelín) donde está el personaje: ID de un mapa publicado desde el editor. */
export type LocationId = string;
/** Nombres de los lugares conocidos; los mapas publicados se añaden al cargar el mundo. */
export const LOCATIONS: Record<LocationId, string> = { brumaluz: 'Brumaluz' };
export const locationName = (id: string | null | undefined) => (id && Object.prototype.hasOwnProperty.call(LOCATIONS, id) ? LOCATIONS[id] : id) ?? '';
const LOCATION_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;
export type AttributeId = 'fuerza' | 'intelecto' | 'corpulencia' | 'agilidad' | 'pericia' | 'presencia' | 'percepcion';

export interface AttributeDef {
  label: string;
  desc: string;
}

export const ATTRIBUTES: Record<AttributeId, AttributeDef> = {
  fuerza: { label: 'Fuerza', desc: 'Mejora los ataques básicos de todas las clases un 0,3 % por punto por encima de 5. El guerrero obtiene además +1 % de potencia por punto.' },
  intelecto: { label: 'Intelecto', desc: 'Reduce el coste de habilidades de todas las clases, con rendimiento decreciente y hasta un 25 %. Magos y clérigos ganan además potencia y maná.' },
  corpulencia: { label: 'Corpulencia', desc: '+2 % de vida máxima por punto. La reducción de daño depende de la Guardia.' },
  agilidad: { label: 'Agilidad', desc: 'Acelera los ataques básicos de todas las clases, hasta un 25 %, sin cortar su animación. Pícaros y exploradores ganan además potencia.' },
  pericia: { label: 'Pericia', desc: '+0,4 % de daño o curación de habilidades por punto por encima de 5, para todas las clases.' },
  presencia: { label: 'Presencia', desc: '+1 de recurso máximo por punto: maná o estamina según la clase.' },
  percepcion: { label: 'Percepción', desc: 'Reduce el daño recibido de todas las clases, con rendimiento decreciente y hasta un 15 % adicional a la Guardia.' },
};

export type AttributeBonuses = Record<AttributeId, number>;
export const ATTRIBUTE_POINTS_AVAILABLE = 2;
export const ATTRIBUTE_BASE_VALUE = 5;
export const ATTRIBUTE_MAX_VALUE = 15;
export const MAX_LEVEL = 50;
/** Se gana 1 punto de atributo cada 3 niveles (niveles 3, 6, … 48). */
export const ATTRIBUTE_POINT_LEVEL_STEP = 3;
/** Puntos de atributo totales a los que da derecho un nivel: los de la creación más los ganados al subir. */
export const attributePointsAllowed = (level: number, creationPoints = ATTRIBUTE_POINTS_AVAILABLE) =>
  creationPoints + Math.floor(Math.min(Math.max(level, 1), MAX_LEVEL) / ATTRIBUTE_POINT_LEVEL_STEP);
export const unspentAttributePoints = (d: Pick<CharData, 'level' | 'attributePoints' | 'creationPoints'>) =>
  attributePointsAllowed(d.level, d.creationPoints) - Object.values(d.attributePoints).reduce((sum, points) => sum + points, 0);

const noBonuses = (): AttributeBonuses => ({
  fuerza: 0, intelecto: 0, corpulencia: 0, agilidad: 0, pericia: 0, presencia: 0, percepcion: 0,
});

export interface CharData {
  introSeen: boolean;
  shadowQuest: ShadowQuest | null;
  isbertoPosition: { x: number; z: number } | null;
  coinBags: string[]; // bolsas de pelines ya recogidas (ver coinBags.ts)
  fairyDust: string[]; // polvos de hada ya recogidos (ver fairyDust.ts)
  fairyDustQuest: FairyDustQuest | null;
  welcome: WelcomeProgress | null;
  name: string;
  title: TitleId; // título mostrado junto al nombre (ver titles.ts)
  level: number;
  partyPeers?: number;
  experience: number; // experiencia acumulada dentro del nivel actual
  skillRanks: SkillRanks;
  health: number; // vida actual; -1 = al máximo
  overheal: number; // sobrecuración vigente cuando el servidor la guardó (se pierde con el tiempo, ver OVERHEAL en stats.ts)
  resource: number; // maná o estamina actual según la clase; -1 = al máximo
  foodBuff: FoodBuff | null;
  foodRevision: number;
  wallet: Wallet; // monedas (ver currency.ts)
  inventory: InventorySlots;
  equipment: Equipment;
  rpg?: RpgState;
  enchantState?: { weapon?:string; count?:number; at?:number; target?:string; marks?:Record<string,{count:number;at:number}>; barrier?:number; barrierUntil?:number };
  combatVisual?: {at:number;action:string};
  expeditionId?:string;
  potionReadyAt?:number;
  wilderness?:{selected?:string;respawns?:Record<string,number>;firstRecipe?:boolean;kills?:number;graceUntil?:number};
  location: LocationId;
  position: { x: number; z: number; yaw: number } | null; // última posición guardada por el servidor; null = punto de inicio
  race: Race;
  attributePoints: AttributeBonuses;
  creationPoints: number; // puntos de creación a los que tiene derecho (los personajes antiguos solo conservan los que ya gastaron)
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
  // colores de la ropa inicial de novato y complementos
  cape: number;
  clothA: number;
  clothB: number;
  hairAcc: number;
  hairAccColor: number;
  acc: number;
  makeup: number;
  makeupColor: number;
  accColor: number;
  cls: ClassId;
  primary: number;
  secondary: number;
}

export interface RaceDef {
  label: string;
  /** Forma femenina del nombre (si difiere de `label`). */
  feminine?: string;
  desc: string;
  bonuses: AttributeBonuses;
  skins: string[];
  skinNames: string[];
  traitLabel: string | null;
  traits: string[];
  names: [string[], string[]];
}

const HUMAN_SKINS = ['#f8ccab', '#ecb68e', '#d9a07a', '#b97f57', '#8e5a3a', '#5f3b28', '#c4977c', '#754e40'];
const HUMAN_SKIN_NAMES = ['Marfil', 'Melocotón', 'Miel', 'Canela', 'Cacao', 'Ébano', 'Almendra', 'Castaña'];

/** Pelajes felinos: color base, nombre y marcas de la cara (tabby = rayas, spots = manchas, mask = antifaz, patch = parches). */
export type CoatMark = 'tabby' | 'spots' | 'mask' | 'patch' | 'plain';
export interface Coat { base: string; name: string; mark: CoatMark; markColor: string; nose: string; ear: string; whisker: string; tail: string }
export const PELSO_COATS: Coat[] = [
  { base: '#e29a55', name: 'Naranja atigrado', mark: 'tabby', markColor: '#b96a2c', nose: '#e8909a', ear: '#f0b0a8', whisker: '#7a4a2a', tail: '#b96a2c' },
  { base: '#a3a8b3', name: 'Gris atigrado', mark: 'tabby', markColor: '#5f6573', nose: '#d58a98', ear: '#d9a5b0', whisker: '#4a4e5a', tail: '#4a4e5a' },
  { base: '#4a4247', name: 'Negro', mark: 'plain', markColor: '#2a2428', nose: '#8a5560', ear: '#8a5a64', whisker: '#d9d2d4', tail: '#2a2428' },
  { base: '#efe1c8', name: 'Siamés', mark: 'mask', markColor: '#7d5c49', nose: '#c9808a', ear: '#e8b4b0', whisker: '#6a4a3a', tail: '#7d5c49' },
  { base: '#e8c27a', name: 'Leopardo', mark: 'spots', markColor: '#8a5a2b', nose: '#d98a8a', ear: '#f0b8a0', whisker: '#6a4424', tail: '#8a5a2b' },
  { base: '#f6f2ea', name: 'Bicolor', mark: 'patch', markColor: '#8f8f98', nose: '#f0a0aa', ear: '#f6c4c4', whisker: '#7a7a82', tail: '#8f8f98' },
  { base: '#d89050', name: 'Carey', mark: 'patch', markColor: '#35292b', nose: '#d4858f', ear: '#e8a8a0', whisker: '#4a3630', tail: '#35292b' },
  { base: '#ad8c64', name: 'Pardo atigrado', mark: 'tabby', markColor: '#5a4128', nose: '#c98a86', ear: '#dba898', whisker: '#4a3626', tail: '#5a4128' },
  { base: '#dce0e4', name: 'Lince de nieve', mark: 'spots', markColor: '#788492', nose: '#ca94a4', ear: '#e2b8c4', whisker: '#526170', tail: '#788492' },
  { base: '#f0d9a9', name: 'Crema atigrado', mark: 'tabby', markColor: '#c19a66', nose: '#dd9e9a', ear: '#efc1b2', whisker: '#93724a', tail: '#c19a66' },
];
export const coatMark = (skin: string) => PELSO_COATS.find((c) => c.base === skin);

export const RACES: Record<Race, RaceDef> = {
  humano: {
    label: 'Humano',
    feminine: 'Humana',
    desc: 'Nacidos en Brumaluz o llegados de tierras lejanas, los humanos destacan por su ingenio y por encontrar su propio camino en cualquier oficio y destino.',
    bonuses: { ...noBonuses(), pericia: 3, presencia: 2 },
    skins: HUMAN_SKINS, skinNames: HUMAN_SKIN_NAMES,
    traitLabel: null, traits: [],
    names: [['Al', 'Ber', 'Cor', 'Dar', 'El', 'Gar', 'Is', 'Mar', 'Rod', 'Tor', 'Ali', 'Ro'], ['ric', 'an', 'ina', 'mundo', 'wen', 'eth', 'iel', 'do', 'berto', 'lia', 'sa']],
  },
  elfo: {
    label: 'Elfo',
    feminine: 'Elfa',
    desc: 'Desde hace generaciones, los elfos protegen los bosques que abrazan Brumaluz. Nativos de la Arboleda, su conexión y conocimiento de la naturaleza los han convertido en hábiles alquimistas.',
    bonuses: { ...noBonuses(), intelecto: 2, pericia: 2, agilidad: 1 },
    skins: ['#fbe0cc', '#f2cdb0', '#e8c4c8', '#c9b4d8', '#9f8fc6', '#d4bc94', '#b1bea3', '#a6b4cc'],
    skinNames: ['Alba', 'Pétalo', 'Rosa', 'Lavanda', 'Crepúsculo', 'Trigo', 'Liquen', 'Niebla lunar'],
    traitLabel: 'Orejas', traits: ['Largas', 'Cortas', 'Caídas', 'De hoja', 'Horizontales'],
    names: [['Ae', 'Ela', 'Fae', 'Gal', 'Ith', 'Lae', 'Syl', 'Thal', 'Ny', 'Ara'], ['driel', 'lindra', 'rion', 'wyn', 'thas', 'nora', 'vael', 'neth', 'lia']],
  },
  lagto: {
    label: "Lagto'",
    desc: 'Los Lagto’ hacen su hogar en las montañas pedregosas de Las Cumbres de Cobre, entre grietas estrechas y cavernas donde apenas llega la luz. Recios y pacientes, conocen los pasos ocultos de la roca mejor que nadie.',
    bonuses: { ...noBonuses(), fuerza: 2, corpulencia: 3 },
    skins: ['#7cc06a', '#4fae94', '#a8c25a', '#e0a050', '#5d93c8', '#c86a5a', '#626979', '#b98258'],
    skinNames: ['Junco', 'Laguna', 'Musgo', 'Arena', 'Río', 'Brasa', 'Pizarra', 'Cobre viejo'],
    traitLabel: 'Cresta', traits: ['Púas', 'Cuernos', 'Aleta', 'Ninguna', 'Cuernos cortos', 'Cresta de coral'],
    names: [["Sss'", 'Ka', 'Zith', 'Ish', 'Tol', 'Xa', 'Rek', 'Ssa'], ["'ra", 'ssik', 'tek', "'li", 'zar', 'ko', 'thiss']],
  },
  pelso: {
    label: 'Pelso',
    feminine: 'Pelsa',
    desc: 'Los Pelso siempre encuentran los rincones más cálidos, aunque rara vez se quedan quietos en ellos hábiles navegantes nativos de la Isla de Luna Argéntea, se dejan guiar por la pasión y el impulso: eso los lleva a vivir intensamente y, a veces, a meterse en líos de los que luego salen con una buena historia.',
    bonuses: { ...noBonuses(), fuerza: 1, corpulencia: 1, agilidad: 2, percepcion: 1 },
    skins: PELSO_COATS.map((c) => c.base), skinNames: PELSO_COATS.map((c) => c.name),
    traitLabel: 'Orejas', traits: ['Puntiagudas', 'Redondas', 'Dobladas', 'De lince', 'Pequeñas'],
    names: [['Mi', 'Nu', 'Pi', 'Ro', 'Ca', 'Mo', 'Tis', 'Lu', 'Fe'], ['sha', 'ru', 'lo', 'mi', 'ki', 'fu', 'sia', 'nya', 'rra']],
  },
};

export const EYE_COLORS = ['#1c1418', '#5a3420', '#2e66b0', '#2f8a46', '#b07a1a', '#6a3fa0', '#a83030', '#7d8c98', '#45a6a0', '#b4c995', '#c99548', '#b5b6d8'];
export const EYE_COLOR_NAMES = ['Negro', 'Castaño', 'Azul', 'Verde', 'Ámbar', 'Violeta', 'Rubí', 'Gris', 'Laguna', 'Salvia', 'Miel', 'Luna'];

export interface ClassDef {
  label: string;
  /** Forma femenina del nombre (si difiere de `label`). */
  feminine?: string;
  desc: string;
  primary: number;
  secondary: number;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  guerrero: { label: 'Guerrero', feminine: 'Guerrera', desc: 'Caballeros, mercenarios o luchadores por cuenta propia: hay muchos caminos para un guerrero. Su honor no está en el título ni en las promesas, sino en las acciones que lleva a cabo.', primary: 0, secondary: 4 },
  mago: { label: 'Mago', feminine: 'Maga', desc: 'Los magos buscan comprender las fuerzas que dan forma al mundo. Algunos estudian durante años; otros aprenden a base de probar, fallar y volver a intentarlo. La magia exige curiosidad, disciplina… y aceptar que no siempre sale como uno espera.', primary: 3, secondary: 10 },
  picaro: { label: 'Pícaro', feminine: 'Pícara', desc: 'Los pícaros conocen los atajos, las puertas traseras y el valor de escuchar antes de hablar. Algunos viven del ingenio, otros del sigilo o de saber a quién acudir; todos prefieren tener un plan de salida.', primary: 2, secondary: 5 },
  clerigo: { label: 'Clérigo', feminine: 'Clériga', desc: 'Los clérigos encuentran en la fe una fuente de poder y propósito. Algunos ofrecen consuelo y curación; otros defienden sus creencias con firmeza.', primary: 7, secondary: 4 },
  explorador: { label: 'Explorador', feminine: 'Exploradora', desc: 'Los exploradores se sienten en casa lejos de los caminos transitados. Rastreadores, guías o viajeros solitarios, aprenden a leer el terreno y a arreglárselas con lo que encuentran.', primary: 1, secondary: 5 },
};

/** Nombre de raza o clase con el género del personaje (sex 1 = femenino). */
export const raceLabel = (d: Pick<CharData, 'race' | 'sex'>) => (d.sex === 1 && RACES[d.race].feminine) || RACES[d.race].label;
export const classLabel = (d: Pick<CharData, 'cls' | 'sex'>) => (d.sex === 1 && CLASSES[d.cls].feminine) || CLASSES[d.cls].label;

export const HAIR_COLORS =  ['#2a1d16', '#5a3a22', '#8a5a2b', '#c48a3f', '#e8c97e', '#b23a22', '#e4e0d8', '#3a3a4a', '#5a86c8', '#8a5fb8', '#4f9a6a', '#d8608a', '#754338', '#ded2ad', '#315d60', '#afa5c6', '#434b32', '#9e5b73'];
export const HAIR_NAMES = ['Azabache', 'Castaño oscuro', 'Castaño', 'Cobrizo', 'Rubio', 'Pelirrojo', 'Plata', 'Grafito', 'Azul', 'Violeta', 'Verde', 'Rosa', 'Avellana', 'Lino dorado', 'Petróleo', 'Bruma lila', 'Musgo oscuro', 'Brezo'];
export const CLOTH = ['#a8302e', '#3a64a8', '#2e8a4e', '#6a4aa8', '#d8a838', '#7a4a2a', '#34343e', '#ece4d0', '#2e8a8a', '#d0642a', '#c43a7a', '#e8a0b4', '#9ed4b8', '#9cc4ec', '#bca8e0', '#f2d6a0', '#c4b49a'];
export const CLOTH_NAMES = ['Carmesí', 'Azul real', 'Bosque', 'Púrpura', 'Oro', 'Castaño', 'Carbón', 'Lino', 'Turquesa', 'Calabaza', 'Fucsia', 'Rosa palo', 'Menta', 'Cielo', 'Lavanda', 'Crema', 'Arena'];

// El equipo de clase depende de la vocación; el atuendo inicial es el conjunto fijo de aldeano.
export const CAPES = ['Sin capa', 'Capa corta', 'Capa de mago', 'Capa noble', 'Capa de piel'];
export const HAIR_ACCS = ['Ninguno', 'Flor', 'Lazo', 'Horquilla de estrella', 'Corona de flores', 'Pasador metálico', 'Broche rúnico', 'Pasador de hojas', 'Luna creciente', 'Diadema de cuentas'];
export const HAIR_ACC_VALUES = [0, 1, 2, 3, 4, 7, 8, 9, 10, 11];
export const ACCS = ACCESSORIES;
export const MAKEUPS = ['Ninguno', 'Pestañas', 'Sombra de ojos', 'Labios', 'Sombra y labios', 'Brillitos', 'Rabillo gatuno', 'Polvo de hadas', 'Delineado de bosque', 'Rubor de pétalo'];
export const ACC_COLORS = ['#e8b84a', '#c8ccd4', '#f08aa8', '#d0404a', '#4a7ad8', '#4aa86a', '#f4f0e6', '#9a6ad0', '#3a3036', '#b97850', '#6a8e78', '#729da4', '#caa4a1'];
export const ACC_COLOR_NAMES = ['Oro', 'Plata', 'Rosa', 'Rojo', 'Azul', 'Verde', 'Blanco', 'Lila', 'Negro', 'Cobre', 'Salvia', 'Bruma', 'Pétalo'];

export function randomName(race: Race, r = Math.random) {
  const [a, b] = RACES[race].names;
  return a[Math.floor(r() * a.length)] + b[Math.floor(r() * b.length)];
}

export function defaultChar(): CharData {
  return {
    introSeen: false, welcome: null, shadowQuest: null, isbertoPosition: null, skillRanks: {}, coinBags: [], fairyDust: [], fairyDustQuest: null, rpg: undefined, enchantState: undefined, partyPeers: 0, potionReadyAt: undefined, combatVisual: undefined, wilderness: undefined,
    name: '', title: DEFAULT_TITLE, level: 1, experience: 0, health: -1, overheal: 0, resource: -1, foodBuff: null, foodRevision: 0, wallet: emptyWallet(), inventory: emptyInventory(), equipment: emptyEquipment(), location: 'brumaluz', position: null, race: 'humano', attributePoints: noBonuses(), creationPoints: ATTRIBUTE_POINTS_AVAILABLE, sex: 0, height: 0.5, build: 0.5, skin: 1, face: 3,
    hair: 2, hairColor: 2, beard: 0, eyeShape: 7, eyeColor: 1, brows: 2, nose: 0, mouth: 0, detail: 0,
    trait: 0, cls: 'guerrero', primary: 0, secondary: 4,
    cape: 0, clothA: 7, clothB: 5, hairAcc: 0, hairAccColor: 0, acc: 0, makeup: 0, makeupColor: 2, accColor: 0,
  };
}

/** Repara datos guardados de versiones anteriores. */
export function sanitize(d: Record<string, unknown>): CharData {
  const out = { ...defaultChar(), ...d } as CharData;
  if (!isTitleId(out.title)) out.title = DEFAULT_TITLE;
  const level = Number(out.level);
  const experience = Number(out.experience);
  out.level = Number.isSafeInteger(level) ? Math.min(Math.max(level, 1), MAX_LEVEL) : 1;
  out.partyPeers = Number.isInteger(d.partyPeers) ? Math.min(Math.max(Number(d.partyPeers),0),3) : 0;
  out.experience = Number.isSafeInteger(experience) ? Math.max(experience, 0) : 0;
  out.health = Number.isFinite(Number(out.health)) ? Math.max(Math.round(Number(out.health)), -1) : -1;
  out.overheal = Number.isFinite(Number(out.overheal)) ? Math.max(Math.round(Number(out.overheal)), 0) : 0;
  out.resource = Number.isFinite(Number(out.resource)) ? Math.max(Math.round(Number(out.resource)), -1) : -1;
  out.foodBuff = parseFoodBuff(d.foodBuff);
  out.welcome = parseWelcome(d.welcome);
  out.introSeen = d.introSeen === true;
  out.shadowQuest = parseShadowQuest(d.shadowQuest);
  const isberto = d.isbertoPosition as { x?: unknown; z?: unknown } | null | undefined;
  if (isberto != null && (typeof isberto.x !== 'number' || !Number.isFinite(isberto.x) || typeof isberto.z !== 'number' || !Number.isFinite(isberto.z)))
    throw new Error('Posición de Isberto no válida.');
  out.isbertoPosition = isberto ? { x: Number(isberto.x), z: Number(isberto.z) } : null;
  out.coinBags = Array.isArray(d.coinBags) ? [...new Set(d.coinBags.filter(isCoinBagId))] : [];
  out.fairyDust = Array.isArray(d.fairyDust) ? [...new Set(d.fairyDust.filter(isFairyDustId))] : [];
  out.fairyDustQuest = parseFairyDustQuest(d.fairyDustQuest);
  out.foodRevision = Number.isSafeInteger(d.foodRevision) && Number(d.foodRevision) >= 0 ? Number(d.foodRevision) : 0;
  out.wallet = sanitizeWallet(d.wallet, d.gold);
  delete (out as unknown as Record<string, unknown>).gold;
  out.inventory = sanitizeInventory(out.inventory);
  out.equipment = sanitizeEquipment(out.equipment);
  out.rpg = d.rpg && typeof d.rpg==='object' ? professionState(d.rpg) : undefined;
  out.enchantState = d.enchantState && typeof d.enchantState === 'object' ? d.enchantState as CharData['enchantState'] : undefined;
  if (typeof out.location !== 'string' || !LOCATION_ID.test(out.location)) out.location = 'brumaluz';
  const pos = d.position as Partial<NonNullable<CharData['position']>> | null | undefined;
  out.position = pos && [pos.x, pos.z, pos.yaw].every((n) => typeof n === 'number' && Number.isFinite(n))
    ? { x: pos.x!, z: pos.z!, yaw: pos.yaw! }
    : null;
  if (!Object.prototype.hasOwnProperty.call(RACES, out.race)) out.race = 'humano';
  if (!Object.prototype.hasOwnProperty.call(CLASSES, out.cls)) out.cls = 'guerrero';
  const rank = skillRank(out);
  out.skillRanks = rank > 1 ? { [COMBAT_KITS[out.cls].skill.id]: rank } : {};
  if (out.sex !== 0 && out.sex !== 1) out.sex = 0;
  const R = RACES[out.race];
  const rawPoints = d.attributePoints && typeof d.attributePoints === 'object'
    ? d.attributePoints as Record<string, unknown>
    : {};
  if (Number.isInteger(d.creationPoints)) out.creationPoints = Math.min(Math.max(d.creationPoints as number, 0), ATTRIBUTE_POINTS_AVAILABLE);
  else {
    const spent = Object.values(rawPoints).reduce<number>((sum, v) => sum + (Number.isFinite(Number(v)) ? Math.max(Math.floor(Number(v)), 0) : 0), 0);
    out.creationPoints = Math.min(spent, ATTRIBUTE_POINTS_AVAILABLE);
  }
  let remainingPoints = attributePointsAllowed(out.level, out.creationPoints);
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
  out.cape = 0;
  out.clothA = clamp(out.clothA, CLOTH.length);
  out.clothB = clamp(out.clothB, CLOTH.length);
  const hairAcc = Number(out.hairAcc);
  out.hairAcc = HAIR_ACC_VALUES.includes(hairAcc) ? hairAcc : 0;
  out.hairAccColor = clamp(out.hairAccColor, ACC_COLORS.length);
  out.acc = clamp(out.acc, ACCS.length);
  out.makeup = clamp(out.makeup, MAKEUPS.length);
  out.makeupColor = clamp(out.makeupColor, ACC_COLORS.length);
  out.accColor = clamp(out.accColor, ACC_COLORS.length);
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
    welcome: null, introSeen: false, shadowQuest: null, isbertoPosition: null, skillRanks: {}, coinBags: [], fairyDust: [], fairyDustQuest: null,
    name: randomName(race), title: DEFAULT_TITLE, level: 1, experience: 0, health: -1, overheal: 0, resource: -1, foodBuff: null, foodRevision: 0, wallet: emptyWallet(), inventory: emptyInventory(), equipment: emptyEquipment(), location: 'brumaluz', position: null, race, attributePoints: noBonuses(), creationPoints: ATTRIBUTE_POINTS_AVAILABLE, sex,
    height: Math.random(), build: Math.random(),
    skin: rnd(R.skins.length), face: sex ? rnd(3) : [1, 2, 3][rnd(3)],
    hair: rnd(HAIR_STYLES.length), hairColor: rnd(HAIR_COLORS.length),
    beard: sex ? 0 : rnd(BEARDS.length), eyeShape: rnd(EYE_SHAPES.length), eyeColor: rnd(EYE_COLORS.length),
    brows: rnd(BROWS.length), nose: rnd(NOSES.length), mouth: rnd(MOUTHS.length), detail: Math.random() < 0.5 ? 0 : rnd(DETAILS.length),
    trait: rnd(Math.max(R.traits.length, 1)),
    cls, primary: rnd(CLOTH.length), secondary: rnd(CLOTH.length),
    cape: 0,
    clothA: rnd(CLOTH.length), clothB: rnd(CLOTH.length),
    hairAcc: Math.random() < 0.5 ? 0 : HAIR_ACC_VALUES[rnd(HAIR_ACC_VALUES.length)], hairAccColor: rnd(ACC_COLORS.length), acc: Math.random() < 0.6 ? 0 : rnd(ACCS.length),
    makeup: sex ? 1 + (Math.random() < 0.5 ? 0 : rnd(MAKEUPS.length - 1)) : 0, makeupColor: rnd(ACC_COLORS.length), accColor: rnd(ACC_COLORS.length),
  };
}
