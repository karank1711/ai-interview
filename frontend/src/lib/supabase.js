import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

let cachedAccessToken = null;
let sessionReadyResolve;
const sessionReady = new Promise((resolve) => {
  sessionReadyResolve = resolve;
});

supabase.auth.getSession().then(({ data }) => {
  cachedAccessToken = data.session?.access_token || cachedAccessToken;
  sessionReadyResolve();
});

supabase.auth.onAuthStateChange((_event, session) => {
  cachedAccessToken = session?.access_token || null;
  sessionReadyResolve();
});

export function getCachedAccessToken() {
  return cachedAccessToken;
}

export async function getAccessToken() {
  if (cachedAccessToken) return cachedAccessToken;
  await sessionReady;
  if (cachedAccessToken) return cachedAccessToken;
  const { data } = await supabase.auth.getSession();
  cachedAccessToken = data.session?.access_token || null;
  return cachedAccessToken;
}

export function getOAuthRedirectUrl() {
  return `${window.location.origin}/auth/callback`;
}
