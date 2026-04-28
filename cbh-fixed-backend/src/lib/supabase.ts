import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/config/env";
import type { Database } from "@/types/database";

/**
 * Anon client — respects Row Level Security.
 * Used for queries that run in the context of the authenticated user.
 */
export const supabase = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

/**
 * Admin client — bypasses Row Level Security.
 * Used ONLY for server-side operations that require elevated access.
 * Never expose this to the client.
 *
 * Typed as `any` database to avoid supabase-js v2.45+ strict generic resolution
 * issues where Insert/Update slots collapse to `never`. All mutation shapes are
 * validated at the service layer via Zod before reaching here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabaseAdmin = createClient<any>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/**
 * Returns an authenticated Supabase client scoped to a specific user's JWT.
 * This ensures RLS policies are applied correctly for each request.
 *
 * Also typed as `any` for the same reason — Insert/Update shapes are validated
 * by Zod validators before hitting the DB. The Row types are still used for
 * .select() return values via explicit casts in the service layer.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAuthClient(jwt: string): SupabaseClient<any> {
  return createClient<any>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

/**
 * Public anon client for unauthenticated routes (no auth header available).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPublicClient(): SupabaseClient<any> {
  return supabase as SupabaseClient<any>;
}
