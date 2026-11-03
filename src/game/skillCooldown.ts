import { vitals } from './state';
import { serverNow } from '../data/worldClock';
import type { SkillId } from '../data/combat';
import { parseSkillCooldowns, parseSkillId, skillById } from '../data/skills';

type CooldownKey = SkillId | 'legacy';
export interface SkillCooldownSample {
  id?: SkillId;
  deadline?: number;
  deadlines?: Partial<Record<SkillId, number>>;
  remaining?: number;
  serverTime?: number;
  revision?: number;
}

interface CooldownToken { id: number; key: CooldownKey; previous: number }
let serial = 0;
const pending = new Map<CooldownKey, number>();
const readyAt = new Map<SkillId, number>();
const lastRevision = new Map<CooldownKey, number>();
const lastDeadline = new Map<CooldownKey, number>();
function currentDeadline(key: CooldownKey) {
  return key === 'legacy' ? vitals.skillReadyAt : readyAt.get(key) ?? 0;
}

function setDeadline(key: CooldownKey, deadline: number) {
  if (key === 'legacy') vitals.skillReadyAt = deadline;
  else readyAt.set(key, deadline);
}

function syncOne(
  key: CooldownKey, deadline: number | undefined, remaining: number | undefined,
  serverTime: number | undefined, revision: number | undefined, requestStarted: number | undefined,
) {
  if (pending.has(key) || !Number.isFinite(deadline ?? remaining)) return;
  const previousRevision = lastRevision.get(key);
  const previousDeadline = lastDeadline.get(key);
  if (revision !== undefined && previousRevision !== undefined && revision < previousRevision) return;
  if (revision !== undefined && revision === previousRevision && deadline !== undefined
    && previousDeadline !== undefined && deadline < previousDeadline) return;
  let seconds = deadline !== undefined && serverTime !== undefined
    ? deadline - serverTime : remaining ?? (deadline !== undefined ? deadline - serverNow() : 0);
  if (requestStarted !== undefined && (serverTime !== undefined || remaining !== undefined)) {
    seconds -= Math.max(0, performance.now() - requestStarted) / 2000;
  }
  if (!Number.isFinite(seconds)) return;
  let next = performance.now() + Math.max(0, seconds) * 1000;
  if ((deadline !== undefined && deadline === previousDeadline)
    || (revision !== undefined && revision === previousRevision)) next = Math.min(currentDeadline(key), next);
  setDeadline(key, next);
  if (revision !== undefined) lastRevision.set(key, revision);
  if (deadline !== undefined) lastDeadline.set(key, deadline);
}

export function skillCooldownRemaining(id: SkillId) {
  return Math.max(0, ((readyAt.get(id) ?? 0) - performance.now()) / 1000);
}

export function predictSkillCooldown(seconds: number, id?: SkillId): CooldownToken {
  const key: CooldownKey = id ?? 'legacy';
  const token = { id: ++serial, key, previous: currentDeadline(key) };
  pending.set(key, token.id);
  setDeadline(key, performance.now() + Math.max(0, seconds) * 1000);
  return token;
}

export function syncSkillCooldown(sample: SkillCooldownSample, id?: SkillId, requestStarted?: number) {
  if (sample.deadlines) {
    for (const [rawId, deadline] of Object.entries(sample.deadlines)) {
      const skillId = parseSkillId(rawId);
      if (skillId) syncOne(skillId, deadline, undefined, sample.serverTime, sample.revision, requestStarted);
    }
  }
  const key: CooldownKey = id ?? sample.id ?? 'legacy';
  syncOne(key, sample.deadline, sample.remaining, sample.serverTime, sample.revision, requestStarted);
}

export function finishSkillCooldown(token: CooldownToken, sample: SkillCooldownSample, requestStarted?: number) {
  if (pending.get(token.key) !== token.id) return;
  pending.delete(token.key);
  syncSkillCooldown(sample, token.key === 'legacy' ? undefined : token.key, requestStarted);
}

export function cancelSkillCooldown(token: CooldownToken) {
  if (pending.get(token.key) !== token.id) return;
  pending.delete(token.key);
  setDeadline(token.key, token.previous);
}

export function resetSkillCooldown() {
  serial++;
  pending.clear();
  readyAt.clear();
  lastRevision.clear();
  lastDeadline.clear();
  vitals.skillReadyAt = 0;
}

export function releasePendingSkillCooldown() {
  pending.clear();
}

export function cooldownSample(result: Record<string, unknown>, id?: SkillId): SkillCooldownSample {
  const data = result.data as { combatNextSkill?: number; combatSkillReadyAt?: Partial<Record<SkillId, number>>; serverRevision?: number } | undefined;
  const deadlines = parseSkillCooldowns(result.skillCooldowns)
    ?? parseSkillCooldowns(data?.combatSkillReadyAt);
  const selected = id ?? parseSkillId(result.skillId);
  const wilderness = result.wilderness as { skillReadyAt?: number; skillCooldowns?: Partial<Record<SkillId, number>>; serverTime?: number } | undefined;
  const vitalsRevision = (result.vitals as { serverRevision?: number } | undefined)?.serverRevision;
  const definition = selected ? skillById(selected) : undefined;
  const deadline = selected
    ? deadlines?.[selected] ?? (definition?.unlockLevel === 1 ? data?.combatNextSkill : undefined)
    : data?.combatNextSkill ?? wilderness?.skillReadyAt;
  return {
    id: selected,
    deadline: typeof result.skillReadyAt === 'number' ? result.skillReadyAt : deadline ?? wilderness?.skillReadyAt,
    deadlines: deadlines ?? parseSkillCooldowns(wilderness?.skillCooldowns),
    remaining: typeof result.skillCooldown === 'number' ? result.skillCooldown : undefined,
    serverTime: wilderness?.serverTime,
    revision: vitalsRevision ?? data?.serverRevision,
  };
}
