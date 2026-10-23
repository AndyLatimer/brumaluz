import type { ClassId } from './data';
import type { EquipmentSlot } from './inventory';
import type { WeaponDef } from './weapons';

type Text = readonly [es: string, en: string];
export const EQUIPMENT_COLLECTIONS: Record<string, string> = {
  novicio: 'Principiante', artesano: 'Caminante', ambar: 'Ámbar', violeta: 'Sello Violeta',
  aurora: 'Aurora', fuego: 'Fuego Primigenio', alba: 'Guardia del Alba', eclipse: 'Eclipse',
  roble: 'Roble Errante', marea: 'Marea Real', forja: 'Forja Estelar',
};
const collectionDetails: Record<string, Text> = {
  novicio: ['Acabado sencillo, sin ribetes de colección.', 'A simple finish without collection trim.'],
  artesano: ['Detalles verdes y remates de tonos cálidos.', 'Green details and warm-toned fittings.'],
  ambar: ['Tonos de bosque y detalles de ámbar.', 'Forest tones and amber details.'],
  violeta: ['Adornos violetas y motivos rúnicos.', 'Violet ornaments and runic motifs.'],
  aurora: ['Acabado claro con remates dorados.', 'A pale finish with golden trim.'],
  fuego: ['Detalles anaranjados y remates de tonos cálidos.', 'Orange details and warm-toned fittings.'],
  alba: ['Tonos claros y detalles azul celeste.', 'Light tones and sky-blue details.'],
  eclipse: ['Tonos oscuros y adornos de inspiración lunar.', 'Dark tones and lunar ornaments.'],
  roble: ['Tonos de bosque y motivos vegetales.', 'Forest tones and botanical motifs.'],
  marea: ['Formas y adornos inspirados en el mar.', 'Shapes and ornaments inspired by the sea.'],
  forja: ['Acabados oscuros y motivos astrales.', 'Dark finishes and astral motifs.'],
};
const weaponProfiles: Record<WeaponDef['kind'] | 'parryingDagger', Text> = {
  sword: ['Hoja de una mano con guarda y empuñadura revestida.', 'A one-handed blade with a guard and wrapped grip.'],
  shield: ['Escudo con borde reforzado y sujeción para el antebrazo.', 'A shield with a reinforced rim and forearm grip.'],
  staff: ['Bastón largo rematado por un foco de canalización.', 'A long staff topped with a channelling focus.'],
  dagger: ['Hoja corta de una mano con punta marcada y guarda compacta.', 'A short one-handed blade with a pronounced tip and compact guard.'],
  parryingDagger: ['Daga de apoyo para la mano secundaria, con una guarda compacta.', 'An off-hand supporting dagger with a compact guard.'],
  wand: ['Varita rematada por un pequeño foco de canalización.', 'A wand topped with a small channelling focus.'],
  book: ['Volumen de tapas rígidas, lomo reforzado y cierre ornamental.', 'A hardbound volume with a reinforced spine and ornamental clasp.'],
  crossbow: ['Ballesta de cuerpo corto, brazos transversales y culata de apoyo.', 'A compact crossbow with transverse limbs and a supporting stock.'],
};
const commonArmor: Partial<Record<EquipmentSlot, Text>> = {
  hands: ['Guantes de cuero con puños ajustados y refuerzo en el antebrazo.', 'Leather gloves with fitted cuffs and forearm reinforcement.'],
  legs: ['Calzas entalladas y botas de cuero con suela gruesa, equipadas como una sola pieza.', 'Fitted trousers and thick-soled leather boots, equipped as a single piece.'],
};
const headProfiles: Record<ClassId | 'warriorCloth' | 'warriorLeather' | 'clericCoif', Text> = {
  guerrero: ['Casco abierto con visera frontal, borde enrollado y protección de nuca.', 'An open helmet with a brow visor, rolled rim and nape protection.'],
  warriorCloth: ['Cofia acolchada que cubre los lados de la cabeza y la nuca.', 'A padded coif covering the sides of the head and nape.'],
  warriorLeather: ['Casco de cuero con frente saliente y protección de nuca.', 'A leather helmet with a projecting brow and nape protection.'],
  mago: ['Sombrero de ala ondulada, banda de cuero y copa curvada.', 'A hat with a wavy brim, leather band and curved crown.'],
  picaro: ['Capucha profunda con marco vuelto alrededor del rostro y forro oscuro.', 'A deep hood with a turned face opening and dark lining.'],
  clerigo: ['Mitra de hojas curvas con banda tejida y remate frontal.', 'A curved-leaf mitre with a woven band and frontal trim.'],
  clericCoif: ['Cofia de tela clara con copa blanda y banda doblada.', 'A pale cloth coif with a soft crown and folded band.'],
  explorador: ['Gorro de bosque de copa inclinada y ala vuelta.', 'A woodland cap with a sloping crown and upturned brim.'],
};
const chestProfiles: Record<ClassId | 'warriorCloth' | 'warriorLeather', Text> = {
  guerrero: ['Peto curvo sobre un jubón, con hombreras arqueadas y faldones abiertos.', 'A curved breastplate over a doublet, with arched pauldrons and split skirts.'],
  warriorCloth: ['Jubón acolchado con refuerzos en los hombros y cinturón de cuero.', 'A padded doublet with shoulder reinforcements and a leather belt.'],
  warriorLeather: ['Jubón con peto de cuero, hombreras y faldones abiertos.', 'A doublet with a leather breastpiece, shoulder guards and split skirts.'],
  mago: ['Túnica con cuello de chal, botones y faldones separados.', 'A robe with a shawl collar, buttons and separate skirt panels.'],
  picaro: ['Jubón de cintura estrecha, pañuelo asimétrico y faldón corto.', 'A narrow-waisted doublet with an asymmetric scarf and short skirt.'],
  clerigo: ['Vestidura larga con manto de hombros y estolas cosidas al frente.', 'A long vestment with a shoulder mantle and sewn front stoles.'],
  explorador: ['Chaleco abierto sobre una túnica, con solapas dobladas y bolsillo de pecho.', 'An open vest over a tunic, with folded lapels and a breast pocket.'],
};
const accessoryProfiles: Record<'pendant' | 'ring' | 'trinket', Text> = {
  pendant: ['Colgante con medallón central y cadena fina.', 'A pendant with a central medallion and fine chain.'],
  ring: ['Anillo de aro ancho con un motivo central trabajado.', 'A broad-band ring with a worked central motif.'],
  trinket: ['Pequeño adorno de cinturón con montura y remates metálicos.', 'A small belt ornament with a mount and metal fittings.'],
};

function describe(profile: Text, collection?: string) {
  return [profile[0], collection && collectionDetails[collection]?.[0]].filter(Boolean).join(' ');
}
export function weaponCollection(id: string, weapon: WeaponDef) {
  return id.endsWith('_inicial') ? 'novicio' : ['novicio','artesano','ambar','violeta','aurora','fuego'][weapon.tier];
}
export function describeWeapon(weapon: WeaponDef, collection: string) {
  return describe(weaponProfiles[weapon.kind === 'dagger' && weapon.slot === 'offhand' ? 'parryingDagger' : weapon.kind], collection);
}
function armorProfile(cls: ClassId, slot: EquipmentSlot, tier: number): Text {
  const profile = cls === 'guerrero' && tier < 2 ? tier === 0 ? 'warriorCloth' : 'warriorLeather' : cls;
  if (slot === 'head') return headProfiles[cls === 'clerigo' && tier < 2 ? 'clericCoif' : profile];
  if (slot === 'chest') return chestProfiles[profile];
  return commonArmor[slot] ?? commonArmor.legs!;
}
export const describeArmor = (cls: ClassId, slot: EquipmentSlot, tier: number, collection: string) => describe(armorProfile(cls, slot, tier), collection);
export const describeAccessory = (slot: 'pendant' | 'ring' | 'trinket', collection: string) => describe(accessoryProfiles[slot], collection);

// Translate the same authored fragments used by the catalogue, without storing
// hundreds of manually duplicated combined sentences in translations.ts.
const profiles = [...Object.values(weaponProfiles), ...Object.values(commonArmor), ...Object.values(headProfiles), ...Object.values(chestProfiles), ...Object.values(accessoryProfiles)] as Text[];
export const ITEM_DESCRIPTION_TRANSLATIONS: Record<string, string> = Object.fromEntries(profiles.flatMap(profile => [
  [profile[0], profile[1]],
  ...Object.values(collectionDetails).map(detail => [`${profile[0]} ${detail[0]}`, `${profile[1]} ${detail[1]}`]),
]));
