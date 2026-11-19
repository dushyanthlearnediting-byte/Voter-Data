import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isConfigured = url && anonKey &&
  !url.includes('your-project-ref') &&
  !anonKey.includes('YOUR-ANON-PUBLIC-KEY');

// Only the public "anon" key is used here. Never put the service_role key in this app.
export const supabase = isConfigured ? createClient(url, anonKey) : null;

export function getSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your local .env file and hosting environment.'
    );
  }
  return supabase;
}
