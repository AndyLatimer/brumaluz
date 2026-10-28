import { play } from '../game/state';

interface ThumbnailJob { visible: () => boolean; render: () => void }
const queues = new Map<object, ThumbnailJob[]>();
let quietUntil = 0;
let timer: number | undefined;
let idle: number | undefined;

export function noteCreatorInteraction() { quietUntil = performance.now() + 180; }
export function cancelCreatorThumbnails(owner: object) { queues.delete(owner); }
export function queueCreatorThumbnails(owner: object, jobs: ThumbnailJob[]) {
  queues.delete(owner); if (jobs.length) queues.set(owner, jobs);
  schedule();
}
function schedule() {
  if (!queues.size || timer !== undefined || idle !== undefined) return;
  const delay = Math.max(0, quietUntil - performance.now(), play.rebuildQueued ? 24 : 0);
  if (delay > 0 || !window.requestIdleCallback) {
    timer = window.setTimeout(() => { timer = undefined; pump(); }, Math.max(24, delay));
  } else idle = window.requestIdleCallback(() => { idle = undefined; pump(); }, { timeout: 400 });
}
function pump() {
  if (performance.now() < quietUntil || play.rebuildQueued) { schedule(); return; }
  for (const [owner, jobs] of queues) {
    const job = jobs.shift();
    queues.delete(owner); if (jobs.length) queues.set(owner, jobs);
    if (!job?.visible()) continue;
    job.render(); break; // One portrait across the whole editor, then yield to input and the scene.
  }
  schedule();
}
export function inCreatorViewport(element: HTMLElement) {
  const pages = document.getElementById('pages')!;
  const viewport = pages.getBoundingClientRect(), rect = element.getBoundingClientRect();
  return rect.bottom > viewport.top && rect.top < viewport.bottom && rect.width > 0 && rect.height > 0;
}
