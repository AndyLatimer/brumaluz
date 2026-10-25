// Peticiones al servidor desde la partida (en ?test se simulan en local).
import { type CharacterAction, characterActions } from '../services/account';
import { simulateAction } from '../services/devActions';
import { session, play, vitals } from './state';
import { sanitize } from '../data/data';
import { renderActionBar } from '../ui/actionBar';
import { t } from '../ui/i18n';
import { characterContext } from './avatar';
import { setCombatEncounter } from './combat';
import { resetFoodTimer, tickFood, resetOverheal } from './vitals';
import { TEST } from './stage';
import { toast } from '../ui/toast';
import { acceptSnapshot } from './snapshotOrder';

/** Pide una acción al servidor (que decide el resultado) y copia sus datos al estado local. En ?test se simula en local. */

export async function serverAction(action: CharacterAction): Promise<boolean> {
  return runOnServer((id) => characterActions[action](id), () => simulateAction(session.state, action));
}
/** Ejecuta una petición al servidor con el personaje activo (o su simulación local en ?test) y copia el resultado al estado. */
export async function runOnServer(call: (id: string) => Promise<Record<string, unknown>>, simulate: () => void): Promise<boolean> {
  if (play.actionBusy) return false;
  const stillCurrent = characterContext();
  play.actionBusy = true;
  try {
    if (session.activeCharacterId) {
      const data = await call(session.activeCharacterId);
      if (!stillCurrent()) return false;
      if(!acceptSnapshot('full',data.serverRevision))return true;
      const next = sanitize(data);
      const currentVitals=acceptSnapshot('vitals',data.serverRevision);
      if(!currentVitals){next.health=session.state.health;next.resource=session.state.resource;next.overheal=session.state.overheal;next.enchantState=session.state.enchantState;}
      const at = typeof data.food_at === 'number' ? data.food_at : 0;
      const foodCurrent = next.foodRevision > session.state.foodRevision || (next.foodRevision === session.state.foodRevision && at >= vitals.foodSampleAt);
      if (!foodCurrent) { next.foodBuff = session.state.foodBuff; next.foodRevision = session.state.foodRevision; }
      Object.assign(session.state, next);
      if (currentVitals&&data.combatEncounter !== undefined) setCombatEncounter(data.combatEncounter);
      if (foodCurrent) resetFoodTimer(at);
    }
    else if (TEST) { tickFood(); simulate(); resetFoodTimer(); }
    else return false;
    resetOverheal();
    renderActionBar();
    return true;
  } catch (error) {
    if (stillCurrent()) toast('No se pudo completar la acción', errorMessage(error), true);
    return false;
  } finally {
    play.actionBusy = false;
  }
}
export function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    if (error.message.includes('USERNAME_ALREADY_TAKEN') || error.message.includes('profiles_username_unique')) {
      return t('Ese nombre de usuario ya está en uso. Elige otro.');
    }
  }
  if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
    return t('Ya tienes un personaje con ese nombre. Elige otro.');
  }
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    const message = error.message;
    if (/AbortError|TimeoutError|aborted|timed?\s*out/i.test(message)) return t('La conexión tarda en responder. El estado se actualizará al sincronizar con el mundo.');
    if (message.includes('Invalid login credentials')) return t('Correo o contraseña incorrectos.');
    if (message.includes('Email not confirmed')) return t('Confirma tu correo antes de iniciar sesión.');
    if (message.includes('User already registered')) return t('Ya existe una cuenta con ese correo.');
    return t(message);
  }
  return t('Ha ocurrido un error inesperado. Inténtalo de nuevo.');
}
