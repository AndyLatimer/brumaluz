import { professionAction, RPG_CATALOG } from '../data/professions';
import { rpgAction } from '../services/account';
import { session,play,ui } from './state';
import { holder } from './stage';
import { runOnServer } from './server';
import { updateHud } from './hud';
import { setWindow } from '../ui/menus';
import { updateProfessionEnergy } from '../ui/professionEnergy';

export async function performProfession(action:string,args:Record<string,unknown>={}) {
  const success=await runOnServer(id=>rpgAction(id,action,args,session.state.rpg?.revision??0),()=>{
    session.state.position={x:holder.position.x,z:holder.position.z,yaw:holder.rotation.y};
    professionAction(session.state,action,args);
  });
  if(success){updateHud();updateProfessionEnergy();document.dispatchEvent(new CustomEvent('brumaluz-professions-update'));const editing=document.activeElement instanceof HTMLElement&&!!document.activeElement.closest('.profession-window')&&document.activeElement.matches('input,select');if(ui.openWindow==='professions'&&!(action==='state'&&editing))setWindow('professions',false);}
  return success;
}
let activeGather:string|null=null;
export async function gatherResource(id:string) {
 if(activeGather)return;
 const node=RPG_CATALOG.nodes[id];if(!node)return;
 activeGather=id;
 if(!await performProfession('gather_start',{id})){activeGather=null;return;}
 const generation=play.playGeneration,started=performance.now(),origin=holder.position.clone();
 const hud=document.createElement('div');hud.className='gather-progress';hud.setAttribute('role','status');
 const label=document.createElement('span'),progress=document.createElement('progress'),cancel=document.createElement('button');
 label.textContent=node.label;progress.max=node.seconds!;cancel.textContent='Cancelar';hud.append(label,progress,cancel);document.body.append(hud);
 let cancelled=false;cancel.onclick=()=>{cancelled=true;};
 try {
  const complete=await new Promise<boolean>(resolve=>{
   const step=()=>{
    const elapsed=(performance.now()-started)/1000;progress.value=elapsed;
    if(cancelled||play.playGeneration!==generation||play.mode!=='play'||play.dead||holder.position.distanceTo(origin)>.5){resolve(false);return;}
    if(elapsed>=node.seconds!+.15){resolve(true);return;}requestAnimationFrame(step);
   };step();
  });
  if(play.playGeneration===generation)await performProfession(complete?'gather_finish':'gather_cancel',{id});
 }finally {hud.remove();activeGather=null;}
}
export function installProfessions(){
 const open=()=>{setWindow('professions');void performProfession('state');};
 document.getElementById('world-menu-professions')!.onclick=open;
 document.getElementById('gathering-energy-hud')!.onclick=open;
 document.addEventListener('keydown',event=>{if(event.code!=='KeyP'||event.repeat||event.ctrlKey||event.altKey||event.metaKey||play.mode!=='play'||(event.target instanceof HTMLElement&&(event.target.matches('input,textarea,select')||event.target.isContentEditable)))return;setWindow(ui.openWindow==='professions'?null:'professions');if(ui.openWindow)void performProfession('state');});
 // Refresh server-owned jobs only while the window is open, without client grants of XP/items.
 setInterval(()=>{if(ui.openWindow==='professions'&&!play.actionBusy)void performProfession('state');},5000);
 setInterval(updateProfessionEnergy,1000);
 updateProfessionEnergy();
}
