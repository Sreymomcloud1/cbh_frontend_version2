import { Router } from "express";
import { z } from "zod";
import { validate } from "@/middleware/validate";
import { supabase } from "@/lib/supabase";
import { sendSuccess } from "@/lib/response";
import rateLimit from "express-rate-limit";

const router = Router();

// Stricter rate limit for auth actions — prevents abuse
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  message: {
    success: false,
    error: { message: "Too many attempts. Please try again in 15 minutes.", code: "RATE_LIMIT" },
  },
});

const resendSchema = z.object({
  email: z.string().email(),
  type:  z.enum(["signup", "email_change"]).default("signup"),
});

/**
 * POST /api/v1/auth/resend-verification
 * Resends the Supabase email verification link.
 * Rate-limited to prevent abuse.
 *
 * Frontend usage: call this when user clicks "Resend verification email"
 * on the /auth/verify page.
 */
router.post("/resend-verification", authLimiter, validate(resendSchema), async (req, res, next) => {
  try {
    const { email, type } = req.body as { email: string; type: "signup" | "email_change" };

    const { error } = await supabase.auth.resend({
      type,
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/verify`,
      },
    });

    if (error) {
      // Don't expose whether the email exists or not
      console.warn("Resend verification error (hidden from client):", error.message);
    }

    // Always return success to prevent email enumeration
    sendSuccess(res, {
      message: "If that email is registered, a verification link has been sent.",
    });
  } catch (err) {
    next(err);
  }
});

const forgotSchema = z.object({
  email: z.string().email(),
});

/**
 * POST /api/v1/auth/forgot-password
 * Sends a Supabase password reset email.
 */
router.post("/forgot-password", authLimiter, validate(forgotSchema), async (req, res, next) => {
  try {
    const { email } = req.body as { email: string };

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/reset-password`,
    });

    if (error) {
      console.warn("Password reset error (hidden from client):", error.message);
    }

    // Always return success to prevent email enumeration
    sendSuccess(res, {
      message: "If that email is registered, a password reset link has been sent.",
    });
  } catch (err) {
    next(err);
  }
});

export default router;
