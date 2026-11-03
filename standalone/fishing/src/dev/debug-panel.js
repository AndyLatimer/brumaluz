/**
 * @file debug-panel.js
 * Panel de pruebas y desarrollo para inspección y ajuste fino en tiempo real.
 * Permite forzar especies, picadas, calibrar dificultad y monitorizar telemetría.
 */

import { FISH_SPECIES } from '../data/species.js';
import { FISHING_RODS } from '../data/equipment.js';
import { FISHING_BAITS } from '../data/equipment.js';

export class DebugPanel {
  /**
   * @param {HTMLElement} container
   * @param {import('../core/engine').FishingEngine} engine
   */
  constructor(container, engine) {
    this.container = container;
    this.engine = engine;
    this.isOpen = false;

    this._buildDOM();
    this._attachEvents();
  }

  _buildDOM() {
    this.panelRoot = document.createElement('div');
    this.panelRoot.className = 'debug-panel-wrapper';
    this.panelRoot.innerHTML = `
      <button id="btn-toggle-debug" class="debug-toggle-tab">🛠️ Modo Pruebas</button>
      <div id="debug-drawer" class="debug-drawer" hidden>
        <div class="debug-header">
          <h3>Panel de Desarrollo y Calibración</h3>
          <span class="debug-badge">Prototipo Aislado</span>
        </div>

        <div class="debug-section">
          <h4>🧪 Selección Rápida</h4>
          <div class="debug-row">
            <label>Forzar Especie:</label>
            <select id="dbg-species-select" class="debug-select">
              <option value="">(Aleatoria según zona/lance)</option>
              ${FISH_SPECIES.map(s => `<option value="${s.id}">${s.name} [Dif: ${s.difficulty}]</option>`).join('')}
            </select>
          </div>

          <div class="debug-row">
            <label>Cambiar Caña:</label>
            <select id="dbg-rod-select" class="debug-select">
              ${FISHING_RODS.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
            </select>
          </div>

          <div class="debug-row">
            <label>Cambiar Cebo:</label>
            <select id="dbg-bait-select" class="debug-select">
              ${FISHING_BAITS.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="debug-section">
          <h4>🎛️ Parámetros de Dinámica</h4>
          <div class="debug-slider-row">
            <div class="slider-labels">
              <span>Dificultad Forzada:</span>
              <strong id="lbl-dbg-diff">Por defecto</strong>
            </div>
            <input type="range" id="slider-dbg-diff" min="1" max="10" step="0.5" value="5">
            <button id="btn-reset-diff" class="debug-btn-xs">Restablecer</button>
          </div>

          <div class="debug-slider-row">
            <div class="slider-labels">
              <span>Velocidad Pez:</span>
              <strong id="lbl-dbg-speed">1.0x</strong>
            </div>
            <input type="range" id="slider-dbg-speed" min="0.5" max="2.5" step="0.1" value="1.0">
          </div>
        </div>

        <div class="debug-section">
          <h4>⚡ Acciones Inmediatas</h4>
          <div class="debug-actions-grid">
            <button id="btn-force-bite" class="debug-action-btn">🎣 Forzar Picada Inmediata</button>
            <button id="btn-force-reeling" class="debug-action-btn">⚡ Forzar Combate Captura</button>
            <button id="btn-dbg-restart" class="debug-action-btn">🔄 Reiniciar Minijuego</button>
          </div>
        </div>

        <div class="debug-section">
          <h4>📊 Telemetría en Tiempo Real</h4>
          <div class="telemetry-grid">
            <div class="telem-item"><span>Fase:</span> <strong id="tel-phase">IDLE</strong></div>
            <div class="telem-item"><span>Progreso:</span> <strong id="tel-progress">0%</strong></div>
            <div class="telem-item"><span>Tensión:</span> <strong id="tel-tension">0.0</strong></div>
            <div class="telem-item"><span>Pez Y:</span> <strong id="tel-fish-y">0.0</strong></div>
            <div class="telem-item"><span>Barra Y:</span> <strong id="tel-zone-y">0.0</strong></div>
            <div class="telem-item"><span>Especie:</span> <strong id="tel-species">--</strong></div>
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(this.panelRoot);

    this.elements = {
      btnToggle: this.panelRoot.querySelector('#btn-toggle-debug'),
      drawer: this.panelRoot.querySelector('#debug-drawer'),
      selSpecies: this.panelRoot.querySelector('#dbg-species-select'),
      selRod: this.panelRoot.querySelector('#dbg-rod-select'),
      selBait: this.panelRoot.querySelector('#dbg-bait-select'),

      sliderDiff: this.panelRoot.querySelector('#slider-dbg-diff'),
      lblDiff: this.panelRoot.querySelector('#lbl-dbg-diff'),
      btnResetDiff: this.panelRoot.querySelector('#btn-reset-diff'),

      sliderSpeed: this.panelRoot.querySelector('#slider-dbg-speed'),
      lblSpeed: this.panelRoot.querySelector('#lbl-dbg-speed'),

      btnForceBite: this.panelRoot.querySelector('#btn-force-bite'),
      btnForceReeling: this.panelRoot.querySelector('#btn-force-reeling'),
      btnRestart: this.panelRoot.querySelector('#btn-dbg-restart'),

      telPhase: this.panelRoot.querySelector('#tel-phase'),
      telProgress: this.panelRoot.querySelector('#tel-progress'),
      telTension: this.panelRoot.querySelector('#tel-tension'),
      telFishY: this.panelRoot.querySelector('#tel-fish-y'),
      telZoneY: this.panelRoot.querySelector('#tel-zone-y'),
      telSpecies: this.panelRoot.querySelector('#tel-species')
    };
  }

  _attachEvents() {
    this.elements.btnToggle.addEventListener('click', () => {
      this.isOpen = !this.isOpen;
      this.elements.drawer.hidden = !this.isOpen;
      this.elements.btnToggle.classList.toggle('active', this.isOpen);
    });

    this.elements.selSpecies.addEventListener('change', (e) => {
      this.engine.setForceSpecies(e.target.value);
    });

    this.elements.selRod.addEventListener('change', (e) => {
      this.engine.setRod(e.target.value);
    });

    this.elements.selBait.addEventListener('change', (e) => {
      this.engine.setBait(e.target.value);
    });

    this.elements.sliderDiff.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.elements.lblDiff.textContent = val.toFixed(1);
      this.engine.setDifficultyOverride(val);
    });

    this.elements.btnResetDiff.addEventListener('click', () => {
      this.engine.setDifficultyOverride(null);
      this.elements.lblDiff.textContent = 'Por defecto';
    });

    this.elements.sliderSpeed.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.elements.lblSpeed.textContent = `${val.toFixed(1)}x`;
      this.engine.setSpeedMultiplier(val);
    });

    this.elements.btnForceBite.addEventListener('click', () => {
      if (this.engine.getPhase() !== 'WAITING') {
        this.engine.startCasting();
        this.engine.releaseCast();
      }
      this.engine.forceBite();
    });

    this.elements.btnForceReeling.addEventListener('click', () => {
      if (this.engine.getPhase() !== 'WAITING' && this.engine.getPhase() !== 'HOOKING') {
        this.engine.startCasting();
        this.engine.releaseCast();
      }
      this.engine.forceBite();
      this.engine.hookFish();
    });

    this.elements.btnRestart.addEventListener('click', () => {
      this.engine.restart();
    });
  }

  updateTelemetry() {
    if (!this.isOpen) return;

    const telem = this.engine.getTelemetry();
    this.elements.telPhase.textContent = telem.phase;
    this.elements.telProgress.textContent = `${Math.round(telem.catchProgress * 100)}%`;
    this.elements.telTension.textContent = telem.lineTension.toFixed(2);
    this.elements.telFishY.textContent = telem.fishPosition.toFixed(2);
    this.elements.telZoneY.textContent = telem.playerZonePosition.toFixed(2);
    this.elements.telSpecies.textContent = telem.currentSpecies?.name?.substring(0, 16) || '--';
  }
}
