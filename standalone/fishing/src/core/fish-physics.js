/**
 * @file fish-physics.js
 * Simulación física y patrones de movimiento del pez durante la captura.
 * Implementa movimiento analítico y procedural con suavizado e inercia.
 */

export class FishPhysics {
  /**
   * @param {import('../types').FishSpecies} species
   * @param {object} [options]
   * @param {number} [options.calmModifier=1.0]
   * @param {boolean} [options.accessibleMode=false]
   * @param {number} [options.speedMultiplier=1.0]
   */
  constructor(species, options = {}) {
    this.species = species;
    this.calmModifier = options.calmModifier ?? 1.0;
    this.accessibleMode = options.accessibleMode ?? false;
    this.speedMultiplier = options.speedMultiplier ?? 1.0;

    // Posición normalizada: 0.0 (fondo) a 1.0 (superficie)
    this.position = 0.5;
    this.targetPosition = 0.5;
    this.velocity = 0;
    this.facingDirection = 1; // 1 hacia arriba, -1 hacia abajo

    // Cronómetros internos de comportamiento
    this.timer = 0;
    this.nextDecisionTime = 0.8;
    this.isDashing = false;
    this.dashTimer = 0;

    // Parámetros calculados según dificultad
    this._recomputeDynamics();
  }

  _recomputeDynamics() {
    const diff = Math.min(10, Math.max(1, this.species.difficulty));
    const accessMod = this.accessibleMode ? 0.75 : 1.0;

    // Velocidad efectiva
    this.effectiveSpeed = this.species.baseSpeed * (0.8 + diff * 0.12) * this.calmModifier * this.speedMultiplier * accessMod;

    // Frecuencia de cambio de dirección
    this.decisionIntervalBase = Math.max(0.4, 2.2 - (diff * 0.16));
  }

  setSpeedMultiplier(mult) {
    this.speedMultiplier = mult;
    this._recomputeDynamics();
  }

  setCalmModifier(mod) {
    this.calmModifier = mod;
    this._recomputeDynamics();
  }

  setAccessibleMode(enabled) {
    this.accessibleMode = enabled;
    this._recomputeDynamics();
  }

  /**
   * Actualiza la posición y patrón del pez para el intervalo dt (segundos).
   * @param {number} dt
   */
  update(dt) {
    // Evitar saltos temporales extremos en pausas de pestaña
    const clampedDt = Math.min(0.1, Math.max(0.001, dt));
    this.timer += clampedDt;

    // Toma de decisiones periódica
    if (this.timer >= this.nextDecisionTime) {
      this.timer = 0;
      this._pickNewTarget();
    }

    // Ejecutar comportamiento específico del patrón
    this._stepPattern(clampedDt);

    // Cinemática con aceleración y fricción de agua
    const distance = this.targetPosition - this.position;
    const accel = distance * this.effectiveSpeed * 4.5;

    this.velocity += accel * clampedDt;
    this.velocity *= Math.pow(0.82, clampedDt * 60); // Amortiguación fluida

    const prevPos = this.position;
    this.position += this.velocity * clampedDt;

    // Orientación visual
    if (Math.abs(this.position - prevPos) > 0.0005) {
      this.facingDirection = this.position > prevPos ? 1 : -1;
    }

    // Rebote suave en los límites [0.03, 0.97]
    if (this.position < 0.03) {
      this.position = 0.03;
      this.velocity = Math.abs(this.velocity) * 0.35;
      this.targetPosition = Math.max(this.targetPosition, 0.15);
    } else if (this.position > 0.97) {
      this.position = 0.97;
      this.velocity = -Math.abs(this.velocity) * 0.35;
      this.targetPosition = Math.min(this.targetPosition, 0.85);
    }
  }

  /**
   * Decide el próximo objetivo según el patrón de la especie.
   */
  _pickNewTarget() {
    const pattern = this.species.pattern;
    const rand = Math.random();

    switch (pattern) {
      case 'smooth': {
        // Nado continuo sin saltos grandes
        const delta = (rand - 0.5) * 0.35;
        this.targetPosition = Math.min(0.9, Math.max(0.1, this.position + delta));
        this.nextDecisionTime = this.decisionIntervalBase * (0.9 + rand * 0.4);
        break;
      }

      case 'dart': {
        // Corre a un nuevo punto y reposa
        if (rand > 0.4) {
          this.targetPosition = 0.15 + rand * 0.7;
          this.isDashing = true;
          this.dashTimer = 0.35;
        }
        this.nextDecisionTime = this.decisionIntervalBase * (0.6 + rand * 0.8);
        break;
      }

      case 'sinker': {
        // Predilección por el fondo (0.0 a 0.35)
        if (rand > 0.3) {
          this.targetPosition = 0.05 + rand * 0.28;
        } else {
          // Breve escape a media agua antes de volver a bajar
          this.targetPosition = 0.45 + rand * 0.35;
        }
        this.nextDecisionTime = this.decisionIntervalBase * (0.7 + rand * 0.6);
        break;
      }

      case 'floater': {
        // Predilección por la superficie (0.65 a 0.95)
        if (rand > 0.3) {
          this.targetPosition = 0.68 + rand * 0.27;
        } else {
          // Breve sumersión antes de volver a emerger
          this.targetPosition = 0.2 + rand * 0.35;
        }
        this.nextDecisionTime = this.decisionIntervalBase * (0.7 + rand * 0.6);
        break;
      }

      case 'erratic': {
        // Movimientos frecuentes y cambios rápidos de altura
        this.targetPosition = 0.08 + rand * 0.84;
        this.nextDecisionTime = this.decisionIntervalBase * (0.4 + rand * 0.5);
        break;
      }

      case 'rhythmic': {
        // Ciclos de subida y bajada tipo onda
        const phase = Math.sin(Date.now() / 850);
        this.targetPosition = 0.5 + phase * 0.4;
        this.nextDecisionTime = this.decisionIntervalBase * 0.5;
        break;
      }

      default: {
        this.targetPosition = 0.1 + rand * 0.8;
        this.nextDecisionTime = this.decisionIntervalBase;
      }
    }
  }

  /**
   * Ajustes dinámicos por frame según el patrón.
   * @param {number} dt
   */
  _stepPattern(dt) {
    if (this.species.pattern === 'sinker') {
      // Fuerza constante de gravedad acuática hacia el fondo
      this.velocity -= 0.15 * dt * this.effectiveSpeed;
    } else if (this.species.pattern === 'floater') {
      // Fuerza constante de flotabilidad hacia la superficie
      this.velocity += 0.15 * dt * this.effectiveSpeed;
    } else if (this.species.pattern === 'rhythmic') {
      // Micro-ondulación continua
      const wave = Math.cos(this.timer * 4.0) * 0.08;
      this.targetPosition = Math.min(0.92, Math.max(0.08, this.targetPosition + wave * dt));
    }

    if (this.isDashing) {
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
      }
    }
  }

  /**
   * Resetea el pez a un estado inicial.
   * @param {number} [startPos=0.5]
   */
  reset(startPos = 0.5) {
    this.position = startPos;
    this.targetPosition = startPos;
    this.velocity = 0;
    this.timer = 0;
    this.nextDecisionTime = 0.5;
    this.isDashing = false;
    this.dashTimer = 0;
  }
}
