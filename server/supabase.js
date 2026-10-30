import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });

const url = process.env.SUPABASE_URL;
// Keep the credential on the server. Support the current preferred variable
// and the older service-role variable used by existing deployments.
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseConfigured = Boolean(url && secretKey);
export const supabaseUrl = url || '';
export const supabase = supabaseConfigured
  ? createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

export async function dbResult(query) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY in server/.env.') };
  }
  try {
    return await query;
  } catch (error) {
    return { data: null, error };
  }
}

export async function checkSupabaseConnection() {
  if (!supabase) return { connected: false, message: 'Supabase credentials are missing from server/.env.' };
  const startedAt = Date.now();
  const { error } = await dbResult(supabase.from('users').select('id', { head: true, count: 'exact' }).limit(1));
  if (error) {
    return { connected: false, latencyMs: Date.now() - startedAt, message: error.message || 'Supabase database query failed.' };
  }
  return { connected: true, latencyMs: Date.now() - startedAt, message: 'Supabase database query succeeded.' };
}
