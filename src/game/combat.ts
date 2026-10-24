// Combate contra la criatura: objetivo, ataques, habilidades, cuerpo y botín.
import * as THREE from 'three';
import { renderActionBar } from '../ui/actionBar';
import { fight, session, play, vitals, ui } from './state';
import { updateShadowEnemy, buildShadowEnemy, playShadowEnemyAction } from '../world/shadowEnemy';
import { COMBAT_KITS, resolveCombat, skillRank, skillCost, attackInterval } from '../data/combat';
import { absorbBarrier } from '../data/enchantments';
import { combatFloat, combatImpact, combatActionStarted, tickCombatFeedback } from './combatFeedback';
import { vitalsOf } from '../data/stats';
import { guardedDamage } from '../data/weapons';
import { hasCombatWeapon } from '../data/equipment';
import { parseCombatEncounter, parsePublicVitals } from '../services/multiplayer';
import { castShadows } from '../world/render';
import { chatCombat } from '../ui/chatWindow';
import { t } from '../ui/i18n';
import { parseShadowQuest } from '../data/quests';
import { lootCorpse, startCombat, combatAction, wildernessAction } from '../services/account';
import { beginWilderness, receiveWilderness, tickWilderness, wildernessRoot } from './wilderness';
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

const retiredExpeditions=new Set<string>();
let queuedSkillUntil=0,pendingSkillUntil=0,actionRecoveryUntil=0;
let actionSerial=0;
export function resetCombatActions(){actionSerial++;queuedSkillUntil=0;pendingSkillUntil=0;actionRecoveryUntil=0;fight.combatBusy=false;fight.pendingCombatSkill=false;}
export async function selectExpeditionTarget(index:number){
 if(!session.activeCharacterId)return;const current=characterContext();try{const result=await expeditionAction(session.activeCharacterId,'target',index);if(current())applyCombatResult(result);}catch(error){toast('Objetivo',errorMessage(error),true);}
}
export async function leaveExpedition(){if(!session.activeCharacterId)return;const current=characterContext();try{const result=await expeditionAction(session.activeCharacterId,'leave');if(current()){applyCombatResult(result);releaseCombatTarget();}}catch(error){toast('Expedición',errorMessage(error),true);}}

export function tickWorldCombat(time:number,dt:number) {
  tickWilderness(time,dt);
  tickCombatFeedback(dt);
  renderActionBar();
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
    fight.pendingCombatSkill=false;play.moveTarget=null;playerVel.set(0,0,0);
    void performWorldCombatAction('skill');return;
  }
  const wallTime=performance.now()/1000;
  if(TEST&&!session.activeCharacterId&&fight.localCombatState&&fight.localCombatState.health>0&&distance<=2&&wallTime>=fight.nextLocalEnemyAttack){
    fight.nextLocalEnemyAttack=wallTime+2;
    const current = vitalsOf(session.state);
    const incoming = absorbBarrier(session.state,guardedDamage(session.state.cls,session.state.equipment,8),performance.now()/1000), absorbed = Math.min(current.overheal,incoming);
    fight.localCombatState={...fight.localCombatState,health:Math.max(0,current.health-(incoming-absorbed)),maxHealth:current.maxHealth,resource:current.resource};
    const vitals=vitalsOf(session.state);
    applyCombatResult({
      encounter:{...fight.combatEncounter,engaged:true},
      vitals:{health:fight.localCombatState.health,maxHealth:fight.localCombatState.maxHealth,overheal:current.overheal-absorbed,
        resource:fight.localCombatState.resource,maxResource:vitals.maxResource,resourceKind:vitals.resourceKind},
      damage:0,healing:0,
    });
    return;
  }
  if(play.dead||!fight.lockedEnemy||!fight.combatAuto||fight.combatBusy||performance.now()<actionRecoveryUntil)return;
  if(distance>kit.range)return;
  if(time<fight.nextCombatAttack)return;
  void performWorldCombatAction('attack');
}
export function useWorldCombatSkill() {
  if (play.mode !== 'play' || play.dead) return;
  if(fight.combatBusy||performance.now()<actionRecoveryUntil){queuedSkillUntil=performance.now()+1200;return;}
  if (performance.now() < vitals.skillReadyAt) {if(vitals.skillReadyAt-performance.now()<350)queuedSkillUntil=vitals.skillReadyAt+650;return;}
  const kit = COMBAT_KITS[session.state.cls];
  if (!hasCombatWeapon(session.state)) { toast('Combate', 'Equipa un arma de tu clase para atacar.', true); return; }
  if (vitalsOf(session.state).resource < skillCost(session.state)) { toast('Habilidad', 'No tienes recurso suficiente.', true); return; }
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
  queuedSkillUntil=0;pendingSkillUntil=0;
  fight.lockedEnemy = false; fight.combatAuto = false; fight.combatApproach = false; fight.pendingCombatSkill = false;
  play.moveTarget = null; marker.visible = false;
  $('#combat-auto').setAttribute('aria-pressed', 'false');
}
export function lockCombatTarget(clicked = false) {
  const hovered=ui.targetFrame.current()?.id;if(!clicked&&hovered?.startsWith('wild:')){void beginWilderness(hovered.slice(5));return;}
  if (!hasCombatWeapon(session.state)) { toast('Combate', 'Equipa un arma de tu clase para atacar.', true); return; }
  if (fight.combatEncounter?.status !== 'active' || !fight.combatTargetRoot || (!clicked && ui.targetFrame.current()?.id !== 'enemy:shadowling')) {
    toast('Combate', 'Mira a un enemigo visible para fijarlo con F.', true); return;
  }
  fight.lockedEnemy = true; fight.combatAuto = true; fight.combatApproach = true; fight.pendingCombatSkill = false; fight.nextCombatAttack = 0;
  $('#combat-auto').setAttribute('aria-pressed', 'true');
}
export function setCombatEncounter(value:unknown) {
  const previousInstance=fight.combatEncounter?.instanceId;
  const previouslyEngaged=fight.combatEncounter?.engaged;
  const previousStatus = fight.combatEncounter?.status;
  const previousHealth = fight.combatEncounter?.health;
  fight.combatEncounter=parseCombatEncounter(value);
  // Retirar también los encuentros provisionales guardados antes de quitar su acceso.
  if(fight.combatEncounter?.kind==='expedition'){
    fight.combatEncounter=null;
    const character=session.activeCharacterId;
    if(character&&!retiredExpeditions.has(character)){retiredExpeditions.add(character);void leaveExpedition();}
  }
  const wild=fight.combatEncounter?.kind==='wilderness';
  if(wild&&fight.combatEncounter?.status==='active'&&previousInstance!==fight.combatEncounter.instanceId){fight.lockedEnemy=hasCombatWeapon(session.state);fight.combatAuto=fight.lockedEnemy;fight.combatApproach=false;fight.nextCombatAttack=0;}
  if(!wild&&fight.combatEncounter?.status==='active'&&fight.combatEncounter.engaged&&!previouslyEngaged&&hasCombatWeapon(session.state)){fight.lockedEnemy=true;fight.combatAuto=true;fight.combatApproach=false;fight.nextCombatAttack=0;}
  if(wild&&fight.combatTargetRoot?.userData.wildSpawn!==fight.combatEncounter?.spawn)fight.combatTargetRoot=null;
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
    if (corpse && previousStatus !== 'defeated') playShadowEnemyAction(fight.combatTargetRoot,'death',clock.getElapsedTime());
    else if (!corpse && !fight.combatEncounter.windup && previousStatus === 'active' && previousHealth !== undefined && fight.combatEncounter.health < previousHealth) {
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
    if (ui.openWindow === 'loot') setWindow(null, false);
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
  if(current&&value.reward&&typeof value.reward==='object'){const reward=value.reward as {xp:number;coins:number};toast('Victoria',`+${reward.xp} EXP${reward.coins?` · +${reward.coins} Pelines`:''}. Registra el cuerpo para recoger los materiales.`);}
  if(current&&value.quest !== undefined) session.state.shadowQuest = parseShadowQuest(value.quest);
  if (current&&typeof value.skillCooldown === 'number') vitals.skillReadyAt = performance.now() + Math.max(0, value.skillCooldown) * 1000;
  if(session.state.health===0&&fight.combatEncounter?.status==='active')setCombatEncounter({...fight.combatEncounter,status:'failed'});
  resetOverheal();updateHud();
  if(vitalsOf(session.state).health<before&&fight.combatEncounter?.status==='active'&&fight.combatEncounter.kind!=='wilderness')playShadowEnemyAction(fight.combatTargetRoot,'attack',clock.getElapsedTime());
  if(vitalsOf(session.state).health<before){if(!fight.combatBusy)play.char.hit();combatFloat(before-vitalsOf(session.state).health,holder.position,'incoming');chatCombat(fight.combatEncounter?.kind==='wilderness'?`${fight.combatEncounter.label} te hiere.`:t('La criatura extraña te hiere.'));}
  if(session.state.health===0&&!play.dead)die();
  if(typeof value.damage==='number'&&value.damage>0){
    if(!value.predictedAction)play.char.attack(value.action==='skill');combatActionStarted();
    if(fight.combatTargetRoot){combatFloat(value.damage,fight.combatTargetRoot.position);combatImpact(fight.combatTargetRoot.position);}
    chatCombat(fight.combatEncounter?.kind==='wilderness'?`Golpeas a ${fight.combatEncounter.label} por ${value.damage}.`:t('Golpeas a la criatura extraña por {n}.',{n:value.damage}));
  }
  if(Array.isArray(value.events))for(const event of value.events){
    if(!event||typeof event!=='object'||!['fire','dark','frost','lightning'].includes(event.kind))continue;
    const position=event.kind==='frost'?holder.position:typeof event.x==='number'&&typeof event.z==='number'?new THREE.Vector3(event.x,play.city.groundY(event.x,event.z),event.z):fight.combatTargetRoot?.position;
    if(position)combatImpact(position,event.kind);
  }
  if(typeof value.healing==='number'&&value.healing>0){
    const target=typeof value.healTarget==='string'?remotePlayers.list().find(p=>p.id===value.healTarget)?.root.position:undefined;
    if(!value.predictedAction){if(value.action==='skill')play.char.attack(true);else play.char.heal();}combatFloat(value.healing,target??holder.position,'healing');combatImpact(target??holder.position,'healing');chatCombat(t('Curación: {n}.',{n:value.healing}),'heal');
  }
  if(fight.combatEncounter?.status==='defeated'){
    fight.combatAuto=false;
  }
}
export async function collectCorpseLoot(slot: number | null) {
  const corpse = fight.combatEncounter;
  if (!corpse || corpse.status !== 'defeated' || !corpse.instanceId || !fight.combatTargetRoot) return false;
  if (holder.position.distanceTo(fight.combatTargetRoot.position) > 3) {
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
  if (ui.openWindow === 'loot') setWindow(fight.combatEncounter?.looted ? null : 'loot', false);
  return true;
}
export const lootAnchor = new THREE.Vector3();
export function positionLootWindow() {
  if (!fight.combatTargetRoot || !fight.combatEncounter || fight.combatEncounter.looted || play.dead || holder.position.distanceTo(fight.combatTargetRoot.position) > 3) {
    setWindow(null, false); return;
  }
  const panel = $('#window-backdrop .game-window');
  lootAnchor.copy(fight.combatTargetRoot.position).add(new THREE.Vector3(0, .6, 0)).project(camera);
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
      enemyHealth:100,nextAttack:0,nextSkill:0,
    };
    setCombatEncounter({
      id:'shadowling',status:'active',engaged:false,health:100,maxHealth:100,
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
  const castContext=characterContext(),targetInstance=fight.combatEncounter?.instanceId,started=clock.getElapsedTime();
  const serial=++actionSerial;
  const timing=combatTiming[session.state.cls][action==='skill'?'skill':'basic'];
  actionRecoveryUntil=performance.now()+(action==='skill'?700:session.state.cls==='picaro'?400:450);
  fight.combatBusy=true;
  if(action==='attack')fight.nextCombatAttack=started+attackInterval(session.state.cls,session.state.equipment);
  if(fight.combatTargetRoot&&!healing)holder.rotation.y=Math.atan2(fight.combatTargetRoot.position.x-holder.position.x,fight.combatTargetRoot.position.z-holder.position.z);
  play.char.attack(action==='skill');combatActionStarted();
  await new Promise<void>(resolve=>setTimeout(resolve,timing*1000));
  if(serial!==actionSerial)return;
  if(!castContext()||play.dead||!healing&&(fight.combatEncounter?.instanceId!==targetInstance||fight.combatEncounter?.status!=='active')){fight.combatBusy=false;return;}
  fight.combatBusy=false;
  if(!session.activeCharacterId&&TEST){
    const current = vitalsOf(session.state);
    fight.localCombatState = {
      health:current.health,maxHealth:current.maxHealth,resource:current.resource,
      enemyHealth:fight.combatEncounter?.health ?? 0,nextAttack:fight.localCombatState?.nextAttack ?? 0,nextSkill:fight.localCombatState?.nextSkill ?? 0,
    };
    const distance=fight.combatTargetRoot ? Math.hypot(fight.combatTargetRoot.position.x-holder.position.x,fight.combatTargetRoot.position.z-holder.position.z) : 0;
    try{
      const result=resolveCombat(session.state.cls,fight.localCombatState,action,performance.now()/1000,distance,session.state.level,skillRank(session.state),session.state.equipment,session.state);
      fight.localCombatState=result.state;
      if (action === 'skill') vitals.skillReadyAt = performance.now() + COMBAT_KITS[session.state.cls].skill.cooldown * 1000;
      applyCombatResult({
        predictedAction:true,
        ...(fight.combatEncounter ? {encounter:{...fight.combatEncounter,engaged:fight.combatEncounter.engaged || result.damage.some(amount=>amount>0),health:result.state.enemyHealth,status:result.state.enemyHealth===0?'defeated':'active',
          ...(result.state.enemyHealth === 0 ? {loot:[{id:'esencia_sombria',count:1,bound:true}],looted:false} : {})},
          quest: result.state.enemyHealth === 0 ? 'defeated' : 'active'} : {}),
        vitals:{health:result.state.health,maxHealth:result.state.maxHealth,overheal:0,
          resource:result.state.resource,maxResource:vitalsOf(session.state).maxResource,resourceKind:vitalsOf(session.state).resourceKind},
        damage:result.damage.reduce((sum,hit)=>sum+hit,0),healing:result.healing,action,
      });
    }catch(error){toast('No se pudo completar la acción',errorMessage(error),true);}
    return;
  }
  const characterId=session.activeCharacterId;
  if(!characterId)return;
  fight.combatBusy=true;
  const stillCurrent=characterContext();
  try{
    const result=healing&&fight.healTarget?await healAlly(characterId,fight.healTarget):fight.combatEncounter?.kind==='wilderness'?await wildernessAction(characterId,action,targetInstance??null):fight.combatEncounter?.kind==='expedition'?await expeditionAction(characterId,action):await combatAction(characterId,action === 'skill' ? COMBAT_KITS[session.state.cls].skill.id : 'attack');
    if(!stillCurrent())return;
    applyCombatResult({...result,predictedAction:true});
    if(action==='attack'&&typeof result.attackCooldown==='number')fight.nextCombatAttack=clock.getElapsedTime()+Math.max(.08,result.attackCooldown-combatTiming[session.state.cls].basic);
    if(action==='skill')fight.nextCombatAttack=Math.max(fight.nextCombatAttack,started+.7);
    if (action === 'skill'&&typeof result.skillCooldown!=='number') vitals.skillReadyAt = performance.now() + COMBAT_KITS[session.state.cls].skill.cooldown * 1000;
  }catch(error){
    const message=errorMessage(error);
    if(action==='attack')fight.nextCombatAttack=clock.getElapsedTime()+.18;
    if(!/recuperando|fuera de alcance|COMBAT_COOLDOWN|COMBAT_OUT_OF_RANGE/i.test(message))toast('No se pudo completar la acción',message,true);
  }finally{if(serial===actionSerial)fight.combatBusy=false;}
}
/** Botones de combate y de reaparecer. */
export function installCombatControls() {
  $('#combat-auto').addEventListener('click',()=>{
    if (fight.lockedEnemy && fight.combatAuto) releaseCombatTarget();
    else lockCombatTarget();
  });
  $('#respawn').addEventListener('click', respawn);
}
