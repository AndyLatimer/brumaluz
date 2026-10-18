import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { CharData } from '../data/data';

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
      character_enter: { Args: { p_character_id: string }; Returns: Json };
      respawn_character: { Args: { p_character_id: string }; Returns: Json };
      debug_damage: { Args: { p_character_id: string }; Returns: Json };
      debug_heal: { Args: { p_character_id: string }; Returns: Json };
      debug_xp: { Args: { p_character_id: string }; Returns: Json };
      debug_money: { Args: { p_character_id: string }; Returns: Json };
      vendor_buy: { Args: { p_character_id: string; p_vendor: string; p_item: string }; Returns: Json };
      vendor_sell: { Args: { p_character_id: string; p_vendor: string; p_slot: number }; Returns: Json };
      use_item: { Args: { p_character_id: string; p_slot: number }; Returns: Json };
      spend_attribute_points: { Args: { p_character_id: string; p_points: Json }; Returns: Json };
      set_character_title: { Args: { p_character_id: string; p_title: string }; Returns: Json };
      my_titles: { Args: Record<string, never>; Returns: Json };
      chat_send: { Args: { p_character_id: string; p_body: string; p_channel?: string; p_to?: string | null }; Returns: Json };
      save_character_position: { Args: { p_character_id: string; p_x: number; p_z: number; p_yaw: number }; Returns: Json };
      world_join: { Args: { p_character_id: string; p_session_id: string }; Returns: Json };
      world_sync: { Args: { p_character_id: string; p_session_id: string; p_state: Json }; Returns: Json };
      world_leave: { Args: { p_character_id: string; p_session_id: string }; Returns: undefined };
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
  WORLD_SESSION_REPLACED: 'Tu cuenta ha entrado al mundo desde otra pestaña o equipo.',
  INVALID_WORLD_STATE: 'El servidor ha rechazado el movimiento del personaje.',
  CHARACTER_LIMIT_REACHED: `Cada cuenta puede tener un máximo de ${MAX_CHARACTERS_PER_ACCOUNT} personajes. Borra uno antes de crear otro.`,
  INVALID_NAME: 'Tu nombre necesita entre 3 y 16 letras.',
  INVALID_CHARACTER: 'El servidor ha rechazado los datos del personaje.',
  NOT_ENOUGH_POINTS: 'No tienes tantos puntos de atributo por repartir.',
  ATTRIBUTE_MAXED: 'Ese atributo ya está al máximo.',
  INVALID_POINTS: 'El reparto de puntos no es válido.',
  CHARACTER_NOT_FOUND: 'No se ha encontrado el personaje.',
  ACTION_DISABLED: 'Esta acción está desactivada en el servidor.',
  NOT_ENOUGH_MONEY: 'No tienes suficientes pelines.',
  INVENTORY_FULL: 'Tu mochila está llena.',
  ITEM_NOT_FOR_SALE: 'Ese vendedor no vende ese objeto.',
  INVALID_VENDOR: 'Ese personaje no comercia.',
  INVALID_ITEM: 'Ese objeto no existe.',
  ITEM_NOT_USABLE: 'Ese objeto no se puede usar.',
  NOTHING_TO_HEAL: 'Ya tienes la vida completa.',
  CHAT_EMPTY: 'No puedes enviar un mensaje vacío.',
  CHAT_TOO_LONG: 'El mensaje es demasiado largo (máximo 200 caracteres).',
  CHAT_RATE_LIMIT: 'Estás escribiendo demasiado rápido. Espera unos segundos.',
  CHAT_MUTED: 'Tu cuenta está silenciada en el chat.',
  PLAYER_NOT_FOUND: 'No existe ninguna cuenta con ese nombre.',
  INVALID_CHANNEL: 'Canal de chat no válido.',
  CANNOT_WHISPER_SELF: 'No puedes susurrarte a ti mismo.',
};

/** Llama a una función del servidor (supabase/server.sql) y traduce sus códigos de error. */
async function serverCall<T>(call: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await call;
  if (error) {
    const code = Object.keys(SERVER_ERRORS).find((key) => error.message.includes(key));
    if (code) throw new Error(SERVER_ERRORS[code]);
    if (/could not find the function|schema cache/i.test(error.message)) {
      throw new Error('El servidor no tiene esta función todavía: ejecuta supabase/server.sql en Supabase.');
    }
    throw error;
  }
  return data as T;
}

const asRecord = (data: unknown) => data as Record<string, unknown>;

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
export type ChatChannel = 'general' | 'zone' | 'whisper';
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
