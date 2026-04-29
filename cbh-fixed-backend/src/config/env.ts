import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV:                 z.enum(["development", "production", "test"]).default("development"),
  PORT:                     z.coerce.number().default(4000),
  SUPABASE_URL:             z.string().url(),
  SUPABASE_ANON_KEY:        z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY:z.string().min(1),
  ALLOWED_ORIGINS:          z.string().default("http://localhost:3000"),
  ALLOW_TRYCLOUDFLARE_ORIGINS: z.coerce.boolean().default(false),
  RATE_LIMIT_WINDOW_MS:     z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX:           z.coerce.number().default(200),
  // Email
  SMTP_HOST:                z.string().optional(),
  SMTP_PORT:                z.coerce.number().optional(),
  SMTP_USER:                z.string().optional(),
  SMTP_PASS:                z.string().optional(),
  SMTP_FROM:                z.string().optional(),
  CONTACT_EMAIL:            z.string().optional(),
  // Site URL for email links
  NEXT_PUBLIC_SITE_URL:     z.string().optional(),
  // Supabase Storage
  SUPABASE_STORAGE_BUCKET:  z.string().default("business-assets"),
  AVATAR_BUCKET:            z.string().default("avatars"),
  MAX_FILE_SIZE_MB:         z.coerce.number().default(5),
  // Optional extras
  API_PREFIX:               z.string().optional(),
  DATABASE_URL:             z.string().optional(),
  DATABASE_SSL:             z.string().optional(),
  DIRECT_URL:               z.string().optional(),
  JWT_SECRET:               z.string().optional(),
  JWT_EXPIRES_IN:           z.string().optional(),
  JWT_REFRESH_SECRET:       z.string().optional(),
  JWT_REFRESH_EXPIRES_IN:   z.string().optional(),
  AUTH_RATE_LIMIT_MAX:      z.coerce.number().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isDev = env.NODE_ENV === "development";
export const isProd = env.NODE_ENV === "production";

