import { COMBAT_KITS, MAX_SKILL_RANK, skillPower, skillRankLevel } from '../data/combat';
import { type ClassId } from '../data/data';
import { skillIcon } from './skillIcons';
import { t } from './i18n';
import type { Equipment } from '../data/inventory';

const equipmentContexts = new WeakMap<HTMLElement, Equipment>();
export const skillTooltipEquipment = (target: HTMLElement) => equipmentContexts.get(target);

export function skillEffect(cls: ClassId, rank: number, equipment?: Equipment) {
  const skill = COMBAT_KITS[cls].skill, power = skillPower(cls, rank, equipment);
  return skill.healing ? t('Restaura hasta {n} puntos de vida.', { n: power })
    : t(skill.hits === 1 ? 'Un impacto de {damage} de daño.' : '{hits} impactos de {damage} de daño.', { hits: skill.hits, damage: power });
}

export const SKILL_DESCRIPTIONS: Record<ClassId, string> = {
  guerrero: 'Concentras tu fuerza en un golpe certero contra un enemigo cercano.',
  mago: 'Canalizas energía arcana y la liberas en una descarga a distancia.',
  picaro: 'Encadenas dos cortes rápidos sobre el mismo enemigo.',
  clerigo: 'Reúnes una luz reparadora para recuperar tu propia vida, sin sobrecuración.',
  explorador: 'Apuntas con cuidado y lanzas un disparo certero a larga distancia.',
};

export function setSkillTooltip(target: HTMLElement, cls: ClassId, rank: number, equipment?: Equipment) {
  if (equipment) equipmentContexts.set(target, equipment); else equipmentContexts.delete(target);
  target.dataset.skillId = COMBAT_KITS[cls].skill.id;
  target.dataset.skillClass = cls;
  target.dataset.skillRank = String(rank);
  target.setAttribute('aria-label', t(COMBAT_KITS[cls].skill.label));
}

export function skillStats(cls: ClassId) {
  const kit = COMBAT_KITS[cls], skill = kit.skill;
  return [
    [t('Coste'), `${skill.cost} ${t(cls === 'mago' || cls === 'clerigo' ? 'Maná' : 'Estamina')}`],
    [t('Recarga'), `${skill.cooldown} s`],
    [t('Alcance'), skill.healing ? t('Personal') : `${kit.range} m`],
    [t('Objetivo'), t(skill.healing ? 'Tú' : 'Un enemigo')],
  ];
}

export function renderSkillTooltip(container: HTMLElement, cls: ClassId, rank: number, equipment?: Equipment) {
  const skill = COMBAT_KITS[cls].skill;
  const header = document.createElement('div');
  header.className = 'item-tip-header';
  const icon = document.createElement('div');
  icon.className = 'item-tip-icon skill-tip-icon';
  icon.innerHTML = skillIcon(skill.id);
  const identity = document.createElement('div');
  const category = document.createElement('span');
  category.className = 'item-tip-category';
  category.textContent = t('Habilidad activa');
  const name = document.createElement('strong');
  name.className = 'item-tip-name';
  name.textContent = t(skill.label);
  identity.append(category, name);
  header.append(icon, identity);
  const rankLabel = document.createElement('p');
  rankLabel.className = 'skill-tip-rank';
  rankLabel.textContent = t('Rango {rank} / {max}', { rank, max: MAX_SKILL_RANK });
  const stats = document.createElement('dl');
  stats.className = 'item-tip-stats';
  for (const [label, value] of skillStats(cls)) {
    const dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = label; dd.textContent = value; stats.append(dt, dd);
  }
  const effect = document.createElement('section');
  effect.className = 'item-tip-effects';
  effect.textContent = skillEffect(cls, rank, equipment);
  const description = document.createElement('p');
  description.className = 'item-tip-description';
  description.textContent = t(SKILL_DESCRIPTIONS[cls]);
  const footer = document.createElement('p');
  footer.className = 'item-tip-footer';
  footer.textContent = rank < MAX_SKILL_RANK
    ? `${t('Siguiente rango')} · ${t('Nivel {n}', { n: skillRankLevel(rank + 1) })} · ${t('1 punto de habilidad')}. ${skillEffect(cls, rank + 1, equipment)}`
    : t('Rango máximo alcanzado.');
  const hint = document.createElement('small');
  hint.textContent = t('Arrastra a la barra rápida · Usa con 1–0');
  container.append(header, rankLabel, stats, effect, description, footer, hint);
}
