/**
 * @file state-machine.js
 * Máquina de estados determinista para el ciclo de pesca completo.
 * Gestiona transiciones válidas, cronómetros y eventos de ciclo de vida.
 */

export class FishingStateMachine {
  /**
   * @param {object} [callbacks]
   * @param {(from: import('../types').FishingPhase, to: import('../types').FishingPhase) => void} [callbacks.onTransition]
   */
  constructor(callbacks = {}) {
    /** @type {import('../types').FishingPhase} */
    this.currentPhase = 'IDLE';
    this.onTransition = callbacks.onTransition || (() => {});

    // Tabla de transiciones permitidas
    this.validTransitions = {
      IDLE: ['PREPARATION', 'CASTING'],
      PREPARATION: ['CASTING', 'IDLE'],
      CASTING: ['WAITING', 'PREPARATION', 'IDLE'],
      WAITING: ['HOOKING', 'PREPARATION', 'IDLE'],
      HOOKING: ['REELING', 'RESULT', 'PREPARATION', 'IDLE'],
      REELING: ['RESULT', 'PREPARATION', 'IDLE'],
      RESULT: ['PREPARATION', 'CASTING', 'IDLE']
    };
  }

  /**
   * @returns {import('../types').FishingPhase}
   */
  getPhase() {
    return this.currentPhase;
  }

  /**
   * Intenta cambiar a una nueva fase.
   * @param {import('../types').FishingPhase} nextPhase
   * @returns {boolean} true si la transición fue válida
   */
  transition(nextPhase) {
    if (this.currentPhase === nextPhase) return true;

    const allowed = this.validTransitions[this.currentPhase];
    if (!allowed || !allowed.includes(nextPhase)) {
      console.warn(`[FishingStateMachine] Transición no permitida: ${this.currentPhase} -> ${nextPhase}`);
      return false;
    }

    const prevPhase = this.currentPhase;
    this.currentPhase = nextPhase;
    this.onTransition(prevPhase, nextPhase);
    return true;
  }

  /**
   * Cancela la sesión actual y regresa a IDLE.
   */
  cancel() {
    this.transition('IDLE');
  }

  /**
   * Reinicia el flujo a la fase de preparación.
   */
  restart() {
    this.transition('PREPARATION');
  }
}
