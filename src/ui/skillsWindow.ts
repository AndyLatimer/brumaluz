import { classLabel, type CharData } from '../data/data';
import { COMBAT_KITS, MAX_SKILL_RANK, skillRank, skillRankLevel, unspentSkillPoints, type SkillId } from '../data/combat';
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
  const header = element('header', 'skills-header');
  const emblem = element('div', 'skills-emblem');
  emblem.innerHTML = classIcon(data.cls, 'skillbook');
  const identity = element('div', 'skills-identity');
  identity.append(element('small', 'skills-eyebrow', t('Tu senda de aprendizaje')), element('h3', '', t(classLabel(data))));
  const wallet = element('div', 'skill-points');
  wallet.append(element('strong', '', String(points)), element('span', '', t('Puntos disponibles')));
  header.append(emblem, identity, wallet);
  const progress = element('div', 'skills-progress');
  progress.append(element('span', '', data.level < 50
    ? t('Próximo punto: nivel {n}', { n: Math.floor(data.level / 2) * 2 + 2 }) : t('Nivel máximo')));
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
  catalog.append(catalogHeader, card, element('p', 'skills-catalog-note', t('Las nuevas habilidades que aprendas aparecerán aquí.')));
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
  const improve = element('button', 'skill-upgrade skill-upgrade-inline', '+');
  improve.type = 'button';
  improve.setAttribute('aria-label', t('Mejorar habilidad'));
  improve.title = t('Mejorar habilidad');
  improve.disabled = rank >= MAX_SKILL_RANK || points < 1 || data.level < skillRankLevel(rank + 1);
  const rankMeta = element('div', 'skill-rank-meta');
  rankMeta.append(element('span', 'skill-rank-label', t('Rango {rank} / {max}', { rank, max: MAX_SKILL_RANK })), improve);
  name.append(element('small', 'skills-eyebrow', t('Habilidad activa')), element('h4', '', t(skill.label)),
    rankMeta);
  hero.append(art, name);
  const ranks = element('div', 'skill-rank-track');
  ranks.setAttribute('aria-label', t('Rango {rank} / {max}', { rank, max: MAX_SKILL_RANK }));
  for (let n = 1; n <= MAX_SKILL_RANK; n++) {
    const marker = element('span', n <= rank ? 'learned' : '', String(n));
    marker.title = t('Nivel {n}', { n: skillRankLevel(n) });
    ranks.append(marker);
  }
  const stats = element('dl', 'skill-stats');
  for (const [label, value] of skillStats(data.cls)) stats.append(element('dt', '', label), element('dd', '', value));
  const effect = element('section', 'skill-effect');
  effect.append(element('small', 'skills-eyebrow', t('Efecto actual')), element('p', '', skillEffect(data.cls, rank, data.equipment)));
  const compare = element('section', 'skill-next');
  compare.append(element('h5', '', rank < MAX_SKILL_RANK ? t('Siguiente rango') : t('Maestría alcanzada')));
  if (rank < MAX_SKILL_RANK) {
    compare.append(element('p', 'skill-next-effect', skillEffect(data.cls, rank + 1, data.equipment)),
      element('small', '', `${t('Nivel {n}', { n: skillRankLevel(rank + 1) })} · ${t('1 punto de habilidad')}`));
  } else compare.append(element('p', '', t('Rango máximo alcanzado.')));
  const actions = element('div', 'skill-actions');
  const add = element('button', 'btn ghost', t('Añadir a la barra rápida'));
  add.type = 'button';
  const reason = element('p', 'skill-upgrade-reason', rank >= MAX_SKILL_RANK ? t('Rango máximo alcanzado.')
    : points < 1 ? t('Sube de nivel para ganar puntos de habilidad.') : t('Cada mejora cuesta 1 punto. Los puntos no gastados se conservan.'));
  const status = element('p', 'skill-status');
  status.setAttribute('role', 'status');
  const confirmation = element('section', 'skill-confirmation');
  confirmation.hidden = true;
  confirmation.setAttribute('role', 'group');
  confirmation.setAttribute('aria-label', t('Confirmar mejora'));
  const confirm = element('button', 'btn', t('Confirmar mejora'));
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
      container.querySelector<HTMLElement>('.skill-upgrade:not(:disabled), .skill-actions button')?.focus();
    } else {
      confirm.disabled = false; cancel.disabled = false;
      status.textContent = t('No se ha guardado la mejora. Puedes volver a intentarlo.');
    }
  };
  actions.append(add);
  detail.append(hero, ranks, confirmation, element('p', 'skill-description', t(SKILL_DESCRIPTIONS[data.cls])), effect, stats, compare, actions, reason, status);
  layout.append(catalog, detail);
  root.append(header, progress, layout);
  container.append(root);
}
