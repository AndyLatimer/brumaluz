// Combate contra la criatura: objetivo, ataques, habilidades, cuerpo y botín.
import * as THREE from 'three';
import { renderActionBar, explainAction } from '../ui/actionBar';
import { fight, session, play, vitals, ui } from './state';
import { updateShadowEnemy, buildShadowEnemy, playShadowEnemyAction, resetShadowEnemy } from '../world/shadowEnemy';
import { COMBAT_KITS, resolveCombat, skillRank, skillCost, attackInterval } from '../data/combat';
import { absorbBarrier } from '../data/enchantments';
import { combatFloat, combatImpact, combatProjectile, combatSlash, combatCharge, combatReward, combatLevelUp, tickCombatFeedback } from './combatFeedback';
import { vitalsOf } from '../data/stats';
import { guardedDamage } from '../data/weapons';
import { hasCombatWeapon } from '../data/equipment';
import { parseCombatEncounter, parsePublicVitals } from '../services/multiplayer';
import { castShadows } from '../world/render';
import { chatCombat } from '../ui/chatWindow';
import { t } from '../ui/i18n';
import { parseShadowQuest } from '../data/quests';
import { lootCorpse, startCombat, combatAction, wildernessAction } from '../services/account';
import { beginWilderness, confirmWildernessTarget, selectedWildernessEncounter, receiveWilderness, tickWilderness, wildernessRoot, wildernessCombatTargets } from './wilderness';
import { addItem } from '../services/devActions';
import { holder, playerVel, TEST, marker, scene, clock, camera, LOCAL_COMBAT_SITE } from './stage';
import { toast } from '../ui/toast';
import { $ } from '../ui/dom';
import { respawn, resetOverheal, die } from './vitals';
import { setWindow } from '../ui/menus';
import { updateHud } from './hud';
import { characterContext } from './avatar';
import { runOnServer, errorMessage } from './server';
import { isbertoUnlocked } from '../story/quests';
import { expeditionAction, healAlly } from '../services/account';
import { sanitize } from '../data/data';
import { remotePlayers } from './worldClient';
import { acceptSnapshot } from './snapshotOrder';
import combatTiming from '../data/combatTiming.json';
import combatDuration from '../data/combatDuration.json';
import { predictSkillCooldown,finishSkillCooldown,cancelSkillCooldown,syncSkillCooldown,cooldownSample,releasePendingSkillCooldown } from './skillCooldown';
import { serverNow } from '../data/worldClock';
import { combatAudio } from './audio';
import { combatSoundAt } from './combatSound';
import { SHADOW_COMBAT,shadowAttack,shadowWindup } from '../data/shadowCombat';
import { tickCombatTutorial, noteTutorialAction, resetCombatTutorial } from './combatTutorial';

const retiredExpeditions=new Set<string>();
let pendingSkillUntil=0,actionRecoveryUntil=0;
let lastAction:'attack'|'skill'='attack';
let actionSerial=0;
let castingSkill:{started:number;impactAt:number}|null=null;
let preparingAction=false;
let recoveryDuration=0;
let combatGeneration=0,attackRequestAfter=0;
const requests:{attack:AbortController|null;skill:AbortController|null}={attack:null,skill:null};
export function getCombatActionFeedback(){
 const now=performance.now();
 if(castingSkill&&fight.combatBusy&&now<castingSkill.impactAt)return{state:'casting' as const,remaining:(castingSkill.impactAt-now)/1000,duration:(castingSkill.impactAt-castingSkill.started)/1000};
 if(fight.pendingCombatSkill)return{state:'approaching' as const,remaining:Math.max(0,(pendingSkillUntil-now)/1000),duration:10};
 if(now<actionRecoveryUntil)return{state:'recovering' as const,remaining:(actionRecoveryUntil-now)/1000,duration:recoveryDuration,interruptible:lastAction==='attack'};
 return{state:'idle' as const,remaining:0,duration:0};
}
export function resetCombatActions(){actionSerial++;combatGeneration++;requests.attack?.abort();requests.skill?.abort();requests.attack=requests.skill=null;releasePendingSkillCooldown();attackRequestAfter=0;pendingSkillUntil=0;actionRecoveryUntil=0;castingSkill=null;preparingAction=false;lastAction='attack';fight.facingUntil=0;fight.nextCombatAttack=0;fight.combatBusy=false;fight.pendingCombatSkill=false;resetCombatTutorial();}
export function cycleCombatTarget(reverse=false){
 if(play.dead||play.mode!=='play')return;
 const origin=holder.position.clone();origin.y+=1.2;
 const choices=wildernessCombatTargets().filter(target=>holder.position.distanceToSquared(target.root.position)<=100&&ui.targetFrame.canSee(target,origin)).sort((a,b)=>holder.position.distanceToSquared(a.root.position)-holder.position.distanceToSquared(b.root.position)||a.id.localeCompare(b.id));
 if(!choices.length){if(fight.combatEncounter?.status==='active')lockCombatTarget(true);return;}
 const current=choices.findIndex(target=>target.id==='wild:'+fight.combatEncounter?.spawn),index=current<0?0:(current+(reverse?-1:1)+choices.length)%choices.length;
 void beginWilderness(choices[index].id.slice(5));
}
export async function selectExpeditionTarget(index:number){
 if(!session.activeCharacterId)return;const current=characterContext();try{const result=await expeditionAction(session.activeCharacterId,'target',index);if(current())applyCombatResult(result);}catch(error){toast('Objetivo',errorMessage(error),true);}
}
export async function leaveExpedition(){if(!session.activeCharacterId)return;const current=characterContext();try{const result=await expeditionAction(session.activeCharacterId,'leave');if(current()){applyCombatResult(result);releaseCombatTarget();}}catch(error){toast('Expedición',errorMessage(error),true);}}

export function tickWorldCombat(time:number,dt:number) {
  tickWilderness(time,dt);
  tickCombatFeedback(dt);
  renderActionBar();
  tickCombatTutorial();
  if(!fight.combatTargetRoot)return;
  const active = fight.combatEncounter?.status === 'active';
  updateShadowEnemy(fight.combatTargetRoot,time,dt,holder.position,active);
  if(!active)return;
  const ring = fight.combatTargetRoot.getObjectByName('combat-lock-ring');
  if (ring) ring.visible = fight.lockedEnemy;
  if (fight.lockedEnemy && fight.combatTargetRoot.position.distanceTo(holder.position) > 35) releaseCombatTarget();
  const kit=COMBAT_KITS[session.state.cls];
  const distance=Math.hypot(fight.combatTargetRoot.position.x-holder.position.x,fight.combatTargetRoot.position.z-holder.position.z);
  if(fight.pendingCombatSkill&&performance.now()>pendingSkillUntil){fight.pendingCombatSkill=false;explainAction(t('No has llegado a tiempo. Acércate y vuelve a usar la habilidad.'));}
  if(fight.pendingCombatSkill&&!fight.combatBusy&&performance.now()>=actionRecoveryUntil&&fight.lockedEnemy&&distance<=kit.range){
    fight.pendingCombatSkill=false;play.moveTarget=null;
    useWorldCombatSkill();return;
  }
  const wallTime=performance.now()/1000;
  if(TEST&&!session.activeCharacterId&&fight.localCombatState&&fight.localCombatState.health>0&&wallTime>=fight.nextLocalEnemyAttack){
    const encounter=fight.combatEncounter!;
    if(!encounter.windup && distance<=(encounter.engaged?SHADOW_COMBAT.range:SHADOW_COMBAT.aggro)){
      const attackKind=shadowAttack(distance,encounter.attackSeq??0);
      setCombatEncounter({...encounter,engaged:true,attackKind,windup:serverNow()+shadowWindup(attackKind),aimX:holder.position.x,aimZ:holder.position.z,attackSeq:(encounter.attackSeq??0)+1});
    } else if(encounter.windup && serverNow()>=encounter.windup){
      fight.nextLocalEnemyAttack=wallTime+SHADOW_COMBAT.recovery;
      const cleared={...encounter,windup:undefined};
      const from=holder.position.clone();from.y+=1;
      const to=fight.combatTargetRoot.position.clone();to.y+=1;
      const kind=encounter.attackKind??'area';
      const missed=kind==='area'?Math.hypot(holder.position.x-encounter.aimX!,holder.position.z-encounter.aimZ!)>SHADOW_COMBAT.radius:kind==='melee'?distance>SHADOW_COMBAT.meleeRange:false;
      if(distance>SHADOW_COMBAT.range||missed||play.city.lineOfSight?.(from,to)===false){setCombatEncounter(cleared);return;}
      const current = vitalsOf(session.state);
      const incoming = absorbBarrier(session.state,guardedDamage(session.state.cls,session.state.equipment,SHADOW_COMBAT.damage[kind],session.state),performance.now()/1000), absorbed = Math.min(current.overheal,incoming);
      fight.localCombatState={...fight.localCombatState,health:Math.max(0,current.health-(incoming-absorbed)),maxHealth:current.maxHealth,resource:current.resource};
      const vitals=vitalsOf(session.state);
      applyCombatResult({
        encounter:cleared,
        vitals:{health:fight.localCombatState.health,maxHealth:fight.localCombatState.maxHealth,overheal:current.overheal-absorbed,
          resource:fight.localCombatState.resource,maxResource:vitals.maxResource,resourceKind:vitals.resourceKind},
        damage:0,healing:0,
      });
      return;
    }
  }
  if(play.dead||!fight.lockedEnemy||!fight.combatAuto||fight.combatBusy||performance.now()<actionRecoveryUntil)return;
  if(distance>kit.range)return;
  if(time<fight.nextCombatAttack)return;
  void performWorldCombatAction('attack');
}
export function useWorldCombatSkill() {
  if (play.mode !== 'play' || play.dead) return;
  const now=performance.now();
  if (now < vitals.skillReadyAt) {explainAction(t('Recuperándose: {n} s',{n:((vitals.skillReadyAt-now)/1000).toFixed(1)}));return;}
  const kit = COMBAT_KITS[session.state.cls];
  if (!hasCombatWeapon(session.state)) { explainAction(t('Equipa un arma de tu clase.')); return; }
  if (vitalsOf(session.state).resource < skillCost(session.state)) { explainAction(t('Recurso insuficiente: {current} / {cost}.',{current:Math.floor(vitalsOf(session.state).resource),cost:Math.ceil(skillCost(session.state))})); return; }
  if(kit.skill.healing&&!fight.healTarget){const v=vitalsOf(session.state);if(v.health>=v.maxHealth){explainAction(t('Ya tienes la vida completa.'));return;}}
  if (!kit.skill.healing && fight.combatEncounter?.status !== 'active') {
    const target=ui.targetFrame.current()?.id;
    if(target?.startsWith('wild:')){void beginWilderness(target.slice(5)).then(success=>{if(success)useWorldCombatSkill();});return;}
    explainAction(t('Haz clic en un enemigo para usar tu habilidad.')); return;
  }
  // A valid deliberate skill takes priority over an automatic swing that has
  // not landed. Released attacks finish once; no input is stored for later.
  if(fight.combatBusy&&preparingAction&&lastAction==='attack'){
    actionSerial++;preparingAction=false;fight.combatBusy=false;actionRecoveryUntil=0;
  }
  if(fight.combatBusy||requests.skill)return;
  if(lastAction==='skill'&&now<actionRecoveryUntil){explainAction(t('Terminando la habilidad: {n} s',{n:((actionRecoveryUntil-now)/1000).toFixed(1)}));return;}
  if(!kit.skill.healing&&!fight.lockedEnemy)lockCombatTarget(true);
  if(session.state.cls!=='clerigo'&&fight.combatTargetRoot){
    const range=COMBAT_KITS[session.state.cls].range;
    const distance=Math.hypot(fight.combatTargetRoot.position.x-holder.position.x,fight.combatTargetRoot.position.z-holder.position.z);
    if(distance>range){
      fight.pendingCombatSkill=true;pendingSkillUntil=performance.now()+10000;fight.combatAuto=true;fight.combatApproach=true;
      play.moveTarget=null;marker.visible=false;
      return;
    }
  }
  fight.pendingCombatSkill=false;
  if(lastAction==='attack')actionRecoveryUntil=0;
  void performWorldCombatAction('skill');
}
export function releaseCombatTarget() {
  // Cancel a preparation that has not reached the server yet.
  if(preparingAction){actionSerial++;preparingAction=false;fight.combatBusy=false;castingSkill=null;actionRecoveryUntil=0;fight.facingUntil=0;}
  pendingSkillUntil=0;
  fight.lockedEnemy = false; fight.combatAuto = false; fight.combatApproach = false; fight.pendingCombatSkill = false;
  play.moveTarget = null; marker.visible = false;
}
export function lockCombatTarget(clicked = false) {
  const hovered=ui.targetFrame.current()?.id;if(!clicked&&hovered?.startsWith('wild:')){if(fight.combatEncounter?.spawn===hovered.slice(5)&&fight.combatEncounter.status==='active')lockCombatTarget(true);else void beginWilderness(hovered.slice(5));return;}
  if (!hasCombatWeapon(session.state)) { explainAction(t('Equipa un arma de tu clase.')); return; }
  if (fight.combatEncounter?.status !== 'active' || !fight.combatTargetRoot || (!clicked && ui.targetFrame.current()?.id !== 'enemy:shadowling')) {
    explainAction(t('Haz clic en un enemigo para empezar a atacar.')); return;
  }
  fight.lockedEnemy = true; fight.combatAuto = true; fight.combatApproach = true; fight.pendingCombatSkill = false;
  play.pendingTalk=null;play.moveTarget=null;marker.visible=false;
}
export function setCombatEncounter(value:unknown,selected=false) {
  const preferred=!selected&&fight.lockedEnemy?selectedWildernessEncounter():null;
  if(preferred)value=preferred;
  const previousInstance=fight.combatEncounter?.instanceId;
  const previousStatus = fight.combatEncounter?.status;
  const previousHealth = fight.combatEncounter?.health;
  const previousAttack = fight.combatEncounter?.attackSeq;
  fight.combatEncounter=parseCombatEncounter(value);
  if(selected&&fight.combatEncounter?.instanceId!==previousInstance){
    requests.attack?.abort();requests.attack=null;attackRequestAfter=0;
    if(preparingAction){actionSerial++;preparingAction=false;fight.combatBusy=false;castingSkill=null;actionRecoveryUntil=0;}
  }
  // Retirar también los encuentros provisionales guardados antes de quitar su acceso.
  if(fight.combatEncounter?.kind==='expedition'){
    fight.combatEncounter=null;
    const character=session.activeCharacterId;
    if(character&&!retiredExpeditions.has(character)){retiredExpeditions.add(character);void leaveExpedition();}
  }
  const wild=fight.combatEncounter?.kind==='wilderness';
  if(!wild&&fight.combatEncounter?.status==='active'&&previousInstance!==fight.combatEncounter.instanceId){
    resetCombatActions();
    if(fight.combatTargetRoot?.userData.shadowEnemyRig)resetShadowEnemy(fight.combatTargetRoot,clock.getElapsedTime());
  }
  if(wild&&fight.combatEncounter?.status==='active'&&previousInstance!==fight.combatEncounter.instanceId){fight.lockedEnemy=hasCombatWeapon(session.state);fight.combatAuto=fight.lockedEnemy;fight.combatApproach=false;}
  if(wild&&fight.combatTargetRoot?.userData.wildSpawn!==fight.combatEncounter?.spawn){fight.combatTargetRoot=null;fight.pendingCombatSkill=false;}
  if((wild?play.city.locationId==='pompelin':play.city.locationId==='brumaluz') && (fight.combatEncounter?.status==='active'||(fight.combatEncounter?.status==='defeated' && !fight.combatEncounter.looted))){
    if(!fight.combatTargetRoot){
      fight.combatTargetRoot=wild?wildernessRoot(fight.combatEncounter):buildShadowEnemy(fight.combatEncounter.x,fight.combatEncounter.z,play.city.groundY(fight.combatEncounter.x,fight.combatEncounter.z));
      if(!fight.combatTargetRoot)return;
      castShadows(fight.combatTargetRoot);
      scene.add(fight.combatTargetRoot);
    }
    if(!wild)fight.combatTargetRoot.position.set(fight.combatEncounter.x,play.city.groundY(fight.combatEncounter.x,fight.combatEncounter.z),fight.combatEncounter.z);
    const corpse = fight.combatEncounter.status === 'defeated';
    fight.combatTargetRoot.name = corpse ? 'combat-corpse' : 'combat-enemy';
    if (!wild&&corpse && previousStatus !== 'defeated') {
      playShadowEnemyAction(fight.combatTargetRoot,'death',clock.getElapsedTime());
      if(previousStatus==='active')combatSoundAt('death','shadow',fight.combatTargetRoot.position);
    }
    else if(!wild&&fight.combatEncounter.windup&&fight.combatEncounter.attackSeq!==previousAttack){
      const remaining=Math.max(.05,fight.combatEncounter.windup-serverNow());
      playShadowEnemyAction(fight.combatTargetRoot,'prepare',clock.getElapsedTime(),remaining);
      combatSoundAt('warning','shadow',fight.combatTargetRoot.position);
      combatSoundAt('enemy','shadow',fight.combatTargetRoot.position);
      if(fight.combatEncounter.attackKind==='bolt')combatProjectile(fight.combatTargetRoot.position,holder.position,'shadow',remaining,false,holder.position);
    }
    else if (!wild&&!corpse && previousInstance===fight.combatEncounter.instanceId && previousStatus === 'active' && previousHealth !== undefined && fight.combatEncounter.health < previousHealth) {
      playShadowEnemyAction(fight.combatTargetRoot,'hit',clock.getElapsedTime());
    }
    if (corpse) releaseCombatTarget();
    const ring = fight.combatTargetRoot.getObjectByName('combat-lock-ring');
    if (ring) ring.visible = !corpse && fight.lockedEnemy;
    fight.combatTargetRoot.userData.looted = fight.combatEncounter.looted;
    if (corpse && previousStatus !== 'defeated') chatCombat(wild?`${fight.combatEncounter.label} ha caído.`:t('La criatura extraña ha caído.'));
  }else{
    if (ui.openWindow === 'loot'&&!fight.lootEncounter?.shared) setWindow(null, false);
    if(fight.combatTargetRoot){
      if(!fight.combatTargetRoot.userData.wildernessActor){scene.remove(fight.combatTargetRoot);
      fight.combatTargetRoot.traverse(part=>{
        const mesh=part as THREE.Mesh;
        if(mesh.isMesh){mesh.geometry.dispose();for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])material.dispose();}
      });}
      fight.combatTargetRoot=null;
    }
    releaseCombatTarget();
  }
}
export function applyCombatResult(value:Record<string,unknown>) {
  const beforeLevel=session.state.level;
  receiveWilderness(value);
  const before=vitalsOf(session.state).health;
  const data=value.data&&typeof value.data==='object'?value.data as Record<string,unknown>:null;
  const revision=(value.vitals as {serverRevision?:number}|undefined)?.serverRevision??data?.serverRevision;
  const current=acceptSnapshot('vitals',revision);
  if(data&&acceptSnapshot('full',revision)){
    const next=sanitize(data);
    if(!current){next.health=session.state.health;next.resource=session.state.resource;next.overheal=session.state.overheal;next.enchantState=session.state.enchantState;}
    Object.assign(session.state,next);
  }
  if(current&&value.enchantState&&typeof value.enchantState==='object')session.state.enchantState=value.enchantState as typeof session.state.enchantState;
  if(current&&value.vitals) {
    const vitals=parsePublicVitals(value.vitals);
    session.state.health=vitals.health;session.state.resource=vitals.resource;session.state.overheal=vitals.overheal;
  }
  if(current&&!value.preserveTarget&&value.encounter!==undefined)setCombatEncounter(value.encounter);
  if(current&&value.reward&&typeof value.reward==='object'&&!value.wilderness){const reward=value.reward as {xp:number;coins:number};combatReward(reward.xp,reward.coins);}
  if(current&&value.quest !== undefined) session.state.shadowQuest = parseShadowQuest(value.quest);
  if(current&&!(value.predictedAction&&value.action==='skill'))syncSkillCooldown(cooldownSample(value));
  if(session.state.health===0&&fight.combatEncounter?.status==='active')setCombatEncounter({...fight.combatEncounter,status:'failed'});
  resetOverheal();updateHud();
  if(session.state.level>beforeLevel)combatLevelUp();
  if(vitalsOf(session.state).health<before)combatAudio.play('incoming');
  if(value.predictedAction)noteTutorialAction(value.action==='skill'?'skill':'attack',Number(value.damage??0),Number(value.healing??0));
  if(vitalsOf(session.state).health<before){if(!fight.combatBusy)play.char.hit();combatFloat(before-vitalsOf(session.state).health,holder.position,'incoming');combatImpact(holder.position,'incoming');chatCombat(fight.combatEncounter?.kind==='wilderness'?`${fight.combatEncounter.label} te hiere.`:t('La criatura extraña te hiere.'));}
  if(session.state.health===0&&!play.dead)die();
  if(typeof value.damage==='number'&&value.damage>0){
    if(!value.predictedContact)combatSoundAt('impact',session.state.cls,holder.position,value.action==='skill');
    if(!value.predictedAction)play.char.attack(value.action==='skill');
    const impact=value.impact as {x?:number;z?:number;label?:string}|undefined;
    const point=typeof impact?.x==='number'&&typeof impact.z==='number'?new THREE.Vector3(impact.x,play.city.groundY(impact.x,impact.z),impact.z):fight.combatTargetRoot?.position;
    if(point){combatFloat(value.damage,point,value.action==='skill'?'skill':'damage');if(!value.predictedContact){combatImpact(point,'damage',value.action==='skill');if(session.state.cls==='guerrero'||session.state.cls==='picaro')combatSlash(point,value.action==='skill',session.state.cls==='picaro'&&value.action==='skill');}}
    chatCombat(impact?.label?`Golpeas a ${impact.label} por ${Math.round(value.damage*10)/10}.`:fight.combatEncounter?.kind==='wilderness'?`Golpeas a ${fight.combatEncounter.label} por ${Math.round(value.damage*10)/10}.`:t('Golpeas a la criatura extraña por {n}.',{n:value.damage}));
  }
  if(Array.isArray(value.events))for(const event of value.events){
    if(!event||typeof event!=='object'||!['fire','dark','frost','lightning'].includes(event.kind))continue;
    const position=event.kind==='frost'?holder.position:typeof event.x==='number'&&typeof event.z==='number'?new THREE.Vector3(event.x,play.city.groundY(event.x,event.z),event.z):fight.combatTargetRoot?.position;
    if(position)combatImpact(position,event.kind);
  }
  if(typeof value.healing==='number'&&value.healing>0){
    combatAudio.play('healing');
    const target=typeof value.healTarget==='string'?remotePlayers.list().find(p=>p.id===value.healTarget)?.root.position:undefined;
    if(!value.predictedAction){if(value.action==='skill')play.char.attack(true);else play.char.heal();}combatFloat(value.healing,target??holder.position,'healing');combatImpact(target??holder.position,'healing');chatCombat(t('Curación: {n}.',{n:value.healing}),'heal');
  }
  if(fight.combatEncounter?.status==='defeated'){
    fight.combatAuto=false;
  }
}
export async function collectCorpseLoot(slot: number | null) {
  const corpse = fight.lootEncounter??fight.combatEncounter,root=fight.lootTargetRoot??fight.combatTargetRoot;
  if (!corpse || corpse.status !== 'defeated' || !corpse.instanceId || !root) return false;
  if (holder.position.distanceTo(root.position) > 3) {
    toast('Botín', 'Acércate al cuerpo para recoger el botín.', true); return false;
  }
  const instanceId = corpse.instanceId;
  const stillCurrent = characterContext();
  const success = await runOnServer(async id => {if(corpse.kind==='wilderness'){const result=await wildernessAction(id,'loot',instanceId,slot);if(stillCurrent())receiveWilderness(result);return result.data as Record<string,unknown>;}return lootCorpse(id, instanceId, slot);}, () => {
    const remaining = corpse.loot.map(item => item ? { ...item } : null);
    const inventory = session.state.inventory.map(item => item ? { ...item } : null);
    try {
      remaining.forEach((item, i) => {
        if (!item || (slot !== null && slot !== i)) return;
        for (let n = 0; n < item.count; n++) addItem(session.state, item.id);
        remaining[i] = null;
      });
    } catch (error) { session.state.inventory = inventory; throw error; }
    const looted = remaining.every(item => !item);
    setCombatEncounter({ ...corpse, loot: remaining, looted });
  });
  if (!success || !stillCurrent()) return false;
  updateHud();
  if (ui.openWindow === 'loot') {const empty=corpse.shared?!fight.lootEncounter:fight.combatEncounter?.looted;setWindow(empty?null:'loot', false);}
  return true;
}
export const lootAnchor = new THREE.Vector3();
export function positionLootWindow() {
  const corpse=fight.lootEncounter??fight.combatEncounter,root=fight.lootTargetRoot??fight.combatTargetRoot;
  if (!root || !corpse || corpse.looted || play.dead || holder.position.distanceTo(root.position) > 3) {
    setWindow(null, false); return;
  }
  const panel = $('#window-backdrop .game-window');
  lootAnchor.copy(root.position).add(new THREE.Vector3(0, .6, 0)).project(camera);
  const x = (lootAnchor.x * .5 + .5) * innerWidth;
  const y = (-lootAnchor.y * .5 + .5) * innerHeight;
  const left = Math.max(12, Math.min(innerWidth - panel.offsetWidth - 12, x + 36));
  const top = Math.max(80, Math.min(innerHeight - panel.offsetHeight - 90, y - panel.offsetHeight * .5));
  panel.style.setProperty('--loot-left', `${left}px`);
  panel.style.setProperty('--loot-top', `${top}px`);
}
export async function beginIsbertoEncounter() {
  if (!isbertoUnlocked()) {
    toast('No se pudo iniciar el combate', t('Primero debes completar la bienvenida con Gnomi.'), true);
    return false;
  }
  if(!session.activeCharacterId){
    if(!TEST)throw new Error('Inicia sesión con un personaje para empezar el combate.');
    const vitals=vitalsOf(session.state);
    if (session.state.shadowQuest && session.state.shadowQuest !== 'active') throw new Error(t('La criatura ya ha sido derrotada. Continúa la misión.'));
    if (fight.combatEncounter?.status === 'defeated' && !fight.combatEncounter.looted) throw new Error('Recoge primero los restos de la criatura caída.');
    session.state.shadowQuest = 'active';
    fight.localCombatState={
      health:vitals.health,maxHealth:vitals.maxHealth,resource:vitals.resource,
      enemyHealth:SHADOW_COMBAT.health,nextAttack:0,nextSkill:0,
    };
    setCombatEncounter({
      id:'shadowling',status:'active',engaged:false,health:SHADOW_COMBAT.health,maxHealth:SHADOW_COMBAT.health,
      x:LOCAL_COMBAT_SITE.x+3.5,z:LOCAL_COMBAT_SITE.z,enemyAttackAt:performance.now()/1000+2,
      instanceId: crypto.randomUUID(), loot: [], looted: false,
    });
    releaseCombatTarget();fight.nextCombatAttack=0;fight.nextLocalEnemyAttack=performance.now()/1000+2;
    return true;
  }
  const stillCurrent=characterContext();
  const result=await startCombat(session.activeCharacterId);
  if(!stillCurrent())return false;
  applyCombatResult(result);
  releaseCombatTarget();fight.nextCombatAttack=0;
  return true;
}
/** Animation and input run on the local clock. At most one request per action
 * type travels to the server; a delayed basic swing never locks a skill. */
export async function performWorldCombatAction(action:'attack'|'skill') {
  const now=performance.now(),skill=action==='skill';
  if(play.mode!=='play'||play.dead||fight.combatBusy||now<actionRecoveryUntil)return;
  if(skill&&(requests.skill||now<vitals.skillReadyAt||vitalsOf(session.state).resource<skillCost(session.state)))return;
  const cls=session.state.cls,healing=skill&&cls==='clerigo';
  if(!hasCombatWeapon(session.state))return;
  const encounter=fight.combatEncounter,root=fight.combatTargetRoot;
  if(!healing&&(!fight.lockedEnemy||encounter?.status!=='active'||!root))return;
  const inReach=()=>{
    if(healing)return true;
    if(!root||Math.hypot(root.position.x-holder.position.x,root.position.z-holder.position.z)>COMBAT_KITS[cls].range)return false;
    const from=holder.position.clone();from.y+=1;const to=root.position.clone();to.y+=1;
    return play.city.lineOfSight?.(from,to)!==false;
  };
  if(!inReach())return;
  const currentCharacter=characterContext(),generation=combatGeneration,targetInstance=encounter?.instanceId;
  const targetKind=encounter?.kind,ally=fight.healTarget,characterId=session.activeCharacterId;
  const serial=++actionSerial,started=clock.getElapsedTime();
  const timing=combatTiming[cls][skill?'skill':'basic'];
  lastAction=action;recoveryDuration=combatDuration[cls][skill?'skill':'basic'];
  actionRecoveryUntil=now+recoveryDuration*1000;fight.facingUntil=actionRecoveryUntil;
  castingSkill=skill?{started:now,impactAt:now+timing*1000}:null;
  preparingAction=true;fight.combatBusy=true;
  if(!skill)fight.nextCombatAttack=started+attackInterval(cls,session.state.equipment,session.state);
  if(root&&!healing)holder.rotation.y=Math.atan2(root.position.x-holder.position.x,root.position.z-holder.position.z);
  play.char.attack(skill);if(skill)combatCharge(holder.position,cls,timing);
  combatAudio.play(skill?'skill':'swing',cls,{strong:skill});
  await new Promise<void>(resolve=>setTimeout(resolve,timing*1000));
  if(serial!==actionSerial)return;
  preparingAction=false;fight.combatBusy=false;castingSkill=null;
  if(!currentCharacter()||play.dead||generation!==combatGeneration||!healing&&(fight.combatEncounter?.instanceId!==targetInstance||fight.combatEncounter?.status!=='active')||!inReach())return;
  const impact=root?.position.clone(),releasedAt=performance.now();
  const flight=!healing&&root&&['mago','clerigo','explorador'].includes(cls)?combatProjectile(holder.position,root.position,cls,undefined,skill,root.position):0;
  if(flight||skill&&!healing)combatAudio.play('release',cls,{strong:skill});
  if(!healing&&!flight&&root){combatSlash(root.position,skill,cls==='picaro'&&skill);combatImpact(root.position,'damage',skill);combatSoundAt('impact',cls,root.position,skill);}
  const valid=()=>currentCharacter()&&!play.dead&&generation===combatGeneration;
  // Never accumulate a backlog of basic requests during a slow connection.
  // The visible swing keeps its rhythm; confirmed damage stays server-owned.
  if(!skill&&(requests.attack||releasedAt<attackRequestAfter))return;
  const cooldown=skill?predictSkillCooldown(COMBAT_KITS[cls].skill.cooldown):null;
  if(!characterId&&TEST){
    if(flight)await new Promise<void>(resolve=>setTimeout(resolve,flight*1000));
    if(!valid()||!healing&&fight.combatEncounter?.instanceId!==targetInstance){if(cooldown)cancelSkillCooldown(cooldown);return;}
    try{
      const current=vitalsOf(session.state);
      const before={health:current.health,maxHealth:current.maxHealth,resource:current.resource,enemyHealth:fight.combatEncounter?.health??0,nextAttack:fight.localCombatState?.nextAttack??0,nextSkill:fight.localCombatState?.nextSkill??0};
      const distance=root?Math.hypot(root.position.x-holder.position.x,root.position.z-holder.position.z):0;
      const result=resolveCombat(cls,before,action,releasedAt/1000,distance,session.state.level,skillRank(session.state),session.state.equipment,session.state);
      fight.localCombatState=result.state;
      if(cooldown)finishSkillCooldown(cooldown,{remaining:Math.max(0,result.state.nextSkill-performance.now()/1000)});
      applyCombatResult({predictedAction:true,predictedContact:!healing,
        ...(fight.combatEncounter?{encounter:{...fight.combatEncounter,engaged:fight.combatEncounter.engaged||result.damage.some(amount=>amount>0),health:result.state.enemyHealth,status:result.state.enemyHealth===0?'defeated':'active',...(result.state.enemyHealth===0?{loot:[{id:'esencia_sombria',count:1,bound:true}],looted:false}:{})},quest:result.state.enemyHealth===0?'defeated':'active'}:{}),
        vitals:{health:result.state.health,maxHealth:result.state.maxHealth,overheal:0,resource:result.state.resource,maxResource:vitalsOf(session.state).maxResource,resourceKind:vitalsOf(session.state).resourceKind},
        damage:result.damage.reduce((sum,hit)=>sum+hit,0),healing:result.healing,action});
    }catch(error){if(cooldown)cancelSkillCooldown(cooldown);console.debug('[combat]',errorMessage(error));}
    return;
  }
  if(!characterId){if(cooldown)cancelSkillCooldown(cooldown);return;}
  const controller=new AbortController();requests[action]=controller;
  const timeout=window.setTimeout(()=>controller.abort(),4000),requestStarted=performance.now();
  try{
    // A first click can be approaching while its selection is being accepted.
    // This wait belongs to transport, never to animation or keyboard input.
    if(targetKind==='wilderness'&&!await confirmWildernessTarget(targetInstance,controller.signal))return;
    if(!valid()||controller.signal.aborted)return;
    const result=healing&&ally?await healAlly(characterId,ally,controller.signal)
      :targetKind==='wilderness'?await wildernessAction(characterId,action,targetInstance??null,undefined,controller.signal)
      :targetKind==='expedition'?await expeditionAction(characterId,action,undefined,controller.signal)
      :await combatAction(characterId,skill?COMBAT_KITS[cls].skill.id:'attack',controller.signal);
    if(!valid()||controller.signal.aborted)return;
    if(cooldown)finishSkillCooldown(cooldown,cooldownSample(result),requestStarted);
    // Do not restart a complete cadence when a delayed acknowledgement arrives.
    if(!skill&&typeof result.attackCooldown==='number'){
      const elapsed=performance.now()-requestStarted;
      attackRequestAfter=performance.now()+Math.max(0,result.attackCooldown*1000-elapsed);
    }
    if(flight)await new Promise<void>(resolve=>setTimeout(resolve,Math.max(0,flight*1000-(performance.now()-releasedAt))));
    if(!valid()||controller.signal.aborted)return;
    const preserveTarget=fight.combatEncounter?.instanceId!==targetInstance;
    applyCombatResult({...result,predictedAction:true,predictedContact:!healing,preserveTarget,action,
      ...(!result.impact&&impact?{impact:{x:impact.x,z:impact.z,label:encounter?.label}}:{})});
  }catch(error){
    if(!valid())return;
    if(cooldown)cancelSkillCooldown(cooldown);
    if(!skill)attackRequestAfter=performance.now()+(/recuperando|COOLDOWN/i.test(errorMessage(error))?250:1000);
    // An unavailable action flashes its icon. Network diagnostics stay out of
    // the centre of the fight and the world heartbeat reconciles committed hits.
    if(skill)explainAction('');
    if(!controller.signal.aborted)console.debug('[combat]',errorMessage(error));
  }finally{
    clearTimeout(timeout);
    if(requests[action]===controller)requests[action]=null;
    if(cooldown&&valid())cancelSkillCooldown(cooldown);
  }
}
/** Respawn is the only separate combat button; targeting is handled in the world. */
export function installCombatControls() {
  $('#respawn').addEventListener('click', respawn);
}
