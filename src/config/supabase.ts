import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';
import { loadEnv } from './env.js';

let supabaseAdmin: SupabaseClient | null = null;
let supabaseAuth: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    const env = loadEnv();
    supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      realtime: {
        transport: ws,
      },
    });
  }
  return supabaseAdmin;
}

// Separate client for signInWithPassword — prevents session pollution on the admin client
export function getSupabaseAuth(): SupabaseClient {
  if (!supabaseAuth) {
    const env = loadEnv();
    supabaseAuth = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      realtime: {
        transport: ws,
      },
    });
  }
  return supabaseAuth;
}
