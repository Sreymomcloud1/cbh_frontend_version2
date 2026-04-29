import { Router } from "express";
import { requireAuth, requireAdmin } from "@/middleware/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { sendSuccess, sendError } from "@/lib/response";
import { z } from "zod";
import { validate } from "@/middleware/validate";
import { randomBytes } from "node:crypto";
import { AppError, ConflictError } from "@/lib/errors";
import { env } from "@/config/env";
import {
  isSmtpConfigured,
  sendAdminCreatedOwnerCredentialsEmail,
  sendBusinessVerificationApprovedEmail,
  sendBusinessVerificationRejectedEmail,
} from "@/lib/email";

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

const verifySchema = z
  .object({
    action: z.enum(["verify", "reject", "revoke"]),
    reason: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if ((data.action === "reject" || data.action === "revoke") && !data.reason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A reason is required when rejecting or revoking.",
        path: ["reason"],
      });
    }
  });

/** Keeps admin /users in sync with business verification (profile.role + auth user_metadata). */
async function syncBusinessOwnerRoleForVerification(
  ownerId: string,
  mode: "verified" | "unlisted",
): Promise<void> {
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", ownerId)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((prof as any)?.role === "admin") return;

  if (mode === "verified") {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        role: "business",
        pending_business: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ownerId);
    if (error) throw error;
  } else {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        role: "buyer",
        pending_business: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ownerId);
    if (error) throw error;
  }

  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.getUserById(ownerId);
  if (authErr || !authData?.user) return;

  const meta: Record<string, unknown> = { ...(authData.user.user_metadata ?? {}) };
  if (mode === "verified") {
    meta.role = "business";
    meta.intended_role = "business";
  } else {
    meta.role = "buyer";
    meta.intended_role = "buyer";
  }
  await supabaseAdmin.auth.admin.updateUserById(ownerId, { user_metadata: meta }).catch(() => undefined);
}

async function sendVerificationMessageToBusinessOwner(params: {
  adminId: string;
  businessId: string;
  businessName: string;
  ownerId?: string;
  action: "verify" | "reject" | "revoke";
  reason?: string;
}) {
  const { adminId, businessId, businessName, ownerId, action, reason } = params;
  if (!ownerId) return;

  const nowIso = new Date().toISOString();
  const messageContent =
    action === "verify"
      ? `Admin update: Your business "${businessName}" has been approved and is now visible in Explore Suppliers.`
      : action === "reject"
        ? `Admin update: Your business "${businessName}" was not approved.${
            reason?.trim() ? ` Reason: ${reason.trim()}` : ""
          }`
        : `Admin update: Your business "${businessName}" has been revoked/unpublished.${
            reason?.trim() ? ` Reason: ${reason.trim()}` : ""
          }`;

  // Create a lightweight system request so the message appears in the existing Messages UI.
  const { data: req, error: reqErr } = await supabaseAdmin
    .from("requests")
    .insert({
      buyer_id: adminId,
      business_id: businessId,
      purpose: "collaborate",
      product: "CBH Verification Update",
      quantity: null,
      required_date: nowIso,
      location: "CBH Admin",
      notes: "system:admin_verification_notice",
      status: "replied",
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("id")
    .single();
  if (reqErr || !req?.id) throw reqErr ?? new Error("Failed to create admin notice request");

  const { data: conv, error: convErr } = await supabaseAdmin
    .from("conversations")
    .insert({
      request_id: req.id,
      business_id: businessId,
      buyer_id: adminId,
      status: "replied",
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("id")
    .single();
  if (convErr || !conv?.id) throw convErr ?? new Error("Failed to create admin notice conversation");

  await supabaseAdmin
    .from("requests")
    .update({ conversation_id: conv.id, updated_at: nowIso })
    .eq("id", req.id);

  const { error: msgErr } = await supabaseAdmin
    .from("messages")
    .insert({
      conversation_id: conv.id,
      sender_id: adminId,
      content: messageContent,
      is_read: false,
      created_at: nowIso,
    });
  if (msgErr) throw msgErr;
}

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ownerId = (data as any).owner_id as string | undefined;
    if (ownerId) {
      if (action === "verify") {
        await syncBusinessOwnerRoleForVerification(ownerId, "verified");
      } else {
        await syncBusinessOwnerRoleForVerification(ownerId, "unlisted");
      }
    }

    // Write audit log
    await supabaseAdmin.from("business_audit_log").insert({
      business_id: bizId,
      admin_id:    adminId,
      admin_email: adminEmail,
      action:      logAction,
      reason:      reason ?? null,
    });

    // Notify business contact email (best-effort; admin action already persisted)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = data as any;
    const contactEmail = String(row.contact_email ?? "").trim();
    const businessName = String(row.name ?? "Your listing");
    let ownerDisplayName = businessName;
    if (ownerId) {
      const { data: prof } = await supabaseAdmin.from("profiles").select("name").eq("id", ownerId).maybeSingle();
      const n = (prof as { name?: string } | null)?.name?.trim();
      if (n) ownerDisplayName = n;
    }
    const siteBase = (env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
    const dashboardUrl = `${siteBase}/business-dashboard`;
    const loginUrl = `${siteBase}/auth/login`;

    if (contactEmail) {
      try {
        if (action === "verify") {
          await sendBusinessVerificationApprovedEmail({
            toEmail: contactEmail,
            ownerName: ownerDisplayName,
            businessName,
            dashboardUrl,
          });
        } else {
          await sendBusinessVerificationRejectedEmail({
            toEmail: contactEmail,
            ownerName: ownerDisplayName,
            businessName,
            kind: action === "revoke" ? "revoked" : "rejected",
            reason: reason?.trim() || "No additional details provided.",
            loginUrl,
          });
        }
      } catch (e) {
        console.error("[admin/businesses/:id/verify] Owner notification email failed:", e);
      }
    }

    // Also deliver an in-app message to business Messages tab (best-effort).
    try {
      await sendVerificationMessageToBusinessOwner({
        adminId,
        businessId: bizId,
        businessName,
        ownerId,
        action,
        reason,
      });
    } catch (e) {
      console.error("[admin/businesses/:id/verify] In-app verification message failed:", e);
    }

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
  facebook_url: z
    .string()
    .trim()
    .min(1, "Facebook Page URL is required")
    .url("Facebook Page URL must be a valid URL")
    .max(500),
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
});

function generateOwnerTempPassword(): string {
  return randomBytes(18).toString("hex");
}

/**
 * Creates a Supabase Auth user + profile row for the business contact (no email yet).
 * Caller must send credentials after the business row is inserted successfully.
 */
async function provisionNewBusinessAuthUser(params: {
  email: string;
  businessName: string;
  contactPhone: string;
}): Promise<{ userId: string; password: string }> {
  if (!isSmtpConfigured()) {
    throw new AppError(
      503,
      "Cannot create a new owner account: SMTP is not configured. Set SMTP_USER and SMTP_PASS (and optional SMTP_HOST / SMTP_FROM), then try again.",
      "SMTP_NOT_CONFIGURED",
    );
  }

  const email = params.email.trim().toLowerCase();
  const password = generateOwnerTempPassword();
  const displayName = params.businessName.trim().slice(0, 120);

  const createResult = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name: displayName,
      role: "business",
      intended_role: "business",
    },
  });

  if (createResult.error || !createResult.data.user?.id) {
    const msg = createResult.error?.message ?? "";
    if (/already|registered|exists|duplicate/i.test(msg)) {
      throw new ConflictError(
        "An account with this contact email already exists in authentication. Use a different email, or link an existing user via owner_user_id if your API supports it.",
      );
    }
    throw createResult.error ?? new Error("Failed to create authentication user for this business.");
  }

  const userId = createResult.data.user.id;

  const { error: profErr } = await supabaseAdmin
    .from("profiles")
    .update({
      name: displayName,
      role: "business",
      phone: params.contactPhone.trim().slice(0, 40),
      pending_business: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (profErr) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    throw profErr;
  }

  return { userId, password };
}

type AdminCreateOwnerResolution = {
  ownerId: string;
  invitedNewOwner: boolean;
  /** When set, email credentials after the business insert succeeds */
  pendingInvitePassword?: string;
};

async function resolveOwnerIdForAdminCreate(
  payload: z.infer<typeof createBusinessSchema>,
): Promise<AdminCreateOwnerResolution> {
  if (payload.owner_user_id) {
    return { ownerId: payload.owner_user_id, invitedNewOwner: false };
  }

  const emailNorm = payload.contact_email.trim().toLowerCase();

  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", emailNorm)
    .maybeSingle();

  if (existingProfile?.id) {
    const { count } = await supabaseAdmin
      .from("businesses")
      .select("id", { head: true, count: "exact" })
      .eq("owner_id", existingProfile.id)
      .eq("is_active", true);

    if ((count ?? 0) >= 1) {
      throw new ConflictError(
        "This contact email already belongs to a user with an active business. Use another email or deactivate the existing listing first.",
      );
    }

    return { ownerId: existingProfile.id, invitedNewOwner: false };
  }

  const { userId, password } = await provisionNewBusinessAuthUser({
    email: payload.contact_email,
    businessName: payload.name,
    contactPhone: payload.contact_phone,
  });

  return { ownerId: userId, invitedNewOwner: true, pendingInvitePassword: password };
}

// POST /api/v1/admin/businesses/create — admin manually adds a business
router.post("/businesses/create", validate(createBusinessSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof createBusinessSchema>;
    const { ownerId, invitedNewOwner, pendingInvitePassword } = await resolveOwnerIdForAdminCreate(body);

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
        facebook_url:         body.facebook_url,
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
    if (error) {
      if (invitedNewOwner) {
        await supabaseAdmin.auth.admin.deleteUser(ownerId).catch(() => undefined);
      }
      throw error;
    }

    await supabaseAdmin
      .from("profiles")
      .update({
        role: "business",
        phone: body.contact_phone.trim().slice(0, 40),
        pending_business: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ownerId);

    await supabaseAdmin.auth.admin
      .updateUserById(ownerId, {
        user_metadata: {
          name: body.name.trim().slice(0, 120),
          role: "business",
          intended_role: "business",
        },
      })
      .catch(() => undefined);

    let ownerCredentialsEmailed = false;
    let ownerCredentialsEmailError: string | undefined;
    if (invitedNewOwner && pendingInvitePassword) {
      const site = env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      const loginUrl = `${site.replace(/\/$/, "")}/auth/login`;
      const displayName = body.name.trim().slice(0, 120);
      const toEmail = body.contact_email.trim().toLowerCase();
      try {
        await sendAdminCreatedOwnerCredentialsEmail({
          toEmail,
          recipientName: displayName,
          businessName: body.name.trim(),
          temporaryPassword: pendingInvitePassword,
          loginUrl,
        });
        ownerCredentialsEmailed = true;
      } catch (e) {
        ownerCredentialsEmailError = e instanceof Error ? e.message : "Email send failed";
        console.error("[admin/businesses/create] Owner invite email failed:", e);
      }
    }

    sendSuccess(res, {
      ...data,
      ownerCredentialsEmailed,
      ...(ownerCredentialsEmailError ? { ownerCredentialsEmailError } : {}),
    });
  } catch (err) { next(err); }
});


export default router;
