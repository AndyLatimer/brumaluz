// Interfaz de la partida: comercio entre jugadores, chat, minimapa, grupo e idioma.
import { applyLanguage, t, getLanguage, setLanguage } from './i18n';
import { initTooltips } from './tooltip';
import { createTradeWindow } from './tradeWindow';
import { play, session, story, ui, vitals } from '../game/state';
import { chatSystem, initChat, chatSelfSay, chatReceive, setChatSpeechListener } from './chatWindow';
import { animateVisibility } from './uiMotion';
import { sendChatMessage } from '../services/account';
import { createQuestTracking } from './questTracking';
import type { MapPoint } from './mapIcons';
import { shadowObjective, welcomeObjective, WELCOME_BADGE } from '../data/quests';
import { publishedMaps } from '../world/mapCity';
import { initMinimap } from './minimap';
import { getParty, partySelf, observeParty, isPartyLeader } from '../services/party';
import { locationName } from '../data/data';
import { isDialogOpen, setDialogLogger, refreshDialog } from './dialog';
import { initPartyHud } from './partyPanel';
import { renderBuffs } from './buffs';
import { renderControls } from './controls';
import { updateHud, playerSay, speechSeconds, npcSay } from '../game/hud';
import { playerInteractions } from '../game/interaction';
import { setWindow } from './menus';
import { keys, marker, TEST, holder } from '../game/stage';
import { corpseLooted } from '../story/scenes';
import { shadowQuestTarget } from '../story/quests';
import {tutorialTarget,tutorialObjective} from '../data/professionTutorial';
import { npcActors } from '../game/cities';
import { $ } from './dom';
import { toast, renderToast } from './toast';
import { remotePlayers, refreshWorldStatus } from '../game/worldClient';
import { focusConversationSpeaker } from '../game/conversation';
import { refreshUI } from './creator';
import { refreshAmbientControls } from '../game/audio';
import { displayCharacters } from './characterSelect';
import { RPG_CATALOG, gatherEnergy, professionState, professionRank } from '../data/professions';
import { resourceFamily } from '../data/resourceAppearance';

export const tradeWindow = createTradeWindow({
  active(id) { return play.mode==='play' && session.activeCharacterId===id && !play.dead; },
  inventory(value) {
    session.state.inventory = value.inventory;
    if(value.wallet) session.state.wallet.pelines = value.wallet.pelines;
    updateHud();
  },
  opened() {
    playerInteractions.close();
    setWindow(null,false);
    keys.clear(); play.moveTarget=null; marker.visible=false;
  },
  notify(text) { chatSystem(text); },
});
export const personalWaypoints = new Map<string, { x: number; z: number }>();
export const questTracking = createQuestTracking(() => `brumaluz-quest-tracking:${session.activeCharacterId ?? 'test'}`);
export function zoneMapPoints(): MapPoint[] {
  const resources=professionState(session.state.rpg),now=Date.now()/1000;
  const tracked=questTracking.current(session.state);
  const quest = play.city.locationId === 'brumaluz'||tracked==='profession' ? tracked : null;
  const objective = quest === 'profession' ? tutorialTarget(session.state,play.city.locationId) : quest === 'shadow'
    ? { name:t(shadowObjective(session.state.shadowQuest, corpseLooted(), play.city.locationId)), ...shadowQuestTarget() }
    : quest === 'welcome' && session.state.welcome
      ? { name:t(welcomeObjective(session.state.welcome)), ...(session.state.welcome.stage === 'active' ? WELCOME_BADGE : story.welcomeWorld.root.position) }
        : quest === 'fairy-dust' && session.state.fairyDustQuest === 'ask_gnomi'
          ? { name: t('Pregunta a Gnomi por el polvo de hada que has encontrado.'), ...story.welcomeWorld.root.position }
          : null;
  return [
    ...Object.values(RPG_CATALOG.nodes).filter(node=>node.location===play.city.locationId&&(resources.nodes[node.id]??0)<=now).map(node=>({
      id:`resource:${node.id}`,name:`${t(node.label)} · ${gatherEnergy(professionRank(resources,node.job),node.tier??0)} ${t('energía')} · ${node.seconds} s`,
      x:node.x,z:node.z,kind:resourceFamily(node.item??'')??'herb',resource:true,
    })),
    ...npcActors.filter(npc => npc.character.root.visible)
      .map(npc => ({ id:npc.id, name:story.NPCS[npc.id].name, x:npc.character.root.position.x, z:npc.character.root.position.z,kind:story.NPCS[npc.id].type==='trainer'?'workshop' as const:'npc' as const })),
    ...(story.welcomeWorld.root.visible ? [{id:'gnomi',name:session.registeredNpcs.gnomi.name,x:story.welcomeWorld.root.position.x,z:story.welcomeWorld.root.position.z}] : []),
    ...play.city.portals.map(portal => ({
      id:`portal:${portal.id}`, name:`${portal.name}${!portal.target || (portal.target.map !== 'brumaluz' && !publishedMaps()[portal.target.map]) ? ` · ${t('Camino cerrado')}` : ''}`,
      x:portal.position.x, z:portal.position.z,
      kind:portal.target?.map.startsWith('taller_')?'workshop' as const:publishedMaps()[portal.target?.map ?? '']?.kind === 'interior' ? 'interior' as const : 'exit' as const,
      closed:!portal.target || (portal.target.map !== 'brumaluz' && !publishedMaps()[portal.target.map]),
    })),
    ...(objective ? [{id:'quest-objective',...objective,kind:'quest' as const}] : []),
  ];
}
export function refreshLanguageDependentUI() {
  remotePlayers.refreshLanguage();
  if (play.mode === 'play' && session.worldConnection) refreshWorldStatus();
  const language = getLanguage();
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-language]')) {
    const selected = button.dataset.language === language;
    button.setAttribute('aria-pressed', String(selected));
    button.title = t(button.dataset.language === 'es' ? 'Español' : 'English');
  }
  refreshUI();
  renderBuffs(session.state, !vitals.foodRunning);
  renderControls($('#controls-view'));
  refreshAmbientControls();
  if (ui.openWindow === 'sheet' || ui.openWindow === 'vendor' || ui.openWindow === 'bank' || ui.openWindow === 'quests' || ui.openWindow === 'skills' || ui.openWindow === 'map' || ui.openWindow === 'collections' || ui.openWindow === 'professions') setWindow(ui.openWindow, false);
  if (session.currentUser) displayCharacters(session.cachedCharacters);
  $('#auth-submit').textContent = session.authMode === 'register' ? t('Crear cuenta') : t('Iniciar sesión');
  $('#forgot-password').textContent = t('¿Olvidaste tu contraseña?');
  if (session.characterPendingDeletion) {
    $('#delete-dialog-description').textContent = t('Vas a borrar definitivamente a {name}. Esta acción no se puede deshacer.', { name: session.characterPendingDeletion.name });
  }
  renderToast();
}
/** Conecta la interfaz de la partida (se llama una vez al arrancar). */
export function installGameInterface() {
  applyLanguage(document);
  initTooltips();
  animateVisibility(document.querySelector<HTMLElement>('.trade-backdrop'));
  window.setInterval(()=>{
    tradeWindow.setCharacter(play.mode==='play' && !TEST && !play.dead ? session.activeCharacterId : null);
  },250);
  initChat({
    onFocus: () => { keys.clear(); play.moveTarget = null; },
    zone: () => session.state.location,
    send: async (body, channel, to) => {
      if (TEST || !session.activeCharacterId) {
        if (channel === 'whisper') throw new Error(t('Los susurros no funcionan en modo prueba.'));
        chatSelfSay(session.state.name, body);
        playerSay(session.state.name, body);
        return;
      }
      const sequence = session.chatSeq;
      const message = await sendChatMessage(session.activeCharacterId, body, channel, to);
      if (sequence === session.chatSeq) chatReceive(message);
    },
  });
  initMinimap({
    player: () => ({ x: holder.position.x, z: holder.position.z, facing: holder.rotation.y }),
    markers: () => [
      ...zoneMapPoints(),
      ...[personalWaypoints.get(play.city.locationId)].flatMap(point => point ? [{ id:'personal-waypoint', name:t('Destino personal'), ...point, kind:'waypoint' as const }] : []),
      ...getParty().members.filter(member=>member.userId!==partySelf() && member.location===session.state.location).map(member=>({
        id:member.characterId,name:member.data.name,x:member.position.x,z:member.position.z,party:true,leader:member.userId===getParty().members[0]?.userId,
      })),
    ],
    zone: () => locationName(session.state.location),
    openMap: () => {
      if (play.mode === 'play' && !play.mapTravelling && !play.dead && !isDialogOpen() && !tradeWindow.isOpen) setWindow('map');
    },
  });
  initPartyHud();
  observeParty(party=>{
    const peers=Math.max(0,party.members.length-1);
    const bonusChanged=(session.state.partyPeers ?? 0)!==peers;
    session.state.partyPeers=peers;
    const leader=$('#hud-party-leader');
    leader.hidden=!isPartyLeader();leader.setAttribute('aria-label',t('Líder'));leader.title=t('Líder del grupo');
    $('#player-menu-toggle').classList.toggle('has-party-invite',party.incoming.length>0);
    document.querySelector('[data-window="social"]')?.classList.toggle('has-party-invite',party.incoming.length>0);
    for(const invite of party.incoming) if(!session.previousPartyInvites.has(invite.id)){
      toast('Invitación de grupo','~{name} te invita a su grupo. Abre Social → Grupo para responder.',false,{name:invite.username});
    }
    session.previousPartyInvites=new Set(party.incoming.map(invite=>invite.id));
    for(const response of party.responses){
      const message=response.accepted?'~{name} ha aceptado tu invitación y se ha unido al grupo.':'~{name} ha rechazado tu invitación de grupo.';
      toast('Invitación de grupo',message,false,{name:response.username});
    }
    if(play.mode==='play') {
      updateHud();
      if(bonusChanged && ui.openWindow==='sheet')setWindow('sheet',false);
    }
  });
  setChatSpeechListener((name, text, own, userId) => {
    if (own) playerSay(name, text);
    else remotePlayers.say(userId, name, text);
  });
  setDialogLogger((speaker, text) => {
    if (speaker === null) play.char.speak(speechSeconds(text));
    else { focusConversationSpeaker(speaker); npcSay(speaker, t(text)); }
  });
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-language]')) {
    button.onclick = () => setLanguage(button.dataset.language === 'en' ? 'en' : 'es');
    const selected = button.dataset.language === getLanguage();
    button.setAttribute('aria-pressed', String(selected));
    button.title = t(button.dataset.language === 'es' ? 'Español' : 'English');
  }
  document.addEventListener('brumaluz-language-change', refreshDialog);
  document.addEventListener('brumaluz-language-change', refreshLanguageDependentUI);
}
