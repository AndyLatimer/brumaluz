/**
 * @file fishing.ts
 * Integración del sistema de pesca en el mundo, interfaz y personajes de Brumaluz.
 * Conecta las interacciones en el mundo 3D, detección de agua, animaciones del modelo,
 * inventario, otorgamiento de XP/Pelines y notificaciones.
 */

import * as THREE from 'three';
import { session, play } from './state';
import { holder } from './stage';
import { toast } from '../ui/toast';
import { giveStack } from '../data/professions';
import type { City, Interactable } from '../world/city';
import { FishingMinigameController } from '../../standalone/fishing/src/api/fishing-api.js';
import type { FishingPhase, FishingResult } from '../../standalone/fishing/src/types';

let activeFishingController: FishingMinigameController | null = null;
let modalContainer: HTMLElement | null = null;

// Puntos de pesca escénicos preconfigurados en Pompelín
const SCENIC_FISHING_SPOTS: Record<string, { id: string; label: string; x: number; z: number; radius: number; zoneId: string }[]> = {
  brumaluz: [
    { id: 'fishing:muelle_faroles', label: 'Pescar en el Muelle de los Faroles', x: -28, z: 42, radius: 3.5, zoneId: 'muelle_faroles' },
    { id: 'fishing:canal_olmo', label: 'Pescar en el Canal del Olmo', x: 18, z: -35, radius: 3.5, zoneId: 'canal_olmo' },
    { id: 'fishing:rio_brumaluz', label: 'Pescar en la Ribera de los Sauces', x: -65, z: 12, radius: 4.0, zoneId: 'rio_brumaluz' }
  ],
  arboleda: [
    { id: 'fishing:lago_arboleda', label: 'Pescar en el Lago de La Arboleda', x: -40, z: -15, radius: 4.5, zoneId: 'lago_arboleda' }
  ]
};

/**
 * Devuelve los interactables de pesca para la posición actual del jugador.
 * Incluye muelles fijos y detección dinámica de orilla de agua.
 */
export function fishingInteractions(city: City, pos: THREE.Vector3): Interactable[] {
  if (play.mode !== 'play' || play.char?.isSwimming || isFishingActive()) return [];

  const results: Interactable[] = [];

  // 1. Puntos escénicos en el mapa actual
  const spots = SCENIC_FISHING_SPOTS[city.locationId] || [];
  for (const s of spots) {
    results.push({
      id: s.id,
      label: s.label,
      position: new THREE.Vector3(s.x, city.groundY(s.x, s.z), s.z),
      radius: s.radius
    });
  }

  // 2. Detección dinámica de orilla acuática en la dirección frontal del personaje
  const forwardAngle = holder.rotation.y;
  const probeDist = 2.4;
  const probeX = pos.x + Math.sin(forwardAngle) * probeDist;
  const probeZ = pos.z + Math.cos(forwardAngle) * probeDist;

  const currentWater = city.waterAt?.(pos.x, pos.z);
  const targetWater = city.waterAt?.(probeX, probeZ);

  // Si el jugador está sobre tierra seca pero apuntando hacia agua
  if (!currentWater && targetWater) {
    results.push({
      id: 'fishing:dynamic_shore',
      label: 'Pescar en la orilla',
      position: new THREE.Vector3(pos.x, pos.y, pos.z),
      radius: 3.2
    });
  }

  return results;
}

/**
 * Comprueba si la pesca está actualmente activa.
 */
export function isFishingActive(): boolean {
  return activeFishingController !== null;
}

/**
 * Inicia una sesión de pesca integrada.
 */
export function startFishing(interactionId: string, spotZoneId?: string): boolean {
  if (isFishingActive() || !play.char) return false;

  // Determinar zona según el interactable o la ciudad actual
  let zoneId = spotZoneId;
  if (!zoneId) {
    if (interactionId === 'fishing:canal_olmo') zoneId = 'canal_olmo';
    else if (interactionId === 'fishing:muelle_faroles') zoneId = 'muelle_faroles';
    else if (interactionId === 'fishing:lago_arboleda') zoneId = 'lago_arboleda';
    else zoneId = play.city.locationId === 'arboleda' ? 'lago_arboleda' : 'rio_brumaluz';
  }

  // Detectar caña y cebo en el inventario del jugador
  const inventory = session.state.inventory;
  let rodId = 'cana_sauce';
  let rodTier = 0;

  if (inventory.some(s => s?.id === 'cana_pesca_roble')) {
    rodId = 'cana_roble_elfico';
    rodTier = 3;
  } else if (inventory.some(s => s?.id === 'cana_pesca_fresno')) {
    rodId = 'cana_fresno_cobre';
    rodTier = 2;
  } else if (inventory.some(s => s?.id === 'cana_pesca_bambu')) {
    rodId = 'cana_bambu';
    rodTier = 1;
  }

  let baitId = 'sin_cebo';
  const baitCandidate = inventory.find(s => s?.id?.startsWith('cebo_') && s.count > 0);
  if (baitCandidate) {
    if (baitCandidate.id === 'cebo_gusano_seda') baitId = 'gusano_brillante';
    else if (baitCandidate.id === 'cebo_baya_rio') baitId = 'baya_rio';
    else if (baitCandidate.id === 'cebo_insecto_bruma') baitId = 'insecto_bruma';
    else baitId = 'lombriz_jardin';
  }

  // 1. Postura de pesca del modelo 3D
  play.char.beginFishing(rodTier);

  // 2. Crear o mostrar el contenedor modal de pesca
  if (!modalContainer) {
    modalContainer = document.createElement('div');
    modalContainer.id = 'integrated-fishing-overlay';
    modalContainer.className = 'integrated-fishing-overlay';
    document.body.appendChild(modalContainer);
  }
  modalContainer.hidden = false;
  modalContainer.innerHTML = '';

  // 3. Botón de cierre en esquina superior
  const closeBtn = document.createElement('button');
  closeBtn.className = 'integrated-fishing-close-btn';
  closeBtn.textContent = '✕ Cerrar Pesca';
  closeBtn.onclick = () => stopFishing();
  modalContainer.appendChild(closeBtn);

  // 4. Instanciar el controlador de minijuego
  activeFishingController = FishingMinigameController.launch(modalContainer, {
    zoneId,
    rodId,
    baitId,
    accessibleMode: false
  });

  // 5. Vincular eventos de la lógica de pesca con el personaje y el MMORPG
  activeFishingController.on('phaseChange', (phase: FishingPhase) => {
    play.char?.setFishingPhase(phase);
  });

  activeFishingController.on('catch', (result: FishingResult) => {
    handleCatchReward(result);
  });

  activeFishingController.on('escape', () => {
    toast('Pez escapado', 'El sedal perdió tensión y el pez logró soltarse.');
  });

  activeFishingController.on('cancel', () => {
    stopFishing();
  });

  return true;
}

/**
 * Procesa y otorga recompensas por la captura al jugador.
 */
function handleCatchReward(result: FishingResult) {
  if (!result || !result.species) return;

  const sp = result.species;
  const fishItemId = `pez_${sp.id}`;

  // Otorgar objeto en la mochila del personaje
  const added = giveStack(session.state, { id: fishItemId, count: 1 });

  // Otorgar experiencia de personaje y profesión
  const diff = sp.difficulty || 3;
  const xpAward = Math.round(25 + diff * 12);
  session.state.experience = (session.state.experience ?? 0) + xpAward;
  if (session.state.rpg) {
    session.state.rpg.xp = session.state.rpg.xp || {};
    session.state.rpg.xp.recolector = (session.state.rpg.xp.recolector ?? 0) + xpAward;
  }

  // Otorgar Pelines según rareza y calidad
  const pelinesAward = Math.round(10 + diff * 6 + (result.quality || 1) * 8);
  session.state.wallet.pelines = (session.state.wallet.pelines ?? 0) + pelinesAward;

  // Celebración en el modelo 3D
  play.char?.celebrate();

  // Notificación in-game acogedora
  const qualityStars = '★'.repeat(result.quality || 1);
  const bagNotice = added ? 'Guardado en la mochila' : 'Mochila llena';
  toast(
    '¡Captura Exitosa!',
    `${sp.name} (${result.size} cm, ${result.weight} kg) ${qualityStars} • +${xpAward} XP • +${pelinesAward} Pelines (${bagNotice})`,
    false,
    {},
    'reward'
  );

  // Notificar al sistema de profesiones e interfaz
  document.dispatchEvent(new CustomEvent('brumaluz-professions-update'));
}

/**
 * Cierra la sesión de pesca y restaura el estado del personaje.
 */
export function stopFishing() {
  if (activeFishingController) {
    activeFishingController.destroy();
    activeFishingController = null;
  }
  if (modalContainer) {
    modalContainer.hidden = true;
    modalContainer.innerHTML = '';
  }
  play.char?.endFishing();
}
