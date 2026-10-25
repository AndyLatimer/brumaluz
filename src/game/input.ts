// Ratón y teclado durante el juego y en el creador.
import * as THREE from 'three';
import { isDialogOpen, advanceDialog, moveDialogChoice, chooseDialog, exitDialog } from '../ui/dialog';
import { talk, view, play, ui, fight } from './state';
import { focusChat } from '../ui/chatWindow';
import { actionBarSlotForKey, toggleActionBarPage, useActionBarSlot } from '../ui/actionBar';
import { toggleMinimap } from '../ui/minimap';
import { canvas, holder, keys, marker } from './stage';
import { storyLock } from './conversation';
import { tradeWindow } from '../ui/gameInterface';
import { playerInteractions, clickNpc, clickToMove, interact } from './interaction';
import { cinematic } from '../story/scenes';
import { respawn } from './vitals';
import { setOptionsOpen } from '../ui/options';
import { $ } from '../ui/dom';
import { setWindow, setPlayerMenuOpen, setWorldMenuOpen, setGameMenuOpen } from '../ui/menus';
import { releaseCombatTarget, lockCombatTarget, cycleCombatTarget } from './combat';
import { noteCameraControl } from './camera';

let dragPointer: number | null = null;
let dragButton = -1;
const heldShift = new Set<string>();
let shiftUsedAsModifier = false;
const editableTarget = (target: EventTarget | null) => target instanceof HTMLElement
  && (!!target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"]') || target.isContentEditable);
function cancelDrag() {
  const pointer = dragPointer;
  dragPointer = null; dragButton = -1; view.dragging = false;
  canvas.classList.remove('drag');
  if (pointer !== null && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
}
function clearHeldInput() {
  keys.clear(); heldShift.clear(); shiftUsedAsModifier = false;
  cancelDrag();
  play.moveTarget = null; marker.visible = false; fight.combatApproach = false;
}

export const endDrag = (e: PointerEvent) => {
  if (e.pointerId !== dragPointer) return;
  const click = view.dragging && dragButton === 0 && view.dragDist < 6;
  // Soltar la captura antes de activar una interacción: esta puede abrir un diálogo.
  cancelDrag();
  if (click && play.mode === 'play' && !play.dead && !play.mapTravelling && !storyLock() && !isDialogOpen() && !tradeWindow.isOpen && !playerInteractions.isOpen && !ui.optionsOpen && !ui.openWindow && !ui.gameMenuOpen && !ui.playerMenuOpen && !ui.worldMenuOpen && !clickNpc(e)) clickToMove(e);
};
export function startJump() {
  if (play.char.isSwimming) return; // nadando no se salta
  if (play.jumpDuration > 0 && play.jumpElapsed < play.jumpDuration) return;
  play.jumpDuration = play.char.jump();
  if (play.jumpDuration <= 0) return;
  play.jumpElapsed = 0;
}
/** Registra los manejadores de ratón y teclado. */
export function installInput() {
  canvas.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || dragPointer !== null || ![0, 1, 2].includes(e.button) || storyLock() || play.mapTravelling || (isDialogOpen() && !talk.conversationActor)) return;
    if (play.mode === 'play' && (ui.optionsOpen || ui.gameMenuOpen || ui.playerMenuOpen || ui.worldMenuOpen || ui.openWindow || tradeWindow.isOpen || playerInteractions.isOpen)) return;
    e.preventDefault();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    dragPointer = e.pointerId; dragButton = e.button;
    view.dragging = true; view.dragDist = 0; view.lastX = e.clientX; view.lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId); canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!view.dragging || e.pointerId !== dragPointer) return;
    const dx = e.clientX - view.lastX, dy = e.clientY - view.lastY;
    view.lastX = e.clientX; view.lastY = e.clientY;
    view.dragDist += Math.abs(dx) + Math.abs(dy);
    if (dragButton === 0 && view.dragDist < 6) return;
    noteCameraControl();
    if (talk.conversationActor && isDialogOpen()) {
      talk.conversationOrbitYaw -= dx * .006;
      talk.conversationOrbitPitch = THREE.MathUtils.clamp(talk.conversationOrbitPitch + dy * .005, -1.2, 1.2);
    } else if (play.mode === 'play') {
      view.yaw -= dx * 0.006;
      view.pitch = THREE.MathUtils.clamp(view.pitch + dy * 0.005, 0.05, 1.4);
    } else {
      holder.rotation.y += dx * 0.01;
      view.spinVel = dx * 0.01;
    }
  });
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', (e) => { if (e.pointerId === dragPointer) cancelDrag(); });
  canvas.addEventListener('lostpointercapture', (e) => { if (e.pointerId === dragPointer) cancelDrag(); });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (isDialogOpen() || storyLock() || play.mapTravelling || ui.optionsOpen || ui.openWindow || ui.gameMenuOpen || ui.playerMenuOpen || ui.worldMenuOpen) return;
    noteCameraControl();
    const unit = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : e.deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight : 1;
    const factor = Math.exp(THREE.MathUtils.clamp(e.deltaY * unit, -240, 240) * .0011);
    if (play.mode === 'play') view.zoomTarget = THREE.MathUtils.clamp(view.zoomTarget * factor, 3, 30);
    else view.zoom = THREE.MathUtils.clamp(view.zoom * factor, 0.6, 1.4);
  }, { passive: false });
  window.addEventListener('blur', clearHeldInput);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearHeldInput(); });
  document.addEventListener('focusin', (e) => { if (editableTarget(e.target)) { keys.clear(); heldShift.clear(); shiftUsedAsModifier = false; } });
  window.addEventListener('keydown', (e) => {
    if (play.mode !== 'play') return;
    if (editableTarget(e.target) || e.isComposing) return;
    const isShift = e.code === 'ShiftLeft' || e.code === 'ShiftRight';
    if (!isShift && !e.repeat && heldShift.size) shiftUsedAsModifier = true;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (play.mapTravelling) { e.preventDefault(); return; }
    if (storyLock()) {
      e.preventDefault();
      if (cinematic.active && e.code === 'Escape' && !e.repeat) cinematic.skip();
      return;
    }
    if (tradeWindow.isOpen) { tradeWindow.key(e); return; }
    if (play.dead) {
      e.preventDefault();
      if (!e.repeat && (e.code === 'KeyE' || e.code === 'Enter')) respawn();
      return;
    }
    if (playerInteractions.isOpen) {
      playerInteractions.key(e);
      return;
    }
    if (ui.optionsOpen) {
      if (e.code === 'Escape' || (e.code === 'KeyO' && !e.repeat)) { e.preventDefault(); setOptionsOpen(false); }
      return;
    }
    if (isDialogOpen()) {
      e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'KeyE' || e.code === 'Enter') advanceDialog();
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') moveDialogChoice(-1);
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') moveDialogChoice(1);
      else if (/^Digit[1-9]$/.test(e.code)) chooseDialog(Number(e.code.slice(5)) - 1);
      else if (e.code === 'Escape' || e.code === 'Tab') exitDialog();
      return;
    }
    if (ui.openWindow === 'loot' && e.code === 'KeyE') {
      e.preventDefault();
      const focused = document.activeElement;
      const selected = focused instanceof HTMLButtonElement && focused.matches('.loot-item:not(:disabled)') ? focused
        : $('#window-body').querySelector<HTMLButtonElement>('.loot-item:not(:disabled)');
      if (!e.repeat) selected?.click();
      return;
    }
    if (e.code === 'Tab') {
      e.preventDefault();
      if (e.repeat) return;
      if (ui.openWindow) setWindow(null);
      else setPlayerMenuOpen(!ui.playerMenuOpen);
      return;
    }
    if (e.code === 'Escape') {
      e.preventDefault();
      if (e.repeat) return;
      if (ui.openWindow) setWindow(null);
      else if (ui.worldMenuOpen) setWorldMenuOpen(false);
      else if (ui.playerMenuOpen) setPlayerMenuOpen(false);
      else if (fight.lockedEnemy) releaseCombatTarget();
      else setGameMenuOpen(!ui.gameMenuOpen);
      return;
    }
    if (e.code === 'Enter' && !ui.gameMenuOpen && !ui.playerMenuOpen && !ui.worldMenuOpen && !ui.openWindow) {
      e.preventDefault();
      if (!e.repeat) focusChat();
      return;
    }
    if (!e.repeat && !ui.gameMenuOpen && ui.openWindow !== 'vendor' && ui.openWindow !== 'bank') {
      const win = e.code === 'KeyM' ? 'map' : e.code === 'KeyI' ? 'inventory' : e.code === 'KeyC' ? 'sheet' : e.code === 'KeyJ' ? 'quests' : e.code === 'KeyK' ? 'skills' : e.code === 'KeyP' ? 'professions' : null;
      if (win) { e.preventDefault(); setWindow(ui.openWindow === win ? null : win); return; }
      if (e.code === 'KeyO') { e.preventDefault(); setWindow(null, false); setPlayerMenuOpen(false, false); setOptionsOpen(true); return; }
    }
    if (ui.gameMenuOpen || ui.playerMenuOpen || ui.worldMenuOpen || (ui.openWindow && ui.openWindow !== 'loot')) return;
    if (isShift) {
      e.preventDefault();
      if (!e.repeat) { if (!heldShift.size) shiftUsedAsModifier = false; heldShift.add(e.code); }
      return;
    }
    if(e.code==='KeyF'){
      e.preventDefault();
      if(e.repeat)return;
      if (e.shiftKey) cycleCombatTarget(true); else lockCombatTarget();
      return;
    }
    const barSlot = actionBarSlotForKey(e.code);
    if (e.code === 'KeyZ') {
      if (!e.repeat) toggleActionBarPage();
      return;
    }
    if (e.code === 'Backquote' || e.key === 'º') {
      if (!e.repeat) toggleMinimap();
      return;
    }
    if (barSlot >= 0) {
      if (!e.repeat) useActionBarSlot(barSlot);
      return;
    }
    keys.add(e.code);
    if (e.code === 'KeyE' && !e.repeat) interact();
    if (e.code === 'IntlBackslash' || e.key === '<') { play.char.wave(); play.waveSequence++; }
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) startJump();
    } else if (e.code.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    if (!heldShift.delete(e.code) || heldShift.size || shiftUsedAsModifier) return;
    if (play.mode === 'play' && !play.dead && !play.mapTravelling && !storyLock() && !isDialogOpen() && !tradeWindow.isOpen && !playerInteractions.isOpen && !ui.optionsOpen && !ui.gameMenuOpen && !ui.playerMenuOpen && !ui.worldMenuOpen && !ui.openWindow && !editableTarget(e.target)) play.running = !play.running;
  });
}
