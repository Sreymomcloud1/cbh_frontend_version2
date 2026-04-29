import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase frontend env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in cbh-fixed-frontend/.env.local."
  );
}

/** Auth-js options; createClient’s typings omit some keys (e.g. lockAcquireTimeout) until aligned. */
const authOptions = {
  persistSession:     true,
  autoRefreshToken:   true,
  /**
   * Password recovery on `/auth/reset-password` is handled explicitly (hash / PKCE code)
   * so it does not race GoTrue’s built-in URL detection on the same Web Lock (Strict Mode
   * double mount + setSession + getSession was causing NavigatorLockAcquireTimeoutError).
   */
  detectSessionInUrl: (url: URL, params: Record<string, string>) => {
    if (url.pathname.includes("/auth/reset-password")) return false;
    return Boolean(
      params.access_token ||
        params.refresh_token ||
        params.code ||
        params.error ||
        params.error_description
    );
  },
  /** Default 5000ms is tight when multiple auth calls overlap (e.g. React Strict Mode). */
  lockAcquireTimeout: 30_000,
  storageKey:         "cbh-auth-token",
} as const;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  // Runtime supports lockAcquireTimeout + custom detectSessionInUrl; bundled types can lag.
  auth: authOptions as never,
});

// ── Token cache ───────────────────────────────────────────────────────────────
// Caches the access token in memory so api.ts never hits localStorage repeatedly.
// This prevents "lock was released because another request stole it" errors.

let _cachedToken: string | null = null;
let _initialized = false;
const TOKEN_REFRESH_BUFFER_SECONDS = 90;

function parseJwtExp(token: string): number | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = JSON.parse(atob(padded)) as { exp?: number };
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

function tokenNeedsRefresh(token: string): boolean {
  const exp = parseJwtExp(token);
  if (!exp) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  return exp - nowSec <= TOKEN_REFRESH_BUFFER_SECONDS;
}

// Keep cache fresh whenever auth state changes
supabase.auth.onAuthStateChange((_event, session) => {
  _cachedToken = session?.access_token ?? null;
  _initialized  = true;
});

export async function getAccessToken(): Promise<string | null> {
  if (!hasSupabaseEnv) return null;
  // If we've already seen an auth event, return cache directly (no storage read)
  if (_initialized) {
    if (_cachedToken && tokenNeedsRefresh(_cachedToken)) {
      const refreshed = await refreshAccessToken();
      return refreshed;
    }
    return _cachedToken;
  }

  // First call before any auth event — read storage once, then mark initialized
  const { data: { session } } = await supabase.auth.getSession();
  _cachedToken  = session?.access_token ?? null;
  _initialized  = true;
  if (_cachedToken && tokenNeedsRefresh(_cachedToken)) {
    const refreshed = await refreshAccessToken();
    return refreshed;
  }
  return _cachedToken;
}

export async function refreshAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) {
    clearTokenCache();
    return null;
  }
  _cachedToken = data.session?.access_token ?? null;
  _initialized = true;
  return _cachedToken;
}

export function clearTokenCache() {
  _cachedToken  = null;
  _initialized  = false;
}
