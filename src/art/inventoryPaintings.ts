import type {EquipmentSlot} from '../data/inventory';
import type {ResourceFamily} from '../data/resourceAppearance';
const files=import.meta.glob<string>('../assets/icons/inventory-painted/*.webp',{eager:true,query:'?url',import:'default'});
const portraits=Object.fromEntries(Object.entries(files).map(([path,url])=>[path.split('/').at(-1)!.slice(0,-5),url]));
const drawing=(key:string)=>portraits[key]?`<image href="${portraits[key]}" x=".4" y=".4" width="23.2" height="23.2" preserveAspectRatio="xMidYMid meet"/>`:undefined;
export const resourcePainting=(family:ResourceFamily,tier=0)=>drawing(`${family}-${Math.max(0,Math.min(5,tier))}`);
export const equipmentSlotPainting=(slot:EquipmentSlot)=>drawing(slot);
export const gatheringToolPainting=(kind:'pickaxe'|'axe'|'sickle')=>drawing(kind);
export const craftingComponentPainting=(jobOrId:string)=>{
 const norm=jobOrId.replace(/^componente_/,'').replace(/_\d+$/,'').replace(/_/g,'-');
 return drawing(`componente-${norm}`)??drawing(norm);
};
export const potionPainting=(kind:'health'|'mana'|'stamina',tier=0)=>
 drawing(`potion-${kind}-${Math.max(0,Math.min(5,tier))}`)??drawing(`potion-${kind}`);
export const scrollPainting=(enchant:string,tier=1)=>
 drawing(`scroll-${enchant}-${Math.max(1,Math.min(5,tier))}`)??drawing(`scroll-${enchant}`);
export const furniturePainting=(kind:string,tier=0)=>
 drawing(`mueble-${kind}-${Math.max(0,Math.min(5,tier))}`)??drawing(`mueble-${kind}`);
export const foodPainting=(idOrKind:string,tier=0)=>{
 if(idOrKind==='pan_duro'||idOrKind==='pan-duro')return drawing('pan-duro')??drawing('comida-0')??drawing('comida');
 return drawing(`comida-${Math.max(0,Math.min(5,tier))}`)??drawing('comida');
};



