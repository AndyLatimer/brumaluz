// Sonido: ambiente, música de los menús y sus volúmenes.
import { AmbientSoundscape } from '../world/audio';
import { CombatAudio } from '../world/combatAudio';
import { initMenuMusic } from '../ui/menuMusic';
import { loadSettings } from '../services/settings';
import { saveSettings } from '../services/settings';
import { play,fight } from './state';
import { isInCombat } from '../data/combat';
import { DayMusic } from '../world/dayMusic';
import { t } from '../ui/i18n';
import { $ } from '../ui/dom';

export const settings = loadSettings();
export const worldMusic=new DayMusic(settings.musicEnabled);
export const ambientSoundscape = new AmbientSoundscape();
export const combatAudio = new CombatAudio();
export const menuMusic = initMenuMusic();
if (import.meta.hot) import.meta.hot.dispose(() => {
  void combatAudio.dispose().catch(()=>{});
  void worldMusic.dispose().catch(()=>{});
  void ambientSoundscape.dispose().catch((error: unknown) => console.error('No se pudo cerrar el sonido ambiental:', error));
  void menuMusic.dispose().catch((error: unknown) => console.error('No se pudo cerrar la música:', error));
});
export function applyVolumes() {
  combatAudio.setLevel(settings.masterVolume/100);
  ambientSoundscape.setLevel((settings.ambientVolume / 100) * (settings.masterVolume / 100));
  worldMusic.setLevel((settings.musicVolume/100)*(settings.masterVolume/100));
  menuMusic.setLevel((settings.masterVolume / 100)*(settings.musicVolume/100));
}
applyVolumes();
export function setWorldMusicEnabled(enabled:boolean){settings.musicEnabled=enabled;saveSettings(settings);worldMusic.setEnabled(enabled);refreshAmbientControls();}
export function updateWorldAudio(hour:number,inside:boolean){
  worldMusic.update({playing:play.mode==='play'&&!play.mapTravelling,hour,inside,
    dialogue:document.body.classList.contains('conversation-open')||document.body.classList.contains('cinematic-open'),combat:isInCombat(fight.combatEncounter)});
  ambientSoundscape.setWorldTime(hour,inside);
}
export async function setAmbientEnabled(enabled: boolean) {
  const version = ++play.ambientChange;
  play.ambientEnabled = enabled;
  refreshAmbientControls();
  localStorage.setItem('brumaluz-ambient', enabled ? 'on' : 'off');
  $('#options-message').textContent = enabled ? t('Activando sonido ambiental…') : '';
  try {
    await ambientSoundscape.setEnabled(enabled);
    if (version === play.ambientChange) $('#options-message').textContent = '';
  } catch (error) {
    if (version === play.ambientChange) reportAmbientError(error);
  }
}
export function refreshAmbientControls() {
  $('#opt-nameplates').setAttribute('aria-checked', String(settings.nameplates));
  $('#opt-ambient').setAttribute('aria-checked', String(play.ambientEnabled));
  $('#opt-music').setAttribute('aria-checked',String(settings.musicEnabled));
  $<HTMLInputElement>('#opt-ambient-volume').disabled = !play.ambientEnabled;
  for (const [id, value] of [['ambient', settings.ambientVolume], ['music',settings.musicVolume],['master', settings.masterVolume]] as const) {
    const input = $<HTMLInputElement>(`#opt-${id}-volume`);
    input.value = String(value);
    input.style.setProperty('--fill', `${value}%`);
    $(`#opt-${id}-value`).textContent = `${value}%`;
  }
}
export function reportAmbientError(error: unknown) {
  console.error('No se pudo iniciar el sonido ambiental:', error);
  play.ambientEnabled = false;
  void ambientSoundscape.setEnabled(false);
  refreshAmbientControls();
  $('#options-message').textContent = t('No se pudo iniciar el sonido ambiental.');
  localStorage.setItem('brumaluz-ambient', 'off');
}
