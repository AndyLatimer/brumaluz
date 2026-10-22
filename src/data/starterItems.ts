import { ADVANCED_WEAPONS } from './weaponProgression';
import { ORIGINAL_WEAPONS } from './uniqueWeapons';
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
  espada_cobre_t1: { kit: 'Knight', node: '1H_Sword' },
  escudo_roble_t1: { kit: 'Knight', node: 'Badge_Shield' },
  baston_ambar_t1: { kit: 'Mage', node: '2H_Staff' },
  daga_cazador_t1: { kit: 'Rogue', node: 'Knife' },
  daga_secundaria_cazador_t1: { kit: 'Rogue', node: 'Knife_Offhand' },
  varita_ambar_t1: { kit: 'Mage', node: '1H_Wand' },
  grimorio_verde_t1: { kit: 'Mage', node: 'Spellbook' },
  ballesta_roble_t1: { kit: 'Rogue', node: '1H_Crossbow' },
  espada_cobre_t2: { kit: 'Knight', node: '1H_Sword' },
  escudo_roble_t2: { kit: 'Knight', node: 'Badge_Shield' },
  baston_ambar_t2: { kit: 'Mage', node: '2H_Staff' },
  daga_cazador_t2: { kit: 'Rogue', node: 'Knife' },
  daga_secundaria_cazador_t2: { kit: 'Rogue', node: 'Knife_Offhand' },
  varita_ambar_t2: { kit: 'Mage', node: '1H_Wand' },
  grimorio_verde_t2: { kit: 'Mage', node: 'Spellbook' },
  ballesta_roble_t2: { kit: 'Rogue', node: '1H_Crossbow' },
};

for (const item of ADVANCED_WEAPONS) STARTER_MODELS[item.id] = STARTER_MODELS[item.starter];
for (const item of ORIGINAL_WEAPONS) STARTER_MODELS[item.id] = STARTER_MODELS[item.starter];
