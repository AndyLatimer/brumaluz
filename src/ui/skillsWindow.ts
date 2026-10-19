import { CLASSES, type CharData, type ClassId } from '../data/data';
import { COMBAT_KITS } from '../data/combat';
import { classIcon } from './classIcons';
import { t } from './i18n';

export const DRAG_SKILL_TYPE = 'application/x-brumaluz-skill';
export const skillAction = (cls: ClassId) => `skill:${COMBAT_KITS[cls].skill.id}`;

export function skillTooltip(cls: ClassId) {
  const kit = COMBAT_KITS[cls], skill = kit.skill;
  const effect = skill.healing
    ? t('Restaura hasta {n} puntos de vida.', { n: 32 })
    : t(skill.hits === 1 ? 'Un impacto de {damage} de daño.' : '{hits} impactos de {damage} de daño.', { hits: skill.hits, damage: Math.round(kit.damage * skill.power) });
  return `${t(skill.label)}|${effect} ${t('Coste: {cost} · Recarga: {cooldown} s · Alcance: {range}', {
    cost: `${skill.cost} ${t(cls === 'mago' || cls === 'clerigo' ? 'Maná' : 'Estamina')}`,
    cooldown: skill.cooldown, range: skill.healing ? t('Personal') : `${kit.range} m`,
  })}`;
}

export function renderSkills(container: HTMLElement, data: CharData, assign: (id: string) => boolean) {
  container.replaceChildren();
  const root = document.createElement('section');
  root.className = 'skills-book';
  const header = document.createElement('header');
  header.innerHTML = classIcon(data.cls, 'skillbook');
  const title = document.createElement('h3');
  title.textContent = t(CLASSES[data.cls].label);
  const intro = document.createElement('p');
  intro.textContent = t('Tus habilidades conocidas. Arrástralas a la barra rápida para usarlas con 1–0.');
  header.append(title, intro);
  const card = document.createElement('article');
  card.className = 'skill-card';
  card.dataset.skillId = COMBAT_KITS[data.cls].skill.id;
  card.draggable = true;
  card.tabIndex = 0;
  card.title = skillTooltip(data.cls);
  card.addEventListener('dragstart', event => {
    event.dataTransfer?.setData(DRAG_SKILL_TYPE, skillAction(data.cls));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  });
  const icon = document.createElement('div');
  icon.className = 'skill-art';
  icon.innerHTML = classIcon(data.cls, 'skill');
  const name = document.createElement('h4');
  name.textContent = t(COMBAT_KITS[data.cls].skill.label);
  const known = document.createElement('small');
  known.textContent = t('Aprendida · Nivel 1');
  const description = document.createElement('p');
  description.textContent = skillTooltip(data.cls).split('|')[1];
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn ghost';
  button.textContent = t('Añadir a la barra rápida');
  const status = document.createElement('p');
  status.className = 'skill-status';
  status.setAttribute('role', 'status');
  button.onclick = () => {
    status.textContent = t(assign(skillAction(data.cls)) ? 'Habilidad disponible en la barra rápida.' : 'No hay huecos libres. Arrastra la habilidad al hueco que quieras sustituir.');
  };
  card.append(icon, known, name, description, button);
  root.append(header, card, status);
  container.append(root);
}
