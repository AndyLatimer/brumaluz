import rules from './shadowCombat.json';
export const SHADOW_COMBAT = rules;
export type ShadowAttack='area'|'bolt'|'melee';
export function shadowAttack(distance:number,_sequence:number):ShadowAttack{return distance<=rules.meleeRange?'melee':'bolt';}
export function shadowWindup(attack:ShadowAttack){return attack==='area'?rules.windup:attack==='bolt'?rules.boltWindup:rules.meleeWindup;}
