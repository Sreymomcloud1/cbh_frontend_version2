import { z } from "zod";

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000).trim(),
});

export const updateConversationStatusSchema = z.object({
  status: z.enum(["replied", "in-progress", "completed"]),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type UpdateConversationStatusInput = z.infer<typeof updateConversationStatusSchema>;
