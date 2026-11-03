import { professionAction, RPG_CATALOG, professionState, professionRank, gatherEnergy } from '../data/professions';
import { rpgAction } from '../services/account';
import { session,play,ui,fight } from './state';
import { holder } from './stage';
import { runOnServer } from './server';
import { updateHud } from './hud';
import { setWindow } from '../ui/menus';
import { updateProfessionEnergy } from '../ui/professionEnergy';
import { isInCombat } from '../data/combat';
import { gatheringFeedback } from './gatheringFeedback';
import { refreshProfessionWorld } from '../world/professionWorld';
import {testBank} from './inventory';

export async function performProfession(action:string,args:Record<string,unknown>={}) {
  const success=await runOnServer(id=>rpgAction(id,action,args,session.state.rpg?.revision??0),()=>{
    session.state.position={x:holder.position.x,z:holder.position.z,yaw:holder.rotation.y};
    professionAction(session.state,action,args,Date.now()/1000,testBank);
  });
  if(success&&action==='home_leave_visit'&&session.state.location!==play.city.locationId){const {switchGameMap,placeAfterTravel}=await import('./cities');await switchGameMap(session.state.location);if(session.state.position)placeAfterTravel(session.state.position);}
  if(success){if(ui.openWindow==='homes'&&action!=='state')setWindow('homes',false);updateHud();updateProfessionEnergy();document.dispatchEvent(new CustomEvent('brumaluz-professions-update'));const editing=document.activeElement instanceof HTMLElement&&!!document.activeElement.closest('.profession-window')&&document.activeElement.matches('input,select');if(ui.openWindow==='professions'&&!(action==='state'&&editing))setWindow('professions',false);}
  return success;
}
let activeGather:string|null=null;
export async function gatherResource(id:string) {
 if(activeGather)return;
 const node=RPG_CATALOG.nodes[id];if(!node)return;
 activeGather=id;
 const generation=play.playGeneration,origin=holder.position.clone(),actor=play.char,location=play.city.locationId;
 let feedback:ReturnType<typeof gatheringFeedback>|undefined,completed=false;
 try {
  if(!await performProfession('gather_start',{id}))return;
  const health=session.state.health;
  const interrupted=()=>play.playGeneration!==generation||play.mode!=='play'||play.dead||play.city.locationId!==location||holder.position.distanceTo(origin)>.5||session.state.health<health||isInCombat(fight.combatEncounter);
  if(interrupted()||!actor.beginGathering(node.job,RPG_CATALOG.items[session.state.rpg?.tools[node.job]?.id??'']?.tier??0)){
   if(play.playGeneration===generation)await performProfession('gather_cancel',{id});return;
  }
  const state=professionState(session.state.rpg),cost=gatherEnergy(professionRank(state,node.job),node.tier??0),xpBefore=state.xp[node.job]??0;
  let cancelled=false;
  feedback=gatheringFeedback(node,cost,()=>{cancelled=true;});
  const started=performance.now();
  const complete=await new Promise<boolean>(resolve=>{
   const step=()=>{
    if(cancelled||interrupted()){resolve(false);return;}
    const elapsed=(performance.now()-started)/1000;feedback!.update(elapsed);
    if(elapsed>=node.seconds!+.15){resolve(true);return;}requestAnimationFrame(step);
   };step();
  });
  actor.endGathering();
  if(play.playGeneration!==generation)return;
  if(!complete){await performProfession('gather_cancel',{id});return;}
  feedback.waiting();
  if(await performProfession('gather_finish',{id})){
   refreshProfessionWorld(play.city,session.state.rpg);
   feedback.complete(Math.max(0,(session.state.rpg?.xp[node.job]??0)-xpBefore));completed=true;
  }
 }finally {if(!completed)feedback?.dispose();actor.endGathering();activeGather=null;}
}
export function installProfessions(){
 const open=()=>{setWindow('professions');void performProfession('state');};
 document.getElementById('world-menu-professions')!.onclick=open;
 document.getElementById('gathering-energy-hud')!.onclick=open;
 document.addEventListener('keydown',event=>{if(event.code!=='KeyP'||event.repeat||event.ctrlKey||event.altKey||event.metaKey||play.mode!=='play'||(event.target instanceof HTMLElement&&(event.target.matches('input,textarea,select')||event.target.isContentEditable)))return;setWindow(ui.openWindow==='professions'?null:'professions');if(ui.openWindow)void performProfession('state');});
 // Refresh server-owned jobs only while the window is open, without client grants of XP/items.
 setInterval(()=>{if(!play.actionBusy&&(ui.openWindow==='professions'||!session.activeCharacterId&&play.mode==='play'))void performProfession('state');},5000);
 setInterval(updateProfessionEnergy,1000);
 updateProfessionEnergy();
}
