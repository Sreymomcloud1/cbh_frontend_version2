/**
 * api.ts — Typed HTTP client for the CBH backend
 * Single source of truth for all API calls.
 * Token comes from the shared Supabase session — never from localStorage.
 */

import { supabase, getAccessToken, clearTokenCache } from "@/lib/supabase";
import type {
  Supplier,
  QuoteRequest,
  Conversation,
  User,
  BusinessCategory,
  BusinessTier,
  RequestPurpose,
  RequestStatus,
  MessageStatus,
  CreateRequestPayload,
  CreateBusinessPayload,
  SendMessagePayload,
  UpdateRequestStatusPayload,
  UpdateConversationStatusPayload,
} from "@/types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const REQUEST_TIMEOUT_MS = 15000;

async function fetchWithTimeout(input: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Core request helper ──────────────────────────────────────────────────────

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Use cached token — avoids localStorage lock contention on parallel calls
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    if (typeof window !== "undefined") {
      window.location.href = "/auth/login";
    }
    throw new Error("Not authenticated");
  }

  const res = await fetchWithTimeout(`${BASE_URL}${path}`, { ...options, cache: "no-store", headers });
  const json = await res.json();

  if (!res.ok) {
    if (res.status === 401) {
      // Token was rejected — clear cache and redirect
      clearTokenCache();
      if (typeof window !== "undefined") {
        await supabase.auth.signOut();
        window.location.href = "/auth/login";
      }
    }
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 2000));
      return request<T>(path, options);
    }

    throw new Error(json?.error?.message ?? `Request failed: ${res.status}`);
  }

  return json.data as T;
}

// ─── Public request helper (no auth required) ─────────────────────────────────
// Use for public endpoints: GET /businesses, GET /businesses/:id
async function publicRequest<T>(path: string): Promise<T> {
  const res  = await fetchWithTimeout(`${BASE_URL}${path}`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `Request failed: ${res.status}`);
  return json.data as T;
}

// ─── Type transformers ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function businessToSupplier(b: any): Supplier {
  return {
    id: b.id,
    name: b.name,
    tagline: b.tagline ?? "",
    description: b.description ?? "",
    category: b.category,
    subCategories: b.sub_categories ?? [],
    tier: b.tier,
    location: b.location_city,
    locationDetail: b.location_detail ?? undefined,
    mapUrl: b.map_url ?? undefined,
    logo: b.logo_url ?? "",
    gallery: b.gallery_urls ?? [],
    ecoScore: {
      overall: b.eco_score_overall ?? 0,
      level: b.eco_level ?? "Basic",
      breakdown: b.eco_breakdown ?? {
        packaging: 0, sourcing: 0, energy: 0, waste: 0, delivery: 0, practices: 0,
      },
    },
    discountPercent: b.discount_percent ?? undefined,
    bulkSupport: b.bulk_support ?? false,
    bulkCapacity: b.bulk_capacity ?? undefined,
    verified: b.is_verified ?? false,
    tags: b.tags ?? [],
    services: b.services ?? [],
    contactEmail: b.contact_email,
    contactPhone: b.contact_phone,
    website: b.website_url ?? undefined,
    facebookUrl: b.facebook_url ?? undefined,
    telegramUrl: b.telegram_url ?? undefined,
    rating: b.rating ?? 0,
    reviewCount: b.review_count ?? 0,
    // Extra fields the dashboard needs — passed through as-is
    verificationStatus: b.verification_status ?? "pending",
    isActive:           b.is_active           ?? false,
    notifyByEmail:      b.notify_by_email      ?? true,
    notifyByPhone:      b.notify_by_phone      ?? false,
    phone:              b.contact_phone        ?? "",
    collaboration: {
      enabled: b.open_for_collaboration ?? false,
      lookingFor: b.collaboration_types ?? [],
      description: b.collaboration_description ?? undefined,
    },
    investment: {
      enabled: b.open_for_investment ?? false,
      amount: b.investment_amount ?? undefined,
      description: b.investment_description ?? undefined,
    },
    foundedYear: b.founded_year ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function requestToQuote(r: any): QuoteRequest {
  return {
    id: r.id,
    supplierId: r.business_id ?? undefined,
    supplierName: r.business?.name ?? undefined,
    buyerName: r.buyer?.name ?? undefined,
    buyerEmail: r.buyer?.email ?? undefined,
    purpose: r.purpose,
    product: r.product,
    quantity: r.quantity ?? "",
    date: r.required_date,
    location: r.location,
    notes: r.notes ?? undefined,
    status: r.status,
    createdAt: r.created_at,
    conversationId: r.conversation_id ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function apiConversationToConversation(c: any): Conversation {
  return {
    id: c.id,
    requestId: c.request?.id ?? c.request_id,
    supplierId: c.business?.id ?? c.business_id,
    supplierName: c.business?.name ?? "",
    supplierLogo: c.business?.logo_url ?? undefined,
    buyerId: c.buyer?.id ?? c.buyer_id,
    buyerName: c.buyer?.name ?? "",
    purpose: c.request?.purpose ?? "buy",
    product: c.request?.product ?? "",
    status: c.status,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: (c.messages ?? []).map((m: any) => ({
      id: m.id,
      senderId: m.sender?.id ?? m.sender_id,
      senderName: m.sender?.name ?? "",
      senderRole: "buyer" as const,
      content: m.content,
      timestamp: m.created_at,
      read: m.is_read ?? false,
    })),
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

// Kept for backward compat — no-op now
export function setAuthToken(_token: string) {}
export function clearAuthToken() {}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function getProfile(): Promise<User> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await request<any>("/profile/me");
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    phone: data.phone ?? data.phone_number ?? undefined,
    role: data.role,
    avatar: data.avatar_url ?? undefined,
    isVerified: data.is_verified,
    savedSuppliers: [],
    requests: [],
    rewardPoints: data.reward_points ?? 0,
    badges: [],
    conversations: [],
  };
}

export async function updateProfile(body: { name?: string; avatar_url?: string; phone?: string | null }) {
  return request("/profile/me", { method: "PATCH", body: JSON.stringify(body) });
}

export async function getRewards() {
  return request<{ total_points: number; history: unknown[] }>("/profile/me/rewards");
}

// ─── Businesses ───────────────────────────────────────────────────────────────

export interface ListBusinessesParams {
  search?: string;
  category?: BusinessCategory;
  tier?: BusinessTier;
  location?: string;
  min_eco_score?: number;
  bulk_support?: boolean;
  open_for_collaboration?: boolean;
  open_for_investment?: boolean;
  page?: number;
  limit?: number;
}

export async function listBusinesses(params: ListBusinessesParams = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== false) qs.set(k, String(v));
  });
  const query = qs.toString() ? `?${qs}` : "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await publicRequest<any>(`/businesses${query}`);
  return {
    suppliers: (data.businesses ?? []).map(businessToSupplier) as Supplier[],
    pagination: data.pagination,
  };
}

export async function getBusinessById(id: string): Promise<Supplier> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await publicRequest<any>(`/businesses/${id}`);
  return businessToSupplier(data);
}

export async function getMyBusiness(): Promise<Supplier | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await request<any>("/businesses/me/profile");
    return data ? businessToSupplier(data) : null;
  } catch (err) {
    if (err instanceof Error && err.message.toLowerCase().includes("not found")) return null;
    throw err;
  }
}

export async function createBusiness(body: CreateBusinessPayload): Promise<Supplier> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await request<any>("/businesses", { method: "POST", body: JSON.stringify(body) });
  return businessToSupplier(data);
}

export async function updateBusiness(id: string, body: Partial<CreateBusinessPayload>): Promise<Supplier> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await request<any>(`/businesses/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  return businessToSupplier(data);
}

export async function updateEcoScore(id: string, breakdown: {
  packaging: number; sourcing: number; energy: number;
  waste: number; delivery: number; practices: number;
}): Promise<Supplier> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await request<any>(`/businesses/${id}/eco-score`, {
    method: "PATCH",
    body: JSON.stringify({ breakdown }),
  });
  return businessToSupplier(data);
}

// ─── Requests ─────────────────────────────────────────────────────────────────

export interface ListRequestsParams {
  purpose?: RequestPurpose;
  status?: RequestStatus;
  page?: number;
  limit?: number;
}

const MAX_REQUESTS_LIMIT = 50;

function buildListRequestsQuery(params: ListRequestsParams = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined) return;
    qs.set(k, k === "limit" ? String(Math.min(Number(v), MAX_REQUESTS_LIMIT)) : String(v));
  });
  return qs.toString() ? `?${qs}` : "";
}

export async function listMyRequests(params: ListRequestsParams = {}) {
  const query = buildListRequestsQuery(params);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await request<any>(`/requests${query}`);            // ← buyer endpoint
  const rows = Array.isArray(data) ? data : (data?.requests ?? []);
  return {
    requests: rows.map(requestToQuote) as QuoteRequest[],
    pagination: Array.isArray(data) ? undefined : data?.pagination,
  };
}

export async function listBusinessRequests(
  _businessId: string,                                              // ignored — backend resolves by auth
  params: ListRequestsParams = {}
) {
  const query = buildListRequestsQuery(params);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await request<any>(`/requests/business${query}`);   // ← correct endpoint
  const rows = Array.isArray(data) ? data : (data?.requests ?? []);
  return {
    requests: rows.map(requestToQuote) as QuoteRequest[],
    pagination: Array.isArray(data) ? undefined : data?.pagination,
  };
}

export async function createRequest(body: CreateRequestPayload) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await request<any>("/requests", { method: "POST", body: JSON.stringify(body) });
  return {
    request: requestToQuote(data.request),
    conversation: data.conversation ? apiConversationToConversation(data.conversation) : null,
  };
}

export async function updateRequestStatus(id: string, body: UpdateRequestStatusPayload) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await request<any>(`/requests/${id}/status`, { method: "PATCH", body: JSON.stringify(body) });
  return requestToQuote(data);
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function listMyConversations(status?: MessageStatus) {
  const query = status ? `?status=${status}` : "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await request<any[]>(`/messages${query}`);
  return (data ?? []).map(apiConversationToConversation);
}

export async function getConversation(id: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await request<any>(`/messages/${id}`);
  return apiConversationToConversation(data);
}

export async function sendMessage(conversationId: string, body: SendMessagePayload) {
  return request(`/messages/${conversationId}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateConversationStatus(
  conversationId: string,
  body: UpdateConversationStatusPayload
) {
  return request(`/messages/${conversationId}/status`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function getUnreadCount(): Promise<number> {
  const data = await request<{ unread: number }>("/messages/unread");
  return data.unread;
}

// ─── Upload (Supabase Storage) ────────────────────────────────────────────────
 
/**
 * Upload an image file. Returns the public URL.
 * endpoint: "avatar" | "business-logo" | "business-gallery"
 */
async function _uploadFileInternal(
  endpoint: "avatar" | "business-logo" | "business-gallery",
  file: File,
  extraFields?: Record<string, string>
): Promise<{ url: string; gallery_urls?: string[] }> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated");
 
  const form = new FormData();
  form.append("file", file);
  if (extraFields) {
    Object.entries(extraFields).forEach(([k, v]) => form.append(k, v));
  }
 
  const res = await fetchWithTimeout(`${BASE_URL}/upload/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
 
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `Upload failed: ${res.status}`);
  return json.data;
}
 
export async function uploadAvatar(file: File): Promise<string> {
  const result = await _uploadFileInternal("avatar", file);
  return result.url;
}
 
export async function uploadBusinessLogo(file: File, businessId: string): Promise<string> {
  const result = await _uploadFileInternal("business-logo", file, { business_id: businessId });
  return result.url;
}
 
export async function uploadBusinessGalleryImage(file: File, businessId: string): Promise<{ url: string; gallery_urls: string[] }> {
  const result = await _uploadFileInternal("business-gallery", file, { business_id: businessId });
  return result as { url: string; gallery_urls: string[] };
}
 
/** @deprecated Use uploadBusinessLogo or uploadBusinessGalleryImage instead. */
export async function uploadFile(file: File, businessId: string): Promise<string> {
  return uploadBusinessLogo(file, businessId);
}
 

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export async function resendVerificationEmail(email: string): Promise<void> {
  const res = await fetchWithTimeout(`${BASE_URL}/auth/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, type: "signup" }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error?.message ?? "Failed to resend");
  }
}

export async function forgotPassword(email: string): Promise<void> {
  const res = await fetchWithTimeout(`${BASE_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error?.message ?? "Failed to send reset email");
  }
}

// ─── Save / unsave business ───────────────────────────────────────────────────

export async function toggleSaveBusiness(businessId: string): Promise<{ saved: boolean }> {
  return request<{ saved: boolean }>(`/profile/me/saved/${businessId}`, { method: "POST" });
}

export async function getSavedBusinesses() {
  return request<{ id: string; business: unknown }[]>("/profile/me/saved");
}

// ─── Delete own account ───────────────────────────────────────────────────────
export async function deleteAccount(): Promise<void> {
  await request<{ deleted: boolean }>("/profile/me", { method: "DELETE" });
}

// ─── Reviews ─────────────────────────────────────────────────────────────────
export async function createReview(
  businessId: string,
  body: { rating: number; comment?: string }
): Promise<void> {
  await request<{ id: string }>(`/reviews/${businessId}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
