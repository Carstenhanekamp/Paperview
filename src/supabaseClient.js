const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = String(
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
).trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let client = null;
/** @type {Promise<import('@supabase/supabase-js').SupabaseClient | null> | null} */
let clientPromise = null;

export async function getSupabaseAsync() {
  if (!isSupabaseConfigured) return null;
  if (client) return client;
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) => {
      client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      });
      return client;
    });
  }
  return clientPromise;
}

/** Sync accessor after warm-up; prefer getSupabaseAsync for first use. */
export function getSupabase() {
  return client;
}

export const FOUNDING_CAP = 100;
export const WELCOME_STORAGE_KEY = 'pv.welcome.v1';
