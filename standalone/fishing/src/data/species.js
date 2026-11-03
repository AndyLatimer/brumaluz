/**
 * @file species.js
 * Catálogo de especies de peces para el minijuego de pesca de Brumaluz.
 * Estructura basada en datos: añadir nuevas especies no requiere modificar la lógica.
 */

/** @type {import('../types').FishSpecies[]} */
export const FISH_SPECIES = [
  {
    id: 'trucha_plateada',
    name: 'Trucha Plateada de Brumaluz',
    description: 'Pez de río de escamas brillantes que destellan con la luz de la mañana.',
    lore: 'Abunda en las corrientes limpias del río Brumaluz. Muy apreciada por los cocineros de la posada Lucero del Alba para recetas cotidianas.',
    rarity: 'common',
    difficulty: 2.2,
    baseSpeed: 1.1,
    pattern: 'smooth',
    reactionTime: 2.4,
    spawnWeight: 100,
    minDistance: 5,
    habitats: ['rio_brumaluz', 'canal_olmo', 'muelle_faroles'],
    preferredBaits: ['lombriz_jardin', 'baya_rio'],
    sizeRange: [22, 45],
    weightRange: [0.4, 2.1],
    primaryColor: '#9ec4d4',
    accentColor: '#e0f2fe',
    iconSvg: `<svg viewBox="0 0 48 28" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M4 14 C10 4, 30 5, 44 14 C30 23, 10 24, 4 14 Z" fill="rgba(158,196,212,0.35)"/>
      <path d="M4 14 L-2 8 M4 14 L-2 20"/>
      <circle cx="36" cy="12" r="1.8" fill="#fff"/>
      <path d="M22 10 Q26 14 22 18" stroke-dasharray="1 2"/>
    </svg>`
  },
  {
    id: 'perca_atigrada',
    name: 'Perca Atigrada de Farol',
    description: 'Pez ágil con franjas ocres que se camufla entre las sombras de los pilotes de madera.',
    lore: 'Suele rondar los muelles de Brumaluz al anochecer, atraída por las pequeñas polillas que caen de los faroles.',
    rarity: 'common',
    difficulty: 3.5,
    baseSpeed: 1.4,
    pattern: 'dart',
    reactionTime: 2.1,
    spawnWeight: 85,
    minDistance: 7,
    habitats: ['muelle_faroles', 'rio_brumaluz'],
    preferredBaits: ['lombriz_jardin', 'insecto_bruma'],
    sizeRange: [18, 38],
    weightRange: [0.3, 1.8],
    primaryColor: '#c99142',
    accentColor: '#f7d070',
    iconSvg: `<svg viewBox="0 0 48 28" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M4 14 C12 6, 28 6, 44 14 C28 22, 12 22, 4 14 Z" fill="rgba(201,145,66,0.35)"/>
      <path d="M16 8 L18 20 M24 7 L26 21 M32 9 L33 19" stroke="#8a5316" stroke-width="2"/>
      <circle cx="37" cy="12" r="1.8" fill="#fff"/>
    </svg>`
  },
  {
    id: 'siluro_del_olmo',
    name: 'Siluro Barbado del Olmo',
    description: 'Pez grande y corpulento de aguas profundas, con largos barbillones táctiles.',
    lore: 'Descansa en los lechos fangosos del canal del Barrio del Olmo. Su tirón hacia el fondo pone a prueba la resistencia de cualquier sedal.',
    rarity: 'uncommon',
    difficulty: 4.8,
    baseSpeed: 1.0,
    pattern: 'sinker',
    reactionTime: 2.0,
    spawnWeight: 60,
    minDistance: 12,
    habitats: ['canal_olmo', 'lago_arboleda'],
    preferredBaits: ['lombriz_jardin', 'baya_rio'],
    sizeRange: [50, 110],
    weightRange: [3.2, 14.5],
    primaryColor: '#5c6753',
    accentColor: '#95a588',
    iconSvg: `<svg viewBox="0 0 48 28" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M4 14 C10 4, 32 4, 44 13 C32 24, 8 24, 4 14 Z" fill="rgba(92,103,83,0.4)"/>
      <path d="M38 17 Q42 22 46 20 M38 18 Q41 24 43 25" stroke="#95a588"/>
      <circle cx="37" cy="11" r="1.6" fill="#fff"/>
    </svg>`
  },
  {
    id: 'carpa_dorada',
    name: 'Carpa Dorada de Brumaluz',
    description: 'Majestuoso pez de tonos cobrizos y dorados, símbolo de prosperidad artesanal.',
    lore: 'Los artesanos del Barrio de los Artesanos creen que avistar una carpa dorada trae inspiración para crear obras maestras.',
    rarity: 'uncommon',
    difficulty: 5.2,
    baseSpeed: 1.3,
    pattern: 'rhythmic',
    reactionTime: 1.9,
    spawnWeight: 50,
    minDistance: 10,
    habitats: ['rio_brumaluz', 'canal_olmo', 'lago_arboleda'],
    preferredBaits: ['gusano_brillante', 'baya_rio'],
    sizeRange: [35, 68],
    weightRange: [1.8, 6.2],
    primaryColor: '#d48834',
    accentColor: '#ffd166',
    iconSvg: `<svg viewBox="0 0 48 28" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M4 14 C10 5, 28 4, 44 14 C28 24, 10 23, 4 14 Z" fill="rgba(212,136,52,0.4)"/>
      <path d="M18 6 Q24 2 30 6" stroke="#ffd166"/>
      <circle cx="36" cy="12" r="1.9" fill="#ffe2a0"/>
    </svg>`
  },
  {
    id: 'salmon_del_alba',
    name: 'Salmón Real del Lucero del Alba',
    description: 'Pez poderoso y atlético que remonta las corrientes de Brumaluz con saltos enérgicos.',
    lore: 'Remonta el río buscando aguas puras. Cuando muerde el anzuelo, pugna con feroces sacudidas hacia la superficie.',
    rarity: 'rare',
    difficulty: 6.8,
    baseSpeed: 1.8,
    pattern: 'floater',
    reactionTime: 1.7,
    spawnWeight: 35,
    minDistance: 15,
    habitats: ['rio_brumaluz', 'lago_arboleda'],
    preferredBaits: ['gusano_brillante', 'insecto_bruma'],
    sizeRange: [55, 95],
    weightRange: [2.5, 9.8],
    primaryColor: '#d96b52',
    accentColor: '#fca5a5',
    iconSvg: `<svg viewBox="0 0 48 28" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M4 14 C12 5, 32 5, 44 14 C32 23, 12 23, 4 14 Z" fill="rgba(217,107,82,0.4)"/>
      <path d="M30 6 L33 11 M22 7 L24 11" stroke="#fca5a5"/>
      <circle cx="36" cy="12" r="1.8" fill="#fff"/>
    </svg>`
  },
  {
    id: 'lucio_esmeralda',
    name: 'Lucio Esmeralda de los Cañaverales',
    description: 'Depredador alargado de ojos penetrantes y relucientes escamas verde botella.',
    lore: 'Se oculta inmóvil entre los juncos hasta que ataca en una fracción de segundo con aceleraciones vertiginosas.',
    rarity: 'rare',
    difficulty: 7.2,
    baseSpeed: 2.1,
    pattern: 'erratic',
    reactionTime: 1.5,
    spawnWeight: 28,
    minDistance: 16,
    habitats: ['canal_olmo', 'muelle_faroles'],
    preferredBaits: ['insecto_bruma', 'lombriz_jardin'],
    sizeRange: [60, 115],
    weightRange: [2.8, 11.0],
    primaryColor: '#2f7a5b',
    accentColor: '#6ee7b7',
    iconSvg: `<svg viewBox="0 0 48 28" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M2 14 C14 8, 34 8, 46 14 C34 20, 14 20, 2 14 Z" fill="rgba(47,122,91,0.4)"/>
      <path d="M42 14 L46 12 L46 16 Z" fill="#6ee7b7"/>
      <circle cx="38" cy="12" r="1.7" fill="#fff"/>
    </svg>`
  },
  {
    id: 'anguila_luminosa',
    name: 'Anguila Luminosa de Bruma',
    description: 'Criatura serpentina que emite un pulso suave de luz cian en las aguas nocturnas.',
    lore: 'Se cuenta que nadan guiadas por la bruma de Pompelín. Su cuerpo resbaladizo desafía los reflejos del pescador.',
    rarity: 'rare',
    difficulty: 7.6,
    baseSpeed: 1.9,
    pattern: 'smooth',
    reactionTime: 1.6,
    spawnWeight: 22,
    minDistance: 18,
    habitats: ['rio_brumaluz', 'muelle_faroles', 'lago_arboleda'],
    preferredBaits: ['insecto_bruma', 'gusano_brillante'],
    sizeRange: [65, 125],
    weightRange: [1.2, 4.5],
    primaryColor: '#38bdf8',
    accentColor: '#a5f3fc',
    iconSvg: `<svg viewBox="0 0 48 28" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M4 14 Q14 6 24 14 T44 14" stroke="#38bdf8" stroke-width="3" fill="none"/>
      <circle cx="43" cy="14" r="2.2" fill="#a5f3fc"/>
    </svg>`
  },
  {
    id: 'esturion_ancestral',
    name: 'Esturión Ancestral de Pompelín',
    description: 'Coloso de placas óseas que habita las fosas más hondas desde tiempos inmemoriales.',
    lore: 'Los ancianos afirman que este pez ya surcaba los ríos antes de que se encendiera el primer farol de Brumaluz. Pesar y capturar uno es una hazaña de maestría.',
    rarity: 'legendary',
    difficulty: 8.8,
    baseSpeed: 1.6,
    pattern: 'sinker',
    reactionTime: 1.3,
    spawnWeight: 10,
    minDistance: 22,
    habitats: ['rio_brumaluz', 'lago_arboleda'],
    preferredBaits: ['gusano_brillante'],
    sizeRange: [120, 240],
    weightRange: [25.0, 85.0],
    primaryColor: '#6366f1',
    accentColor: '#c7d2fe',
    iconSvg: `<svg viewBox="0 0 48 28" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M2 14 C10 4, 34 5, 46 14 C34 23, 10 24, 2 14 Z" fill="rgba(99,102,241,0.3)"/>
      <polygon points="12,12 16,8 20,12 24,8 28,12 32,8 36,12" stroke="#c7d2fe" fill="none"/>
      <circle cx="40" cy="12" r="2" fill="#fff"/>
    </svg>`
  },
  {
    id: 'pez_luna_mistico',
    name: 'Pez Luna Místico',
    description: 'Ser esférico y casi traslúcido que refleja las constelaciones sobre el agua quieta.',
    lore: 'Solo emerge cuando la luna ilumina la niebla de La Arboleda. Su nado rítmico parece acompasado con las melodías del bosque.',
    rarity: 'legendary',
    difficulty: 9.2,
    baseSpeed: 2.2,
    pattern: 'rhythmic',
    reactionTime: 1.2,
    spawnWeight: 8,
    minDistance: 24,
    habitats: ['lago_arboleda'],
    preferredBaits: ['gusano_brillante', 'insecto_bruma'],
    sizeRange: [70, 140],
    weightRange: [15.0, 42.0],
    primaryColor: '#c084fc',
    accentColor: '#f3e8ff',
    iconSvg: `<svg viewBox="0 0 48 28" fill="none" stroke="currentColor" stroke-width="1.8">
      <circle cx="24" cy="14" r="10" fill="rgba(192,132,252,0.35)" stroke="#c084fc"/>
      <path d="M4 14 L14 14 M34 14 L44 14" stroke="#c084fc"/>
      <circle cx="28" cy="11" r="1.8" fill="#fff"/>
    </svg>`
  },
  {
    id: 'draco_alevin_hada',
    name: 'Draco-Alevín de Polvo de Hada',
    description: 'Diminuto pez de ensueño que despide chispas mágicas al agitar sus aletas traslúcidas.',
    lore: 'Los relatos de Gnomi dicen que estos seres nacen donde el polvo de hada toca las aguas calmas del manantial. Su movimiento es caprichoso y vibrante como una brisa mágica.',
    rarity: 'mythical',
    difficulty: 9.8,
    baseSpeed: 2.5,
    pattern: 'erratic',
    reactionTime: 1.0,
    spawnWeight: 4,
    minDistance: 26,
    habitats: ['lago_arboleda', 'rio_brumaluz'],
    preferredBaits: ['insecto_bruma'],
    sizeRange: [15, 30],
    weightRange: [0.1, 0.6],
    primaryColor: '#f43f5e',
    accentColor: '#ffe4e6',
    iconSvg: `<svg viewBox="0 0 48 28" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M6 14 Q16 4 28 14 T44 10" stroke="#f43f5e" stroke-width="2.2" fill="none"/>
      <circle cx="26" cy="14" r="5" fill="rgba(244,63,94,0.3)"/>
      <circle cx="28" cy="12" r="1.5" fill="#fff"/>
      <path d="M22 6 L24 2 M30 8 L33 4" stroke="#ffe4e6"/>
    </svg>`
  }
];

/**
 * Busca una especie por ID.
 * @param {string} id
 * @returns {import('../types').FishSpecies | undefined}
 */
export function getSpeciesById(id) {
  return FISH_SPECIES.find(s => s.id === id);
}
