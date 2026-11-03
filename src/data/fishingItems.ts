/**
 * @file fishingItems.ts
 * Definición de objetos del sistema de pesca integrados en el inventario y economía de Brumaluz:
 * Cañas, cebos, capturas y platos cocinados.
 */

import type { ItemDef } from './items';

export const FISHING_ITEMS: Record<string, ItemDef> = {
  // --- CAÑAS DE PESCA ---
  cana_pesca_sauce: {
    id: 'cana_pesca_sauce',
    label: 'Caña de sauce flexible',
    category: 'tool',
    rarity: 'common',
    description: 'Caña ligera tallada en sauce verde de la ribera de Brumaluz. Otorga un equilibrio agradable para aprender el oficio.',
    value: 45,
    stack: 1,
    stats: [
      { label: 'Anchura de zona', value: 'Estándar (1.0x)' },
      { label: 'Estabilidad', value: '1.0x' },
      { label: 'Margen de reacción', value: '+0.3 s' }
    ],
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M4 20 L19 5 C20 4 21 4 21 5 L20 8" stroke="#c4aa72" stroke-width="2"/>
      <path d="M19 5 L21 19 M21 19 C18 19 17 21 17 22" stroke="#e0f2fe" stroke-width="1.2"/>
      <circle cx="8" cy="16" r="2.5" fill="#a17145" stroke="#ffe2a0"/>
    </svg>`
  },
  cana_pesca_bambu: {
    id: 'cana_pesca_bambu',
    label: 'Caña de bambú reforzado',
    category: 'tool',
    rarity: 'uncommon',
    description: 'Vara flexible de bambú con anillas de latón. Otorga una zona de captura un 25% más ancha.',
    value: 180,
    stack: 1,
    stats: [
      { label: 'Anchura de zona', value: '+25%' },
      { label: 'Estabilidad', value: '1.15x' },
      { label: 'Margen de reacción', value: '+0.2 s' }
    ],
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M4 20 L19 5 C20 4 21 4 21 5" stroke="#65a30d" stroke-width="2.2"/>
      <path d="M19 5 L21 19" stroke="#93c5fd" stroke-width="1.2"/>
      <circle cx="8" cy="16" r="2.8" fill="#d97706" stroke="#fef08a"/>
    </svg>`
  },
  cana_pesca_fresno: {
    id: 'cana_pesca_fresno',
    label: 'Caña de fresno con carrete de cobre',
    category: 'tool',
    rarity: 'rare',
    description: 'Fabricada en el Barrio de los Artesanos con carrete desmultiplicador que recupera sedal a gran velocidad.',
    value: 650,
    stack: 1,
    stats: [
      { label: 'Velocidad de carrete', value: '+35%' },
      { label: 'Estabilidad', value: '1.2x' },
      { label: 'Anchura de zona', value: '0.95x' }
    ],
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M4 20 L19 5" stroke="#92400e" stroke-width="2.2"/>
      <path d="M19 5 L21 19" stroke="#67e8f9" stroke-width="1.4"/>
      <circle cx="8" cy="16" r="3.2" fill="#b45309" stroke="#fed7aa"/>
      <circle cx="8" cy="16" r="1.2" fill="#fff"/>
    </svg>`
  },
  cana_pesca_roble: {
    id: 'cana_pesca_roble',
    label: 'Caña de roble real y seda élfica',
    category: 'tool',
    rarity: 'legendary',
    description: 'Caña maestra de duramen de roble pulido y sedal de seda élfica. Máxima amortiguación de tensión y margen.',
    value: 2400,
    stack: 1,
    stats: [
      { label: 'Anchura de zona', value: '+20%' },
      { label: 'Estabilidad', value: '1.4x' },
      { label: 'Margen de reacción', value: '+0.5 s' }
    ],
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M4 20 L19 5" stroke="#78350f" stroke-width="2.5"/>
      <path d="M19 5 L21 19" stroke="#f472b6" stroke-width="1.5"/>
      <circle cx="8" cy="16" r="3.5" fill="#f59e0b" stroke="#fef08a"/>
      <path d="M18 4 L22 4 L20 8 Z" fill="#fef08a"/>
    </svg>`
  },

  // --- CEBOS ---
  cebo_lombriz: {
    id: 'cebo_lombriz',
    label: 'Lombriz de jardín humedecida',
    category: 'consumable',
    rarity: 'common',
    description: 'Cebo común recogido en los huertos tras la niebla matutina. Reduce el tiempo de espera de picada un 35%.',
    value: 2,
    stack: 50,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2">
      <path d="M6 18 C8 14 12 16 14 12 C16 8 18 10 20 6" stroke-linecap="round"/>
    </svg>`
  },
  cebo_gusano_seda: {
    id: 'cebo_gusano_seda',
    label: 'Gusano de seda brillante',
    category: 'consumable',
    rarity: 'rare',
    description: 'Larva fosforescente que destella en la profundidad. Aumenta un 120% la afinidad con especies raras y legendarias.',
    value: 8,
    stack: 50,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2">
      <path d="M6 18 Q12 10 18 14" stroke-linecap="round"/>
      <circle cx="18" cy="14" r="2.5" fill="#a5f3fc"/>
    </svg>`
  },
  cebo_baya_rio: {
    id: 'cebo_baya_rio',
    label: 'Baya dulce de río',
    category: 'food',
    rarity: 'common',
    description: 'Fruto silvestre aromático de la ribera. Calma el nado de peces nerviosos un 20%.',
    value: 3,
    stack: 50,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="1.8">
      <circle cx="10" cy="14" r="4.5" fill="#f43f5e"/>
      <circle cx="15" cy="13" r="3.5" fill="#fb7185"/>
      <path d="M12 9 C12 6 15 5 16 4" stroke="#15803d"/>
    </svg>`
  },
  cebo_insecto_bruma: {
    id: 'cebo_insecto_bruma',
    label: 'Insecto de bruma',
    category: 'consumable',
    rarity: 'uncommon',
    description: 'Efímero atrapado en la bruma de Brumaluz. Atrae especies nocturnas y esquivas.',
    value: 5,
    stack: 50,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="1.8">
      <ellipse cx="12" cy="13" rx="3" ry="5" fill="#38bdf8"/>
      <path d="M9 11 C6 9 6 6 8 6 M15 11 C18 9 18 6 16 6" stroke="#93c5fd"/>
    </svg>`
  },

  // --- PECES CAPTURADOS ---
  pez_trucha_plateada: {
    id: 'pez_trucha_plateada',
    label: 'Trucha plateada de Brumaluz',
    category: 'food',
    rarity: 'common',
    description: 'Pez de río limpio y ágil muy apreciado para la cocina de la posada Lucero del Alba.',
    value: 14,
    stack: 20,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="1.8">
      <path d="M3 12 C7 7 16 7 21 12 C16 17 7 17 3 12 Z" fill="#bae6fd"/>
      <circle cx="18" cy="11" r="1.2" fill="#0f172a"/>
    </svg>`
  },
  pez_perca_atigrada: {
    id: 'pez_perca_atigrada',
    label: 'Perca atigrada de farol',
    category: 'food',
    rarity: 'common',
    description: 'Pez con rayas doradas que frecuenta las sombras de los muelles bajo los faroles de cobre.',
    value: 18,
    stack: 20,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="1.8">
      <path d="M3 12 C7 7 16 7 21 12 C16 17 7 17 3 12 Z" fill="#fde68a"/>
      <path d="M10 8 L11 16 M14 8 L15 16" stroke="#78350f" stroke-width="1.4"/>
      <circle cx="18" cy="11" r="1.2" fill="#0f172a"/>
    </svg>`
  },
  pez_siluro_olmo: {
    id: 'pez_siluro_olmo',
    label: 'Siluro barbado del Olmo',
    category: 'food',
    rarity: 'uncommon',
    description: 'Coloso de los fondos del Barrio del Olmo. Carne consistente ideal para guisos reconfortantes.',
    value: 36,
    stack: 10,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="1.8">
      <path d="M3 12 C8 6 18 6 22 12 C17 18 7 18 3 12 Z" fill="#94a3b8"/>
      <path d="M19 14 Q22 17 23 16" stroke="#cbd5e1"/>
      <circle cx="19" cy="10" r="1.2" fill="#0f172a"/>
    </svg>`
  },
  pez_carpa_dorada: {
    id: 'pez_carpa_dorada',
    label: 'Carpa dorada de Brumaluz',
    category: 'food',
    rarity: 'uncommon',
    description: 'Símbolo de buena fortuna entre los artesanos de Brumaluz. Sus escamas destellan como bronce pulido.',
    value: 45,
    stack: 15,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.8">
      <path d="M3 12 C7 6 17 6 21 12 C17 18 7 18 3 12 Z" fill="#fbbf24"/>
      <circle cx="18" cy="11" r="1.4" fill="#78350f"/>
    </svg>`
  },
  pez_salmon_alba: {
    id: 'pez_salmon_alba',
    label: 'Salmón real del Lucero del Alba',
    category: 'food',
    rarity: 'rare',
    description: 'Pez noble y vigoroso que remonta los arroyos saltando cascadas. Ingrediente de recetas exquisitas.',
    value: 75,
    stack: 10,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="1.8">
      <path d="M3 12 C7 6 17 6 21 12 C17 18 7 18 3 12 Z" fill="#fda4af"/>
      <circle cx="18" cy="11" r="1.3" fill="#0f172a"/>
    </svg>`
  },
  pez_lucio_esmeralda: {
    id: 'pez_lucio_esmeralda',
    label: 'Lucio esmeralda de los cañaverales',
    category: 'food',
    rarity: 'rare',
    description: 'Cazador alargado de escamas verdes que acecha entre juncos fluviales con aceleraciones fulgurantes.',
    value: 85,
    stack: 10,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#047857" stroke-width="1.8">
      <path d="M2 12 C8 8 18 8 22 12 C18 16 8 16 2 12 Z" fill="#6ee7b7"/>
      <circle cx="19" cy="11" r="1.3" fill="#064e3b"/>
    </svg>`
  },
  pez_anguila_luminosa: {
    id: 'pez_anguila_luminosa',
    label: 'Anguila luminosa de bruma',
    category: 'resource',
    rarity: 'rare',
    description: 'Criatura serpentina bioluminiscente. Su esencia brillante es muy codiciada por alquimistas y artesanos.',
    value: 95,
    stack: 10,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2.2">
      <path d="M4 12 Q8 6 12 12 T20 12" stroke="#38bdf8"/>
      <circle cx="20" cy="12" r="2.2" fill="#e0f2fe"/>
    </svg>`
  },
  pez_esturion_ancestral: {
    id: 'pez_esturion_ancestral',
    label: 'Esturión ancestral de Pompelín',
    category: 'food',
    rarity: 'legendary',
    description: 'Gigante blindado con placas óseas que habita las fosas del río desde la fundación del reino.',
    value: 240,
    stack: 5,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#4338ca" stroke-width="1.8">
      <path d="M2 12 C8 6 18 6 22 12 C18 18 8 18 2 12 Z" fill="#a5b4fc"/>
      <polygon points="8,10 11,8 14,10 17,8 20,10" stroke="#312e81" fill="none"/>
    </svg>`
  },
  pez_luna_mistico: {
    id: 'pez_luna_mistico',
    label: 'Pez luna místico',
    category: 'resource',
    rarity: 'legendary',
    description: 'Ser esférico nacarado que refleja las constelaciones sobre las aguas quietas de La Arboleda.',
    value: 320,
    stack: 5,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#7e22ce" stroke-width="1.8">
      <circle cx="12" cy="12" r="7.5" fill="#e9d5ff" stroke="#9333ea"/>
      <circle cx="15" cy="10" r="1.4" fill="#581c87"/>
    </svg>`
  },
  pez_draco_alevin: {
    id: 'pez_draco_alevin',
    label: 'Draco-alevín de polvo de hada',
    category: 'special',
    rarity: 'artifact',
    description: 'Diminuto pez de ensueño que despide chispas mágicas donde el polvo de hada toca manantiales puros.',
    value: 500,
    stack: 5,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2">
      <path d="M4 14 Q10 6 16 14 T22 10" stroke="#f43f5e"/>
      <circle cx="15" cy="13" r="3.5" fill="#fecdd3"/>
      <path d="M12 6 L14 4 M17 7 L19 5" stroke="#ffe4e6"/>
    </svg>`
  }
};
