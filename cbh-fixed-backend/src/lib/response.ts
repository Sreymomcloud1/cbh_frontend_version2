import type { Response } from "express";

interface SuccessPayload<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

interface ErrorPayload {
  success: false;
  error: {
    message: string;
    code?: string;
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: Record<string, unknown>
): Response {
  const payload: SuccessPayload<T> = { success: true, data };
  if (meta) payload.meta = meta;
  return res.status(statusCode).json(payload);
}

export function sendError(
  res: Response,
  statusCode: number,
  message: string,
  code?: string
): Response {
  const payload: ErrorPayload = {
    success: false,
    error: { message, ...(code && { code }) },
  };
  return res.status(statusCode).json(payload);
}
