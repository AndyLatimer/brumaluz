import { play, view } from '../game/state';
import { characterContext, rebuildNow } from '../game/avatar';
import { holder, layout } from '../game/stage';

/** Keep the creator visible until the saved character finishes its celebration. */
export async function celebrateCreatedCharacter() {
  const stillCurrent = characterContext();
  const controls = ['panel', 'tools', 'bottom'].map(id => document.getElementById(id)!);
  const previousInert = controls.map(control => control.inert);
  const previousView = { focus: view.focus, zoom: view.zoom };
  const inspiration = document.getElementById('creator-inspiration') as HTMLDetailsElement | null;
  if (inspiration) inspiration.open = false;
  play.creatorWalkPreview = false;
  view.focus = 'body'; view.zoom = 1; view.spinVel = 0;
  controls.forEach(control => { control.inert = true; });
  document.body.classList.add('creator-celebrating'); layout();
  let completed = false;
  let observer: MutationObserver | undefined;
  try {
    // Flush a pending appearance rebuild before binding to this character's clip.
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    if (!stillCurrent() || document.body.matches('.auth-visible, .characters-visible') || play.mode !== 'create') return false;
    rebuildNow();
    const actor = play.char;
    holder.rotation.y = play.city.spawnYaw;
    actor.setGait('idle'); actor.setLocomotionSpeed(0);
    observer = new MutationObserver(() => {
      if (!stillCurrent() || document.body.matches('.auth-visible, .characters-visible') || play.mode !== 'create') actor.stopGesture();
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    completed = await actor.celebrate();
    return completed && stillCurrent() && play.mode === 'create' && !document.body.matches('.auth-visible, .characters-visible');
  } finally {
    observer?.disconnect();
    document.body.classList.remove('creator-celebrating');
    controls.forEach((control, index) => { control.inert = previousInert[index]; });
    if (!completed && stillCurrent()) { view.focus = previousView.focus; view.zoom = previousView.zoom; }
    layout();
  }
}
