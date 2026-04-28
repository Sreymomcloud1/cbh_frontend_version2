import type { Request, Response, NextFunction } from "express";
import { supabase, getAuthClient, supabaseAdmin } from "@/lib/supabase";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";

/**
 * requireAuth — validates Bearer JWT with Supabase, attaches user to req
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedError("Missing or malformed Authorization header");
    }

    const token = authHeader.slice(7);
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedError("Invalid or expired token");
    }

    req.user    = data.user;
    req.token   = token;
    req.supabase = getAuthClient(token);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * requireAdmin — checks profiles.role = 'admin' in DB (not env var email list)
 * Must run after requireAuth.
 */
export async function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return next(new UnauthorizedError("Not authenticated"));
    }

    const { data } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((data as any)?.role !== "admin") {
      return next(new ForbiddenError("Admin access required"));
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * requireRole — restrict to specific role(s), reads from DB not JWT metadata
 */
export function requireRole(...roles: string[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) return next(new UnauthorizedError("Not authenticated"));

      const { data } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dbRole = (data as any)?.role as string | undefined;
      if (!dbRole || !roles.includes(dbRole)) {
        return next(new ForbiddenError(`Access restricted to: ${roles.join(", ")}`));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
