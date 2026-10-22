// Menús del juego y ventanas del personaje (mochila, ficha, mapa, banco…).
import { ui, type PlayerWindow, session, play, fight } from '../game/state';
import { t, getLanguage } from './i18n';
import { renderLoot } from './lootWindow';
import { renderInventory, renderSheet } from './playerWindows';
import { renderSkills } from './skillsWindow';
import { assignSkillToActionBar } from './actionBar';
import { upgradeCharacterSkill, setCharacterTitle, spendAttributePoints } from '../services/account';
import { upgradeSkill } from '../data/combat';
import { renderZoneMap } from './mapWindow';
import { locationName, unspentAttributePoints, ATTRIBUTE_MAX_VALUE } from '../data/data';
import { renderQuestJournal } from './questWindow';
import { renderCollections } from './collectionsWindow';
import { renderVendor } from './vendorWindow';
import { renderBank } from './bankWindow';
import { renderSocial } from './socialWindow';
import { focusChat } from './chatWindow';
import { attributeTotal } from '../data/stats';
import { simulateSpend } from '../services/devActions';
import { playerInteractions } from '../game/interaction';
import { $ } from './dom';
import { keys, marker, playerVel, renderer, holder } from '../game/stage';
import { corpseLooted } from '../story/scenes';
import { questTracking, zoneMapPoints, personalWaypoints } from './gameInterface';
import { collectCorpseLoot } from '../game/combat';
import { useInventoryItem, moveInventorySlot, equipInventoryItem, updateEquipment, buyItem, sellItem, bankTransaction, depositAll } from '../game/inventory';
import { runOnServer, errorMessage } from '../game/server';
import { updateHud } from '../game/hud';
import { characterContext } from '../game/avatar';
import { toast } from './toast';

export function setGameMenuOpen(open: boolean, restoreFocus = true) {
  if (open) playerInteractions.close();
  ui.gameMenuOpen = open;
  refreshOverlayHud();
  if (open) { setPlayerMenuOpen(false, false); setWorldMenuOpen(false, false); setWindow(null, false); }
  const toggle = $<HTMLButtonElement>('#game-menu-toggle');
  const panel = $('#game-menu-panel');
  panel.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', t(open ? 'Cerrar menú' : 'Abrir menú'));
  $('#game-menu-message').textContent = '';
  $('#game-menu-message').classList.remove('error');
  keys.clear();
  if (open) $<HTMLButtonElement>('#game-menu-characters').focus();
  else if (restoreFocus) toggle.focus();
}
export function refreshOverlayHud() {
  document.body.classList.toggle('ui-menu-open', ui.gameMenuOpen || ui.playerMenuOpen || ui.worldMenuOpen || (!!ui.openWindow && ui.openWindow !== 'loot') || ui.optionsOpen);
  document.body.classList.toggle('inventory-open', ui.openWindow === 'inventory' || ui.openWindow === 'skills');
}
export function setPlayerMenuOpen(open: boolean, restoreFocus = true) {
  if (open) playerInteractions.close();
  ui.playerMenuOpen = open;
  refreshOverlayHud();
  if (open) { setGameMenuOpen(false, false); setWorldMenuOpen(false, false); setWindow(null, false); }
  const toggle = $<HTMLButtonElement>('#player-menu-toggle');
  $('#player-menu-panel').hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  keys.clear();
  if (open) $<HTMLButtonElement>('#player-menu-panel [data-window]').focus();
  else if (restoreFocus) toggle.blur();
}
export function setWorldMenuOpen(open: boolean, restoreFocus = true) {
  if (open) playerInteractions.close();
  ui.worldMenuOpen = open;
  refreshOverlayHud();
  if (open) { setGameMenuOpen(false, false); setPlayerMenuOpen(false, false); setWindow(null, false); }
  const toggle = $<HTMLButtonElement>('#world-menu-toggle');
  $('#world-menu-panel').hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', t(open ? 'Cerrar menú Mundo' : 'Abrir menú Mundo'));
  keys.clear();
  if (open) $<HTMLButtonElement>('#world-menu-panel button')?.focus();
  else if (restoreFocus) toggle.focus();
}
export const draftTotal = () => Object.values(ui.pointDraft).reduce((sum, n) => sum + (n ?? 0), 0);
export function setWindow(win: PlayerWindow | null, closeMenu = true) {
  const journalKey = win === 'quests' ? JSON.stringify([
    session.activeCharacterId, session.state.welcome, session.state.shadowQuest, session.state.location, corpseLooted(), getLanguage(),
    questTracking.isTracked('welcome'), questTracking.isTracked('shadow'),
  ]) : '';
  // Vida, comida y presencia no cambian el diario: conservar sus nodos durante el scroll y los clics.
  if (win === 'quests' && ui.openWindow === 'quests' && ui.questJournalKey === journalKey) return;
  ui.questJournalKey = journalKey;
  const body = $('#window-body');
  const refreshingSheet = win === 'sheet' && ui.openWindow === 'sheet';
  const refreshingJournal = win === 'quests' && ui.openWindow === 'quests';
  const journalCompleted = refreshingJournal ? body.querySelector('[data-quest-control="completed"]')?.getAttribute('aria-pressed') === 'true' : undefined;
  const expandedQuests = refreshingJournal ? [...body.querySelectorAll<HTMLDetailsElement>('details.quest-completed[open]')].map(entry => entry.dataset.quest) : [];
  const sheetScroll = refreshingSheet || refreshingJournal ? body.scrollTop : 0;
  const focused = (refreshingSheet || refreshingJournal) && document.activeElement instanceof HTMLElement && body.contains(document.activeElement)
    ? document.activeElement : null;
  const focusedQuestControl = focused?.dataset.questControl;
  const focusedAttribute = focused?.closest<HTMLElement>('[data-attribute]');
  const focusedControl = focusedAttribute && focused instanceof HTMLButtonElement ? [...focusedAttribute.querySelectorAll('button')].indexOf(focused) : -1;
  playerInteractions.close();
  ui.closeSocial?.();
  ui.closeSocial = null;
  ui.updateZoneMap = null;
  if (win !== ui.openWindow) ui.pointDraft = {};
  ui.openWindow = win;
  refreshOverlayHud();
  document.body.classList.toggle('window-open', !!win && win !== 'loot');
  document.body.classList.toggle('window-full', !!win && win !== 'loot');
  document.body.classList.toggle('skills-open', win === 'skills');
  $('#window-backdrop').hidden = !win;
  $('#window-confirm').hidden = true;
  keys.clear();
  if (win !== 'bank') ui.bankState = null;
  if (!win) { ui.vendor = null; return; }
  $('#window-backdrop').classList.toggle('loot-overlay', win === 'loot');
  $('#window-backdrop').classList.toggle('quest-overlay', win === 'quests');
  $('#window-backdrop .game-window').classList.toggle('loot-window-frame', win === 'loot');
  $('#window-backdrop .game-window').setAttribute('aria-modal', String(win !== 'loot'));
  $('#window-backdrop .game-window').classList.toggle('social-window-frame', win === 'social');
  $('#window-backdrop .game-window').classList.toggle('quest-window-frame', win === 'quests');
  $('#window-backdrop .game-window').classList.toggle('inventory-window-frame', win === 'inventory');
  $('#window-backdrop .game-window').classList.toggle('collection-window-frame', win === 'collections');
  $('#window-backdrop .game-window').classList.toggle('skills-window-frame', win === 'skills');
  $('#window-backdrop .game-window').classList.toggle('map-window-frame', win === 'map');
  $('#map-window-close').hidden = win !== 'map';
  $('#window-backdrop .game-window').classList.toggle('sheet-window-frame', win === 'sheet' || win === 'vendor' || win === 'bank');
  if (closeMenu) { setPlayerMenuOpen(false, false); setWorldMenuOpen(false, false); }
  $('#window-title').textContent = win === 'vendor' ? ui.vendor!.name : t(win === 'bank' ? 'Banco' : win === 'map' ? 'Mapa de la zona' : win === 'skills' ? 'Habilidades' : win === 'quests' ? 'Diario de misiones' : win === 'inventory' ? 'Inventario' : win === 'social' ? 'Social' : win === 'collections' ? 'Colecciones' : 'Ficha de personaje');
  $('#window-backdrop .game-window').classList.toggle('wide', win === 'sheet' || win === 'vendor' || win === 'bank' || win === 'social' || win === 'skills' || win === 'collections');
  $('#window-backdrop .game-window').classList.toggle('xl', win === 'inventory' || win === 'sheet' || win === 'vendor' || win === 'bank');
  if (win === 'loot') {
    play.moveTarget = null; play.pendingTalk = null; marker.visible = false; playerVel.set(0, 0, 0);
    $('#window-title').textContent = t('Botín de la criatura');
    if (fight.combatEncounter?.status === 'defeated' && !fight.combatEncounter.looted) renderLoot(body, fight.combatEncounter, collectCorpseLoot);
    else { setWindow(null); return; }
  }
  else if (win === 'inventory') renderInventory(body, session.state, renderer, (slot) => void useInventoryItem(slot), (from,to) => void moveInventorySlot(from,to), equipInventoryItem, slot => void updateEquipment(slot, null));
  else if (win === 'skills') renderSkills(body, session.state, assignSkillToActionBar, async (id, rank) => {
    const previousView = body.firstElementChild;
    const success = await runOnServer(character => upgradeCharacterSkill(character, id, rank), () => upgradeSkill(session.state, id, rank));
    if (success) {
      updateHud();
      if (ui.openWindow === 'skills' && body.firstElementChild !== previousView) setWindow('skills', false);
    }
    return success;
  });
  else if (win === 'map') {
    play.moveTarget = null; play.pendingTalk = null; marker.visible = false; playerVel.set(0, 0, 0);
    ui.updateZoneMap = renderZoneMap(body, locationName(play.city.locationId),
      () => ({ x: holder.position.x, z: holder.position.z, facing: holder.rotation.y }),
      zoneMapPoints, {
        get: () => personalWaypoints.get(play.city.locationId),
        set: point => {
          if (point) personalWaypoints.set(play.city.locationId, point);
          else personalWaypoints.delete(play.city.locationId);
        },
      });
    ui.updateZoneMap();
  }
  else if (win === 'quests') {
    renderQuestJournal(body, session.state, questTracking, journalCompleted, corpseLooted());
    for (const entry of body.querySelectorAll<HTMLDetailsElement>('details.quest-completed')) entry.open = expandedQuests.includes(entry.dataset.quest);
  }
  else if (win === 'collections') renderCollections(body, session.state.coinBags);
  else if (win === 'vendor') renderVendor(body, session.state, ui.vendor!.id, { onBuy: (item) => void buyItem(item), onSell: (slot) => void sellItem(slot) });
  else if (win === 'bank') renderBank(body, session.state, ui.bankState, {
    onDeposit: (slot, target) => { const item = session.state.inventory[slot]; if (item) void bankTransaction('deposit', slot, item, target ?? null); },
    onWithdraw: (slot, target) => { const item = ui.bankState?.items[slot]; if (item) void bankTransaction('withdraw', slot, item, target ?? null); },
    onMoveBank: (from, to) => { const item = ui.bankState?.items[from]; if (item && from !== to) void bankTransaction('move', from, item, to); },
    onMoveBag: (from, to) => void moveInventorySlot(from, to),
    onDepositAll: () => void depositAll(),
    onDepositPelines: amount => void bankTransaction('deposit_pelines', amount),
    onWithdrawPelines: amount => void bankTransaction('withdraw_pelines', amount),
  });
  else if (win === 'social') ui.closeSocial = renderSocial(body, (username) => {
    setWindow(null);
    focusChat(`/w ~${username} `);
  });
  else renderSheet(body, session.state, renderer, async (title) => {
    const stillCurrent = characterContext();
    await runOnServer((id) => setCharacterTitle(id, title), () => { session.state.title = title; });
    if (!stillCurrent()) return;
    updateHud();
    if (ui.openWindow === 'sheet') setWindow('sheet', false);
  }, {
    draft: ui.pointDraft,
    onAdd: (id) => {
      if (unspentAttributePoints(session.state) - draftTotal() <= 0 || attributeTotal(session.state, id) + (ui.pointDraft[id] ?? 0) >= ATTRIBUTE_MAX_VALUE) return;
      ui.pointDraft[id] = (ui.pointDraft[id] ?? 0) + 1;
      setWindow('sheet', false);
    },
    onRemove: (id) => {
      if (!ui.pointDraft[id]) return;
      ui.pointDraft[id]! -= 1;
      setWindow('sheet', false);
    },
  });
  $('#window-confirm').hidden = win !== 'sheet' || draftTotal() === 0;
  const restoredAttribute = focusedAttribute?.dataset.attribute
    ? body.querySelector<HTMLElement>(`[data-attribute="${CSS.escape(focusedAttribute.dataset.attribute)}"]`) : null;
  const restoredControl = restoredAttribute?.querySelectorAll('button')[focusedControl];
  const focusTarget = focusedQuestControl ? body.querySelector<HTMLElement>(`[data-quest-control="${CSS.escape(focusedQuestControl)}"]`) : restoredControl && !restoredControl.disabled ? restoredControl : restoredAttribute;
  (focusTarget ?? (win === 'map' ? $('#map-window-close') : win === 'loot' ? body.querySelector<HTMLButtonElement>('.loot-item') : null) ?? $<HTMLButtonElement>('#window-close')).focus({ preventScroll: refreshingSheet || refreshingJournal });
  body.scrollTop = sheetScroll;
}
/** Botones de los menús y de las ventanas. */
export function installMenus() {
  $('#window-confirm').onclick = async () => {
    const confirm = $<HTMLButtonElement>('#window-confirm');
    if (confirm.disabled) return;
    confirm.disabled = true;
    const stillCurrent = characterContext();
    const draft = { ...ui.pointDraft };
    try {
      if (!(await runOnServer((id) => spendAttributePoints(id, draft), () => simulateSpend(session.state, draft)))) return;
      ui.pointDraft = {};
    } catch (error) {
      toast('No se pudo guardar', errorMessage(error), true);
    } finally {
      confirm.disabled = false;
    }
    if (stillCurrent()) {
      updateHud();
      if (ui.openWindow === 'sheet') setWindow('sheet', false);
    }
  };
  $('#player-menu-toggle').onclick = () => setPlayerMenuOpen(!ui.playerMenuOpen);
  $('#world-menu-toggle').onclick = () => setWorldMenuOpen(!ui.worldMenuOpen);
  $('#world-menu-collections').onclick = () => setWindow('collections');
  $('#world-menu-map').onclick = () => setWindow('map');
  for (const b of document.querySelectorAll<HTMLButtonElement>('#player-menu-panel [data-window]')) {
    b.onclick = () => setWindow(b.dataset.window as PlayerWindow);
  }
  $('#window-close').onclick = () => setWindow(null);
  $('#map-window-close').onclick = () => setWindow(null);
  $('#window-backdrop').addEventListener('pointerdown', (e) => { if (e.target === e.currentTarget) setWindow(null); });
  document.addEventListener('click', (event) => {
    if (ui.playerMenuOpen && event.target instanceof Node && !$('#player-menu').contains(event.target)) setPlayerMenuOpen(false, false);
    if (ui.worldMenuOpen && event.target instanceof Node && !$('#world-menu').contains(event.target)) setWorldMenuOpen(false, false);
  });
}
