"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck, Search, LogOut, Home, Users, Building2,
  BarChart3, CheckCircle, XCircle, Clock, RefreshCw,
  ChevronDown, ChevronUp, AlertCircle, Loader2, Eye,
  RotateCcw, X, Mail, Phone, Globe, Facebook, Send,
  FileText, Star, Leaf, MapPin, Camera,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getAccessToken } from "@/lib/supabase";
import { refreshAccessToken } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { notifyBusinessDataChanged, onBusinessDataChanged } from "@/lib/data-events";
import { logoutAndRefresh } from "@/lib/logout";
import { BusinessMedia } from "@/components/ui/BusinessMedia";
//import { Users, Clock } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

// ── Types ────────────────────────────────────────────────────────────────────

type VerificationStatus = "pending" | "verified" | "rejected" | "revoked";

interface AuditEntry {
  id: string;
  admin_email: string;
  action: string;
  reason: string | null;
  created_at: string;
}

interface BusinessFull {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  tier: string;
  location_city: string;
  location_detail: string;
  logo_url: string | null;
  gallery_urls: string[];
  contact_email: string;
  contact_phone: string;
  website_url: string | null;
  facebook_url: string | null;
  telegram_url: string | null;
  eco_score_overall: number;
  is_verified: boolean;
  is_active: boolean;
  verification_status: VerificationStatus;
  rejection_reason: string | null;
  verified_at: string | null;
  rejected_at: string | null;
  created_at: string;
  services: string[];
  tags: string[];
  rating: number;
  review_count: number;
  open_for_collaboration: boolean;
  open_for_investment: boolean;
  owner: { id: string; name: string; email: string; phone?: string; created_at: string } | null;
  audit_log?: AuditEntry[];
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  is_verified: boolean;
  pending_business: boolean;
  reward_points: number;
  created_at: string;
}

interface Stats {
  total_users: number;
  total_businesses: number;
  total_requests: number;
  total_messages: number;
  pending_verification: number;
}

type AdminTab = "overview" | "businesses" | "users";

// ── API helper ───────────────────────────────────────────────────────────────

async function adminFetch(path: string, options: RequestInit = {}) {
  let token = await getAccessToken();
  if (!token) {
    if (typeof window !== "undefined") window.location.href = "/auth/login";
    return { success: false, error: { message: "Not authenticated" } };
  }

  const doFetch = async (accessToken: string) =>
    fetch(`${API}${path}`, {
      ...options,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(options.headers ?? {}),
      },
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      await supabase.auth.signOut();
      if (typeof window !== "undefined") window.location.href = "/auth/login";
      return { success: false, error: { message: "Session expired. Please log in again." } };
    }
    token = refreshed;
    res = await doFetch(token);
    if (res.status === 401) {
      await supabase.auth.signOut();
      if (typeof window !== "undefined") window.location.href = "/auth/login";
      return { success: false, error: { message: "Session expired. Please log in again." } };
    }
  }

  return res.json();
}

const MAX_ADMIN_GALLERY = 8;

/** Multipart uploads (omit Content-Type so the browser sets the boundary). */
async function adminFetchMultipart(path: string, formData: FormData): Promise<{ success: boolean; data?: { url: string }; error?: { message?: string } }> {
  let token = await getAccessToken();
  if (!token) {
    if (typeof window !== "undefined") window.location.href = "/auth/login";
    return { success: false, error: { message: "Not authenticated" } };
  }

  const doFetch = async (accessToken: string) =>
    fetch(`${API}${path}`, {
      method: "POST",
      body: formData,
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      await supabase.auth.signOut();
      if (typeof window !== "undefined") window.location.href = "/auth/login";
      return { success: false, error: { message: "Session expired. Please log in again." } };
    }
    token = refreshed;
    res = await doFetch(token);
    if (res.status === 401) {
      await supabase.auth.signOut();
      if (typeof window !== "undefined") window.location.href = "/auth/login";
      return { success: false, error: { message: "Session expired. Please log in again." } };
    }
  }

  return res.json();
}

// ── Small UI pieces ───────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color, urgent }: {
  icon: React.ElementType; label: string; value: number; color: string; urgent?: boolean;
}) {
  return (
    <div className={cn("rounded-2xl border p-5", urgent && value > 0 ? "border-amber-700 bg-amber-950/30" : "border-stone-700 bg-stone-800")}>
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", color)}>
        <Icon size={18} />
      </div>
      <p className={cn("text-2xl font-bold mb-0.5", urgent && value > 0 ? "text-amber-300" : "text-white")}>{value}</p>
      <p className="text-xs text-stone-400">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: VerificationStatus }) {
  const map: Record<VerificationStatus, { label: string; cls: string }> = {
    pending:  { label: "Pending",  cls: "bg-amber-950 text-amber-400 border-amber-800" },
    verified: { label: "Verified", cls: "bg-green-950 text-green-400 border-green-800" },
    rejected: { label: "Rejected", cls: "bg-red-950 text-red-400 border-red-800" },
    revoked:  { label: "Revoked",  cls: "bg-stone-800 text-stone-400 border-stone-700" },
  };
  const { label, cls } = map[status] ?? map.pending;
  return (
    <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-semibold", cls)}>{label}</span>
  );
}

// ── Business detail modal ─────────────────────────────────────────────────────

function BusinessModal({
  biz, onClose, onAction,
}: {
  biz: BusinessFull;
  onClose: () => void;
  onAction: (id: string, action: "verify" | "reject" | "revoke", reason?: string) => Promise<boolean>;
}) {
  const [actionLoading, setActionLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmAction, setConfirmAction] = useState<"reject" | "revoke" | null>(null);
  const [activeImg, setActiveImg] = useState(0);

  const doAction = async (action: "verify" | "reject" | "revoke") => {
    if ((action === "reject" || action === "revoke") && !reason.trim()) return;
    setActionLoading(true);
    try {
      const ok = await onAction(biz.id, action, reason.trim() || undefined);
      if (ok) onClose();
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8">
      <div className="bg-stone-900 border border-stone-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-800">
          <div>
            <h2 className="font-semibold text-white text-lg">{biz.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={biz.verification_status} />
              <span className="text-xs text-stone-400">{biz.category} · {biz.tier}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Gallery */}
          {(biz.gallery_urls?.length > 0 || biz.logo_url) && (
            <div className="space-y-2">
              <div className="rounded-xl overflow-hidden h-52 bg-stone-800">
                <BusinessMedia
                  fit="cover"
                  src={biz.gallery_urls?.[activeImg] ?? biz.logo_url}
                  alt={biz.name}
                  name={biz.name}
                  className="h-full w-full"
                  placeholderTone="dark"
                />
              </div>
              {biz.gallery_urls?.length > 1 && (
                <div className="flex gap-2">
                  {biz.gallery_urls.map((url, i) => (
                    <button key={i} onClick={() => setActiveImg(i)}
                      className={cn("w-14 h-14 rounded-lg overflow-hidden border-2 transition-all",
                        activeImg === i ? "border-brand-500" : "border-stone-700 opacity-60 hover:opacity-100")}>
                      <BusinessMedia fit="avatar" src={url} alt="" name={biz.name} className="h-full w-full" placeholderTone="dark" avatarTextClassName="text-xs" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 text-sm">
              <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Business Details</h3>
              <InfoRow icon={MapPin}   label="Location"    value={`${biz.location_detail || biz.location_city}`} />
              <InfoRow icon={Mail}     label="Email"       value={biz.contact_email} />
              <InfoRow icon={Phone}    label="Phone"       value={biz.contact_phone} />
              {biz.website_url  && <InfoRow icon={Globe}    label="Website"  value={biz.website_url} link />}
              {biz.facebook_url && <InfoRow icon={Facebook} label="Facebook" value={biz.facebook_url} link />}
              {biz.telegram_url && <InfoRow icon={Send}     label="Telegram" value={biz.telegram_url} link />}
            </div>
            <div className="space-y-2 text-sm">
              <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Owner</h3>
              {biz.owner ? (
                <>
                  <InfoRow icon={Users} label="Name"  value={biz.owner.name} />
                  <InfoRow icon={Mail}  label="Email" value={biz.owner.email} />
                  {biz.owner.phone && <InfoRow icon={Phone} label="Phone" value={biz.owner.phone} />}
                  <InfoRow icon={Clock} label="Joined" value={new Date(biz.owner.created_at).toLocaleDateString()} />
                </>
              ) : <p className="text-stone-500 text-xs">No owner data</p>}
            </div>
          </div>

          {/* Description */}
          {biz.description && (
            <div>
              <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Description</h3>
              <p className="text-stone-300 text-sm leading-relaxed">{biz.description}</p>
            </div>
          )}

          {/* Services + Tags */}
          {biz.services?.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Services</h3>
              <div className="flex flex-wrap gap-1.5">
                {biz.services.map(s => (
                  <span key={s} className="text-xs px-2 py-0.5 bg-stone-800 text-stone-300 border border-stone-700 rounded-full">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-stone-800 rounded-xl p-3 text-center">
              <Leaf size={14} className="text-brand-400 mx-auto mb-1" />
              <p className="text-white font-bold">{biz.eco_score_overall}</p>
              <p className="text-stone-400 text-[10px]">Eco Score</p>
            </div>
            <div className="bg-stone-800 rounded-xl p-3 text-center">
              <Star size={14} className="text-amber-400 mx-auto mb-1" />
              <p className="text-white font-bold">{biz.rating?.toFixed(1) ?? "—"}</p>
              <p className="text-stone-400 text-[10px]">{biz.review_count} reviews</p>
            </div>
            <div className="bg-stone-800 rounded-xl p-3 text-center">
              <FileText size={14} className="text-purple-400 mx-auto mb-1" />
              <p className="text-white font-bold">{biz.open_for_collaboration ? "Yes" : "No"}</p>
              <p className="text-stone-400 text-[10px]">Collaboration</p>
            </div>
          </div>

          {/* Rejection reason if exists */}
          {biz.rejection_reason && (
            <div className="bg-red-950/40 border border-red-900 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-red-400 mb-1">Rejection reason</p>
              <p className="text-sm text-red-300">{biz.rejection_reason}</p>
            </div>
          )}

          {/* Audit log */}
          {biz.audit_log && biz.audit_log.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">History</h3>
              <div className="space-y-1">
                {biz.audit_log.map(entry => (
                  <div key={entry.id} className="flex items-start gap-3 text-xs bg-stone-800 rounded-lg px-3 py-2">
                    <span className={cn("font-semibold capitalize shrink-0",
                      entry.action === "verified" ? "text-green-400" :
                      entry.action === "rejected" ? "text-red-400" :
                      entry.action === "revoked"  ? "text-stone-400" : "text-blue-400"
                    )}>{entry.action}</span>
                    <span className="text-stone-400">by {entry.admin_email}</span>
                    {entry.reason && <span className="text-stone-500 italic">&quot;{entry.reason}&quot;</span>}
                    <span className="ml-auto text-stone-600 shrink-0">{new Date(entry.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="border-t border-stone-800 pt-4">
            {confirmAction ? (
              <div className="space-y-3">
                <p className="text-sm text-stone-300">
                  {confirmAction === "reject"
                    ? "Provide a rejection reason (required). It will be saved and visible to the business in their Messages tab."
                    : "Provide a reason for revoking verification (required). It will be saved and visible to the business in their Messages tab."}
                </p>
                <label className="block text-xs font-semibold text-stone-400">
                  {confirmAction === "reject" ? "Rejection reason" : "Revocation reason"} <span className="text-red-400">*</span>
                </label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4}
                  placeholder="e.g. Incomplete information, documents did not match registration, policy violation…"
                  className="w-full rounded-xl border border-stone-700 bg-stone-800 px-3 py-2.5 text-sm text-white outline-none focus:border-red-500 placeholder:text-stone-600" />
                <div className="flex gap-2">
                  <button onClick={() => setConfirmAction(null)}
                    className="flex-1 py-2 rounded-xl border border-stone-700 text-stone-300 text-sm hover:bg-stone-800 transition-colors">
                    Cancel
                  </button>
                  <button onClick={() => doAction(confirmAction)}
                    disabled={!reason.trim() || actionLoading}
                    className="flex-1 py-2 rounded-xl bg-red-900 hover:bg-red-800 text-red-300 text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {actionLoading && <Loader2 size={13} className="animate-spin" />}
                    Confirm {confirmAction}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {(biz.verification_status === "pending" || biz.verification_status === "rejected" || biz.verification_status === "revoked") && (
                  <p className="text-xs text-stone-500">
                    Approving publishes the listing on Explore. Reject or revoke requires a reason; the owner is notified in-app (Messages tab).
                  </p>
                )}
              <div className="flex flex-wrap gap-2">
                {biz.verification_status !== "verified" && (
                  <button onClick={() => doAction("verify")} disabled={actionLoading}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-900 hover:bg-green-800 text-green-300 text-sm font-medium rounded-xl transition-colors disabled:opacity-50">
                    {actionLoading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                    Verify & Publish
                  </button>
                )}
                {biz.verification_status === "pending" && (
                  <button onClick={() => { setConfirmAction("reject"); setReason(""); }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-red-950 hover:bg-red-900 text-red-400 text-sm font-medium rounded-xl transition-colors">
                    <XCircle size={13} /> Reject
                  </button>
                )}
                {biz.verification_status === "verified" && (
                  <button onClick={() => { setConfirmAction("revoke"); setReason(""); }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm font-medium rounded-xl transition-colors">
                    <RotateCcw size={13} /> Revoke Verification
                  </button>
                )}
                {(biz.verification_status === "rejected" || biz.verification_status === "revoked") && (
                  <button onClick={() => doAction("verify")} disabled={actionLoading}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-900 hover:bg-green-800 text-green-300 text-sm font-medium rounded-xl transition-colors disabled:opacity-50">
                    {actionLoading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                    Re-verify
                  </button>
                )}
              </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, link }: { icon: React.ElementType; label: string; value: string; link?: boolean }) {
  return (
    <div className="flex items-start gap-2 text-stone-300">
      <Icon size={13} className="text-stone-500 mt-0.5 shrink-0" />
      <span className="text-stone-500 text-xs shrink-0 w-14">{label}</span>
      {link
        ? <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-400 hover:underline truncate">{value}</a>
        : <span className="text-xs truncate">{value}</span>
      }
    </div>
  );
}

// ── Main admin page ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const [tab,           setTab]           = useState<AdminTab>("overview");
  const [adminName,     setAdminName]     = useState("Admin");
  const [adminEmail,    setAdminEmail]    = useState("");
  const [stats,         setStats]         = useState<Stats | null>(null);
  const [businesses,    setBusinesses]    = useState<BusinessFull[]>([]);
  const [users,         setUsers]         = useState<UserProfile[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [actionId,      setActionId]      = useState<string | null>(null);
  const [search,        setSearch]        = useState("");
  const [bizFilter,     setBizFilter]     = useState<string>("all");
  const [expandedId,    setExpandedId]    = useState<string | null>(null);
  const [selectedBiz,   setSelectedBiz]   = useState<BusinessFull | null>(null);
  const [toast,         setToast]         = useState<{ msg: string; ok: boolean } | null>(null);

  // 🔽 ADD HERE (below existing useState)
  const [showAddBiz, setShowAddBiz] = useState(false);

  const [addBizForm, setAddBizForm] = useState({
    name: "",
    tagline: "",
    description: "",
    category: "",
    tier: "SME",
    sub_categories: "",
    location_city: "",
    location_detail: "",
    map_url: "",
    eco_description: "",
    discount_percent: "",
    bulk_support: false,
    bulk_capacity: "",
    tags: "",
    services: "",
    contact_email: "",
    contact_phone: "",
    tax_id: "",
    facebook_url: "",
    telegram_url: "",
    website_url: "",
    open_for_collaboration: false,
    collaboration_types: "",
    collaboration_description: "",
    open_for_investment: false,
    investment_amount: "",
    investment_description: "",
    founded_year: "",
    notify_by_email: true,
    notify_by_phone: false,
  });

  const [addBizSaving, setAddBizSaving] = useState(false);
  const [addBizLogoFile, setAddBizLogoFile] = useState<File | null>(null);
  const [addBizLogoPreview, setAddBizLogoPreview] = useState("");
  const [addBizGalleryFiles, setAddBizGalleryFiles] = useState<File[]>([]);
  const [addBizGalleryPreviews, setAddBizGalleryPreviews] = useState<string[]>([]);
  const addBizLogoInputRef = useRef<HTMLInputElement>(null);
  const addBizGalleryInputRef = useRef<HTMLInputElement>(null);

  const resetAddBizUploadFields = useCallback(() => {
    setAddBizLogoPreview(prev => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return "";
    });
    setAddBizGalleryPreviews(prev => {
      prev.forEach(u => {
        if (u.startsWith("blob:")) URL.revokeObjectURL(u);
      });
      return [];
    });
    setAddBizLogoFile(null);
    setAddBizGalleryFiles([]);
    if (addBizLogoInputRef.current) addBizLogoInputRef.current.value = "";
    if (addBizGalleryInputRef.current) addBizGalleryInputRef.current.value = "";
  }, []);

  const closeAddBizModal = useCallback(() => {
    resetAddBizUploadFields();
    setShowAddBiz(false);
  }, [resetAddBizUploadFields]);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const toArray = (value: string) =>
    value
      .split(",")
      .map(v => v.trim())
      .filter(Boolean);

  const handleAddBizLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAddBizLogoPreview(prev => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setAddBizLogoFile(file);
  };

  const clearAddBizLogo = () => {
    setAddBizLogoPreview(prev => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return "";
    });
    setAddBizLogoFile(null);
    if (addBizLogoInputRef.current) addBizLogoInputRef.current.value = "";
  };

  const handleAddBizGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_ADMIN_GALLERY);
    e.target.value = "";
    if (!files.length) return;
    setAddBizGalleryPreviews(prev => {
      prev.forEach(u => {
        if (u.startsWith("blob:")) URL.revokeObjectURL(u);
      });
      return files.map(f => URL.createObjectURL(f));
    });
    setAddBizGalleryFiles(files);
  };

  const removeAddBizGalleryAt = (index: number) => {
    setAddBizGalleryPreviews(prev => {
      const url = prev[index];
      if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
    setAddBizGalleryFiles(prev => prev.filter((_, i) => i !== index));
  };


  // Guard: admin only
  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("role, name, email").eq("id", session.user.id).single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = profile as any;
      if (!p || p.role !== "admin") { router.push("/"); return; }
      setAdminName(p.name ?? "Admin");
      setAdminEmail(p.email ?? "");
    };
    check();
  }, [router]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [statsRes, bizRes, usersRes] = await Promise.all([
      adminFetch("/admin/stats"),
      adminFetch(`/admin/businesses?status=${bizFilter}${search ? `&search=${encodeURIComponent(search)}` : ""}`),
      adminFetch(`/admin/users${search ? `?search=${encodeURIComponent(search)}` : ""}`),
    ]);
    if (statsRes.success)  setStats(statsRes.data);
    if (bizRes.success)    setBusinesses(Array.isArray(bizRes.data) ? bizRes.data : []);
    if (usersRes.success)  setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
    setLoading(false);
  }, [bizFilter, search]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    const unsubscribe = onBusinessDataChanged(loadAll);
    const onFocus = () => loadAll();
    window.addEventListener("focus", onFocus);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, [loadAll]);

  // Open business detail modal (fetches full data)
  const openDetail = async (id: string) => {
    const res = await adminFetch(`/admin/businesses/${id}`);
    if (res.success) setSelectedBiz(res.data);
  };

  // Verification action
  const handleVerifyAction = async (id: string, action: "verify" | "reject" | "revoke", reason?: string): Promise<boolean> => {
    setActionId(id);
    try {
      const res = await adminFetch(`/admin/businesses/${id}/verify`, {
        method: "POST",
        body: JSON.stringify({ action, reason }),
      });
      if (res.success) {
        notifyBusinessDataChanged({
          id,
          action: action === "verify" ? "verified" : action === "revoke" ? "revoked" : "updated",
        });
        setSelectedBiz(null);
        setTab("businesses");
        router.replace("/admin");
        showToast(
          action === "verify" ? "Business verified and published ✓" :
          action === "reject" ? "Business rejected." : "Verification revoked.",
          action === "verify",
        );
        loadAll();
        return true;
      }
      showToast(res.error?.message ?? "Action failed", false);
      return false;
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Action failed", false);
      return false;
    } finally {
      setActionId(null);
    }
  };

  const handleAddBusiness = async () => {
    if (!addBizForm.name || !addBizForm.category || !addBizForm.contact_email || !addBizForm.contact_phone || !addBizForm.location_city) {
      showToast("Name, category, city, email and phone are required.", false);
      return;
    }
    const fb = addBizForm.facebook_url.trim();
    if (!fb) {
      showToast("Facebook Page URL is required.", false);
      return;
    }
    try {
      void new URL(fb.startsWith("http") ? fb : `https://${fb}`);
    } catch {
      showToast("Enter a valid Facebook Page URL (including https://).", false);
      return;
    }

    setAddBizSaving(true);
    let logoPublicUrl: string | undefined;
    const galleryPublicUrls: string[] = [];

    try {
      if (addBizLogoFile) {
        const fd = new FormData();
        fd.append("file", addBizLogoFile);
        const logoRes = await adminFetchMultipart("/admin/uploads/business-logo", fd);
        if (!logoRes.success) {
          showToast(logoRes.error?.message ?? "Logo upload failed.", false);
          return;
        }
        logoPublicUrl = logoRes.data?.url;
      }

      for (const file of addBizGalleryFiles) {
        const fd = new FormData();
        fd.append("file", file);
        const gRes = await adminFetchMultipart("/admin/uploads/business-gallery", fd);
        if (!gRes.success) {
          showToast(gRes.error?.message ?? "Photo upload failed.", false);
          return;
        }
        if (gRes.data?.url) galleryPublicUrls.push(gRes.data.url);
      }

      const payload = {
        name: addBizForm.name.trim(),
        tagline: addBizForm.tagline.trim() || undefined,
        description: addBizForm.description.trim() || undefined,
        category: addBizForm.category,
        tier: addBizForm.tier,
        sub_categories: toArray(addBizForm.sub_categories),
        location_city: addBizForm.location_city.trim(),
        location_detail: addBizForm.location_detail.trim() || undefined,
        map_url: addBizForm.map_url.trim() || undefined,
        logo_url: logoPublicUrl,
        gallery_urls: galleryPublicUrls,
        eco_description: addBizForm.eco_description.trim() || undefined,
        discount_percent: addBizForm.discount_percent ? Number(addBizForm.discount_percent) : undefined,
        bulk_support: addBizForm.bulk_support,
        bulk_capacity: addBizForm.bulk_capacity.trim() || undefined,
        tags: toArray(addBizForm.tags),
        services: toArray(addBizForm.services),
        contact_email: addBizForm.contact_email.trim(),
        contact_phone: addBizForm.contact_phone.trim(),
        tax_id: addBizForm.tax_id.trim() || undefined,
        facebook_url: addBizForm.facebook_url.trim(),
        telegram_url: addBizForm.telegram_url.trim() || undefined,
        website_url: addBizForm.website_url.trim() || undefined,
        open_for_collaboration: addBizForm.open_for_collaboration,
        collaboration_types: toArray(addBizForm.collaboration_types),
        collaboration_description: addBizForm.collaboration_description.trim() || undefined,
        open_for_investment: addBizForm.open_for_investment,
        investment_amount: addBizForm.investment_amount.trim() || undefined,
        investment_description: addBizForm.investment_description.trim() || undefined,
        founded_year: addBizForm.founded_year ? Number(addBizForm.founded_year) : undefined,
        notify_by_email: addBizForm.notify_by_email,
        notify_by_phone: addBizForm.notify_by_phone,
      };

      const res = await adminFetch("/admin/businesses/create", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.success) {
        notifyBusinessDataChanged({ id: res.data?.id, action: "created" });
        setTab("businesses");
        router.replace("/admin");
        const emailed = Boolean(res.data?.ownerCredentialsEmailed);
        const emailErr = res.data?.ownerCredentialsEmailError as string | undefined;
        const contact = payload.contact_email;
        if (emailErr) {
          showToast(
            `Business added (pending verification), but login email failed: ${emailErr}. The owner can use “Forgot password” for ${contact}.`,
            false,
          );
        } else if (emailed) {
          showToast(`Business added — pending verification. Login details were sent to ${contact}.`, true);
        } else {
          showToast("Business added — pending verification.", true);
        }
        setShowAddBiz(false);
        resetAddBizUploadFields();
        setAddBizForm({
          name: "", tagline: "", description: "", category: "", tier: "SME", sub_categories: "",
          location_city: "", location_detail: "", map_url: "",
          eco_description: "", discount_percent: "", bulk_support: false, bulk_capacity: "", tags: "", services: "",
          contact_email: "", contact_phone: "", tax_id: "", facebook_url: "", telegram_url: "", website_url: "",
          open_for_collaboration: false, collaboration_types: "", collaboration_description: "",
          open_for_investment: false, investment_amount: "", investment_description: "", founded_year: "",
          notify_by_email: true, notify_by_phone: false,
        });
        loadAll();
      } else {
        showToast(res.error?.message ?? "Failed to add business.", false);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Something went wrong.", false);
    } finally {
      setAddBizSaving(false);
    }
  };

  const updateUserRole = async (userId: string, role: string) => {
    setActionId(userId);
    const res = await adminFetch(`/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
    setActionId(null);
    if (res.success) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
      showToast(`Role updated to ${role}`, true);
    } else {
      showToast(res.error?.message ?? "Failed", false);
    }
  };

  const handleLogout = async () => {
    await logoutAndRefresh("/");
  };

  const pendingBiz   = businesses.filter(b => b.verification_status === "pending");
  const filteredBiz  = businesses;
  const filteredUsers = users.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  const navItems: { id: AdminTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: "overview",   label: "Overview",   icon: BarChart3   },
    { id: "businesses", label: "Businesses", icon: Building2,  badge: stats?.pending_verification },
    { id: "users",      label: "Users",      icon: Users },
  ];

 
  return (
    <div className="flex min-h-screen bg-stone-950 text-white">

      {/* ── Sidebar ── */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-stone-800 bg-stone-900">
        <div className="flex items-center gap-2.5 border-b border-stone-800 px-5 py-4">
          <ShieldCheck size={18} className="text-brand-400" />
          <span className="font-semibold text-sm">CBH Admin</span>
        </div>
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium w-full text-left transition-colors",
                tab === item.id ? "bg-brand-600 text-white" : "text-stone-400 hover:bg-stone-800 hover:text-stone-200"
              )}>
              <item.icon size={15} />{item.label}
              {item.badge ? (
                <span className="ml-auto w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {item.badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="border-t border-stone-800 p-3 space-y-1">
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-semibold text-stone-200 truncate">{adminName}</p>
            <p className="text-[11px] text-stone-500 truncate">{adminEmail}</p>
          </div>
          <button onClick={() => router.push("/")}
            className="flex items-center gap-2 w-full rounded-xl px-3 py-2 text-sm text-stone-400 hover:bg-stone-800 hover:text-stone-200 transition-colors">
            <Home size={14} /> Back to site
          </button>
          <button onClick={handleLogout}
            className="flex items-center gap-2 w-full rounded-xl px-3 py-2 text-sm text-stone-400 hover:bg-red-950 hover:text-red-400 transition-colors">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto">
        {/* Mobile header */}
        <div className="lg:hidden border-b border-stone-800 bg-stone-900 px-4 py-3 flex items-center justify-between">
          <div className="flex gap-2">
            {navItems.map(item => (
              <button key={item.id} onClick={() => setTab(item.id)}
                className={cn("px-3 py-1.5 rounded-xl text-xs font-medium transition-colors relative",
                  tab === item.id ? "bg-brand-600 text-white" : "text-stone-400")}>
                {item.label}
                {item.badge ? <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[8px] flex items-center justify-center">{item.badge}</span> : null}
              </button>
            ))}
          </div>
          <button onClick={handleLogout} className="text-stone-400 hover:text-red-400"><LogOut size={16} /></button>
        </div>

        <div className="p-5 lg:p-8 max-w-7xl mx-auto">

          {/* Header row */}
          <div className="flex items-center justify-between mb-6">
  <h1 className="text-xl font-bold">
    {tab === "overview"   && "Platform Overview"}
    {tab === "businesses" && "Business Verification"}
    {tab === "users"      && "User Management"}
  </h1>

  {/* RIGHT SIDE ACTIONS */}
  <div className="flex items-center gap-2">
    
    {/* ✅ Add Business button (ONLY for businesses tab) */}
    {tab === "businesses" && (
      <button
        onClick={() => setShowAddBiz(true)}
        className="flex items-center gap-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg transition-colors"
      >
        + Add Business
      </button>
    )}

    {/* Existing Refresh button */}
    <button
      onClick={loadAll}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-white transition-colors disabled:opacity-50"
    >
      <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
      Refresh
    </button>

  </div>
</div>

          {loading ? (
            <div className="flex items-center justify-center py-32">
              <Loader2 size={32} className="animate-spin text-stone-500" />
            </div>
          ) : (
            <>
              {/* ── OVERVIEW ── */}
              {tab === "overview" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <StatCard icon={Users}     label="Total users"           value={stats?.total_users ?? 0}          color="bg-blue-500/20 text-blue-400" />
                    <StatCard icon={Building2} label="Businesses"            value={stats?.total_businesses ?? 0}     color="bg-brand-500/20 text-brand-400" />
                    <StatCard icon={FileText}  label="Requests"              value={stats?.total_requests ?? 0}       color="bg-purple-500/20 text-purple-400" />
                    <StatCard icon={Clock}     label="Awaiting verification" value={stats?.pending_verification ?? 0} color="bg-amber-500/20 text-amber-400" urgent />
                    <StatCard icon={CheckCircle} label="Messages"            value={stats?.total_messages ?? 0}       color="bg-green-500/20 text-green-400" />
                  </div>

                  {/* Pending verification — urgent list */}
                  {pendingBiz.length > 0 && (
                    <div className="rounded-2xl border border-amber-800 bg-amber-950/30 p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <AlertCircle size={16} className="text-amber-400" />
                        <h2 className="font-semibold text-amber-300 text-sm">Awaiting Verification ({pendingBiz.length})</h2>
                      </div>
                      <div className="space-y-2">
                        {pendingBiz.map(b => (
                          <div key={b.id} className="flex items-center justify-between bg-stone-900 rounded-xl px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-white">{b.name}</p>
                              <p className="text-xs text-stone-400">{b.category} · {b.location_city} · Registered {new Date(b.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button onClick={() => openDetail(b.id)}
                                className="flex items-center gap-1 text-xs px-3 py-1.5 border border-stone-700 text-stone-300 rounded-lg hover:bg-stone-800 transition-colors">
                                <Eye size={12} /> Review
                              </button>
                              <button onClick={() => handleVerifyAction(b.id, "verify")}
                                disabled={actionId === b.id}
                                className="flex items-center gap-1 text-xs px-3 py-1.5 bg-green-900 hover:bg-green-800 text-green-300 rounded-lg transition-colors disabled:opacity-50">
                                {actionId === b.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                Verify
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent businesses table */}
                  <div className="rounded-2xl border border-stone-700 bg-stone-900 overflow-hidden">
                    <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between">
                      <h2 className="font-semibold text-sm">Recent Registrations</h2>
                      <button onClick={() => setTab("businesses")} className="text-xs text-brand-400 hover:underline">View all →</button>
                    </div>
                    <div className="divide-y divide-stone-800">
                      {businesses.slice(0, 5).map(b => (
                        <div key={b.id} className="flex items-center justify-between px-5 py-3">
                          <div>
                            <p className="text-sm font-medium text-white">{b.name}</p>
                            <p className="text-xs text-stone-400">{b.category} · {b.location_city}</p>
                          </div>
                          <StatusBadge status={b.verification_status} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── BUSINESSES ── */}
              {tab === "businesses" && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                      <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name, email, or city…"
                        className="w-full rounded-xl border border-stone-700 bg-stone-800 py-2.5 pl-9 pr-4 text-sm text-white outline-none focus:border-brand-500 placeholder:text-stone-500 transition-colors" />
                    </div>
                    <select value={bizFilter} onChange={e => setBizFilter(e.target.value)}
                      className="rounded-xl border border-stone-700 bg-stone-800 px-4 py-2.5 text-sm text-stone-200 outline-none focus:border-brand-500 transition-colors">
                      <option value="all">All Status</option>
                      <option value="pending">Pending</option>
                      <option value="verified">Verified</option>
                      <option value="rejected">Rejected</option>
                      <option value="revoked">Revoked</option>
                    </select>
                  </div>

                  <div className="rounded-2xl border border-stone-700 bg-stone-900 overflow-hidden">
                    <div className="px-5 py-3 border-b border-stone-800 text-xs font-semibold text-stone-400 uppercase tracking-wider grid grid-cols-12 gap-4">
                      <span className="col-span-4">Business</span>
                      <span className="col-span-2">Category</span>
                      <span className="col-span-2">Status</span>
                      <span className="col-span-2">Registered</span>
                      <span className="col-span-2 text-right">Actions</span>
                    </div>

                    <div className="divide-y divide-stone-800">
                      {filteredBiz.length === 0 ? (
                        <div className="px-5 py-12 text-center text-stone-500 text-sm">No businesses found</div>
                      ) : filteredBiz.map(b => (
                        <div key={b.id}>
                          <div className="grid grid-cols-12 gap-4 px-5 py-4 items-center">
                            <div className="col-span-4 flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-stone-800 overflow-hidden shrink-0">
                                <BusinessMedia
                                  fit="avatar"
                                  src={b.logo_url}
                                  alt=""
                                  name={b.name}
                                  className="h-full w-full"
                                  placeholderTone="dark"
                                  avatarTextClassName="text-xs"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-white truncate">{b.name}</p>
                                <p className="text-xs text-stone-500 truncate">{b.location_city}</p>
                              </div>
                            </div>
                            <div className="col-span-2">
                              <span className="text-xs text-stone-300">{b.category}</span>
                            </div>
                            <div className="col-span-2">
                              <StatusBadge status={b.verification_status} />
                            </div>
                            <div className="col-span-2">
                              <span className="text-xs text-stone-500">{new Date(b.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="col-span-2 flex items-center justify-end gap-1.5">
                              <button onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}
                                className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-800 hover:text-white transition-colors" title="Quick info">
                                {expandedId === b.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                              <button onClick={() => openDetail(b.id)}
                                className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-800 hover:text-blue-400 transition-colors" title="Full review">
                                <Eye size={14} />
                              </button>
                              {b.verification_status !== "verified" && (
                                <button onClick={() => handleVerifyAction(b.id, "verify")} disabled={actionId === b.id}
                                  className="p-1.5 rounded-lg text-stone-400 hover:bg-green-950 hover:text-green-400 transition-colors disabled:opacity-50" title="Verify">
                                  {actionId === b.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                </button>
                              )}
                              {b.verification_status === "verified" && (
                                <button onClick={() => openDetail(b.id)} title="Revoke (open detail)"
                                  className="p-1.5 rounded-lg text-stone-400 hover:bg-red-950 hover:text-red-400 transition-colors">
                                  <RotateCcw size={14} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Expanded quick info */}
                          {expandedId === b.id && (
                            <div className="px-5 pb-4 bg-stone-950/50 border-t border-stone-800 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 text-xs">
                              <div><p className="text-stone-500 mb-0.5">Email</p><p className="text-white">{b.contact_email}</p></div>
                              <div><p className="text-stone-500 mb-0.5">Phone</p><p className="text-white">{b.contact_phone || "—"}</p></div>
                              <div><p className="text-stone-500 mb-0.5">Owner</p><p className="text-white truncate">{b.owner?.email ?? "—"}</p></div>
                              <div><p className="text-stone-500 mb-0.5">Eco Score</p><p className="text-white">{b.eco_score_overall}/100</p></div>
                              {b.rejection_reason && (
                                <div className="col-span-4">
                                  <p className="text-stone-500 mb-0.5">Reason</p>
                                  <p className="text-red-400 italic">{b.rejection_reason}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── USERS ── */}
              {tab === "users" && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Search by name or email…"
                      className="w-full rounded-xl border border-stone-700 bg-stone-800 py-2.5 pl-9 pr-4 text-sm text-white outline-none focus:border-brand-500 placeholder:text-stone-500 transition-colors" />
                  </div>

                  <div className="rounded-2xl border border-stone-700 bg-stone-900 overflow-hidden">
                    <div className="px-5 py-3 border-b border-stone-800 text-xs font-semibold text-stone-400 uppercase tracking-wider grid grid-cols-12 gap-4">
                      <span className="col-span-5">User</span>
                      <span className="col-span-3">Role</span>
                      <span className="col-span-2">Joined</span>
                      <span className="col-span-2 text-right">Change Role</span>
                    </div>
                    <div className="divide-y divide-stone-800">
                      {filteredUsers.length === 0 ? (
                        <div className="px-5 py-12 text-center text-stone-500 text-sm">No users found</div>
                      ) : filteredUsers.map(u => (
                        <div key={u.id} className="grid grid-cols-12 gap-4 px-5 py-4 items-center">
                          <div className="col-span-5 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{u.name}</p>
                            <p className="text-xs text-stone-400 truncate">{u.email}</p>
                          </div>
                          <div className="col-span-3 flex items-center gap-1.5 flex-wrap">
                            <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-semibold",
                              u.role === "admin"    ? "bg-purple-950 text-purple-400 border-purple-800" :
                              u.role === "business" ? "bg-blue-950 text-blue-400 border-blue-800" :
                              "bg-stone-800 text-stone-400 border-stone-700")}>
                              {u.role}
                            </span>
                            {u.pending_business && u.role !== "business" && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-800">pending biz</span>
                            )}
                          </div>
                          <div className="col-span-2">
                            <span className="text-xs text-stone-500">{new Date(u.created_at).toLocaleDateString()}</span>
                          </div>
                          <div className="col-span-2 flex justify-end">
                            <select value={u.role} disabled={actionId === u.id}
                              onChange={e => updateUserRole(u.id, e.target.value)}
                              className="rounded-lg border border-stone-700 bg-stone-800 text-[11px] text-stone-300 px-1.5 py-1 outline-none focus:border-brand-500 disabled:opacity-50 transition-colors">
                              <option value="buyer">buyer</option>
                              <option value="business">business</option>
                              <option value="admin">admin</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Business detail modal */}
      {selectedBiz && (
        <BusinessModal
          biz={selectedBiz}
          onClose={() => setSelectedBiz(null)}
          onAction={handleVerifyAction}
        />
      )}

      {showAddBiz && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8">
    <div className="bg-stone-900 border border-stone-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold text-white">Add Business Manually</h2>
        <button type="button" onClick={closeAddBizModal} className="text-stone-400 hover:text-white">✕</button>
      </div>
      <div className="space-y-3">
        {[
          { label: "Business Name *",    key: "name",          ph: "e.g. GreenLeaf Catering"      },
          { label: "Tagline",            key: "tagline",        ph: "Short one-liner"              },
          { label: "Contact Email *",    key: "contact_email",  ph: "business@email.com"           },
          { label: "Phone *",            key: "contact_phone",  ph: "+855 12 000 000"              },
          { label: "Facebook Page URL *",  key: "facebook_url",   ph: "https://facebook.com/your-page" },
          { label: "Telegram",           key: "telegram_url",   ph: "https://t.me/username"        },
          { label: "Website",            key: "website_url",    ph: "https://yourbusiness.com"     },
          { label: "City *",             key: "location_city",  ph: "Phnom Penh"                   },
          { label: "Location Detail",    key: "location_detail",ph: "BKK1, Phnom Penh"             },
          { label: "Google Map URL",     key: "map_url",        ph: "https://maps.google.com/..."  },
          { label: "Subcategories",      key: "sub_categories", ph: "Organic, Catering, Vegan"      },
          { label: "Services",           key: "services",       ph: "Event catering, Delivery"      },
          { label: "Tags",               key: "tags",           ph: "eco, local, zero-waste"        },
          { label: "Tax ID",             key: "tax_id",         ph: "Optional tax / company id"     },
          { label: "Bulk Capacity",      key: "bulk_capacity",  ph: "e.g. Up to 2,000 meals/day"    },
          { label: "Discount %",         key: "discount_percent", ph: "0 - 100"                    },
          { label: "Founded Year",       key: "founded_year",   ph: "2022"                          },
          { label: "Collaboration Types", key: "collaboration_types", ph: "supplier, partner"       },
          { label: "Investment Amount",  key: "investment_amount", ph: "e.g. 25,000 USD"            },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-xs font-semibold text-stone-400 mb-1">{f.label}</label>
            <input value={String((addBizForm as Record<string, string | boolean>)[f.key] ?? "")}
              onChange={e => setAddBizForm(p => ({ ...p, [f.key]: e.target.value }))}
              placeholder={f.ph}
              className="w-full rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-sm text-white outline-none focus:border-brand-500 placeholder:text-stone-600" />
          </div>
        ))}
        <div className="rounded-xl border border-stone-700 bg-stone-800/50 p-4 space-y-3">
          <p className="text-xs font-semibold text-stone-400">Logo & profile photos</p>
          <input
            ref={addBizLogoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleAddBizLogoChange}
          />
          <input
            ref={addBizGalleryInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={handleAddBizGalleryChange}
          />
          <div>
            <label className="block text-[11px] font-semibold text-stone-400 mb-2">Logo</label>
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-14 h-14 rounded-xl border border-stone-600 bg-stone-800 overflow-hidden shrink-0 flex items-center justify-center">
                {addBizLogoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={addBizLogoPreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-5 h-5 text-stone-600" />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => addBizLogoInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-600 bg-stone-800 text-xs text-stone-200 hover:bg-stone-700"
                >
                  <Camera className="w-3.5 h-3.5" />
                  {addBizLogoFile ? "Replace" : "Upload"} logo
                </button>
                {addBizLogoFile && (
                  <button type="button" onClick={clearAddBizLogo} className="text-xs text-red-400 hover:text-red-300">
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-stone-400 mb-1">Business profile photos</label>
            <p className="text-[10px] text-stone-500 mb-2">Up to {MAX_ADMIN_GALLERY} images. Choosing new files replaces the current selection.</p>
            <button
              type="button"
              onClick={() => addBizGalleryInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-600 bg-stone-800 text-xs text-stone-200 hover:bg-stone-700"
            >
              <Camera className="w-3.5 h-3.5" />
              {addBizGalleryFiles.length ? `Change photos (${addBizGalleryFiles.length})` : "Upload profile photos"}
            </button>
            {addBizGalleryPreviews.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {addBizGalleryPreviews.map((url, i) => (
                  <div key={`${url}-${i}`} className="relative w-14 h-14 rounded-lg overflow-hidden border border-stone-600">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeAddBizGalleryAt(i)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded bg-black/60 text-white text-xs leading-5 hover:bg-black/80"
                      aria-label="Remove photo"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-stone-400 mb-1">Category *</label>
          <select value={addBizForm.category}
            onChange={e => setAddBizForm(p => ({ ...p, category: e.target.value }))}
            className="w-full rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-sm text-white outline-none focus:border-brand-500">
            <option value="">Select category</option>
            {["Food","Ingredients","Packaging","Rentals","Event Services","Others"].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-stone-400 mb-1">Tier</label>
          <select value={addBizForm.tier}
            onChange={e => setAddBizForm(p => ({ ...p, tier: e.target.value }))}
            className="w-full rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-sm text-white outline-none focus:border-brand-500">
            {["Startup","SME","Company"].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-stone-400 mb-1">Description</label>
          <textarea value={addBizForm.description}
            onChange={e => setAddBizForm(p => ({ ...p, description: e.target.value }))} rows={3}
            placeholder="Describe the business…"
            className="w-full rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-sm text-white outline-none focus:border-brand-500 resize-none placeholder:text-stone-600" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-stone-400 mb-1">Eco Description</label>
          <textarea value={addBizForm.eco_description}
            onChange={e => setAddBizForm(p => ({ ...p, eco_description: e.target.value }))} rows={2}
            placeholder="What makes this business eco-friendly?"
            className="w-full rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-sm text-white outline-none focus:border-brand-500 resize-none placeholder:text-stone-600" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-stone-400 mb-1">Collaboration Description</label>
          <textarea value={addBizForm.collaboration_description}
            onChange={e => setAddBizForm(p => ({ ...p, collaboration_description: e.target.value }))} rows={2}
            placeholder="How this business wants to collaborate"
            className="w-full rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-sm text-white outline-none focus:border-brand-500 resize-none placeholder:text-stone-600" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-stone-400 mb-1">Investment Description</label>
          <textarea value={addBizForm.investment_description}
            onChange={e => setAddBizForm(p => ({ ...p, investment_description: e.target.value }))} rows={2}
            placeholder="Funding use-case or growth plan"
            className="w-full rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-sm text-white outline-none focus:border-brand-500 resize-none placeholder:text-stone-600" />
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-stone-700 bg-stone-800/60 p-3">
          {[
            { key: "bulk_support", label: "Bulk support" },
            { key: "open_for_collaboration", label: "Open for collaboration" },
            { key: "open_for_investment", label: "Open for investment" },
            { key: "notify_by_email", label: "Notify by email" },
            { key: "notify_by_phone", label: "Notify by phone" },
          ].map(item => (
            <label key={item.key} className="flex items-center gap-2 text-xs text-stone-200">
              <input
                type="checkbox"
                checked={(addBizForm as Record<string, boolean | string>)[item.key] as boolean}
                onChange={e => setAddBizForm(p => ({ ...p, [item.key]: e.target.checked }))}
                className="rounded border-stone-600 bg-stone-900 text-brand-500"
              />
              {item.label}
            </label>
          ))}
        </div>
      </div>
      <div className="flex gap-3 mt-5">
        <button type="button" onClick={closeAddBizModal}
          className="flex-1 py-2 rounded-xl border border-stone-700 text-stone-300 text-sm hover:bg-stone-800">
          Cancel
        </button>
        <button onClick={handleAddBusiness} disabled={addBizSaving}
          className="flex-1 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold disabled:opacity-50">
          {addBizSaving ? "Adding…" : "Add business"}
        </button>
      </div>
    </div>
  </div>
)}
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed bottom-5 right-5 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl z-50",
          toast.ok ? "bg-stone-900 border-brand-700 text-brand-300" : "bg-stone-900 border-red-800 text-red-300"
        )}>
          {toast.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

