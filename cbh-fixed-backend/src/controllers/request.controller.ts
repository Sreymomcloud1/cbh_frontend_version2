import type { Request, Response, NextFunction } from "express";
import { RequestService } from "@/services/request.service";
import { sendSuccess } from "@/lib/response";
import { NotFoundError } from "@/lib/errors";

export class RequestController {
  async listMine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const service = new RequestService(req.supabase);
      const result = await service.listMyRequests(req.user.id, req.query as never);
      sendSuccess(res, {
        requests: result.requests,
        pagination: result.pagination,
      });
    } catch (err) { next(err); }
  }

  async listForBusiness(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const service = new RequestService(req.supabase);

      const { data: biz } = await req.supabase
        .from("businesses")
        .select("id")
        .eq("owner_id", req.user.id)
        .single();

      if (!biz) throw new NotFoundError("Business");

      const result = await service.listBusinessRequests(biz.id as string, req.query as never);
      sendSuccess(res, {
        requests: result.requests,
        pagination: result.pagination,
      });
    } catch (err) { next(err); }
  }

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const service = new RequestService(req.supabase);
      const request = await service.getRequest(req.params.id as string, req.user.id);
      sendSuccess(res, request);
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const service = new RequestService(req.supabase);
      const result = await service.createRequest(req.user.id, req.body);
      sendSuccess(res, result, 201);
    } catch (err) { next(err); }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const service = new RequestService(req.supabase);
      const request = await service.updateRequestStatus(req.params.id as string, req.user.id, req.body);
      sendSuccess(res, request);
    } catch (err) { next(err); }
  }
}
