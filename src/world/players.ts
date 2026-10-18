import * as THREE from 'three';
import { Character } from '../character/character';
import { TITLES, isReservedTitle, PHOENIX_ICON } from '../data/titles';
import { t } from '../ui/i18n';
import type { WorldPlayer } from '../services/multiplayer';
import { castShadows } from './render';

interface Actor {
  player: WorldPlayer;
  character: Character;
  appearance: string;
  plate: HTMLElement;
  bubble: HTMLElement;
  speakingUntil: number;
  anchor: THREE.Vector3;
  from: THREE.Vector3;
  target: THREE.Vector3;
  receivedAt: number;
  duration: number;
}

export class RemotePlayers {
  private actors = new Map<string, Actor>();
  constructor(private scene: THREE.Scene, private groundY: (x: number, z: number) => number) {}

  receive(players: WorldPlayer[]) {
    const ids = new Set(players.map((p) => p.id));
    for (const [id, actor] of this.actors) {
      if (!ids.has(id)) { this.remove(actor); this.actors.delete(id); }
    }
    const now = performance.now();
    for (const player of players) {
      const appearance = JSON.stringify(player.data);
      let actor = this.actors.get(player.id);
      if (actor && actor.appearance !== appearance) {
        this.remove(actor);
        this.actors.delete(player.id);
        actor = undefined;
      }
      const target = new THREE.Vector3(player.position.x, this.groundY(player.position.x, player.position.z) + player.jump, player.position.z);
      if (!actor) {
        const character = new Character(player.data, { outfit: false });
        character.root.position.copy(target);
        character.root.rotation.y = player.facing;
        castShadows(character.root);
        this.scene.add(character.root);
        const plate = document.createElement('div');
        plate.className = 'nameplate player';
        plate.dataset.playerId = player.id;
        plate.hidden = true;
        plate.setAttribute('aria-hidden', 'true');
        const name = document.createElement('strong');
        name.textContent = player.data.name;
        const title = document.createElement('span');
        title.hidden = player.data.title === 'none';
        if (isReservedTitle(player.data.title)) { title.classList.add('staff-title'); title.innerHTML = PHOENIX_ICON; }
        title.append(t(TITLES[player.data.title].label));
        plate.append(name, title);
        const bubble = document.createElement('div');
        bubble.className = 'speech-bubble';
        bubble.hidden = true;
        bubble.setAttribute('aria-hidden', 'true');
        bubble.append(document.createElement('b'), document.createElement('span'));
        document.body.append(plate, bubble);
        actor = { player, character, appearance, plate, bubble, speakingUntil: 0, anchor: new THREE.Vector3(), from: target.clone(), target, receivedAt: now, duration: 250 };
        this.actors.set(player.id, actor);
      } else {
        const seconds = Math.max((now - actor.receivedAt) / 1000, 0.01);
        const speed = Math.hypot(target.x - actor.target.x, target.z - actor.target.z) / seconds;
        actor.character.setGait(player.dead || speed < 0.35 ? 'idle' : speed > 4 ? 'run' : 'walk');
        if (player.wave !== actor.player.wave) actor.character.wave();
        if (player.jump > 0 && actor.player.jump === 0) actor.character.jump();
        actor.from.copy(actor.character.root.position);
        if (actor.from.distanceTo(target) > 15) actor.from.copy(target);
        actor.target.copy(target);
        actor.duration = Math.min(500, Math.max(150, now - actor.receivedAt));
        actor.receivedAt = now;
        actor.player = player;
      }
      if (player.dead) actor.character.die(); else actor.character.revive();
    }
  }

  update(time: number, dt: number, camera: THREE.Camera, nameplates: boolean) {
    const now = performance.now();
    camera.updateMatrixWorld();
    for (const actor of this.actors.values()) {
      const root = actor.character.root;
      root.position.lerpVectors(actor.from, actor.target, Math.min(1, (now - actor.receivedAt) / actor.duration));
      const angle = actor.player.facing - root.rotation.y;
      root.rotation.y += Math.atan2(Math.sin(angle), Math.cos(angle)) * (1 - Math.exp(-dt * 12));
      actor.character.update(time);
      actor.anchor.copy(root.position);
      actor.anchor.y += 1.95 + (actor.player.data.height - 0.5) * 0.3;
      actor.anchor.project(camera);
      const inView = actor.anchor.z > -1 && actor.anchor.z < 1 && Math.abs(actor.anchor.x) < 1.2 && Math.abs(actor.anchor.y) < 1.2;
      const x = (actor.anchor.x * 0.5 + 0.5) * innerWidth;
      const y = (-actor.anchor.y * 0.5 + 0.5) * innerHeight;
      actor.plate.hidden = !inView || !nameplates;
      actor.plate.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      actor.bubble.hidden = !inView || now > actor.speakingUntil || actor.player.dead;
      actor.bubble.style.transform = `translate(${x}px, ${y - (nameplates ? actor.plate.offsetHeight + 8 : 6)}px) translate(-50%, -100%)`;
    }
  }

  say(userId: string, name: string, text: string) {
    const actor = [...this.actors.values()].find((value) => value.player.userId === userId && value.player.data.name === name);
    if (!actor) return;
    const seconds = Math.min(8, 2.5 + text.length * 0.06);
    actor.character.speak(seconds);
    actor.bubble.querySelector('b')!.textContent = name;
    actor.bubble.querySelector('span')!.textContent = text;
    actor.speakingUntil = performance.now() + seconds * 1000;
  }

  refreshLanguage() {
    for (const actor of this.actors.values()) {
      const title = actor.plate.querySelector('span')!;
      title.replaceChildren();
      if (isReservedTitle(actor.player.data.title)) title.innerHTML = PHOENIX_ICON;
      title.append(t(TITLES[actor.player.data.title].label));
    }
  }

  list() {
    return [...this.actors.values()].map((actor) => ({
      id: actor.player.id, userId: actor.player.userId, name: actor.player.data.name, root: actor.character.root,
    }));
  }

  clear() {
    for (const actor of this.actors.values()) this.remove(actor);
    this.actors.clear();
  }
  private remove(actor: Actor) {
    this.scene.remove(actor.character.root);
    actor.character.dispose();
    actor.plate.remove();
    actor.bubble.remove();
  }
}
