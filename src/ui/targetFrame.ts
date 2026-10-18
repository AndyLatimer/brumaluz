import * as THREE from 'three';
import { CLASSES, type ClassId } from '../data/data';
import type { PublicVitals } from '../services/multiplayer';
import { classIcon } from './classIcons';
import { t } from './i18n';

const NPC_TYPES = {
  debug: { label: 'Depuración', drawing: '<path d="m8 3 2 3m6-3-2 3M8 9h8v7a4 4 0 0 1-8 0Zm0 3H4m16 0h-4M8 16H3m18 0h-5M8 19l-3 3m11-3 3 3M12 10v10M9 9V8a3 3 0 0 1 6 0v1"/>' },
  merchant: { label: 'Comerciante', drawing: '<path d="M3 10h18l-2-7H5zM5 10v11h14V10M9 21v-7h6v7M3 10c0 4 5 4 5 0 0 4 8 4 8 0 0 4 5 4 5 0"/>' },
  resident: { label: 'Habitante', drawing: '<path d="m3 11 9-8 9 8M5 9v12h14V9M9 21v-7h6v7"/>' },
} as const;

export type NpcType = keyof typeof NPC_TYPES;
export interface TargetDetails {
  id: string;
  root: THREE.Object3D;
  name: string;
  level: number;
  vitals: PublicVitals;
  identity: { kind: 'player'; username: string | null; cls: ClassId } | { kind: 'npc'; type: NpcType };
}

export function createTargetFrame(canvas: HTMLCanvasElement, camera: THREE.Camera, scenery: THREE.Object3D) {
  const panel = document.createElement('section');
  panel.id = 'target-frame';
  panel.hidden = true;
  panel.setAttribute('aria-label', t('Detalle del objetivo'));
  panel.innerHTML = '<div class="target-emblem"></div><div class="target-info"><div class="target-heading"><strong class="target-name"></strong><span class="target-level"></span></div><div class="target-identity"><span class="target-kind"></span><span class="target-username"></span></div><div class="target-health target-meter"><i></i><span></span></div><div class="target-resource target-meter"><i></i><span></span></div></div>';
  document.body.append(panel);
  const emblem = panel.querySelector<HTMLElement>('.target-emblem')!;
  const name = panel.querySelector<HTMLElement>('.target-name')!;
  const level = panel.querySelector<HTMLElement>('.target-level')!;
  const kind = panel.querySelector<HTMLElement>('.target-kind')!;
  const username = panel.querySelector<HTMLElement>('.target-username')!;
  const health = panel.querySelector<HTMLElement>('.target-health')!;
  const resource = panel.querySelector<HTMLElement>('.target-resource')!;
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const center = new THREE.Vector2();
  let overCanvas = false;
  let nextCheck = 0;
  let signature = '';
  window.addEventListener('pointermove', (event) => {
    overCanvas = event.target === canvas && event.pointerType !== 'touch';
    if (!overCanvas) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
  });
  canvas.addEventListener('pointerleave', () => { overCanvas = false; });
  window.addEventListener('blur', () => { overCanvas = false; panel.hidden = true; });

  function pick(point: THREE.Vector2, candidates: TargetDetails[]) {
    ray.setFromCamera(point, camera);
    ray.far = 80;
    const hit = ray.intersectObjects(candidates.map((target) => target.root), true)[0];
    if (!hit) return null;
    ray.far = Math.max(0, hit.distance - 0.05);
    if (ray.intersectObject(scenery, true).length) return null;
    let object: THREE.Object3D | null = hit.object;
    while (object) {
      const target = candidates.find((candidate) => candidate.root === object);
      if (target) return target;
      object = object.parent;
    }
    return null;
  }
  function meter(element: HTMLElement, label: string, value: number, max: number, extra = 0) {
    element.setAttribute('role', 'meter');
    element.setAttribute('aria-label', label);
    element.setAttribute('aria-valuemin', '0');
    element.setAttribute('aria-valuemax', String(max));
    element.setAttribute('aria-valuenow', String(value));
    element.querySelector<HTMLElement>('i')!.style.width = `${value / max * 100}%`;
    const text = `${label} ${value} / ${max}${extra ? ` (+${extra})` : ''}`;
    element.querySelector('span')!.textContent = text;
    element.setAttribute('aria-valuetext', text);
  }
  return {
    update(targets: TargetDetails[], enabled: boolean, origin: THREE.Vector3) {
      if (!enabled) { panel.hidden = true; nextCheck = 0; return; }
      const now = performance.now();
      if (now < nextCheck) return;
      nextCheck = now + 100;
      const candidates = targets.filter((target) => target.root.position.distanceToSquared(origin) <= 45 * 45);
      camera.updateMatrixWorld();
      for (const target of candidates) target.root.updateWorldMatrix(true, true);
      const target = (overCanvas ? pick(pointer, candidates) : null) ?? pick(center, candidates);
      panel.hidden = !target;
      if (!target) return;
      const key = JSON.stringify([target.id, target.name, target.level, target.identity, target.vitals, t('Nivel {n}')]);
      if (key === signature) return;
      signature = key;
      const npc = target.identity.kind === 'npc';
      panel.classList.toggle('npc', npc);
      panel.dataset.targetId = target.id;
      panel.setAttribute('aria-label', t('Detalle del objetivo'));
      name.textContent = target.name;
      level.textContent = t('Nivel {n}', { n: target.level });
      if (target.identity.kind === 'player') {
        emblem.innerHTML = classIcon(target.identity.cls, 'target-frame');
        kind.textContent = t(CLASSES[target.identity.cls].label);
        username.textContent = target.identity.username ? `~${target.identity.username}` : '';
      } else {
        const type = NPC_TYPES[target.identity.type];
        emblem.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${type.drawing}</svg>`;
        kind.textContent = t(type.label);
        username.textContent = t('Personaje no jugador');
      }
      const v = target.vitals;
      meter(health, t('Vida'), v.health, v.maxHealth, v.overheal);
      resource.classList.toggle('stamina', v.resourceKind === 'stamina');
      meter(resource, t(v.resourceKind === 'mana' ? 'Maná' : 'Estamina'), v.resource, v.maxResource);
    },
  };
}
