import type * as THREE from 'three';
import type { PopulationExchange } from '../data/cityPopulation';

interface Participant { id: string; position: THREE.Vector3 }

/** Authored scenes are eligible by place and recent history, independently of the walking cycle. */
export class PopulationConversations {
  private scenes = new Map<string, number>();
  private participants = new Map<string, number>();

  choose(exchanges: readonly PopulationExchange[], first: Participant, second: Participant, now: number) {
    if ([first, second].some(person => now - (this.participants.get(person.id) ?? -Infinity) < 90)) return undefined;
    let chosen: PopulationExchange | undefined, oldest = Infinity;
    for (const exchange of exchanges) {
      const heard = this.scenes.get(exchange.id) ?? -Infinity;
      if (exchange.lines.length < 2 || now - heard < 180) continue;
      if (exchange.near && [first, second].some(person =>
        Math.hypot(person.position.x - exchange.near!.position[0], person.position.z - exchange.near!.position[1]) > exchange.near!.radius)) continue;
      if (!chosen || heard < oldest) { chosen = exchange; oldest = heard; }
    }
    return chosen;
  }

  heard(exchange: PopulationExchange, first: string, second: string, now: number) {
    this.scenes.set(exchange.id, now); this.participants.set(first, now); this.participants.set(second, now);
  }

  dispose() { this.scenes.clear(); this.participants.clear(); }
}
