import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them in a .env file (local) or in your hosting dashboard (Netlify/Vercel).'
  );
}

// Only the public "anon" key is used here. Never put the service_role key in this app.
export const supabase = createClient(url, anonKey);
