import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { CharData } from '../data/data';

export const MAX_CHARACTERS_PER_ACCOUNT = 5;

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

interface Database {
  public: {
    Tables: {
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
      spend_attribute_points: { Args: { p_character_id: string; p_points: Json }; Returns: Json };
      set_character_title: { Args: { p_character_id: string; p_title: string }; Returns: Json };
      save_character_position: { Args: { p_character_id: string; p_x: number; p_z: number; p_yaw: number }; Returns: Json };
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
  CHARACTER_LIMIT_REACHED: `Cada cuenta puede tener un máximo de ${MAX_CHARACTERS_PER_ACCOUNT} personajes. Borra uno antes de crear otro.`,
  INVALID_NAME: 'Tu nombre necesita entre 3 y 16 letras.',
  INVALID_CHARACTER: 'El servidor ha rechazado los datos del personaje.',
  NOT_ENOUGH_POINTS: 'No tienes tantos puntos de atributo por repartir.',
  ATTRIBUTE_MAXED: 'Ese atributo ya está al máximo.',
  INVALID_POINTS: 'El reparto de puntos no es válido.',
  CHARACTER_NOT_FOUND: 'No se ha encontrado el personaje.',
  ACTION_DISABLED: 'Esta acción está desactivada en el servidor.',
};

/** Llama a una función del servidor (supabase/server.sql) y traduce sus códigos de error. */
async function serverCall<T>(call: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await call;
  if (error) {
    const code = Object.keys(SERVER_ERRORS).find((key) => error.message.includes(key));
    if (code) throw new Error(SERVER_ERRORS[code]);
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
const characterCall = (fn: 'respawn_character' | 'debug_damage' | 'debug_heal' | 'debug_xp') => async (id: string) =>
  asRecord(await serverCall(requireClient().rpc(fn, { p_character_id: id })));
export const respawnCharacter = characterCall('respawn_character');
export const debugDamage = characterCall('debug_damage');
export const debugHeal = characterCall('debug_heal');
export const debugXp = characterCall('debug_xp');

export type CharacterAction = 'damage' | 'heal' | 'xp' | 'respawn';
export const characterActions: Record<CharacterAction, (id: string) => Promise<Record<string, unknown>>> = {
  damage: debugDamage, heal: debugHeal, xp: debugXp, respawn: respawnCharacter,
};

export async function spendAttributePoints(id: string, points: Record<string, number>) {
  return asRecord(await serverCall(requireClient().rpc('spend_attribute_points', { p_character_id: id, p_points: points })));
}

export async function setCharacterTitle(id: string, title: string) {
  return asRecord(await serverCall(requireClient().rpc('set_character_title', { p_character_id: id, p_title: title })));
}

export interface PositionResult {
  status: 'ok' | 'too_soon' | 'too_far' | 'dead';
  position: { x: number; z: number; yaw: number } | null;
}
export async function saveCharacterPosition(id: string, x: number, z: number, yaw: number) {
  return (await serverCall(requireClient().rpc('save_character_position', { p_character_id: id, p_x: x, p_z: z, p_yaw: yaw }))) as unknown as PositionResult;
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
