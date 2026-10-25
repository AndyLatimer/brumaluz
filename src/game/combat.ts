// Combate contra la criatura: objetivo, ataques, habilidades, cuerpo y botín.
import * as THREE from 'three';
import { renderActionBar } from '../ui/actionBar';
import { fight, session, play, vitals, ui } from './state';
import { updateShadowEnemy, buildShadowEnemy, playShadowEnemyAction, resetShadowEnemy } from '../world/shadowEnemy';
import { COMBAT_KITS, resolveCombat, skillRank, skillCost, attackInterval } from '../data/combat';
import { absorbBarrier } from '../data/enchantments';
import { combatFloat, combatImpact, combatProjectile, combatSlash, combatCharge, tickCombatFeedback } from './combatFeedback';
import { vitalsOf } from '../data/stats';
import { guardedDamage } from '../data/weapons';
import { hasCombatWeapon } from '../data/equipment';
import { parseCombatEncounter, parsePublicVitals } from '../services/multiplayer';
import { castShadows } from '../world/render';
import { chatCombat } from '../ui/chatWindow';
import { t } from '../ui/i18n';
import { parseShadowQuest } from '../data/quests';
import { lootCorpse, startCombat, combatAction, wildernessAction } from '../services/account';
import { beginWilderness, receiveWilderness, tickWilderness, wildernessRoot, wildernessCombatTargets } from './wilderness';
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
import { predictSkillCooldown,finishSkillCooldown,cancelSkillCooldown,syncSkillCooldown,cooldownSample } from './skillCooldown';
import { serverNow } from '../data/worldClock';
import { combatAudio } from './audio';
import { SHADOW_COMBAT,shadowAttack,shadowWindup } from '../data/shadowCombat';
import { tickCombatTutorial, noteTutorialAction, resetCombatTutorial } from './combatTutorial';

const retiredExpeditions=new Set<string>();
let queuedSkillUntil=0,pendingSkillUntil=0,actionRecoveryUntil=0;
let actionSerial=0;
let castingSkill:{started:number;impactAt:number}|null=null;
let preparingAction=false;
let recoveryDuration=0;
export function getCombatActionFeedback(){
 const now=performance.now();
 if(castingSkill&&fight.combatBusy&&now<castingSkill.impactAt)return{state:'casting' as const,remaining:(castingSkill.impactAt-now)/1000,duration:(castingSkill.impactAt-castingSkill.started)/1000};
 if(fight.pendingCombatSkill)return{state:'approaching' as const,remaining:Math.max(0,(pendingSkillUntil-now)/1000),duration:3};
 if(queuedSkillUntil>now)return{state:'queued' as const,remaining:(queuedSkillUntil-now)/1000,duration:1.2};
 if(now<actionRecoveryUntil)return{state:'recovering' as const,remaining:(actionRecoveryUntil-now)/1000,duration:recoveryDuration};
 return{state:'idle' as const,remaining:0,duration:0};
}
export function resetCombatActions(){actionSerial++;queuedSkillUntil=0;pendingSkillUntil=0;actionRecoveryUntil=0;castingSkill=null;preparingAction=false;fight.facingUntil=0;fight.nextCombatAttack=0;fight.combatBusy=false;fight.pendingCombatSkill=false;resetCombatTutorial();}
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
  if(queuedSkillUntil&&performance.now()>queuedSkillUntil)queuedSkillUntil=0;
  if(queuedSkillUntil&&!fight.combatBusy&&performance.now()>=Math.max(vitals.skillReadyAt,actionRecoveryUntil)){queuedSkillUntil=0;useWorldCombatSkill();return;}
  if(!fight.combatTargetRoot)return;
  const active = fight.combatEncounter?.status === 'active';
  updateShadowEnemy(fight.combatTargetRoot,time,dt,holder.position,active);
  if(!active)return;
  const ring = fight.combatTargetRoot.getObjectByName('combat-lock-ring');
  if (ring) ring.visible = fight.lockedEnemy;
  if (fight.lockedEnemy && fight.combatTargetRoot.position.distanceTo(holder.position) > 35) releaseCombatTarget();
  const kit=COMBAT_KITS[session.state.cls];
  const distance=Math.hypot(fight.combatTargetRoot.position.x-holder.position.x,fight.combatTargetRoot.position.z-holder.position.z);
  if(fight.pendingCombatSkill&&performance.now()>pendingSkillUntil)fight.pendingCombatSkill=false;
  if(fight.pendingCombatSkill&&!fight.combatBusy&&performance.now()>=actionRecoveryUntil&&fight.lockedEnemy&&distance<=kit.range){
    fight.pendingCombatSkill=false;play.moveTarget=null;
    void performWorldCombatAction('skill');return;
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
  if (performance.now() < vitals.skillReadyAt) {if(vitals.skillReadyAt-performance.now()<350)queuedSkillUntil=vitals.skillReadyAt+650;return;}
  if(fight.combatBusy||performance.now()<actionRecoveryUntil){queuedSkillUntil=Math.max(performance.now(),actionRecoveryUntil)+650;return;}
  const kit = COMBAT_KITS[session.state.cls];
  if (!hasCombatWeapon(session.state)) { toast('Combate', 'Equipa un arma de tu clase para atacar.', true); return; }
  if (vitalsOf(session.state).resource < skillCost(session.state)) { toast('Habilidad', 'No tienes recurso suficiente.', true); return; }
  if(kit.skill.healing&&!fight.healTarget){const v=vitalsOf(session.state);if(v.health>=v.maxHealth){toast('Curación','Ya tienes la vida completa.');return;}}
  if (!kit.skill.healing && fight.combatEncounter?.status !== 'active') {
    const target=ui.targetFrame.current()?.id;
    if(target?.startsWith('wild:')){void beginWilderness(target.slice(5)).then(success=>{if(success)useWorldCombatSkill();});return;}
    toast('Habilidad', 'Mira a un enemigo para usar tu habilidad.', true); return;
  }
  if(!kit.skill.healing&&!fight.lockedEnemy)lockCombatTarget(true);
  if(session.state.cls!=='clerigo'&&fight.combatTargetRoot){
    const range=COMBAT_KITS[session.state.cls].range;
    const distance=Math.hypot(fight.combatTargetRoot.position.x-holder.position.x,fight.combatTargetRoot.position.z-holder.position.z);
    if(distance>range){
      fight.pendingCombatSkill=true;pendingSkillUntil=performance.now()+3000;fight.combatAuto=true;fight.combatApproach=true;
      play.moveTarget=null;marker.visible=false;
      return;
    }
  }
  fight.pendingCombatSkill=false;
  void performWorldCombatAction('skill');
}
export function releaseCombatTarget() {
  // Cancel a preparation that has not reached the server yet.
  if(preparingAction){actionSerial++;preparingAction=false;fight.combatBusy=false;castingSkill=null;}
  queuedSkillUntil=0;pendingSkillUntil=0;
  fight.lockedEnemy = false; fight.combatAuto = false; fight.combatApproach = false; fight.pendingCombatSkill = false;
  play.moveTarget = null; marker.visible = false;
  $('#combat-auto').setAttribute('aria-pressed', 'false');
}
export function lockCombatTarget(clicked = false) {
  const hovered=ui.targetFrame.current()?.id;if(!clicked&&hovered?.startsWith('wild:')){if(fight.combatEncounter?.spawn===hovered.slice(5)&&fight.combatEncounter.status==='active')lockCombatTarget(true);else void beginWilderness(hovered.slice(5));return;}
  if (!hasCombatWeapon(session.state)) { toast('Combate', 'Equipa un arma de tu clase para atacar.', true); return; }
  if (fight.combatEncounter?.status !== 'active' || !fight.combatTargetRoot || (!clicked && ui.targetFrame.current()?.id !== 'enemy:shadowling')) {
    toast('Combate', 'Mira a un enemigo visible para fijarlo con F.', true); return;
  }
  fight.lockedEnemy = true; fight.combatAuto = true; fight.combatApproach = true; fight.pendingCombatSkill = false;
  $('#combat-auto').setAttribute('aria-pressed', 'true');
}
export function setCombatEncounter(value:unknown) {
  const previousInstance=fight.combatEncounter?.instanceId;
  const previouslyEngaged=fight.combatEncounter?.engaged;
  const previousStatus = fight.combatEncounter?.status;
  const previousHealth = fight.combatEncounter?.health;
  const previousAttack = fight.combatEncounter?.attackSeq;
  fight.combatEncounter=parseCombatEncounter(value);
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
  if(!wild&&fight.combatEncounter?.status==='active'&&fight.combatEncounter.engaged&&!previouslyEngaged&&hasCombatWeapon(session.state)){fight.lockedEnemy=true;fight.combatAuto=true;fight.combatApproach=false;}
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
    if (!wild&&corpse && previousStatus !== 'defeated') playShadowEnemyAction(fight.combatTargetRoot,'death',clock.getElapsedTime());
    else if(!wild&&fight.combatEncounter.windup&&fight.combatEncounter.attackSeq!==previousAttack){
      const remaining=Math.max(.05,fight.combatEncounter.windup-serverNow());
      playShadowEnemyAction(fight.combatTargetRoot,'prepare',clock.getElapsedTime(),remaining);
      if(fight.combatEncounter.attackKind==='bolt')combatProjectile(fight.combatTargetRoot.position,holder.position,'shadow',remaining,false,holder.position);
    }
    else if (!wild&&!corpse && previousInstance===fight.combatEncounter.instanceId && previousStatus === 'active' && previousHealth !== undefined && fight.combatEncounter.health < previousHealth) {
      playShadowEnemyAction(fight.combatTargetRoot,'hit',clock.getElapsedTime());
    }
    if (corpse) releaseCombatTarget();
    $('#combat-controls').hidden=corpse;
    $('#combat-auto').setAttribute('aria-pressed',String(fight.combatAuto));
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
    $('#combat-controls').hidden=true;
  }
}
export function applyCombatResult(value:Record<string,unknown>) {
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
  if(current&&value.encounter!==undefined)setCombatEncounter(value.encounter);
  if(current&&value.reward&&typeof value.reward==='object'&&!value.wilderness){const reward=value.reward as {xp:number;coins:number};combatFloat(reward.xp,holder.position,'experience');chatCombat(`+${reward.xp} EXP${reward.coins?` · +${reward.coins} Pelines`:''}.`);}
  if(current&&value.quest !== undefined) session.state.shadowQuest = parseShadowQuest(value.quest);
  if(current&&!(value.predictedAction&&value.action==='skill'))syncSkillCooldown(cooldownSample(value));
  if(session.state.health===0&&fight.combatEncounter?.status==='active')setCombatEncounter({...fight.combatEncounter,status:'failed'});
  resetOverheal();updateHud();
  if(vitalsOf(session.state).health<before)combatAudio.play('incoming');
  if(value.predictedAction)noteTutorialAction(value.action==='skill'?'skill':'attack',Number(value.damage??0),Number(value.healing??0));
  if(vitalsOf(session.state).health<before){if(!fight.combatBusy)play.char.hit();combatFloat(before-vitalsOf(session.state).health,holder.position,'incoming');chatCombat(fight.combatEncounter?.kind==='wilderness'?`${fight.combatEncounter.label} te hiere.`:t('La criatura extraña te hiere.'));}
  if(session.state.health===0&&!play.dead)die();
  if(typeof value.damage==='number'&&value.damage>0){
    combatAudio.play('impact',session.state.cls);
    if(!value.predictedAction)play.char.attack(value.action==='skill');
    const impact=value.impact as {x?:number;z?:number;label?:string}|undefined;
    const point=typeof impact?.x==='number'&&typeof impact.z==='number'?new THREE.Vector3(impact.x,play.city.groundY(impact.x,impact.z),impact.z):fight.combatTargetRoot?.position;
    if(point){combatFloat(value.damage,point);combatImpact(point,'damage',value.action==='skill');if(session.state.cls==='guerrero'||session.state.cls==='picaro')combatSlash(point,value.action==='skill',session.state.cls==='picaro'&&value.action==='skill');}
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
export async function performWorldCombatAction(action:'attack'|'skill') {
  if(fight.combatBusy||performance.now()<actionRecoveryUntil)return;
  const healing = action === 'skill' && session.state.cls === 'clerigo';
  if (!hasCombatWeapon(session.state)) { releaseCombatTarget(); toast('Combate', 'Equipa un arma de tu clase para atacar.', true); return; }
  if (!healing && (!fight.lockedEnemy || !fight.combatEncounter || fight.combatEncounter.status !== 'active')) return;
  if(!healing&&fight.combatTargetRoot&&Math.hypot(holder.position.x-fight.combatTargetRoot.position.x,holder.position.z-fight.combatTargetRoot.position.z)>COMBAT_KITS[session.state.cls].range)return;
  const castContext=characterContext(),targetInstance=fight.combatEncounter?.instanceId,started=clock.getElapsedTime();
  const serial=++actionSerial;
  const timing=combatTiming[session.state.cls][action==='skill'?'skill':'basic'];
  castingSkill=action==='skill'?{started:performance.now(),impactAt:performance.now()+timing*1000}:null;
  recoveryDuration=combatDuration[session.state.cls][action==='skill'?'skill':'basic'];
  actionRecoveryUntil=performance.now()+recoveryDuration*1000;
  fight.facingUntil=actionRecoveryUntil;
  fight.combatBusy=true;
  preparingAction=true;
  if(action==='attack')fight.nextCombatAttack=started+attackInterval(session.state.cls,session.state.equipment,session.state);
  if(fight.combatTargetRoot&&!healing)holder.rotation.y=Math.atan2(fight.combatTargetRoot.position.x-holder.position.x,fight.combatTargetRoot.position.z-holder.position.z);
  play.char.attack(action==='skill');
  if(action==='skill')combatCharge(holder.position,session.state.cls,timing);
  combatAudio.play('swing',session.state.cls);
  await new Promise<void>(resolve=>setTimeout(resolve,timing*1000));
  if(serial!==actionSerial)return;
  preparingAction=false;
  if(!castContext()||play.dead||!healing&&(fight.combatEncounter?.instanceId!==targetInstance||fight.combatEncounter?.status!=='active')){fight.combatBusy=false;return;}
  if(!healing&&fight.combatTargetRoot){
    const target=fight.combatTargetRoot.position;
    const from=holder.position.clone();from.y+=1;const to=target.clone();to.y+=1;
    if(Math.hypot(target.x-holder.position.x,target.z-holder.position.z)>COMBAT_KITS[session.state.cls].range||play.city.lineOfSight?.(from,to)===false){fight.combatBusy=false;castingSkill=null;return;}
  }
  const flight=!healing&&fight.combatTargetRoot&&['mago','clerigo','explorador'].includes(session.state.cls)?combatProjectile(holder.position,fight.combatTargetRoot.position,session.state.cls,undefined,action==='skill'):0;
  const releasedAt=performance.now();
  const cooldown=action==='skill'?predictSkillCooldown(COMBAT_KITS[session.state.cls].skill.cooldown):null;
  fight.combatBusy=false;
  if(!session.activeCharacterId&&TEST){
    fight.combatBusy=true;
    try{
    if(flight)await new Promise<void>(resolve=>setTimeout(resolve,flight*1000));
    if(!castContext()||serial!==actionSerial||play.dead){if(cooldown)cancelSkillCooldown(cooldown);return;}
    const current = vitalsOf(session.state);
    fight.localCombatState = {
      health:current.health,maxHealth:current.maxHealth,resource:current.resource,
      enemyHealth:fight.combatEncounter?.health ?? 0,nextAttack:fight.localCombatState?.nextAttack ?? 0,nextSkill:fight.localCombatState?.nextSkill ?? 0,
    };
    const distance=fight.combatTargetRoot ? Math.hypot(fight.combatTargetRoot.position.x-holder.position.x,fight.combatTargetRoot.position.z-holder.position.z) : 0;
      const result=resolveCombat(session.state.cls,fight.localCombatState,action,releasedAt/1000,distance,session.state.level,skillRank(session.state),session.state.equipment,session.state);
      fight.localCombatState=result.state;
      if(cooldown)finishSkillCooldown(cooldown,{remaining:Math.max(0,result.state.nextSkill-performance.now()/1000)});
      applyCombatResult({
        predictedAction:true,
        ...(fight.combatEncounter ? {encounter:{...fight.combatEncounter,engaged:fight.combatEncounter.engaged || result.damage.some(amount=>amount>0),health:result.state.enemyHealth,status:result.state.enemyHealth===0?'defeated':'active',
          ...(result.state.enemyHealth === 0 ? {loot:[{id:'esencia_sombria',count:1,bound:true}],looted:false} : {})},
          quest: result.state.enemyHealth === 0 ? 'defeated' : 'active'} : {}),
        vitals:{health:result.state.health,maxHealth:result.state.maxHealth,overheal:0,
          resource:result.state.resource,maxResource:vitalsOf(session.state).maxResource,resourceKind:vitalsOf(session.state).resourceKind},
        damage:result.damage.reduce((sum,hit)=>sum+hit,0),healing:result.healing,action,
      });
    }catch(error){if(cooldown)cancelSkillCooldown(cooldown);toast('No se pudo completar la acción',errorMessage(error),true);}
    finally{if(serial===actionSerial){fight.combatBusy=false;castingSkill=null;}}
    return;
  }
  const characterId=session.activeCharacterId;
  if(!characterId){if(cooldown)cancelSkillCooldown(cooldown);return;}
  fight.combatBusy=true;
  const requestStarted=performance.now();
  const stillCurrent=characterContext();
  try{
    const result=healing&&fight.healTarget?await healAlly(characterId,fight.healTarget):fight.combatEncounter?.kind==='wilderness'?await wildernessAction(characterId,action,targetInstance??null):fight.combatEncounter?.kind==='expedition'?await expeditionAction(characterId,action):await combatAction(characterId,action === 'skill' ? COMBAT_KITS[session.state.cls].skill.id : 'attack');
    if(!stillCurrent())return;
    if(cooldown)finishSkillCooldown(cooldown,cooldownSample(result),requestStarted);
    if(flight)await new Promise<void>(resolve=>setTimeout(resolve,Math.max(0,flight*1000-(performance.now()-requestStarted))));
    if(!stillCurrent())return;
    applyCombatResult({...result,predictedAction:true,action});
    if(action==='attack'&&typeof result.attackCooldown==='number'){
      const d=result.data as {combatNextAttack?:number}|undefined;
      const remaining=typeof d?.combatNextAttack==='number'?d.combatNextAttack-serverNow():result.attackCooldown;
      fight.nextCombatAttack=clock.getElapsedTime()+Math.max(.06,remaining-combatTiming[session.state.cls].basic);
    }
    if(action==='skill')fight.nextCombatAttack=Math.max(fight.nextCombatAttack,started+recoveryDuration);
  }catch(error){
    if(cooldown)cancelSkillCooldown(cooldown);
    const message=errorMessage(error);
    if(action==='attack')fight.nextCombatAttack=clock.getElapsedTime()+.18;
    if(!/recuperando|fuera de alcance|COMBAT_COOLDOWN|COMBAT_OUT_OF_RANGE/i.test(message))toast('No se pudo completar la acción',message,true);
  }finally{if(serial===actionSerial){fight.combatBusy=false;castingSkill=null;}}
}
/** Botones de combate y de reaparecer. */
export function installCombatControls() {
  $('#combat-auto').addEventListener('click',()=>{
    if (fight.lockedEnemy && fight.combatAuto) releaseCombatTarget();
    else lockCombatTarget();
  });
  $('#respawn').addEventListener('click', respawn);
}
