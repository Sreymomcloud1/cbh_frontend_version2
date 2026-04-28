import type { Request, Response, NextFunction } from "express";
import { type ZodSchema } from "zod";

type ValidationTarget = "body" | "query" | "params";

/**
 * validate(schema, target?)
 *
 * Validates req[target] against a Zod schema.
 */
export function validate(schema: ZodSchema, target: ValidationTarget = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req[target]);

    if (!parsed.success) {
      next(parsed.error);
      return;
    }

    // Fix: Cast to unknown first to safely override the property
    (req as unknown as Record<string, unknown>)[target] = parsed.data;
    
    next();
  };
}