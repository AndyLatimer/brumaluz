import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { CharData } from './data';

export const MAX_CHARACTERS_PER_ACCOUNT = 5;

interface Database {
  public: {
    Tables: {
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
    Functions: Record<string, never>;
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

export async function signUp(email: string, password: string) {
  const { data, error } = await requireClient().auth.signUp({ email, password });
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

export async function saveCharacter(userId: string, id: string | null, character: CharData) {
  const record = { name: character.name, data: character, updated_at: new Date().toISOString() };
  const query = requireClient().from('characters');
  const result = id
    ? await query.update(record).eq('id', id).eq('user_id', userId).select('id').single()
    : await query.insert({ ...record, user_id: userId }).select('id').single();
  if (result.error) {
    if (result.error.message.includes('CHARACTER_LIMIT_REACHED')) {
      throw new Error(`Cada cuenta puede tener un máximo de ${MAX_CHARACTERS_PER_ACCOUNT} personajes. Borra uno antes de crear otro.`);
    }
    throw result.error;
  }
  return result.data.id;
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
