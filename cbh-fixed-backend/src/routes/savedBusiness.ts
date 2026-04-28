import { Router } from "express";
import {
  toggleSavedBusiness,
  getSavedBusinesses
} from "../controllers/savedBusiness.controller";

import { requireAuth } from "../middleware/auth";

const router = Router();

/**
 * Toggle save/unsave business
 */
router.post("/toggle", requireAuth, toggleSavedBusiness);

/**
 * Get all saved businesses for current user
 */
router.get("/", requireAuth, getSavedBusinesses);

export default router;