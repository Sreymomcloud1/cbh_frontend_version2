import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase frontend env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in cbh-fixed-frontend/.env.local."
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession:     true,
      autoRefreshToken:   true,
      detectSessionInUrl: true,
      storageKey:         "cbh-auth-token",
    },
  }
);

// ── Token cache ───────────────────────────────────────────────────────────────
// Caches the access token in memory so api.ts never hits localStorage repeatedly.
// This prevents "lock was released because another request stole it" errors.

let _cachedToken: string | null = null;
let _initialized = false;

// Keep cache fresh whenever auth state changes
supabase.auth.onAuthStateChange((_event, session) => {
  _cachedToken = session?.access_token ?? null;
  _initialized  = true;
});

export async function getAccessToken(): Promise<string | null> {
  // If we've already seen an auth event, return cache directly (no storage read)
  if (_initialized) return _cachedToken;

  // First call before any auth event — read storage once, then mark initialized
  const { data: { session } } = await supabase.auth.getSession();
  _cachedToken  = session?.access_token ?? null;
  _initialized  = true;
  return _cachedToken;
}

export function clearTokenCache() {
  _cachedToken  = null;
  _initialized  = false;
}
