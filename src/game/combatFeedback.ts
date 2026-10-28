import * as THREE from 'three';
import { session,play,fight } from './state';
import { camera,holder,scene,lowEnd } from './stage';
import { refreshProfessionWorld } from '../world/professionWorld';
import { getParty } from '../services/party';
import { getLanguage,t } from '../ui/i18n';
import { vitalsOf } from '../data/stats';
import { MAX_LEVEL,unspentAttributePoints } from '../data/data';
import { chatCombat } from '../ui/chatWindow';
import { combatSoundAt } from './combatSound';

const floats:{el:HTMLElement;position:THREE.Vector3;born:number;side:number;duration:number}[]=[];
const particles:{mesh:THREE.Mesh;born:number;velocity:THREE.Vector3}[]=[];
const projectiles:{mesh:THREE.Mesh;from:THREE.Vector3;to:THREE.Vector3;born:number;duration:number;follow?:THREE.Vector3}[]=[];
const trails:{mesh:THREE.Mesh;born:number;duration:number}[]=[];
const sparkGeometry=new THREE.IcosahedronGeometry(.035,0),boltGeometry=new THREE.ConeGeometry(.025,.28,5),orbGeometry=new THREE.IcosahedronGeometry(.075,1);
const slashGeometry=new THREE.RingGeometry(.43,.54,20,1,-.8,2.4);
const chargeGeometry=new THREE.RingGeometry(.23,.27,24);
const impactGeometry=new THREE.RingGeometry(.12,.19,24);
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
let floatSequence=0;
function removeEffect(mesh:THREE.Mesh){mesh.removeFromParent();(mesh.material as THREE.Material).dispose();}
function trimEffects(){while(particles.length>90)removeEffect(particles.shift()!.mesh);while(trails.length>12)removeEffect(trails.shift()!.mesh);while(projectiles.length>12)removeEffect(projectiles.shift()!.mesh);}
export function combatProjectile(origin:THREE.Vector3,target:THREE.Vector3,cls:string,travelSeconds?:number,strong=false,follow?:THREE.Vector3){
 const from=origin.clone().add(new THREE.Vector3(0,1,0)),to=target.clone().add(new THREE.Vector3(0,.85,0));
 const bolt=cls==='explorador',mesh=new THREE.Mesh(bolt?boltGeometry:orbGeometry,new THREE.MeshBasicMaterial({color:bolt?'#d8bc8a':cls==='shadow'?'#bd75f1':cls==='clerigo'?'#f3dba0':'#9ccddd',transparent:true,depthWrite:false}));
 mesh.position.copy(from);if(bolt)mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),to.clone().sub(from).normalize());mesh.raycast=()=>{};scene.add(mesh);
 mesh.name='combat-projectile';
  mesh.scale.setScalar(strong?1.45:1);
 mesh.userData.impactKind=cls==='shadow'?'dark':'damage';mesh.userData.strong=strong;
 mesh.userData.soundVoice=cls;
 const duration=Number.isFinite(travelSeconds)?Math.max(.04,travelSeconds!):Math.min(.28,.1+from.distanceTo(to)*.018);
 projectiles.push({mesh,from,to,born:performance.now(),duration,follow});trimEffects();return duration;
}
export function combatCharge(position:THREE.Vector3,cls:string,duration:number){
 const mesh=new THREE.Mesh(chargeGeometry,new THREE.MeshBasicMaterial({color:cls==='clerigo'?'#f4e3a0':cls==='mago'?'#a2d4ef':'#f2cf8e',transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
 mesh.name='combat-charge';mesh.position.copy(position).y+=1;mesh.lookAt(camera.position);mesh.raycast=()=>{};scene.add(mesh);trails.push({mesh,born:performance.now(),duration});trimEffects();
}
export function combatSlash(position:THREE.Vector3,skill=false,double=false){
 const count=double?2:1;
 for(let i=0;i<count;i++){
  const mesh=new THREE.Mesh(slashGeometry,new THREE.MeshBasicMaterial({color:double?'#c3e1e7':skill?'#ffe2a5':'#f4edce',transparent:true,opacity:.8,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
  mesh.name='combat-slash';mesh.position.copy(position);mesh.position.y+=.9+i*.13;mesh.lookAt(camera.position);mesh.rotateZ(i?1.1:-.7);mesh.scale.setScalar(skill?1.3:1);mesh.visible=i===0;mesh.raycast=()=>{};scene.add(mesh);
  trails.push({mesh,born:performance.now()+i*360,duration:skill?.3:.22});
 }trimEffects();
}
let panel:HTMLElement|null=null,lastWorld=0;
let healSelect:HTMLSelectElement,lastChoices='';

export function combatFloat(amount:number,position:THREE.Vector3,kind='damage'){
 if(!Number.isFinite(amount)||amount<=0)return;
 while(floats.length>=30)floats.shift()!.el.remove();
 const el=document.createElement('span');el.className=`combat-float ${kind}`;
 const number=Math.max(.1,Math.round(amount*10)/10).toLocaleString(getLanguage()==='en'?'en-US':'es-ES',{maximumFractionDigits:1});
 el.textContent=`${kind==='healing'||kind==='experience'?'+':kind==='incoming'?'−':''}${number}${kind==='experience'?' EXP':''}`;el.setAttribute('aria-hidden','true');document.body.append(el);
 // Alternate small lanes so simultaneous hits on one actor remain legible.
 const lane=(floatSequence++%5)-2;
 floats.push({el,position:position.clone().add(new THREE.Vector3(0,1.7+Math.abs(lane)*.07,0)),born:performance.now(),side:lane*19,duration:kind==='experience'?1.8:kind==='skill'?1.5:1.2});
}
export function combatImpact(position:THREE.Vector3,kind='damage',strong=false){
 const color=kind==='incoming'?0xef927f:kind==='fire'?0xffa857:kind==='dark'?0xb78bea:kind==='frost'?0xa5eafa:kind==='lightning'?0xaad6ff:kind==='healing'?0xa7df9e:0xf2d496;
 const count=reducedMotion.matches?3:lowEnd?(strong?6:4):(strong?10:6);
 for(let i=0;i<count;i++){const mesh=new THREE.Mesh(sparkGeometry,new THREE.MeshBasicMaterial({color,transparent:true,depthWrite:false}));mesh.position.copy(position).y+=.8;mesh.scale.setScalar(strong?1.4:1);mesh.raycast=()=>{};scene.add(mesh);particles.push({mesh,born:performance.now(),velocity:new THREE.Vector3(Math.sin(i*2.4)*(strong?1.7:1.1),.5+Math.random(),Math.cos(i*2.4)*(strong?1.7:1.1))});}trimEffects();
 const flash=new THREE.Mesh(impactGeometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
 flash.name='combat-impact';flash.position.copy(position).y+=.9;flash.lookAt(camera.position);flash.scale.setScalar(strong?2.4:1.5);flash.raycast=()=>{};scene.add(flash);trails.push({mesh:flash,born:performance.now(),duration:reducedMotion.matches?.12:.24});trimEffects();
}

let rewardPanel:HTMLElement|null=null,rewardUntil=0,rewardXp=0,rewardCoins=0;
function ensureRewardPanel(){
 if(rewardPanel)return rewardPanel;
 rewardPanel=document.createElement('section');rewardPanel.id='combat-reward';rewardPanel.hidden=true;
 rewardPanel.setAttribute('role','status');rewardPanel.setAttribute('aria-live','polite');rewardPanel.setAttribute('aria-atomic','true');
 rewardPanel.innerHTML='<small></small><strong></strong><span></span>';document.body.append(rewardPanel);return rewardPanel;
}
/** Group nearby kills into one readable receipt; it never takes focus or opens a window. */
export function combatReward(xp:number,coins=0){
 xp=Number.isFinite(xp)?Math.max(0,xp):0;coins=Number.isFinite(coins)?Math.max(0,coins):0;
 if(!xp&&!coins)return;
 const now=performance.now();if(now>rewardUntil){rewardXp=0;rewardCoins=0;}
 rewardXp+=xp;rewardCoins+=coins;rewardUntil=now+5500;
 const panel=ensureRewardPanel();panel.hidden=false;panel.querySelector('small')!.textContent=t('Recompensas de combate');
 panel.querySelector('strong')!.textContent=[rewardXp?`+${rewardXp} EXP`:'',rewardCoins?t('+{n} Pelines',{n:rewardCoins}):''].filter(Boolean).join(' · ');
 combatFloat(xp,holder.position,'experience');chatCombat(`+${xp} EXP${coins?` · +${coins} ${t('Pelines')}`:''}.`);
 const bar=document.querySelector('.hud-xp');bar?.classList.remove('gain');requestAnimationFrame(()=>{if(play.mode==='play')bar?.classList.add('gain');});
}
export function combatLevelUp(){
 const title=document.getElementById('levelup-title'),banner=document.getElementById('levelup-banner'),points=document.getElementById('levelup-points');
 if(title)title.textContent=t('Nivel {n}',{n:session.state.level});
 if(points){const count=unspentAttributePoints(session.state);points.hidden=count<=0;points.textContent=t('Puntos de atributo disponibles: {n}',{n:count});}
 if(banner){banner.classList.remove('show');requestAnimationFrame(()=>{if(play.mode==='play')banner.classList.add('show');});}
 chatCombat(t('¡Has subido al nivel {n}!',{n:session.state.level}));
}
export function tickCombatFeedback(dt:number){
 dt=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;
 const now=performance.now();
 if(rewardPanel){
  rewardPanel.hidden=play.mode!=='play'||now>=rewardUntil;
  if(!rewardPanel.hidden){const v=vitalsOf(session.state);const line=session.state.level>=MAX_LEVEL?t('Nivel máximo'):t('Nivel {level} · {current} / {needed} EXP · faltan {remaining}',{level:session.state.level,current:v.experience,needed:v.experienceNeeded,remaining:Math.max(0,v.experienceNeeded-v.experience)});const detail=rewardPanel.querySelector('span')!;if(detail.textContent!==line)detail.textContent=line;}
 }
 for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i],progress=(now-p.born)/(p.duration*1000);if(p.follow){p.to.copy(p.follow);p.to.y+=.85;}if(progress>=1||play.mode!=='play'){if(play.mode==='play'){
  const point=p.to.clone().add(new THREE.Vector3(0,-.85,0));
  combatImpact(point,p.mesh.userData.impactKind,p.mesh.userData.strong);
  combatSoundAt('impact',p.mesh.userData.soundVoice,point,p.mesh.userData.strong);
 }removeEffect(p.mesh);projectiles.splice(i,1);}else{p.mesh.position.lerpVectors(p.from,p.to,progress);}}
 for(let i=particles.length-1;i>=0;i--){const p=particles[i],age=(now-p.born)/1000;if(age>.4){removeEffect(p.mesh);particles.splice(i,1);continue;}p.mesh.position.addScaledVector(p.velocity,dt);p.velocity.y-=dt*3;(p.mesh.material as THREE.MeshBasicMaterial).opacity=1-age/.4;}
 for(let i=trails.length-1;i>=0;i--){const trail=trails[i],age=(now-trail.born)/1000;if(age>trail.duration){removeEffect(trail.mesh);trails.splice(i,1);continue;}trail.mesh.visible=age>=0;(trail.mesh.material as THREE.MeshBasicMaterial).opacity=Math.max(0,1-age/trail.duration)*.8;if(trail.mesh.name==='combat-impact'&&!reducedMotion.matches)trail.mesh.scale.multiplyScalar(1+dt*4);else trail.mesh.rotateZ(dt*1.8);}
 if(play.city&&now-lastWorld>1000){refreshProfessionWorld(play.city,session.state.rpg);lastWorld=now;}

 if(!panel){
  panel=document.createElement('section');panel.className='combat-dashboard';
  const label=document.createElement('label');label.htmlFor='combat-heal-target';label.textContent=t('Objetivo de curación');
  healSelect=document.createElement('select');healSelect.id='combat-heal-target';healSelect.style.pointerEvents='auto';
  healSelect.onchange=()=>{fight.healTarget=healSelect.value||null;};
  panel.append(label,healSelect);document.body.append(panel);
 }
 const members=getParty().members,active=play.mode==='play'&&session.state.cls==='clerigo'&&members.length>1;
 panel.hidden=!active;
 if(!active){fight.healTarget=null;return;}
 const choices=JSON.stringify([session.activeCharacterId,members.map(m=>[m.characterId,m.data.name]),getLanguage()]);
 if(choices!==lastChoices){
  lastChoices=choices;healSelect.replaceChildren();
  panel.querySelector('label')!.textContent=t('Objetivo de curación');
  const self=document.createElement('option');self.value='';self.textContent=t('Yo');healSelect.append(self);
  for(const m of members)if(m.characterId!==session.activeCharacterId){const option=document.createElement('option');option.value=m.characterId;option.textContent=m.data.name;healSelect.append(option);}
  healSelect.value=fight.healTarget??'';if(healSelect.selectedIndex<0){fight.healTarget=null;healSelect.value='';}
 }
}

const feedbackPoint=new THREE.Vector3();
export function projectCombatFeedback(){const now=performance.now(),point=feedbackPoint;
 for(let i=floats.length-1;i>=0;i--){const f=floats[i],age=(now-f.born)/1000;if(age>f.duration||play.mode!=='play'){f.el.remove();floats.splice(i,1);continue;}point.copy(f.position);point.y+=reducedMotion.matches?0:age*.8;point.project(camera);f.el.hidden=!Number.isFinite(point.x)||point.z>1||point.z< -1||Math.abs(point.x)>1.15||Math.abs(point.y)>1.15;f.el.style.left=`${(point.x*.5+.5)*innerWidth+f.side*(reducedMotion.matches?.4:age)}px`;f.el.style.top=`${(-point.y*.5+.5)*innerHeight}px`;f.el.style.opacity=String(Math.min(1,(f.duration-age)*3));}
}
export function clearCombatFeedback(){for(const f of floats)f.el.remove();floats.length=0;for(const p of [...particles,...projectiles,...trails])removeEffect(p.mesh);particles.length=0;projectiles.length=0;trails.length=0;floatSequence=0;if(panel)panel.hidden=true;if(rewardPanel)rewardPanel.hidden=true;rewardUntil=rewardXp=rewardCoins=0;lastChoices='';fight.healTarget=null;}
