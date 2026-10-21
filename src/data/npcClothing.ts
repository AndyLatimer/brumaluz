import type { HeadOptions } from '../character/head';

export const NPC_CLOTHING_SLOTS = {
  torso: 'Torso', leftArm: 'Brazo izquierdo', rightArm: 'Brazo derecho',
  leftLeg: 'Pierna izquierda', rightLeg: 'Pierna derecha',
  overlay: 'Sobrerropa', footwear: 'Calzado adicional', head: 'Sombrero',
  cape: 'Capa', back: 'Complemento de espalda',
} as const;
export type NpcClothingSlot = keyof typeof NPC_CLOTHING_SLOTS;
export type ClothingSource = 'Mage' | 'Knight' | 'Rogue' | 'Barbarian' | 'Ranger' | 'Rogue_Hooded' | 'helpers' | 'medieval';
export interface ClothingPiece {
  id: string;
  label: string;
  slot: NpcClothingSlot;
  source: ClothingSource;
  nodes: readonly string[];
  hairFit?: HeadOptions['hat'];
}
export interface ClothingSelection { piece: string; primary: number; secondary: number }
export type NpcClothing = Record<NpcClothingSlot, ClothingSelection>;
export const REQUIRED_CLOTHING_SLOTS: readonly NpcClothingSlot[] = ['torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
const bodyParts = { torso: 'Body', leftArm: 'ArmLeft', rightArm: 'ArmRight', leftLeg: 'LegLeft', rightLeg: 'LegRight' } as const;
const kits = [
  ['Mage', 'Mago', 'Mage'], ['Knight', 'Caballero', 'Knight'], ['Rogue', 'Viajero', 'Rogue'],
  ['Barbarian', 'Bárbaro', 'Barbarian'], ['Ranger', 'Explorador', 'Ranger'], ['Rogue_Hooded', 'Viajero encapuchado', 'RogueHooded'],
] as const;

/** Stable piece IDs are persisted; adding compatible entries also adds them to the editor. */
export const NPC_CLOTHING: readonly ClothingPiece[] = [
  ...kits.flatMap(([source, label, prefix]) => Object.entries(bodyParts).map(([slot, part]) => ({
    id: `${source}.${slot}`, label, slot: slot as NpcClothingSlot, source, nodes: [`${prefix}_${part}`],
  }))),
  ...kits.map(([source, label, prefix]) => ({ id: `${source}.cape`, label, slot: 'cape' as const, source, nodes: [`${prefix}_Cape`] })),
  { id: 'Mage.head', label: 'Sombrero de mago', slot: 'head', source: 'Mage', nodes: ['Mage_Hat'], hairFit: 'wizard' },
  { id: 'Knight.head', label: 'Casco de caballero', slot: 'head', source: 'Knight', nodes: ['Knight_Helmet'], hairFit: 'helmet' },
  { id: 'Barbarian.head', label: 'Gorro de piel', slot: 'head', source: 'Barbarian', nodes: ['Barbarian_Hat'], hairFit: 'bear' },
  { id: 'Ranger.back', label: 'Carcaj de explorador', slot: 'back', source: 'Ranger', nodes: ['Ranger_Quiver'] },
  { id: 'helpers.torso', label: 'Camisa de Ayudantes', slot: 'torso', source: 'helpers', nodes: ['helpers-shirt'] },
  { id: 'helpers.leftArm', label: 'Manga de Ayudantes', slot: 'leftArm', source: 'helpers', nodes: ['helpers-sleeve-l', 'anatomy-hand-left'] },
  { id: 'helpers.rightArm', label: 'Manga de Ayudantes', slot: 'rightArm', source: 'helpers', nodes: ['helpers-sleeve-r', 'anatomy-hand-right'] },
  { id: 'helpers.leftLeg', label: 'Pantalón de Ayudantes', slot: 'leftLeg', source: 'helpers', nodes: ['helpers-trouser-l'] },
  { id: 'helpers.rightLeg', label: 'Pantalón de Ayudantes', slot: 'rightLeg', source: 'helpers', nodes: ['helpers-trouser-r'] },
  { id: 'helpers.overlay', label: 'Peto de Ayudantes', slot: 'overlay', source: 'helpers', nodes: ['helpers-overalls'] },
  { id: 'helpers.footwear', label: 'Botas de Ayudantes', slot: 'footwear', source: 'helpers', nodes: ['helpers-boot-l', 'helpers-boot-r'] },
  { id: 'helpers.head', label: 'Gorra de Ayudantes', slot: 'head', source: 'helpers', nodes: ['helpers-soft-cap'], hairFit: 'cap' },
  { id: 'medieval.torso', label: 'Túnica medieval', slot: 'torso', source: 'medieval', nodes: ['medieval-tunic'] },
  { id: 'medieval.leftArm', label: 'Manga medieval (izq)', slot: 'leftArm', source: 'medieval', nodes: ['medieval-sleeve-l', 'anatomy-hand-left'] },
  { id: 'medieval.rightArm', label: 'Manga medieval (der)', slot: 'rightArm', source: 'medieval', nodes: ['medieval-sleeve-r', 'anatomy-hand-right'] },
  { id: 'medieval.leftLeg', label: 'Calzas medievales (izq)', slot: 'leftLeg', source: 'medieval', nodes: ['medieval-trouser-l'] },
  { id: 'medieval.rightLeg', label: 'Calzas medievales (der)', slot: 'rightLeg', source: 'medieval', nodes: ['medieval-trouser-r'] },
  { id: 'medieval.footwear', label: 'Botines medievales', slot: 'footwear', source: 'medieval', nodes: ['medieval-boot-l', 'medieval-boot-r'] },
  { id: 'medieval.head', label: 'Gorro medieval con pluma', slot: 'head', source: 'medieval', nodes: ['medieval-hat'], hairFit: 'cap' },
];
export function clothingPiece(id: string) {
  const piece = NPC_CLOTHING.find(piece => piece.id === id);
  if (!piece) throw new Error(`Pieza de ropa desconocida: ${id}.`);
  return piece;
}
export function defaultNpcClothing(source: ClothingSource = 'Rogue', primary = 7, secondary = 5): NpcClothing {
  return Object.fromEntries(Object.keys(NPC_CLOTHING_SLOTS).map(slot => [
    slot, { piece: REQUIRED_CLOTHING_SLOTS.includes(slot as NpcClothingSlot) ? `${source}.${slot}` : '', primary, secondary },
  ])) as NpcClothing;
}
