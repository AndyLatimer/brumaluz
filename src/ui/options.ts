// Ventana de opciones: pestañas, sonido y placas de nombre.
import { ui, play } from '../game/state';
import { renderControls } from './controls';
import { saveSettings } from '../services/settings';
import { playerInteractions } from '../game/interaction';
import { refreshOverlayHud, setGameMenuOpen, setWorldMenuOpen } from './menus';
import { $ } from './dom';
import { keys } from '../game/stage';
import { refreshAmbientControls, setAmbientEnabled,setWorldMusicEnabled, settings, applyVolumes } from '../game/audio';

// ---------------- Ventana de opciones ----------------

export function setOptionsOpen(open: boolean) {
  if (open) playerInteractions.close();
  ui.optionsOpen = open;
  refreshOverlayHud();
  $('#options-backdrop').hidden = !open;
  keys.clear();
  if (open) {
    setGameMenuOpen(false, false);
    setWorldMenuOpen(false, false);
    $('#options-message').textContent = '';
    refreshAmbientControls();
    renderControls($('#controls-view'));
    $<HTMLButtonElement>('.options-tab[aria-selected="true"]').focus();
  } else $<HTMLButtonElement>('#game-menu-toggle').focus();
}
export function selectOptionsTab(tab: string) {
  for (const b of document.querySelectorAll<HTMLButtonElement>('.options-tab')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  for (const p of document.querySelectorAll<HTMLElement>('.options-pane')) p.hidden = p.dataset.pane !== tab;
}
/** Controles de la ventana de opciones. */
export function installOptions() {
  for (const b of document.querySelectorAll<HTMLButtonElement>('.options-tab')) b.onclick = () => selectOptionsTab(b.dataset.tab!);
  $('#game-menu-options').onclick = () => setOptionsOpen(true);
  $('#options-close').onclick = () => setOptionsOpen(false);
  $('#options-backdrop').addEventListener('pointerdown', (e) => { if (e.target === e.currentTarget) setOptionsOpen(false); });
  $('#opt-ambient').onclick = () => { void setAmbientEnabled(!play.ambientEnabled); };
  $('#opt-music').onclick=()=>setWorldMusicEnabled(!settings.musicEnabled);
  $('#opt-nameplates').onclick = () => {
    settings.nameplates = !settings.nameplates;
    saveSettings(settings);
    refreshAmbientControls();
  };
  for (const id of ['ambient', 'music','master'] as const) {
    $<HTMLInputElement>(`#opt-${id}-volume`).oninput = (e) => {
      settings[id === 'ambient' ? 'ambientVolume' : id==='music'?'musicVolume':'masterVolume'] = Number((e.target as HTMLInputElement).value);
      saveSettings(settings);
      applyVolumes();
      refreshAmbientControls();
    };
  }
  refreshAmbientControls();
}
