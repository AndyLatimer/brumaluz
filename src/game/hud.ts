// Indicadores sobre la escena: barras del jugador, placa con el nombre y bocadillos.
import * as THREE from 'three';
import { renderActionBar } from '../ui/actionBar';
import { renderBuffs } from '../ui/buffs';
import { session, vitals, play, ui, story } from './state';
import { vitalsOf } from '../data/stats';
import { classIcon } from '../ui/classIcons';
import { t, classText } from '../ui/i18n';
import { skillRank, MAX_SKILL_RANK, unspentSkillPoints } from '../data/combat';
import { unspentAttributePoints } from '../data/data';
import { isReservedTitle, PHOENIX_ICON, TITLES } from '../data/titles';
import { TARGET_RANGE } from '../ui/targetFrame';
import { $ } from '../ui/dom';
import { setWindow } from '../ui/menus';
import { npcActors } from './cities';
import { settings } from './audio';
import { camera, holder } from './stage';

export function updateHud() {
  renderActionBar();
  renderBuffs(session.state, !vitals.foodRunning);
  const v = vitalsOf(session.state);
  const pct = (a: number, b: number) => `${Math.round((a / b) * 100)}%`;
  const setBar = (id: string, value: number, max: number, text: string) => {
    $(`#${id}-fill`).style.width = pct(value, max);
    $(`#${id}-text`).textContent = text;
    $(`#${id}-fill`).parentElement?.setAttribute('aria-valuenow', String(value));
  };
  $('#hud-class-icon').innerHTML = classIcon(session.state.cls, 'hud');
  $('#hud-name').textContent = session.state.name;
  $('#hud-level').textContent = `${t('Nivel')} ${session.state.level}`;
  setBar('hud-health', v.health, v.maxHealth, `${Math.ceil(v.health)} / ${v.maxHealth}${v.overheal > 0 ? ` (+${Math.ceil(v.overheal)})` : ''}`);
  // La sobrecuración se dibuja tras el final de la vida; si no cabe en la barra, se pega al borde derecho.
  const healthPct = (v.health / v.maxHealth) * 100, overPct = (v.overheal / v.maxHealth) * 100;
  const overEnd = Math.min(100, healthPct + overPct);
  $('#hud-health-over').style.left = `${Math.max(overEnd - overPct, 0)}%`;
  $('#hud-health-over').style.width = `${Math.min(overPct, overEnd)}%`;
  $('.hud-health').classList.toggle('overhealed', v.overheal > 0);
  const lowHealth = v.health > 0 && v.health / v.maxHealth < 0.25;
  $('.hud-health').classList.toggle('low', lowHealth);
  $('#low-health-vignette').classList.toggle('on', lowHealth && play.mode === 'play');
  setBar('hud-resource', v.resource, v.maxResource, `${Math.floor(v.resource)} / ${v.maxResource}`);
  $('#hud-resource').className = `hud-bar hud-resource ${v.resourceKind}`;
  $('#hud-resource').setAttribute('aria-label', t(v.resourceKind === 'mana' ? 'Maná' : 'Estamina'));
  setBar('hud-xp', v.experience, v.experienceNeeded, `${v.experience} / ${v.experienceNeeded} EXP`);
  const hudTips: [string, string][] = [['hud-health', 'Vida'], ['hud-resource', v.resourceKind === 'mana' ? 'Maná' : 'Estamina'], ['hud-xp', 'Experiencia']];
  for (const [id, label] of hudTips) $(`#${id}-fill`).parentElement!.title = `${t(label)}|${$(`#${id}-text`).textContent}`;
  $('#hud-class-icon').title = `${classText(session.state)}|${t('Nivel')} ${session.state.level}`;
  const canImproveSkill = skillRank(session.state) < MAX_SKILL_RANK && unspentSkillPoints(session.state) > 0;
  $('#player-menu-toggle').classList.toggle('has-points', unspentAttributePoints(session.state) > 0 || canImproveSkill);
  document.querySelector('#player-menu-panel [data-window="skills"]')!.classList.toggle('has-points', canImproveSkill);
  document.querySelector<HTMLButtonElement>('[data-window="quests"]')!.hidden = !session.state.welcome && !session.state.fairyDustQuest && !session.state.rpg?.tutorial;
  document.querySelector('#player-menu-panel [data-window="sheet"]')!.classList.toggle('has-points', unspentAttributePoints(session.state) > 0);
  refreshNameplateText();
  if (ui.openWindow === 'quests') setWindow('quests', false);
}
export const nameplate = { el: null as unknown as HTMLElement, shown: false };
export const nameplateAnchor = new THREE.Vector3();
export function refreshNameplateText() {
  $('#nameplate-name').textContent = session.state.name;
  const title = $('#nameplate-title');
  title.replaceChildren();
  if (session.state.title !== 'none') {
    if (isReservedTitle(session.state.title)) title.insertAdjacentHTML('beforeend', PHOENIX_ICON);
    title.append(t(TITLES[session.state.title].label));
  }
  title.classList.toggle('staff-title', session.state.title !== 'none' && isReservedTitle(session.state.title));
  title.hidden = session.state.title === 'none';
}
// Bocadillo de habla sobre tu personaje (solo mensajes públicos del chat); los NPC únicamente mueven la boca.
export const speech = { el: null as HTMLElement | null, until: 0 };
export const speechSeconds = (text: string) => Math.min(8, 2.5 + text.length * 0.06);
export function playerSay(name: string, text: string) {
  const secs = speechSeconds(text);
  play.char.speak(secs);
  if (!speech.el) {
    speech.el = document.createElement('div');
    speech.el.className = 'speech-bubble';
    speech.el.setAttribute('aria-hidden', 'true');
    speech.el.hidden = true;
    speech.el.innerHTML = '<b></b><span></span>';
    document.body.appendChild(speech.el);
  }
  speech.el.querySelector('b')!.textContent = name;
  speech.el.querySelector('span')!.textContent = text;
  speech.until = performance.now() + secs * 1000;
  speech.el.classList.remove('pop');
  void speech.el.offsetWidth;
  speech.el.classList.add('pop');
}
export function npcSay(name: string, text: string) {
  if (name === session.registeredNpcs.gnomi.name) { story.welcomeWorld.speak(speechSeconds(text)); return; }
  const npc = npcActors.find((n) => story.NPCS[n.id]?.name === name);
  npc?.character.speak(speechSeconds(text));
}
// Coloca la placa sobre la cabeza del personaje proyectando su posición en pantalla.
export function updateNameplate() {
  nameplate.el ??= $('#nameplate');
  const visible = play.mode === 'play' && settings.nameplates;
  if (speech.el) {
    const show = play.mode === 'play' && !play.dead && performance.now() < speech.until;
    if (show) {
      camera.updateMatrixWorld();
      nameplateAnchor.set(holder.position.x, holder.position.y + 1.95 + (session.state.height - 0.5) * 0.3, holder.position.z).project(camera);
      const inView = nameplateAnchor.z > -1 && nameplateAnchor.z < 1
        && Math.abs(nameplateAnchor.x) < 1.2 && Math.abs(nameplateAnchor.y) < 1.2;
      if (inView) {
        const x = (nameplateAnchor.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-nameplateAnchor.y * 0.5 + 0.5) * window.innerHeight - (settings.nameplates ? nameplate.el.offsetHeight + 8 : 6);
        speech.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      }
      speech.el.hidden = !inView;
    } else if (!speech.el.hidden) speech.el.hidden = true;
  }
  if (visible) {
    camera.updateMatrixWorld();
    nameplateAnchor.set(holder.position.x, holder.position.y + 1.95 + (session.state.height - 0.5) * 0.3, holder.position.z).project(camera);
    const inView = nameplateAnchor.z > -1 && nameplateAnchor.z < 1
      && Math.abs(nameplateAnchor.x) < 1.2 && Math.abs(nameplateAnchor.y) < 1.2;
    if (inView) {
      const x = (nameplateAnchor.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-nameplateAnchor.y * 0.5 + 0.5) * window.innerHeight;
      nameplate.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
    nameplate.el.hidden = !inView;
  } else if (!nameplate.el.hidden) nameplate.el.hidden = true;
  for (const npc of npcActors) {
    if (npc.id === 'isberto' && !npc.character.root.visible) { npc.plate.hidden = true; continue; }
    const heightScale = (npc.character.opts.scale ?? 1) * (npc.character.opts.proportions?.height ?? 1);
    npc.anchor.set(npc.character.root.position.x, npc.character.root.position.y + 1.95 * heightScale, npc.character.root.position.z).project(camera);
    const inView = visible && npc.character.root.visible && npc.character.root.position.distanceToSquared(holder.position) <= TARGET_RANGE * TARGET_RANGE && npc.anchor.z > -1 && npc.anchor.z < 1
      && Math.abs(npc.anchor.x) < 1.2 && Math.abs(npc.anchor.y) < 1.2;
    if (inView) {
      const x = (npc.anchor.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-npc.anchor.y * 0.5 + 0.5) * window.innerHeight;
      npc.plate.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
    npc.plate.hidden = !inView;
  }
}
