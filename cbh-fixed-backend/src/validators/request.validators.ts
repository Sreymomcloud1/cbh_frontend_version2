import { z } from "zod";

export const createRequestSchema = z.object({
  // Accept valid UUID or null/undefined — never reject empty string by coercing it to null
  business_id:   z.string().uuid().nullable().optional().or(z.literal("").transform(() => null)),
  purpose:       z.enum(["buy", "collaborate", "invest"]),
  product:       z.string().min(3).max(300).trim(),
  quantity:      z.string().max(100).nullable().optional(),
  required_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  location:      z.string().min(2).max(100).trim(),
  notes:         z.string().max(1000).nullable().optional(),
  // Smart-quote assistant extra fields (optional)
  event_type:    z.string().max(100).nullable().optional(),
  guest_count:   z.string().max(50).nullable().optional(),
  budget_range:  z.string().max(100).nullable().optional(),
  urgency:       z.string().max(100).nullable().optional(),
});

export const updateRequestStatusSchema = z.object({
  status: z.enum(["replied", "in-progress", "completed", "declined"]),
});

export const listRequestsSchema = z.object({
  purpose: z.enum(["buy", "collaborate", "invest"]).optional(),
  status: z
    .enum(["pending", "replied", "in-progress", "completed", "declined"])
    .optional(),
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateRequestInput   = z.infer<typeof createRequestSchema>;
export type UpdateRequestStatusInput = z.infer<typeof updateRequestStatusSchema>;
export type ListRequestsInput    = z.infer<typeof listRequestsSchema>;
