import { z } from "zod";

const ecoBreakdownSchema = z.object({
  packaging: z.number().min(0).max(20),
  sourcing: z.number().min(0).max(20),
  energy: z.number().min(0).max(15),
  waste: z.number().min(0).max(20),
  delivery: z.number().min(0).max(15),
  practices: z.number().min(0).max(10),
});

export const createBusinessSchema = z.object({
  name: z.string().min(2).max(150).trim(),
  tagline: z.string().max(200).trim(),
  description: z.string().min(20).max(2000).trim(),
  category: z.enum(["Food", "Ingredients", "Packaging", "Rentals", "Event Services", "Others"]),
  sub_categories: z.array(z.string()).default([]),
  tier: z.enum(["Startup", "SME", "Company"]),
  location_city: z.string().min(2).trim(),
  location_detail: z.string().min(2).trim(),
  map_url: z.string().url().nullable().optional(),
  logo_url: z.string().url().nullable().optional(),
  gallery_urls: z.array(z.string().url()).max(8).default([]),
  discount_percent: z.number().min(0).max(100).nullable().optional(),
  bulk_support: z.boolean().default(false),
  bulk_capacity: z.string().max(100).nullable().optional(),
  tags: z.array(z.string().max(30)).max(10).default([]),
  services: z.array(z.string().max(100)).min(1).max(20),
  contact_email: z.string().email(),
  contact_phone: z.string().min(6).max(30),
  website_url: z.string().url().nullable().optional(),
  facebook_url: z.string().url().nullable().optional(),
  telegram_url: z.string().url().nullable().optional(),
  open_for_collaboration: z.boolean().default(false),
  collaboration_types: z.array(z.enum(["supplier", "partner", "marketing"])).default([]),
  collaboration_description: z.string().max(500).nullable().optional(),
  open_for_investment: z.boolean().default(false),
  investment_amount: z.string().max(100).nullable().optional(),
  investment_description: z.string().max(500).nullable().optional(),
  founded_year: z.number().int().min(1900).max(new Date().getFullYear()).nullable().optional(),
  eco_description: z.string().max(1000).nullable().optional(),
  tax_id: z.string().max(50).nullable().optional(),
  notify_by_email: z.boolean().optional(),
  notify_by_phone: z.boolean().optional(),
});

export const updateBusinessSchema = createBusinessSchema.partial();

export const updateEcoScoreSchema = z.object({
  breakdown: ecoBreakdownSchema,
});

export const listBusinessesSchema = z.object({
  search: z.string().max(200).optional(),
  category: z
    .enum(["Food", "Ingredients", "Packaging", "Rentals", "Event Services", "Others"])
    .optional(),
  tier: z.enum(["Startup", "SME", "Company"]).optional(),
  location: z.string().optional(),
  min_eco_score: z.coerce.number().min(0).max(100).optional(),
  bulk_support: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  open_for_collaboration: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  open_for_investment: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
export type UpdateEcoScoreInput = z.infer<typeof updateEcoScoreSchema>;
export type ListBusinessesInput = z.infer<typeof listBusinessesSchema>;

// Patch: additional fields added to businesses table
// These are merged into updateBusinessSchema automatically via .partial()
