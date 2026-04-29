import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import { sendSuccess } from "@/lib/response";
import { ForbiddenError, ConflictError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";   // anon client for public read
import { supabaseAdmin } from "@/lib/supabase";
import { createSystemNotification } from "@/lib/notifications";

const router = Router();

const createReviewSchema = z.object({
  rating:  z.number().int().min(1).max(5),
  comment: z.string().max(1000).trim().optional(),
  conversation_id: z.string().uuid(),
});

// GET /api/v1/reviews/:businessId  — public, no auth
router.get("/:businessId", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("reviews")
      .select(`
        id, rating, comment, created_at,
        reviewer:profiles!reviewer_id ( id, name, avatar_url )
      `)
      .eq("business_id", req.params.businessId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    sendSuccess(res, data ?? []);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/reviews/:businessId
router.post("/:businessId", requireAuth, validate(createReviewSchema), async (req, res, next) => {
  try {
    const db = (req as any).supabase;
    const userId = (req as any).user.id;
    const businessId = req.params.businessId;

    const { data: completedConv } = await db
      .from("conversations")
      .select("id, request_id, buyer_id, business_id, status")
      .eq("id", req.body.conversation_id)
      .eq("buyer_id", userId)
      .eq("business_id", businessId) // Matches your screenshot
      .eq("status", "completed")     // Matches your screenshot 'completed' status
      .maybeSingle();

    if (!completedConv) {
      throw new ForbiddenError("You can only review from your own completed conversation session");
    }
    if (!completedConv.request_id) {
      throw new ForbiddenError("Completed conversation is missing request context");
    }

    const { data: completedRequest } = await db
      .from("requests")
      .select("id, buyer_id, status, business_id")
      .eq("id", completedConv.request_id)
      .eq("buyer_id", userId)
      .eq("business_id", businessId)
      .eq("status", "completed")
      .maybeSingle();
    if (!completedRequest) {
      throw new ForbiddenError("Review is allowed only after a completed request session");
    }

    // Prevent duplicate reviews
    const { data: existing } = await db
      .from("reviews")
      .select("id")
      .eq("request_id", completedConv.request_id)
      .eq("reviewer_id", userId)
      .maybeSingle();

    if (existing) throw new ConflictError("You have already reviewed this completed session");

    // Insert review using the request_id from the conversation (can be null)
    const { data, error } = await db
      .from("reviews")
      .insert({
        business_id: businessId,
        reviewer_id: userId,
        request_id:  completedConv.request_id, 
        rating:      req.body.rating,
        comment:     req.body.comment ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    const { data: agg } = await db
      .from("reviews")
      .select("rating")
      .eq("business_id", businessId);
    const ratings = (agg ?? [])
      .map((r: { rating: number }) => Number(r.rating))
      .filter((n: number) => Number.isFinite(n));
    const reviewCount = ratings.length;
    const rating = reviewCount ? Number((ratings.reduce((a: number, b: number) => a + b, 0) / reviewCount).toFixed(2)) : 0;

    await db
      .from("businesses")
      .update({ rating, review_count: reviewCount, updated_at: new Date().toISOString() })
      .eq("id", businessId);

    await supabaseAdmin.from("rewards").insert({
      user_id: userId,
      action: "review_submitted",
      points: 5,
      reference_id: completedConv.request_id,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabaseAdmin.rpc("increment_points", { user_id: userId, amount: 5 } as any);

    const { data: biz } = await db
      .from("businesses")
      .select("owner_id, name")
      .eq("id", businessId)
      .maybeSingle();
    if (biz?.owner_id) {
      await createSystemNotification({
        user_id: biz.owner_id as string,
        type: "review",
        reference_id: (data as { id?: string }).id ?? null,
        title: "New review received",
        body: `Your business ${(biz.name as string) ?? ""} received a new ${req.body.rating}-star review.`,
      });
    }

    sendSuccess(res, data, 201);
  } catch (err) {
    next(err);
  }
});



export default router; // <--- MAKE SURE THIS IS HERE