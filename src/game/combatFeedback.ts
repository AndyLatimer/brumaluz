import * as THREE from 'three';
import { session,play,fight,vitals } from './state';
import { camera,holder,scene } from './stage';
import { attackInterval, COMBAT_KITS } from '../data/combat';
import { ENCHANT_LABELS } from '../data/professions';
import { vitalsOf } from '../data/stats';
import { refreshProfessionWorld } from '../world/professionWorld';
import { getParty } from '../services/party';
import { selectExpeditionTarget, leaveExpedition } from './combat';
import { buildShadowEnemy, updateShadowEnemy } from '../world/shadowEnemy';

const floats:{el:HTMLElement;position:THREE.Vector3;born:number;side:number}[]=[];
const particles:{mesh:THREE.Mesh;born:number;velocity:THREE.Vector3}[]=[];
let panel:HTMLElement|null=null,bar:HTMLProgressElement,label:HTMLElement,details:HTMLElement,lastWorld=0,lastAction=0;
let targetButtons:HTMLElement,healSelect:HTMLSelectElement,lastChoices='';
const secondaries=new Map<string,THREE.Group>();
export function combatFloat(amount:number,position:THREE.Vector3,kind='damage'){
 if(!Number.isFinite(amount)||amount<=0)return;
 while(floats.length>=30)floats.shift()!.el.remove();
 const el=document.createElement('span');el.className=`combat-float ${kind}`;el.textContent=`${kind==='healing'?'+':''}${Math.round(amount*10)/10}`;el.setAttribute('aria-hidden','true');document.body.append(el);floats.push({el,position:position.clone().add(new THREE.Vector3(0,1.7,0)),born:performance.now(),side:(Math.random()-.5)*50});
}
export function combatImpact(position:THREE.Vector3,kind='damage'){
 const color=kind==='fire'?0xffa857:kind==='dark'?0xb78bea:kind==='frost'?0xa5eafa:kind==='lightning'?0xaad6ff:kind==='healing'?0xa7df9e:0xf2d496;
 for(let i=0;i<6;i++){const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(.035,0),new THREE.MeshBasicMaterial({color,transparent:true,depthWrite:false}));mesh.position.copy(position).y+=.8;scene.add(mesh);particles.push({mesh,born:performance.now(),velocity:new THREE.Vector3(Math.sin(i*2.4)*1.1,.5+Math.random(),Math.cos(i*2.4)*1.1)});}
}
export function combatActionStarted(){lastAction=performance.now();}
export function tickCombatFeedback(dt:number){
 const now=performance.now(),point=new THREE.Vector3();
 for(let i=floats.length-1;i>=0;i--){const f=floats[i],age=(now-f.born)/1000;if(age>1.2||play.mode!=='play'){f.el.remove();floats.splice(i,1);continue;}point.copy(f.position);point.y+=age*.8;point.project(camera);f.el.hidden=point.z>1||point.z< -1;f.el.style.left=`${(point.x*.5+.5)*innerWidth+f.side*age}px`;f.el.style.top=`${(-point.y*.5+.5)*innerHeight}px`;f.el.style.opacity=String(Math.min(1,(1.2-age)*3));}
 for(let i=particles.length-1;i>=0;i--){const p=particles[i],age=(now-p.born)/1000;if(age>.4){p.mesh.removeFromParent();p.mesh.geometry.dispose();(p.mesh.material as THREE.Material).dispose();particles.splice(i,1);continue;}p.mesh.position.addScaledVector(p.velocity,dt);(p.mesh.material as THREE.MeshBasicMaterial).opacity=1-age/.4;}
 if(play.city&&now-lastWorld>1000){refreshProfessionWorld(play.city,session.state.rpg);lastWorld=now;}
 if(!panel){panel=document.createElement('section');panel.className='combat-dashboard';label=document.createElement('strong');details=document.createElement('div');details.className='combat-log-compact';bar=document.createElement('progress');bar.max=1;targetButtons=document.createElement('div');targetButtons.className='combat-target-buttons';healSelect=document.createElement('select');healSelect.style.pointerEvents='auto';healSelect.setAttribute('aria-label','Objetivo de Curación');healSelect.onchange=()=>{fight.healTarget=healSelect.value||null;};panel.append(label,bar,details,healSelect,targetButtons);document.body.append(panel);}
 const combatActive=fight.combatEncounter?.status==='active',expedition=fight.combatEncounter?.kind==='expedition',active=play.mode==='play'&&session.state.cls==='clerigo'&&getParty().members.length>1;panel.hidden=!active;
 bar.hidden=true;details.hidden=true;targetButtons.hidden=true;
 const enemies=combatActive?fight.combatEncounter?.enemies??[]:[];
 for(const[id,root]of secondaries)if(!enemies.some(e=>e.id===id&&e.health>0)||play.mode!=='play'){root.removeFromParent();root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});secondaries.delete(id);}
 for(const e of enemies)if(e.health>0){let root=secondaries.get(e.id);if(!root){root=buildShadowEnemy(e.x,e.z,play.city.groundY(e.x,e.z));root.name=`expedition-enemy:${e.id}`;secondaries.set(e.id,root);scene.add(root);}root.position.set(e.x,play.city.groundY(e.x,e.z),e.z);updateShadowEnemy(root,now/1000,dt,holder.position,true);}
 if(!active)return;
 const kit=COMBAT_KITS[session.state.cls],interval=attackInterval(session.state.cls,session.state.equipment),remaining=Math.max(0,(vitals.skillReadyAt-now)/1000);
 label.textContent='Objetivo de curación';
 bar.value=Math.min(1,(now-lastAction)/(interval*1000));bar.setAttribute('aria-label','Recuperación del ataque básico');
 const state=session.state.enchantState,e=session.state.equipment.weapon?.enchantment;
 const shield=state&&(state.barrierUntil??0)>Date.now()/1000?state.barrier??0:0;
 details.textContent=`${kit.skill.label}: ${remaining>0?`${remaining.toFixed(1)} s`:'lista'}${e?` · ${ENCHANT_LABELS[e.id]} ${state?.count??0}${e.id==='lightning'?'/4':e.id==='frost'||e.id==='dark'?'/3':''}`:''}${shield>0?` · Barrera ${shield.toFixed(1)}`:''}`;
 const windup=fight.combatEncounter?.kind==='wilderness'?fight.combatEncounter.windup:undefined;panel.classList.toggle('enemy-windup',!!windup);if(windup)details.textContent+=` · Ataque enemigo en ${Math.max(0,windup-Date.now()/1000).toFixed(1)} s`;
 const choices=JSON.stringify([getParty().members.map(m=>[m.characterId,m.data.name]),fight.combatEncounter?.targets?.map(e=>[e.id,e.label,e.health]),fight.combatEncounter?.selected]);
 healSelect.hidden=session.state.cls!=='clerigo'||getParty().members.length<2;
 if(choices!==lastChoices){lastChoices=choices;healSelect.replaceChildren();const self=document.createElement('option');self.value='';self.textContent='Curación: yo';healSelect.append(self);for(const m of getParty().members)if(m.characterId!==session.activeCharacterId){const option=document.createElement('option');option.value=m.characterId;option.textContent=`Curación: ${m.data.name}`;healSelect.append(option);}healSelect.value=fight.healTarget??'';if(healSelect.selectedIndex<0){fight.healTarget=null;healSelect.value='';}
  targetButtons.replaceChildren();fight.combatEncounter?.targets?.forEach((enemy,index)=>{if(enemy.health<=0)return;const b=document.createElement('button');b.type='button';b.style.pointerEvents='auto';b.textContent=`${enemy.label??'Enemigo'} ${Math.ceil(enemy.health)}`;b.setAttribute('aria-pressed',String(fight.combatEncounter?.selected===index));b.onclick=()=>void selectExpeditionTarget(index);targetButtons.append(b);});
  if(fight.combatEncounter?.kind==='expedition'){const leave=document.createElement('button');leave.type='button';leave.style.pointerEvents='auto';leave.textContent='Abandonar expedición';leave.onclick=()=>void leaveExpedition();targetButtons.append(leave);}
 }
}
