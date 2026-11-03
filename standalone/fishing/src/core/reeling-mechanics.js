/**
 * @file reeling-mechanics.js
 * Mecánica central de captura: física de la barra del jugador, detección de cobertura,
 * tensión del sedal y cálculo de progreso de captura.
 */

export class ReelingMechanics {
  /**
   * @param {import('../types').FishingRod} rod
   * @param {import('../types').FishSpecies} species
   * @param {object} [options]
   * @param {boolean} [options.accessibleMode=false]
   * @param {boolean} [options.alternativeControls=false]
   */
  constructor(rod, species, options = {}) {
    this.rod = rod;
    this.species = species;
    this.accessibleMode = options.accessibleMode ?? false;
    this.alternativeControls = options.alternativeControls ?? false;

    // Dimensiones de la zona de captura del jugador (normalizadas 0 a 1)
    const baseSize = 0.20;
    const accessBonus = this.accessibleMode ? 0.08 : 0.0;
    this.zoneSize = Math.min(0.55, (baseSize * this.rod.zoneWidthMultiplier) + accessBonus);

    // Posición del centro de la barra del jugador (0.0 a 1.0)
    this.zonePosition = 0.25;
    this.zoneVelocity = 0;

    // Física de la barra
    this.liftAcceleration = 3.6 * this.rod.reelSpeedMultiplier;
    this.gravity = 2.4;
    this.drag = 0.88;
    this.bounceDamping = Math.min(0.65, 0.45 / (this.rod.stability || 1.0));

    // Entrada del jugador
    this.isReeling = false;
    this.targetDirectPosition = 0.25; // Para control alternativo por puntero

    // Progreso y combate (0.0 a 1.0)
    this.catchProgress = 0.35; // Inicio con margen cordial
    this.lineTension = 0.5;
    this.tensionStress = 0.0;
    this.isFishInside = false;

    // Racha / combo de precisión
    this.continuousTimeInside = 0;
    this.comboMultiplier = 1.0;

    // Métricas de precisión para calidad del pez
    this.totalCombatTime = 0;
    this.timeInsideZone = 0;

    // Velocidades de progreso según dificultad
    this._recomputeRates();
  }

  _recomputeRates() {
    const diff = Math.min(10, Math.max(1, this.species.difficulty));
    // Especies fáciles llenan más rápido; especies maestras exigen mayor constancia
    this.fillRate = Math.max(0.08, 0.22 - (diff * 0.012));
    // Drenaje cuando el pez escapa
    const baseDrain = 0.11 + (diff * 0.01);
    this.drainRate = this.accessibleMode ? baseDrain * 0.55 : baseDrain;
  }

  setAccessibleMode(enabled) {
    this.accessibleMode = enabled;
    const baseSize = 0.20;
    const accessBonus = this.accessibleMode ? 0.08 : 0.0;
    this.zoneSize = Math.min(0.55, (baseSize * this.rod.zoneWidthMultiplier) + accessBonus);
    this._recomputeRates();
  }

  setAlternativeControls(enabled) {
    this.alternativeControls = enabled;
  }

  /**
   * Actualiza el estado del control de entrada.
   * @param {boolean} active
   */
  setReelingInput(active) {
    this.isReeling = active;
  }

  /**
   * Para control alternativo (puntero directo).
   * @param {number} normalizedY (0.0 a 1.0)
   */
  setDirectTarget(normalizedY) {
    this.targetDirectPosition = Math.max(this.zoneSize / 2, Math.min(1 - this.zoneSize / 2, normalizedY));
  }

  /**
   * Actualiza la simulación para el intervalo dt (segundos).
   * @param {number} dt
   * @param {number} fishPosition (0.0 a 1.0)
   * @returns {{ status: 'in_progress' | 'caught' | 'escaped', progress: number, isInside: boolean }}
   */
  update(dt, fishPosition) {
    const clampedDt = Math.min(0.08, Math.max(0.001, dt));
    this.totalCombatTime += clampedDt;

    // Actualización de física de la barra
    if (this.alternativeControls) {
      // Seguimiento directo suavizado
      const diff = this.targetDirectPosition - this.zonePosition;
      this.zonePosition += diff * Math.min(1.0, clampedDt * 14);
      this.zoneVelocity = diff * 10;
    } else {
      // Física basada en inercia de carrete y gravedad
      if (this.isReeling) {
        this.zoneVelocity += this.liftAcceleration * clampedDt;
      } else {
        this.zoneVelocity -= this.gravity * clampedDt;
      }

      this.zoneVelocity *= Math.pow(this.drag, clampedDt * 60);
      this.zonePosition += this.zoneVelocity * clampedDt;

      // Colisión con límites [mediaZona, 1 - mediaZona]
      const half = this.zoneSize / 2;
      const minLimit = half;
      const maxLimit = 1.0 - half;

      if (this.zonePosition < minLimit) {
        this.zonePosition = minLimit;
        this.zoneVelocity = -this.zoneVelocity * this.bounceDamping;
      } else if (this.zonePosition > maxLimit) {
        this.zonePosition = maxLimit;
        this.zoneVelocity = -this.zoneVelocity * this.bounceDamping;
      }
    }

    // Detección de solapamiento con el pez
    const zoneMin = this.zonePosition - (this.zoneSize / 2);
    const zoneMax = this.zonePosition + (this.zoneSize / 2);
    this.isFishInside = fishPosition >= zoneMin && fishPosition <= zoneMax;

    if (this.isFishInside) {
      this.timeInsideZone += clampedDt;
      this.continuousTimeInside += clampedDt;

      // Multiplicador de combo por maestría continua
      if (this.continuousTimeInside >= 4.0) this.comboMultiplier = 2.0;
      else if (this.continuousTimeInside >= 2.2) this.comboMultiplier = 1.5;
      else if (this.continuousTimeInside >= 1.0) this.comboMultiplier = 1.25;
      else this.comboMultiplier = 1.0;

      this.catchProgress += this.fillRate * this.comboMultiplier * clampedDt;
      this.lineTension = Math.min(0.85, Math.max(0.4, this.lineTension + (0.15 * clampedDt)));
      this.tensionStress = Math.max(0, this.tensionStress - (0.6 * clampedDt));
    } else {
      this.continuousTimeInside = 0;
      this.comboMultiplier = 1.0;
      this.catchProgress -= this.drainRate * clampedDt;

      // Tensión forzada si el jugador recoge sin tener al pez
      if (this.isReeling) {
        this.tensionStress = Math.min(1.0, this.tensionStress + (0.5 * clampedDt));
        this.lineTension = Math.min(1.0, this.lineTension + (0.35 * clampedDt));
      } else {
        this.tensionStress = Math.max(0, this.tensionStress - (0.4 * clampedDt));
        this.lineTension = Math.max(0.1, this.lineTension - (0.28 * clampedDt));
      }
    }

    this.catchProgress = Math.min(1.0, Math.max(0.0, this.catchProgress));

    // Comprobación de fin de minijuego
    if (this.catchProgress >= 1.0) {
      return { status: 'caught', progress: 1.0, isInside: this.isFishInside };
    }

    // El pez solo escapa tras al menos 1.2 segundos de gracia inicial
    if (this.catchProgress <= 0.0 && this.totalCombatTime > 1.2) {
      return { status: 'escaped', progress: 0.0, isInside: false };
    }

    return { status: 'in_progress', progress: this.catchProgress, isInside: this.isFishInside };
  }

  /**
   * Ratio de precisión del jugador (0.0 a 1.0)
   */
  getAccuracy() {
    if (this.totalCombatTime <= 0) return 1.0;
    return Math.min(1.0, this.timeInsideZone / this.totalCombatTime);
  }

  /**
   * Calidad de la captura según precisión.
   * @returns {import('../types').CatchQuality}
   */
  calculateQuality() {
    const acc = this.getAccuracy();
    if (acc >= 0.92) return 4; // Estelar ★★★★
    if (acc >= 0.78) return 3; // Oro ★★★
    if (acc >= 0.60) return 2; // Plata ★★
    return 1;                  // Normal ★
  }
}
