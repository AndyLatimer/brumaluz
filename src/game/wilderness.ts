import * as THREE from 'three';
import { Character } from '../character/character';
import { forestEnemy, type ForestActor } from '../world/forestEnemy';
import { defaultChar } from '../data/data';
import { starterEquipment } from '../data/combat';
import { WILDERNESS } from '../data/wilderness';
import type { CombatEncounter } from '../services/multiplayer';
import type { TargetDetails } from '../ui/targetFrame';
import { wildernessAction } from '../services/account';
import { session,play,fight } from './state';
import { scene,holder } from './stage';
import { characterContext } from './avatar';
import { applyCombatResult, lockCombatTarget } from './combat';
import { toast } from '../ui/toast';
import { errorMessage } from './server';
import { serverNow } from '../data/worldClock';

type Actor=Character|ForestActor;
const actors=new Map<string,{actor:Actor;warning:THREE.Mesh;ring:THREE.Mesh;attack:number;prepared:boolean;instance?:string}>();
let cooldowns:Record<string,number>={},owner='',nextPoll=0,polling=false,starting=false,lastRevision=-1;
export function receiveWilderness(result:Record<string,unknown>){const revision=Number((result.vitals as {serverRevision?:number}|undefined)?.serverRevision??(result.data as {serverRevision?:number}|undefined)?.serverRevision??-1);if(revision<lastRevision)return;lastRevision=revision;const s=result.wilderness as {respawns?:Record<string,number>}|undefined;if(s)cooldowns=s.respawns??{};}
function createActor(id:string){
 const site=WILDERNESS.spawns.find(site=>site.id===id)!;const def=WILDERNESS.enemies[site.enemy];
 const actor:Actor=def.family?forestEnemy(def.family):new Character({...defaultChar(),name:def.label,cls:def.cls,hair:def.cls==='picaro'?1:2,beard:def.cls==='guerrero'?1:0,primary:def.clothA,secondary:6,clothA:def.clothA,clothB:def.clothB,equipment:starterEquipment(def.cls)}, {outfit:true,useEquipment:true,hat:false});
 actor.root.userData.wildernessActor=actor;actor.root.userData.wildSpawn=id;actor.root.name=`wilderness:${id}`;actor.root.position.set(site.x,play.city.groundY(site.x,site.z),site.z);
 let warningGeometry:THREE.BufferGeometry;
 if(def.pattern==='line'){warningGeometry=new THREE.PlaneGeometry(def.radius*2,def.reach);warningGeometry.rotateX(-Math.PI/2);warningGeometry.translate(0,0,def.reach/2);}
 else if(def.pattern==='circle'){warningGeometry=new THREE.CircleGeometry(def.radius,40);warningGeometry.rotateX(-Math.PI/2);}
 else {const vertices=[0,0,0],indices:number[]=[];for(let i=0;i<=32;i++){const angle=-Math.PI/3+i/32*Math.PI*2/3;vertices.push(Math.sin(angle)*def.radius,0,Math.cos(angle)*def.radius);if(i>0)indices.push(0,i,i+1);}warningGeometry=new THREE.BufferGeometry();warningGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));warningGeometry.setIndex(indices);}
 const warning=new THREE.Mesh(warningGeometry,new THREE.MeshBasicMaterial({color:'#edb063',transparent:true,opacity:.25,depthWrite:false,side:THREE.DoubleSide}));warning.position.y=.035;warning.visible=false;warning.raycast=()=>{};actor.root.add(warning);
 const ring=new THREE.Mesh(new THREE.RingGeometry(.52,.57,32),new THREE.MeshBasicMaterial({color:'#e0b66f',transparent:true,opacity:.7,depthWrite:false,side:THREE.DoubleSide}));ring.name='combat-lock-ring';ring.rotation.x=-Math.PI/2;ring.position.y=.025;ring.visible=false;ring.raycast=()=>{};actor.root.add(ring);
 scene.add(actor.root);const entry={actor,warning,ring,attack:0,prepared:false,instance:undefined as string|undefined};actors.set(id,entry);return entry;
}
export function wildernessRoot(encounter:CombatEncounter){if(!encounter.spawn||!WILDERNESS.spawns.some(site=>site.id===encounter.spawn))return null;return(actors.get(encounter.spawn)??createActor(encounter.spawn)).actor.root;}
export function wildernessTargets():TargetDetails[]{if(play.city.locationId!=='pompelin')return[];const encounter=fight.combatEncounter,occupied=encounter?.status==='active'||encounter?.status==='defeated'&&!encounter.looted;return [...actors].filter(([id,entry])=>entry.actor.root.visible&&(!occupied||encounter?.spawn!==id)).map(([id,entry])=>{const def=WILDERNESS.enemies[WILDERNESS.spawns.find(s=>s.id===id)!.enemy];return{id:`wild:${id}`,root:entry.actor.root,name:def.label,level:def.level,height:def.family==='beast'?.95:1.5,vitals:{health:def.health,maxHealth:def.health,overheal:0,resource:0,maxResource:1,resourceKind:'stamina'},identity:{kind:'npc',type:'hostile',title:def.family==='beast'?'Fauna del bosque':def.family==='magic'?'Criatura del bosque':'Bandido del camino'}};});}
export function wildernessInteractions(){return wildernessTargets().map(target=>({id:target.id,label:`Enfrentarse a ${target.name}`,position:target.root.position,radius:2.8}));}
export async function beginWilderness(id:string){
 if(starting||play.dead)return false; if(!session.activeCharacterId){toast('Combate','Entra con un personaje para combatir en Pompelín.');return false;}
 starting=true;const current=characterContext();try{const result=await wildernessAction(session.activeCharacterId,'start',id);if(!current())return false;receiveWilderness(result);applyCombatResult(result);lockCombatTarget(true);return true;}catch(error){if(current())toast('Combate',errorMessage(error),true);return false;}finally{starting=false;}
}
export function tickWilderness(t:number,dt:number){
 const key=`${session.activeCharacterId??'local'}:${play.city.locationId}`;
 if(key!==owner){for(const entry of actors.values()){if(fight.combatTargetRoot===entry.actor.root)fight.combatTargetRoot=null;entry.actor.dispose();for(const extra of [entry.warning,entry.ring]){extra.geometry.dispose();(extra.material as THREE.Material).dispose();}}actors.clear();cooldowns=session.state.wilderness?.respawns??{};owner=key;nextPoll=0;lastRevision=-1;}
 if(play.city.locationId!=='pompelin')return;
 // Position/attacks already arrive with the world heartbeat. Full character data
 // only needs a slower refresh for loot, XP and personal respawn recovery.
 if(session.activeCharacterId&&!polling&&!play.actionBusy&&!fight.combatBusy&&t>nextPoll){nextPoll=t+5;polling=true;const current=characterContext();void wildernessAction(session.activeCharacterId,'state').then(result=>{if(current()){receiveWilderness(result);applyCombatResult(result);}}).catch(error=>{if(current())console.warn('Combate de Pompelín:',errorMessage(error));nextPoll=t+5;}).finally(()=>{polling=false;});}
 const now=serverNow();
 for(const site of WILDERNESS.spawns){const distance=Math.hypot(holder.position.x-site.x,holder.position.z-site.z);const stored=fight.combatEncounter?.kind==='wilderness'&&fight.combatEncounter.spawn===site.id?fight.combatEncounter:null,encounter=stored&&(stored.status==='active'||stored.status==='defeated'&&!stored.looted)?stored:null;
  if(distance>65&&!encounter&&!actors.has(site.id))continue;
  const entry=actors.get(site.id)??createActor(site.id),root=entry.actor.root;
  root.visible=!!encounter&&['active','defeated'].includes(encounter.status)&&!encounter.looted||distance<65&&(cooldowns[site.id]??0)<=now&&encounter?.status!=='defeated';
  if(!root.visible)continue;
  if(encounter?.status==='active'){
   const def=WILDERNESS.enemies[site.enemy];
   if(entry.instance!==encounter.instanceId){entry.instance=encounter.instanceId??undefined;entry.attack=encounter.attackSeq??0;entry.prepared=false;}
   const destination=new THREE.Vector3(encounter.x,play.city.groundY(encounter.x,encounter.z),encounter.z),moving=root.position.distanceToSquared(destination)>.01;root.position.lerp(destination,Math.min(1,dt*(def.pattern==='line'?14:8)));
   root.rotation.y=encounter.windup?Math.atan2((encounter.aimX??holder.position.x)-encounter.x,(encounter.aimZ??holder.position.z)-encounter.z):Math.atan2(holder.position.x-root.position.x,holder.position.z-root.position.z);entry.actor.setGait(moving?'walk':'idle');
   entry.warning.visible=!!encounter.windup;
   if(encounter.windup){
    const remaining=encounter.windup-now;
    if(def.pattern==='circle'&&encounter.aimX!==undefined&&encounter.aimZ!==undefined){const target=root.worldToLocal(new THREE.Vector3(encounter.aimX,play.city.groundY(encounter.aimX,encounter.aimZ)+.035,encounter.aimZ));entry.warning.position.copy(target);}else entry.warning.position.set(0,.035,0);
    const material=entry.warning.material as THREE.MeshBasicMaterial;material.color.set(remaining<.3?'#e98668':'#edb063');material.opacity=.22+Math.sin(t*9)*.035;
    if(remaining<.3&&!entry.prepared){entry.actor.attack();entry.prepared=true;}
   }
   if((encounter.attackSeq??0)!==entry.attack){entry.attack=encounter.attackSeq??0;if(!entry.prepared)entry.actor.attack();entry.prepared=false;}
  }else if(encounter?.status==='defeated'){entry.warning.visible=false;entry.actor.die();}
  else {root.position.set(site.x,play.city.groundY(site.x,site.z),site.z);entry.warning.visible=false;entry.actor.setGait('idle');entry.actor.revive();}
  entry.actor.update(t);
 }
}
