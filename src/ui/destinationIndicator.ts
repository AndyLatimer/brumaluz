import * as THREE from 'three';

export function createDestinationIndicator(id: string, kind: 'quest' | 'waypoint') {
  const element = document.createElement('div');
  element.id = id;
  element.className = `destination-indicator destination-${kind}`;
  element.hidden = true;
  const direction = document.createElement('span');
  direction.className = 'quest-direction-arrow';
  direction.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 16-8-4-8 4Z"/></svg>';
  const symbol = document.createElement('span');
  symbol.className = 'quest-marker-symbol';
  symbol.textContent = kind === 'quest' ? '!' : '\u2691';
  symbol.setAttribute('aria-hidden', 'true');
  const distance = document.createElement('span');
  distance.className = 'quest-marker-distance';
  element.append(direction, symbol, distance);
  document.body.append(element);
  const anchor = new THREE.Vector3(), view = new THREE.Vector3();
  return {
    element,
    hide() { element.hidden = true; },
    update(target: { x: number; y: number; z: number }, player: { x: number; z: number }, camera: THREE.PerspectiveCamera) {
      camera.updateMatrixWorld();
      anchor.set(target.x, target.y, target.z).project(camera);
      const screenX = (anchor.x * .5 + .5) * innerWidth, screenY = (-anchor.y * .5 + .5) * innerHeight;
      const marginX = Math.min(64, innerWidth / 4), marginY = Math.min(kind === 'waypoint' ? 140 : 100, innerHeight / 3);
      const onScreen = anchor.z > -1 && anchor.z < 1 && screenX >= marginX && screenX <= innerWidth - marginX && screenY >= marginY && screenY <= innerHeight - marginY;
      element.hidden = false;
      element.classList.toggle('offscreen', !onScreen);
      symbol.hidden = !onScreen;
      direction.hidden = onScreen;
      distance.textContent = `${Math.round(Math.hypot(target.x - player.x, target.z - player.z))} m`;
      if (onScreen) {
        element.style.transform = `translate(${screenX}px, ${screenY}px) translate(-50%,-100%)`;
        return;
      }
      view.set(target.x, target.y, target.z).applyMatrix4(camera.matrixWorldInverse);
      let dx = view.x * camera.projectionMatrix.elements[0], dy = -view.y * camera.projectionMatrix.elements[5];
      // A point behind the camera must indicate its real side, not its mirrored projection.
      if (view.z >= 0) dy = Math.max(Math.abs(dy), .5);
      if (Math.abs(dx) + Math.abs(dy) < .0001) { dx = 0; dy = 1; }
      dx *= innerWidth; dy *= innerHeight;
      const halfW = innerWidth / 2 - marginX, halfH = innerHeight / 2 - marginY;
      const scale = 1 / Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH);
      direction.style.transform = `rotate(${Math.atan2(dy, dx) + Math.PI / 2}rad)`;
      element.style.transform = `translate(${innerWidth / 2 + dx * scale}px, ${innerHeight / 2 + dy * scale}px) translate(-50%,-50%)`;
    },
  };
}
