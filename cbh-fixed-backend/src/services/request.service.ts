import type { SupabaseClient } from "@supabase/supabase-js";
import type { Request as DBRequest } from "@/types/database";
import type {
  CreateRequestInput,
  UpdateRequestStatusInput,
  ListRequestsInput,
} from "@/validators/request.validators";
import { NotFoundError, ForbiddenError } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase";
import { sendMessageNotification } from "@/lib/email";

const REWARD_POINTS = {
  request_sent:    5,
  deal_completed: 10,
} as const;

export class RequestService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private db: SupabaseClient<any>) {}

  async listMyRequests(buyerId: string, filters: ListRequestsInput) {
    const { page, limit, purpose, status } = filters;

    let query = this.db
      .from("requests")
      .select(`*, business:businesses ( id, name, logo_url, location_city, eco_score_overall )`,
        { count: "exact" })
      .eq("buyer_id", buyerId)
      .order("created_at", { ascending: false });

    if (purpose) query = query.eq("purpose", purpose);
    if (status)  query = query.eq("status",  status);

    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    return {
      requests: data ?? [],
      pagination: { page, limit, total: count ?? 0, total_pages: Math.ceil((count ?? 0) / limit) },
    };
  }

  async listBusinessRequests(businessId: string, filters: ListRequestsInput) {
    const { page, limit, purpose, status } = filters;

    let query = this.db
      .from("requests")
      .select(`*, buyer:profiles!buyer_id ( id, name, email, avatar_url )`,
        { count: "exact" })
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (purpose) query = query.eq("purpose", purpose);
    if (status)  query = query.eq("status",  status);

    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    return {
      requests: data ?? [],
      pagination: { page, limit, total: count ?? 0, total_pages: Math.ceil((count ?? 0) / limit) },
    };
  }

  async getRequest(id: string, userId: string) {
    const { data, error } = await this.db
      .from("requests")
      .select(`*,
        business:businesses ( id, name, logo_url, contact_email, contact_phone ),
        buyer:profiles!buyer_id ( id, name, email )`)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError("Request");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = data as any;
    const isOwner = row.buyer_id === userId;

    let isBusinessOwner = false;
    if (row.business_id) {
      const { data: biz, error: bizErr } = await this.db
        .from("businesses")
        .select("owner_id")
        .eq("id", row.business_id)
        .maybeSingle();
      if (bizErr) throw bizErr;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      isBusinessOwner = (biz as any)?.owner_id === userId;
    }

    if (!isOwner && !isBusinessOwner) throw new ForbiddenError("Access denied");
    return row as DBRequest & { business?: unknown; buyer?: unknown };
  }

  async createRequest(buyerId: string, input: CreateRequestInput) {
    const bizId = input.business_id && input.business_id.trim() !== "" ? input.business_id : null;

    const { data: request, error } = await this.db
      .from("requests")
      .insert({
        buyer_id:      buyerId,
        business_id:   bizId,
        purpose:       input.purpose,
        product:       input.product,
        quantity:      input.quantity      ?? null,
        required_date: input.required_date,
        location:      input.location,
        notes:         input.notes         ?? null,
        event_type:    input.event_type    ?? null,
        guest_count:   input.guest_count   ?? null,
        budget_range:  input.budget_range  ?? null,
        urgency:       input.urgency       ?? null,
        status:        "pending",
      })
      .select()
      .single();
    if (error) throw error;
    if (!request) throw new Error("Failed to create request");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = request as any;

    let conversation = null;
    if (bizId) {
      const { data: conv, error: convErr } = await this.db
        .from("conversations")
        .insert({ request_id: req.id, business_id: bizId, buyer_id: buyerId, status: "pending" })
        .select()
        .single();
      if (convErr) throw convErr;

      if (conv) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = conv as any;
        await this.db.from("requests").update({ conversation_id: c.id }).eq("id", req.id);
        conversation = conv;
      }
    }

    await this.awardPoints(buyerId, "request_sent", REWARD_POINTS.request_sent, req.id);

    // Email notification to business
    if (bizId) {
      try {
        const { data: biz } = await this.db
          .from("businesses")
          .select("name, contact_email, notify_by_email")
          .eq("id", bizId)
          .maybeSingle();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const b = biz as any;
        if (b?.notify_by_email && b?.contact_email) {
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
          await sendMessageNotification({
            businessEmail:  b.contact_email,
            businessName:   b.name,
            senderName:     "A buyer on CBH",
            senderEmail:    "",
            messageContent: `New ${input.purpose} request for: ${input.product}. Log in to your dashboard to view and reply.`,
            product:        input.product,
            purpose:        input.purpose,
            loginUrl:       `${siteUrl}/auth/login`,
          });
        }
      } catch (e) {
        console.warn("Request notification email failed:", (e as Error).message);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { request: { ...req, conversation_id: (conversation as any)?.id ?? null }, conversation };
  }

  async updateRequestStatus(id: string, userId: string, input: UpdateRequestStatusInput): Promise<DBRequest> {
    const request = await this.getRequest(id, userId);

    const { data, error } = await this.db
      .from("requests")
      .update({ status: input.status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new NotFoundError("Request");

    if (input.status === "completed") {
      await this.awardPoints(request.buyer_id, "deal_completed", REWARD_POINTS.deal_completed, id);
      if (request.conversation_id) {
        await this.db
          .from("conversations")
          .update({ status: "completed", updated_at: new Date().toISOString() })
          .eq("id", request.conversation_id);
      }
    }

    return data as DBRequest;
  }

  private async awardPoints(
    userId: string,
    action: string,
    points: number,
    referenceId: string
  ): Promise<void> {
    const { error: rewardErr } = await supabaseAdmin.from("rewards").insert({
      user_id: userId, action, points, reference_id: referenceId,
    });
    if (rewardErr) {
      console.error("Failed to insert reward record:", rewardErr.message);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await supabaseAdmin.rpc("increment_points", {
      user_id: userId,
      amount:  points,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    if (rpcError) {
      console.warn("increment_points RPC not available, falling back:", rpcError.message);
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("reward_points")
        .eq("id", userId)
        .maybeSingle();
      if (profile) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = profile as any;
        await supabaseAdmin
          .from("profiles")
          .update({ reward_points: (p.reward_points ?? 0) + points })
          .eq("id", userId);
      }
    }
  }
}
