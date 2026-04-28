import { Router } from "express";
import { isDev } from "@/config/env";
import profileRoutes  from "./profile.routes";
import businessRoutes from "./business.routes";
import requestRoutes  from "./request.routes";
import messageRoutes  from "./message.routes";
import feedbackRoutes from "./feedback.routes";
import reviewRoutes   from "./review.routes";
import uploadRoutes   from "./upload.routes";   // NEW: Supabase Storage uploads
import adminRoutes    from "./admin.routes";     // NEW: Admin management
import authRoutes     from "./auth.routes";      // NEW: Resend email, forgot password
import searchRoutes from "./search.routes";    // ADD THIS LINE
import savedBusinessRoutes from "./savedBusiness";



const router = Router();

router.use("/auth",       authRoutes);           // NEW — no auth middleware, handles its own
router.use("/profile",    profileRoutes);
router.use("/businesses", businessRoutes);
router.use("/requests",   requestRoutes);
router.use("/messages",   messageRoutes);
router.use("/feedback",   feedbackRoutes);
router.use("/reviews",    reviewRoutes);
router.use("/upload",     uploadRoutes);         // NEW
router.use("/admin",      adminRoutes);          // NEW
router.use("/search", searchRoutes);           // ADD THIS LINE
router.use("/saved-businesses", savedBusinessRoutes);

router.get("/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok", timestamp: new Date().toISOString() } });
});

if (isDev) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const debugRoutes = require("./debug.routes").default;
  router.use("/debug", debugRoutes);
  console.log("🔧 Debug routes: GET /api/v1/debug/db  GET /api/v1/debug/auth");
}

export default router;
