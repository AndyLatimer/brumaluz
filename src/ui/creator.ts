// Creador de personajes: tarjetas, colores, selectores y pestañas.
import { type Race, type ClassId, type CharData, sanitize, RACES, CLASSES, HAIR_COLORS, HAIR_NAMES, CLOTH, CLOTH_NAMES, EYE_COLORS, EYE_COLOR_NAMES, MAKEUPS, ACC_COLORS, ACC_COLOR_NAMES, HAIR_ACCS, HAIR_ACC_VALUES, ACCS, randomName, ATTRIBUTE_POINTS_AVAILABLE, ATTRIBUTES, type AttributeId, ATTRIBUTE_BASE_VALUE, ATTRIBUTE_MAX_VALUE, randomChar } from '../data/data';
import { raceIcon } from './raceIcons';
import { classIcon } from './classIcons';
import { session, ui, view, play } from '../game/state';
import { t } from './i18n';
import { FACE_KITS, FACE_LABELS, HAIR_STYLES, BEARDS, EYE_SHAPES, BROWS, NOSES, MOUTHS, DETAILS } from '../character/head';
import { rebuild } from '../game/avatar';
import { $ } from './dom';

export const RACE_ICONS: Record<Race, string> = { humano: raceIcon('humano'), elfo: raceIcon('elfo'), lagto: raceIcon('lagto'), pelso: raceIcon('pelso') };
export const CLASS_ICONS: Record<ClassId, string> = { guerrero: classIcon('guerrero'), mago: classIcon('mago'), picaro: classIcon('picaro'), clerigo: classIcon('clerigo'), explorador: classIcon('explorador') };
export function set<K extends keyof CharData>(key: K, value: CharData[K], hop = false) {
  session.state[key] = value;
  session.state = sanitize(session.state as unknown as Record<string, unknown>);
  rebuild(hop);
  refreshUI();
}
export function cards<T extends string>(el: HTMLElement, items: Record<T, { label: string }>, icons: Record<T, string>, onPick: (k: T) => void) {
  el.innerHTML = '';
  (Object.keys(items) as T[]).forEach((k) => {
    const b = document.createElement('button');
    b.className = 'card';
    b.dataset.k = k;
    b.innerHTML = `<span class="ic">${icons[k]}</span>${t(items[k].label)}`;
    b.onclick = () => onPick(k);
    el.appendChild(b);
  });
}
export function swatches(el: HTMLElement, colors: () => string[], key: 'skin' | 'hairColor' | 'eyeColor' | 'primary' | 'secondary' | 'clothA' | 'clothB' | 'hairAccColor' | 'makeupColor' | 'accColor', names: () => string[]) {
  return () => {
    el.innerHTML = '';
    const ns = names();
    colors().forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'sw' + (session.state[key] === i ? ' active' : '');
      b.style.background = c;
      b.title = t(ns[i] ?? '');
      b.setAttribute('aria-label', t(ns[i] ?? c));
      b.onclick = () => set(key, i);
      el.appendChild(b);
    });
  };
}
export function stepper(key: 'face' | 'trait' | 'hair' | 'beard' | 'eyeShape' | 'brows' | 'nose' | 'mouth' | 'detail' | 'cape' | 'hairAcc' | 'acc' | 'makeup', list: () => string[], values?: number[]) {
  const el = $(`.stepper[data-key="${key}"]`);
  el.innerHTML = `<button aria-label="${t('Anterior')}">‹</button><div class="val"></div><button aria-label="${t('Siguiente')}">›</button>`;
  const [prev, , next] = Array.from(el.children) as HTMLElement[];
  prev.onclick = () => { const l = list(), indices = values ?? l.map((_, i) => i), current = Math.max(0, indices.indexOf(session.state[key])); set(key, indices[(current + l.length - 1) % l.length]); };
  next.onclick = () => { const l = list(), indices = values ?? l.map((_, i) => i), current = Math.max(0, indices.indexOf(session.state[key])); set(key, indices[(current + 1) % l.length]); };
  return () => {
    const l = list();
    if (!l.length) return;
    const indices = values ?? l.map((_, i) => i), current = Math.max(0, indices.indexOf(session.state[key]));
    (el.querySelector('.val') as HTMLElement).innerHTML = `${t(l[current])}<small>${current + 1} / ${l.length}</small>`;
  };
}
export const renders = [
  swatches($('#skin'), () => RACES[session.state.race].skins, 'skin', () => RACES[session.state.race].skinNames),
  swatches($('#hairColor'), () => HAIR_COLORS, 'hairColor', () => HAIR_NAMES),
  swatches($('#primary'), () => CLOTH, 'primary', () => CLOTH_NAMES),
  swatches($('#secondary'), () => CLOTH, 'secondary', () => CLOTH_NAMES),
  swatches($('#eyeColor'), () => EYE_COLORS, 'eyeColor', () => EYE_COLOR_NAMES),
  stepper('face', () => FACE_KITS.map((k) => FACE_LABELS[k])),
  stepper('hair', () => HAIR_STYLES),
  stepper('beard', () => BEARDS),
  stepper('eyeShape', () => EYE_SHAPES),
  stepper('brows', () => BROWS),
  stepper('nose', () => NOSES),
  stepper('mouth', () => MOUTHS),
  stepper('detail', () => DETAILS),
  stepper('trait', () => RACES[session.state.race].traits),
  stepper('makeup', () => MAKEUPS),
  swatches($('#makeupColor'), () => ACC_COLORS, 'makeupColor', () => ACC_COLOR_NAMES),
  stepper('hairAcc', () => HAIR_ACCS, HAIR_ACC_VALUES),
  stepper('acc', () => ACCS),
  swatches($('#clothA'), () => CLOTH, 'clothA', () => CLOTH_NAMES),
  swatches($('#clothB'), () => CLOTH, 'clothB', () => CLOTH_NAMES),
  swatches($('#hairAccColor'), () => ACC_COLORS, 'hairAccColor', () => ACC_COLOR_NAMES),
  swatches($('#accColor'), () => ACC_COLORS, 'accColor', () => ACC_COLOR_NAMES),
];
export const nameInput = $<HTMLInputElement>('#name');
export function refreshUI() {
  document.querySelectorAll<HTMLElement>('#races .card').forEach((c) => c.classList.toggle('active', c.dataset.k === session.state.race));
  document.querySelectorAll<HTMLElement>('#classes .card').forEach((c) => c.classList.toggle('active', c.dataset.k === session.state.cls));
  $('#raceDesc').textContent = t(RACES[session.state.race].desc);
  const stats = $('#raceStats');
  stats.replaceChildren();
  const assigned = Object.values(session.state.attributePoints).reduce((sum, points) => sum + points, 0);
  const remaining = ATTRIBUTE_POINTS_AVAILABLE - assigned;
  $('#attributePointsLeft').textContent = t('Puntos para repartir: {remaining} de {total}', { remaining, total: ATTRIBUTE_POINTS_AVAILABLE });
  (Object.keys(ATTRIBUTES) as AttributeId[]).forEach((key) => {
    const row = document.createElement('div');
    row.className = 'race-stat';
    const label = document.createElement('span');
    label.className = 'race-stat-name';
    label.textContent = t(ATTRIBUTES[key].label);
    const value = document.createElement('strong');
    value.className = 'race-stat-score';
    const racialBonus = RACES[session.state.race].bonuses[key];
    const allocated = session.state.attributePoints[key];
    const bonus = racialBonus + allocated;
    const total = ATTRIBUTE_BASE_VALUE + bonus;
    value.textContent = bonus ? `${ATTRIBUTE_BASE_VALUE} +${bonus} = ${total}` : String(ATTRIBUTE_BASE_VALUE);
    if (bonus) value.classList.add('attribute-bonus');
    value.setAttribute('aria-label', t('Base {base} · bonificación racial +{racial} · puntos asignados +{allocated} · máximo {max}', {
      base: ATTRIBUTE_BASE_VALUE, racial: racialBonus, allocated, max: ATTRIBUTE_MAX_VALUE,
    }));
    const description = document.createElement('span');
    description.className = 'race-stat-description';
    description.textContent = t(ATTRIBUTES[key].desc);
    const controls = document.createElement('span');
    controls.className = 'attribute-controls';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '−';
    remove.disabled = allocated === 0;
    remove.setAttribute('aria-label', t('Quitar un punto de {attribute}', { attribute: t(ATTRIBUTES[key].label) }));
    remove.onclick = () => {
      session.state.attributePoints[key] -= 1;
      refreshUI();
    };
    const add = document.createElement('button');
    add.type = 'button';
    add.textContent = '+';
    add.disabled = remaining === 0 || ATTRIBUTE_BASE_VALUE + bonus >= ATTRIBUTE_MAX_VALUE;
    add.setAttribute('aria-label', t('Añadir un punto a {attribute}', { attribute: t(ATTRIBUTES[key].label) }));
    add.onclick = () => {
      session.state.attributePoints[key] += 1;
      refreshUI();
    };
    controls.append(remove, add);
    row.append(label, value, controls, description);
    stats.appendChild(row);
  });
  $('#classDesc').textContent = t(CLASSES[session.state.cls].desc);
  document.querySelectorAll<HTMLElement>('#sex button').forEach((b) => b.classList.toggle('active', Number(b.dataset.v) === session.state.sex));
  $<HTMLInputElement>('#height').value = String(session.state.height);
  $<HTMLInputElement>('#build').value = String(session.state.build);
  const R = RACES[session.state.race];
  $('#traitBox').hidden = !R.traitLabel;
  $('#noseBox').hidden = session.state.race === 'pelso' || session.state.race === 'lagto';
  $('#makeupColorBox').hidden = ![2, 3, 4].includes(session.state.makeup);
  if (R.traitLabel) $('#traitLabel').textContent = session.state.race === 'lagto' ? t('Cresta del linaje') : t(R.traitLabel);
  $('#hairNote').textContent = '';
  if (document.activeElement !== nameInput) nameInput.value = session.state.name;
  renders.forEach((r) => r());
}
// Pestañas: cambian el encuadre y, en Clase, visten al personaje
export function selectTab(name: string) {
  const wasOutfit = ui.tab === 'clase';
  ui.tab = name;
  const tabButtons = [...document.querySelectorAll<HTMLButtonElement>('#tabs button')];
  const selectedIndex = tabButtons.findIndex((button) => button.dataset.tab === name);
  if (selectedIndex >= 0) $('#panel').style.setProperty('--tab-marker-left', `${(selectedIndex + 0.5) * 100 / tabButtons.length}%`);
  document.querySelectorAll<HTMLElement>('#tabs button').forEach((x) => x.classList.toggle('active', x.dataset.tab === name));
  document.querySelectorAll<HTMLElement>('#pages section').forEach((s) => s.classList.toggle('active', s.dataset.page === name));
  view.focus = name === 'rostro' || name === 'cabello' ? 'face' : 'body';
  view.zoom = 1;
  if (wasOutfit !== (name === 'clase')) rebuild(name === 'clase');
}
/** Controles del creador de personajes. */
export function installCreator() {
  cards($('#races'), RACES, RACE_ICONS, (k) => {
    session.state.race = k;
    set('race', k, true);
  });
  cards($('#classes'), CLASSES, CLASS_ICONS, (k) => {
    const c = CLASSES[k];
    session.state.primary = c.primary;
    session.state.secondary = c.secondary;
    set('cls', k, true);
  });
  document.querySelectorAll<HTMLButtonElement>('#sex button').forEach((b) => {
    b.onclick = () => {
      const sex = Number(b.dataset.v) as 0 | 1;
      // al cambiar de sexo se aplica una personalización de partida acorde (todo se puede cambiar después)
      if (sex !== session.state.sex) {
        if (sex === 1) Object.assign(session.state, { face: 0, hair: 3, beard: 0, eyeShape: 1, brows: 0, makeup: Math.max(session.state.makeup, 1) });
        else Object.assign(session.state, { face: 3, hair: 2, eyeShape: 7, brows: 2, makeup: 0 });
      }
      set('sex', sex, true);
    };
  });
  for (const key of ['height', 'build'] as const) {
    const input = $<HTMLInputElement>('#' + key);
    input.oninput = () => set(key, Number(input.value));
  }
  nameInput.oninput = () => { session.state.name = nameInput.value; };
  $('#dice').onclick = () => { session.state.name = randomName(session.state.race); refreshUI(); };
  document.querySelectorAll<HTMLButtonElement>('#tabs button').forEach((b) => { b.onclick = () => selectTab(b.dataset.tab!); });
  $('#random').onclick = () => {
    session.state = randomChar();
    rebuild(true);
    refreshUI();
  };
  $('#wave').onclick = () => play.char.wave();
}
