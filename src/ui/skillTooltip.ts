import { COMBAT_KITS, MAX_SKILL_RANK, skillCost, skillFor, skillPower, skillRankLevel, type SkillId } from '../data/combat';
import { type ClassId } from '../data/data';
import { skillIcon } from './skillIcons';
import { t } from './i18n';
import type { Equipment } from '../data/inventory';
import { session } from '../game/state';
import combatTiming from '../data/combatTiming.json';

const equipmentContexts = new WeakMap<HTMLElement, Equipment>();
export const skillTooltipEquipment = (target: HTMLElement) => equipmentContexts.get(target);

export function skillEffect(cls: ClassId, id: SkillId, rank: number, equipment?: Equipment) {
  const skill = skillFor(cls,id);
  if (!skill) throw new Error(`La habilidad ${id} no pertenece a ${cls}.`);
  const power = Math.round(skillPower(cls, rank, equipment,equipment===session.state.equipment?session.state:undefined,id)*10)/10;
  return skill.healing ? t('Restaura hasta {n} puntos de vida.', { n: power })
    : t(skill.hits === 1 ? 'Un impacto de {damage} de daño.' : '{hits} impactos de {damage} de daño.', { hits: skill.hits, damage: power });
}

export function setSkillTooltip(target: HTMLElement, cls: ClassId, id: SkillId, rank: number, equipment?: Equipment) {
  const skill = skillFor(cls,id);
  if (!skill) throw new Error(`La habilidad ${id} no pertenece a ${cls}.`);
  if (equipment) equipmentContexts.set(target, equipment); else equipmentContexts.delete(target);
  target.dataset.skillId = id;
  target.dataset.skillClass = cls;
  target.dataset.skillRank = String(rank);
  target.setAttribute('aria-label', t(skill.label));
}

export function skillStats(cls: ClassId, id: SkillId) {
  const kit = COMBAT_KITS[cls], skill = skillFor(cls,id);
  if (!skill) throw new Error(`La habilidad ${id} no pertenece a ${cls}.`);
  return [
    [t('Coste'), `${Math.round((session.state.cls===cls?skillCost(session.state,id):skill.cost)*100)/100} ${t(cls === 'mago' || cls === 'clerigo' ? 'Maná' : 'Estamina')}`],
    [t('Recarga'), `${skill.cooldown} s`],
    [t('Preparación'), `${combatTiming[cls].skill} s`],
    [t('Alcance'), `${kit.range} m`],
    [t('Objetivo'), t(skill.healing ? 'Tú o un compañero del grupo' : 'Un enemigo')],
  ];
}

export function renderSkillTooltip(container: HTMLElement, cls: ClassId, id: SkillId, rank: number, equipment?: Equipment) {
  const skill = skillFor(cls,id);
  if (!skill) throw new Error(`La habilidad ${id} no pertenece a ${cls}.`);
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
  for (const [label, value] of skillStats(cls,id)) {
    const dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = label; dd.textContent = value; stats.append(dt, dd);
  }
  const effect = document.createElement('section');
  effect.className = 'item-tip-effects';
  effect.textContent = skillEffect(cls, id, rank, equipment);
  const description = document.createElement('p');
  description.className = 'item-tip-description';
  description.textContent = t(skill.description);
  const footer = document.createElement('p');
  footer.className = 'item-tip-footer';
  footer.textContent = rank < MAX_SKILL_RANK
    ? `${t('Siguiente rango')} · ${t('Nivel {n}', { n: skillRankLevel(rank + 1,id) })} · ${t('1 punto de habilidad')}. ${skillEffect(cls,id,rank + 1,equipment)}`
    : t('Rango máximo alcanzado.');
  const hint = document.createElement('small');
  hint.textContent = `${t('Arrastra a la barra rápida · Usa con 1–0')} · ${t('Puedes moverte al usarla.')}`;
  container.append(header, rankLabel, stats, effect, description, footer, hint);
}
