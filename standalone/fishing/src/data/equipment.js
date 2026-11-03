/**
 * @file equipment.js
 * Catálogo de cañas y cebos configurables para el minijuego de pesca.
 * Proporciona diferencias mecánicas claras para la progresión del jugador.
 */

/** @type {import('../types').FishingRod[]} */
export const FISHING_RODS = [
  {
    id: 'cana_sauce',
    name: 'Caña de Sauce Flexible',
    description: 'Caña tradicional tallada en madera verde de sauce. Ligera, equilibrada y muy accesible para iniciarse.',
    zoneWidthMultiplier: 1.0,
    stability: 1.0,
    reelSpeedMultiplier: 1.0,
    reactionBonus: 0.3,
    icon: '🎋'
  },
  {
    id: 'cana_bambu',
    name: 'Caña de Bambú Reforzado',
    description: 'Vara flexible de bambú con anillas de latón. Otorga una zona de captura más amplia y tolerante.',
    zoneWidthMultiplier: 1.25,
    stability: 1.15,
    reelSpeedMultiplier: 0.95,
    reactionBonus: 0.2,
    icon: '🎋'
  },
  {
    id: 'cana_fresno_cobre',
    name: 'Caña de Fresno con Carrete de Cobre',
    description: 'Obra de los artesanos de Brumaluz. Carrete desmultiplicador que recupera sedal a gran velocidad.',
    zoneWidthMultiplier: 0.95,
    stability: 1.2,
    reelSpeedMultiplier: 1.35,
    reactionBonus: 0.15,
    icon: '🎣'
  },
  {
    id: 'cana_roble_elfico',
    name: 'Caña de Roble Real y Seda Élfica',
    description: 'Caña maestra de duramen de roble pulido y sedal de seda élfica. Máxima amortiguación y tiempo de reacción.',
    zoneWidthMultiplier: 1.2,
    stability: 1.4,
    reelSpeedMultiplier: 1.2,
    reactionBonus: 0.5,
    icon: '✨'
  }
];

/** @type {import('../types').FishingBait[]} */
export const FISHING_BAITS = [
  {
    id: 'sin_cebo',
    name: 'Sin Cebo',
    description: 'Pesca tradicional a vista. Tiempos de espera estándar.',
    biteTimeMultiplier: 1.0,
    rarityBonus: 1.0,
    calmModifier: 1.0,
    icon: '🪝'
  },
  {
    id: 'lombriz_jardin',
    name: 'Lombriz de Jardín Humedecida',
    description: 'Cebo vivo clásico recogido tras la lluvia. Reduce considerablemente la espera de la picada.',
    biteTimeMultiplier: 0.65,
    rarityBonus: 1.1,
    calmModifier: 1.0,
    icon: '🪱'
  },
  {
    id: 'gusano_brillante',
    name: 'Gusano de Seda Brillante',
    description: 'Larva fosforescente que destella en la profundidad. Gran afinidad con peces raros y legendarios.',
    biteTimeMultiplier: 0.8,
    rarityBonus: 2.2,
    calmModifier: 0.95,
    icon: '✨'
  },
  {
    id: 'baya_rio',
    name: 'Baya Dulce de Río',
    description: 'Fruto silvestre muy aromático. Suaviza el nado de los peces nerviosos, haciendo la captura más dócil.',
    biteTimeMultiplier: 0.9,
    rarityBonus: 1.0,
    calmModifier: 0.8,
    icon: '🍒'
  },
  {
    id: 'insecto_bruma',
    name: 'Insecto de Bruma',
    description: 'Pequeño efímero atrapado en la niebla matutina de Brumaluz. Atrae especies sigilosas y nocturnas.',
    biteTimeMultiplier: 0.75,
    rarityBonus: 1.8,
    calmModifier: 1.0,
    icon: '🦗'
  }
];

/**
 * @param {string} id
 * @returns {import('../types').FishingRod}
 */
export function getRodById(id) {
  return FISHING_RODS.find(r => r.id === id) || FISHING_RODS[0];
}

/**
 * @param {string} id
 * @returns {import('../types').FishingBait}
 */
export function getBaitById(id) {
  return FISHING_BAITS.find(b => b.id === id) || FISHING_BAITS[0];
}
