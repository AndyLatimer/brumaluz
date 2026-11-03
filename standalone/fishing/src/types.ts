/**
 * @file types.ts
 * Contrato de tipos para el minijuego de pesca independiente de Brumaluz.
 * Diseñado para desacoplar la lógica de presentación y facilitar la futura
 * integración en el cliente Three.js y el servidor de juego.
 */

export type FishPattern =
  | 'smooth'     // Nado suave, predecible y continuo
  | 'dart'       // Cambios bruscos de dirección y descansos breves
  | 'sinker'     // Tendencia a descender hacia el fondo con resistencia
  | 'floater'    // Tendencia a subir hacia la superficie con saltos
  | 'erratic'    // Velocidad variable y zig-zag impredecible
  | 'rhythmic';  // Pulsos periódicos de aceleración y calma

export type FishRarity =
  | 'common'      // Común (Gris/Blanco)
  | 'uncommon'    // Poco común (Verde)
  | 'rare'        // Raro (Azul)
  | 'legendary'   // Legendario (Dorado)
  | 'mythical';   // Mítico (Púrpura/Mágico)

export type CatchQuality = 1 | 2 | 3 | 4; // 1 = Normal, 2 = Plata, 3 = Oro, 4 = Estelar

export interface FishSpecies {
  id: string;
  name: string;
  description: string;
  lore: string;
  rarity: FishRarity;
  difficulty: number;            // 1 (muy fácil) a 10 (maestría)
  baseSpeed: number;             // Velocidad base de movimiento
  pattern: FishPattern;          // Patrón de conducta bajo el agua
  reactionTime: number;          // Segundos de ventana al picar (1.0 a 3.0s)
  spawnWeight: number;           // Probabilidad relativa de aparición
  minDistance: number;           // Distancia mínima de lance recomendada (m)
  habitats: string[];            // IDs de zonas donde habita
  preferredBaits: string[];      // IDs de cebos que incrementan su afinidad
  sizeRange: [min: number, max: number];     // Longitud en centímetros [min, max]
  weightRange: [min: number, max: number];   // Masa en kilogramos [min, max]
  primaryColor: string;          // Color para renderizado y silueta
  accentColor: string;           // Color secundario / brillo
  iconSvg?: string;              // Gráfico vectorial del pez
}

export interface FishingRod {
  id: string;
  name: string;
  description: string;
  zoneWidthMultiplier: number;   // Multiplicador del ancho de captura (ej. 1.2 = +20%)
  stability: number;             // Amortiguación del rebote/inercia (0.5 a 1.5)
  reelSpeedMultiplier: number;   // Velocidad de respuesta al recoger
  reactionBonus: number;         // Segundos extra otorgados en la picada
  icon?: string;
}

export interface FishingBait {
  id: string;
  name: string;
  description: string;
  biteTimeMultiplier: number;    // Multiplicador del tiempo de espera (ej. 0.7 = 30% más rápido)
  rarityBonus: number;           // Incremento de peso para especies raras/legendarias
  calmModifier: number;          // Reduce la velocidad/dificultad del pez (0.8 = -20% agresividad)
  targetSpeciesId?: string;      // Especie específica con atracción garantizada o aumentada
  icon?: string;
}

export interface FishingZone {
  id: string;
  name: string;
  description: string;
  region: string;                // Ej. 'Brumaluz', 'La Arboleda', 'Cumbres de Cobre'
  waterType: 'river' | 'lake' | 'coastal' | 'canal';
  baseBiteMinSeconds: number;
  baseBiteMaxSeconds: number;
  availableSpeciesIds: string[];
}

export type FishingPhase =
  | 'IDLE'          // Esperando inicio
  | 'PREPARATION'   // Selección de caña/cebo, vista del entorno
  | 'CASTING'       // Indicador oscilante de potencia de lanzamiento
  | 'WAITING'       // Flotador en el agua, perturbaciones, espera de picada
  | 'HOOKING'       // Aviso de picada ("¡PICA!"), ventana de reacción
  | 'REELING'       // Minijuego principal de zona de captura
  | 'RESULT';       // Pantalla de pez obtenido o escape

export interface FishingResult {
  success: boolean;
  escaped: boolean;
  species?: FishSpecies;
  size?: number;                 // cm calculados
  weight?: number;               // kg calculados
  quality?: CatchQuality;        // Calidad según precisión del jugador
  castDistance: number;          // Metros de lanzamiento (ej. 18.5m)
  castQualityRatio: number;      // Calidad del lanzamiento (0.0 a 1.0)
  reelingAccuracy: number;       // % del tiempo que el pez estuvo dentro de la zona
  reelingDuration: number;       // Segundos de combate
  rodId: string;
  baitId?: string;
  zoneId: string;
  timestamp: number;             // Timestamp UTC para validación en servidor
  clientSignature?: string;      // Firma de telemetría para verificación anti-trampas
}

export interface FishingSessionConfig {
  zoneId: string;
  rodId?: string;
  baitId?: string;
  accessibleMode?: boolean;
  alternativeControls?: boolean; // Control directo por puntero en lugar de impulso
  fixedSpeciesId?: string;       // Opcional para pruebas o misiones específicas
  onPhaseChange?: (phase: FishingPhase) => void;
  onProgressUpdate?: (progress: number, tension: number) => void;
  onBite?: () => void;
  onComplete?: (result: FishingResult) => void;
  onCancel?: () => void;
}

export interface MinigameTelemetry {
  fps: number;
  phase: FishingPhase;
  fishPosition: number;          // 0.0 (fondo) a 1.0 (superficie)
  fishVelocity: number;
  playerZonePosition: number;    // 0.0 a 1.0
  playerZoneSize: number;        // Tamaño normalizado
  catchProgress: number;         // 0.0 a 1.0
  lineTension: number;           // 0.0 a 1.0
  timeInZoneRatio: number;
  currentSpecies?: FishSpecies;
}
