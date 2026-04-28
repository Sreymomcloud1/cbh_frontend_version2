import { Router } from "express";
import multer from "multer";
import { requireAuth } from "@/middleware/auth";
import { uploadImage } from "@/services/upload.service";
import { sendSuccess } from "@/lib/response";
import { env } from "@/config/env";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: (env.MAX_FILE_SIZE_MB ?? 5) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error("Only JPEG, PNG, WEBP, and GIF images are allowed"));
    } else {
      cb(null, true);
    }
  },
});

/**
 * POST /api/v1/upload/avatar
 */
router.post("/avatar", requireAuth, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: { message: "No file provided" } });
      return;
    }

    const result = await uploadImage(
      env.AVATAR_BUCKET ?? "avatars",
      req.user.id,
      req.file
    );

    await req.supabase
      .from("profiles")
      .update({ avatar_url: result.url, updated_at: new Date().toISOString() })
      .eq("id", req.user.id);

    sendSuccess(res, { url: result.url }, 201);
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/upload/business-logo
 */
router.post("/business-logo", requireAuth, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: { message: "No file provided" } });
      return;
    }

    const { business_id } = req.body as { business_id?: string };
    if (!business_id) {
      res.status(400).json({ success: false, error: { message: "business_id is required" } });
      return;
    }

    const { data: biz, error: bizErr } = await req.supabase
      .from("businesses")
      .select("id, owner_id")
      .eq("id", business_id)
      .eq("owner_id", req.user.id)
      .maybeSingle();

    if (bizErr) throw bizErr;
    if (!biz) {
      res.status(403).json({ success: false, error: { message: "Business not found or access denied" } });
      return;
    }

    const result = await uploadImage(
      env.SUPABASE_STORAGE_BUCKET ?? "business-assets",
      `logos/${req.user.id}`,
      req.file
    );

    await req.supabase
      .from("businesses")
      .update({ logo_url: result.url, updated_at: new Date().toISOString() })
      .eq("id", business_id);

    sendSuccess(res, { url: result.url }, 201);
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/upload/business-gallery
 */
router.post("/business-gallery", requireAuth, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: { message: "No file provided" } });
      return;
    }

    const { business_id } = req.body as { business_id?: string };
    if (!business_id) {
      res.status(400).json({ success: false, error: { message: "business_id is required" } });
      return;
    }

    const { data: biz, error: bizErr } = await req.supabase
      .from("businesses")
      .select("id, owner_id, gallery_urls")
      .eq("id", business_id)
      .eq("owner_id", req.user.id)
      .maybeSingle();

    if (bizErr) throw bizErr;
    if (!biz) {
      res.status(403).json({ success: false, error: { message: "Business not found or access denied" } });
      return;
    }

    const result = await uploadImage(
      env.SUPABASE_STORAGE_BUCKET ?? "business-assets",
      `gallery/${req.user.id}`,
      req.file
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingGallery: string[] = (biz as any).gallery_urls ?? [];
    const updatedGallery = [...existingGallery, result.url];

    await req.supabase
      .from("businesses")
      .update({ gallery_urls: updatedGallery, updated_at: new Date().toISOString() })
      .eq("id", business_id);

    sendSuccess(res, { url: result.url, gallery_urls: updatedGallery }, 201);
  } catch (err) { next(err); }
});

export default router;
