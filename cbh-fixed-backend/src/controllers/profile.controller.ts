import { Request, Response, NextFunction } from "express"; // ✅ Changed from 'import type'
import { ProfileService } from "@/services/profile.service";
import { sendSuccess } from "@/lib/response";

export class ProfileController {
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // req.supabase and req.user are now recognized thanks to the .d.ts fix
      const service = new ProfileService(req.supabase);
      const profile = await service.getProfile(req.user.id);
      sendSuccess(res, profile);
    } catch (err) { 
      next(err); 
    }
  }

  async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const service = new ProfileService(req.supabase);
      const profile = await service.updateProfile(req.user.id, req.body);
      sendSuccess(res, profile);
    } catch (err) { 
      next(err); 
    }
  }

  async getSavedBusinesses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const service = new ProfileService(req.supabase);
      const saved = await service.getSavedBusinesses(req.user.id);
      sendSuccess(res, saved);
    } catch (err) { 
      next(err); 
    }
  }

  async toggleSaveBusiness(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const service = new ProfileService(req.supabase);
      const result = await service.saveOrUnsaveBusiness(
        req.user.id,
        req.params.businessId as string
      );
      sendSuccess(res, result);
    } catch (err) { 
      next(err); 
    }
  }

  async getRewards(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const service = new ProfileService(req.supabase);
      const rewards = await service.getRewards(req.user.id);
      sendSuccess(res, rewards);
    } catch (err) { 
      next(err); 
    }
  }

  async getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const service = new ProfileService(req.supabase);
      const notifications = await service.getNotifications(req.user.id);
      sendSuccess(res, notifications);
    } catch (err) {
      next(err);
    }
  }

  async markNotificationRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const service = new ProfileService(req.supabase);
      const result = await service.markNotificationRead(req.user.id, req.params.id as string);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async markAllNotificationsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const service = new ProfileService(req.supabase);
      const result = await service.markAllNotificationsRead(req.user.id);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}