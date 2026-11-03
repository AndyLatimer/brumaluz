import * as THREE from 'three';
import type { Character } from '../character/character';
import type { City, SeatSpot } from './city';
import { PopulationNavigation } from './populationNavigation';
import { CITY_POPULATIONS, type PopulationDistrict, type PopulationExchange, type ResidentId } from '../data/cityPopulation';
import { conversationTurnSeconds } from '../data/speech';
import { crowdStep, type CrowdBody } from './crowdMovement';
import { PopulationPresentation } from './populationPresentation';
import { PopulationConversations } from './populationConversations';
import { populationPatrol, closestPatrolStop, nextPatrolStop, type PopulationPatrol } from './populationPatrol';

export type ResidentActivity = 'idle' | 'planning' | 'walking' | 'seated' | 'talking' | 'scripted';
export const POPULATION_PATH_WORK = { milliseconds: 1.5, slices: 32 } as const;
interface PathJob {
  resident: Resident;
  steps: Generator<void, THREE.Vector3[], void>;
  start: THREE.Vector3;
  goal: THREE.Vector3;
  cacheKey?: string;
}
interface Resident {
  id: ResidentId;
  character: Character;
  district: PopulationDistrict;
  patrol: PopulationPatrol;
  patrolDirection: 1 | -1;
  activity: ResidentActivity;
  route: THREE.Vector3[];
  destination: number;
  timer: number;
  cycle: number;
  holds: number;
  velocity: THREE.Vector3;
  blockedFor: number;
  priority: number;
  pendingDt: number;
  progressFor: number;
  progressDistance: number;
  nextReplan: number;
  retryIn: number;
  animationSpeed: number;
  locomoting: boolean;
  planning?: PathJob;
  resumeGoal?: THREE.Vector3;
  socialCheckAt: number;
  seat?: SeatSpot;
  approach?: THREE.Vector3;
  partner?: Resident;
  exchange?: { scene: PopulationExchange; index: number; timer: number };
}
interface PopulationContext {
  player: THREE.Vector3;
  playerSeated: boolean;
  quiet: boolean;
  blockers?: readonly THREE.Vector3[];
  say(id: ResidentId, text: string): void;
}

/** Local cosmetic simulation. Quests can hold a stable resident ID and release it afterwards. */
export class CityPopulation {
  private residents: Resident[] = [];
  private occupied = new Map<string, Resident>();
  private paths = new Map<string, THREE.Vector3[]>();
  private nextSpeech = 18;
  private elapsed = 0;
  private planningBudget = 0;
  private blockers: readonly THREE.Vector3[] = [];
  private presentation: PopulationPresentation;
  private bodies = new Map<Resident, CrowdBody>();
  private bodyCells = new Map<string, CrowdBody[]>();
  private navigation: PopulationNavigation;
  private planningQueue: PathJob[] = [];
  private conversations = new PopulationConversations();

  constructor(private city: City, characters: ReadonlyMap<string, Character>) {
    this.navigation = new PopulationNavigation(city);
    for (const district of CITY_POPULATIONS[city.locationId]?.districts ?? []) {
      const patrol = populationPatrol(district.route);
      if (!patrol.points.length) continue;
      district.residents.forEach((id, index) => {
        const character = characters.get(id);
        if (!character) return;
        this.residents.push({ id, character, district, patrol, patrolDirection: index % 2 === 0 ? 1 : -1,
          activity: 'idle', route: [], destination: closestPatrolStop(patrol, character.root.position.x, character.root.position.z),
          timer: 2 + this.residents.length % 5 * 1.7, cycle: index, holds: 0,
          velocity: new THREE.Vector3(), blockedFor: 0, priority: this.residents.length, pendingDt: 0,
          progressFor: 0, progressDistance: Infinity, nextReplan: 0, retryIn: 0, animationSpeed: 0, locomoting: false, socialCheckAt: 0 });
      });
    }
    for (const resident of this.residents) this.bodies.set(resident, {
      position: resident.character.root.position, velocity: resident.velocity, radius: .5, priority: resident.priority,
    });
    this.presentation = new PopulationPresentation(this.residents.map(resident => ({
      id: resident.id, character: resident.character, pinned: () => resident.holds > 0 || resident.activity === 'talking',
    })));
  }

  updatePresentation(t: number, camera: THREE.Camera, focus: THREE.Vector3, playing: boolean, compatible: boolean) {
    this.presentation.update(t, camera, focus, playing, compatible);
  }
  presentationStats() { return this.presentation.snapshot(); }

  snapshot() {
    return this.residents.map(resident => ({ id: resident.id, activity: resident.activity,
      position: resident.character.root.position.toArray(), seat: resident.seat?.id, partner: resident.partner?.id,
      goal: (resident.route.at(-1) ?? resident.planning?.goal ?? resident.resumeGoal)?.toArray(), exchange: resident.exchange?.scene.id }));
  }

  isSeatOccupied(id: string) { return this.occupied.has(id); }

  /** Nested holds allow a dialogue and a future quest scene to own the same actor safely. */
  hold(id: string): () => void {
    const resident = this.residents.find(candidate => candidate.id === id);
    if (!resident) return () => {};
    resident.holds++;
    this.pauseRoutine(resident);
    resident.activity = 'scripted';
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (--resident.holds === 0) {
        resident.activity = resident.character.isSeated && resident.seat ? 'seated' : 'idle';
        resident.timer = resident.activity === 'seated' ? 1 : 3;
      }
    };
  }

  dispose() {
    for (const resident of this.residents) { this.stop(resident); resident.character.stand(); }
    this.presentation.dispose();
    this.residents = [];
    this.occupied.clear();
    this.paths.clear();
    this.navigation.dispose();
    this.conversations.dispose();
    this.planningQueue = [];
    this.bodies.clear(); this.bodyCells.clear(); this.blockers = [];
  }

  private point(x: number, z: number) { return new THREE.Vector3(x, this.city.groundY(x, z), z); }

  private hasSpace(resident: Resident, point: THREE.Vector3) {
    const clear = (other: THREE.Vector3, minimum: number) => Math.abs(point.y - other.y) >= 1.6
      || Math.hypot(point.x - other.x, point.z - other.z) >= minimum;
    return this.residents.every(other => other === resident || clear(other.character.root.position, 1.08))
      && this.blockers.every(other => clear(other, 1.13));
  }

  private pauseRoutine(resident: Resident) {
    const goal = !resident.seat ? (resident.route.at(-1) ?? resident.planning?.goal)?.clone() : undefined;
    this.stop(resident);
    if (goal) resident.resumeGoal = goal;
  }

  private stop(resident: Resident) {
    resident.planning?.steps.return([]); resident.planning = undefined;
    if (resident.partner) {
      const partner = resident.partner;
      partner.partner = undefined; partner.exchange = undefined; partner.activity = 'idle'; partner.timer = 5;
      resident.partner = undefined; resident.exchange = undefined;
    }
    if (resident.seat) {
      if (resident.character.isSeated && resident.approach) {
        const yaw = resident.seat.yaw;
        const candidates = [[0, 0], [1.2, 0], [-1.2, 0], [0, 1.2]].map(([side, forward]) =>
          this.point(resident.approach!.x + side * Math.cos(yaw) + forward * Math.sin(yaw),
            resident.approach!.z - side * Math.sin(yaw) + forward * Math.cos(yaw)));
        const exit = candidates.find(point => !this.city.waterAt?.(point.x, point.z)
          && this.city.collide(point, point.clone()).distanceTo(point) < .002 && this.hasSpace(resident, point));
        // Stay seated and keep the reservation until a safe exit exists, even when held for dialogue.
        if (!exit) return false;
        resident.character.stand();
        resident.character.root.position.copy(exit);
      }
      this.occupied.delete(resident.seat.id);
      resident.seat = undefined; resident.approach = undefined;
    }
    resident.route = [];
    resident.velocity.set(0, 0, 0); resident.blockedFor = 0;
    resident.progressFor = 0; resident.progressDistance = Infinity; resident.retryIn = 0;
    resident.animationSpeed = 0; resident.locomoting = false;
    const body = this.bodies.get(resident); if (body) body.heading = undefined;
    resident.character.setGait('idle');
    resident.character.setLocomotionSpeed(0);
    return true;
  }

  private plan(resident: Resident, goal: THREE.Vector3, recover = false) {
    if (this.planningBudget <= 0) return false;
    this.planningBudget--;
    const start = resident.character.root.position;
    const key = `${start.x.toFixed(2)}:${start.z.toFixed(2)}:${goal.x.toFixed(2)}:${goal.z.toFixed(2)}`;
    const blockers: CrowdBody[] = recover ? [
      ...[...this.bodies.values()].filter(body => body.position !== start && (!body.velocity || body.velocity.lengthSq() < .04)),
      ...this.blockers.map(position => ({ position, radius: .55, priority: -1 })),
    ] : [];
    const cached = recover ? undefined : this.paths.get(key);
    if (cached) {
      if (!cached.length) return false;
      resident.route = cached.map(point => point.clone()); resident.activity = 'walking';
    } else {
      const snapshot = blockers.map(body => ({ ...body, position: body.position.clone() }));
      const job: PathJob = { resident, start: start.clone(), goal: goal.clone(), cacheKey: recover ? undefined : key,
        steps: this.navigation.pathSteps(start.clone(), goal.clone(), snapshot) };
      resident.planning = job; this.planningQueue.push(job);
      resident.activity = 'planning'; resident.route = [];
      resident.velocity.set(0, 0, 0); resident.animationSpeed = 0; resident.locomoting = false;
      resident.character.setGait('idle'); resident.character.setLocomotionSpeed(0);
    }
    resident.progressFor = 0; resident.progressDistance = Infinity; resident.retryIn = 0;
    return true;
  }

  private advancePlanning() {
    while (this.planningQueue.length && this.planningQueue[0].resident.planning !== this.planningQueue[0]) this.planningQueue.shift();
    const job = this.planningQueue[0]; if (!job) return;
    const begun = performance.now();
    for (let slice = 0; slice < POPULATION_PATH_WORK.slices; slice++) {
      const result = job.steps.next();
      if (result.done) {
        this.planningQueue.shift(); job.resident.planning = undefined;
        if (job.cacheKey) {
          if (this.paths.size >= 128) this.paths.clear();
          this.paths.set(job.cacheKey, result.value);
        }
        if (result.value.length && job.resident.character.root.position.distanceToSquared(job.start) < .01) {
          job.resident.route = result.value.map(point => point.clone()); job.resident.activity = 'walking';
        } else {
          this.stop(job.resident); job.resident.activity = 'idle'; job.resident.timer = 2 + job.resident.priority % 3;
        }
        break;
      }
      if (performance.now() - begun >= POPULATION_PATH_WORK.milliseconds) break;
    }
  }

  private patrolGoal(resident: Resident) {
    const [x, z] = resident.patrol.points[resident.destination];
    const from = resident.character.root.position;
    const dx = x - from.x, dz = z - from.z, length = Math.hypot(dx, dz) || 1;
    const along = (resident.priority % 3 - 1) * .6;
    // Opposing traffic uses opposite sides; neighbours do not all stop at the same coordinate.
    for (const side of [.8, 1.25, -.8, 0]) {
      const point = this.point(x + (dz * side + dx * along) / length, z + (-dx * side + dz * along) / length);
      if (this.navigation.walkable(point) && this.hasSpace(resident, point)) return point;
    }
    return this.point(x, z);
  }

  private animateMovement(resident: Resident, speed: number, dt: number) {
    resident.animationSpeed += (speed - resident.animationSpeed) * (1 - Math.exp(-dt * 10));
    if (resident.locomoting ? resident.animationSpeed < .12 : resident.animationSpeed > .3) resident.locomoting = !resident.locomoting;
    resident.character.setGait(resident.locomoting ? 'walk' : 'idle');
    resident.character.setLocomotionSpeed(resident.locomoting ? resident.animationSpeed : 0);
  }

  private rest(resident: Resident, context: PopulationContext) {
    const origin = resident.character.root.position;
    // Leave at least one place on each bench for the player; never approach a seated player.
    const candidates = this.city.seats.filter((seat, index) => index % 2 === 0 && !this.occupied.has(seat.id)
      && origin.distanceToSquared(seat.position) < 18 * 18
      && !(context.playerSeated && context.player.distanceToSquared(seat.position) < 2.5 * 2.5))
      .sort((a, b) => origin.distanceToSquared(a.position) - origin.distanceToSquared(b.position));
    for (const seat of candidates.slice(0, 2)) {
      const approach = this.point(seat.position.x + Math.sin(seat.yaw) * .85, seat.position.z + Math.cos(seat.yaw) * .85);
      if (this.city.collide(approach, approach.clone()).distanceTo(approach) > .06) continue;
      if (!this.plan(resident, approach)) continue;
      this.occupied.set(seat.id, resident);
      resident.seat = seat; resident.approach = approach;
      return true;
    }
    return false;
  }

  private converse(resident: Resident, context: PopulationContext) {
    const root = resident.character.root;
    if (resident.activity !== 'idle' || resident.resumeGoal || context.quiet || this.elapsed < this.nextSpeech
      || this.elapsed < resident.socialCheckAt || root.position.distanceToSquared(context.player) > 10 * 10) return false;
    resident.socialCheckAt = this.elapsed + 1;
    const listener = context.player.clone(); listener.y += 1;
    const speaker = root.position.clone(); speaker.y += 1;
    if (this.city.lineOfSight && !this.city.lineOfSight(speaker, listener)) return false;
    const candidates = this.residents.filter(other => other !== resident && other.district === resident.district
      && !other.holds && !other.seat && (other.activity === 'idle' || other.activity === 'walking')
      && root.position.distanceToSquared(other.character.root.position) >= 1.2 * 1.2
      && root.position.distanceToSquared(other.character.root.position) <= 2.8 * 2.8
      && other.character.root.position.distanceToSquared(context.player) <= 10 * 10)
      .sort((a, b) => Number(a.activity !== 'idle') - Number(b.activity !== 'idle')
        || root.position.distanceToSquared(a.character.root.position) - root.position.distanceToSquared(b.character.root.position));
    let partner: Resident | undefined, scene: PopulationExchange | undefined;
    for (const candidate of candidates) {
      const other = candidate.character.root.position.clone(); other.y += 1;
      if (this.city.lineOfSight && (!this.city.lineOfSight(speaker, other) || !this.city.lineOfSight(other, listener))) continue;
      // Do not stop a pair across the path of a third pedestrian who is already passing.
      if (this.residents.some(third => third !== resident && third !== candidate && third.activity === 'walking'
        && (third.character.root.position.distanceToSquared(root.position) < 1.6 * 1.6
          || third.character.root.position.distanceToSquared(candidate.character.root.position) < 1.6 * 1.6))) continue;
      scene = this.conversations.choose(resident.district.exchanges,
        { id: resident.id, position: root.position }, { id: candidate.id, position: candidate.character.root.position }, this.elapsed);
      if (scene) { partner = candidate; break; }
    }
    if (!partner || !scene) return false;
    this.pauseRoutine(resident); this.pauseRoutine(partner);
    resident.partner = partner; partner.partner = resident;
    resident.activity = partner.activity = 'talking';
    resident.exchange = { scene, index: 0, timer: .6 };
    this.nextSpeech = this.elapsed + 45 + (resident.priority * 13 + resident.cycle * 7) % 26;
    return true;
  }

  update(frameDt: number, context: PopulationContext) {
    this.blockers = [context.player, ...(context.blockers ?? [])];
    this.elapsed += frameDt;
    this.advancePlanning();
    this.planningBudget = 1; // Admit one request; advancePlanning spreads the active search over frames.
    for (const cell of this.bodyCells.values()) cell.length = 0;
    for (const resident of this.residents) {
      const position = resident.character.root.position;
      const key = `${Math.floor(position.x / 8)}:${Math.floor(position.z / 8)}`;
      let cell = this.bodyCells.get(key);
      if (!cell) { cell = []; this.bodyCells.set(key, cell); }
      cell.push(this.bodies.get(resident)!);
    }
    const externalBodies: CrowdBody[] = this.blockers.map(position => ({ position, radius: .55, priority: -1 }));
    for (const resident of this.residents) {
      const root = resident.character.root;
      if (resident.holds || resident.planning) { resident.pendingDt = 0; continue; }
      resident.pendingDt += frameDt;
      // Far-away routines still advance, but at 5 Hz; movement near the player stays smooth.
      if (!root.visible && root.position.distanceToSquared(context.player) > 48 * 48 && resident.pendingDt < .2 && resident.activity !== 'talking') continue;
      const dt = Math.min(.25, resident.pendingDt); resident.pendingDt = 0;
      if (resident.activity === 'talking') {
        if (resident.partner) {
          const position = resident.partner.character.root.position;
          const yaw = Math.atan2(position.x - root.position.x, position.z - root.position.z);
          root.rotation.y += Math.atan2(Math.sin(yaw - root.rotation.y), Math.cos(yaw - root.rotation.y)) * (1 - Math.exp(-dt * 8));
        }
        const exchange = resident.exchange;
        if (!exchange) continue; // The other participant owns the exchange.
        if (context.quiet || root.position.distanceToSquared(context.player) > 12 * 12) {
          this.stop(resident); resident.activity = 'idle'; resident.timer = 8;
          continue;
        }
        exchange.timer -= dt;
        if (exchange.timer <= 0) {
          if (exchange.index >= exchange.scene.lines.length) {
            this.stop(resident); resident.activity = 'idle'; resident.timer = 6;
          } else {
            const speaker = exchange.index % 2 === 0 ? resident : resident.partner!;
            const ear = context.player.clone(); ear.y += 1;
            const head = speaker.character.root.position.clone(); head.y += 1;
            if (this.city.lineOfSight && !this.city.lineOfSight(head, ear)) {
              this.stop(resident); resident.activity = 'idle'; resident.timer = 6; continue;
            }
            if (exchange.index === 0) this.conversations.heard(exchange.scene, resident.id, resident.partner!.id, this.elapsed);
            const line = exchange.scene.lines[exchange.index++];
            context.say(speaker.id, line[0]);
            exchange.timer = conversationTurnSeconds(...line);
          }
        }
        continue;
      }
      if (resident.activity === 'walking') {
        while (resident.route[0] && Math.hypot(resident.route[0].x - root.position.x, resident.route[0].z - root.position.z)
          < (resident.route.length > 1 ? .18 : resident.seat ? .06 : .35)) {
          resident.route.shift(); resident.progressFor = 0; resident.progressDistance = Infinity;
        }
        const goal = resident.route[0];
        if (!goal) {
          resident.character.setGait('idle'); resident.character.setLocomotionSpeed(0);
          resident.velocity.set(0, 0, 0);
          if (resident.seat && this.hasSpace(resident, resident.seat.position)
            && !(context.playerSeated && context.player.distanceToSquared(resident.seat.position) < 2.5 * 2.5)
            && resident.character.sit(resident.seat.seatHeight - resident.seat.position.y)) {
            root.position.copy(resident.seat.position); root.rotation.y = resident.seat.yaw;
            resident.activity = 'seated'; resident.timer = 14 + resident.cycle % 4 * 4;
          } else {
            this.stop(resident); resident.activity = 'idle'; resident.timer = 3 + resident.cycle % 5;
          }
          continue;
        }
        const distance = Math.hypot(goal.x - root.position.x, goal.z - root.position.z);
        if (distance < resident.progressDistance - .12) { resident.progressDistance = distance; resident.progressFor = 0; }
        else resident.progressFor += dt;
        // Tiny sideways steps are not progress. Recover before a walker spends seconds shuffling at a corner.
        if ((resident.progressFor > 1.8 || resident.blockedFor > .75) && this.elapsed >= resident.nextReplan && this.planningBudget > 0) {
          resident.nextReplan = this.elapsed + 3;
          if (!this.plan(resident, resident.route[resident.route.length - 1], true)) {
            this.stop(resident); resident.activity = 'idle'; resident.timer = 1.5 + resident.priority % 3 * .4;
          }
          continue;
        }
        resident.retryIn -= dt;
        if (resident.retryIn > 0) { resident.blockedFor += dt; this.animateMovement(resident, 0, dt); continue; }
        const speed = .85 + resident.priority % 3 * .09;
        const neighbours: CrowdBody[] = [...externalBodies], cx = Math.floor(root.position.x / 8), cz = Math.floor(root.position.z / 8);
        const body = this.bodies.get(resident)!;
        for (let x = cx - 1; x <= cx + 1; x++) for (let z = cz - 1; z <= cz + 1; z++) {
          for (const other of this.bodyCells.get(`${x}:${z}`) ?? []) if (other !== body) neighbours.push(other);
        }
        const corrected = crowdStep(this.city, body, goal, speed, dt, neighbours, resident.blockedFor);
        const moved = Math.hypot(corrected.x - root.position.x, corrected.z - root.position.z);
        if (moved < dt * .08) {
          this.animateMovement(resident, 0, dt);
          resident.velocity.set(0, 0, 0); resident.blockedFor += dt;
          if (resident.blockedFor > .18) resident.retryIn = .25 + resident.priority % 3 * .05;
          continue;
        }
        resident.blockedFor = Math.max(0, resident.blockedFor - dt);
        resident.timer = 0;
        resident.velocity.copy(corrected).sub(root.position).divideScalar(Math.max(dt, .001));
        root.position.copy(corrected); root.position.y = this.city.groundY(corrected.x, corrected.z);
        const angle = Math.atan2(resident.velocity.x, resident.velocity.z);
        root.rotation.y += Math.atan2(Math.sin(angle - root.rotation.y), Math.cos(angle - root.rotation.y)) * Math.min(1, dt * 7);
        this.animateMovement(resident, moved / Math.max(dt, .001), dt);
        continue;
      }
      resident.timer -= dt;
      if (resident.timer > 0) continue;
      if (resident.activity === 'seated') {
        if (this.stop(resident)) { resident.activity = 'idle'; resident.timer = 2; }
        else resident.timer = 1;
        continue;
      }
      if (resident.resumeGoal) {
        if (this.planningBudget <= 0) continue;
        const goal = resident.resumeGoal; resident.resumeGoal = undefined;
        if (root.position.distanceToSquared(goal) > .5 * .5) {
          if (!this.plan(resident, goal)) resident.timer = 3;
          continue;
        }
      }
      if (this.converse(resident, context)) continue;
      if (this.planningBudget <= 0) continue;
      resident.cycle++;
      if (resident.cycle % 3 === 0 && this.rest(resident, context)) continue;
      const next = nextPatrolStop(resident.patrol, resident.destination, resident.patrolDirection);
      resident.destination = next.index; resident.patrolDirection = next.direction;
      if (!this.plan(resident, this.patrolGoal(resident))) resident.timer = 4;
    }
  }
}

/** Only configured cities receive population. Authored map markers can override their starting places. */
export function populationSites(city: City) {
  return (CITY_POPULATIONS[city.locationId]?.districts ?? []).flatMap(district => district.residents.map((id, index) => {
    const [x, z] = (district.spawns ?? district.route)[index % (district.spawns ?? district.route).length];
    return { id, position: new THREE.Vector3(x, city.groundY(x, z), z), yaw: 0 };
  }));
}
