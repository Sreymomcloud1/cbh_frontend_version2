import { Router } from "express";
import { ProfileController } from "@/controllers/profile.controller";
import { requireAuth } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import { updateProfileSchema } from "@/validators/profile.validators";
import { supabaseAdmin } from "@/lib/supabase";


const router = Router();
const ctrl = new ProfileController();

// All profile routes require authentication
router.use(requireAuth);

// GET  /api/v1/profile/me
router.get("/me", ctrl.getMe.bind(ctrl));

// PATCH /api/v1/profile/me
router.patch("/me", validate(updateProfileSchema), ctrl.updateMe.bind(ctrl));

// GET  /api/v1/profile/me/saved
router.get("/me/saved", ctrl.getSavedBusinesses.bind(ctrl));

// POST /api/v1/profile/me/saved/:businessId  (toggle)
router.post("/me/saved/:businessId", ctrl.toggleSaveBusiness.bind(ctrl));

// GET  /api/v1/profile/me/rewards
router.get("/me/rewards", ctrl.getRewards.bind(ctrl));

// GET /api/v1/profile/me/notifications
router.get("/me/notifications", ctrl.getNotifications.bind(ctrl));

// PATCH /api/v1/profile/me/notifications/:id/read
router.patch("/me/notifications/:id/read", ctrl.markNotificationRead.bind(ctrl));

// PATCH /api/v1/profile/me/notifications/read-all
router.patch("/me/notifications/read-all", ctrl.markAllNotificationsRead.bind(ctrl));

// DELETE /api/v1/profile/me — delete own account
router.delete("/me", async (req, res, next) => {
  try {
    // Delete the auth user (cascades to profile via FK)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(req.user.id);
    if (error) throw error;
    res.status(200).json({
  success: true,
  data: { deleted: true }
});
  } catch (err) { next(err); }
});

export default router;
