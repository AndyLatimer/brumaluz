import rules from './shadowCombat.json';
export const SHADOW_COMBAT = rules;
export type ShadowAttack='area'|'bolt'|'melee';
export function shadowAttack(distance:number,sequence:number):ShadowAttack{return sequence%3===0?'area':distance<=rules.meleeRange?'melee':'bolt';}
export function shadowWindup(attack:ShadowAttack){return attack==='area'?rules.windup:attack==='bolt'?rules.boltWindup:rules.meleeWindup;}
