import * as THREE from 'three';
import { Character } from '../character/character';
import { forestEnemy, type ForestActor } from '../world/forestEnemy';
import { defaultChar } from '../data/data';
import { starterEquipment } from '../data/combat';
import { WILDERNESS } from '../data/wilderness';
import { parseWilderness, type WildernessMob, type CombatEncounter } from '../services/multiplayer';
import type { TargetDetails } from '../ui/targetFrame';
import { wildernessAction } from '../services/account';
import { session,play,fight,ui } from './state';
import { scene,holder,camera } from './stage';
import { characterContext } from './avatar';
import { applyCombatResult, lockCombatTarget, setCombatEncounter } from './combat';
import { setWindow } from '../ui/menus';
import { toast } from '../ui/toast';
import { errorMessage } from './server';
import { serverNow } from '../data/worldClock';
import { combatSoundAt } from './combatSound';
import { combatReward, combatProjectile } from './combatFeedback';
import { syncSkillCooldown } from './skillCooldown';

type Actor=Character|ForestActor;
const actors=new Map<string,{actor:Actor;warning:THREE.Mesh;ring:THREE.Mesh;plate:HTMLElement;meter:HTMLProgressElement;attack:number;prepared:boolean;instance?:string;warnedAt?:number;ambientSeq?:number;shotAt?:number;from:THREE.Vector3;to:THREE.Vector3;sampleAt:number;duration:number;movingUntil:number;speed:number}>();
const platePoint=new THREE.Vector3();
const mobs=new Map<string,WildernessMob>(),corpses=new Map<string,CombatEncounter>();
let owner='',nextPoll=0,polling=false,claimsRevision=-1;
let selection:{spawn:string;instance:string;confirmed:boolean;pending:Promise<boolean>|null;controller:AbortController;retryAt:number}|null=null;
let claimsOwner='',claimsPrimed=false;
const announcedClaims=new Set<string>();
function ensureOwner(){
 const key=[session.accountSyncId,session.activeCharacterId,play.city.locationId,play.playGeneration].join(':');
 if(key===owner)return;
 selection?.controller.abort();selection=null;
 for(const entry of actors.values()){
  if(fight.combatTargetRoot===entry.actor.root)fight.combatTargetRoot=null;
  entry.actor.dispose();
  entry.plate.remove();
  for(const extra of [entry.warning,entry.ring]){extra.geometry.dispose();(extra.material as THREE.Material).dispose();}
 }
 actors.clear();mobs.clear();corpses.clear();fight.lootEncounter=null;fight.lootTargetRoot=null;
 owner=key;nextPoll=0;claimsRevision=-1;
}
export function receiveWilderness(result:Record<string,unknown>){
 ensureOwner();const packet=parseWilderness(result.wilderness);if(!packet)return;
 for(const mob of packet.mobs){
  const previous=mobs.get(mob.spawn!);if(previous&&previous.revision>mob.revision)continue;
  if(play.city.locationId==='pompelin'&&previous?.instanceId===mob.instanceId&&previous.status!=='defeated'&&mob.status==='defeated'){
   const def=WILDERNESS.enemies[mob.enemy!];combatSoundAt('death',def?.family??def?.cls??'guerrero',mob);
  }
  if(previous?.instanceId===mob.instanceId&&previous.health>mob.health&&!mob.windup)actors.get(mob.spawn!)?.actor.hit();
  mobs.set(mob.spawn!,mob);
 }
 if(selection&&(result.encounter as CombatEncounter|undefined)?.instanceId===selection.instance)selection.confirmed=true;
 const revision=Number((result.vitals as {serverRevision?:number}|undefined)?.serverRevision??(result.data as {serverRevision?:number}|undefined)?.serverRevision??0);
 if(revision<claimsRevision)return;
 if(packet.skillReadyAt!==undefined)syncSkillCooldown({deadline:packet.skillReadyAt,serverTime:packet.serverTime,revision});
 claimsRevision=revision;corpses.clear();for(const corpse of packet.corpses)if(corpse.instanceId)corpses.set(corpse.instanceId,corpse);
 const claimKey=session.accountSyncId+':'+session.activeCharacterId;
 if(claimKey!==claimsOwner){claimsOwner=claimKey;announcedClaims.clear();claimsPrimed=false;}
 const defeated:CombatEncounter[]=[];
 for(const corpse of corpses.values())if(corpse.instanceId&&!announcedClaims.has(corpse.instanceId)){announcedClaims.add(corpse.instanceId);if(claimsPrimed&&play.mode==='play')defeated.push(corpse);}
 claimsPrimed=true;while(announcedClaims.size>256)announcedClaims.delete(announcedClaims.values().next().value!);
 if(defeated.length){
  const totals=defeated.reduce((sum,corpse)=>{const def=WILDERNESS.enemies[corpse.enemy!];return{xp:sum.xp+(def?.xp??0),coins:sum.coins+(def?.coins??0)};},{xp:0,coins:0});
  combatReward(totals.xp,totals.coins);
 }
 if(fight.lootEncounter?.shared){
  const updated=corpses.get(fight.lootEncounter.instanceId!);
  if(updated)fight.lootEncounter=updated;
  else{fight.lootEncounter=null;fight.lootTargetRoot=null;if(ui.openWindow==='loot')setWindow(null,false);}
 }
}
function createActor(id:string){
 const site=WILDERNESS.spawns.find(site=>site.id===id)!;const def=WILDERNESS.enemies[site.enemy];
 const variant=site.variant??0;
 const actor:Actor=def.family?forestEnemy(def.family):new Character({...defaultChar(),name:def.label,cls:def.cls,face:variant%4,hair:def.cls==='picaro'?1+variant:2+variant,brows:variant%3,beard:def.cls==='guerrero'?1+variant:variant%2,primary:def.clothA,secondary:6,clothA:def.clothA,clothB:def.clothB,equipment:starterEquipment(def.cls)}, {outfit:true,useEquipment:true,hat:false});
 if(def.family)actor.root.scale.setScalar(.96+variant*.04);
 actor.root.userData.wildernessActor=actor;actor.root.userData.wildSpawn=id;actor.root.name=`wilderness:${id}`;actor.root.position.set(site.x,play.city.groundY(site.x,site.z),site.z);
 let warningGeometry:THREE.BufferGeometry;
 if(def.pattern==='line'){warningGeometry=new THREE.PlaneGeometry(def.radius*2,def.reach);warningGeometry.rotateX(-Math.PI/2);warningGeometry.translate(0,0,def.reach/2);}
 else if(def.pattern==='circle'){warningGeometry=new THREE.CircleGeometry(def.radius,40);warningGeometry.rotateX(-Math.PI/2);}
 else {const vertices=[0,0,0],indices:number[]=[];for(let i=0;i<=32;i++){const angle=-Math.PI/3+i/32*Math.PI*2/3;vertices.push(Math.sin(angle)*def.radius,0,Math.cos(angle)*def.radius);if(i>0)indices.push(0,i,i+1);}warningGeometry=new THREE.BufferGeometry();warningGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));warningGeometry.setIndex(indices);}
 const warning=new THREE.Mesh(warningGeometry,new THREE.MeshBasicMaterial({color:'#edb063',transparent:true,opacity:.25,depthWrite:false,side:THREE.DoubleSide}));warning.position.y=.035;warning.visible=false;warning.raycast=()=>{};actor.root.add(warning);
 const ring=new THREE.Mesh(new THREE.RingGeometry(.52,.57,32),new THREE.MeshBasicMaterial({color:'#e0b66f',transparent:true,opacity:.7,depthWrite:false,side:THREE.DoubleSide}));ring.name='combat-lock-ring';ring.rotation.x=-Math.PI/2;ring.position.y=.025;ring.visible=false;ring.raycast=()=>{};actor.root.add(ring);
 const plate=document.createElement('div');plate.className='wild-enemy-plate';plate.hidden=true;plate.setAttribute('aria-hidden','true');
 const name=document.createElement('span');name.textContent=def.label;
 const meter=document.createElement('progress');meter.max=def.health;meter.value=def.health;plate.append(name,meter);document.body.append(plate);
 scene.add(actor.root);const entry={actor,warning,ring,plate,meter,attack:0,prepared:false,instance:undefined as string|undefined,warnedAt:undefined as number|undefined,ambientSeq:undefined as number|undefined,shotAt:undefined as number|undefined,from:actor.root.position.clone(),to:actor.root.position.clone(),sampleAt:performance.now(),duration:.2,movingUntil:0,speed:0};actors.set(id,entry);return entry;
}
export function wildernessRoot(encounter:CombatEncounter){
 ensureOwner();if(!encounter.spawn||!WILDERNESS.spawns.some(site=>site.id===encounter.spawn))return null;
 return(actors.get(encounter.spawn)??createActor(encounter.spawn)).actor.root;
}
export function wildernessTargets():TargetDetails[]{
 if(play.city.locationId!=='pompelin')return[];
 const result:TargetDetails[]=[];
 for(const [id,mob] of mobs){
  const entry=actors.get(id),def=WILDERNESS.enemies[mob.enemy!];if(!entry?.actor.root.visible||!def||mob.status==='defeated')continue;
  result.push({id:'wild:'+id,root:entry.actor.root,name:mob.label??def.label,level:def.level,height:.5,scale:def.family==='beast'?.64:def.family==='magic'?.83:1,
   vitals:{health:mob.health,maxHealth:mob.maxHealth,overheal:0,resource:0,maxResource:1,resourceKind:'stamina'},
   identity:{kind:'npc',type:'hostile',title:mob.status==='returning'?'Regresando · invulnerable':mob.attackingYou?'En combate contigo':def.ai?.title??(def.family==='beast'?'Fauna del bosque':def.family==='magic'?'Criatura del bosque':'Bandido del camino')},
  });
 }return result;
}
export function wildernessInteractions(){
 return [...corpses.values()].flatMap(corpse=>{const root=actors.get(corpse.spawn!)?.actor.root;return root?.visible?[{id:'wildloot:'+corpse.instanceId,label:'Registrar cuerpo',position:root.position,radius:3}]:[];});
}
export function wildernessCombatTargets(){return wildernessTargets().filter(target=>mobs.get(target.id.slice(5))?.status!=='returning');}
export function openWildernessCorpse(instance:string){
 const corpse=corpses.get(instance);if(!corpse)return false;
 const root=actors.get(corpse.spawn!)?.actor.root;if(!root||holder.position.distanceTo(root.position)>3){toast('Botín','Acércate al cuerpo para recoger el botín.',true);return true;}
 fight.lootEncounter=corpse;fight.lootTargetRoot=root;setWindow('loot');return true;
}
export function clickWilderness(ray:THREE.Raycaster){
 const hit=ray.intersectObjects([...actors.values()].map(entry=>entry.actor.root).filter(root=>root.visible),true)[0];if(!hit)return false;
 let node:THREE.Object3D|null=hit.object;while(node&&!node.userData.wildSpawn)node=node.parent;
 const id=node?.userData.wildSpawn as string|undefined,mob=id?mobs.get(id):undefined;if(!mob)return false;
 if(mob.status==='defeated'){const corpse=corpses.get(mob.instanceId!);if(corpse)openWildernessCorpse(corpse.instanceId!);return true;}
 if(mob.status!=='returning')void beginWilderness(id!);return true;
}
export async function beginWilderness(id:string){
 ensureOwner();if(play.dead||!session.activeCharacterId)return false;
 const mob=mobs.get(id);if(!mob?.instanceId||mob.status==='returning'||mob.status==='defeated')return false;
 if(selection?.instance===mob.instanceId){lockCombatTarget(true);return true;}
 selection?.controller.abort();
 selection={spawn:id,instance:mob.instanceId,confirmed:false,pending:null,controller:new AbortController(),retryAt:0};
 // Selection and approaching happen on the click, even when a server round
 // trip is slow or the enemy is beyond its ten-metre engagement radius.
 setCombatEncounter({...mob,status:'active'},true);lockCombatTarget(true);
 void startSelectedEnemy();return true;
}
export function selectedWildernessEncounter():CombatEncounter|null{
 if(!selection)return null;const mob=mobs.get(selection.spawn);
 if(!mob||mob.instanceId!==selection.instance)return null;
 if(mob.status==='defeated')return corpses.get(selection.instance)??{...mob,status:'defeated',looted:true};
 return {...mob,status:mob.status==='returning'?'fled':'active'};
}
async function startSelectedEnemy():Promise<boolean>{
 const chosen=selection;if(!chosen||chosen.controller.signal.aborted)return false;
 if(chosen.confirmed)return true;if(chosen.pending)return chosen.pending;
 if(performance.now()<chosen.retryAt)return false;
 const mob=mobs.get(chosen.spawn),character=session.activeCharacterId;
 if(!mob||!character||mob.instanceId!==chosen.instance||Math.hypot(holder.position.x-mob.x,holder.position.z-mob.z)>9.25)return false;
 const from=holder.position.clone();from.y+=1;const to=new THREE.Vector3(mob.x,play.city.groundY(mob.x,mob.z)+1,mob.z);
 if(play.city.lineOfSight?.(from,to)===false)return false;
 const current=characterContext();
 const timeout=window.setTimeout(()=>chosen.controller.abort(),4000);
 chosen.pending=(async()=>{
  try{
   const result=await wildernessAction(character,'start',chosen.spawn,undefined,chosen.controller.signal);
   if(!current()||selection!==chosen||chosen.controller.signal.aborted)return false;
   chosen.confirmed=true;applyCombatResult(result);return true;
  }catch(error){
   if(current()&&selection===chosen){chosen.retryAt=performance.now()+500;chosen.controller=new AbortController();}
   return false;
  }finally{clearTimeout(timeout);chosen.pending=null;}
 })();
 return chosen.pending;
}
export async function confirmWildernessTarget(instance:string|null|undefined,signal:AbortSignal){
 if(signal.aborted)return false;
 if(!selection)return true;
 if(selection.instance!==instance)return false;
 return (selection.confirmed||await startSelectedEnemy())&&!signal.aborted;
}
export function tickWilderness(t:number,dt:number){
 ensureOwner();if(play.city.locationId!=='pompelin')return;
 if(selection&&fight.lockedEnemy&&!selection.confirmed&&!selection.pending&&performance.now()>=selection.retryAt)void startSelectedEnemy();
 // A connected world heartbeat already contains the whole outdoor population.
 // Poll only in isolated previews, never alongside the live connection.
 if(!session.worldConnection&&session.activeCharacterId&&!polling&&!play.actionBusy&&t>nextPoll){
  nextPoll=t+5;polling=true;const current=characterContext();
  void wildernessAction(session.activeCharacterId,'state').then(result=>{if(current())applyCombatResult(result);}).catch(error=>{if(current())console.warn('Combate de Pompelín:',errorMessage(error));}).finally(()=>{polling=false;});
 }
 const now=serverNow();
 for(const site of WILDERNESS.spawns){
  const mob=mobs.get(site.id);if(!mob)continue;
  const distance=Math.hypot(holder.position.x-mob.x,holder.position.z-mob.z);if(distance>80&&!actors.has(site.id))continue;
  const entry=actors.get(site.id)??createActor(site.id),root=entry.actor.root,def=WILDERNESS.enemies[site.enemy];root.visible=distance<80;if(!root.visible){entry.plate.hidden=true;continue;}
  const localNow=performance.now();
  if(entry.instance!==mob.instanceId){entry.instance=mob.instanceId??undefined;entry.attack=mob.attackSeq??0;entry.prepared=false;entry.warnedAt=entry.ambientSeq=entry.shotAt=undefined;entry.actor.revive();root.position.set(mob.x,play.city.groundY(mob.x,mob.z),mob.z);entry.from.copy(root.position);entry.to.copy(root.position);entry.sampleAt=localNow;entry.movingUntil=0;entry.speed=0;}
  if(Math.hypot(mob.x-entry.to.x,mob.z-entry.to.z)>.002){
   entry.duration=THREE.MathUtils.clamp((localNow-entry.sampleAt)/1000,.12,.3);
   if(def.pattern==='line'&&Math.hypot(mob.x-entry.to.x,mob.z-entry.to.z)>2)entry.duration=.16;
   entry.from.copy(root.position);entry.to.set(mob.x,play.city.groundY(mob.x,mob.z),mob.z);
   entry.speed=Math.hypot(entry.to.x-entry.from.x,entry.to.z-entry.from.z)/entry.duration;
   if(entry.from.distanceToSquared(entry.to)>225)entry.from.copy(entry.to);
   entry.sampleAt=localNow;entry.movingUntil=localNow+entry.duration*1000+100;
  }
  const destination=entry.to,moving=localNow<entry.movingUntil;
  root.position.lerpVectors(entry.from,entry.to,Math.min(1,(localNow-entry.sampleAt)/(entry.duration*1000)));
  entry.ring.visible=fight.lockedEnemy&&fight.combatEncounter?.instanceId===mob.instanceId;entry.warning.visible=false;
  if(mob.status==='defeated'){entry.actor.die();entry.ring.visible=false;}
  else {
   entry.actor.revive();entry.actor.setGait(moving?(mob.status==='returning'||mob.status==='active'&&entry.speed>2?'run':'walk'):'idle');entry.actor.setLocomotionSpeed(moving?entry.speed:0);
   if(!(entry.actor instanceof Character))entry.actor.setActivity(mob.activity??'');
   if(entry.ambientSeq!==mob.ambientSeq){entry.ambientSeq=mob.ambientSeq;if(mob.status==='idle'&&!moving&&entry.actor instanceof Character&&mob.activity==='watch')entry.actor.inspect();}
   const aim=mob.windup?{x:mob.aimX??mob.x,z:mob.aimZ??mob.z}:moving&&mob.activity!=='backstep'?destination:mob.status==='active'&&mob.targetX!==undefined?{x:mob.targetX,z:mob.targetZ??mob.z}:mob.lookX!==undefined?{x:mob.lookX,z:mob.lookZ??mob.z}:null;
   if(aim&&Math.hypot(aim.x-root.position.x,aim.z-root.position.z)>.01){const desired=Math.atan2(aim.x-root.position.x,aim.z-root.position.z);const turn=Math.atan2(Math.sin(desired-root.rotation.y),Math.cos(desired-root.rotation.y));root.rotation.y+=turn*(mob.windup?1:1-Math.exp(-dt*14));}
   if(mob.windup){
    if(entry.warnedAt!==mob.windup){entry.warnedAt=mob.windup;combatSoundAt('warning',def.family??def.cls,root.position);}
    const remaining=mob.windup-now;
    if(def.range>2.5&&remaining<.3&&entry.shotAt!==mob.windup){
     entry.shotAt=mob.windup;const point=mob.attackingYou?holder.position:new THREE.Vector3(mob.targetX??mob.aimX??mob.x,root.position.y,mob.targetZ??mob.aimZ??mob.z);
     combatProjectile(root.position,point,def.cls,Math.max(.04,remaining),mob.attackStyle==='heavy',mob.attackingYou?holder.position:undefined);
    }
    if(remaining<(mob.attackStyle==='heavy'?.65:.3)&&!entry.prepared){entry.actor.attack(mob.attackStyle==='heavy');entry.prepared=true;combatSoundAt('enemy',def.family??def.cls,root.position,mob.attackStyle==='heavy');}
   }
   if((mob.attackSeq??0)!==entry.attack){entry.attack=mob.attackSeq??0;if(!entry.prepared){entry.actor.attack();combatSoundAt('enemy',def.family??def.cls,root.position);}entry.prepared=false;}
  }entry.actor.update(t);
 }
}
/** Project after the camera has moved, avoiding one-frame label lag while orbiting. */
export function projectWildernessPlates(){
 for(const [id,entry] of actors){
  const mob=mobs.get(id),def=mob?WILDERNESS.enemies[mob.enemy!]:undefined,root=entry.actor.root;
  if(!mob||!def||!root.visible){entry.plate.hidden=true;continue;}
  const distance=holder.position.distanceTo(root.position),point=platePoint.copy(root.position);
  point.y+=def.family==='beast'?1.25:def.family==='magic'?1.8:2.15;point.project(camera);
  entry.plate.hidden=play.mode!=='play'||mob.status==='defeated'||distance>14||point.z< -1||point.z>1||mob.status==='idle'&&mob.health===mob.maxHealth;
  if(!entry.plate.hidden){entry.plate.style.left=((point.x*.5+.5)*innerWidth)+'px';entry.plate.style.top=((-point.y*.5+.5)*innerHeight)+'px';entry.meter.max=mob.maxHealth;entry.meter.value=mob.health;entry.plate.classList.toggle('selected',fight.lockedEnemy&&fight.combatEncounter?.instanceId===mob.instanceId);entry.plate.classList.toggle('returning',mob.status==='returning');}
 }
}
