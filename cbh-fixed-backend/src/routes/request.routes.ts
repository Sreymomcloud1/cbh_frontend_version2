import { Router } from "express";
import { RequestController } from "@/controllers/request.controller";
import { requireAuth } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import {
  createRequestSchema,
  updateRequestStatusSchema,
  listRequestsSchema,
} from "@/validators/request.validators";

const router = Router();
const ctrl = new RequestController();

// All request routes require authentication
router.use(requireAuth);

// GET  /api/v1/requests              — buyer: my requests
router.get("/", validate(listRequestsSchema, "query"), ctrl.listMine.bind(ctrl));

// GET  /api/v1/requests/business     — business: incoming requests
router.get("/business", validate(listRequestsSchema, "query"), ctrl.listForBusiness.bind(ctrl));

// GET  /api/v1/requests/:id
router.get("/:id", ctrl.getOne.bind(ctrl));

// POST /api/v1/requests
router.post("/", validate(createRequestSchema), ctrl.create.bind(ctrl));

// PATCH /api/v1/requests/:id/status
router.patch(
  "/:id/status",
  validate(updateRequestStatusSchema),
  ctrl.updateStatus.bind(ctrl)
);

export default router;
