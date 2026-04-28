import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import { sendSuccess } from "@/lib/response";
import { ForbiddenError, ConflictError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";   // anon client for public read

const router = Router();

const createReviewSchema = z.object({
  rating:  z.number().int().min(1).max(5),
  comment: z.string().max(1000).trim().optional(),
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

    // --- CHANGE THIS SECTION ---
    // Look in 'conversations' instead of 'requests'
    const { data: completedConv } = await db
      .from("conversations")
      .select("id, request_id")
      .eq("buyer_id", userId)
      .eq("business_id", businessId) // Matches your screenshot
      .eq("status", "completed")     // Matches your screenshot 'completed' status
      .maybeSingle();

    if (!completedConv) {
      // Updated message to reflect the new logic
      throw new ForbiddenError("You can only review a business after completing a conversation with them");
    }
    // ---------------------------

    // Prevent duplicate reviews
    const { data: existing } = await db
      .from("reviews")
      .select("id")
      .eq("business_id", businessId)
      .eq("reviewer_id", userId)
      .maybeSingle();

    if (existing) throw new ConflictError("You have already reviewed this business");

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
    sendSuccess(res, data, 201);
  } catch (err) {
    next(err);
  }
});



export default router; // <--- MAKE SURE THIS IS HERE