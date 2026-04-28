import type { Request, Response, NextFunction } from "express";
import { MessageService } from "@/services/message.service";
import { sendSuccess } from "@/lib/response";

export class MessageController {
  async getConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const service = new MessageService(req.supabase);
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const conversations = await service.getMyConversations(req.user.id, status);
      sendSuccess(res, conversations);
    } catch (err) { next(err); }
  }

  async getConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const service = new MessageService(req.supabase);
      const conversation = await service.getConversation(req.params.id as string, req.user.id);
      sendSuccess(res, conversation);
    } catch (err) { next(err); }
  }

  async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const service = new MessageService(req.supabase);
      const message = await service.sendMessage(req.params.id as string, req.user.id, req.body);
      sendSuccess(res, message, 201);
    } catch (err) { next(err); }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const service = new MessageService(req.supabase);
      const conversation = await service.updateConversationStatus(
        req.params.id as string,
        req.user.id,
        req.body
      );
      sendSuccess(res, conversation);
    } catch (err) { next(err); }
  }

  async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const service = new MessageService(req.supabase);
      const count = await service.getUnreadCount(req.user.id);
      sendSuccess(res, count);
    } catch (err) { next(err); }
  }
}
