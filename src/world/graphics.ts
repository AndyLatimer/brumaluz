import * as THREE from 'three';
import { applyLanguage, t } from '../ui/i18n';

export function reloadGraphics(compatible: boolean) {
  const url = new URL(location.href);
  if (compatible) url.searchParams.set('graphics', 'compatible');
  else url.searchParams.delete('graphics');
  location.assign(url.href);
}

export function createGraphics(canvas: HTMLCanvasElement) {
  const notice = document.getElementById('graphics-error')!;
  const message = document.getElementById('graphics-error-message')!;
  const details = document.getElementById('graphics-error-details')!;
  applyLanguage(notice);
  document.getElementById('graphics-retry')!.onclick = () => location.reload();
  document.getElementById('graphics-compatible')!.onclick = () => reloadGraphics(true);

  let failed = false;
  let renderer: THREE.WebGLRenderer | null = null;
  function fail(reason: string, error?: unknown) {
    failed = true;
    renderer?.setAnimationLoop(null);
    console.error('[Brumaluz graphics]', reason, error ?? '');
    message.textContent = t(reason);
    details.textContent = error instanceof Error ? error.message : '';
    notice.hidden = false;
    document.getElementById('loading')!.classList.add('hide');
  }

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    fail('Se ha perdido la conexión con la tarjeta gráfica. Recarga el juego o prueba el modo compatible.');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    fail('La tarjeta gráfica vuelve a responder. Recarga el juego para reconstruir el mundo.');
  });
  canvas.addEventListener('webglcontextcreationerror', (event) => {
    fail('No se pudo iniciar WebGL 2. Comprueba la aceleración gráfica de Chrome y el controlador de la tarjeta gráfica.', new Error(event instanceof WebGLContextEvent ? event.statusMessage : event.type));
  });

  const requested = new URLSearchParams(location.search).get('graphics') === 'compatible';
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !requested, powerPreference: 'high-performance' });
  } catch (error) {
    fail('No se pudo iniciar WebGL 2. Comprueba la aceleración gráfica de Chrome y el controlador de la tarjeta gráfica.', error);
    throw error;
  }
  const activeRenderer = renderer;
  const compatible = requested || !renderer.extensions.has('EXT_color_buffer_float');
  renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
    const log = [gl.getProgramInfoLog(program), gl.getShaderInfoLog(vertex), gl.getShaderInfoLog(fragment)].filter(Boolean).join('\n');
    fail('No se pudo dibujar el mundo 3D. Prueba el modo compatible.', new Error(log));
  };
  if (compatible && !requested) {
    console.warn('[Brumaluz graphics] EXT_color_buffer_float no disponible; se activa el modo compatible.');
  }
  document.getElementById('graphics-mode')!.textContent = t(compatible ? 'Gráficos: compatible' : 'Gráficos: normal');
  document.getElementById('graphics-mode')!.onclick = () => reloadGraphics(!compatible);
  console.info('[Brumaluz graphics]', { compatible, maxTextureSize: renderer.capabilities.maxTextureSize, maxSamples: renderer.capabilities.maxSamples });

  return {
    renderer: activeRenderer,
    compatible,
    fail,
    get failed() { return failed; },
    resize(width: number, height: number) {
      const budget = compatible ? 1920 * 1080 : 2560 * 1440;
      const gl = activeRenderer.getContext();
      const maxSize = Math.min(activeRenderer.capabilities.maxTextureSize, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
      const ratio = Math.min(window.devicePixelRatio, compatible ? 1 : 2, Math.sqrt(budget / (width * height)), maxSize / width, maxSize / height);
      activeRenderer.setPixelRatio(ratio);
      activeRenderer.setSize(width, height, false);
    },
  };
}
