import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  SUPABASE_ANON_KEY_FALLBACK,
  SUPABASE_URL_FALLBACK,
} from '../config/supabaseConfig';

const url = import.meta.env.VITE_SUPABASE_URL ?? SUPABASE_URL_FALLBACK;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? SUPABASE_ANON_KEY_FALLBACK;

export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * The anon key is intended to be public in a browser client. Row-level
 * security policies in Supabase restrict each user to their own row.
 * Never put a service_role key here.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
