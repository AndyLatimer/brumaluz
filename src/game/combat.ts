// Combate contra la criatura: objetivo, ataques, habilidades, cuerpo y botín.
import * as THREE from 'three';
import { renderActionBar } from '../ui/actionBar';
import { fight, session, play, vitals, ui } from './state';
import { updateShadowEnemy, buildShadowEnemy, playShadowEnemyAction } from '../world/shadowEnemy';
import { COMBAT_KITS, resolveCombat, skillRank } from '../data/combat';
import { vitalsOf } from '../data/stats';
import { guardedDamage } from '../data/weapons';
import { hasCombatWeapon } from '../data/equipment';
import { parseCombatEncounter, parsePublicVitals } from '../services/multiplayer';
import { castShadows } from '../world/render';
import { chatCombat } from '../ui/chatWindow';
import { t } from '../ui/i18n';
import { parseShadowQuest } from '../data/quests';
import { lootCorpse, startCombat, combatAction } from '../services/account';
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

export function tickWorldCombat(time:number,dt:number) {
  renderActionBar();
  if(!fight.combatTargetRoot)return;
  const active = fight.combatEncounter?.status === 'active';
  updateShadowEnemy(fight.combatTargetRoot,time,dt,holder.position,active);
  if(!active)return;
  const ring = fight.combatTargetRoot.getObjectByName('combat-lock-ring');
  if (ring) ring.visible = fight.lockedEnemy;
  if (fight.lockedEnemy && fight.combatTargetRoot.position.distanceTo(holder.position) > 35) releaseCombatTarget();
  const kit=COMBAT_KITS[session.state.cls];
  const distance=Math.hypot(fight.combatTargetRoot.position.x-holder.position.x,fight.combatTargetRoot.position.z-holder.position.z);
  if(fight.pendingCombatSkill&&fight.lockedEnemy&&distance<=kit.range){
    fight.pendingCombatSkill=false;play.moveTarget=null;playerVel.set(0,0,0);
    void performWorldCombatAction('skill');return;
  }
  const wallTime=performance.now()/1000;
  if(TEST&&!session.activeCharacterId&&fight.localCombatState&&fight.localCombatState.health>0&&distance<=2&&wallTime>=fight.nextLocalEnemyAttack){
    fight.nextLocalEnemyAttack=wallTime+2;
    const current = vitalsOf(session.state);
    const incoming = guardedDamage(session.state.cls,session.state.equipment,8), absorbed = Math.min(current.overheal,incoming);
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
  if(play.dead||!fight.lockedEnemy||!fight.combatAuto||fight.combatBusy)return;
  if(distance>kit.range)return;
  if(time<fight.nextCombatAttack)return;
  fight.nextCombatAttack=time+kit.interval;
  void performWorldCombatAction('attack');
}
export function useWorldCombatSkill() {
  if (play.mode !== 'play' || play.dead || fight.combatBusy) return;
  if (performance.now() < vitals.skillReadyAt) { toast('Habilidad', 'La acción se está recuperando.', true); return; }
  const kit = COMBAT_KITS[session.state.cls];
  if (!hasCombatWeapon(session.state)) { toast('Combate', 'Equipa un arma de tu clase para atacar.', true); return; }
  if (vitalsOf(session.state).resource < kit.skill.cost) { toast('Habilidad', 'No tienes recurso suficiente.', true); return; }
  if (!kit.skill.healing && (!fight.lockedEnemy || fight.combatEncounter?.status !== 'active')) {
    toast('Habilidad', 'Fija un enemigo visible con F.', true); return;
  }
  if(session.state.cls!=='clerigo'&&fight.combatTargetRoot){
    const range=COMBAT_KITS[session.state.cls].range;
    const distance=Math.hypot(fight.combatTargetRoot.position.x-holder.position.x,fight.combatTargetRoot.position.z-holder.position.z);
    if(distance>range){
      fight.pendingCombatSkill=true;fight.combatAuto=false;
      play.moveTarget=fight.combatTargetRoot.position.clone();marker.visible=false;
      return;
    }
  }
  fight.pendingCombatSkill=false;
  void performWorldCombatAction('skill');
}
export function releaseCombatTarget() {
  fight.lockedEnemy = false; fight.combatAuto = false; fight.combatApproach = false; fight.pendingCombatSkill = false;
  play.moveTarget = null; marker.visible = false;
  $('#combat-auto').setAttribute('aria-pressed', 'false');
}
export function lockCombatTarget(clicked = false) {
  if (!hasCombatWeapon(session.state)) { toast('Combate', 'Equipa un arma de tu clase para atacar.', true); return; }
  if (fight.combatEncounter?.status !== 'active' || !fight.combatTargetRoot || (!clicked && ui.targetFrame.current()?.id !== 'enemy:shadowling')) {
    toast('Combate', 'Mira a un enemigo visible para fijarlo con F.', true); return;
  }
  fight.lockedEnemy = true; fight.combatAuto = true; fight.combatApproach = true; fight.pendingCombatSkill = false; fight.nextCombatAttack = 0;
  $('#combat-auto').setAttribute('aria-pressed', 'true');
}
export function setCombatEncounter(value:unknown) {
  const previousStatus = fight.combatEncounter?.status;
  const previousHealth = fight.combatEncounter?.health;
  fight.combatEncounter=parseCombatEncounter(value);
  if(play.city.locationId === 'brumaluz' && (fight.combatEncounter?.status==='active'||(fight.combatEncounter?.status==='defeated' && !fight.combatEncounter.looted))){
    if(!fight.combatTargetRoot){
      fight.combatTargetRoot=buildShadowEnemy(fight.combatEncounter.x,fight.combatEncounter.z,play.city.groundY(fight.combatEncounter.x,fight.combatEncounter.z));
      castShadows(fight.combatTargetRoot);
      scene.add(fight.combatTargetRoot);
    }
    fight.combatTargetRoot.position.set(fight.combatEncounter.x,play.city.groundY(fight.combatEncounter.x,fight.combatEncounter.z),fight.combatEncounter.z);
    const corpse = fight.combatEncounter.status === 'defeated';
    fight.combatTargetRoot.name = corpse ? 'combat-corpse' : 'combat-enemy';
    if (corpse && previousStatus !== 'defeated') playShadowEnemyAction(fight.combatTargetRoot,'death',clock.getElapsedTime());
    else if (!corpse && previousStatus === 'active' && previousHealth !== undefined && fight.combatEncounter.health < previousHealth) {
      playShadowEnemyAction(fight.combatTargetRoot,'hit',clock.getElapsedTime());
    }
    if (corpse) releaseCombatTarget();
    $('#combat-controls').hidden=corpse;
    $('#combat-auto').setAttribute('aria-pressed',String(fight.combatAuto));
    const ring = fight.combatTargetRoot.getObjectByName('combat-lock-ring');
    if (ring) ring.visible = !corpse && fight.lockedEnemy;
    fight.combatTargetRoot.userData.looted = fight.combatEncounter.looted;
    if (corpse && previousStatus !== 'defeated') chatCombat(t('La criatura extraña ha caído.'));
  }else{
    if (ui.openWindow === 'loot') setWindow(null, false);
    if(fight.combatTargetRoot){
      scene.remove(fight.combatTargetRoot);
      fight.combatTargetRoot.traverse(part=>{
        const mesh=part as THREE.Mesh;
        if(mesh.isMesh){mesh.geometry.dispose();for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])material.dispose();}
      });
      fight.combatTargetRoot=null;
    }
    releaseCombatTarget();
    $('#combat-controls').hidden=true;
  }
}
export function applyCombatResult(value:Record<string,unknown>) {
  const before=vitalsOf(session.state).health;
  if(value.vitals) {
    const vitals=parsePublicVitals(value.vitals);
    session.state.health=vitals.health;session.state.resource=vitals.resource;session.state.overheal=vitals.overheal;
  }
  if(value.encounter!==undefined)setCombatEncounter(value.encounter);
  if(value.quest !== undefined) session.state.shadowQuest = parseShadowQuest(value.quest);
  if (typeof value.skillCooldown === 'number') vitals.skillReadyAt = performance.now() + Math.max(0, value.skillCooldown) * 1000;
  if(session.state.health===0&&fight.combatEncounter?.status==='active')setCombatEncounter({...fight.combatEncounter,status:'failed'});
  resetOverheal();updateHud();
  if(vitalsOf(session.state).health<before&&fight.combatEncounter?.status==='active')playShadowEnemyAction(fight.combatTargetRoot,'attack',clock.getElapsedTime());
  if(vitalsOf(session.state).health<before){play.char.hit();chatCombat(t('La criatura extraña te hiere.'));}
  if(session.state.health===0&&!play.dead)die();
  if(typeof value.damage==='number'&&value.damage>0){
    play.char.attack(value.damage>10);
    chatCombat(t('Golpeas a la criatura extraña por {n}.',{n:value.damage}));
  }
  if(typeof value.healing==='number'&&value.healing>0){
    play.char.heal();chatCombat(t('Recuperas {n} puntos de vida.',{n:value.healing}),'heal');
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
  const success = await runOnServer(id => lootCorpse(id, instanceId, slot), () => {
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
  if(fight.combatBusy)return;
  const healing = action === 'skill' && session.state.cls === 'clerigo';
  if (!hasCombatWeapon(session.state)) { releaseCombatTarget(); toast('Combate', 'Equipa un arma de tu clase para atacar.', true); return; }
  if (!healing && (!fight.lockedEnemy || !fight.combatEncounter || fight.combatEncounter.status !== 'active')) return;
  if(!session.activeCharacterId&&TEST){
    const current = vitalsOf(session.state);
    fight.localCombatState = {
      health:current.health,maxHealth:current.maxHealth,resource:current.resource,
      enemyHealth:fight.combatEncounter?.health ?? 0,nextAttack:fight.localCombatState?.nextAttack ?? 0,nextSkill:fight.localCombatState?.nextSkill ?? 0,
    };
    const distance=fight.combatTargetRoot ? Math.hypot(fight.combatTargetRoot.position.x-holder.position.x,fight.combatTargetRoot.position.z-holder.position.z) : 0;
    try{
      const result=resolveCombat(session.state.cls,fight.localCombatState,action,performance.now()/1000,distance,session.state.level,skillRank(session.state),session.state.equipment);
      fight.localCombatState=result.state;
      if (action === 'skill') vitals.skillReadyAt = performance.now() + COMBAT_KITS[session.state.cls].skill.cooldown * 1000;
      applyCombatResult({
        ...(fight.combatEncounter ? {encounter:{...fight.combatEncounter,engaged:fight.combatEncounter.engaged || result.damage.some(amount=>amount>0),health:result.state.enemyHealth,status:result.state.enemyHealth===0?'defeated':'active',
          ...(result.state.enemyHealth === 0 ? {loot:[{id:'esencia_sombria',count:1,bound:true}],looted:false} : {})},
          quest: result.state.enemyHealth === 0 ? 'defeated' : 'active'} : {}),
        vitals:{health:result.state.health,maxHealth:result.state.maxHealth,overheal:0,
          resource:result.state.resource,maxResource:vitalsOf(session.state).maxResource,resourceKind:vitalsOf(session.state).resourceKind},
        damage:result.damage.reduce((sum,hit)=>sum+hit,0),healing:result.healing,
      });
    }catch(error){toast('No se pudo completar la acción',errorMessage(error),true);}
    return;
  }
  const characterId=session.activeCharacterId;
  if(!characterId)return;
  fight.combatBusy=true;
  const stillCurrent=characterContext();
  try{
    const result=await combatAction(characterId,action === 'skill' ? COMBAT_KITS[session.state.cls].skill.id : 'attack');
    if(!stillCurrent())return;
    applyCombatResult(result);
    if (action === 'skill') vitals.skillReadyAt = performance.now() + COMBAT_KITS[session.state.cls].skill.cooldown * 1000;
  }catch(error){
    const message=errorMessage(error);
    if(action === 'skill' || !/recuperando|fuera de alcance/i.test(message))toast('No se pudo completar la acción',message,true);
  }finally{fight.combatBusy=false;}
}
/** Botones de combate y de reaparecer. */
export function installCombatControls() {
  $('#combat-auto').addEventListener('click',()=>{
    if (fight.lockedEnemy && fight.combatAuto) releaseCombatTarget();
    else lockCombatTarget();
  });
  $('#respawn').addEventListener('click', respawn);
}
