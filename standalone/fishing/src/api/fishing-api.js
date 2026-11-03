/**
 * @file fishing-api.js
 * Fachada pública y contrato de integración del minijuego de pesca de Brumaluz.
 * Diseñado específicamente para que otra IA o desarrollador pueda instanciar,
 * configurar, escuchar eventos y destruir el minijuego de forma limpia y aislada.
 */

import { FishingEngine } from '../core/engine.js';
import { CanvasWaterRenderer } from '../render/canvas-water.js';
import { MinigameView } from '../render/minigame-view.js';
import { UIManager } from '../render/ui-manager.js';
import { FishingSoundSynthesizer } from '../audio/sound-synthesizer.js';
import { DebugPanel } from '../dev/debug-panel.js';

export class FishingMinigameController {
  /**
   * @param {HTMLElement} hostElement
   * @param {import('../types').FishingSessionConfig} [initialConfig]
   * @param {object} [options]
   * @param {boolean} [options.enableDebugPanel=true]
   */
  constructor(hostElement, initialConfig = {}, options = {}) {
    this.host = hostElement;
    this.options = {
      enableDebugPanel: options.enableDebugPanel ?? true
    };

    this.listeners = new Map();
    this.isRunning = false;
    this.animationFrameId = null;
    this.lastTime = performance.now();

    // 1. Construir estructura base en el host
    this._mountDOM();

    // 2. Inicializar subsistemas
    this.sound = new FishingSoundSynthesizer();
    this.engine = new FishingEngine({
      ...initialConfig,
      onPhaseChange: (phase) => this._emit('phaseChange', phase),
      onProgressUpdate: (prog, tension) => this._emit('progress', { progress: prog, tension }),
      onBite: () => this._emit('bite', null),
      onComplete: (result) => {
        if (result.success) this._emit('catch', result);
        else this._emit('escape', result);
        this._emit('complete', result);
      },
      onCancel: () => this._emit('cancel', null)
    });

    this.waterRenderer = new CanvasWaterRenderer(this.waterCanvas);
    this.minigameView = new MinigameView(this.reelingCanvas);
    this.uiManager = new UIManager(this.uiOverlay, this.engine, this.sound);

    if (this.options.enableDebugPanel) {
      this.debugPanel = new DebugPanel(this.host, this.engine);
    }

    // Conectar eventos internos de audio y vista
    this._bindInternalEvents();

    // Arrancar bucle de animación
    this.startLoop();
  }

  _mountDOM() {
    this.host.classList.add('brumaluz-fishing-container');
    this.host.innerHTML = `
      <div class="fishing-stage-wrapper">
        <!-- Lienzo de fondo de agua escénica -->
        <canvas class="fishing-water-canvas"></canvas>
        <!-- Lienzo de combate de captura (Fase D) -->
        <canvas class="fishing-reeling-canvas"></canvas>
        <!-- Capa de interfaz de usuario DOM -->
        <div class="fishing-ui-layer"></div>
      </div>
    `;

    this.waterCanvas = this.host.querySelector('.fishing-water-canvas');
    this.reelingCanvas = this.host.querySelector('.fishing-reeling-canvas');
    this.uiOverlay = this.host.querySelector('.fishing-ui-layer');

    // Adaptar tamaño en redimensionado
    this._resizeHandler = () => {
      this.waterRenderer?.resize();
      this.minigameView?.resize();
    };
    window.addEventListener('resize', this._resizeHandler);
  }

  _bindInternalEvents() {
    // Escuchar eventos de teclado globales en el minijuego
    this._keyHandler = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        const phase = this.engine.getPhase();
        if (phase === 'PREPARATION' && e.type === 'keydown') {
          e.preventDefault();
          this.sound.playCast();
          this.engine.startCasting();
        } else if (phase === 'CASTING' && e.type === 'keyup') {
          e.preventDefault();
          this.sound.playSplash();
          this.engine.releaseCast();
        } else if (phase === 'HOOKING' && e.type === 'keydown') {
          e.preventDefault();
          this.sound.playReelClick();
          this.engine.hookFish();
        } else if (phase === 'REELING') {
          e.preventDefault();
          const isDown = e.type === 'keydown';
          this.engine.setReelingInput(isDown);
          if (isDown) this.sound.playReelClick();
        }
      }
    };

    window.addEventListener('keydown', this._keyHandler);
    window.addEventListener('keyup', this._keyHandler);

    // Controles por ratón / táctil sobre el lienzo de combate
    this.reelingCanvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.engine.setReelingInput(true);
      this.sound.playReelClick();
    });

    window.addEventListener('mouseup', () => {
      this.engine.setReelingInput(false);
    });

    // Control alternativo: movimiento directo de puntero
    this.reelingCanvas.addEventListener('mousemove', (e) => {
      if (!this.engine.config.alternativeControls) return;
      const rect = this.reelingCanvas.getBoundingClientRect();
      const relativeY = 1.0 - ((e.clientY - rect.top) / rect.height);
      this.engine.setDirectReelTarget(relativeY);
    });

    // Efectos de agua al cambiar de fase
    this.on('phaseChange', (phase) => {
      this.uiManager.updateForPhase(phase);
      if (phase === 'WAITING') {
        this.waterRenderer.setBobberVisible(true);
        this.waterRenderer.addRipple(0.5, 0.55, 1.4);
      } else if (phase === 'HOOKING') {
        this.waterRenderer.dipBobber(14);
      } else {
        this.waterRenderer.setBobberVisible(false);
      }
    });

    // Efecto de aviso leve de mordisqueo
    this.engine.onNibbleCallback = () => {
      this.sound.playNibble();
      this.waterRenderer.dipBobber(6);
    };

    // Efectos de progreso continuo
    let lastProgressTick = 0;
    this.on('progress', ({ progress, tension }) => {
      const now = Date.now();
      if (now - lastProgressTick > 180 && this.engine.reelingMechanics?.isFishInside) {
        lastProgressTick = now;
        this.sound.playProgressTick();
      }
    });
  }

  // --- BUCLE DE ANIMACIÓN ---

  startLoop() {
    this.isRunning = true;
    this.lastTime = performance.now();

    const loop = (currentTime) => {
      if (!this.isRunning) return;

      const dt = Math.min(0.1, (currentTime - this.lastTime) / 1000);
      this.lastTime = currentTime;

      // 1. Tick del motor lógico
      this.engine.update(dt);

      // 2. Render de agua ambiental
      this.waterRenderer.render(dt, this.engine.getPhase());

      // 3. Render de pista de combate (solo si está en fase de captura)
      if (this.engine.getPhase() === 'REELING') {
        this.reelingCanvas.style.display = 'block';
        this.minigameView.render(
          dt,
          this.engine.fishPhysics,
          this.engine.reelingMechanics,
          this.engine.targetSpecies
        );
      } else {
        this.reelingCanvas.style.display = 'none';
      }

      // 4. Actualizar interfaz de usuario por frame
      this.uiManager.updatePerFrame();

      // 5. Telemetría de depuración
      this.debugPanel?.updateTelemetry();

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  // --- API PÚBLICA PARA EL MMORPG ---

  /**
   * Registra un callback para un evento.
   * @param {'phaseChange' | 'bite' | 'progress' | 'catch' | 'escape' | 'complete' | 'cancel'} event
   * @param {Function} callback
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  /**
   * Desregistra un callback.
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  _emit(event, data) {
    if (this.listeners.has(event)) {
      for (const cb of this.listeners.get(event)) {
        try {
          cb(data);
        } catch (err) {
          console.error(`[FishingAPI] Error en callback de evento '${event}':`, err);
        }
      }
    }
  }

  /**
   * Cambia la zona de pesca en caliente.
   * @param {string} zoneId
   */
  setZone(zoneId) {
    this.engine.setZone(zoneId);
    this.uiManager._updateEquipmentPreviews();
  }

  /**
   * Asigna el equipamiento del jugador proveniente del MMORPG.
   * @param {string} rodId
   * @param {string} [baitId]
   */
  setEquipment(rodId, baitId) {
    if (rodId) this.engine.setRod(rodId);
    if (baitId) this.engine.setBait(baitId);
    this.uiManager._updateEquipmentPreviews();
  }

  /**
   * Cancela la sesión activa de pesca.
   */
  cancel() {
    this.engine.cancel();
  }

  /**
   * Reinicia la sesión a la fase de preparación.
   */
  restart() {
    this.engine.restart();
  }

  /**
   * Destruye el minijuego y libera todos los recursos (eventos, audio, canvases).
   */
  destroy() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    window.removeEventListener('resize', this._resizeHandler);
    window.removeEventListener('keydown', this._keyHandler);
    window.removeEventListener('keyup', this._keyHandler);

    this.listeners.clear();
    this.host.innerHTML = '';
    this.host.classList.remove('brumaluz-fishing-container');

    this._emit('destroy', null);
  }

  /**
   * Método estático de conveniencia para abrir el minijuego en un contenedor.
   * @param {HTMLElement} target
   * @param {import('../types').FishingSessionConfig} [config]
   * @returns {FishingMinigameController}
   */
  static launch(target, config = {}) {
    return new FishingMinigameController(target, config);
  }
}
