import { sanitize, type CharData } from '../data/data';
import { joinWorld, leaveWorld, syncWorld } from './account';
import type { Vitals } from '../data/stats';

export type PublicVitals = Pick<Vitals, 'health' | 'maxHealth' | 'overheal' | 'resource' | 'maxResource' | 'resourceKind'>;

export interface WorldPosition { x: number; z: number; yaw: number }
export interface WorldMotion extends WorldPosition { facing: number; jump: number; wave: number }
export interface WorldPlayer {
  id: string;
  userId: string;
  username: string | null;
  vitals: PublicVitals;
  data: CharData;
  position: WorldPosition;
  facing: number;
  jump: number;
  wave: number;
  dead: boolean;
}
export interface WorldSnapshot {
  status: 'ok' | 'corrected';
  position: WorldPosition;
  players: WorldPlayer[];
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Respuesta multijugador no válida.');
  return value as Record<string, unknown>;
}
function number(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Respuesta multijugador no válida.');
  return value;
}
function position(value: unknown): WorldPosition {
  const p = record(value);
  return { x: number(p.x), z: number(p.z), yaw: number(p.yaw) };
}
function vitals(value: unknown): PublicVitals {
  const v = record(value);
  const health = number(v.health), maxHealth = number(v.maxHealth), overheal = number(v.overheal);
  const resource = number(v.resource), maxResource = number(v.maxResource);
  if (maxHealth <= 0 || maxResource <= 0 || health < 0 || health > maxHealth || overheal < 0
    || resource < 0 || resource > maxResource || (v.resourceKind !== 'mana' && v.resourceKind !== 'stamina')) {
    throw new Error('Respuesta multijugador no válida.');
  }
  return { health, maxHealth, overheal, resource, maxResource, resourceKind: v.resourceKind };
}
function snapshot(value: unknown): WorldSnapshot {
  const data = record(value);
  if ((data.status !== 'ok' && data.status !== 'corrected') || !Array.isArray(data.players)) throw new Error('Respuesta multijugador no válida.');
  return {
    status: data.status, position: position(data.position),
    players: data.players.map((value) => {
      const p = record(value);
      if (typeof p.id !== 'string' || typeof p.userId !== 'string' || typeof p.dead !== 'boolean'
        || (p.username !== null && typeof p.username !== 'string')) throw new Error('Respuesta multijugador no válida.');
      return { id: p.id, userId: p.userId, username: p.username, vitals: vitals(p.vitals), data: sanitize(record(p.data)), position: position(p.position), facing: number(p.facing), jump: number(p.jump), wave: number(p.wave), dead: p.dead };
    }),
  };
}

interface WorldHooks {
  motion(): WorldMotion;
  receive(value: WorldSnapshot): void;
  stale(): void;
  connection(status: 'connected' | 'retrying'): void;
  replaced(): void;
}

/** Peticiones secuenciales: nunca se aplican respuestas de una sesión que ya se ha cerrado. */
export class WorldConnection {
  private session = crypto.randomUUID();
  private closed = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pending: Promise<void> = Promise.resolve();
  private joined = false;
  private started = false;
  private retrying = false;
  private lastSuccess = performance.now();

  constructor(private characterId: string, private hooks: WorldHooks) {}

  async join() {
    const response = await joinWorld(this.characterId, this.session);
    this.joined = true;
    const value = snapshot(response);
    if (this.closed) { await this.leave(); return null; }
    return value;
  }

  start() {
    if (this.closed || !this.joined || this.started) return;
    this.started = true;
    this.hooks.connection('connected');
    this.tick();
  }

  private tick() {
    if (this.closed) return;
    this.pending = (async () => {
      try {
        const value = snapshot(await syncWorld(this.characterId, this.session, this.hooks.motion()));
        if (this.closed) return;
        this.lastSuccess = performance.now();
        this.hooks.receive(value);
        if (this.retrying) { this.retrying = false; this.hooks.connection('connected'); }
      } catch (error) {
        if (this.closed) return;
        console.error('[Brumaluz multiplayer]', error);
        if (error instanceof Error && /WORLD_SESSION_REPLACED|CHARACTER_NOT_FOUND/.test(error.message)) {
          this.closed = true;
          this.hooks.replaced();
          return;
        }
        if (!this.retrying) { this.retrying = true; this.hooks.connection('retrying'); }
        if (performance.now() - this.lastSuccess > 15000) {
          this.hooks.stale();
        }
      } finally {
        if (!this.closed) this.timer = setTimeout(() => this.tick(), this.retrying ? 1500 : 250);
      }
    })();
  }

  async stop() {
    const finalMotion = this.started && !this.closed ? this.hooks.motion() : null;
    this.closed = true;
    clearTimeout(this.timer);
    await this.pending;
    if (finalMotion && this.joined) {
      try { await syncWorld(this.characterId, this.session, finalMotion); }
      catch (error) { console.error('[Brumaluz multiplayer] No se pudo enviar la última posición.', error); }
    }
    if (this.joined) await this.leave();
  }

  private async leave() {
    this.joined = false;
    try { await leaveWorld(this.characterId, this.session); }
    catch (error) { console.error('[Brumaluz multiplayer] No se pudo cerrar la presencia; caducará en 15 segundos.', error); }
  }
}
