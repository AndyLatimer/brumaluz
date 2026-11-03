import raw from './homes.json';
import furnishings from './homeFurnishings.json';
import type {CharData} from './data';
import type {ItemStack} from './inventory';

export interface HomeDefinition {id:string;label:string;location:string;description:string;limit:number;bounds:{minX:number;maxX:number;minZ:number;maxZ:number};reserved:HomeDefinition['bounds'][];bed:{x:number;z:number;radius:number};chest:{x:number;z:number;radius:number};entrance:{location:string;x:number;z:number;radius:number};cityEntrance:{location:string;x:number;z:number};exit:{x:number;z:number;targetX:number;targetZ:number};purchase?:{price:number;projects:string[]}}
export const HOME_CATALOG:{starter:string;homes:Record<string,HomeDefinition>}=raw;
export const STARTER_HOME=HOME_CATALOG.homes.lucero;
export const NEXT_HOME=HOME_CATALOG.homes.olmo;
export const homeAt=(location:string)=>Object.values(HOME_CATALOG.homes).find(h=>h.location===location);
export const HOME_FURNISHINGS:Record<string,{label:string;width:number;depth:number;size:number;complexity:number;height:number;passable?:boolean;seat?:number;storage?:boolean;light?:boolean}>=furnishings;
export interface HomeState {owned:string[];primary:string;access:'private'|'party';visit?:string|null;visitHome?:string;settled?:boolean}
export interface PlacedFurniture {id:string;item:ItemStack;location:string;x:number;z:number;yaw:number;job?:string;lit?:boolean}
export interface HomeView {owner:string;name:string;guest:boolean;allowed:boolean;access:'private'|'party';furniture:PlacedFurniture[]}
export const homeState=(value:HomeState|undefined):HomeState=>{const owned=[...new Set([raw.starter,...(value?.owned??[]).filter(id=>id in HOME_CATALOG.homes)])];return{owned,primary:value?.primary&&owned.includes(value.primary)?value.primary:raw.starter,access:value?.access==='party'?'party':'private',visit:value?.visit??null,visitHome:value?.visitHome,settled:value?.settled===true};};
export const hasSettled=(state:CharData['rpg'])=>!!state?.homes?.settled||!!state?.furniture?.some(p=>p.location===STARTER_HOME.location);
export function furnitureBounds(kind:string,x:number,z:number,yaw:number){
 const def=HOME_FURNISHINGS[kind]??HOME_FURNISHINGS.mesa,c=Math.abs(Math.cos(yaw)),s=Math.abs(Math.sin(yaw));
 const hx=(c*def.width+s*def.depth)/2,hz=(s*def.width+c*def.depth)/2;
 return {minX:x-hx,maxX:x+hx,minZ:z-hz,maxZ:z+hz};
}
export const boxesOverlap=(a:ReturnType<typeof furnitureBounds>,b:ReturnType<typeof furnitureBounds>)=>a.minX<b.maxX-.015&&a.maxX>b.minX+.015&&a.minZ<b.maxZ-.015&&a.maxZ>b.minZ+.015;
export function placementError(kind:string,x:number,z:number,yaw:number,pieces:PlacedFurniture[],kindOf:(id:string)=>string,exclude='',home=STARTER_HOME){
 if(!HOME_FURNISHINGS[kind]||![x,z,yaw].every(Number.isFinite))return 'Elige un mueble y una posición válida.';
 const box=furnitureBounds(kind,x,z,yaw),bounds=home.bounds;
 if(box.minX<bounds.minX||box.maxX>bounds.maxX||box.minZ<bounds.minZ||box.maxZ>bounds.maxZ)return 'El mueble debe quedar dentro de la habitación.';
 if(home.reserved.some(area=>boxesOverlap(box,area)))return 'Deja libres la puerta, la cama y el cofre.';
 const def=HOME_FURNISHINGS[kind];
 if(pieces.some(p=>p.id!==exclude&&p.location===home.location&&!!HOME_FURNISHINGS[kindOf(p.item.id)]?.passable===!!def.passable&&boxesOverlap(box,furnitureBounds(kindOf(p.item.id),p.x,p.z,p.yaw))))return 'Ese espacio ya está ocupado.';
 return '';
}
/** Only public furniture is kept here; private inventories never enter the visit view. */
let visiting:HomeView|null=null;
export const setHomeView=(value:HomeView|null)=>{visiting=value;};
export const currentHomeView=()=>visiting;
export function visibleFurniture(state:CharData['rpg'],location:string){
 if(homeAt(location)&&state?.homes?.visit)return visiting?.allowed&&visiting.owner===state.homes.visit?visiting.furniture:[];
 return state?.furniture??[];
}
