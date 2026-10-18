export const FOOD_EFFECTS = {
  pan_duro: { duration: 900, maxHealth: 5, maxResource: 3 },
};

export type FoodId = keyof typeof FOOD_EFFECTS;
export interface FoodBuff {
  itemId: FoodId;
  remaining: number;
}

export function parseFoodBuff(value: unknown): FoodBuff | null {
  if (!value || typeof value !== 'object') return null;
  const buff = value as Record<string, unknown>;
  if (buff.itemId !== 'pan_duro' || typeof buff.remaining !== 'number' || !Number.isFinite(buff.remaining) || buff.remaining <= 0) return null;
  return { itemId: buff.itemId, remaining: Math.min(buff.remaining, FOOD_EFFECTS[buff.itemId].duration) };
}

export const foodEffect = (buff: FoodBuff | null) => buff && buff.remaining > 0 ? FOOD_EFFECTS[buff.itemId] : null;
