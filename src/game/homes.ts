import {session,play,ui} from './state';
import {STARTER_HOME,HOME_CATALOG,homeAt,setHomeView,homeState,type HomeView} from '../data/homes';
import type {NeighborhoodProject} from '../data/neighborhood';
import {mealMenu,type MealRecipe} from '../data/sharedMeals';
import {getCozyView} from '../services/account';
import {performProfession} from './professions';
import {personalWaypoints} from '../ui/gameInterface';
import {setWindow} from '../ui/menus';
import {travelPortal} from './cities';
import {refreshProfessionWorld} from '../world/professionWorld';
import {holder} from './stage';
import {toast} from '../ui/toast';
let projects:NeighborhoodProject[]=[],pending=false,signature='',owner='';
let refreshing:Promise<void>|null=null;
let menu:MealRecipe[]=[];
let canChoose=true;
export const cozyProjects=()=>projects;
export const cozyMenu=()=>menu;
export const cozyCanChoose=()=>canChoose;
export function locateHome(id=homeState(session.state.rpg?.homes).primary){
 const home=HOME_CATALOG.homes[id]??STARTER_HOME;
 const target=session.state.location===home.entrance.location?home.entrance:home.cityEntrance;
 personalWaypoints.set(target.location,{x:target.x,z:target.z});setWindow('map');
 if(session.state.location!==target.location)toast('Mi vivienda',home.id==='lucero'?'La posada está en Brumaluz. La entrada a tu habitación está dentro.':'La Casa del Olmo está en el Barrio del Olmo, en Brumaluz.');
}
export function locateCozyTarget(site:{location:string;x:number;z:number}){personalWaypoints.set(site.location,{x:site.x,z:site.z});setWindow('map');}
export async function visitHome(characterId:string,id='lucero'){
 const home=HOME_CATALOG.homes[id],portal=play.city.portals.find(p=>p.target?.map===home.location);
 if(!portal||Math.hypot(portal.position.x-holder.position.x,portal.position.z-holder.position.z)>home.entrance.radius){toast('Visitas','Acércate a la entrada de la vivienda que quieres visitar.',true);return;}
 if(!await performProfession('home_visit',{owner:characterId,home:id}))return;
 setWindow(null);await travelPortal(portal,true);await refreshCozyView();
}
export async function leaveHomeVisit(){
 if(await performProfession('home_leave_visit'))toast('Visita terminada','La visita ha terminado.');
}
export function refreshCozyView():Promise<void>{
 if(!refreshing)refreshing=fetchCozyView().finally(()=>{refreshing=null;});
 return refreshing;
}
async function fetchCozyView(){
 if(pending||play.mode!=='play')return;
 const id=session.activeCharacterId,key=id??`${session.state.name}:${session.state.race}:${session.state.cls}`,generation=play.playGeneration;
 if(owner!==key){owner=key;projects=[];menu=[];signature='';setHomeView(null);}
 if(!id){setHomeView(null);canChoose=true;projects=session.state.rpg?.neighborhood?.localMeals?.filter(p=>p.active&&!p.claimed&&(!p.expiresAt||p.expiresAt>Date.now()/1000))??[];menu=mealMenu(session.state);const next=JSON.stringify([projects,menu]);if(next!==signature&&ui.openWindow==='homes')setWindow('homes',false);signature=next;return;}
 pending=true;
 try{
  const value=await getCozyView(id);
  if(generation!==play.playGeneration||id!==session.activeCharacterId||play.mode!=='play')return;
  const view=value.home as HomeView|null;
  projects=Array.isArray(value.projects)?value.projects as NeighborhoodProject[]:[];
  menu=Array.isArray(value.menu)?value.menu as MealRecipe[]:[];
  canChoose=value.leader===true;
  setHomeView(view);
  if(view?.guest&&!view.allowed){
   setHomeView(null);await leaveHomeVisit();
  }
  refreshProfessionWorld(play.city,session.state.rpg);
  const next=JSON.stringify([view?.owner,view?.allowed,projects,menu,canChoose]);
  if(next!==signature&&ui.openWindow==='homes'&&!document.activeElement?.matches('input,select'))setWindow('homes',false);
  signature=next;
 }catch(error){
  // Do not keep showing another character's room after an unsuccessful validation.
  if(homeState(session.state.rpg?.homes).visit){setHomeView(null);refreshProfessionWorld(play.city,session.state.rpg);}
  console.warn('No se pudo consultar la vivienda.',error);
 }finally{pending=false;}
}
export function installHomes(){
 document.addEventListener('brumaluz-professions-update',()=>{refreshProfessionWorld(play.city,session.state.rpg);void refreshCozyView();});
 setInterval(()=>{if(play.mode!=='play'){if(owner){owner='';projects=[];signature='';setHomeView(null);}return;}if(!document.hidden&&!play.actionBusy&&(homeAt(play.city.locationId)||ui.openWindow==='homes'))void refreshCozyView();},2500);
}
