/**
 * @file ui-manager.js
 * Gestor de interfaz gráfica, superposiciones, modales de resultado
 * y controles visuales para cada una de las 5 fases del minijuego.
 */

import { FISHING_RODS } from '../data/equipment.js';
import { FISHING_BAITS } from '../data/equipment.js';
import { FISHING_ZONES } from '../data/zones.js';

export class UIManager {
  /**
   * @param {HTMLElement} container
   * @param {import('../core/engine').FishingEngine} engine
   * @param {import('../audio/sound-synthesizer').FishingSoundSynthesizer} sound
   */
  constructor(container, engine, sound) {
    this.container = container;
    this.engine = engine;
    this.sound = sound;

    this.elements = {};
    this._buildDOM();
    this._attachEvents();
    this.updateForPhase(engine.getPhase());
  }

  _buildDOM() {
    this.container.innerHTML = `
      <div class="fishing-ui-overlay">
        <!-- Barra superior: Información de zona y ajustes rápidos -->
        <header class="fishing-header-bar">
          <div class="fishing-zone-badge">
            <span class="zone-icon">🌊</span>
            <div class="zone-text">
              <strong id="ui-zone-title">Río Brumaluz</strong>
              <small id="ui-zone-region">Capital común de Pompelín</small>
            </div>
          </div>
          <div class="fishing-header-actions">
            <button id="btn-audio-toggle" class="cozy-icon-btn" title="Silenciar / Activar sonido">🔊</button>
            <button id="btn-accessibility-toggle" class="cozy-badge-btn" title="Modo accesible">+ Modo Accesible</button>
          </div>
        </header>

        <!-- FASE A: Panel de Preparación -->
        <div id="panel-prep" class="cozy-card prep-panel">
          <div class="cozy-card-header">
            <h2 class="cinzel-title">Preparación de Pesca</h2>
            <p class="cozy-subtitle">Elige tu caña, cebo y consulta las aguas antes de lanzar.</p>
          </div>
          
          <div class="prep-grid">
            <div class="prep-field">
              <label for="sel-rod">Caña de Pesca:</label>
              <select id="sel-rod" class="cozy-select"></select>
              <div id="rod-stats-preview" class="stats-preview"></div>
            </div>

            <div class="prep-field">
              <label for="sel-bait">Cebo:</label>
              <select id="sel-bait" class="cozy-select"></select>
              <div id="bait-stats-preview" class="stats-preview"></div>
            </div>

            <div class="prep-field">
              <label for="sel-zone">Zona de Pesca:</label>
              <select id="sel-zone" class="cozy-select"></select>
              <div id="zone-description-preview" class="stats-preview"></div>
            </div>
          </div>

          <div class="prep-footer">
            <div class="controls-hint">
              <span>⌨️ <strong>Espacio</strong> o <strong>Click</strong> para lanzar y controlar</span>
            </div>
            <button id="btn-start-cast" class="cozy-primary-btn pulse">Lanzar Caña al Agua</button>
          </div>
        </div>

        <!-- FASE B: Medidor de Potencia de Lanzamiento -->
        <div id="panel-cast-gauge" class="cast-gauge-panel" hidden>
          <div class="gauge-card">
            <h3 class="cinzel-title-sm">Potencia de Lanzamiento</h3>
            <div class="gauge-track">
              <div id="gauge-fill" class="gauge-fill"></div>
              <div class="gauge-sweet-spot" title="Punto Dulce (Óptimo)"></div>
              <div id="gauge-pointer" class="gauge-pointer"></div>
            </div>
            <p class="gauge-tip">¡Suelta para lanzar a distancia óptima!</p>
            <button id="btn-release-cast" class="cozy-primary-btn">¡SOLTAR LANCE!</button>
          </div>
        </div>

        <!-- FASE C: Espera / Flotador -->
        <div id="panel-waiting" class="waiting-panel" hidden>
          <div class="waiting-bubble">
            <span class="bubble-anim">💧</span>
            <div class="waiting-info">
              <strong id="waiting-distance-label">Distancia: --m</strong>
              <small>El flotador descansa en la corriente... Aguarda a que pique.</small>
            </div>
            <button id="btn-cancel-wait" class="cozy-secondary-btn">Recoger caña</button>
          </div>
        </div>

        <!-- FASE D (Inicio): Aviso de Picada -->
        <div id="panel-hook-prompt" class="hook-prompt-panel" hidden>
          <div class="bite-alert-card bounce-in">
            <div class="bite-icon">💥</div>
            <h2 class="bite-title">¡PICA!</h2>
            <p>¡El flotador se ha hundido!</p>
            <div class="reaction-bar-track">
              <div id="reaction-bar-fill" class="reaction-bar-fill"></div>
            </div>
            <button id="btn-hook-action" class="cozy-primary-btn huge pulse">¡CLAVAR ANZUELO!</button>
            <small class="key-shortcut-hint">Presiona [Espacio] o [Click]</small>
          </div>
        </div>

        <!-- FASE D (Combate): Controles e indicaciones de Captura -->
        <div id="panel-reeling-hud" class="reeling-hud-panel" hidden>
          <div class="reeling-instructions">
            <span>Mantén <strong>[Espacio]</strong> o <strong>[Click]</strong> para subir la zona. ¡Mantén al pez dentro!</span>
          </div>
        </div>

        <!-- FASE E: Resultado de Pesca -->
        <div id="panel-result" class="result-modal-panel" hidden>
          <div id="result-card" class="result-card pop-in">
            <!-- Contenido dinámico inyectado en _renderResult -->
          </div>
        </div>
      </div>
    `;

    // Cachear elementos
    this.elements = {
      prepPanel: this.container.querySelector('#panel-prep'),
      castGaugePanel: this.container.querySelector('#panel-cast-gauge'),
      waitingPanel: this.container.querySelector('#panel-waiting'),
      hookPromptPanel: this.container.querySelector('#panel-hook-prompt'),
      reelingHudPanel: this.container.querySelector('#panel-reeling-hud'),
      resultPanel: this.container.querySelector('#panel-result'),
      resultCard: this.container.querySelector('#result-card'),

      selRod: this.container.querySelector('#sel-rod'),
      selBait: this.container.querySelector('#sel-bait'),
      selZone: this.container.querySelector('#sel-zone'),

      rodPreview: this.container.querySelector('#rod-stats-preview'),
      baitPreview: this.container.querySelector('#bait-stats-preview'),
      zonePreview: this.container.querySelector('#zone-description-preview'),

      gaugeFill: this.container.querySelector('#gauge-fill'),
      gaugePointer: this.container.querySelector('#gauge-pointer'),
      reactionBarFill: this.container.querySelector('#reaction-bar-fill'),
      waitingDistance: this.container.querySelector('#waiting-distance-label'),

      btnStartCast: this.container.querySelector('#btn-start-cast'),
      btnReleaseCast: this.container.querySelector('#btn-release-cast'),
      btnCancelWait: this.container.querySelector('#btn-cancel-wait'),
      btnHookAction: this.container.querySelector('#btn-hook-action'),
      btnAudioToggle: this.container.querySelector('#btn-audio-toggle'),
      btnAccessToggle: this.container.querySelector('#btn-accessibility-toggle'),

      zoneTitle: this.container.querySelector('#ui-zone-title'),
      zoneRegion: this.container.querySelector('#ui-zone-region')
    };

    this._populateDropdowns();
  }

  _populateDropdowns() {
    // Cañas
    this.elements.selRod.innerHTML = FISHING_RODS.map(r =>
      `<option value="${r.id}" ${r.id === this.engine.rod.id ? 'selected' : ''}>${r.icon || '🎣'} ${r.name}</option>`
    ).join('');

    // Cebos
    this.elements.selBait.innerHTML = FISHING_BAITS.map(b =>
      `<option value="${b.id}" ${b.id === this.engine.bait.id ? 'selected' : ''}>${b.icon || '🪱'} ${b.name}</option>`
    ).join('');

    // Zonas
    this.elements.selZone.innerHTML = FISHING_ZONES.map(z =>
      `<option value="${z.id}" ${z.id === this.engine.zone.id ? 'selected' : ''}>${z.name}</option>`
    ).join('');

    this._updateEquipmentPreviews();
  }

  _updateEquipmentPreviews() {
    const rod = this.engine.rod;
    this.elements.rodPreview.innerHTML = `
      <span>Anchura zona: <strong>+${Math.round((rod.zoneWidthMultiplier - 1) * 100)}%</strong></span> |
      <span>Estabilidad: <strong>${rod.stability}x</strong></span> |
      <span>Velocidad carrete: <strong>${rod.reelSpeedMultiplier}x</strong></span>
    `;

    const bait = this.engine.bait;
    this.elements.baitPreview.innerHTML = `
      <span>Espera picada: <strong>${Math.round((1 - bait.biteTimeMultiplier) * 100)}% más rápida</strong></span> |
      <span>Rareza: <strong>${bait.rarityBonus}x</strong></span> |
      <span>Calma pez: <strong>${Math.round((1 - bait.calmModifier) * 100)}%</strong></span>
    `;

    const zone = this.engine.zone;
    this.elements.zonePreview.innerHTML = `
      <p>${zone.description}</p>
      <small>Especies presentes: ${zone.availableSpeciesIds.length} tipos</small>
    `;

    this.elements.zoneTitle.textContent = zone.name;
    this.elements.zoneRegion.textContent = `${zone.region} • ${zone.waterType.toUpperCase()}`;
  }

  _attachEvents() {
    // Selección de equipamiento
    this.elements.selRod.addEventListener('change', (e) => {
      this.engine.setRod(e.target.value);
      this._updateEquipmentPreviews();
    });

    this.elements.selBait.addEventListener('change', (e) => {
      this.engine.setBait(e.target.value);
      this._updateEquipmentPreviews();
    });

    this.elements.selZone.addEventListener('change', (e) => {
      this.engine.setZone(e.target.value);
      this._updateEquipmentPreviews();
    });

    // Botón iniciar lanzamiento
    this.elements.btnStartCast.addEventListener('click', () => {
      this.sound.playCast();
      this.engine.startCasting();
    });

    // Botón soltar lanzamiento
    this.elements.btnReleaseCast.addEventListener('click', () => {
      this.sound.playSplash();
      this.engine.releaseCast();
    });

    // Cancelar espera
    this.elements.btnCancelWait.addEventListener('click', () => {
      this.engine.cancel();
      this.engine.restart();
    });

    // Clavar anzuelo (Hook)
    this.elements.btnHookAction.addEventListener('click', () => {
      this.sound.playReelClick();
      this.engine.hookFish();
    });

    // Controles de audio y accesibilidad
    this.elements.btnAudioToggle.addEventListener('click', () => {
      const isMuted = this.sound.toggleMute();
      this.elements.btnAudioToggle.textContent = isMuted ? '🔇' : '🔊';
      this.elements.btnAudioToggle.classList.toggle('muted', isMuted);
    });

    this.elements.btnAccessToggle.addEventListener('click', () => {
      const current = this.engine.config.accessibleMode;
      const next = !current;
      this.engine.setAccessibleMode(next);
      this.elements.btnAccessToggle.classList.toggle('active', next);
      this.elements.btnAccessToggle.textContent = next ? '✓ Modo Accesible Activado' : '+ Modo Accesible';
    });
  }

  /**
   * Actualiza la visibilidad de pantallas según la fase.
   * @param {import('../types').FishingPhase} phase
   */
  updateForPhase(phase) {
    this.elements.prepPanel.hidden = phase !== 'PREPARATION';
    this.elements.castGaugePanel.hidden = phase !== 'CASTING';
    this.elements.waitingPanel.hidden = phase !== 'WAITING';
    this.elements.hookPromptPanel.hidden = phase !== 'HOOKING';
    this.elements.reelingHudPanel.hidden = phase !== 'REELING';
    this.elements.resultPanel.hidden = phase !== 'RESULT';

    if (phase === 'WAITING') {
      this.elements.waitingDistance.textContent = `Distancia alcanzada: ${this.engine.castDistance} metros`;
    }

    if (phase === 'HOOKING') {
      this.sound.playBiteAlert();
    }

    if (phase === 'RESULT' && this.engine.lastResult) {
      this._renderResult(this.engine.lastResult);
    }
  }

  /**
   * Actualiza barras dinámicas en cada frame de animación.
   */
  updatePerFrame() {
    const phase = this.engine.getPhase();

    if (phase === 'CASTING') {
      const power = this.engine.castPower;
      this.elements.gaugeFill.style.width = `${power * 100}%`;
      this.elements.gaugePointer.style.left = `${power * 100}%`;
    } else if (phase === 'HOOKING') {
      const maxTime = this.engine.maxReactionTime;
      const elapsed = this.engine.reactionTimer;
      const remainingRatio = Math.max(0, 1 - (elapsed / maxTime));
      this.elements.reactionBarFill.style.width = `${remainingRatio * 100}%`;
    }
  }

  _renderResult(res) {
    const card = this.elements.resultCard;

    if (res.success && res.species) {
      const sp = res.species;
      const stars = '★'.repeat(res.quality || 1) + '☆'.repeat(4 - (res.quality || 1));
      const rarityLabels = {
        common: { name: 'Común', cls: 'rarity-common' },
        uncommon: { name: 'Poco Común', cls: 'rarity-uncommon' },
        rare: { name: 'Raro', cls: 'rarity-rare' },
        legendary: { name: 'Legendario', cls: 'rarity-legendary' },
        mythical: { name: 'Mítico', cls: 'rarity-mythical' }
      };
      const rInfo = rarityLabels[sp.rarity] || rarityLabels.common;

      this.sound.playCatchFanfare();

      card.innerHTML = `
        <div class="result-success-header">
          <div class="result-badge ${rInfo.cls}">${rInfo.name}</div>
          <h2 class="result-fish-name cinzel-title">${sp.name}</h2>
          <div class="result-stars" title="Calidad ${res.quality} estrellas">${stars}</div>
        </div>

        <div class="result-body">
          <div class="result-icon-container">
            ${sp.iconSvg || '<span class="default-fish-icon">🐟</span>'}
          </div>

          <div class="result-specs-grid">
            <div class="spec-item">
              <span class="spec-label">Longitud</span>
              <strong class="spec-val">${res.size} cm</strong>
            </div>
            <div class="spec-item">
              <span class="spec-label">Peso</span>
              <strong class="spec-val">${res.weight} kg</strong>
            </div>
            <div class="spec-item">
              <span class="spec-label">Distancia</span>
              <strong class="spec-val">${res.castDistance} m</strong>
            </div>
            <div class="spec-item">
              <span class="spec-label">Precisión</span>
              <strong class="spec-val">${Math.round(res.reelingAccuracy * 100)}%</strong>
            </div>
          </div>

          <div class="result-lore-quote">
            <p>"${sp.lore}"</p>
          </div>

          <div class="result-integration-notice">
            <small>✨ Modo Prototipo: El resultado ha emitido su firma de captura lista para integración con el servidor MMORPG.</small>
          </div>
        </div>

        <div class="result-actions">
          <button id="btn-result-again" class="cozy-primary-btn">Pescar de nuevo</button>
          <button id="btn-result-close" class="cozy-secondary-btn">Cerrar</button>
        </div>
      `;

      card.querySelector('#btn-result-again').addEventListener('click', () => {
        this.engine.restart();
      });
      card.querySelector('#btn-result-close').addEventListener('click', () => {
        this.engine.restart();
      });

    } else {
      // Escapó
      this.sound.playEscape();

      card.innerHTML = `
        <div class="result-escaped-header">
          <div class="escaped-icon">💨</div>
          <h2 class="cinzel-title">El pez ha escapado...</h2>
          <p class="escaped-msg">La tensión del sedal se redujo demasiado y el pez logró soltarse.</p>
        </div>

        <div class="result-body">
          <div class="escaped-advice">
            <p>💡 <em>Consejo acogedor:</em> Mantén el carrete presionado con pulsos rítmicos para no sobrepasar ni dejar caer la barra verde sobre el pez.</p>
          </div>
        </div>

        <div class="result-actions">
          <button id="btn-result-again" class="cozy-primary-btn">Intentar de nuevo</button>
        </div>
      `;

      card.querySelector('#btn-result-again').addEventListener('click', () => {
        this.engine.restart();
      });
    }
  }
}
