import { classLabel, type CharData } from '../data/data';
import { COMBAT_KITS, MAX_SKILL_RANK, skillPower, skillRank, skillRankLevel, unspentSkillPoints, type SkillId } from '../data/combat';
import { experienceToNextLevel } from '../data/stats';
import { classIcon } from './classIcons';
import { skillIcon } from './skillIcons';
import { setSkillTooltip, skillEffect, skillStats, SKILL_DESCRIPTIONS } from './skillTooltip';
import { t } from './i18n';

export const DRAG_SKILL_TYPE = 'application/x-brumaluz-skill';
export const skillAction = (cls: CharData['cls']) => `skill:${COMBAT_KITS[cls].skill.id}`;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function renderSkills(
  container: HTMLElement, data: CharData, assign: (id: string) => boolean,
  upgrade: (id: SkillId, rank: number) => Promise<boolean>,
) {
  container.replaceChildren();
  const skill = COMBAT_KITS[data.cls].skill, rank = skillRank(data), points = unspentSkillPoints(data);
  const root = element('section', 'skills-book');
  const canImprove = rank < MAX_SKILL_RANK && points > 0 && data.level >= skillRankLevel(rank + 1);
  root.classList.toggle('has-upgrade', canImprove);
  const header = element('header', 'skills-header');
  const emblem = element('div', 'skills-emblem');
  emblem.innerHTML = classIcon(data.cls, 'skillbook');
  const identity = element('div', 'skills-identity');
  identity.append(element('small', 'skills-eyebrow', t('Tu senda de aprendizaje')), element('h3', '', t(classLabel(data))));
  const wallet = element('div', 'skill-points');
  wallet.append(element('strong', '', String(points)), element('span', '', t(points === 1 ? 'Punto disponible' : 'Puntos disponibles')));
  header.append(emblem, identity, wallet);
  const progress = element('div', 'skills-progress');
  progress.append(element('span', '', data.level < 50
    ? t('Próximo punto: nivel {n}', { n: data.level + 1 }) : t('Nivel máximo')));
  progress.append(element('small', '', t('1 punto por nivel desde el nivel 2')));
  if (data.level < 50) {
    const needed = experienceToNextLevel(data.level), xp = Math.max(0, Math.min(data.experience, needed));
    const meter = element('progress', 'skills-xp');
    meter.max = needed; meter.value = xp;
    meter.setAttribute('aria-label', t('Experiencia para el próximo punto'));
    progress.append(meter, element('span', 'skills-xp-label', t('{xp} / {needed} XP', { xp, needed })));
  }
  const layout = element('div', 'skills-layout');
  const catalog = element('nav', 'skills-catalog');
  catalog.setAttribute('aria-label', t('Habilidades aprendidas'));
  const catalogHeader = element('div', 'skills-catalog-heading');
  catalogHeader.append(element('h4', '', t('Habilidades aprendidas')), element('span', '', '1'));
  const card = element('button', 'skill-card');
  card.type = 'button'; card.draggable = true;
  card.setAttribute('aria-current', 'true');
  setSkillTooltip(card, data.cls, rank, data.equipment);
  const icon = element('div', 'skill-art');
  icon.innerHTML = skillIcon(skill.id);
  const cardText = element('div', 'skill-card-text');
  cardText.append(element('small', '', t('Habilidad activa')), element('h4', '', t(skill.label)),
    element('p', '', t('Rango {rank} / {max}', { rank, max: MAX_SKILL_RANK })));
  card.append(icon, cardText);
  const drag = (event: DragEvent) => {
    event.dataTransfer?.setData(DRAG_SKILL_TYPE, skillAction(data.cls));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  };
  card.addEventListener('dragstart', drag);
  catalog.append(header, progress, catalogHeader, card, element('p', 'skills-catalog-note', t('Arrastra a la barra rápida · Usa con 1–0')));
  const detail = element('article', 'skill-detail');
  detail.id = 'skill-detail';
  card.setAttribute('aria-controls', detail.id);
  card.onclick = () => detail.focus({ preventScroll: true });
  detail.tabIndex = -1;
  const hero = element('header', 'skill-detail-header');
  const art = element('div', 'skill-hero-art');
  art.innerHTML = skillIcon(skill.id);
  art.draggable = true; art.tabIndex = 0; setSkillTooltip(art, data.cls, rank, data.equipment);
  art.addEventListener('dragstart', drag);
  const name = element('div', '');
  const improve = element('button', 'btn skill-upgrade', t('Mejorar habilidad'));
  improve.type = 'button';
  improve.setAttribute('aria-label', t('Mejorar habilidad'));
  improve.title = t('Mejorar habilidad');
  improve.disabled = !canImprove;
  const rankMeta = element('div', 'skill-rank-meta');
  rankMeta.append(element('span', 'skill-rank-label', t('Rango {rank} / {max}', { rank, max: MAX_SKILL_RANK })),
    element('span', 'skill-availability', rank === MAX_SKILL_RANK ? t('Maestría alcanzada') : canImprove ? t('Mejora disponible') : t('Habilidad aprendida')));
  name.append(element('small', 'skills-eyebrow', t('Habilidad activa')), element('h4', '', t(skill.label)),
    rankMeta);
  hero.append(art, name);
  const ranks = element('div', 'skill-rank-track');
  ranks.setAttribute('aria-label', t('Rango {rank} / {max}', { rank, max: MAX_SKILL_RANK }));
  for (let n = 1; n <= MAX_SKILL_RANK; n++) {
    const marker = element('span', n <= rank ? 'learned' : n === rank + 1 ? 'next' : '', String(n));
    marker.title = t('Nivel {n}', { n: skillRankLevel(n) });
    if (n === rank) marker.setAttribute('aria-current', 'step');
    ranks.append(marker);
  }
  const stats = element('dl', 'skill-stats');
  for (const [label, value] of skillStats(data.cls)) stats.append(element('dt', '', label), element('dd', '', value));
  const properties = element('details', 'skill-properties');
  properties.append(element('summary', '', t('Coste, alcance y recarga')), stats);
  const effect = element('section', 'skill-effect');
  effect.append(element('small', 'skills-eyebrow', t('Efecto actual')), element('p', '', skillEffect(data.cls, rank, data.equipment)));
  const compare = element('section', 'skill-next');
  compare.append(element('h5', '', rank < MAX_SKILL_RANK ? t('Siguiente rango') : t('Maestría alcanzada')));
  if (rank < MAX_SKILL_RANK) {
    const current = skillPower(data.cls, rank, data.equipment, data) * skill.hits;
    const next = skillPower(data.cls, rank + 1, data.equipment, data) * skill.hits;
    const format = (value: number) => String(Math.round(value * 10) / 10);
    const comparison = element('div', 'skill-comparison');
    const before = element('div', 'skill-comparison-current');
    before.append(element('small', '', t('Efecto actual')), element('strong', '', format(current)));
    const arrow = element('span', 'skill-comparison-arrow', '→');
    arrow.setAttribute('aria-hidden', 'true');
    const after = element('div', 'skill-comparison-next');
    after.append(element('small', '', t('Rango {rank}', { rank: rank + 1 })), element('strong', '', format(next)));
    const gain = element('span', 'skill-gain', current > 0
      ? t('+{n} %', { n: Math.round((next / current - 1) * 100) }) : `+${format(next - current)}`);
    comparison.append(before, arrow, after, gain);
    compare.append(element('p', 'skill-comparison-label', t(skill.healing ? 'Curación total' : 'Daño total')), comparison,
      element('p', 'skill-next-effect', skillEffect(data.cls, rank + 1, data.equipment)),
      element('small', 'skill-requirements', `${t('Nivel {n}', { n: skillRankLevel(rank + 1) })} · ${t('1 punto de habilidad')}`));
  } else compare.append(element('p', '', t('Rango máximo alcanzado.')));
  const actions = element('div', 'skill-actions');
  const add = element('button', 'btn ghost', t('Añadir a la barra rápida'));
  add.type = 'button';
  add.onclick = () => {
    status.textContent = assign(skillAction(data.cls)) ? t('Habilidad disponible en la barra rápida.') : t('No hay huecos libres en la barra rápida.');
  };
  const reason = element('p', 'skill-upgrade-reason', rank >= MAX_SKILL_RANK ? t('Los puntos que ganes se conservan para futuras habilidades.')
    : !canImprove ? t('Próxima mejora al nivel {n}.', { n: skillRankLevel(rank + 1) }) : t('Cada mejora cuesta 1 punto. Los puntos no gastados se conservan.'));
  const status = element('p', 'skill-status');
  status.setAttribute('role', 'status');
  const confirmation = element('section', 'skill-confirmation');
  confirmation.hidden = true;
  confirmation.setAttribute('role', 'group');
  confirmation.setAttribute('aria-label', t('Confirmar mejora'));
  const confirm = element('button', 'btn gold', t('Confirmar mejora'));
  confirm.type = 'button';
  const cancel = element('button', 'btn ghost', t('Cancelar'));
  cancel.type = 'button';
  confirmation.append(element('p', '', t('Gastarás 1 punto para alcanzar el rango {rank}. Esta mejora es permanente.', { rank: rank + 1 })), confirm, cancel);
  improve.onclick = () => { confirmation.hidden = false; improve.hidden = true; confirm.focus(); };
  cancel.onclick = () => { confirmation.hidden = true; improve.hidden = false; improve.focus(); };
  confirm.onclick = async () => {
    confirm.disabled = true; cancel.disabled = true;
    status.textContent = t('Guardando mejora…');
    const success = await upgrade(skill.id, rank);
    if (!root.isConnected) return;
    if (success) {
      renderSkills(container, data, assign, upgrade);
      container.querySelector('.skill-detail')?.classList.add('skill-just-upgraded');
      const receipt = container.querySelector<HTMLElement>('.skill-status');
      if (receipt) receipt.textContent = t('¡Mejora aprendida! Rango {rank}.', { rank: skillRank(data) });
      container.querySelector<HTMLElement>('.skill-actions button:not(:disabled)')?.focus();
    } else {
      confirm.disabled = false; cancel.disabled = false;
      status.textContent = t('No se ha guardado la mejora. Puedes volver a intentarlo.');
    }
  };
  actions.append(improve, add);
  detail.append(hero, ranks, element('p', 'skill-description', t(SKILL_DESCRIPTIONS[data.cls])), effect, compare, actions, confirmation, reason, status, properties);
  layout.append(catalog, detail);
  root.append(layout);
  container.append(root);
}
