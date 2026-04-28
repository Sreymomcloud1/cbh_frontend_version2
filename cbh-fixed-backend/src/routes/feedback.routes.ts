import { Router } from "express";
import { z } from "zod";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth"; // FIX: was "authenticate" (doesn't exist)
import { sendFeedbackEmail } from "@/lib/email";
import { sendSuccess } from "@/lib/response";

const router = Router();

const feedbackSchema = z.object({
  name:    z.string().min(1).max(100).trim(),
  email:   z.string().email(),
  topic:   z.string().min(1).max(50).trim(),
  subject: z.string().max(200).trim().default(""),
  message: z.string().min(1).max(2000).trim(),
  rating:  z.number().int().min(1).max(5).optional(),
});

// POST /api/v1/feedback — requires authentication
router.post("/", requireAuth, validate(feedbackSchema), async (req, res, next) => {
  try {
    await sendFeedbackEmail(req.body);
    sendSuccess(res, { sent: true });
  } catch (err) {
    next(err);
  }
});

export default router;
