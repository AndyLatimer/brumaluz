// Estado compartido de la partida, agrupado por áreas. Lo leen y modifican los módulos del juego (src/game, src/story,
// src/ui); los valores sin inicializar aquí los asigna main.ts al arrancar, antes de que nada los use.
import type * as THREE from 'three';
import type { User } from '@supabase/supabase-js';
import type { Character } from '../character/character';
import { defaultChar, type AttributeId, type CharData } from '../data/data';
import type { BankState } from '../data/bank';
import type { CombatState } from '../data/combat';
import type { loadWorldNpcs } from '../data/worldNpcs';
import type { SavedCharacter } from '../services/account';
import type { CombatEncounter, WorldConnection } from '../services/multiplayer';
import type { City } from '../world/city';
import type { createCoinBags } from '../world/coinBags';
import type { createWelcomeWorld } from '../world/welcome';
import type { NpcDef } from '../story/npcs';
import type { createDestinationIndicator } from '../ui/destinationIndicator';
import type { createQuestTracker } from '../ui/questWindow';
import type { createTargetFrame } from '../ui/targetFrame';

export type Focus = 'body' | 'face';

export type PlayerWindow = 'inventory' | 'sheet' | 'vendor' | 'bank' | 'social' | 'quests' | 'skills' | 'collections' | 'loot' | 'map';

/** Cuenta y personaje activos, y la conexión con el mundo. */
export const session = {
  state: defaultChar() as CharData,
  registeredNpcs: undefined! as ReturnType<typeof loadWorldNpcs>,
  activeCharacterId: null as string | null,
  currentUser: null as User | null,
  currentUsername: null as string | null,
  cachedCharacters: [] as SavedCharacter[],
  accountSyncId: 0,
  savingCharacter: false,
  enteringWorld: false,
  passwordRecoveryUser: null as User | null,
  chatUnsubscribe: null as (() => void) | null,
  stopFriendNotifications: null as (() => void) | null,
  chatSeq: 0,
  previousPartyInvites: new Set<string>(),
  characterPendingDeletion: null as SavedCharacter | null,
  deletingCharacter: false,
  worldConnection: null as WorldConnection | null,
  worldRetrying: false,
  authMode: 'login' as 'login' | 'register',
  worldCharacters: undefined! as Record<keyof ReturnType<typeof loadWorldNpcs>, Character>,
};

/** La partida en curso: modo, mapa, personaje y su movimiento. */
export const play = {
  skyLocation: '',
  skyIndoor: false,
  fallTimer: 0,
  mode: 'create' as 'create' | 'play',
  playGeneration: 0,
  city: undefined! as City,
  mapTravelling: false,
  portalsArmed: false,
  char: undefined! as Character,
  pendingHop: false,
  rebuildQueued: false,
  ambientEnabled: localStorage.getItem('brumaluz-ambient') !== 'off',
  running: true,
  jumpDuration: 0,
  jumpElapsed: 0,
  jumpHeight: 0,
  waveSequence: 0,
  groundHeight: 0,
  /** Altura de la superficie elevada que pisaba el personaje en el fotograma anterior (null: el suelo). */
  lastPlatformY: null as number | null,
  pendingTalk: null as string | null,
  moveTarget: null as THREE.Vector3 | null,
  actionBusy: false,
  dead: false,
  ambientChange: 0,
  last: 0,
};

/** Cámara: encuadre del creador, cámara de exploración y arrastre con el ratón. */
export const view = {
  focus: 'body' as Focus,
  zoom: 1,
  camDist: 4.4,
  // Cámara en tercera persona del modo exploración
  yaw: 0,
  pitch: 0.55,
  followDist: 12,
  zoomTarget: 12,
  // Girar al personaje arrastrando
  dragging: false,
  lastX: 0,
  lastY: 0,
  spinVel: 0,
  dragDist: 0,
  shakeUntil: 0,
};

/** Conversaciones con NPC y la llegada de Isberto (cámara de diálogo). */
export const talk = {
  conversationActor: null as THREE.Object3D | null,
  conversationSide: 1,
  conversationOffset: 0,
  returningFromConversation: false,
  conversationShot: '',
  conversationOrbitYaw: 0,
  conversationOrbitPitch: 0,
  pendingIsbertoIntroduction: false,
  isbertoArrival: null as { character: Character; path: THREE.Vector3[]; then: () => void } | null,
  conversationObstacles: [] as THREE.Object3D[],
};

/** Ventanas, menús y avisos de la interfaz. */
export const ui = {
  tab: 'raza',
  vendor: null as { id: string; name: string } | null,
  bankState: null as BankState | null,
  gameMenuOpen: false,
  playerMenuOpen: false,
  worldMenuOpen: false,
  openWindow: null as PlayerWindow | null,
  closeSocial: null as (() => void) | null,
  updateZoneMap: null as (() => void) | null,
  /** Reparto de puntos sin confirmar en la ficha: solo cuenta al pulsar «Confirmar». */
  pointDraft: {} as Partial<Record<AttributeId, number>>,
  optionsOpen: false,
  toastTimer: 0,
  toastSourceTitle: '',
  toastSourceText: '',
  toastValues: {} as Record<string, string | number>,
  // ---------------- Menú de personaje (Tab) ----------------
  questJournalKey: '',
  questTracker: undefined! as ReturnType<typeof createQuestTracker>,
  welcomePlate: undefined! as HTMLDivElement,
  questIndicator: undefined! as ReturnType<typeof createDestinationIndicator>,
  waypointIndicator: undefined! as ReturnType<typeof createDestinationIndicator>,
  targetFrame: undefined! as ReturnType<typeof createTargetFrame>,
};

/** Relojes locales de comida, sobrecuración, experiencia y habilidad (el servidor manda). */
export const vitals = {
  skillReadyAt: 0,
  foodBase: 0,
  foodSince: 0,
  foodSampleAt: 0,
  foodRunning: false,
  /** La sobrecuración se pierde con el tiempo: el servidor guarda el valor al recibirla y el cliente lo descuenta en pantalla. */
  overhealBase: 0,
  overhealSince: 0,
  xpSettle: 0,
};

/** Combate: el encuentro con la criatura, el objetivo fijado y el ataque automático. */
export const fight = {
  lockedEnemy: false,
  combatApproach: false,
  combatEncounter: null as CombatEncounter|null,
  combatTargetRoot: null as THREE.Group|null,
  combatAuto: false,
  combatBusy: false,
  nextCombatAttack: 0,
  nextLocalEnemyAttack: 0,
  pendingCombatSkill: false,
  localCombatState: null as CombatState|null,
};

/** Historia: pistas de Gnomi, escenas y el paseo de Isberto hasta su casa. */
export const story = {
  welcomeHintSaid: false,
  welcomeTravelSaid: false,
  isbertoPositionKey: '',
  /** El personaje camina solo hasta `target` (cinemáticas). */
  playerScript: null as { target: THREE.Vector3; speed: number } | null,
  introArmed: false,
  houseTourArmed: false,
  monsterPreview: null as THREE.Group | null,
  isbertoReturnShown: false,
  isbertoReturnDelay: 0,
  /** Dónde se queda Isberto tras acudir junto a la criatura derrotada. */
  isbertoMeet: null as THREE.Vector3 | null,
  /** Camino que le queda a Isberto hasta su puerta mientras guía al jugador. */
  isbertoGuide: null as THREE.Vector3[] | null,
  introFinishing: false,
  resting: false,
  guideBlocked: 0,
  storyFog: null as { near: number; far: number } | null,
  welcomeWorld: undefined! as ReturnType<typeof createWelcomeWorld>,
  coinBags: undefined! as ReturnType<typeof createCoinBags>,
  NPCS: undefined! as Record<string, NpcDef>,
};
