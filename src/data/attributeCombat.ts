import type { CharData } from './data';
import { attributeTotal } from './stats';

// Secondary benefits start above the common base of five. Class primaries stay valuable.
const extra=(d:CharData,id:Parameters<typeof attributeTotal>[1])=>Math.max(0,attributeTotal(d,id)-5);
export const strengthPower=(d:CharData)=>1+.003*extra(d,'fuerza');
export const expertisePower=(d:CharData)=>1+.004*extra(d,'pericia');
export const intellectEfficiency=(d:CharData)=>Math.max(.75,1/(1+.004*extra(d,'intelecto')));
export const agilityTempo=(d:CharData)=>Math.max(.75,1/(1+.004*extra(d,'agilidad')));
export const perceptionGuard=(d:CharData)=>Math.max(.85,1/(1+.003*extra(d,'percepcion')));
