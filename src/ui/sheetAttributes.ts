import { ATTRIBUTES, ATTRIBUTE_BASE_VALUE, ATTRIBUTE_MAX_VALUE, ATTRIBUTE_POINT_LEVEL_STEP, MAX_LEVEL, RACES, unspentAttributePoints, type AttributeId, type CharData } from '../data/data';
import { attributeTotal, vitalsOf } from '../data/stats';
import { attackInterval, basicAttackDamage, COMBAT_KITS, primaryAttribute, skillCost, skillPower, skillRank } from '../data/combat';
import { guardedDamage } from '../data/weapons';
import { attributeIcon } from './attributeIcons';
import { classText, getLanguage, t } from './i18n';

export interface PointEditor {
  draft: Partial<Record<AttributeId, number>>;
  onAdd: (id: AttributeId) => void;
  onRemove: (id: AttributeId) => void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};
const format = (n: number) => n.toLocaleString(getLanguage() === 'en' ? 'en-US' : 'es-ES', { maximumFractionDigits: 2 });

/** Visible descriptions follow the player's actual resource and class. */
function explanation(d: CharData, id: AttributeId): [string, string[]] {
  const mana = vitalsOf(d).resourceKind === 'mana';
  switch (id) {
    case 'fuerza': return ['Golpea con más fuerza con tus ataques básicos.', ['+0,3 % de ataque básico por punto por encima de 5.']];
    case 'intelecto': return ['Usa tus habilidades gastando menos energía.', [
      'Reduce el coste de habilidades a partir de 6 puntos.',
      ...(mana ? ['+7 de maná máximo por punto.'] : []),
    ]];
    case 'corpulencia': return ['Resiste más golpes antes de caer.', ['+2 % a la bonificación de vida máxima por punto.', ...(mana ? [] : ['+3 de estamina máxima por punto.'])]];
    case 'agilidad': return ['Ataca con más frecuencia con tus ataques básicos.', ['Reduce el tiempo entre ataques a partir de 6 puntos.', ...(mana ? [] : ['+3 de estamina máxima por punto.'])]];
    case 'pericia': return [COMBAT_KITS[d.cls].skill.healing ? 'Haz que tus habilidades curen más.' : 'Haz más daño con tus habilidades.', ['+0,4 % de potencia de habilidad por punto por encima de 5.']];
    case 'presencia': return ['Amplía tu reserva de energía para usar habilidades.', [mana ? '+1 de maná máximo por punto.' : '+1 de estamina máxima por punto.']];
    case 'percepcion': return ['Recibe menos daño cuando te atacan.', ['Añade protección a la que ya ofrece tu equipo.', 'Su efecto empieza a partir de 6 puntos.']];
  }
}

function preview(d: CharData, proposed: CharData) {
  const section = el('div', 'sheet-attribute-preview');
  section.setAttribute('role', 'status');
  section.append(el('strong', undefined, t('Así quedaría tu personaje')), el('p', undefined, t('Vista previa · los cambios se aplican al confirmar los puntos.')));
  const grid = el('dl', 'sheet-preview-grid');
  const before = vitalsOf(d), after = vitalsOf(proposed);
  const values: [string, number, number, string?][] = [
    ['Vida máxima', before.maxHealth, after.maxHealth],
    [after.resourceKind === 'mana' ? 'Maná máximo' : 'Estamina máxima', before.maxResource, after.maxResource],
    ['Ataque básico', basicAttackDamage(d.cls, d.level, d.equipment, d), basicAttackDamage(d.cls, d.level, d.equipment, proposed)],
    [COMBAT_KITS[d.cls].skill.label, skillPower(d.cls, skillRank(d), d.equipment, d), skillPower(d.cls, skillRank(d), d.equipment, proposed), d.cls === 'picaro' ? ' × 2' : ''],
    ['Coste de habilidad', skillCost(d), skillCost(proposed), ` ${t(after.resourceKind === 'mana' ? 'Maná' : 'Estamina')}`],
    ['Tiempo entre ataques', attackInterval(d.cls, d.equipment, d), attackInterval(d.cls, d.equipment, proposed), ' s'],
    ['Reducción de daño', 100 - guardedDamage(d.cls, d.equipment, 100, d), 100 - guardedDamage(d.cls, d.equipment, 100, proposed), ' %'],
  ];
  for (const [label, a, b, unit = ''] of values) {
    if (Math.abs(a - b) < .00001) continue;
    const item = el('div');
    const value = el('dd');
    value.append(el('span', undefined, `${format(a)}${unit}`), el('span', 'sheet-preview-arrow', '→'), el('b', undefined, `${format(b)}${unit}`));
    item.append(el('dt', undefined, t(label)), value);
    grid.append(item);
  }
  section.append(grid);
  return section;
}

export function renderSheetAttributes(d: CharData, points?: PointEditor) {
  const attrs = el('section', 'sheet-panel sheet-attributes');
  attrs.setAttribute('aria-label', t('Atributos'));
  const draft = points?.draft ?? {};
  const drafted = Object.values(draft).reduce((sum, n) => sum + (n ?? 0), 0);
  const owed = unspentAttributePoints(d), remaining = Math.max(0, owed - drafted);
  const primary = primaryAttribute(d.cls);
  const head = el('div', 'sheet-section-head');
  const heading = el('div');
  heading.append(el('h3', undefined, t('Atributos')), el('p', 'sheet-section-note', t('Elige cómo quieres que crezca tu personaje.')));
  const pool = el('div', `sheet-attribute-pool${remaining > 0 ? ' available' : ''}`);
  pool.setAttribute('role', 'status');
  pool.append(el('b', undefined, String(remaining)), el('span', undefined, t('Puntos disponibles')));
  head.append(heading, pool);
  const guide = el('div', 'sheet-attribute-guide');
  const main = el('p');
  main.append(el('strong', undefined, t('{attribute} es tu atributo principal.', { attribute: t(ATTRIBUTES[primary].label) })), ` ${t('Aumenta la potencia de tus ataques y habilidades como {class}.', { class: classText(d) })}`);
  guide.append(main, el('p', undefined, t('Todos los atributos te aportan algo: combina potencia, resistencia y energía según tu forma de jugar.')));
  attrs.append(head, guide);
  if (owed > 0 && points) attrs.append(el('p', 'sheet-attribute-instruction', t('Usa + y − para preparar el reparto. Revisa los cambios y pulsa Confirmar puntos para guardarlos.')));
  else if (d.level < Math.floor(MAX_LEVEL / ATTRIBUTE_POINT_LEVEL_STEP) * ATTRIBUTE_POINT_LEVEL_STEP) attrs.append(el('p', 'sheet-attribute-instruction', t('Ganas 1 punto de atributo cada {n} niveles. Próximo punto: nivel {level}.', { n: ATTRIBUTE_POINT_LEVEL_STEP, level: (Math.floor(d.level / ATTRIBUTE_POINT_LEVEL_STEP) + 1) * ATTRIBUTE_POINT_LEVEL_STEP })));
  else attrs.append(el('p', 'sheet-attribute-instruction', t('Ya has obtenido todos los puntos de atributo por nivel.')));

  const proposed = { ...d, attributePoints: { ...d.attributePoints } };
  for (const id of Object.keys(ATTRIBUTES) as AttributeId[]) proposed.attributePoints[id] += draft[id] ?? 0;
  if (drafted > 0) attrs.append(preview(d, proposed));
  const grid = el('div', 'sheet-attrs');
  for (const id of Object.keys(ATTRIBUTES) as AttributeId[]) {
    const extra = draft[id] ?? 0, total = attributeTotal(proposed, id);
    const row = el('article', `sheet-attr${id === primary ? ' is-primary' : ''}${extra ? ' has-draft' : ''}`);
    row.dataset.attribute = id;
    row.tabIndex = -1;
    const header = el('div', 'sheet-attr-header');
    const icon = el('div', 'sheet-attr-icon');
    icon.innerHTML = attributeIcon(id);
    icon.setAttribute('aria-hidden', 'true');
    const names = el('div', 'sheet-attr-heading');
    names.append(el('h4', undefined, t(ATTRIBUTES[id].label)));
    if (id === primary) names.append(el('span', 'sheet-primary-tag', t('Principal de tu clase')));
    const score = el('div', 'sheet-attr-score');
    score.setAttribute('aria-label', t('{attribute}: {value} de {max}', { attribute: t(ATTRIBUTES[id].label), value: total, max: ATTRIBUTE_MAX_VALUE }));
    score.append(el('b', extra ? 'pending' : undefined, String(total)), el('small', undefined, `/ ${ATTRIBUTE_MAX_VALUE}`));
    header.append(icon, names, score);
    const [description, benefits] = explanation(d, id);
    const list = el('ul', 'sheet-attr-benefits');
    for (const benefit of benefits) list.append(el('li', undefined, t(benefit)));
    if (id === primary) list.append(el('li', undefined, t('+1 % a la bonificación de potencia por punto.')));
    const breakdown = el('div', 'sheet-attr-breakdown');
    for (const [label, value] of [['Base', ATTRIBUTE_BASE_VALUE], ['Linaje', RACES[d.race].bonuses[id]], ['Asignados', d.attributePoints[id]]] as const) {
      const part = el('span');
      part.append(t(label), el('b', undefined, String(value)));
      breakdown.append(part);
    }
    if (extra) breakdown.append(el('span', 'sheet-draft', t('+{n} sin confirmar', { n: extra })));
    row.append(header, el('p', 'sheet-attr-description', t(description)), list, breakdown);
    if (owed > 0 && points) {
      const controls = el('div', 'sheet-attr-controls');
      controls.append(el('span', 'sheet-attr-limit', total >= ATTRIBUTE_MAX_VALUE ? t('Máximo alcanzado') : t('Repartir puntos')));
      const remove = el('button', 'sheet-attr-add', '−'); remove.type = 'button'; remove.disabled = extra === 0;
      remove.setAttribute('aria-label', t('Quitar un punto de {attribute}', { attribute: t(ATTRIBUTES[id].label) }));
      remove.onclick = () => points.onRemove(id);
      const add = el('button', 'sheet-attr-add', '+'); add.type = 'button'; add.disabled = remaining <= 0 || total >= ATTRIBUTE_MAX_VALUE;
      add.setAttribute('aria-label', t('Añadir un punto a {attribute}', { attribute: t(ATTRIBUTES[id].label) }));
      add.onclick = () => points.onAdd(id);
      controls.append(remove, add); row.append(controls);
    }
    grid.append(row);
  }
  attrs.append(grid);
  return attrs;
}
