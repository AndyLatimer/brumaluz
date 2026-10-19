export type WeaponKit = 'Mage' | 'Knight' | 'Rogue';
export const STARTER_MODELS: Record<string, { kit: WeaponKit; node: string }> = {
  espada_inicial: { kit: 'Knight', node: '1H_Sword' },
  escudo_inicial: { kit: 'Knight', node: 'Badge_Shield' },
  baston_inicial: { kit: 'Mage', node: '2H_Staff' },
  daga_inicial: { kit: 'Rogue', node: 'Knife' },
  daga_secundaria_inicial: { kit: 'Rogue', node: 'Knife_Offhand' },
  varita_inicial: { kit: 'Mage', node: '1H_Wand' },
  libro_inicial: { kit: 'Mage', node: 'Spellbook' },
  ballesta_inicial: { kit: 'Rogue', node: '1H_Crossbow' },
};
