import { createClient } from '@supabase/supabase-js';

const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const validProjectUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url);
const usableAnonKey = Boolean(anonKey) && !/your_supabase_anon_key|your_supabase_publishable_key/i.test(anonKey);

export const supabaseConfigured = validProjectUrl && usableAnonKey;
export const browserSupabase = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
