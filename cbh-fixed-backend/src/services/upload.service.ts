import { supabaseAdmin } from "@/lib/supabase";
import { env } from "@/config/env";
import { BadRequestError } from "@/lib/errors";

const MAX_BYTES = (env.MAX_FILE_SIZE_MB ?? 5) * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export interface UploadResult {
  url: string;
  path: string;
  bucket: string;
}

/**
 * Upload a file buffer to Supabase Storage and return the public URL.
 *
 * @param bucket  - Storage bucket name (e.g. "avatars" or "business-assets")
 * @param folder  - Sub-folder inside bucket (e.g. "logos", "gallery", userId)
 * @param file    - The file buffer + metadata from multer or similar
 */
export async function uploadImage(
  bucket: string,
  folder: string,
  file: { buffer: Buffer; mimetype: string; originalname: string; size: number }
): Promise<UploadResult> {
  // Validate type
  if (!ALLOWED_MIME.includes(file.mimetype)) {
    throw new BadRequestError(
      `Invalid file type: ${file.mimetype}. Allowed: ${ALLOWED_MIME.join(", ")}`
    );
  }

  // Validate size
  if (file.size > MAX_BYTES) {
    throw new BadRequestError(
      `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Max: ${env.MAX_FILE_SIZE_MB ?? 5} MB`
    );
  }

  // Build a unique, sanitised path
  const ext = file.originalname.split(".").pop()?.toLowerCase() ?? "jpg";
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const path = `${folder}/${timestamp}-${random}.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data: urlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);

  return {
    url:    urlData.publicUrl,
    path,
    bucket,
  };
}

/**
 * Delete a file from Supabase Storage by its path.
 */
export async function deleteImage(bucket: string, path: string): Promise<void> {
  const { error } = await supabaseAdmin.storage.from(bucket).remove([path]);
  if (error) {
    // Non-fatal: log but don't crash
    console.warn(`Failed to delete storage object ${bucket}/${path}:`, error.message);
  }
}

/**
 * Extract the storage path from a full public URL.
 * e.g. https://xxx.supabase.co/storage/v1/object/public/business-assets/logos/abc.jpg
 *   → "logos/abc.jpg"
 */
export function pathFromUrl(publicUrl: string, bucket: string): string | null {
  try {
    const marker = `/object/public/${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return publicUrl.slice(idx + marker.length);
  } catch {
    return null;
  }
}
