// Pure appearance metadata: data validation must not import the 3D renderer.
import type { HeadKit } from './types';

export const HAIR_STYLES = ['Rapado', 'Corto con flequillo', 'Despeinado', 'Media melena', 'Coleta', 'Moño', 'Dos coletas', 'Cresta', 'Melena larga', 'Trenza', 'Moños dobles', 'Rizos', 'Corte asimétrico', 'Corto pegado', 'Melena de explorador', 'Flequillo de viajero', 'Trenza lateral', 'Trenzas de la Arboleda', 'Moño de artesano', 'Coleta de aventurero', 'Ondas de Bruma', 'Corona trenzada', 'Trenza alta', 'Moño trenzado', 'Melena a un lado', 'Rizos cortos', 'Trenzas recogidas', 'Dos moños trenzados', 'Corto de lado', 'Rizos con volumen', 'Ondas largas', 'Laterales rapados'];
export const BEARDS = ['Ninguna', 'Barba recortada', 'Barba completa', 'Perilla y bigote', 'Bigote', 'Perilla', 'Patillas', 'Barba de tres días', 'Bigote de artesano'];
export const EYE_SHAPES = ['Normales', 'Grandes', 'Pequeños', 'Rasgados', 'Dulces', 'Soñolientos', 'Redondos', 'Varoniles', 'Afilados', 'Almendrados', 'Curiosos', 'Serenos', 'Vivaces'];
export const BROWS = ['Naturales', 'Finas', 'Gruesas', 'Altas', 'Preocupadas', 'Enfadadas', 'Arqueadas', 'Rectas', 'Suaves'];
export const NOSES = ['Pequeña', 'Grande', 'Respingona', 'Ancha', 'Aguileña', 'Botón', 'Recta', 'Redondeada', 'Delicada'];
export const MOUTHS = ['Sonrisa', 'Sonrisa abierta', 'Seria', 'Sorpresa', 'Pícara', 'Colmillo', 'Sonrisa tímida', 'Dos colmillos', 'Sonrisa de lado'];
export { DETAILS } from './detailLayers';
export const FACE_LABELS: Record<HeadKit, string> = { Mage: 'Serio', Knight: 'Noble', Rogue: 'Dulce', Barbarian: 'Cuadrada' };
export const FACE_KITS: HeadKit[] = ['Rogue', 'Mage', 'Knight', 'Barbarian'];

