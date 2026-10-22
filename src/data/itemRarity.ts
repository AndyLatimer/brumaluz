export const ITEM_RARITIES = {
  common: { label: 'Común', color: '#a8afb8', ink: '#555b63', tier: 0 },
  uncommon: { label: 'Poco común', color: '#5bbd63', ink: '#286b30', tier: 1 },
  rare: { label: 'Raro', color: '#569de9', ink: '#245e9b', tier: 2 },
  epic: { label: 'Épico', color: '#b478e6', ink: '#77429e', tier: 3 },
  legendary: { label: 'Legendario', color: '#e5be4b', ink: '#86600c', tier: 4 },
  artifact: { label: 'Artefacto', color: '#ef8b39', ink: '#a34e17', tier: 5 },
} as const;

export type ItemRarity = keyof typeof ITEM_RARITIES;
export type WeaponTier = 0 | 1 | 2 | 3 | 4 | 5;
export const TIER_RARITIES: readonly ItemRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'artifact'];
export const rarityForTier = (tier: number): ItemRarity => TIER_RARITIES[tier] ?? 'common';
