import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { CharData } from '../data/data';
import type { SkillId } from '../data/combat';
import type { EquipmentSlot, ItemStack } from '../data/inventory';
import type { ShadowAction } from '../data/quests';

export const MAX_CHARACTERS_PER_ACCOUNT = 5;

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

interface Database {
  public: {
    Tables: {
      chat_messages: {
        Row: {
          id: number;
          channel: ChatChannel;
          zone: string | null;
          sender_user: string;
          sender_name: string;
          sender_account: string | null;
          sender_title: string;
          recipient_user: string | null;
          recipient_name: string | null;
          body: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      profiles: {
        Row: {
          user_id: string;
          username: string | null;
        };
        Insert: {
          user_id: string;
          username?: string | null;
        };
        Update: {
          username?: string | null;
        };
        Relationships: [];
      };
      characters: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          data: unknown;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          data: unknown;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          data?: unknown;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_character: { Args: { p_data: Json }; Returns: string };
      welcome_action: { Args: { p_character_id: string; p_action: string; p_origin?: number }; Returns: Json };
      shadow_action: { Args: { p_character_id: string; p_action: ShadowAction }; Returns: Json };
      rest_action: { Args: { p_character_id: string }; Returns: Json };
      character_enter: { Args: { p_character_id: string }; Returns: Json };
      respawn_character: { Args: { p_character_id: string }; Returns: Json };
      debug_damage: { Args: { p_character_id: string }; Returns: Json };
      debug_heal: { Args: { p_character_id: string }; Returns: Json };
      debug_xp: { Args: { p_character_id: string }; Returns: Json };
      debug_money: { Args: { p_character_id: string }; Returns: Json };
      vendor_buy: { Args: { p_character_id: string; p_vendor: string; p_item: string }; Returns: Json };
      vendor_sell: { Args: { p_character_id: string; p_vendor: string; p_slot: number }; Returns: Json };
      use_item: { Args: { p_character_id: string; p_slot: number }; Returns: Json };
      move_inventory_item: { Args: { p_character_id: string; p_from: number; p_to: number; p_expected_from: Json; p_expected_to: Json }; Returns: Json };
      spend_attribute_points: { Args: { p_character_id: string; p_points: Json }; Returns: Json };
      upgrade_skill: { Args: { p_character_id: string; p_skill_id: string; p_expected_rank: number }; Returns: Json };
      set_character_title: { Args: { p_character_id: string; p_title: string }; Returns: Json };
      my_titles: { Args: Record<string, never>; Returns: Json };
      chat_send: { Args: { p_character_id: string; p_body: string; p_channel?: string; p_to?: string | null }; Returns: Json };
      save_character_position: { Args: { p_character_id: string; p_x: number; p_z: number; p_yaw: number }; Returns: Json };
      world_join: { Args: { p_character_id: string; p_session_id: string }; Returns: Json };
      world_sync: { Args: { p_character_id: string; p_session_id: string; p_state: Json }; Returns: Json };
      world_leave: { Args: { p_character_id: string; p_session_id: string }; Returns: undefined };
      world_travel: { Args: { p_character_id: string; p_session_id: string; p_portal: string }; Returns: Json };
      combat_start: { Args: { p_character_id: string }; Returns: Json };
      combat_action: { Args: { p_character_id: string; p_action: string }; Returns: Json };
      combat_stop: { Args: { p_character_id: string }; Returns: Json };
      change_equipment: { Args: { p_character_id: string; p_slot: string; p_bag: number | null; p_expected: Json }; Returns: Json };
      loot_corpse: { Args: { p_character_id: string; p_instance_id: string; p_slot?: number | null }; Returns: Json };
      collect_coin_bag: { Args: { p_character_id: string; p_bag_id: string }; Returns: Json };
      bank_action: { Args: { p_character_id: string; p_action: string; p_slot?: number | null; p_expected?: Json | null; p_amount?: number | null; p_target?: number | null }; Returns: Json };
      friends_list: { Args: Record<string, never>; Returns: Json };
      party_state: { Args: Record<string, never>; Returns: Json };
      party_invite: { Args: { p_username: string }; Returns: undefined };
      party_respond: { Args: { p_invite_id: string; p_accept: boolean }; Returns: undefined };
      party_leave: { Args: Record<string, never>; Returns: undefined };
      trade_action: { Args: { p_character_id: string; p_action: string; p_trade_id?: string; p_target_id?: string; p_offer?: Json; p_revision?: number }; Returns: Json };
      friend_request: { Args: { p_username: string }; Returns: undefined };
      friend_update: { Args: { p_user_id: string; p_action: string }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type SavedCharacter = Database['public']['Tables']['characters']['Row'];

let client: SupabaseClient<Database> | null = null;

export function getAccountClient() {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;
  client ??= createClient<Database>(url, key, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
  });
  return client;
}

export function accountConfigError() {
  return 'Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en .env.local.';
}

export async function signUp(username: string, email: string, password: string) {
  const { data, error } = await requireClient().auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await requireClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function requestPasswordReset(email: string, redirectTo: string) {
  const { error } = await requireClient().auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await requireClient().auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await requireClient().auth.signOut();
  if (error) throw error;
}

export async function currentSession() {
  const { data, error } = await requireClient().auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthChange(callback: (event: string, session: Session | null, user: User | null) => void) {
  const { data } = requireClient().auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY') {
      window.setTimeout(() => callback(event, session, session?.user ?? null), 0);
    }
  });
  return () => data.subscription.unsubscribe();
}

export async function listCharacters(userId: string) {
  const { data, error } = await requireClient()
    .from('characters')
    .select('id, user_id, name, data, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getProfileUsername(userId: string) {
  const { data, error } = await requireClient()
    .from('profiles')
    .select('username')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.username ?? null;
}

const SERVER_ERRORS: Record<string, string> = {
  WELCOME_REQUIRED: 'Primero debes completar la bienvenida con Gnomi.',
  WELCOME_UNAVAILABLE: 'Este personaje no tiene pendiente la bienvenida.',
  WELCOME_DEAD: 'Debes volver a la vida para continuar la bienvenida.',
  WELCOME_NOT_PLAYING: 'Debes estar conectado a Brumaluz para continuar.',
  WELCOME_TOO_FAR: 'Acércate al objetivo para continuar la misión.',
  WELCOME_INVALID_STATE: 'La misión ha cambiado. Revisa su estado antes de continuar.',
  WELCOME_INVALID_ACTION: 'Esta acción de misión no es válida.',
  PARTY_USERNAME_REQUIRED: 'Necesitas un nombre de cuenta para invitar a un grupo.',
  PARTY_NOT_PLAYING: 'Debes estar jugando para formar un grupo.',
  PARTY_TARGET_OFFLINE: 'Ese jugador no está conectado al mundo.',
  PARTY_SELF: 'No puedes invitarte a ti mismo.',
  PARTY_ALREADY_JOINED: 'Ese jugador ya pertenece a un grupo.',
  PARTY_LEADER_ONLY: 'Solo el líder puede invitar al grupo.',
  PARTY_FULL: 'El grupo está lleno (4 jugadores).',
  PARTY_INVITE_EXISTS: 'Ese jugador ya tiene una invitación de este grupo.',
  PARTY_INVITE_LIMIT: 'Ya tienes tres invitaciones pendientes.',
  PARTY_INVITE_INVALID: 'La invitación ha caducado o ya no existe.',
  PARTY_NOT_JOINED: 'No perteneces a un grupo.',
  FRIEND_SELF: 'No puedes añadirte a ti mismo.',
  FRIEND_USERNAME_REQUIRED: 'Necesitas un nombre de cuenta para enviar solicitudes de amistad.',
  FRIEND_ALREADY_EXISTS: 'Ya sois amigos o existe una solicitud pendiente.',
  FRIEND_REQUEST_LIMIT: 'Tienes demasiadas solicitudes enviadas. Cancela alguna antes de continuar.',
  FRIEND_NOT_FOUND: 'Esta amistad o solicitud ya no existe.',
  INVALID_FRIEND_ACTION: 'Esta solicitud ya no se puede aceptar.',
  WORLD_SESSION_REPLACED: 'Tu cuenta ha entrado al mundo desde otra pestaña o equipo.',
  INVALID_WORLD_STATE: 'El servidor ha rechazado el movimiento del personaje.',
  PORTAL_NOT_FOUND: 'Este camino todavía no lleva a ninguna parte.',
  PORTAL_TOO_FAR: 'Acércate más a la salida para viajar.',
  PORTAL_LOCKED: 'La puerta de Isberto está cerrada con llave.',
  REST_UNAVAILABLE: 'Solo puedes descansar en la cama de Isberto cuando te invite a su casa.',
  REST_TOO_FAR: 'Acércate a la cama para descansar.',
  CHARACTER_DEAD: 'No puedes viajar mientras estás muerto.',
  IN_COMBAT: 'No puedes viajar en mitad de un combate.',
  CHARACTER_LIMIT_REACHED: `Cada cuenta puede tener un máximo de ${MAX_CHARACTERS_PER_ACCOUNT} personajes. Borra uno antes de crear otro.`,
  INVALID_NAME: 'Tu nombre necesita entre 3 y 16 letras.',
  INVALID_CHARACTER: 'El servidor ha rechazado los datos del personaje.',
  NOT_ENOUGH_POINTS: 'No tienes tantos puntos de atributo por repartir.',
  ATTRIBUTE_MAXED: 'Ese atributo ya está al máximo.',
  INVALID_POINTS: 'El reparto de puntos no es válido.',
  CHARACTER_NOT_FOUND: 'No se ha encontrado el personaje.',
  ACTION_DISABLED: 'Esta acción está desactivada en el servidor.',
  COMBAT_UNAVAILABLE: 'El combate todavía no está disponible en el mundo.',
  COMBAT_NOT_PLAYING: 'Debes estar conectado para combatir.',
  COMBAT_TOO_FAR: 'Acércate a Isberto para empezar el combate.',
  COMBAT_DEAD: 'Debes volver a la vida para combatir.',
  COMBAT_ALREADY_ACTIVE: 'Ya tienes un combate activo.',
  COMBAT_NO_TARGET: 'No tienes un objetivo de combate activo.',
  COMBAT_INVALID_ACTION: 'Esa acción de combate no es válida.',
  COMBAT_OUT_OF_RANGE: 'El objetivo está fuera de alcance.',
  COMBAT_COOLDOWN: 'La acción todavía se está recuperando.',
  COMBAT_NOT_ENOUGH_RESOURCE: 'No tienes suficiente recurso.',
  COMBAT_HEALTH_FULL: 'Ya tienes la vida completa.',
  COMBAT_WEAPON_REQUIRED: 'Equipa un arma de tu clase para atacar.',
  EQUIPMENT_CHANGED: 'Tu equipo o mochila ha cambiado. Vuelve a intentarlo.',
  EQUIPMENT_INVALID: 'Ese objeto no se puede equipar en esta ranura con tu clase.',
  LOOT_PENDING: 'Recoge primero los restos de la criatura caída.',
  LOOT_INVALID: 'Ese cuerpo ya no está disponible.',
  LOOT_EMPTY: 'Ya has recogido el botín de este cuerpo.',
  LOOT_TOO_FAR: 'Acércate al cuerpo para recoger el botín.',
  COIN_BAG_INVALID: 'Esa bolsa de pelines ya no está aquí.',
  COIN_BAG_TAKEN: 'Ya has recogido esta bolsa de pelines.',
  COIN_BAG_TOO_FAR: 'Acércate a la bolsa para recogerla.',
  COIN_BAG_DEAD: 'Debes volver a la vida para recoger la bolsa.',
  COIN_BAG_NOT_PLAYING: 'Entra en Brumaluz para recoger la bolsa.',
  SHADOW_QUEST_COMPLETED: 'Ya has completado el encargo de Isberto.',
  SHADOW_ALREADY_DEFEATED: 'La criatura ya ha sido derrotada. Continúa la misión.',
  SHADOW_INVALID_STATE: 'No puedes continuar este paso de la misión todavía.',
  SHADOW_INVALID_ACTION: 'Esa acción de misión no es válida.',
  SHADOW_TOO_FAR: 'Acércate al objetivo para continuar la misión.',
  SHADOW_LOOT_REQUIRED: 'Registra los restos de la criatura y recoge todo el botín antes de hablar con Isberto.',
  SKILL_INVALID: 'Esa habilidad no pertenece a tu clase.',
  SKILL_CHANGED: 'El rango ha cambiado. Revisa la habilidad antes de mejorarla.',
  SKILL_MAX_RANK: 'La habilidad ya tiene el rango máximo.',
  SKILL_LEVEL_REQUIRED: 'Necesitas más nivel para mejorar esta habilidad.',
  SKILL_NO_POINTS: 'No tienes puntos de habilidad suficientes.',
  // Antes que NOT_ENOUGH_MONEY: los códigos se buscan como subcadena en orden.
  BANK_NOT_ENOUGH_MONEY: 'No tienes tantos pelines guardados en el banco.',
  BANK_TOO_FAR: 'Acércate al baúl para usar el banco.',
  BANK_NOT_PLAYING: 'Solo puedes usar el banco junto al baúl de la casa de Isberto.',
  BANK_DEAD: 'Debes volver a la vida para usar el banco.',
  BANK_FULL: 'El banco está lleno.',
  BANK_CHANGED: 'El banco ha cambiado. Vuelve a intentarlo.',
  BANK_ITEM_BOUND: 'Los objetos ligados no se pueden guardar en el banco.',
  BANK_INVALID_ACTION: 'Esa acción del banco no es válida.',
  NOT_ENOUGH_MONEY: 'No tienes suficientes pelines.',
  INVENTORY_FULL: 'Tu mochila está llena.',
  INVENTORY_CHANGED: 'Tu mochila ha cambiado. Vuelve a mover el objeto.',
  ITEM_NOT_FOR_SALE: 'Ese vendedor no vende ese objeto.',
  INVALID_VENDOR: 'Ese personaje no comercia.',
  INVALID_ITEM: 'Ese objeto no existe.',
  ITEM_NOT_SELLABLE: 'Ese objeto no se puede vender.',
  ITEM_NOT_USABLE: 'Ese objeto no se puede usar.',
  NOTHING_TO_HEAL: 'Ya tienes la vida completa.',
  WRONG_RESOURCE: 'Esta poción no corresponde al recurso de tu clase.',
  RESOURCE_FULL: 'Ya tienes el recurso completo.',
  CHAT_EMPTY: 'No puedes enviar un mensaje vacío.',
  CHAT_TOO_LONG: 'El mensaje es demasiado largo (máximo 200 caracteres).',
  CHAT_RATE_LIMIT: 'Estás escribiendo demasiado rápido. Espera unos segundos.',
  CHAT_MUTED: 'Tu cuenta está silenciada en el chat.',
  PLAYER_NOT_FOUND: 'No existe ninguna cuenta con ese nombre.',
  INVALID_CHANNEL: 'Canal de chat no válido.',
  CANNOT_WHISPER_SELF: 'No puedes susurrarte a ti mismo.',
};

/** Llama a una función del servidor (supabase/server/) y traduce sus códigos de error. */
async function serverCall<T>(call: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await call;
  if (error) {
    const code = Object.keys(SERVER_ERRORS).find((key) => error.message.includes(key));
    if (code) throw new Error(SERVER_ERRORS[code]);
    if (/could not find the function|schema cache/i.test(error.message)) {
      throw new Error('El servidor no tiene esta función todavía: aplica el SQL del servidor (npm run db:apply).');
    }
    throw error;
  }
  return data as T;
}

const asRecord = (data: unknown) => data as Record<string, unknown>;
export async function welcomeAction(character: string, action: string, origin?: number) {
  return asRecord(await serverCall(requireClient().rpc('welcome_action', {
    p_character_id: character, p_action: action, p_origin: origin,
  }).abortSignal(AbortSignal.timeout(10000))));
}
export async function shadowAction(character: string, action: ShadowAction) {
  return asRecord(await serverCall(requireClient().rpc('shadow_action', {
    p_character_id: character, p_action: action,
  }).abortSignal(AbortSignal.timeout(10000))));
}
/** Descansa en la cama de Isberto: vida y recurso al máximo. */
export async function restAction(character: string) {
  return asRecord(await serverCall(requireClient().rpc('rest_action', {
    p_character_id: character,
  }).abortSignal(AbortSignal.timeout(10000))));
}

export async function tradeAction(character: string, action: string, trade?: string, target?: string, offer?: Json, revision?: number) {
  const {data,error} = await requireClient().rpc('trade_action', {
    p_character_id: character, p_action: action, p_trade_id: trade, p_target_id: target,
    p_offer: offer, p_revision: revision,
  }).abortSignal(AbortSignal.timeout(10000));
  if(error) throw new Error(error.message);
  return data;
}

export async function moveInventoryItem(character: string, from: number, to: number, source: { id: string; count: number; bound?: boolean }, target: { id: string; count: number; bound?: boolean } | null) {
  return asRecord(await serverCall(requireClient().rpc('move_inventory_item', {
    p_character_id: character, p_from: from, p_to: to,
    p_expected_from: { ...source }, p_expected_to: target ? { ...target } : null,
  })));
}

/** Crea un personaje: el servidor solo acepta nombre, linaje, clase, apariencia y reparto inicial; el resto lo fija él. */
export async function createCharacter(character: CharData) {
  return (await serverCall(requireClient().rpc('create_character', { p_data: character as unknown as Json }))) as string;
}

/** Entra al mundo con un personaje: devuelve sus datos vigentes (un personaje caído reaparece en la capital). */
export async function enterCharacter(id: string) {
  return asRecord(await serverCall(requireClient().rpc('character_enter', { p_character_id: id })));
}

/** Una función de servidor por acción: cada una valida sus propias reglas. */
const characterCall = (fn: 'respawn_character' | 'debug_damage' | 'debug_heal' | 'debug_xp' | 'debug_money') => async (id: string) =>
  asRecord(await serverCall(requireClient().rpc(fn, { p_character_id: id })));
export const respawnCharacter = characterCall('respawn_character');
export const debugDamage = characterCall('debug_damage');
export const debugHeal = characterCall('debug_heal');
export const debugXp = characterCall('debug_xp');
export const debugMoney = characterCall('debug_money');

export type CharacterAction = 'damage' | 'heal' | 'xp' | 'money' | 'respawn';
export const characterActions: Record<CharacterAction, (id: string) => Promise<Record<string, unknown>>> = {
  damage: debugDamage, heal: debugHeal, xp: debugXp, money: debugMoney, respawn: respawnCharacter,
};

export async function startCombat(id: string) {
  return asRecord(await serverCall(requireClient().rpc('combat_start',{p_character_id:id})));
}
export async function combatAction(id: string, action: 'attack' | SkillId) {
  return asRecord(await serverCall(requireClient().rpc('combat_action',{p_character_id:id,p_action:action})));
}
export async function stopCombat(id: string) {
  return asRecord(await serverCall(requireClient().rpc('combat_stop',{p_character_id:id})));
}
export async function changeEquipment(id: string, slot: EquipmentSlot, bag: number | null, expected: ItemStack) {
  return asRecord(await serverCall(requireClient().rpc('change_equipment', {
    p_character_id: id, p_slot: slot, p_bag: bag, p_expected: { ...expected },
  }).abortSignal(AbortSignal.timeout(10000))));
}
export async function lootCorpse(id: string, instanceId: string, slot: number | null) {
  return asRecord(await serverCall(requireClient().rpc('loot_corpse', {
    p_character_id: id, p_instance_id: instanceId, p_slot: slot,
  }).abortSignal(AbortSignal.timeout(10000))));
}

/** Recoge una bolsa de pelines del mundo; el servidor valida distancia y que no se haya recogido, y sortea la cantidad. */
export async function collectCoinBag(id: string, bagId: string) {
  return asRecord(await serverCall(requireClient().rpc('collect_coin_bag', {
    p_character_id: id, p_bag_id: bagId,
  }).abortSignal(AbortSignal.timeout(10000))));
}

export type BankAction = 'open' | 'deposit' | 'withdraw' | 'move' | 'deposit_pelines' | 'withdraw_pelines';
/**
 * Banco de la cuenta: devuelve los datos del personaje y `bank` ({ items, pelines, size }). `target` es el hueco de
 * destino al arrastrar (del baúl al guardar o mover, de la mochila al retirar); sin él va al primer sitio libre.
 */
export async function bankAction(id: string, action: BankAction, slot: number | null = null, expected: ItemStack | null = null, amount: number | null = null, target: number | null = null) {
  return asRecord(await serverCall(requireClient().rpc('bank_action', {
    p_character_id: id, p_action: action, p_slot: slot, p_expected: expected ? { ...expected } : null, p_amount: amount, p_target: target,
  }).abortSignal(AbortSignal.timeout(10000))));
}

export async function upgradeCharacterSkill(id: string, skill: SkillId, expectedRank: number) {
  return asRecord(await serverCall(requireClient().rpc('upgrade_skill', {
    p_character_id: id, p_skill_id: skill, p_expected_rank: expectedRank,
  }).abortSignal(AbortSignal.timeout(10000))));
}

/** Compra una unidad a un vendedor; el servidor valida mercancía, saldo y hueco, y cobra el precio. */
export async function buyFromVendor(id: string, vendor: string, item: string) {
  return asRecord(await serverCall(requireClient().rpc('vendor_buy', { p_character_id: id, p_vendor: vendor, p_item: item })));
}

/** Vende una unidad del hueco indicado de la mochila. */
export async function sellToVendor(id: string, vendor: string, slot: number) {
  return asRecord(await serverCall(requireClient().rpc('vendor_sell', { p_character_id: id, p_vendor: vendor, p_slot: slot })));
}

/** Usa el objeto del hueco indicado de la mochila. */
export async function useItem(id: string, slot: number) {
  return asRecord(await serverCall(requireClient().rpc('use_item', { p_character_id: id, p_slot: slot })));
}

export async function spendAttributePoints(id: string, points: Record<string, number>) {
  return asRecord(await serverCall(requireClient().rpc('spend_attribute_points', { p_character_id: id, p_points: points })));
}

export async function setCharacterTitle(id: string, title: string) {
  return asRecord(await serverCall(requireClient().rpc('set_character_title', { p_character_id: id, p_title: title })));
}

/** Títulos reservados que el servidor permite a esta cuenta. */
export async function getMyTitles() {
  return (await serverCall(requireClient().rpc('my_titles'))) as unknown as string[];
}

export interface PositionResult {
  status: 'ok' | 'too_soon' | 'too_far' | 'dead';
  position: { x: number; z: number; yaw: number } | null;
}
export async function saveCharacterPosition(id: string, x: number, z: number, yaw: number) {
  return (await serverCall(requireClient().rpc('save_character_position', { p_character_id: id, p_x: x, p_z: z, p_yaw: yaw }))) as unknown as PositionResult;
}

export function joinWorld(characterId: string, sessionId: string) {
  return serverCall(requireClient().rpc('world_join', { p_character_id: characterId, p_session_id: sessionId }).abortSignal(AbortSignal.timeout(8000)));
}

export function syncWorld(characterId: string, sessionId: string, state: { x: number; z: number; yaw: number; facing: number; jump: number; wave: number }) {
  return requireClient().rpc('world_sync', { p_character_id: characterId, p_session_id: sessionId, p_state: state }).abortSignal(AbortSignal.timeout(8000)).then(({ data, error }) => {
    if (error) throw new Error(error.message);
    return data;
  });
}

export async function leaveWorld(characterId: string, sessionId: string) {
  await serverCall(requireClient().rpc('world_leave', { p_character_id: characterId, p_session_id: sessionId }).abortSignal(AbortSignal.timeout(8000)));
}

/** Cruza un portal del mapa actual: el servidor comprueba que el personaje está junto a él y lo lleva al otro mapa. */
export function travelWorld(characterId: string, sessionId: string, portal: string) {
  return serverCall(requireClient().rpc('world_travel', { p_character_id: characterId, p_session_id: sessionId, p_portal: portal }).abortSignal(AbortSignal.timeout(10000)));
}

export interface FriendEntry {
  userId: string;
  username: string;
  status: 'friend' | 'incoming' | 'outgoing';
  online: boolean;
  characterName: string | null;
  characterClass: string | null;
  characterLevel: number | null;
  location: string | null;
}
export async function listFriends(): Promise<FriendEntry[]> {
  const result = await serverCall(requireClient().rpc('friends_list').abortSignal(AbortSignal.timeout(8000)));
  if (!Array.isArray(result)) throw new Error('Respuesta social no válida.');
  return result.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || typeof value.userId !== 'string' || typeof value.username !== 'string'
      || !['friend', 'incoming', 'outgoing'].includes(String(value.status))
      || typeof value.online !== 'boolean'
      || (value.characterName !== null && typeof value.characterName !== 'string')
      || (value.characterClass !== null && typeof value.characterClass !== 'string')
      || (value.characterLevel !== null && (typeof value.characterLevel !== 'number' || !Number.isInteger(value.characterLevel) || value.characterLevel < 1 || value.characterLevel > 50))
      || (value.location !== null && typeof value.location !== 'string')) throw new Error('Respuesta social no válida.');
    return {
      userId: value.userId, username: value.username,
      status: value.status === 'friend' ? 'friend' : value.status === 'incoming' ? 'incoming' : 'outgoing',
      online: value.online, characterName: value.characterName, location: value.location,
      characterClass: value.characterClass,
      characterLevel: value.characterLevel,
    };
  });
}
export async function requestFriend(username: string) {
  await serverCall(requireClient().rpc('friend_request', { p_username: username }).abortSignal(AbortSignal.timeout(8000)));
}
export async function updateFriend(userId: string, action: 'accept' | 'remove') {
  await serverCall(requireClient().rpc('friend_update', { p_user_id: userId, p_action: action }).abortSignal(AbortSignal.timeout(8000)));
}
export const fetchParty = () => serverCall(requireClient().rpc('party_state').abortSignal(AbortSignal.timeout(8000)));
export const sendPartyInvite = (username: string) => serverCall(requireClient().rpc('party_invite',{p_username:username}).abortSignal(AbortSignal.timeout(8000)));
export const respondPartyInvite = (id: string, accept: boolean) => serverCall(requireClient().rpc('party_respond',{p_invite_id:id,p_accept:accept}).abortSignal(AbortSignal.timeout(8000)));
export const leaveParty = () => serverCall(requireClient().rpc('party_leave').abortSignal(AbortSignal.timeout(8000)));
export type ChatChannel = 'general' | 'zone' | 'whisper' | 'party';
export interface ChatMessage {
  id: number;
  channel: ChatChannel;
  zone: string | null;
  senderUser: string;
  senderName: string;
  /** Nombre de la cuenta del remitente (distinto del nombre del personaje). */
  senderAccount: string | null;
  senderTitle: string;
  recipientUser: string | null;
  /** Nombre de cuenta del destinatario de un susurro. */
  recipientName: string | null;
  body: string;
  createdAt: string;
}

type ChatRow = Database['public']['Tables']['chat_messages']['Row'];
const toChatMessage = (r: ChatRow): ChatMessage => ({
  id: r.id, channel: r.channel, zone: r.zone, senderUser: r.sender_user, senderName: r.sender_name, senderAccount: r.sender_account, senderTitle: r.sender_title,
  recipientUser: r.recipient_user, recipientName: r.recipient_name, body: r.body, createdAt: r.created_at,
});

/** Envía a un canal; los susurros (`to`) van al nombre de CUENTA. El servidor valida, limita el ritmo y fija el remitente. */
export async function sendChatMessage(characterId: string, body: string, channel: ChatChannel, to?: string) {
  return toChatMessage((await serverCall(requireClient().rpc('chat_send', { p_character_id: characterId, p_body: body, p_channel: channel, p_to: to ?? null }))) as unknown as ChatRow);
}

/** Últimos mensajes visibles para ti (generales y tus susurros), del más antiguo al más reciente. */
export async function fetchChatHistory(limit = 50) {
  const { data, error } = await requireClient().from('chat_messages').select('*').order('id', { ascending: false }).limit(limit);
  if (error) throw error;
  return data.reverse().map(toChatMessage);
}

/** Recibe los mensajes nuevos en tiempo real. Devuelve la función para dejar de escuchar. */
export function subscribeChat(onMessage: (m: ChatMessage) => void) {
  const supabase = requireClient();
  const channel = supabase
    .channel('chat-messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => onMessage(toChatMessage(payload.new as ChatRow)))
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export async function deleteCharacter(userId: string, id: string) {
  const { data, error } = await requireClient()
    .from('characters')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

function requireClient() {
  const configured = getAccountClient();
  if (!configured) throw new Error(accountConfigError());
  return configured;
}
