// Vida, recurso, comida, sobrecuración, experiencia y dinero del jugador, con sus efectos en pantalla.
import { vitalsOf, OVERHEAL, experienceToNextLevel } from '../data/stats';
import { session, vitals, ui, play, view, story } from './state';
import { renderBuffs } from '../ui/buffs';
import type { FoodBuff } from '../data/food';
import { chatCombat, chatSystem } from '../ui/chatWindow';
import { t } from '../ui/i18n';
import { closeDialog } from '../ui/dialog';
import { beginMapTransition } from '../ui/transitionLoading';
import { locationName, MAX_LEVEL, unspentAttributePoints } from '../data/data';
import { collectCoinBag, collectFairyDust } from '../services/account';
import { addItem } from '../services/devActions';
import { COIN_BAGS } from '../data/coinBags';
import { FAIRY_DUST_QUEST_TITLE } from '../data/quests';
import { updateHud } from './hud';
import { setWindow, setGameMenuOpen, setPlayerMenuOpen, setWorldMenuOpen } from '../ui/menus';
import { serverAction, errorMessage, runOnServer } from './server';
import { restartClass, floatText, sparkBurst } from './effects';
import { $ } from '../ui/dom';
import { clock, keys, marker, playerVel, holder } from './stage';
import { releaseCombatTarget } from './combat';
import { playerInteractions } from './interaction';
import { cinematic, restoreStoryFog, removeMonsterPreview } from '../story/scenes';
import { endIsbertoArrival } from '../story/isbertoArrival';
import { gameCity, switchGameMap } from './cities';
import { toast } from '../ui/toast';
import { returnToCharacters } from '../ui/characterSelect';

/** Vida + sobrecuración: lo que el jugador puede perder antes de caer. */
export const totalHealth = () => { const v = vitalsOf(session.state); return v.health + v.overheal; };
export function resetFoodTimer(at = 0) {
  vitals.foodBase = session.state.foodBuff?.remaining ?? 0;
  vitals.foodSince = performance.now();
  vitals.foodSampleAt = at;
  renderBuffs(session.state, !vitals.foodRunning);
}
export function setFoodRunning(running: boolean) {
  tickFood();
  vitals.foodRunning = running;
  resetFoodTimer(vitals.foodSampleAt);
}
export function receiveFood(food: { buff: FoodBuff | null; revision: number; at: number }) {
  if (food.revision < session.state.foodRevision || (food.revision === session.state.foodRevision && food.at < vitals.foodSampleAt)) return;
  const hadBuff = !!session.state.foodBuff;
  session.state.foodBuff = food.buff;
  session.state.foodRevision = food.revision;
  resetFoodTimer(food.at);
  if (hadBuff !== !!session.state.foodBuff) {
    updateHud();
    if (ui.openWindow === 'sheet') setWindow('sheet', false);
  }
}
export function tickFood() {
  const buff = session.state.foodBuff;
  if (!buff || !vitals.foodRunning) return;
  const remaining = Math.max(0, vitals.foodBase - (performance.now() - vitals.foodSince) / 1000);
  if (remaining <= 0) {
    session.state.foodBuff = null;
    updateHud();
    if (ui.openWindow === 'sheet') setWindow('sheet', false);
  } else {
    buff.remaining = remaining;
    renderBuffs(session.state, false);
  }
}
export function resetOverheal() { vitals.overhealBase = session.state.overheal; vitals.overhealSince = performance.now(); }
export function tickOverheal() {
  if (vitals.overhealBase <= 0 && session.state.overheal <= 0) return;
  const left = Math.max(0, vitals.overhealBase - Math.floor(((performance.now() - vitals.overhealSince) / 1000) * OVERHEAL.decayPerSecond));
  if (left !== session.state.overheal) { session.state.overheal = left; updateHud(); }
}
/** Resta vida al jugador (el servidor decide cuánta) y lo muestra: viñeta roja, golpe, sacudida de cámara, número flotante y barra. */

export async function damagePlayer(source = 'Algo') {
  if (play.dead) return;
  const before = totalHealth();
  if (!(await serverAction('damage'))) return;
  const amount = before - totalHealth();
  chatCombat(t('{who} te hace {n} puntos de daño.', { who: t(source), n: amount }));
  updateHud();
  restartClass($('#damage-vignette'), 'hit');
  restartClass($('.hud-health'), 'hurt');
  view.shakeUntil = clock.getElapsedTime() + 0.35;
  floatText(`-${amount}`, 'damage');
  if (vitalsOf(session.state).health === 0) { die(); return; }
  play.char.hit();
}
/** Muerte: cae al suelo, se apaga el color del mundo y aparece la pantalla de reaparición. */
export function die() {
  releaseCombatTarget();
  playerInteractions.close();
  play.dead = true;
  cinematic.cancel(); restoreStoryFog(); endIsbertoArrival();
  story.playerScript = null; story.welcomeWorld.release(); removeMonsterPreview();
  closeDialog();
  setGameMenuOpen(false, false);
  setPlayerMenuOpen(false, false);
  setWorldMenuOpen(false, false);
  setWindow(null, false);
  keys.clear();
  play.moveTarget = null;
  marker.visible = false;
  playerVel.set(0, 0, 0);
  play.char.die();
  document.body.classList.add('dead');
  $('#death-screen').hidden = false;
}
/** Reaparece en la capital (por ahora, el punto de inicio de Brumaluz) con la vida completa. */
export async function respawn() {
  if (!play.dead || play.mapTravelling) return;
  play.mapTravelling = true;
  const connection = session.worldConnection;
  const finish = beginMapTransition({ name: locationName('brumaluz'), region: 'Pompelín', loadingTip: 'Al caer, vuelves a la capital.' });
  try {
  await connection?.suspend();
  await gameCity('brumaluz');
  if (!(await serverAction('respawn'))) return;
  await switchGameMap('brumaluz');
  play.dead = false;
  $('#death-screen').hidden = true;
  document.body.classList.remove('dead');
  holder.position.copy(play.city.spawn);
  holder.rotation.y = play.city.spawnYaw + Math.PI;
  play.groundHeight = play.city.spawn.y; play.lastPlatformY = null;
  play.jumpElapsed = play.jumpDuration;
  play.jumpHeight = 0;
  view.yaw = play.city.spawnYaw;
  playerVel.set(0, 0, 0);
  play.char.revive();
  updateHud();
  restartClass($('#heal-vignette'), 'hit');
  restartClass($('.hud-health'), 'healed');
  } catch (error) {
    console.error('No se pudo reaparecer en Brumaluz.', error);
    toast('No se pudo reaparecer', errorMessage(error), true);
    if (connection === session.worldConnection && connection) await returnToCharacters();
  } finally {
    play.mapTravelling = false;
    finish();
    if (connection === session.worldConnection) connection?.resume();
  }
}
/** Cura al jugador (sin pasar del máximo) con viñeta verde, destellos ascendentes, animación y número flotante. */
export async function healPlayer(source = 'Algo') {
  if (play.dead) return;
  const before = totalHealth();
  if (!(await serverAction('heal'))) return;
  const healed = totalHealth() - before;
  chatCombat(t('{who} te cura {n} puntos de vida.', { who: t(source), n: healed }), 'heal');
  updateHud();
  restartClass($('#heal-vignette'), 'hit');
  restartClass($('.hud-health'), 'healed');
  play.char.heal();
  floatText(`+${healed}`, 'heal');
  for (let i = 0; i < 12; i++) {
    const spark = document.createElement('div');
    spark.className = 'heal-spark';
    spark.textContent = '✦';
    spark.style.left = `${50 + (Math.random() - 0.5) * 14}%`;
    spark.style.top = `${52 + (Math.random() - 0.5) * 16}%`;
    spark.style.setProperty('--dx', `${((Math.random() - 0.5) * 120).toFixed(0)}px`);
    spark.style.animationDelay = `${(Math.random() * 0.45).toFixed(2)}s`;
    document.body.appendChild(spark);
    spark.addEventListener('animationend', () => spark.remove());
  }
}
/** Da experiencia al jugador: destellos dorados, barra brillante y, si completa niveles, celebración extra. */

export async function gainExperience() {
  if (play.dead) return;
  if (session.state.level >= MAX_LEVEL) { floatText(t('Nivel máximo'), 'xp'); return; }
  const startLevel = session.state.level, startPoints = unspentAttributePoints(session.state), startTotal = session.state.experience;
  if (!(await serverAction('xp'))) return;
  // XP realmente ganada: lo recorrido dentro de los niveles que ha cruzado.
  let amount = session.state.experience - startTotal;
  for (let level = startLevel; level < session.state.level; level++) amount += experienceToNextLevel(level);
  const leveled = session.state.level > startLevel;
  if (leveled) {
    // La barra se llena del todo antes de vaciarse al nuevo nivel.
    $('#hud-xp-fill').style.width = '100%';
    window.clearTimeout(vitals.xpSettle);
    vitals.xpSettle = window.setTimeout(updateHud, 700);
  } else updateHud();
  restartClass($('#xp-vignette'), 'hit');
  restartClass($('.hud-xp'), 'gain');
  floatText(`+${amount} XP`, 'xp');
  chatSystem(t('Has recibido {n} puntos de experiencia.', { n: amount }));
  if (leveled) chatSystem(t('¡Has subido al nivel {n}!', { n: session.state.level }));
  sparkBurst(14, 'xp');
  if (!leveled) { play.char.heal(); return; }
  play.char.wave();
  restartClass($('#levelup-flash'), 'hit');
  $('#levelup-title').textContent = `${t('Nivel')} ${session.state.level}`;
  const gained = unspentAttributePoints(session.state) - startPoints;
  const pointsLine = $('#levelup-points');
  pointsLine.hidden = gained <= 0;
  pointsLine.textContent = t('+{n} punto de atributo', { n: gained });
  restartClass($('#levelup-banner'), 'show');
  sparkBurst(30, 'xp big', '★');
  restartClass($('#hud-level'), 'pop');
}
/** Da 100 pelines (NPC de pruebas): el servidor suma el dinero y el cliente solo lo muestra. */
export async function receiveMoney() {
  if (play.dead || !(await serverAction('money'))) return;
  floatText(`+100 ${t('Pelines')}`, 'xp');
  chatSystem(t('Has recibido {n} pelines.', { n: 100 }));
  sparkBurst(10, 'xp', '●');
}
/** Recoge una bolsa de pelines del mundo: el servidor sortea la cantidad y la marca como recogida. */
export async function pickUpCoinBag(bagId: string) {
  keys.clear();
  play.moveTarget = null;
  marker.visible = false;
  const before = session.state.wallet.pelines;
  const collected = await runOnServer(id => collectCoinBag(id, bagId), () => {
    if (session.state.coinBags.includes(bagId)) throw new Error(t('Ya has recogido esta bolsa de pelines.'));
    session.state.coinBags = [...session.state.coinBags, bagId];
    const spot = COIN_BAGS.find(bag => bag.id === bagId)!;
    session.state.wallet.pelines += spot.min + Math.floor(Math.random() * (spot.max - spot.min + 1));
  });
  if (!collected) return;
  play.char.pickUp();
  const amount = session.state.wallet.pelines - before;
  floatText(`+${amount} ${t('Pelines')}`, 'xp');
  chatSystem(t('Has encontrado {amount} pelines.', { amount }));
  sparkBurst(10, 'xp', '●');
  if (ui.openWindow === 'inventory') setWindow('inventory', false);
  else if (ui.openWindow === 'collections') setWindow('collections', false);
}
/** Recoge un montón de polvos de hada del mundo: el servidor sortea la cantidad y lo marca como recogido. */
export async function pickUpFairyDust(dustId: string) {
  keys.clear();
  play.moveTarget = null;
  marker.visible = false;
  const dustCount = () => session.state.inventory.reduce((total, item) => total + (item?.id === 'polvo_de_hada' ? item.count : 0), 0);
  const before = dustCount();
  const hadQuest = session.state.fairyDustQuest !== null;
  const collected = await runOnServer(id => collectFairyDust(id, dustId), () => {
    const fairyDust = session.state.fairyDust ?? [];
    if (fairyDust.includes(dustId)) throw new Error(t('Ya has recogido estos polvos de hada.'));
    const amount = 1 + Math.floor(Math.random() * 5);
    const next = { ...session.state, inventory: session.state.inventory.map(item => item ? { ...item } : null) };
    for (let i = 0; i < amount; i++) addItem(next, 'polvo_de_hada');
    session.state.inventory = next.inventory;
    session.state.fairyDust = [...fairyDust, dustId];
    session.state.fairyDustQuest ??= 'ask_gnomi';
  });
  if (!collected) return;
  play.char.pickUp();
  const amount = dustCount() - before;
  floatText(`+${amount} ${t('Polvo de hada')}`, 'item');
  chatSystem(t('Has encontrado {n} {item}.', { n: amount, item: t('Polvo de hada') }));
  sparkBurst(10, 'item', '✦');
  if (!hadQuest && session.state.fairyDustQuest === 'ask_gnomi') {
    toast(FAIRY_DUST_QUEST_TITLE, 'Has encontrado polvo de hada. Quizá Gnomi sepa algo sobre él.', false, {}, 'quest');
    updateHud();
  }
  if (ui.openWindow === 'inventory') setWindow('inventory', false);
  else if (ui.openWindow === 'collections') setWindow('collections', false);
}
