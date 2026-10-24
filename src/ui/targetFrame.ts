import * as THREE from 'three';
import { CLASSES, type ClassId } from '../data/data';
import type { PublicVitals } from '../services/multiplayer';
import { classIcon } from './classIcons';
import { t } from './i18n';
import { TITLES, isReservedTitle, PHOENIX_ICON, type TitleId } from '../data/titles';
import { renderNpcBadge } from './npcBadges';
import type { NpcType } from '../data/npcBadges';

export type { NpcType } from '../data/npcBadges';
export const TARGET_RANGE = 10;
export interface TargetDetails {
  cast?:{label:string;remaining:number;duration:number};
  id: string;
  root: THREE.Object3D;
  name: string;
  level: number;
  height: number;
  scale?: number;
  widthScale?: number;
  vitals: PublicVitals;
  identity: { kind: 'player'; username: string | null; cls: ClassId; title: TitleId } | { kind: 'npc'; type: NpcType; title: string; badgeIcon?: string };
}

export function createTargetFrame(canvas: HTMLCanvasElement, camera: THREE.Camera, scenery: THREE.Object3D | (() => THREE.Object3D)) {
  const panel = document.createElement('section');
  panel.id = 'target-frame';
  panel.hidden = true;
  panel.setAttribute('aria-label', t('Detalle del objetivo'));
  panel.innerHTML = '<div class="target-emblem"></div><div class="target-info"><div class="target-heading"><strong class="target-name"></strong><span class="target-level"></span></div><div class="target-identity"><span class="target-kind"></span><span class="target-username"></span></div><div class="target-health target-meter"><i></i><span></span></div><div class="target-resource target-meter"><i></i><span></span></div></div>';
  document.body.append(panel);
  const emblem = panel.querySelector<HTMLElement>('.target-emblem')!;
  emblem.setAttribute('role', 'img');
  const name = panel.querySelector<HTMLElement>('.target-name')!;
  const level = panel.querySelector<HTMLElement>('.target-level')!;
  const kind = panel.querySelector<HTMLElement>('.target-kind')!;
  const username = panel.querySelector<HTMLElement>('.target-username')!;
  const health = panel.querySelector<HTMLElement>('.target-health')!;
  const resource = panel.querySelector<HTMLElement>('.target-resource')!;
  const ray = new THREE.Raycaster();
  // set() does not assign a camera. World decorations can contain Sprites,
  // whose raycast requires it even when they are far from the target.
  ray.camera = camera;
  const pointer = new THREE.Vector2();
  const direction = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const anchor = new THREE.Vector3();
  const head = new THREE.Vector3();
  const feet = new THREE.Vector3();
  const side = new THREE.Vector3();
  const segment = new THREE.Vector2();
  const relative = new THREE.Vector2();
  let overCanvas = false;
  let nextCheck = 0;
  let signature = '';
  let selectedId: string | null = null;
  let current: TargetDetails | null = null;
  window.addEventListener('pointermove', (event) => {
    overCanvas = event.target === canvas && event.pointerType !== 'touch';
    if (!overCanvas) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set(event.clientX - rect.left, event.clientY - rect.top);
  });
  canvas.addEventListener('pointerleave', () => { overCanvas = false; });
  window.addEventListener('blur', () => { overCanvas = false; panel.hidden = true; });

  function visible(target: TargetDetails) {
    // Test stable body anchors, not animated meshes or small gaps between limbs.
    const height = 1.8 * (0.84 + target.height * 0.32) * (target.scale ?? 1);
    for (const fraction of [0.55, 0.9]) {
      anchor.copy(target.root.position);
      anchor.y += height * fraction;
      direction.subVectors(anchor, camera.position);
      const distance = direction.length();
      ray.set(camera.position, direction.normalize());
      ray.far = Math.max(0, distance - 0.1);
      if (!ray.intersectObject(typeof scenery === 'function' ? scenery() : scenery, true).length) return true;
    }
    return false;
  }
  function pick(candidates: TargetDetails[], origin: THREE.Vector3) {
    const rect = canvas.getBoundingClientRect();
    camera.getWorldDirection(aim);
    aim.y = 0;
    aim.normalize();
    let hovered: TargetDetails | null = null, hoverScore = Infinity;
    let aimed: TargetDetails | null = null, aimScore = Infinity;
    let previous: { target: TargetDetails; score: number } | null = null;
    for (const target of candidates) {
      const height = 1.8 * (0.84 + target.height * 0.32) * (target.scale ?? 1);
      feet.copy(target.root.position);
      feet.y += 0.12;
      head.copy(target.root.position);
      head.y += height;
      feet.project(camera);
      head.project(camera);
      if (feet.z <= -1 || feet.z >= 1 || head.z <= -1 || head.z >= 1
        || Math.max(head.y, feet.y) < -1 || Math.min(head.y, feet.y) > 1
        || Math.abs(head.x) > 1.1) continue;
      feet.set((feet.x + 1) * rect.width / 2, (1 - feet.y) * rect.height / 2, 0);
      head.set((head.x + 1) * rect.width / 2, (1 - head.y) * rect.height / 2, 0);
      segment.set(head.x - feet.x, head.y - feet.y);
      relative.set(pointer.x - feet.x, pointer.y - feet.y);
      const along = THREE.MathUtils.clamp(relative.dot(segment) / Math.max(segment.lengthSq(), 1), 0, 1);
      const pixelDistance = relative.addScaledVector(segment, -along).length();
      side.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(0.34 * (target.widthScale ?? 1)).add(target.root.position);
      side.y += height / 2;
      side.project(camera);
      const radius = Math.abs((side.x + 1) * rect.width / 2 - (feet.x + head.x) / 2) + 8;
      const hover = overCanvas && pixelDistance <= radius;
      direction.subVectors(target.root.position, origin);
      direction.y = 0;
      const distance = direction.length();
      const angle = distance > 0.1 ? Math.acos(THREE.MathUtils.clamp(direction.normalize().dot(aim), -1, 1)) : Math.PI;
      const inCone = angle <= THREE.MathUtils.degToRad(target.id === selectedId ? 14 : 10);
      if ((!hover && !inCone) || !visible(target)) continue;
      if (hover && pixelDistance / radius < hoverScore) { hovered = target; hoverScore = pixelDistance / radius; }
      if (inCone) {
        const score = angle + distance * 0.001;
        if (score < aimScore) { aimed = target; aimScore = score; }
        if (target.id === selectedId) previous = { target, score };
      }
    }
    return hovered ?? (previous && previous.score <= aimScore + THREE.MathUtils.degToRad(2) ? previous.target : aimed);
  }
  function meter(element: HTMLElement, label: string, value: number, max: number, extra = 0) {
    element.setAttribute('role', 'meter');
    element.setAttribute('aria-label', label);
    element.setAttribute('aria-valuemin', '0');
    element.setAttribute('aria-valuemax', String(max));
    element.setAttribute('aria-valuenow', String(value));
    element.querySelector<HTMLElement>('i')!.style.width = `${value / max * 100}%`;
    const text = `${Math.ceil(value)} / ${Math.ceil(max)}${extra ? ` (+${Math.ceil(extra)})` : ''}`;
    element.querySelector('span')!.textContent = text;
    element.setAttribute('aria-valuetext', `${label} ${text}`);
  }
  return {
    current: () => panel.hidden ? null : current,
    update(targets: TargetDetails[], enabled: boolean, origin: THREE.Vector3, lockedId: string | null = null) {
      if (!enabled) { panel.hidden = true; nextCheck = 0; selectedId = null; current = null; return; }
      const now = performance.now();
      if (now < nextCheck) return;
      nextCheck = now + 100;
      const candidates = targets.filter((target) => target.root.position.distanceToSquared(origin) <= TARGET_RANGE * TARGET_RANGE);
      camera.updateMatrixWorld();
      const target = targets.find(candidate => candidate.id === lockedId) ?? pick(candidates, origin);
      current = target;
      selectedId = target?.id ?? null;
      panel.classList.toggle('locked', !!target && target.id === lockedId);
      panel.setAttribute('data-locked', String(!!target && target.id === lockedId));
      panel.hidden = !target;
      if (!target) return;
      const key = JSON.stringify([target.id, target.name, target.level, target.identity, target.vitals, target.cast, t('Nivel {n}')]);
      if (key === signature) return;
      signature = key;
      const npc = target.identity.kind === 'npc';
      const hostile=npc&&target.identity.kind==='npc'&&target.identity.type==='hostile';
      panel.classList.toggle('npc', npc&&!hostile);
      panel.classList.toggle('hostile',hostile);
      panel.dataset.targetId = target.id;
      panel.setAttribute('aria-label', t('Detalle del objetivo'));
      name.textContent = target.name;
      level.textContent = t('Nivel {n}', { n: target.level });
      if (target.identity.kind === 'player') {
        delete emblem.dataset.badgeIcon;
        delete emblem.dataset.badgeStatus;
        emblem.innerHTML = classIcon(target.identity.cls, 'target-frame');
        emblem.setAttribute('aria-label', t(CLASSES[target.identity.cls].label));
        emblem.title = t(CLASSES[target.identity.cls].label);
        kind.replaceChildren();
        kind.hidden = target.identity.title === 'none';
        kind.classList.toggle('staff-title', isReservedTitle(target.identity.title));
        if (isReservedTitle(target.identity.title)) kind.innerHTML = PHOENIX_ICON;
        if (!kind.hidden) kind.append(t(TITLES[target.identity.title].label));
        username.textContent = target.identity.username ? `~${target.identity.username}` : '';
      } else {
        renderNpcBadge(emblem, target.identity.type, t(target.identity.title), target.identity.badgeIcon);
        kind.hidden = false;
        kind.classList.remove('staff-title');
        kind.textContent = t(target.identity.title);
        username.textContent = '';
      }
      username.hidden = !username.textContent;
      const v = target.vitals;
      resource.hidden=hostile&&!target.cast;resource.classList.toggle('enemy-cast',!!target.cast);
      meter(health, t('Vida'), v.health, v.maxHealth, v.overheal);
      resource.classList.toggle('stamina', v.resourceKind === 'stamina');
      meter(resource, t(v.resourceKind === 'mana' ? 'Maná' : 'Estamina'), v.resource, v.maxResource);
      if(target.cast){meter(resource,target.cast.label,Math.max(0,target.cast.duration-target.cast.remaining),target.cast.duration);resource.querySelector('span')!.textContent=`${target.cast.label} · ${Math.max(0,target.cast.remaining).toFixed(1)} s`;}
    },
  };
}
