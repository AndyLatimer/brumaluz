import * as THREE from 'three';
import { t } from '../ui/i18n';

/** Encuadre de cámara: dónde está y a qué mira. */
export interface CinematicFrame { position: THREE.Vector3; target: THREE.Vector3 }

/** Un plano de una cinemática. */
export interface CinematicShot {
  /** Identificador del plano para inspeccionar la secuencia durante el desarrollo. */
  id?: string;
  /** Duración máxima, en segundos. */
  duration: number;
  /** El plano no termina antes de este tiempo aunque `update` diga que ya está. */
  minimum?: number;
  /** Subtítulo (en español; se traduce al mostrarlo). Sin `speaker`, es un rótulo. */
  line?: { speaker?: string; text: string; eyebrow?: string; detail?: string; layout?: 'title' | 'caption' };
  start?(): void;
  /** Cámara según el avance `k` (0→1, ya suavizado). Sin ella manda la cámara de conversación. */
  camera?(k: number, elapsed: number): CinematicFrame;
  /** Segundos de fundido desde la cámara del plano anterior (0: corte). */
  blend?: number;
  /** Se llama en cada fotograma; si devuelve true (y pasó `minimum`), el plano termina. */
  update?(dt: number, elapsed: number): boolean | void;
}

const smooth = (k: number) => k * k * (3 - 2 * k);

/** Vuelo en círculo alrededor de `center`, mirando a su centro. */
export function orbitShot(center: THREE.Vector3, radius: [number, number], height: [number, number], angle: [number, number], lookHeight = 0) {
  return (k: number): CinematicFrame => {
    const a = THREE.MathUtils.lerp(angle[0], angle[1], k), r = THREE.MathUtils.lerp(radius[0], radius[1], k);
    return {
      position: new THREE.Vector3(center.x + Math.sin(a) * r, center.y + THREE.MathUtils.lerp(height[0], height[1], k), center.z + Math.cos(a) * r),
      target: center.clone().setY(center.y + lookHeight),
    };
  };
}

/** Travelín en línea recta de un encuadre a otro. */
export function dollyShot(from: CinematicFrame, to: CinematicFrame) {
  return (k: number): CinematicFrame => ({
    position: from.position.clone().lerp(to.position, k),
    target: from.target.clone().lerp(to.target, k),
  });
}

/**
 * Cinemáticas de la historia: encadena planos con bandas negras, subtítulos y un botón para saltarlas.
 * Quien la usa coloca la cámara con `frame()` y decide qué pasa al terminar (o al saltarla).
 */
export function createCinematics() {
  const root = document.createElement('div');
  root.id = 'cinematic';
  root.hidden = true;
  root.innerHTML = '<div class="cinematic-bar top"></div><div class="cinematic-bar bottom"></div>'
    + '<p class="cinematic-line" role="status" aria-live="polite" aria-atomic="true"><small></small><strong></strong><span></span><em></em></p>'
    + '<button type="button" class="cinematic-skip"></button>';
  document.body.append(root);
  const line = root.querySelector<HTMLElement>('.cinematic-line')!;
  const skipButton = root.querySelector<HTMLButtonElement>('.cinematic-skip')!;
  let shots: CinematicShot[] = [];
  let index = -1, elapsed = 0;
  let finish: ((skipped: boolean) => void) | null = null;
  let current: CinematicFrame | null = null;
  let from: CinematicFrame | null = null;
  let onLine: ((speaker: string | undefined, text: string) => void) | null = null;
  const focus = new THREE.Vector3();

  function begin(i: number) {
    index = i; elapsed = 0;
    const shot = shots[i];
    root.dataset.shot = shot.id ?? String(i);
    from = current ? { position: current.position.clone(), target: current.target.clone() } : null;
    shot.start?.();
    if (shot.camera) focus.copy(shot.camera(0, 0).target);
    if (shot.line) {
      line.classList.toggle('title', !shot.line.speaker && shot.line.layout !== 'caption');
      line.querySelector('strong')!.textContent = shot.line.speaker ?? '';
      line.querySelector('span')!.textContent = t(shot.line.text);
      line.querySelector('small')!.textContent = t(shot.line.eyebrow ?? '');
      line.querySelector('em')!.textContent = t(shot.line.detail ?? '');
      line.hidden = false;
      // Reinicia la animación de entrada del subtítulo.
      line.classList.remove('show'); void line.offsetWidth; line.classList.add('show');
      onLine?.(shot.line.speaker, shot.line.text);
    } else line.hidden = true;
  }
  function end(skipped: boolean, notify = true) {
    const done = finish;
    shots = []; index = -1; finish = null; current = null; from = null;
    delete root.dataset.shot;
    root.hidden = true;
    document.body.classList.remove('cinematic-open');
    if (notify) done?.(skipped);
  }
  skipButton.addEventListener('click', () => skip());
  function skip() { if (finish) end(true); }

  return {
    get active() { return !!finish; },
    get scriptedCamera() { return !!shots[index]?.camera; },
    /** Punto que mira la cámara (para decidir qué parte del mapa se dibuja). */
    focus,
    /** Recibe cada subtítulo con hablante (para el chat). */
    onLine(fn: typeof onLine) { onLine = fn; },
    play(list: CinematicShot[], onEnd: (skipped: boolean) => void) {
      if (finish) end(true, false);
      if (!list.length) { onEnd(false); return; }
      shots = list; finish = onEnd; current = null;
      skipButton.textContent = t('Saltar escena');
      skipButton.setAttribute('aria-label', t('Saltar escena (Esc)'));
      root.hidden = false;
      document.body.classList.add('cinematic-open');
      begin(0);
    },
    skip,
    /** Cancela al salir, morir o cambiar de mapa; no dispara la siguiente escena. */
    cancel() { if (finish) end(true, false); },
    /** Avanza la escena; devuelve el encuadre de este fotograma o null si manda otra cámara. */
    frame(dt: number): CinematicFrame | null {
      if (!finish || index < 0) return null;
      const shot = shots[index];
      elapsed += dt;
      const done = shot.update?.(dt, elapsed) === true;
      let frame: CinematicFrame | null = null;
      if (shot.camera) {
        frame = shot.camera(smooth(Math.min(1, elapsed / shot.duration)), elapsed);
        if (from && shot.blend) {
          const k = smooth(Math.min(1, elapsed / shot.blend));
          frame = { position: from.position.clone().lerp(frame.position, k), target: from.target.clone().lerp(frame.target, k) };
        }
        current = frame;
        focus.copy(frame.target);
      } else current = null;
      if (elapsed >= shot.duration || (done && elapsed >= (shot.minimum ?? 0))) {
        if (index + 1 < shots.length) begin(index + 1); else end(false);
      }
      return frame;
    },
  };
}
