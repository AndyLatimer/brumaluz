// Efectos de interfaz: números flotantes y destellos.
import * as THREE from 'three';
import { holder, camera } from './stage';

export const restartClass = (el: HTMLElement, cls: string) => {
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  el.addEventListener('animationend', (e) => { if (e.target === el) el.classList.remove(cls); }, { once: true });
};
/** Número flotante que sube desde la cabeza del personaje. */
export function floatText(text: string, cls: string) {
  const anchor = new THREE.Vector3(holder.position.x, holder.position.y + 1.6, holder.position.z).project(camera);
  const float = document.createElement('div');
  float.className = `damage-float ${cls}`;
  float.textContent = text;
  float.style.transform = `translate(${((anchor.x * 0.5 + 0.5) * window.innerWidth).toFixed(0)}px, ${((-anchor.y * 0.5 + 0.5) * window.innerHeight).toFixed(0)}px) translate(-50%, -100%)`;
  document.body.appendChild(float);
  float.addEventListener('animationend', () => float.remove());
}
export const sparkBurst = (count: number, cls: string, glyph = '✦') => {
  for (let i = 0; i < count; i++) {
    const spark = document.createElement('div');
    spark.className = `heal-spark ${cls}`;
    spark.textContent = glyph;
    spark.style.left = `${50 + (Math.random() - 0.5) * 18}%`;
    spark.style.top = `${52 + (Math.random() - 0.5) * 18}%`;
    spark.style.setProperty('--dx', `${((Math.random() - 0.5) * 220).toFixed(0)}px`);
    spark.style.animationDelay = `${(Math.random() * 0.5).toFixed(2)}s`;
    document.body.appendChild(spark);
    spark.addEventListener('animationend', () => spark.remove());
  }
};
