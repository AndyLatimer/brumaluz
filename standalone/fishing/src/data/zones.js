/**
 * @file zones.js
 * Zonas de pesca inspiradas en el mundo de Pompelín y Brumaluz.
 */

/** @type {import('../types').FishingZone[]} */
export const FISHING_ZONES = [
  {
    id: 'rio_brumaluz',
    name: 'Río Brumaluz - Ribera de los Sauces',
    description: 'Corrientes claras y cantarinas que bordean las murallas exteriores de la capital.',
    region: 'Brumaluz',
    waterType: 'river',
    baseBiteMinSeconds: 2.5,
    baseBiteMaxSeconds: 5.5,
    availableSpeciesIds: [
      'trucha_plateada',
      'perca_atigrada',
      'carpa_dorada',
      'salmon_del_alba',
      'anguila_luminosa',
      'esturion_ancestral',
      'draco_alevin_hada'
    ]
  },
  {
    id: 'canal_olmo',
    name: 'Canal del Barrio del Olmo',
    description: 'Aguas pausadas bajo las ramas centenarias del olmo, cerca de las viviendas vecinales.',
    region: 'Brumaluz',
    waterType: 'canal',
    baseBiteMinSeconds: 3.0,
    baseBiteMaxSeconds: 6.0,
    availableSpeciesIds: [
      'trucha_plateada',
      'siluro_del_olmo',
      'carpa_dorada',
      'lucio_esmeralda'
    ]
  },
  {
    id: 'muelle_faroles',
    name: 'Muelle de los Faroles',
    description: 'Embarcadero de madera cálida iluminado por los faroles de cobre de la ciudad.',
    region: 'Brumaluz',
    waterType: 'river',
    baseBiteMinSeconds: 2.0,
    baseBiteMaxSeconds: 4.8,
    availableSpeciesIds: [
      'perca_atigrada',
      'trucha_plateada',
      'lucio_esmeralda',
      'anguila_luminosa'
    ]
  },
  {
    id: 'lago_arboleda',
    name: 'Lago Cristalino de La Arboleda',
    description: 'Espejo de agua profundo y sereno envuelto en la espesura del bosque misterioso.',
    region: 'La Arboleda',
    waterType: 'lake',
    baseBiteMinSeconds: 3.5,
    baseBiteMaxSeconds: 7.0,
    availableSpeciesIds: [
      'carpa_dorada',
      'siluro_del_olmo',
      'salmon_del_alba',
      'esturion_ancestral',
      'pez_luna_mistico',
      'draco_alevin_hada'
    ]
  }
];

/**
 * @param {string} id
 * @returns {import('../types').FishingZone}
 */
export function getZoneById(id) {
  return FISHING_ZONES.find(z => z.id === id) || FISHING_ZONES[0];
}
