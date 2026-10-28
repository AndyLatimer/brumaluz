import { type CharData, defaultChar, CLOTH, ACC_COLORS, ATTRIBUTES } from '../data/data';
import { captureLook, applyLook, varyLook, CreatorHistory, STYLE_PRESETS, COLOR_STORIES, suggestedAttributes } from '../data/creatorStudio';
import { COMBAT_KITS, primaryAttribute, starterEquipment } from '../data/combat';
import { maxHealthOf, maxResourceOf, resourceKindOf } from '../data/stats';
import { ITEMS } from '../data/items';
import { session, view, play } from '../game/state';
import { holder, renderer, layout, creatorStage } from '../game/stage';
import { DETAIL_LAYERS, DETAIL_BASE_LABELS, detailSelection, withDetailLayer } from '../character/head/detailLayers';
import { ACCESSORY_LAYERS, ACCESSORY_BASE_LABELS, accessorySelection, withAccessoryLayer } from '../character/head/accessoryLayers';
import { setCreatorLighting, CREATOR_LIGHTS } from '../world/creatorStage';
import { createCharacterPortrait } from '../character/portrait';
import { t, raceText, classText } from './i18n';
import { $ } from './dom';
import { noteCreatorInteraction, queueCreatorThumbnails, cancelCreatorThumbnails, inCreatorViewport } from './creatorThumbnails';

const history = new CreatorHistory();
const locks = new Set<string>();
let update = () => {};
let coalesceKey = '';
let coalesceAt = 0;
export function resetCreatorStudio() { history.reset(session.state); locks.clear(); coalesceKey = ''; }
export function noteCreatorGesture(key: string) {
  noteCreatorInteraction();
  const now = performance.now(), merge = key === coalesceKey && now - coalesceAt < 700;
  coalesceKey = key; coalesceAt = now;
  return merge;
}
export function recordCreatorChange(merge = false) { history.record(session.state, merge); }
function button(label: string, action: () => void, className = 'studio-button') {
  const b = document.createElement('button'); b.type = 'button'; b.className = className; b.textContent = t(label); b.onclick = action; return b;
}
function details(label: string, parent: HTMLElement) {
  const d = document.createElement('details'); d.className = 'studio-disclosure';
  const s = document.createElement('summary'); s.textContent = t(label); d.append(s); parent.append(d); return d;
}
/** Creator controls share history and appearance layers with the main selectors. */
export function installCreatorStudio(change: (next: CharData) => void) {
  resetCreatorStudio();
  const commit = (next: CharData) => { if (next === session.state) return; noteCreatorInteraction(); coalesceKey = ''; change(next); };
  const layers = document.createElement('div'); layers.className = 'studio-layers'; layers.id = 'creator-detail-layers';
  const layerHeading = document.createElement('h3'); layerHeading.textContent = t('Rasgos por capas');
  const layerNote = document.createElement('p'); layerNote.className = 'studio-note'; layerNote.textContent = t('Combina pecas, cicatrices, marcas, lunar y rubor de forma independiente.');
  layers.append(layerHeading, layerNote);
  const layerControls: { key: typeof DETAIL_LAYERS[number]['key']; value: number; control: HTMLButtonElement }[] = [];
  for (const layer of DETAIL_LAYERS) {
    const row = document.createElement('div'); row.className = 'studio-layer';
    const label = document.createElement('strong'); label.textContent = t(layer.label); row.append(label);
    const options = document.createElement('div'); options.setAttribute('role', 'group'); options.setAttribute('aria-label', t(layer.label));
    for (const value of layer.options) {
      const b = button(DETAIL_BASE_LABELS[value], () => commit({ ...session.state, detail: withDetailLayer(session.state.detail, layer.key, value) }));
      b.dataset.layer = layer.key; b.dataset.value = String(value); options.append(b); layerControls.push({ key: layer.key, value, control: b });
    }
    row.append(options); layers.append(row);
  }
  document.querySelector('.stepper[data-key="detail"]')!.parentElement!.append(layers);
  const accessoryLayers = document.createElement('div'); accessoryLayers.className = 'studio-layers'; accessoryLayers.id = 'creator-accessory-layers';
  const accessoryHeading = document.createElement('h3'); accessoryHeading.textContent = t('Complementos por capas');
  const accessoryNote = document.createElement('p'); accessoryNote.className = 'studio-note'; accessoryNote.textContent = t('Combina gafas, pendientes y un detalle al cuello. El pañuelo oculta la boca y la barba sin borrarlas.');
  accessoryLayers.append(accessoryHeading, accessoryNote);
  const accessoryControls: { key: typeof ACCESSORY_LAYERS[number]['key']; value: number; control: HTMLButtonElement }[] = [];
  for (const layer of ACCESSORY_LAYERS) {
    const row = document.createElement('div'); row.className = 'studio-layer';
    const label = document.createElement('strong'); label.textContent = t(layer.label); row.append(label);
    const options = document.createElement('div'); options.setAttribute('role', 'group'); options.setAttribute('aria-label', t(layer.label));
    for (const value of layer.options) {
      const b = button(ACCESSORY_BASE_LABELS[value], () => commit({ ...session.state, acc: withAccessoryLayer(session.state.acc, layer.key, value) }));
      b.dataset.layer = layer.key; b.dataset.value = String(value); options.append(b); accessoryControls.push({ key: layer.key, value, control: b });
    }
    row.append(options); accessoryLayers.append(row);
  }
  $('[data-page="ropa"]').append(accessoryLayers);
  for (const [tab, links] of Object.entries({
    rostro: [['Piel', '#skin'], ['Mirada', '.stepper[data-key="eyeShape"]'], ['Facciones', '.stepper[data-key="nose"]'], ['Maquillaje', '.stepper[data-key="makeup"]'], ['Capas', '#creator-detail-layers']],
    cabello: [['Peinado', '.stepper[data-key="hair"]'], ['Color', '#hairColor'], ['Adornos', '.stepper[data-key="hairAcc"]']],
    ropa: [['Paletas', '.studio-palettes'], ['Tejidos', '#clothA'], ['Complementos', '.stepper[data-key="acc"]'], ['Capas', '#creator-accessory-layers']],
  })) {
    const nav = document.createElement('nav'); nav.className = 'studio-subnav'; nav.setAttribute('aria-label', t('Apartados de personalización'));
    for (const [label, selector] of links) nav.append(button(label, () => {
      const target = document.querySelector<HTMLElement>(selector);
      if (!target || target.closest('[hidden]')) return;
      const pages = $('#pages');
      pages.scrollTop += target.getBoundingClientRect().top - pages.getBoundingClientRect().top - nav.offsetHeight - 24;
    }));
    $(`[data-page="${tab}"]`).prepend(nav);
  }
  const workshop = details('Inspiración', $('#pages'));
  const intro = document.createElement('p'); intro.className = 'studio-note'; intro.textContent = t('Los estilos cambian rasgos y colores. Conservan tu linaje, cuerpo, nombre, clase y atributos. Los bloqueos protegen tus elecciones.'); workshop.append(intro);
  const presets = document.createElement('div'); presets.className = 'studio-presets'; workshop.append(presets);
  const presetOwner = {};
  const presetCards = STYLE_PRESETS.map(preset => {
    const b = button(preset.label, () => commit(applyLook(session.state, preset.look, locks)), 'studio-preset');
    b.setAttribute('aria-label', t(preset.label));
    b.title = t(preset.desc); presets.append(b); return { preset, button: b, signature: '' };
  });
  const refreshPresets = () => {
    cancelCreatorThumbnails(presetOwner);
    if (!workshop.open || play.mode !== 'create' || document.body.matches('.auth-visible, .characters-visible, .playing')) return;
    const pending = presetCards.map(card => ({ card, data: applyLook(session.state, card.preset.look, locks) }))
      .filter(({ card, data }) => card.signature !== JSON.stringify(captureLook(data)));
    queueCreatorThumbnails(presetOwner, pending.map(({ card, data }) => ({
      visible: () => workshop.open && play.mode === 'create' && !document.body.matches('.auth-visible, .characters-visible, .playing') && inCreatorViewport(card.button),
      render: () => {
        const canvas = createCharacterPortrait(data, renderer, { scale: .5, aspect: 1 });
        canvas.setAttribute('aria-hidden', 'true'); card.button.querySelector('canvas')?.remove(); card.button.prepend(canvas);
        card.signature = JSON.stringify(captureLook(data));
      },
    })));
  };
  let presetScrollTimer = 0;
  $('#pages').addEventListener('scroll', () => {
    if (!workshop.open) return;
    clearTimeout(presetScrollTimer); presetScrollTimer = window.setTimeout(refreshPresets, 80);
  }, { passive: true });
  workshop.addEventListener('toggle', refreshPresets);
  // Locks apply to generators and presets; explicit edits always remain possible.
  const lockedControls: { key: string; control: HTMLButtonElement }[] = [];
  const addLock = (target: HTMLElement, key: string) => {
    const labels: Record<string, string> = { race: 'Linaje', sex: 'Sexo', height: 'Altura', build: 'Complexión', cls: 'Vocación' };
    const label = t(labels[key] ?? target.previousElementSibling?.textContent ?? key);
    const b = button('Fijar', () => { locks.has(key) ? locks.delete(key) : locks.add(key); update(); }, 'studio-lock');
    b.setAttribute('aria-label', `${t('Fijar')} · ${label}`); target.after(b); lockedControls.push({ key, control: b });
  };
  document.querySelectorAll<HTMLElement>('#pages .stepper, #pages .swatches').forEach(target => addLock(target, target.dataset.key ?? target.id));
  for (const key of ['race', 'sex', 'height', 'build', 'cls']) {
    const target = $({ race: '#races', sex: '#sex', height: '#height', build: '#build', cls: '#classes' }[key]!);
    addLock(key === 'height' || key === 'build' ? target.parentElement! : target, key);
  }
  const palette = document.createElement('div'); palette.className = 'studio-palettes';
  const paletteHeading = document.createElement('h3'); paletteHeading.textContent = t('Armonías de color');
  $('[data-page="ropa"] .studio-subnav').after(paletteHeading, palette);
  for (const story of COLOR_STORIES) {
    const b = button(story.label, () => {
      const [a, secondary, accent] = story.colors;
      commit(applyLook(session.state, { clothA: a, clothB: secondary, accColor: accent, hairAccColor: accent }, locks));
    }, 'studio-palette');
    const dots = document.createElement('span'); dots.className = 'studio-palette-colors'; dots.setAttribute('aria-hidden', 'true');
    for (const color of [CLOTH[story.colors[0]], CLOTH[story.colors[1]], ACC_COLORS[story.colors[2]]]) {
      const dot = document.createElement('i'); dot.style.background = color; dots.append(dot);
    }
    b.prepend(dots); palette.append(b);
  }
  const attributes = document.createElement('div'); attributes.className = 'studio-attribute-actions';
  attributes.append(button('Potenciar mi clase', () => commit({ ...session.state, attributePoints: suggestedAttributes(session.state, false) })),
    button('Equilibrar', () => commit({ ...session.state, attributePoints: suggestedAttributes(session.state, true) })),
    button('Repartir de nuevo', () => commit({ ...session.state, attributePoints: defaultChar().attributePoints })));
  $('#attributePointsLeft').after(attributes);
  const kit = document.createElement('div'); kit.id = 'creator-kit'; kit.className = 'studio-kit'; $('#classDesc').after(kit);
  const attributePreview = document.createElement('div'); attributePreview.className = 'studio-kit'; attributePreview.id = 'creator-attribute-preview'; $('#attributePointsLeft').before(attributePreview);
  const summary = document.createElement('div'); summary.className = 'studio-summary'; $('#bottom').prepend(summary);
  const camera = document.createElement('div'); camera.className = 'studio-camera';
  for (const [label, yaw] of [['Frente', 0], ['Perfil', Math.PI / 2], ['Espalda', Math.PI]] as const)
    camera.append(button(label, () => { holder.rotation.y = (play.city?.spawnYaw ?? 0) + yaw; view.spinVel = 0; }));
  camera.append(button('Acercar', () => { view.zoom = Math.max(.6, view.zoom - .15); }), button('Alejar', () => { view.zoom = Math.min(1.4, view.zoom + .15); }));
  const focusPreview = button('Ver rostro', () => { view.focus = view.focus === 'face' ? 'body' : 'face'; view.zoom = 1; update(); });
  focusPreview.id = 'creator-focus-preview'; camera.append(focusPreview);
  $('#tools').append(camera);
  const lighting = document.createElement('div'); lighting.className = 'studio-lighting'; lighting.setAttribute('role', 'group'); lighting.setAttribute('aria-label', t('Iluminación'));
  const lightButtons: HTMLButtonElement[] = [];
  for (const [index, light] of CREATOR_LIGHTS.entries()) {
    const b = button(light.label, () => {
      setCreatorLighting(creatorStage, index);
      lightButtons.forEach((control, i) => control.setAttribute('aria-pressed', String(i === index)));
    });
    b.setAttribute('aria-pressed', String(index === 0)); lighting.append(b); lightButtons.push(b);
  }
  camera.append(lighting);
  const lightLabel = document.createElement('label'); lightLabel.className = 'studio-mobile-light'; lightLabel.textContent = t('Iluminación');
  const lightSelect = document.createElement('select'); lightSelect.id = 'creator-lighting'; lightSelect.setAttribute('aria-label', t('Iluminación'));
  CREATOR_LIGHTS.forEach((light, index) => lightSelect.add(new Option(t(light.label), String(index))));
  lightSelect.onchange = () => lightButtons[Number(lightSelect.value)].click();
  lightButtons.forEach((b, index) => b.addEventListener('click', () => { lightSelect.value = String(index); }));
  lightLabel.append(lightSelect); $('#pages').append(lightLabel);
  const expandPreview = button('Vista amplia', () => {
    document.body.classList.toggle('creator-preview-expanded');
    expandPreview.textContent = t(document.body.classList.contains('creator-preview-expanded') ? 'Seguir editando' : 'Vista amplia');
    expandPreview.setAttribute('aria-pressed', String(document.body.classList.contains('creator-preview-expanded')));
    layout();
  }, 'studio-button studio-preview-toggle');
  expandPreview.setAttribute('aria-pressed', 'false'); $('#tools').append(expandPreview);
  $('#random').onclick = () => commit(varyLook(session.state, 'all', locks));
  document.addEventListener('keydown', e => {
    if (play.mode !== 'create' || document.body.matches('.auth-visible, .characters-visible') || !(e.ctrlKey || e.metaKey)
      || (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]'))) return;
    if (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y') {
      e.preventDefault(); commit(history.move(session.state, e.shiftKey || e.key.toLowerCase() === 'y' ? 1 : -1));
    }
  });
  document.addEventListener('brumaluz-language-change', () => update());
  update = () => {
    focusPreview.textContent = t(view.focus === 'face' ? 'Ver cuerpo' : 'Ver rostro');
    expandPreview.textContent = t(document.body.classList.contains('creator-preview-expanded') ? 'Seguir editando' : 'Vista amplia');
    expandPreview.setAttribute('aria-pressed', String(document.body.classList.contains('creator-preview-expanded')));
    const selectedLayers = detailSelection(session.state.detail);
    for (const { key, value, control } of layerControls) control.setAttribute('aria-pressed', String(selectedLayers[key] === value));
    const selectedAccessories = accessorySelection(session.state.acc);
    for (const { key, value, control } of accessoryControls) control.setAttribute('aria-pressed', String(selectedAccessories[key] === value));
    for (const { key, control } of lockedControls) { control.setAttribute('aria-pressed', String(locks.has(key))); control.textContent = t(locks.has(key) ? 'Fijado' : 'Fijar'); }
    summary.textContent = `${raceText(session.state)} · ${classText(session.state)} · ${t('Nivel {level}', { level: 1 })}`;
    const data = { ...session.state, equipment: starterEquipment(session.state.cls) }, skill = COMBAT_KITS[data.cls].skill;
    kit.replaceChildren();
    const title = document.createElement('strong'); title.textContent = t('Tu equipo inicial'); kit.append(title);
    const gear = document.createElement('p'); gear.textContent = [COMBAT_KITS[data.cls].weapon, COMBAT_KITS[data.cls].offhand].filter(Boolean).map(id => t(ITEMS[id!]?.label ?? id!)).join(' · '); kit.append(gear);
    const skillText = document.createElement('p'); skillText.textContent = `${t(skill.label)} · ${skill.cost} ${t(resourceKindOf(data.cls) === 'mana' ? 'Maná' : 'Estamina')} · ${skill.cooldown} s`; kit.append(skillText);
    const stats = document.createElement('div'); stats.className = 'studio-vitals';
    const resource = resourceKindOf(data.cls) === 'mana' ? 'Maná' : 'Estamina';
    for (const [label, value] of [['Vida', maxHealthOf(data)], [resource, maxResourceOf(data)], ['Atributo principal', t(ATTRIBUTES[primaryAttribute(data.cls)].label)]]) {
      const cell = document.createElement('span'), n = document.createElement('strong'); cell.textContent = t(String(label)); n.textContent = String(value); cell.append(n); stats.append(cell);
    }
    kit.append(stats);
    attributePreview.replaceChildren(stats.cloneNode(true));
    for (const key of ['height', 'build'] as const) {
      const input = $<HTMLInputElement>('#' + key); let output = input.parentElement!.querySelector('output');
      if (!output) { output = document.createElement('output'); output.setAttribute('for', key); input.after(output); }
      output.textContent = `${Math.round(session.state[key] * 100)} %`;
    }
    refreshPresets();
  };
  return update;
}
