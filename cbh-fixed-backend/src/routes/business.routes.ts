import { Router } from "express";
import { BusinessController } from "@/controllers/business.controller";
import { requireAuth } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import {
  createBusinessSchema,
  updateBusinessSchema,
  updateEcoScoreSchema,
  listBusinessesSchema,
} from "@/validators/business.validators";

const router = Router();
const ctrl = new BusinessController();

// ── Public routes ─────────────────────────────────────────────────────────

// GET  /api/v1/businesses
router.get("/", validate(listBusinessesSchema, "query"), ctrl.list.bind(ctrl));

// ── Authenticated routes ──────────────────────────────────────────────────

// GET  /api/v1/businesses/me/profile  — must be defined BEFORE /:id to avoid route shadowing
router.get("/me/profile", requireAuth, ctrl.getMine.bind(ctrl));

// GET  /api/v1/businesses/:id
router.get("/:id", ctrl.getOne.bind(ctrl));

// POST /api/v1/businesses
router.post("/", requireAuth, validate(createBusinessSchema), ctrl.create.bind(ctrl));

// PATCH /api/v1/businesses/:id
router.patch("/:id", requireAuth, validate(updateBusinessSchema), ctrl.update.bind(ctrl));

// PATCH /api/v1/businesses/:id/eco-score
router.patch(
  "/:id/eco-score",
  requireAuth,
  validate(updateEcoScoreSchema),
  ctrl.updateEcoScore.bind(ctrl)
);

// DELETE /api/v1/businesses/:id
router.delete("/:id", requireAuth, ctrl.remove.bind(ctrl));

export default router;
