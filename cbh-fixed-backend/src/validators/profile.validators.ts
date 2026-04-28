import { z } from "zod";

export const updateProfileSchema = z.object({
  name:       z.string().min(2).max(100).trim().optional(),
  avatar_url: z.string().url().nullable().optional(),
  phone:      z.string().min(6).max(20).nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
