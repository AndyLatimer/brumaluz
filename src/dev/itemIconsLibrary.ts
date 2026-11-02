// Biblioteca organizada de iconos SVG vectoriales para el selector de recursos visuales
export interface PresetIcon {
  id: string;
  name: string;
  category: string;
  tags: string[];
  svg: string;
}

export const PRESET_ICONS: PresetIcon[] = [
  // --- ARMAS ---
  {
    id: 'espada_acero',
    name: 'Espada de acero',
    category: 'weapon',
    tags: ['espada', 'acero', 'arma', 'filo'],
    svg: '<path d="m19 5 2-2-3-1-1 3-10 10-3-1-1 2 2 2-3 3 2 2 3-3 2 2 2-1-1-3 10-10Z" fill="#d2dbe0" stroke="#384852" stroke-width="1.1"/><path d="m9 15 2 2" stroke="#9e7845" stroke-width="2"/><path d="M17 7 8 16" stroke="#f8f9fa" stroke-width="0.8"/>',
  },
  {
    id: 'daga_sigilo',
    name: 'Daga de sigilo',
    category: 'weapon',
    tags: ['daga', 'picaro', 'sigilo', 'arma'],
    svg: '<path d="m8 15 9-12 1 7-7 8Z" fill="#c0cad0" stroke="#725338" stroke-width="1"/><path d="m5 14 7 5M5 21l4-5" stroke="#8c623e" stroke-width="2"/>',
  },
  {
    id: 'baston_arcano',
    name: 'Bastón arcano',
    category: 'weapon',
    tags: ['baston', 'mago', 'magia', 'joya'],
    svg: '<path d="m7 21 9-17" stroke="#8c623e" stroke-width="3" stroke-linecap="round"/><circle cx="16" cy="5" r="3.5" fill="#9b8bd0" stroke="#5d4c94" stroke-width="1"/>',
  },
  {
    id: 'varita_luz',
    name: 'Varita de luz',
    category: 'weapon',
    tags: ['varita', 'clerigo', 'magia', 'estrella'],
    svg: '<path d="m5 21 11-15" stroke="#8c623e" stroke-width="3" stroke-linecap="round"/><path d="m17 2 1 3 3 1-3 2-1 3-2-3-3-2 3-1Z" fill="#ead191" stroke="#a38234" stroke-width="0.8"/>',
  },
  {
    id: 'arco_largo',
    name: 'Arco largo',
    category: 'weapon',
    tags: ['arco', 'explorador', 'madera', 'cuerda'],
    svg: '<path d="M5 3q16 8 14 18M6 4l12 16" fill="none" stroke="#8b5a2b" stroke-width="2" stroke-linecap="round"/><path d="M18 19q-2-7-10-14" fill="none" stroke="#c2b280" stroke-width="1.2"/>',
  },
  {
    id: 'escudo_roble',
    name: 'Escudo de roble',
    category: 'weapon',
    tags: ['escudo', 'defensa', 'roble', 'madera'],
    svg: '<path d="M6 5q12-4 12 0v7c0 6-6 9-6 9s-6-3-6-9Z" fill="#9e7545" stroke="#4a3219" stroke-width="1.2"/><path d="M12 4v16M6 10h12" stroke="#d4ba8a" stroke-width="1.2"/>',
  },
  {
    id: 'grimorio_hechizos',
    name: 'Grimorio de hechizos',
    category: 'weapon',
    tags: ['libro', 'grimorio', 'mago', 'runas'],
    svg: '<path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2Z" fill="#584b7a" stroke="#2d2247" stroke-width="1.2"/><path d="M5 4v16" stroke="#c7ac73" stroke-width="2"/><circle cx="12" cy="11" r="3" fill="#e5be4b" stroke="#86600c"/>',
  },
  {
    id: 'hacha_batalla',
    name: 'Hacha de batalla',
    category: 'weapon',
    tags: ['hacha', 'guerrero', 'doble', 'metal'],
    svg: '<path d="m5 20 10-14" stroke="#5a3d24" stroke-width="3" stroke-linecap="round"/><path d="M11 5q5-4 7 0-1 4-3 5m-2-4q-4-4-6 0 1 4 3 5" fill="#a4b0b8" stroke="#4a555e" stroke-width="1"/>',
  },

  // --- ARMADURAS Y ROPA ---
  {
    id: 'casco_caballero',
    name: 'Casco de caballero',
    category: 'armor',
    tags: ['casco', 'cabeza', 'metal', 'armadura'],
    svg: '<path d="M6 14V9a6 6 0 0 1 12 0v5l-2 5H8Z" fill="#8c979e" stroke="#3b4347" stroke-width="1.2"/><path d="M7 11h10M12 9v6" stroke="#2b3236" stroke-width="1.5"/><path d="M12 3v3" stroke="#c44536" stroke-width="2"/>',
  },
  {
    id: 'coraza_hierro',
    name: 'Coraza de hierro',
    category: 'armor',
    tags: ['pecho', 'coraza', 'armadura', 'torso'],
    svg: '<path d="m7 4 5 2 5-2 3 6-2 3-1 8H7L6 13 4 10Z" fill="#7a858c" stroke="#373d42" stroke-width="1.2"/><path d="M12 6v15M8 11h8" stroke="#aab4bc" stroke-width="1"/>',
  },
  {
    id: 'guantes_cuero',
    name: 'Guantes de cuero',
    category: 'armor',
    tags: ['manos', 'guantes', 'cuero', 'proteccion'],
    svg: '<path d="M8 19V11a2 2 0 0 1 4 0v8m-4-4h4m1-4a1.5 1.5 0 0 1 3 0v7a2 2 0 0 1-2 2H9" fill="#9e6d42" stroke="#52351c" stroke-width="1.1"/>',
  },
  {
    id: 'grebas_botas',
    name: 'Botas de viaje reforzadas',
    category: 'armor',
    tags: ['piernas', 'botas', 'calzado', 'viaje'],
    svg: '<path d="M6 4h4v10l3 2v4H5v-4l1-2Zm8 0h4v10l3 2v4h-8v-4l1-2Z" fill="#5c432d" stroke="#2b1c0e" stroke-width="1.1"/><path d="M6 10h4m4 0h4" stroke="#c9a779" stroke-width="1"/>',
  },
  {
    id: 'anillo_oro_rubi',
    name: 'Anillo de oro y rubí',
    category: 'armor',
    tags: ['anillo', 'joya', 'oro', 'rubi', 'accesorio'],
    svg: '<circle cx="12" cy="13" r="6" fill="none" stroke="#d4af37" stroke-width="2.5"/><path d="m12 5 3 4-3 4-3-4Z" fill="#c42835" stroke="#680b13" stroke-width="0.8"/>',
  },
  {
    id: 'amuleto_zafiro',
    name: 'Amuleto de zafiro',
    category: 'armor',
    tags: ['colgante', 'collar', 'amuleto', 'zafiro', 'accesorio'],
    svg: '<path d="M6 3q6 8 6 11M18 3q-6 8-6 11" fill="none" stroke="#a0a8b0" stroke-width="1.2"/><circle cx="12" cy="15" r="4.5" fill="#2b6cb0" stroke="#103254" stroke-width="1.2"/><path d="m12 12 2 3-2 3-2-3Z" fill="#8bc2f7"/>',
  },

  // --- HERRAMIENTAS ---
  {
    id: 'pico_cantero',
    name: 'Pico de minero',
    category: 'tool',
    tags: ['herramienta', 'pico', 'minero', 'extraccion'],
    svg: '<path d="m5 20 10-14" stroke="#5c3a21" stroke-width="3" stroke-linecap="round"/><path d="M4 7q8-6 16 1-4 3-8 2-4 3-8-3Z" fill="#7a8288" stroke="#384045" stroke-width="1.1"/>',
  },
  {
    id: 'hacha_lenador',
    name: 'Hacha de tala',
    category: 'tool',
    tags: ['herramienta', 'hacha', 'lenador', 'tala'],
    svg: '<path d="m6 21 9-16" stroke="#5c3a21" stroke-width="3" stroke-linecap="round"/><path d="M12 5c2-3 6-2 7 1l-1 5c-2 2-5 1-6-2Z" fill="#85929c" stroke="#3e474f" stroke-width="1.1"/>',
  },
  {
    id: 'hoz_cosecha',
    name: 'Hoz de recolector',
    category: 'tool',
    tags: ['herramienta', 'hoz', 'recolector', 'plantas'],
    svg: '<path d="m7 20 3-7" stroke="#5c3a21" stroke-width="3" stroke-linecap="round"/><path d="M9 13q0-10 9-6 2 8-8 8" fill="none" stroke="#909aa0" stroke-width="2.5" stroke-linecap="round"/>',
  },

  // --- ALIMENTOS Y BEBIDAS ---
  {
    id: 'pan_hogaza',
    name: 'Hogaza de pan dorado',
    category: 'food',
    tags: ['pan', 'alimento', 'comida', 'trigo'],
    svg: '<ellipse cx="12" cy="15" rx="8" ry="5" fill="#c48a43" stroke="#684214" stroke-width="1.2"/><path d="m8 12 3 4m2-4 3 4" stroke="#f6d396" stroke-width="1.5" stroke-linecap="round"/>',
  },
  {
    id: 'guiso_caliente',
    name: 'Plato de guiso caliente',
    category: 'food',
    tags: ['guiso', 'comida', 'carne', 'caliente'],
    svg: '<ellipse cx="12" cy="16" rx="8" ry="4" fill="#68341e" stroke="#3a1b0d" stroke-width="1"/><ellipse cx="12" cy="15" rx="7" ry="3" fill="#a44820"/><path d="M8 8q2-4 2 0t2 0m2-4q2-4 2 0t2 0" fill="none" stroke="#e0d0b0" stroke-width="1" stroke-linecap="round"/>',
  },
  {
    id: 'manzana_fresca',
    name: 'Manzana silvestre',
    category: 'food',
    tags: ['fruta', 'manzana', 'silvestre', 'fresco'],
    svg: '<circle cx="12" cy="14" r="6" fill="#c93838" stroke="#681515" stroke-width="1.2"/><path d="M12 8q2-4 4-3m-4 3v-3" fill="none" stroke="#523315" stroke-width="1.3" stroke-linecap="round"/>',
  },
  {
    id: 'jarra_cerveza',
    name: 'Jarra de posada',
    category: 'food',
    tags: ['bebida', 'jarra', 'posada', 'espuma'],
    svg: '<rect x="7" y="8" width="8" height="12" rx="2" fill="#c98a32" stroke="#5a3a10" stroke-width="1.2"/><path d="M15 10h3a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-3" fill="none" stroke="#5a3a10" stroke-width="1.3"/><path d="M6 7q5-2 10 0v2H6Z" fill="#f8f2e2" stroke="#d0c4a6" stroke-width="1"/>',
  },

  // --- MATERIALES Y RECURSOS ---
  {
    id: 'mineral_cobre',
    name: 'Mineral de cobre bruto',
    category: 'resource',
    tags: ['mineral', 'cobre', 'recurso', 'mina'],
    svg: '<path d="m5 14 3-7 6-3 6 4 2 7-6 6H7Z" fill="#b47d56" stroke="#604d3c" stroke-width="1"/><path d="m8 7 4 4 4-3" fill="none" stroke="#f1e0c2" stroke-width="1"/>',
  },
  {
    id: 'tronco_roble',
    name: 'Madera de roble',
    category: 'resource',
    tags: ['madera', 'tronco', 'roble', 'recurso'],
    svg: '<path d="m4 11 11-7 6 4-11 8Z" fill="#9f7547" stroke="#604d3c" stroke-width="1"/><path d="M4 11v5l6 5 11-8V8l-11 8Z" fill="#886036" stroke="#604d3c" stroke-width="1"/>',
  },
  {
    id: 'hierbas_aromaticas',
    name: 'Hierbas aromáticas',
    category: 'resource',
    tags: ['hierbas', 'plantas', 'recoleccion', 'alquimia'],
    svg: '<path d="m8 21 7-15m-4 14-5-9m4 7 9-5" stroke="#6c8150" stroke-width="1.5" stroke-linecap="round"/><circle cx="16" cy="6" r="2" fill="#e7cc79"/>',
  },
  {
    id: 'tela_lino',
    name: 'Madeja de lino',
    category: 'resource',
    tags: ['tela', 'lino', 'fibra', 'sastreria'],
    svg: '<ellipse cx="12" cy="7" rx="6" ry="3" fill="#d6ba87" stroke="#604d3c" stroke-width="1"/><rect x="6" y="7" width="12" height="10" fill="#b6925f" stroke="#604d3c" stroke-width="1"/><ellipse cx="12" cy="17" rx="6" ry="3" fill="#9c7847" stroke="#604d3c" stroke-width="1"/>',
  },

  // --- CONSUMIBLES ---
  {
    id: 'pocion_roja',
    name: 'Poción curativa',
    category: 'consumable',
    tags: ['pocion', 'vida', 'curacion', 'rojo'],
    svg: '<path d="M9 4h6v3l4 6v5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-5l4-6Z" fill="#f4e8e8" stroke="#683434" stroke-width="1.2"/><path d="M6 13h12v5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z" fill="#c93838" stroke="#851818" stroke-width="0.8"/><rect x="9" y="2" width="6" height="3" rx="1" fill="#b8824a"/>',
  },
  {
    id: 'pocion_azul',
    name: 'Poción de maná',
    category: 'consumable',
    tags: ['pocion', 'mana', 'magia', 'azul'],
    svg: '<path d="M9 4h6v3l4 6v5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-5l4-6Z" fill="#e8f0f8" stroke="#344868" stroke-width="1.2"/><path d="M6 13h12v5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z" fill="#387ac9" stroke="#184c85" stroke-width="0.8"/><rect x="9" y="2" width="6" height="3" rx="1" fill="#b8824a"/>',
  },
  {
    id: 'pergamino_sello',
    name: 'Pergamino de encantamiento',
    category: 'consumable',
    tags: ['pergamino', 'hechizo', 'encantamiento', 'sello'],
    svg: '<path d="M6 4h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" fill="#f2e3be" stroke="#7a6234" stroke-width="1.2"/><path d="M7 8h8m-8 4h8m-8 4h5" stroke="#9e8455" stroke-width="1"/><circle cx="15" cy="16" r="2.5" fill="#a82828"/>',
  },

  // --- MUEBLES ---
  {
    id: 'silla_madera',
    name: 'Silla rústica',
    category: 'furniture',
    tags: ['mueble', 'silla', 'hogar', 'asiento'],
    svg: '<path d="M6 4v16m12-9v9M6 12h12M6 8h12" stroke="#684214" stroke-width="2" stroke-linecap="round"/>',
  },
  {
    id: 'mesa_taberna',
    name: 'Mesa de taberna',
    category: 'furniture',
    tags: ['mueble', 'mesa', 'hogar', 'taberna'],
    svg: '<rect x="3" y="8" width="18" height="4" rx="1" fill="#9e6e3c" stroke="#4a2e12" stroke-width="1.2"/><path d="M5 12v9m14-9v9" stroke="#4a2e12" stroke-width="2.2" stroke-linecap="round"/>',
  },
  {
    id: 'cama_acogedora',
    name: 'Cama acogedora',
    category: 'furniture',
    tags: ['mueble', 'cama', 'posada', 'descanso'],
    svg: '<path d="M3 8v12m18-7v7M3 14h18" stroke="#5a3818" stroke-width="2" stroke-linecap="round"/><rect x="4" y="11" width="15" height="5" rx="1" fill="#a84032"/><rect x="4" y="9" width="4" height="4" rx="1" fill="#f4ebd0"/>',
  },

  // --- ESPECIALES Y MISIONES ---
  {
    id: 'llave_bronce',
    name: 'Llave de bronce',
    category: 'special',
    tags: ['llave', 'especial', 'puerta', 'cofre'],
    svg: '<circle cx="8" cy="12" r="4.5" fill="none" stroke="#b87333" stroke-width="2.2"/><path d="M12.5 12h8m-3 0v3m3-3v2" stroke="#b87333" stroke-width="2" stroke-linecap="round"/>',
  },
  {
    id: 'carta_sellada',
    name: 'Carta con sello real',
    category: 'quest',
    tags: ['mision', 'carta', 'documento', 'sello'],
    svg: '<rect x="4" y="6" width="16" height="12" rx="1" fill="#e8dac0" stroke="#685438" stroke-width="1.2"/><path d="m4 7 8 6 8-6" fill="none" stroke="#685438" stroke-width="1.2"/><circle cx="12" cy="13" r="2.5" fill="#a42828"/>',
  },
];

export function findPresetIcon(id: string): PresetIcon | undefined {
  return PRESET_ICONS.find(i => i.id === id);
}

export function filterPresetIcons(query: string, category = 'all'): PresetIcon[] {
  const q = query.trim().toLowerCase();
  return PRESET_ICONS.filter(icon => {
    if (category !== 'all' && icon.category !== category) return false;
    if (!q) return true;
    return icon.name.toLowerCase().includes(q) || icon.tags.some(t => t.toLowerCase().includes(q));
  });
}
