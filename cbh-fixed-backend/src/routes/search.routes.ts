import { Router } from "express";
import { z } from "zod";
import { validate } from "@/middleware/validate";
import { SmartSearchService } from "@/services/smart-search.service";
import { getPublicClient } from "@/lib/supabase";
import { sendSuccess } from "@/lib/response";

const router = Router();

const smartSearchSchema = z.object({
  q: z.string().min(1).max(300).trim(),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

// POST /api/v1/search/smart
// Public — no auth required
router.post("/smart", validate(smartSearchSchema), async (req, res, next) => {
  try {
    // Use req.supabase if authenticated, otherwise public client
    const db = req.supabase ?? getPublicClient();
    const service = new SmartSearchService(db);
    const results = await service.search(req.body.q, req.body.limit);
    sendSuccess(res, results);
  } catch (err) {
    next(err);
  }
});

export default router;