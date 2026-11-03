// Creador de personajes: tarjetas, colores, selectores y pestañas.
import { type Race, type ClassId, type CharData, sanitize, RACES, CLASSES, HAIR_COLORS, HAIR_NAMES, CLOTH, CLOTH_NAMES, EYE_COLORS, EYE_COLOR_NAMES, MAKEUPS, ACC_COLORS, ACC_COLOR_NAMES, HAIR_ACCS, HAIR_ACC_VALUES, ACCS, randomName, ATTRIBUTE_POINTS_AVAILABLE, ATTRIBUTES, type AttributeId, ATTRIBUTE_BASE_VALUE, ATTRIBUTE_MAX_VALUE, randomChar } from '../data/data';
import { raceIcon } from './raceIcons';
import { classIcon } from './classIcons';
import { session, ui, view, play } from '../game/state';
import { t } from './i18n';
import { FACE_KITS, FACE_LABELS, HAIR_STYLES, BEARDS, EYE_SHAPES, BROWS, NOSES, MOUTHS } from '../character/head';
import { rebuild } from '../game/avatar';
import { $ } from './dom';
import { installCreatorStudio, recordCreatorChange, noteCreatorGesture } from './creatorStudio';
import { layout } from '../game/stage';
import { DETAIL_BASE_LABELS } from '../character/head/detailLayers';
import { ACCESSORY_BASE_LABELS } from '../character/head/accessoryLayers';
import { closeCreatorSelect, styleCreatorSelect } from './creatorSelect';

let refreshStudio = () => {};
const tabScroll = new Map<string, number>();
export function resetCreatorNavigation() {
  tabScroll.clear();
  document.querySelectorAll<HTMLDetailsElement>('#pages .studio-disclosure, #creator-inspiration').forEach(detail => { detail.open = false; });
  $('#pages').scrollTop = 0;
  document.dispatchEvent(new Event('brumaluz-creator-reset'));
}

export const RACE_ICONS: Record<Race, string> = { humano: raceIcon('humano'), elfo: raceIcon('elfo'), lagto: raceIcon('lagto'), pelso: raceIcon('pelso') };
export const CLASS_ICONS: Record<ClassId, string> = { guerrero: classIcon('guerrero'), mago: classIcon('mago'), picaro: classIcon('picaro'), clerigo: classIcon('clerigo'), explorador: classIcon('explorador') };
export function set<K extends keyof CharData>(key: K, value: CharData[K], hop = false) {
  session.state[key] = value;
  session.state = sanitize(session.state as unknown as Record<string, unknown>);
  if (key === 'walkStyle') { play.creatorWalkPreview = true; view.focus = 'body'; view.zoom = 1; }
  const continuous = noteCreatorGesture(String(key));
  recordCreatorChange((key === 'height' || key === 'build') && continuous);
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
  let signature = '';
  const caption = document.createElement('span'); caption.className = 'studio-color-name'; el.after(caption);
  return () => {
    const ns = names();
    const next = JSON.stringify([colors(), ns.map(n => t(n))]);
    caption.textContent = t(ns[session.state[key]] ?? '');
    if (signature === next) {
      el.querySelectorAll('button').forEach((b, i) => { b.classList.toggle('active', session.state[key] === i); b.setAttribute('aria-pressed', String(session.state[key] === i)); });
      return;
    }
    signature = next; el.innerHTML = '';
    colors().forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'sw' + (session.state[key] === i ? ' active' : '');
      b.style.background = c;
      b.title = t(ns[i] ?? '');
      b.setAttribute('aria-label', t(ns[i] ?? c));
      b.setAttribute('aria-pressed', String(session.state[key] === i));
      b.onclick = () => set(key, i);
      el.appendChild(b);
    });
  };
}
export function stepper(key: 'face' | 'trait' | 'hair' | 'beard' | 'eyeShape' | 'brows' | 'nose' | 'mouth' | 'detail' | 'cape' | 'hairAcc' | 'acc' | 'makeup' | 'walkStyle', list: () => string[], values?: number[]) {
  const el = $(`.stepper[data-key="${key}"]`);
  el.innerHTML = `<button type="button" class="stepper-arrow" aria-label="${t('Anterior')}">‹</button><div class="val"><select></select></div><button type="button" class="stepper-arrow" aria-label="${t('Siguiente')}">›</button>`;
  const select = el.querySelector('select')!;
  const refreshSelect = styleCreatorSelect(select);
  select.onchange = () => set(key, Number(select.value));
  const arrows = el.querySelectorAll<HTMLButtonElement>('.stepper-arrow');
  const move = (direction: number) => {
    closeCreatorSelect();
    const labels = list(), indices = values ?? labels.map((_, i) => i);
    if (!indices.length) return;
    const current = indices.indexOf(session.state[key]);
    set(key, indices[current < 0 ? (direction > 0 ? 0 : indices.length - 1) : (current + direction + indices.length) % indices.length]);
  };
  arrows[0].onclick = () => move(-1); arrows[1].onclick = () => move(1);
  return () => {
    const labels = list().map(label => t(label));
    if (!labels.length) return;
    const indices = values ?? labels.map((_, i) => i);
    const custom = (key === 'detail' || key === 'acc') && !indices.includes(session.state[key]);
    if (custom) labels.push(t('Combinación personal'));
    const optionValues = custom ? [...indices, session.state[key]] : indices;
    if (select.options.length !== labels.length || labels.some((label, i) => select.options[i].text !== label || select.options[i].value !== String(optionValues[i])))
      select.replaceChildren(...labels.map((label, i) => new Option(label, String(optionValues[i]))));
    select.value = String(session.state[key]);
    const label = t(el.previousElementSibling?.textContent ?? 'Elegir opción');
    select.setAttribute('aria-label', label);
    arrows[0].setAttribute('aria-label', `${label} · ${t('Anterior')}`);
    arrows[1].setAttribute('aria-label', `${label} · ${t('Siguiente')}`);
    refreshSelect();
  };
}
export const renders = [
  stepper('walkStyle', () => ['Andar A', 'Andar B', 'Andar C']),
  swatches($('#skin'), () => RACES[session.state.race].skins, 'skin', () => RACES[session.state.race].skinNames),
  swatches($('#hairColor'), () => HAIR_COLORS, 'hairColor', () => HAIR_NAMES),
  swatches($('#eyeColor'), () => EYE_COLORS, 'eyeColor', () => EYE_COLOR_NAMES),
  stepper('face', () => FACE_KITS.map((k) => FACE_LABELS[k])),
  stepper('hair', () => HAIR_STYLES),
  stepper('beard', () => BEARDS),
  stepper('eyeShape', () => EYE_SHAPES),
  stepper('brows', () => BROWS),
  stepper('nose', () => NOSES),
  stepper('mouth', () => MOUTHS),
  // The concise catalogue preserves the original recipes; free layering has its own controls.
  stepper('detail', () => DETAIL_BASE_LABELS),
  stepper('trait', () => RACES[session.state.race].traits),
  stepper('makeup', () => MAKEUPS),
  swatches($('#makeupColor'), () => ACC_COLORS, 'makeupColor', () => ACC_COLOR_NAMES),
  stepper('hairAcc', () => HAIR_ACCS, HAIR_ACC_VALUES),
  stepper('acc', () => ACCESSORY_BASE_LABELS),
  swatches($('#clothA'), () => CLOTH, 'clothA', () => CLOTH_NAMES),
  swatches($('#clothB'), () => CLOTH, 'clothB', () => CLOTH_NAMES),
  swatches($('#hairAccColor'), () => ACC_COLORS, 'hairAccColor', () => ACC_COLOR_NAMES),
  swatches($('#accColor'), () => ACC_COLORS, 'accColor', () => ACC_COLOR_NAMES),
];
export const nameInput = $<HTMLInputElement>('#name');
export function refreshUI() {
  $('#creator-walk-preview').textContent = t(play.creatorWalkPreview ? 'Detener vista previa' : 'Ver andando');
  $('#creator-walk-preview').setAttribute('aria-pressed', String(play.creatorWalkPreview));
  const focusedAttribute = document.activeElement instanceof HTMLButtonElement && document.activeElement.closest('#raceStats')
    ? document.activeElement.getAttribute('aria-label') : null;
  recordCreatorChange();
  document.querySelectorAll<HTMLElement>('#races .card, #classes .card').forEach(c => {
    const selected = c.dataset.k === session.state.race || c.dataset.k === session.state.cls;
    c.classList.toggle('active', selected); c.setAttribute('aria-pressed', String(selected));
  });
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
      noteCreatorGesture('attribute');
      session.state.attributePoints[key] -= 1;
      refreshUI();
    };
    const add = document.createElement('button');
    add.type = 'button';
    add.textContent = '+';
    add.disabled = remaining === 0 || ATTRIBUTE_BASE_VALUE + bonus >= ATTRIBUTE_MAX_VALUE;
    add.setAttribute('aria-label', t('Añadir un punto a {attribute}', { attribute: t(ATTRIBUTES[key].label) }));
    add.onclick = () => {
      noteCreatorGesture('attribute');
      session.state.attributePoints[key] += 1;
      refreshUI();
    };
    controls.append(remove, add);
    row.append(label, value, controls, description);
    stats.appendChild(row);
  });
  $('#classDesc').textContent = t(CLASSES[session.state.cls].desc);
  document.querySelectorAll<HTMLElement>('#sex button').forEach((b) => { const selected = Number(b.dataset.v) === session.state.sex; b.classList.toggle('active', selected); b.setAttribute('aria-pressed', String(selected)); });
  $<HTMLInputElement>('#height').value = String(session.state.height);
  $<HTMLInputElement>('#build').value = String(session.state.build);
  const R = RACES[session.state.race];
  $('#traitBox').hidden = !R.traitLabel;
  $('#noseBox').hidden = session.state.race === 'pelso' || session.state.race === 'lagto';
  $('#makeupColorBox').hidden = ![2, 3, 4, 7, 8, 9].includes(session.state.makeup);
  if (R.traitLabel) $('#traitLabel').textContent = session.state.race === 'lagto' ? t('Cresta del linaje') : t(R.traitLabel);
  $('#hairNote').textContent = t('Los adornos siguen el peinado. El casco oculta el pelo al equiparlo.');
  if (document.activeElement !== nameInput) nameInput.value = session.state.name;
  renders.forEach((r) => r());
  refreshStudio();
  if (focusedAttribute) Array.from(stats.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === focusedAttribute)?.focus({ preventScroll: true });
}
// Pestañas: cambian el encuadre y, en Clase, visten al personaje
export function selectTab(name: string) {
  closeCreatorSelect();
  if (!['raza', 'rostro', 'cabello', 'ropa', 'clase'].includes(name)) return;
  const pages = $('#pages');
  tabScroll.set(ui.tab, pages.scrollTop);
  if (document.body.classList.contains('creator-preview-expanded')) { document.body.classList.remove('creator-preview-expanded'); layout(); refreshStudio(); }
  const wasOutfit = ui.tab === 'clase';
  ui.tab = name;
  if (name !== 'raza') play.creatorWalkPreview = false;
  $('#creator-walk-preview').textContent = t(play.creatorWalkPreview ? 'Detener vista previa' : 'Ver andando');
  $('#creator-walk-preview').setAttribute('aria-pressed', String(play.creatorWalkPreview));
  const tabButtons = [...document.querySelectorAll<HTMLButtonElement>('#tabs button')];
  const selectedIndex = tabButtons.findIndex((button) => button.dataset.tab === name);
  if (selectedIndex >= 0) $('#panel').style.setProperty('--tab-marker-left', `${(selectedIndex + 0.5) * 100 / tabButtons.length}%`);
  document.querySelectorAll<HTMLElement>('#tabs button').forEach((x) => x.classList.toggle('active', x.dataset.tab === name));
  document.querySelectorAll<HTMLButtonElement>('#tabs button').forEach(x => { const selected = x.dataset.tab === name; x.setAttribute('aria-selected', String(selected)); x.tabIndex = selected ? 0 : -1; });
  document.querySelectorAll<HTMLElement>('#pages section').forEach((s) => s.classList.toggle('active', s.dataset.page === name));
  pages.scrollTop = tabScroll.get(name) ?? 0;
  view.focus = name === 'rostro' || name === 'cabello' ? 'face' : 'body';
  view.zoom = 1;
  if (wasOutfit !== (name === 'clase')) rebuild(name === 'clase');
  refreshStudio();
  document.dispatchEvent(new Event('brumaluz-creator-tab'));
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
      set('sex', sex, true);
    };
  });
  for (const key of ['height', 'build'] as const) {
    const input = $<HTMLInputElement>('#' + key);
    input.oninput = () => set(key, Number(input.value));
  }
  nameInput.oninput = () => { session.state.name = nameInput.value; recordCreatorChange(noteCreatorGesture('name')); refreshStudio(); };
  $('#dice').onclick = () => { noteCreatorGesture('dice'); session.state.name = randomName(session.state.race); refreshUI(); };
  document.querySelectorAll<HTMLButtonElement>('#tabs button').forEach((b) => { b.onclick = () => selectTab(b.dataset.tab!); });
  $('#wave').onclick = () => play.char.wave();
  $('#creator-walk-preview').onclick = () => {
    play.creatorWalkPreview = !play.creatorWalkPreview;
    if (play.creatorWalkPreview) { view.focus = 'body'; view.zoom = 1; }
    refreshUI();
  };
  refreshStudio = installCreatorStudio(next => { session.state = sanitize(next as unknown as Record<string, unknown>); rebuild(); refreshUI(); });
  const tabs = [...document.querySelectorAll<HTMLButtonElement>('#tabs button')];
  $('#tabs').setAttribute('role', 'tablist'); $('#tabs').setAttribute('aria-label', t('Creación de personaje'));
  tabs.forEach((b, i) => {
    b.setAttribute('role', 'tab'); b.id = `creator-tab-${b.dataset.tab}`;
    const page = $<HTMLElement>(`#pages section[data-page="${b.dataset.tab}"]`);
    page.id = `creator-page-${b.dataset.tab}`; page.setAttribute('role', 'tabpanel'); page.setAttribute('aria-labelledby', b.id); b.setAttribute('aria-controls', page.id);
    b.onkeydown = e => {
      const next = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i + tabs.length - 1) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
      if (next < 0) return; e.preventDefault(); tabs[next].focus(); selectTab(tabs[next].dataset.tab!);
    };
  });
  selectTab(ui.tab);
}
