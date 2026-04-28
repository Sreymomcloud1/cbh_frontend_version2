import { Router } from "express";
import { MessageController } from "@/controllers/message.controller";
import { requireAuth } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import {
  sendMessageSchema,
  updateConversationStatusSchema,
} from "@/validators/message.validators";

const router = Router();
const ctrl = new MessageController();

// All message routes require authentication
router.use(requireAuth);

// GET  /api/v1/messages                    — list all conversations
router.get("/", ctrl.getConversations.bind(ctrl));

// GET  /api/v1/messages/unread             — unread message count
router.get("/unread", ctrl.getUnreadCount.bind(ctrl));

// GET  /api/v1/messages/:id                — single conversation + all messages
router.get("/:id", ctrl.getConversation.bind(ctrl));

// POST /api/v1/messages/:id                — send a message in a conversation
router.post("/:id", validate(sendMessageSchema), ctrl.sendMessage.bind(ctrl));

// PATCH /api/v1/messages/:id/status        — update conversation status
router.patch(
  "/:id/status",
  validate(updateConversationStatusSchema),
  ctrl.updateStatus.bind(ctrl)
);

export default router;
