import catalog from './generated/rpg-catalog.json';
export const FOOD_EFFECTS:Record<string,{duration:number;maxHealth:number;maxResource:number}> = {
  pan_duro: { duration: 900, maxHealth: 5, maxResource: 3 },
  ...Object.fromEntries(Object.values(catalog.items as Record<string,{id:string;foodEffect?:{duration:number;maxHealth:number;maxResource:number}}>).filter(i=>i.foodEffect).map(i=>[i.id,i.foodEffect!])),
};

export type FoodId = keyof typeof FOOD_EFFECTS;
export interface FoodBuff {
  itemId: FoodId;
  remaining: number;
}

export function parseFoodBuff(value: unknown): FoodBuff | null {
  if (!value || typeof value !== 'object') return null;
  const buff = value as Record<string, unknown>;
  if (typeof buff.itemId!=='string'||!Object.prototype.hasOwnProperty.call(FOOD_EFFECTS,buff.itemId) || typeof buff.remaining !== 'number' || !Number.isFinite(buff.remaining) || buff.remaining <= 0) return null;
  return { itemId: buff.itemId, remaining: Math.min(buff.remaining, FOOD_EFFECTS[buff.itemId].duration) };
}

export const foodEffect = (buff: FoodBuff | null) => buff && buff.remaining > 0 ? FOOD_EFFECTS[buff.itemId] : null;
