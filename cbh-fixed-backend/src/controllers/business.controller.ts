import type { Request, Response, NextFunction } from "express";
import { BusinessService } from "@/services/business.service";
import { sendSuccess } from "@/lib/response";
import { getPublicClient } from "@/lib/supabase";

export class BusinessController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.supabase ?? getPublicClient();
      const service = new BusinessService(db);
      const result = await service.listBusinesses(req.query as never);
      sendSuccess(res, {
  businesses: result.businesses,
  pagination: result.pagination,
}, 200);
    } catch (err) { next(err); }
  }

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.supabase ?? getPublicClient();
      const service = new BusinessService(db);
      const business = await service.getBusinessById(req.params.id as string);
      sendSuccess(res, business);
    } catch (err) { next(err); }
  }

  async getMine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const service = new BusinessService(req.supabase);
      const business = await service.getMyBusiness(req.user.id);
      sendSuccess(res, business);
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const service = new BusinessService(req.supabase);
      const business = await service.createBusiness(req.user.id, req.body);
      sendSuccess(res, business, 201);
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const service = new BusinessService(req.supabase);
      const business = await service.updateBusiness(req.params.id as string, req.user.id, req.body);
      sendSuccess(res, business);
    } catch (err) { next(err); }
  }

  async updateEcoScore(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const service = new BusinessService(req.supabase);
      const business = await service.updateEcoScore(req.params.id as string, req.user.id, req.body);
      sendSuccess(res, {
        eco_score_overall: business.eco_score_overall,
        eco_level: business.eco_level,
        eco_breakdown: business.eco_breakdown,
      });
    } catch (err) { next(err); }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const service = new BusinessService(req.supabase);
      await service.deleteBusiness(req.params.id as string, req.user.id);
      sendSuccess(res, { deleted: true });
    } catch (err) { next(err); }
  }

  async resubmitForReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const service = new BusinessService(req.supabase);
      const business = await service.resubmitForVerification(req.user.id);
      sendSuccess(res, business);
    } catch (err) { next(err); }
  }
}
