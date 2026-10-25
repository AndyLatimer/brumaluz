// Selección de personajes: lista, borrado, creación y entrada al mundo.
import { ui, view, session, play } from '../game/state';
import { t, raceText, classText } from './i18n';
import { type SavedCharacter, MAX_CHARACTERS_PER_ACCOUNT, deleteCharacter as removeCharacter, listCharacters, getProfileUsername, createCharacter, signOut } from '../services/account';
import { createCharacterPortrait } from '../character/portrait';
import { locationName, sanitize, defaultChar, randomName, unspentAttributePoints } from '../data/data';
import { beginTransition } from './transitionLoading';
import { classIcon } from './classIcons';
import type { User } from '@supabase/supabase-js';
import { $ } from './dom';
import { menuMusic, ambientSoundscape, reportAmbientError } from '../game/audio';
import { refreshUI, nameInput, selectTab } from './creator';
import { rebuildNow, characterContext } from '../game/avatar';
import { layout, renderer } from '../game/stage';
import { loadWorldState, stopMultiplayer } from '../game/worldClient';
import { enterPlay, exitPlay } from '../game/playSession';
import { errorMessage } from '../game/server';
import { showAuthScreen } from './accountScreens';
import { toast } from './toast';
import { setGameMenuOpen } from './menus';

export function showEditor() {
  document.body.classList.remove('auth-visible', 'characters-visible');
  $('#account-gate').hidden = true;
  menuMusic.sync();
  document.querySelectorAll<HTMLElement>('#tabs button').forEach((button) => button.classList.toggle('active', button.dataset.tab === 'raza'));
  document.querySelectorAll<HTMLElement>('#pages section').forEach((section) => section.classList.toggle('active', section.dataset.page === 'raza'));
  ui.tab = 'raza';
  $('#panel').style.setProperty('--tab-marker-left', '10%');
  view.focus = 'body';
  view.zoom = 1;
  refreshUI();
  rebuildNow();
  layout();
}
export function showCharacterScreen() {
  syncBackdropTime();
  document.body.classList.remove('auth-visible');
  document.body.classList.add('characters-visible');
  $('#account-gate').hidden = false;
  menuMusic.sync();
  $('#auth-screen').hidden = true;
  $('#character-screen').hidden = false;
  $('#account-username').textContent = session.currentUsername ? `~${session.currentUsername}` : t('Nombre de usuario pendiente de asignación');
  $('#account-email').textContent = session.currentUser?.email ?? '';
  $('#character-message').classList.remove('error');
}
export function syncBackdropTime() {
  const hour = new Date().getHours();
  document.body.classList.toggle('daytime', hour >= 6 && hour < 18);
  menuMusic.sync();
}
export function displayCharacters(characters: SavedCharacter[]) {
  session.cachedCharacters = characters;
  const list = $('#character-list');
  list.replaceChildren();
  $('#character-count').textContent = `(${characters.length}/${MAX_CHARACTERS_PER_ACCOUNT})`;
  if (!characters.length) {
    const empty = document.createElement('p');
    empty.className = 'account-intro';
    empty.textContent = t('Aún no tienes personajes. Crea uno para comenzar tu aventura.');
    list.appendChild(empty);
  }
  for (const saved of characters) {
    const record = document.createElement('article');
    record.className = 'character-card';
    const info = document.createElement('div');
    info.className = 'character-info';
    const copy = document.createElement('div');
    copy.className = 'character-copy';
    const name = document.createElement('strong');
    name.textContent = saved.name;
    const detail = document.createElement('span');
    detail.className = 'character-detail';
    const data = characterFromRecord(saved);
    detail.textContent = `${raceText(data)} · ${classText(data)}`;
    const portrait = createCharacterPortrait(data, renderer);
    portrait.className = 'character-portrait';
    portrait.setAttribute('aria-hidden', 'true');
    const level = document.createElement('span');
    level.className = 'character-level';
    level.textContent = `${t('Nivel')} ${data.level}`;
    const location = document.createElement('span');
    location.className = 'character-location';
    const locationIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    locationIcon.setAttribute('viewBox', '0 0 24 24');
    locationIcon.setAttribute('aria-hidden', 'true');
    locationIcon.innerHTML = '<path d="m12 2.8 8 4.6v9.2l-8 4.6-8-4.6V7.4l8-4.6Z"/><path d="M8 16V9.5l4-2.3 4 2.3V16M6.5 16h11M10 11h.01M14 11h.01M11 16v-2.5h2V16"/>';
    const placeName = t(locationName(data.location));
    location.append(locationIcon, document.createTextNode(placeName));
    location.setAttribute('aria-label', t('Ubicación: {location}', { location: placeName }));
    copy.append(name, detail, level, location);
    info.append(portrait, copy);
    const actions = document.createElement('div');
    actions.className = 'character-actions';
    const play = document.createElement('button');
    play.type = 'button';
    play.className = 'btn gold';
    play.textContent = t('Jugar');
    play.onclick = async () => {
      if (session.enteringWorld) return;
      session.enteringWorld = true;
      play.disabled = true;
      const finishTransition = beginTransition('Entrando en Brumaluz…');
      try {
        loadCharacter(saved);
        if (!(await loadWorldState())) return;
        showEditor();
        enterPlay();
      } finally {
        finishTransition();
        session.enteringWorld = false;
        play.disabled = false;
      }
    };
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn danger';
    remove.textContent = t('Borrar');
    remove.setAttribute('aria-label', `${t('Borrar')} ${saved.name}`);
    remove.onclick = () => openDeleteDialog(saved);
    actions.append(play, remove);
    record.append(info, actions);
    const classBadge = document.createElement('span');
    classBadge.className = 'character-class-icon';
    classBadge.title = classText(data);
    classBadge.innerHTML = classIcon(data.cls, `card${saved.id}`);
    record.append(classBadge);
    list.appendChild(record);
  }
  const atCharacterLimit = characters.length >= MAX_CHARACTERS_PER_ACCOUNT;
  $<HTMLButtonElement>('#new-character').disabled = atCharacterLimit;
  $('#character-limit-message').textContent = atCharacterLimit
    ? t('Has alcanzado el máximo de {max} personajes por cuenta. Borra uno para crear otro.', { max: MAX_CHARACTERS_PER_ACCOUNT })
    : t('Puedes tener hasta {max} personajes en tu cuenta.', { max: MAX_CHARACTERS_PER_ACCOUNT });
}
export function openDeleteDialog(character: SavedCharacter) {
  if (session.enteringWorld) return;
  session.characterPendingDeletion = character;
  $('#delete-dialog-description').textContent = t('Vas a borrar definitivamente a {name}. Esta acción no se puede deshacer.', { name: character.name });
  deleteNameInput.disabled = false;
  deleteNameInput.value = '';
  $('#delete-dialog-message').textContent = '';
  $<HTMLButtonElement>('#confirm-delete').disabled = true;
  $('#delete-dialog-backdrop').hidden = false;
  $<HTMLInputElement>('#delete-character-name').focus();
}
export function closeDeleteDialog() {
  if (session.deletingCharacter) return;
  session.characterPendingDeletion = null;
  $('#delete-dialog-backdrop').hidden = true;
}
export const deleteNameInput = $<HTMLInputElement>('#delete-character-name');
export const deleteConfirmButton = $<HTMLButtonElement>('#confirm-delete');
export function characterFromRecord(saved: SavedCharacter) {
  if (!saved.data || typeof saved.data !== 'object' || Array.isArray(saved.data)) {
    throw new Error(`Los datos guardados de ${saved.name} no tienen un formato válido.`);
  }
  const character = sanitize(saved.data as Record<string, unknown>);
  character.name = saved.name;
  return character;
}
export function loadCharacter(saved: SavedCharacter) {
  session.state = characterFromRecord(saved);
  session.activeCharacterId = saved.id;
}
export async function loadCharacterSelection(user: User) {
  const syncId = ++session.accountSyncId;
  session.currentUsername = null;
  session.currentUser = user;
  showCharacterScreen();
  $('#account-username').textContent = t('Cargando…');
  $('#character-list').replaceChildren();
  $('#character-message').textContent = t('Cargando tus personajes…');
  try {
    const [charactersResult, usernameResult] = await Promise.allSettled([
      listCharacters(user.id),
      getProfileUsername(user.id),
    ]);
    if (syncId !== session.accountSyncId || session.currentUser?.id !== user.id) return;
    if (charactersResult.status === 'rejected') throw charactersResult.reason;
    displayCharacters(charactersResult.value);
    if (usernameResult.status === 'fulfilled') {
      session.currentUsername = usernameResult.value;
      $('#account-username').textContent = session.currentUsername ? `~${session.currentUsername}` : t('Nombre de usuario pendiente de asignación');
      $('#character-message').textContent = '';
      $('#character-message').classList.remove('error');
    } else {
      $('#account-username').textContent = t('No se pudo cargar el nombre de usuario');
      $('#character-message').textContent = errorMessage(usernameResult.reason);
      $('#character-message').classList.add('error');
    }
  } catch (error) {
    if (syncId !== session.accountSyncId) return;
    $('#character-message').textContent = errorMessage(error);
    $('#character-message').classList.add('error');
  }
}
export async function syncAccount(sessionUser: User | null) {
  if (!sessionUser) {
    stopMultiplayer();
    if (play.mode === 'play') exitPlay();
    session.accountSyncId++;
    session.currentUser = null;
    session.currentUsername = null;
    session.activeCharacterId = null;
    showAuthScreen();
    return;
  }
  if (session.currentUser?.id === sessionUser.id && (play.mode === 'play' || session.worldConnection || session.enteringWorld || session.savingCharacter)) return;
  if (session.currentUser?.id !== sessionUser.id) stopMultiplayer();
  if (session.currentUser && session.currentUser.id !== sessionUser.id && play.mode === 'play') exitPlay();
  await loadCharacterSelection(sessionUser);
}
export function validCharacterName() {
  const name = session.state.name.trim();
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]{3,16}$/.test(name)) {
    toast('Un momento…', 'Tu nombre necesita entre 3 y 16 letras.', true);
    nameInput.focus();
    return false;
  }
  session.state.name = name[0].toUpperCase() + name.slice(1);
  nameInput.value = session.state.name;
  return true;
}
/** Crea el personaje en el servidor si aún no existe (el servidor valida el nombre, el reparto inicial y la apariencia). */
export async function createCurrentCharacter() {
  if (session.activeCharacterId) return true;
  if (session.savingCharacter || !session.currentUser || !validCharacterName()) return false;
  session.savingCharacter = true;
  const stillCurrent = characterContext();
  try {
    const id = await createCharacter(session.state);
    if (!stillCurrent()) return false;
    session.activeCharacterId = id;
    return true;
  } catch (error) {
    if (stillCurrent()) toast('No se pudo guardar', errorMessage(error), true);
    return false;
  } finally {
    session.savingCharacter = false;
  }
}
export async function returnToCharacters() {
  const finishTransition = beginTransition('Volviendo a tus personajes…');
  try {
    const user = session.currentUser;
    if (play.mode === 'play') {
      const stopped = stopMultiplayer();
      exitPlay();
      // Al salir, la partida vuelve al modo creador: se tapa ya con la pantalla de personajes mientras el servidor cierra la sesión.
      showCharacterScreen();
      await stopped;
    }
    if (user && session.currentUser?.id === user.id) await loadCharacterSelection(user);
  } finally {
    finishTransition();
  }
}
export function startNewCharacter() {
  if (!session.currentUser || session.enteringWorld || $<HTMLButtonElement>('#new-character').disabled) return;
  session.state = defaultChar();
  session.state.name = randomName(session.state.race);
  session.activeCharacterId = null;
  showEditor();
}
/** Botones de la selección de personajes y del menú del juego. */
export function installCharacterSelect() {
  deleteNameInput.oninput = () => {
    deleteConfirmButton.disabled = !session.characterPendingDeletion || deleteNameInput.value !== session.characterPendingDeletion.name;
    $('#delete-dialog-message').textContent = '';
  };
  $('#cancel-delete').onclick = closeDeleteDialog;
  $('#delete-dialog-backdrop').addEventListener('click', (event) => {
    if (event.target === $('#delete-dialog-backdrop')) closeDeleteDialog();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !$('#delete-dialog-backdrop').hidden) closeDeleteDialog();
  });
  deleteConfirmButton.onclick = async () => {
    const selected = session.characterPendingDeletion;
    const user = session.currentUser;
    if (!selected || !user || deleteNameInput.value !== selected.name || deleteConfirmButton.disabled) return;

    deleteConfirmButton.disabled = true;
    deleteNameInput.disabled = true;
    session.deletingCharacter = true;
    $('#cancel-delete').setAttribute('disabled', 'true');
    $('#delete-dialog-message').textContent = t('Borrando personaje…');
    try {
      await removeCharacter(user.id, selected.id);
      session.deletingCharacter = false;
      if (session.activeCharacterId === selected.id) session.activeCharacterId = null;
      closeDeleteDialog();
      if (session.currentUser?.id === user.id) await loadCharacterSelection(user);
    } catch (error) {
      session.deletingCharacter = false;
      deleteNameInput.disabled = false;
      $('#delete-dialog-message').textContent = errorMessage(error);
      $('#cancel-delete').removeAttribute('disabled');
      deleteConfirmButton.disabled = deleteNameInput.value !== selected.name;
    }
  };
  $('#sign-out').onclick = async () => {
    try {
      await signOut();
      await syncAccount(null);
    } catch (error) {
      toast('No se pudo completar la acción', errorMessage(error), true);
      $('#character-message').textContent = errorMessage(error);
      $('#character-message').classList.add('error');
    }
  };
  $('#new-character').onclick = startNewCharacter;
  $('#account-characters').onclick = () => { void returnToCharacters(); };
  $('#game-menu-toggle').onclick = () => setGameMenuOpen(!ui.gameMenuOpen);
  $('#game-menu-characters').onclick = () => { void returnToCharacters(); };
  $('#game-menu-logout').onclick = async () => {
    const logoutButton = $<HTMLButtonElement>('#game-menu-logout');
    logoutButton.disabled = true;
    $('#game-menu-message').textContent = t('Cerrando sesión…');
    try {
      if (play.mode === 'play') await returnToCharacters();
      await signOut();
      await syncAccount(null);
    } catch (error) {
      toast('No se pudo completar la acción', errorMessage(error), true);
      $('#character-message').textContent = errorMessage(error);
      $('#character-message').classList.add('error');
    } finally {
      logoutButton.disabled = false;
    }
  };
  document.addEventListener('click', (event) => {
    const menu = $('#game-menu');
    if (ui.gameMenuOpen && event.target instanceof Node && !menu.contains(event.target)) {
      setGameMenuOpen(false, false);
    }
  });
  $('#enter').onclick = async () => {
    if (session.enteringWorld) return;
    if (unspentAttributePoints(session.state) > 0) {
      selectTab('raza');
      $('#attributePointsLeft').scrollIntoView({ block: 'center' });
      toast('Un momento…', 'Reparte todos tus puntos de atributo antes de empezar.', true);
      return;
    }
    session.enteringWorld = true;
    const enter = $<HTMLButtonElement>('#enter');
    enter.disabled = true;
    const finishTransition = beginTransition('Preparando tu aventura…');
    const stillCurrent = characterContext();
    try {
      if (play.ambientEnabled) {
        try {
          await ambientSoundscape.prepare();
        } catch (error) {
          reportAmbientError(error);
        }
      }
      if (!stillCurrent()) return;
      if (!(await createCurrentCharacter())) return;
      if (!(await loadWorldState())) return;
      view.focus = 'body';
      enterPlay();
      // La llegada ya presenta la ciudad y a Gnomi; un saludo automático rompería el paseo.
      if (session.state.introSeen || !session.state.welcome) {
        toast('¡Te damos la bienvenida, {name}!', 'Tu aventura en Brumaluz comienza ahora.', false, { name: session.state.name });
      }
    } finally {
      finishTransition();
      session.enteringWorld = false;
      enter.disabled = false;
    }
  };
}
