import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
export type { Json } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && key);

// Solo la clave publicable llega al navegador; la seguridad real está en RLS.
export const supabase = createClient<Database>(url ?? 'http://localhost', key ?? 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true },
});

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Inserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type Updates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];

/** Lanza el error de Supabase con un mensaje legible en español. */
type PgErr = { message: string; code?: string };

/** Para listas y single(): sin error, data nunca es null. */
export function unwrap<T>(res: { data: T; error: PgErr | null }): NonNullable<T> {
  if (res.error) throw new Error(friendlyError(res.error));
  return res.data as NonNullable<T>;
}

/** Para maybeSingle(): devuelve null si no hay fila. */
export function unwrapMaybe<T>(res: { data: T; error: PgErr | null }): T | null {
  if (res.error) throw new Error(friendlyError(res.error));
  return res.data ?? null;
}

export function friendlyError(err: { message: string; code?: string }): string {
  switch (err.code) {
    case '23505':
      return 'Ese registro ya existe (dato duplicado).';
    case '23503':
      return 'No se puede completar: hay registros relacionados.';
    case '23514':
      return 'Algún dato no cumple las reglas permitidas.';
    case '42501':
      return err.message.includes('permission denied') ? 'No tienes permiso para esta acción.' : err.message;
    case 'PGRST116':
      return 'No se encontró el registro.';
    default:
      return err.message;
  }
}

export const STORAGE = {
  playerPhotos: 'player-photos',
  competitionPhotos: 'competition-photos',
  branding: 'branding',
} as const;

export async function signedUrl(bucket: string, path: string | null | undefined, seconds = 3600): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

export function publicUrl(bucket: string, path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
