import { Router } from "express";
import { requireAuth, requireAdmin } from "@/middleware/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { sendSuccess, sendError } from "@/lib/response";
import { z } from "zod";
import { validate } from "@/middleware/validate";
import { randomUUID } from "node:crypto";

const router = Router();
router.use(requireAuth, requireAdmin);

// ── Stats ────────────────────────────────────────────────────────────────────

router.get("/stats", async (_req, res, next) => {
  try {
    const [profiles, businesses, requests, messages, pending] = await Promise.all([
      supabaseAdmin.from("profiles").select("*",    { count: "exact", head: true }),
      supabaseAdmin.from("businesses").select("*",  { count: "exact", head: true }),
      supabaseAdmin.from("requests").select("*",    { count: "exact", head: true }),
      supabaseAdmin.from("messages").select("*",    { count: "exact", head: true }),
      supabaseAdmin.from("businesses").select("*",  { count: "exact", head: true }).eq("verification_status", "pending"),
    ]);
    sendSuccess(res, {
      total_users:          profiles.count   ?? 0,
      total_businesses:     businesses.count ?? 0,
      total_requests:       requests.count   ?? 0,
      total_messages:       messages.count   ?? 0,
      pending_verification: pending.count    ?? 0,
    });
  } catch (err) { next(err); }
});

// ── Businesses ───────────────────────────────────────────────────────────────

// GET /api/v1/admin/businesses?status=pending|verified|rejected|revoked|all
router.get("/businesses", async (req, res, next) => {
  try {
    const { status, search } = req.query as { status?: string; search?: string };
    let query = supabaseAdmin
      .from("businesses")
      .select(`
        id, name, tagline, description, category, tier,
        location_city, location_detail, logo_url, gallery_urls,
        contact_email, contact_phone, website_url, facebook_url, telegram_url,
        eco_score_overall, eco_level, is_verified, is_active,
        verification_status, rejection_reason,
        verified_at, rejected_at, created_at, updated_at,
        services, tags, rating, review_count,
        open_for_collaboration, open_for_investment,
        owner:profiles!owner_id ( id, name, email )
      `, { count: "exact" })
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("verification_status", status);
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,contact_email.ilike.%${search}%,location_city.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    sendSuccess(res, data ?? [], 200, { total: count ?? 0 });
  } catch (err) { next(err); }
});

// GET /api/v1/admin/businesses/:id — full detail + audit log
router.get("/businesses/:id", async (req, res, next) => {
  try {
    const { data: biz, error } = await supabaseAdmin
      .from("businesses")
      .select(`
        *,
        owner:profiles!owner_id ( id, name, email, phone, created_at )
      `)
      .eq("id", req.params.id as string)
      .single();
    if (error) throw error;
    if (!biz) { sendError(res, 404, "Business not found", "NOT_FOUND"); return; }

    const { data: auditLog } = await supabaseAdmin
      .from("business_audit_log")
      .select("*")
      .eq("business_id", req.params.id as string)
      .order("created_at", { ascending: false })
      .limit(20);

    sendSuccess(res, { ...biz, audit_log: auditLog ?? [] });
  } catch (err) { next(err); }
});

// ── Verification actions ─────────────────────────────────────────────────────

const verifySchema = z.object({
  action: z.enum(["verify", "reject", "revoke"]),
  reason: z.string().max(500).optional(),
});

// POST /api/v1/admin/businesses/:id/verify
router.post("/businesses/:id/verify", validate(verifySchema), async (req, res, next) => {
  try {
    const adminId    = req.user.id;
    const adminEmail = req.user.email ?? "";
    const bizId      = req.params.id as string;
    const { action, reason } = req.body as { action: "verify" | "reject" | "revoke"; reason?: string };

    let update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    let logAction = "";

    if (action === "verify") {
      update = {
        ...update,
        verification_status: "verified",
        is_verified:         true,
        is_active:           true,
        rejection_reason:    null,
        verified_at:         new Date().toISOString(),
        verified_by:         adminId,
      };
      logAction = "verified";
    } else if (action === "reject") {
      update = {
        ...update,
        verification_status: "rejected",
        is_verified:         false,
        is_active:           false,
        rejection_reason:    reason ?? null,
        rejected_at:         new Date().toISOString(),
        rejected_by:         adminId,
      };
      logAction = "rejected";
    } else if (action === "revoke") {
      update = {
        ...update,
        verification_status: "revoked",
        is_verified:         false,
        is_active:           false,
        rejection_reason:    reason ?? null,
        rejected_at:         new Date().toISOString(),
        rejected_by:         adminId,
      };
      logAction = "revoked";
    }

    const { data, error } = await supabaseAdmin
      .from("businesses")
      .update(update)
      .eq("id", bizId)
      .select()
      .single();
    if (error) throw error;
    if (!data) { sendError(res, 404, "Business not found", "NOT_FOUND"); return; }

    // Write audit log
    await supabaseAdmin.from("business_audit_log").insert({
      business_id: bizId,
      admin_id:    adminId,
      admin_email: adminEmail,
      action:      logAction,
      reason:      reason ?? null,
    });

    sendSuccess(res, data);
  } catch (err) { next(err); }
});

// ── Users ────────────────────────────────────────────────────────────────────

router.get("/users", async (req, res, next) => {
  try {
    const { search } = req.query as { search?: string };
    let query = supabaseAdmin
      .from("profiles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }
    const { data, error, count } = await query;
    if (error) throw error;
    sendSuccess(res, data ?? [], 200, { total: count ?? 0 });
  } catch (err) { next(err); }
});

const updateUserSchema = z.object({
  role:        z.enum(["buyer", "business", "admin"]).optional(),
  is_verified: z.boolean().optional(),
});

router.patch("/users/:id", validate(updateUserSchema), async (req, res, next) => {
  try {
    const payload = { ...(req.body as Record<string, unknown>), updated_at: new Date().toISOString() };
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update(payload)
      .eq("id", req.params.id as string)
      .select()
      .single();
    if (error) throw error;
    if (!data) { sendError(res, 404, "User not found", "NOT_FOUND"); return; }
    sendSuccess(res, data);
  } catch (err) { next(err); }
});

// GET /api/v1/admin/users/pending-business
router.get("/users/pending-business", async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email, created_at")
      .eq("pending_business", true)
      .eq("role", "buyer")
      .order("created_at", { ascending: true });
    if (error) throw error;
    sendSuccess(res, data ?? []);
  } catch (err) { next(err); }
});

// POST /api/v1/admin/users/:id/approve-business
router.post("/users/:id/approve-business", async (req, res, next) => {
  try {
    const userId = req.params.id as string;
    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .update({ role: "business", pending_business: false, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (profileErr) throw profileErr;

    await supabaseAdmin
      .from("businesses")
      .update({ is_active: true, verification_status: "verified", is_verified: true, updated_at: new Date().toISOString() })
      .eq("owner_id", userId);

    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { role: "business", intended_role: "business" },
    });

    sendSuccess(res, { approved: true });
  } catch (err) { next(err); }
});

const ecoBreakdownSchema = z.object({
  packaging: z.number().min(0).max(100).default(0),
  sourcing: z.number().min(0).max(100).default(0),
  energy: z.number().min(0).max(100).default(0),
  waste: z.number().min(0).max(100).default(0),
  delivery: z.number().min(0).max(100).default(0),
  practices: z.number().min(0).max(100).default(0),
});

const createBusinessSchema = z.object({
  owner_user_id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  tagline: z.string().max(160).optional(),
  description: z.string().max(5000).optional(),
  category: z.enum(["Food", "Ingredients", "Packaging", "Rentals", "Event Services", "Others"]),
  sub_categories: z.array(z.string().min(1).max(80)).max(20).optional(),
  tier: z.enum(["Startup", "SME", "Company"]).optional(),
  location_city: z.string().min(1).max(80),
  location_detail: z.string().max(200).optional(),
  map_url: z.string().url().max(500).optional(),
  logo_url: z.string().url().max(500).optional(),
  gallery_urls: z.array(z.string().url().max(500)).max(20).optional(),
  eco_score_overall: z.number().int().min(0).max(100).optional(),
  eco_level: z.enum(["Basic", "Medium", "High"]).optional(),
  eco_breakdown: ecoBreakdownSchema.optional(),
  eco_description: z.string().max(3000).optional(),
  discount_percent: z.number().int().min(0).max(100).optional(),
  bulk_support: z.boolean().optional(),
  bulk_capacity: z.string().max(200).optional(),
  tags: z.array(z.string().min(1).max(80)).max(30).optional(),
  services: z.array(z.string().min(1).max(120)).max(50).optional(),
  contact_email: z.string().email(),
  contact_phone: z.string().min(1).max(40),
  website_url: z.string().url().max(500).optional(),
  facebook_url: z.string().url().max(500).optional(),
  telegram_url: z.string().url().max(500).optional(),
  tax_id: z.string().max(120).optional(),
  open_for_collaboration: z.boolean().optional(),
  collaboration_types: z.array(z.string().min(1).max(80)).max(10).optional(),
  collaboration_description: z.string().max(3000).optional(),
  open_for_investment: z.boolean().optional(),
  investment_amount: z.string().max(120).optional(),
  investment_description: z.string().max(3000).optional(),
  founded_year: z.number().int().min(1900).max(2100).optional(),
  notify_by_email: z.boolean().optional(),
  notify_by_phone: z.boolean().optional(),
}).superRefine((data, ctx) => {
  const hasFacebook = Boolean(data.facebook_url && data.facebook_url.trim());
  const hasTelegram = Boolean(data.telegram_url && data.telegram_url.trim());
  if (!hasFacebook && !hasTelegram) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["facebook_url"],
      message: "At least one verification contact is required: Facebook URL or Telegram URL.",
    });
  }
});

async function createImportOwnerEmailFallback(adminId: string, businessName: string) {
  const fallbackEmail = `import+${randomUUID()}@cbh.local`;
  const createResult = await supabaseAdmin.auth.admin.createUser({
    email: fallbackEmail,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: {
      name: `Imported - ${businessName}`.slice(0, 120),
      role: "business",
      intended_role: "business",
      imported_by: adminId,
      imported_listing: true,
    },
  });
  if (createResult.error || !createResult.data.user?.id) {
    throw createResult.error ?? new Error("Failed to create imported owner account.");
  }
  return createResult.data.user.id;
}

async function resolveOwnerIdForAdminCreate(payload: z.infer<typeof createBusinessSchema>, adminId: string) {
  if (payload.owner_user_id) return payload.owner_user_id;

  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", payload.contact_email)
    .maybeSingle();

  if (existingProfile?.id) {
    const { count } = await supabaseAdmin
      .from("businesses")
      .select("id", { head: true, count: "exact" })
      .eq("owner_id", existingProfile.id)
      .eq("is_active", true);

    if ((count ?? 0) === 0) return existingProfile.id;
  }

  return createImportOwnerEmailFallback(adminId, payload.name);
}

// POST /api/v1/admin/businesses/create — admin manually adds a business
router.post("/businesses/create", validate(createBusinessSchema), async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const body = req.body as z.infer<typeof createBusinessSchema>;
    const ownerId = await resolveOwnerIdForAdminCreate(body, adminId);

    const { data, error } = await supabaseAdmin
      .from("businesses")
      .insert({
        owner_id:             ownerId,
        name:                 body.name,
        tagline:              body.tagline              ?? "",
        description:          body.description          ?? "",
        category:             body.category,
        sub_categories:       body.sub_categories       ?? [],
        tier:                 body.tier                 ?? "SME",
        location_city:        body.location_city,
        location_detail:      body.location_detail      ?? "",
        map_url:              body.map_url              ?? null,
        logo_url:             body.logo_url             ?? null,
        gallery_urls:         body.gallery_urls         ?? [],
        eco_score_overall:    body.eco_score_overall    ?? 0,
        eco_level:            body.eco_level            ?? "Basic",
        eco_breakdown:        body.eco_breakdown        ?? { packaging:0, sourcing:0, energy:0, waste:0, delivery:0, practices:0 },
        eco_description:      body.eco_description      ?? null,
        discount_percent:     body.discount_percent     ?? null,
        bulk_support:         body.bulk_support         ?? false,
        bulk_capacity:        body.bulk_capacity        ?? null,
        tags:                 body.tags                 ?? [],
        services:             body.services             ?? [],
        contact_email:        body.contact_email,
        contact_phone:        body.contact_phone,
        tax_id:               body.tax_id               ?? null,
        facebook_url:         body.facebook_url         ?? null,
        telegram_url:         body.telegram_url         ?? null,
        website_url:          body.website_url          ?? null,
        open_for_collaboration: body.open_for_collaboration ?? false,
        collaboration_types:    body.collaboration_types ?? [],
        collaboration_description: body.collaboration_description ?? null,
        open_for_investment:    body.open_for_investment ?? false,
        investment_amount:      body.investment_amount ?? null,
        investment_description: body.investment_description ?? null,
        founded_year:         body.founded_year         ?? null,
        is_verified:          false,
        is_active:            false,
        verification_status:  "pending",
        rating:               0,
        review_count:         0,
        notify_by_email:      body.notify_by_email      ?? true,
        notify_by_phone:      body.notify_by_phone      ?? false,
      })
      .select()
      .single();
    if (error) throw error;
    sendSuccess(res, data);
  } catch (err) { next(err); }
});


export default router;
