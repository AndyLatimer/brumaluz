// Simulación local de las acciones del servidor, solo para el modo ?test (sin cuenta ni base de datos).
// Las reglas reales viven en supabase/server.sql.
import { MAX_LEVEL, unspentAttributePoints, ATTRIBUTE_MAX_VALUE, type CharData, type AttributeId } from '../data/data';
import { attributeTotal, experienceToNextLevel, maxOverhealOf, vitalsOf } from '../data/stats';
import type { CharacterAction } from './account';

export function simulateAction(d: CharData, action: CharacterAction) {
  if (action === 'respawn') {
    if (d.health === 0) { d.health = -1; d.overheal = 0; d.position = null; }
    return;
  }
  if (d.health === 0) return;
  const v = vitalsOf(d);
  if (action === 'damage') {
    const absorbed = Math.min(v.overheal, 10);
    d.overheal = v.overheal - absorbed;
    if (absorbed < 10) d.health = Math.max(0, v.health - (10 - absorbed));
  } else if (action === 'heal') {
    const total = v.health + 10;
    d.health = Math.min(v.maxHealth, total);
    d.overheal = Math.min(v.overheal + Math.max(total - v.maxHealth, 0), maxOverhealOf(d));
  } else if (d.level < MAX_LEVEL) {
    d.experience += 200;
    while (d.level < MAX_LEVEL && d.experience >= experienceToNextLevel(d.level)) { d.experience -= experienceToNextLevel(d.level); d.level++; }
    if (d.level >= MAX_LEVEL) d.experience = experienceToNextLevel(MAX_LEVEL);
  }
}

export function simulateSpend(d: CharData, points: Partial<Record<AttributeId, number>>) {
  const total = Object.values(points).reduce<number>((sum, n) => sum + (n ?? 0), 0);
  if (total > unspentAttributePoints(d)) return;
  for (const [id, n] of Object.entries(points) as [AttributeId, number][]) {
    if (attributeTotal(d, id) + n <= ATTRIBUTE_MAX_VALUE) d.attributePoints[id] += n;
  }
}
