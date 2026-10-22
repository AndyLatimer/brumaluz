// Sonido: ambiente, música de los menús y sus volúmenes.
import { AmbientSoundscape } from '../world/audio';
import { initMenuMusic } from '../ui/menuMusic';
import { loadSettings } from '../services/settings';
import { play } from './state';
import { t } from '../ui/i18n';
import { $ } from '../ui/dom';

export const ambientSoundscape = new AmbientSoundscape();
export const menuMusic = initMenuMusic();
if (import.meta.hot) import.meta.hot.dispose(() => {
  void ambientSoundscape.dispose().catch((error: unknown) => console.error('No se pudo cerrar el sonido ambiental:', error));
  void menuMusic.dispose().catch((error: unknown) => console.error('No se pudo cerrar la música:', error));
});
export const settings = loadSettings();
export function applyVolumes() {
  ambientSoundscape.setLevel((settings.ambientVolume / 100) * (settings.masterVolume / 100));
  menuMusic.setLevel(settings.masterVolume / 100);
}
applyVolumes();
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
  $<HTMLInputElement>('#opt-ambient-volume').disabled = !play.ambientEnabled;
  for (const [id, value] of [['ambient', settings.ambientVolume], ['master', settings.masterVolume]] as const) {
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
