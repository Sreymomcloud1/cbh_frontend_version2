import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { sendError } from "@/lib/response";
import { isDev } from "@/config/env";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Always log the real error with full context so you can read it in terminal
  console.error(`\n❌ [${req.method} ${req.path}]`, {
    name: err.name,
    message: err.message,
    stack: isDev ? err.stack : undefined,
  });

  // Zod validation errors → 400
  if (err instanceof ZodError) {
    const messages = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
    sendError(res, 400, messages.join("; "), "VALIDATION_ERROR");
    return;
  }

  // Our typed HTTP errors (NotFoundError, ForbiddenError, etc.)
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.message, err.code);
    return;
  }

  // Supabase / Postgres errors — surface the real message in dev
  const message = isDev
    ? `Internal error: ${err.message}`
    : "Internal server error";

  sendError(res, 500, message, "INTERNAL_ERROR");
}

/** Catch 404 for unmatched routes */
export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 404, `Route ${req.method} ${req.path} not found`, "ROUTE_NOT_FOUND");
}
