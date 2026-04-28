import { Router } from "express";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { sendSuccess, sendError } from "@/lib/response";

const router = Router();

/**
 * GET /api/v1/debug/db
 * Runs a lightweight query against every table and reports which ones are accessible.
 * Only available in development. Remove before going to production.
 */
router.get("/db", async (_req, res) => {
  const tables = [
    "profiles",
    "businesses",
    "requests",
    "conversations",
    "messages",
    "saved_businesses",
    "rewards",
  ] as const;

  const results: Record<string, { ok: boolean; count?: number; error?: string }> = {};

  for (const table of tables) {
    try {
      const { count, error } = await supabaseAdmin
        .from(table)
        .select("*", { count: "exact", head: true });

      results[table] = error
        ? { ok: false, error: error.message }
        : { ok: true, count: count ?? 0 };
    } catch (err) {
      results[table] = { ok: false, error: String(err) };
    }
  }

  // Test the increment_points RPC
  let rpcStatus = "unknown";
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabaseAdmin.rpc("increment_points", {
      user_id: "00000000-0000-0000-0000-000000000000",
      amount: 0,
    } as any);
    rpcStatus = error ? `error: ${error.message}` : "ok";
  } catch (err) {
    rpcStatus = `exception: ${String(err)}`;
  }

  sendSuccess(res, {
    tables: results,
    rpc_increment_points: rpcStatus,
    supabase_url: process.env.SUPABASE_URL,
  });
});

/**
 * GET /api/v1/debug/auth
 * Returns the auth user from a Bearer token — useful to confirm your JWT is valid.
 */
router.get("/auth", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    sendError(res, 401, "No Bearer token provided", "UNAUTHORIZED");
    return;
  }

  const token = authHeader.slice(7);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    sendError(res, 401, error?.message ?? "Invalid token", "UNAUTHORIZED");
    return;
  }

  sendSuccess(res, {
    user_id: data.user.id,
    email: data.user.email,
    name: data.user.user_metadata?.name,
// role is read from profiles table, not metadata
    email_confirmed: data.user.email_confirmed_at !== null,
  });
});

export default router;
