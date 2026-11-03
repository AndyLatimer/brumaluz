/**
 * @file engine.js
 * Motor lógico independiente del minijuego de pesca de Brumaluz.
 * Desacoplado de la interfaz gráfica y del motor Three.js para permitir
 * ejecución autónoma, pruebas automatizadas e integración limpia.
 */

import { FishingStateMachine } from './state-machine.js';
import { FishPhysics } from './fish-physics.js';
import { ReelingMechanics } from './reeling-mechanics.js';
import { FISH_SPECIES, getSpeciesById } from '../data/species.js';
import { FISHING_RODS, getRodById } from '../data/equipment.js';
import { FISHING_BAITS, getBaitById } from '../data/equipment.js';
import { FISHING_ZONES, getZoneById } from '../data/zones.js';

export class FishingEngine {
  /**
   * @param {import('../types').FishingSessionConfig} config
   */
  constructor(config) {
    this.config = {
      zoneId: config.zoneId || 'rio_brumaluz',
      rodId: config.rodId || 'cana_sauce',
      baitId: config.baitId || 'sin_cebo',
      accessibleMode: config.accessibleMode ?? false,
      alternativeControls: config.alternativeControls ?? false,
      fixedSpeciesId: config.fixedSpeciesId,
      onPhaseChange: config.onPhaseChange,
      onProgressUpdate: config.onProgressUpdate,
      onBite: config.onBite,
      onComplete: config.onComplete,
      onCancel: config.onCancel
    };

    // Objetos de datos actuales
    this.zone = getZoneById(this.config.zoneId);
    this.rod = getRodById(this.config.rodId);
    this.bait = getBaitById(this.config.baitId);

    // Estado interno
    this.stateMachine = new FishingStateMachine({
      onTransition: (prev, next) => this._handlePhaseTransition(prev, next)
    });

    // Submódulos activos
    /** @type {FishPhysics | null} */
    this.fishPhysics = null;
    /** @type {ReelingMechanics | null} */
    this.reelingMechanics = null;
    /** @type {import('../types').FishSpecies | null} */
    this.targetSpecies = null;

    // Cronómetros y estados de fase
    this.castPower = 0.5;
    this.castDirection = 1; // Oscilación
    this.castDistance = 12;
    this.castQualityRatio = 0.5;

    this.waitingTimer = 0;
    this.targetWaitTime = 4;
    this.nibblesTriggered = 0;

    this.reactionTimer = 0;
    this.maxReactionTime = 2.0;

    this.lastResult = null;

    // Ajustes de depuración
    this.debugDifficultyOverride = null;
    this.debugSpeedMultiplier = 1.0;

    // Arrancar en fase de preparación
    this.stateMachine.transition('PREPARATION');
  }

  // --- CONFIGURACIÓN Y EQUIPAMIENTO ---

  setRod(rodId) {
    this.rod = getRodById(rodId);
    this.config.rodId = rodId;
    if (this.reelingMechanics) {
      this.reelingMechanics.rod = this.rod;
    }
  }

  setBait(baitId) {
    this.bait = getBaitById(baitId);
    this.config.baitId = baitId;
  }

  setZone(zoneId) {
    this.zone = getZoneById(zoneId);
    this.config.zoneId = zoneId;
  }

  setAccessibleMode(enabled) {
    this.config.accessibleMode = enabled;
    if (this.fishPhysics) this.fishPhysics.setAccessibleMode(enabled);
    if (this.reelingMechanics) this.reelingMechanics.setAccessibleMode(enabled);
  }

  setAlternativeControls(enabled) {
    this.config.alternativeControls = enabled;
    if (this.reelingMechanics) this.reelingMechanics.setAlternativeControls(enabled);
  }

  getPhase() {
    return this.stateMachine.getPhase();
  }

  // --- CONTROL DE FASES ---

  /**
   * Inicia la fase de lanzamiento (oscilación de potencia).
   */
  startCasting() {
    if (this.stateMachine.getPhase() !== 'PREPARATION') return false;
    this.castPower = 0.1;
    this.castDirection = 1;
    return this.stateMachine.transition('CASTING');
  }

  /**
   * Suelta el lanzamiento con la potencia actual.
   */
  releaseCast() {
    if (this.stateMachine.getPhase() !== 'CASTING') return false;

    // Calcular distancia según potencia (entre 6 y 32 metros)
    this.castDistance = +(6 + this.castPower * 26).toFixed(1);

    // Calidad del lanzamiento (cercanía al punto dulce 0.85)
    const sweetSpotDiff = Math.abs(this.castPower - 0.85);
    this.castQualityRatio = +(Math.max(0, 1 - sweetSpotDiff * 2)).toFixed(2);

    // Seleccionar especie antes de la espera
    this.targetSpecies = this._selectSpeciesForCast(this.castDistance);

    // Calcular tiempo de espera
    const baseWait = this.zone.baseBiteMinSeconds +
      Math.random() * (this.zone.baseBiteMaxSeconds - this.zone.baseBiteMinSeconds);
    this.targetWaitTime = Math.max(1.5, baseWait * this.bait.biteTimeMultiplier);
    this.waitingTimer = 0;
    this.nibblesTriggered = 0;

    return this.stateMachine.transition('WAITING');
  }

  /**
   * El jugador reacciona a la picada ("¡PICA!").
   */
  hookFish() {
    if (this.stateMachine.getPhase() !== 'HOOKING') return false;

    // Inicializar submódulos de combate
    this._setupReelingBattle();
    return this.stateMachine.transition('REELING');
  }

  /**
   * Entrada de control durante el combate de captura.
   * @param {boolean} active
   */
  setReelingInput(active) {
    if (this.reelingMechanics) {
      this.reelingMechanics.setReelingInput(active);
    }
  }

  /**
   * Control alternativo para posicionar directamente la zona de captura.
   * @param {number} normalizedY (0.0 a 1.0)
   */
  setDirectReelTarget(normalizedY) {
    if (this.reelingMechanics) {
      this.reelingMechanics.setDirectTarget(normalizedY);
    }
  }

  /**
   * Cancela la sesión activa.
   */
  cancel() {
    this.stateMachine.cancel();
    if (this.config.onCancel) this.config.onCancel();
  }

  /**
   * Reinicia el minijuego a la fase de preparación.
   */
  restart() {
    this.lastResult = null;
    this.targetSpecies = null;
    this.fishPhysics = null;
    this.reelingMechanics = null;
    this.stateMachine.restart();
  }

  // --- BUCLE PRINCIPAL (TICK) ---

  /**
   * Actualiza la lógica para el paso temporal dt (segundos).
   * @param {number} dt
   */
  update(dt) {
    const phase = this.stateMachine.getPhase();

    switch (phase) {
      case 'CASTING':
        this._updateCasting(dt);
        break;

      case 'WAITING':
        this._updateWaiting(dt);
        break;

      case 'HOOKING':
        this._updateHooking(dt);
        break;

      case 'REELING':
        this._updateReeling(dt);
        break;
    }
  }

  _updateCasting(dt) {
    // Oscilación de potencia entre 0 y 1
    const speed = 1.65;
    this.castPower += this.castDirection * speed * dt;
    if (this.castPower >= 1.0) {
      this.castPower = 1.0;
      this.castDirection = -1;
    } else if (this.castPower <= 0.05) {
      this.castPower = 0.05;
      this.castDirection = 1;
    }
  }

  _updateWaiting(dt) {
    this.waitingTimer += dt;

    // Simular perturbaciones / toques de aviso (nibbles) al 35% y 70% de la espera
    const progress = this.waitingTimer / this.targetWaitTime;
    if (progress >= 0.35 && this.nibblesTriggered === 0) {
      this.nibblesTriggered = 1;
      this._emitNibble();
    } else if (progress >= 0.72 && this.nibblesTriggered === 1) {
      this.nibblesTriggered = 2;
      this._emitNibble();
    }

    if (this.waitingTimer >= this.targetWaitTime) {
      // Picada confirmada
      this._triggerBite();
    }
  }

  _updateHooking(dt) {
    this.reactionTimer += dt;
    if (this.reactionTimer >= this.maxReactionTime) {
      // Se agotó el tiempo de reacción -> el pez escapó
      this._handleFishEscapedEarly();
    }
  }

  _updateReeling(dt) {
    if (!this.fishPhysics || !this.reelingMechanics) return;

    // 1. Actualizar movimiento del pez
    this.fishPhysics.update(dt);

    // 2. Actualizar física de la barra y progreso
    const step = this.reelingMechanics.update(dt, this.fishPhysics.position);

    // 3. Emitir evento de progreso continuo
    if (this.config.onProgressUpdate) {
      this.config.onProgressUpdate(step.progress, this.reelingMechanics.lineTension);
    }

    // 4. Comprobar resultado
    if (step.status === 'caught') {
      this._handleCatchSuccess();
    } else if (step.status === 'escaped') {
      this._handleCatchFailed();
    }
  }

  // --- LÓGICA DE ESPECIES Y SELECCIÓN ---

  /**
   * Elige una especie considerando hábitat, distancia y cebo.
   * @param {number} distance
   * @returns {import('../types').FishSpecies}
   */
  _selectSpeciesForCast(distance) {
    if (this.config.fixedSpeciesId) {
      const fixed = getSpeciesById(this.config.fixedSpeciesId);
      if (fixed) return fixed;
    }

    // Filtrar especies presentes en la zona
    const zoneSpecies = FISH_SPECIES.filter(s =>
      this.zone.availableSpeciesIds.includes(s.id)
    );

    if (zoneSpecies.length === 0) return FISH_SPECIES[0];

    // Ponderación por distancia y afinidad de cebo
    const candidates = zoneSpecies.map(sp => {
      let weight = sp.spawnWeight;

      // Penalización si la distancia es menor a la recomendada
      if (distance < sp.minDistance) {
        weight *= 0.35;
      } else {
        // Bonificación por distancia óptima
        weight *= (1 + (distance - sp.minDistance) * 0.04);
      }

      // Afinidad con el cebo actual
      if (sp.preferredBaits.includes(this.bait.id)) {
        weight *= 2.5;
      }

      // Bonificación de rareza del cebo
      if (['rare', 'legendary', 'mythical'].includes(sp.rarity)) {
        weight *= this.bait.rarityBonus;
      }

      return { species: sp, weight: Math.max(1, weight) };
    });

    const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
    let roll = Math.random() * totalWeight;

    for (const item of candidates) {
      if (roll <= item.weight) {
        return item.species;
      }
      roll -= item.weight;
    }

    return candidates[0].species;
  }

  // --- GESTIÓN DE COMBATE Y RESULTADOS ---

  _triggerBite() {
    this.reactionTimer = 0;
    const accessBonus = this.config.accessibleMode ? 0.6 : 0.0;
    this.maxReactionTime = (this.targetSpecies?.reactionTime || 2.0) +
      this.rod.reactionBonus + accessBonus;

    this.stateMachine.transition('HOOKING');
    if (this.config.onBite) this.config.onBite();
  }

  _emitNibble() {
    // Evento interno para animar perturbaciones leves del flotador
    if (this.onNibbleCallback) this.onNibbleCallback();
  }

  _setupReelingBattle() {
    if (!this.targetSpecies) {
      this.targetSpecies = this._selectSpeciesForCast(this.castDistance);
    }

    const speciesCopy = { ...this.targetSpecies };
    if (this.debugDifficultyOverride != null) {
      speciesCopy.difficulty = this.debugDifficultyOverride;
    }

    this.fishPhysics = new FishPhysics(speciesCopy, {
      calmModifier: this.bait.calmModifier,
      accessibleMode: this.config.accessibleMode,
      speedMultiplier: this.debugSpeedMultiplier
    });

    this.reelingMechanics = new ReelingMechanics(this.rod, speciesCopy, {
      accessibleMode: this.config.accessibleMode,
      alternativeControls: this.config.alternativeControls
    });
  }

  _handleCatchSuccess() {
    if (!this.targetSpecies || !this.reelingMechanics) return;

    const acc = this.reelingMechanics.getAccuracy();
    const quality = this.reelingMechanics.calculateQuality();

    // Cálculo procedural de tamaño y peso dentro del rango de la especie
    const [minS, maxS] = this.targetSpecies.sizeRange;
    const [minW, maxW] = this.targetSpecies.weightRange;

    // Lanzamientos de mayor distancia y precisión tienden a peces más grandes
    const bonusRatio = (this.castQualityRatio * 0.4) + (acc * 0.6);
    const size = +(minS + (maxS - minS) * (0.2 + bonusRatio * 0.75 + Math.random() * 0.05)).toFixed(1);
    const weight = +(minW + (maxW - minW) * (0.2 + bonusRatio * 0.75 + Math.random() * 0.05)).toFixed(2);

    /** @type {import('../types').FishingResult} */
    this.lastResult = {
      success: true,
      escaped: false,
      species: this.targetSpecies,
      size,
      weight,
      quality,
      castDistance: this.castDistance,
      castQualityRatio: this.castQualityRatio,
      reelingAccuracy: +acc.toFixed(3),
      reelingDuration: +this.reelingMechanics.totalCombatTime.toFixed(1),
      rodId: this.rod.id,
      baitId: this.bait.id,
      zoneId: this.zone.id,
      timestamp: Date.now(),
      clientSignature: `sig_fish_${this.targetSpecies.id}_${Date.now().toString(36)}`
    };

    this.stateMachine.transition('RESULT');
    if (this.config.onComplete) this.config.onComplete(this.lastResult);
  }

  _handleCatchFailed() {
    if (!this.targetSpecies) return;

    /** @type {import('../types').FishingResult} */
    this.lastResult = {
      success: false,
      escaped: true,
      species: this.targetSpecies,
      castDistance: this.castDistance,
      castQualityRatio: this.castQualityRatio,
      reelingAccuracy: +(this.reelingMechanics?.getAccuracy() || 0).toFixed(3),
      reelingDuration: +(this.reelingMechanics?.totalCombatTime || 0).toFixed(1),
      rodId: this.rod.id,
      baitId: this.bait.id,
      zoneId: this.zone.id,
      timestamp: Date.now()
    };

    this.stateMachine.transition('RESULT');
    if (this.config.onComplete) this.config.onComplete(this.lastResult);
  }

  _handleFishEscapedEarly() {
    // Escapó por no reaccionar a tiempo a la picada
    this._handleCatchFailed();
  }

  _handlePhaseTransition(prev, next) {
    if (this.config.onPhaseChange) {
      this.config.onPhaseChange(next);
    }
  }

  // --- TELEMETRÍA PARA PANEL DE PRUEBAS ---

  /**
   * @returns {import('../types').MinigameTelemetry}
   */
  getTelemetry() {
    return {
      fps: 60,
      phase: this.stateMachine.getPhase(),
      fishPosition: +(this.fishPhysics?.position || 0).toFixed(3),
      fishVelocity: +(this.fishPhysics?.velocity || 0).toFixed(3),
      playerZonePosition: +(this.reelingMechanics?.zonePosition || 0).toFixed(3),
      playerZoneSize: +(this.reelingMechanics?.zoneSize || 0).toFixed(3),
      catchProgress: +(this.reelingMechanics?.catchProgress || 0).toFixed(3),
      lineTension: +(this.reelingMechanics?.lineTension || 0).toFixed(3),
      timeInZoneRatio: +(this.reelingMechanics?.getAccuracy() || 0).toFixed(3),
      currentSpecies: this.targetSpecies || undefined
    };
  }

  // --- ACCIONES DEL MODO DE PRUEBAS ---

  forceBite() {
    if (this.stateMachine.getPhase() === 'WAITING') {
      this._triggerBite();
      return true;
    }
    return false;
  }

  setForceSpecies(speciesId) {
    this.config.fixedSpeciesId = speciesId || undefined;
    if (speciesId) {
      this.targetSpecies = getSpeciesById(speciesId) || null;
    }
  }

  setDifficultyOverride(val) {
    this.debugDifficultyOverride = val;
    if (this.fishPhysics && val != null) {
      this.fishPhysics.species.difficulty = val;
      this.fishPhysics._recomputeDynamics();
    }
  }

  setSpeedMultiplier(mult) {
    this.debugSpeedMultiplier = mult;
    if (this.fishPhysics) {
      this.fishPhysics.setSpeedMultiplier(mult);
    }
  }
}
