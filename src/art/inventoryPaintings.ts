import type {EquipmentSlot} from '../data/inventory';
import type {ResourceFamily} from '../data/resourceAppearance';
const files=import.meta.glob<string>('../assets/icons/inventory-painted/*.webp',{eager:true,query:'?url',import:'default'});
const portraits=Object.fromEntries(Object.entries(files).map(([path,url])=>[path.split('/').at(-1)!.slice(0,-5),url]));
const drawing=(key:string)=>portraits[key]?`<image href="${portraits[key]}" x=".4" y=".4" width="23.2" height="23.2" preserveAspectRatio="xMidYMid meet"/>`:undefined;
export const resourcePainting=(family:ResourceFamily,tier=0)=>drawing(`${family}-${Math.max(0,Math.min(5,tier))}`);
export const equipmentSlotPainting=(slot:EquipmentSlot)=>drawing(slot);
export const gatheringToolPainting=(kind:'pickaxe'|'axe'|'sickle')=>drawing(kind);
