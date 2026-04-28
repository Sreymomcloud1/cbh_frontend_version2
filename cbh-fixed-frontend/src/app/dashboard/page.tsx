"use client";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  LayoutDashboard, MessageCircle, Settings,
  CheckCircle, Clock, Star, FileText, Loader2, AlertCircle,
  Camera, Mail, Phone, User as UserIcon, Lock, Eye, EyeOff,
  ShoppingCart, Handshake, TrendingUp, X, Trash2, Bookmark, Heart,
} from "lucide-react";
import {
  getProfile, listMyRequests, updateProfile, deleteAccount,
  listMyConversations, updateConversationStatus, createReview, getBusinessById, getSavedBusinesses,
} from "@/lib/api";
import { cn, formatDate, statusBadge, purposeColor } from "@/lib/utils";
import { freshSupplierHref, notifyProfileUpdated, onProfileUpdated, onBusinessDataChanged } from "@/lib/data-events";
import MessagingInbox from "@/components/messaging/MessagingInbox";
import type { User, QuoteRequest } from "@/types";
import Link from "next/link";

type Tab = "overview" | "messages" | "saved" | "settings";

const NAV: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview",  label: "Dashboard", icon: LayoutDashboard },
  { id: "messages",  label: "Messages",  icon: MessageCircle  },
  { id: "saved",     label: "Saved",     icon: Bookmark       },
  { id: "settings",  label: "Settings",  icon: Settings       },
];

// ── Reusable input ────────────────────────────────────────────────────────────
const InputRow = ({
  label, value, onChange, type = "text", icon: Icon, autoComplete, inputMode, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; icon: React.ElementType; autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder?: string;
}) => (
  <div>
    <label className="block text-xs font-semibold text-ink mb-1.5">{label}</label>
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete} inputMode={inputMode} placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
    </div>
  </div>
);

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, ok, onDone }: { msg: string; ok: boolean; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className={cn(
      "fixed bottom-5 right-5 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium shadow-lift z-50",
      ok ? "bg-white border-brand-200 text-brand-700" : "bg-white border-red-200 text-red-700"
    )}>
      {ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {msg}
      <button onClick={onDone}><X className="w-3 h-3 ml-1 opacity-50" /></button>
    </div>
  );
}

// ── Review modal ──────────────────────────────────────────────────────────────
function ReviewModal({
  businessId, businessName, onDone, onSkip,
}: {
  businessId: string; businessName: string;
  onDone: () => void; onSkip: () => void;
}) {
  const [rating,     setRating]     = useState(0);
  const [comment,    setComment]    = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      await createReview(businessId, { rating, comment: comment.trim() || undefined });
      setDone(true);
      setTimeout(onDone, 1200);
    } catch { onDone(); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-lift w-full max-w-sm p-6">
        {done ? (
          <div className="text-center py-4">
            <CheckCircle className="w-10 h-10 text-brand-600 mx-auto mb-2" />
            <p className="font-semibold text-ink">Review submitted!</p>
          </div>
        ) : (
          <>
            <h3 className="font-semibold text-ink mb-1">Rate {businessName}</h3>
            <p className="text-xs text-ink-muted mb-4">Share your experience to help other buyers.</p>
            {/* Stars */}
            <div className="flex gap-2 mb-4">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setRating(n)}
                  className={cn("text-3xl transition-transform hover:scale-110 focus:outline-none",
                    n <= rating ? "opacity-100" : "opacity-25")}>
                  ⭐
                </button>
              ))}
            </div>
            <textarea value={comment} onChange={e => setComment(e.target.value)}
              placeholder="Optional comment…" rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={onSkip}
                className="flex-1 py-2 rounded-xl border border-surface-200 text-ink-muted text-sm hover:bg-surface-50 transition-colors">
                Skip
              </button>
              <button onClick={handleSubmit} disabled={rating === 0 || submitting}
                className="flex-1 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? "Submitting…" : "Submit Review"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
function DashboardInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const initTab      = (searchParams.get("tab") as Tab) ?? "overview";
  const initConv     = searchParams.get("conv") ?? undefined;
  const [tab,          setTab]          = useState<Tab>(initTab);

  // ✅ ADD THIS (IMPORTANT FIX)
useEffect(() => {
  const currentTab = (searchParams.get("tab") as Tab) ?? "overview";
  setTab(currentTab);
}, [searchParams]);

  //const [tab,          setTab]          = useState<Tab>(initTab);
  const [user,         setUser]         = useState<User | null>(null);
  const [requests,     setRequests]     = useState<QuoteRequest[]>([]);
  const [avatarUrl,    setAvatarUrl]    = useState("");
  const [displayName,  setDisplayName]  = useState("");
  const [savedIds,     setSavedIds]     = useState<string[]>([]);
  const [savedNames,   setSavedNames]   = useState<Record<string, string>>({});
  const [unreadCount,  setUnreadCount]  = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  const [pwSuccess,    setPwSuccess]    = useState(false);

  // Review modal state
  const [reviewModal, setReviewModal] = useState<{ bizId: string; bizName: string } | null>(null);

  // Settings fields
  const [sName,    setSName]    = useState("");
  const [sEmail,   setSEmail]   = useState("");
  const [sPhone,   setSPhone]   = useState("");
  const [sSaving,  setSSaving]  = useState(false);
  const [curPw,    setCurPw]    = useState("");
  const [newPw,    setNewPw]    = useState("");
  const [confPw,   setConfPw]   = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, ok: boolean) => setToast({ msg, ok });

  // ── Load profile + requests ───────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profile, { requests: reqs }, savedRows] = await Promise.all([
        getProfile(),
        listMyRequests({ limit: 50 }),
        getSavedBusinesses().catch(() => []),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = profile as any;
      setUser(profile);
      setRequests(reqs);
      setAvatarUrl(p.avatar_url ?? p.avatar ?? "");
      setDisplayName(profile.name);
      setSName(profile.name);
      setSEmail(p.email ?? profile.email ?? "");
      setSPhone(p.phone ?? p.phone_number ?? "");
      const ids = savedRows
        .map((row) => (row as { business?: { id?: string } | null }).business?.id)
        .filter((id): id is string => Boolean(id));
      const savedBusinesses = await Promise.all(ids.map(id =>
        getBusinessById(id).then(b => ({ id, name: b.name })).catch(() => null)
      ));
      const activeSaved = savedBusinesses.filter((b): b is { id: string; name: string } => Boolean(b));
      setSavedIds(activeSaved.map(b => b.id));
      setSavedNames(Object.fromEntries(activeSaved.map(b => [b.id, b.name])));
    } catch (err) {
  console.error("Dashboard load error:", err);

  const { data } = await supabase.auth.getSession();

  if (!data.session) {
    router.replace("/auth/login");
  } else {
    showToast("Failed to load dashboard data. Please refresh.", false);
  }
} finally {
  setLoading(false);
}
  }, [router]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const unsubscribe = onBusinessDataChanged(load);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  useEffect(() => onProfileUpdated((detail) => {
    if (!detail) return;
    if (detail.name) {
      setDisplayName(detail.name);
      setSName(detail.name);
      setUser(prev => prev ? { ...prev, name: detail.name ?? prev.name } : prev);
    }
    if (detail.avatarUrl) setAvatarUrl(detail.avatarUrl);
  }), []);

  // Poll unread message count every 30s
  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user || !mounted) return;
        const convs = await listMyConversations();
        const uid   = session.user.id;
        const n = convs.filter(c =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (c.messages ?? []).some((m: any) => !m.read && m.senderId !== uid)
        ).length;
        if (mounted) setUnreadCount(n);
      } catch { /* silent */ }
    };
    poll();
    const iv = setInterval(poll, 30000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  // Refresh request counts when a new request is submitted from another page
  useEffect(() => {
    const onSubmit = () => {
      const reload = () =>
        listMyRequests({ limit: 50 })
          .then(({ requests: reqs }) => setRequests(reqs))
          .catch(() => {});
      setTimeout(reload, 500);
      setTimeout(reload, 2000);
    };
    window.addEventListener("cbh:request-submitted", onSubmit);
    return () => window.removeEventListener("cbh:request-submitted", onSubmit);
  }, []);

  // ── Avatar upload ─────────────────────────────────────────────────────────
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUrl(URL.createObjectURL(file));
    setAvatarUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const ext  = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${session.user.id}/avatar.${ext}`;
      const { error } = await supabase.storage
        .from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      const fresh = `${publicUrl}?t=${Date.now()}`;
      await updateProfile({ avatar_url: fresh });
      setAvatarUrl(fresh);
      showToast("Photo updated.", true);
      notifyProfileUpdated({ avatarUrl: fresh });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload failed.", false);
    } finally {
      setAvatarUploading(false);
    }
  };

  // ── Save profile ──────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!sName.trim()) { showToast("Name cannot be empty.", false); return; }
    setSSaving(true);
    try {
      await updateProfile({ name: sName.trim(), phone: sPhone.trim() || null });
      setDisplayName(sName.trim());
      setUser(prev => prev ? { ...prev, name: sName.trim(), email: sEmail.trim(), phone: sPhone.trim() || undefined } : prev);
      if (sEmail.trim() !== user?.email) {
        const { error } = await supabase.auth.updateUser({ email: sEmail.trim() });
        if (error) throw error;
        showToast("Saved. Check your NEW email to confirm the change.", true);
      } else {
        showToast("Profile saved.", true);
      }
      notifyProfileUpdated({ name: sName.trim(), avatarUrl });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Save failed.", false);
    } finally {
      setSSaving(false);
    }
  };

  // ── Change password ───────────────────────────────────────────────────────
  const handleChangePw = async () => {
    if (!curPw.trim())   { showToast("Enter your current password.", false); return; }
    if (!newPw.trim())   { showToast("Enter a new password.", false); return; }
    if (curPw === newPw) { showToast("New password must be different.", false); return; }
    if (newPw.length < 8){ showToast("Password must be at least 8 characters.", false); return; }
    if (newPw !== confPw){ showToast("Passwords do not match.", false); return; }
    setPwSaving(true);
    try {
      const { error: siErr } = await supabase.auth.signInWithPassword({ email: user!.email, password: curPw });
      if (siErr) throw new Error("Current password is incorrect.");
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setPwSuccess(true);
      showToast("Password updated. Logging out…", true);
      setCurPw(""); setNewPw(""); setConfPw("");
      setTimeout(async () => { await supabase.auth.signOut(); window.location.href = "/auth/login"; }, 1500);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to change password.", false);
    } finally {
      setPwSaving(false);
    }
  };

  // ── Delete account (password required) ───────────────────────────────────
  const handleDeleteAccount = async () => {
    if (!window.confirm("Permanently delete your account and all data? This cannot be undone.")) return;
    const pw = window.prompt("Enter your password to confirm:");
    if (!pw) return;
    setDeleting(true);
    try {
      const { error: siErr } = await supabase.auth.signInWithPassword({ email: user!.email, password: pw });
      if (siErr) { showToast("Incorrect password. Account not deleted.", false); setDeleting(false); return; }
      await deleteAccount();
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed. Contact support.", false);
      setDeleting(false);
    }
  };

  // ── Mark conversation complete + save business + show review ─────────────
  const handleConversationCompleted = async (convId: string, bizId: string, bizName: string) => {
    try {
      await updateConversationStatus(convId, { status: "completed" });
      // Auto-save this business to saved list
      if (!savedIds.includes(bizId)) {
        setSavedIds(prev => [...prev, bizId]);
        setSavedNames(prev => ({ ...prev, [bizId]: bizName }));
      }
      // Show review modal
      setReviewModal({ bizId, bizName });
      // Refresh requests
      listMyRequests({ limit: 50 }).then(({ requests: reqs }) => setRequests(reqs)).catch(() => {});
    } catch {
      showToast("Could not mark as complete.", false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-16 min-h-[60vh]">
      <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
    </div>
  );
  if (!user) return null;

  const buyCount    = requests.filter(r => r.purpose === "buy").length;
  const collabCount = requests.filter(r => r.purpose === "collaborate").length;
  const investCount = requests.filter(r => r.purpose === "invest").length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {toast && <Toast msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />}
      {reviewModal && (
        <ReviewModal
          businessId={reviewModal.bizId}
          businessName={reviewModal.bizName}
          onDone={() => setReviewModal(null)}
          onSkip={() => setReviewModal(null)}
        />
      )}

      <div className="flex gap-8">

        {/* ── Sidebar ── */}
        <aside className="hidden md:flex flex-col w-52 shrink-0">
          <nav className="space-y-0.5">
            {NAV.map(item => {
              const Icon = item.icon;
              return (
                <button key={item.id} onClick={() => {
  setTab(item.id);
  router.push(`/dashboard?tab=${item.id}`, { scroll: false });
}}
                  className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                    tab === item.id ? "bg-brand-50 text-brand-700" : "text-ink-muted hover:bg-surface-50 hover:text-ink")}>
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                  {item.id === "messages" && unreadCount > 0 && (
                    <span className="ml-auto w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold shrink-0">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                  {item.id === "saved" && savedIds.length > 0 && (
                    <span className="ml-auto text-[10px] text-ink-faint">{savedIds.length}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ── Mobile tab bar ── */}
        <div className="md:hidden w-full">
          <div className="flex gap-1 overflow-x-auto pb-2 mb-4 scrollbar-none">
            {NAV.map(item => {
              const Icon = item.icon;
              return (
                <button key={item.id} onClick={() => {
  setTab(item.id);
  router.push(`/dashboard?tab=${item.id}`, { scroll: false });
}}
                  className={cn("flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors shrink-0 relative",
                    tab === item.id ? "bg-brand-600 text-white" : "bg-surface-100 text-ink-muted")}>
                  <Icon className="w-3.5 h-3.5" />{item.label}
                  {item.id === "messages" && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <main className="flex-1 min-w-0">

          {/* ══ OVERVIEW ══ */}
          {tab === "overview" && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl text-ink mb-1">
                  Welcome back, {displayName.split(" ")[0]} 👋
                </h1>
                <p className="text-sm text-ink-muted">Your activity on CBH.</p>
              </div>

              {/* Request type breakdown — updates when requests change */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Buy Requests",   count: buyCount,    icon: ShoppingCart, color: "bg-brand-50 text-brand-600"    },
                  { label: "Collaborations", count: collabCount, icon: Handshake,    color: "bg-blue-50 text-blue-600"      },
                  { label: "Investments",    count: investCount, icon: TrendingUp,   color: "bg-purple-50 text-purple-600"  },
                ].map(s => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="bg-white rounded-2xl border border-surface-200 shadow-soft p-4 text-center">
                      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2", s.color)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <p className="text-2xl font-display text-ink">{s.count}</p>
                      <p className="text-xs text-ink-faint mt-0.5">{s.label}</p>
                    </div>
                  );
                })}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total Requests", value: requests.length,                                        icon: FileText,    color: "text-brand-600" },
                  { label: "Completed",       value: requests.filter(r => r.status === "completed").length,  icon: CheckCircle, color: "text-green-600" },
                  { label: "Pending Reply",   value: requests.filter(r => r.status === "pending").length,    icon: Clock,       color: "text-amber-600" },
                  { label: "Reward Points",   value: user.rewardPoints,                                      icon: Star,        color: "text-yellow-600" },
                ].map(s => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="bg-white rounded-2xl border border-surface-200 shadow-soft p-4">
                      <Icon className={cn("w-4 h-4 mb-2", s.color)} />
                      <p className="text-xl font-bold text-ink">{s.value}</p>
                      <p className="text-xs text-ink-faint">{s.label}</p>
                    </div>
                  );
                })}
              </div>

              {/* Recent requests */}
              <div className="bg-white rounded-2xl border border-surface-200 shadow-soft p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-ink">Recent Requests</h3>
                  <Link href="/request" className="text-xs text-brand-600 hover:underline">+ New request</Link>
                </div>
                {requests.length === 0 ? (
                  <p className="text-sm text-ink-muted text-center py-6">
                    No requests yet.{" "}
                    <Link href="/request" className="text-brand-600 hover:underline">Submit one →</Link>
                  </p>
                ) : (
                  <div className="space-y-2">
                    {requests.slice(0, 5).map(req => (
                      <div key={req.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-50 gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{req.product}</p>
                          <p className="text-xs text-ink-faint">
                            {req.supplierName ?? "Open request"} · {formatDate(req.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", purposeColor(req.purpose))}>
                            {req.purpose}
                          </span>
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", statusBadge(req.status))}>
                            {req.status}
                          </span>
                          {req.conversationId && (
                            <button onClick={() => setTab("messages")}
                              className="text-xs text-brand-600 hover:underline flex items-center gap-0.5">
                              <MessageCircle className="w-3 h-3" /> Chat
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ MESSAGES ══ */}
          {tab === "messages" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl text-ink">Messages</h2>
                {unreadCount > 0 && (
                  <span className="text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded-full border border-red-200">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              <div className="bg-white rounded-2xl border border-surface-200 shadow-soft overflow-hidden" style={{ height: "72vh" }}>
                <MessagingInbox
                  role="buyer"
                  initialConvId={initConv}
                  onConversationCompleted={handleConversationCompleted}
                />
              </div>
            </div>
          )}

          {/* ══ SAVED BUSINESSES ══ */}
          {tab === "saved" && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-2xl text-ink mb-1">Saved Businesses</h2>
                <p className="text-sm text-ink-muted">
                  Businesses you saved or completed a request with.
                </p>
              </div>
              {savedIds.length === 0 ? (
                <div className="bg-white rounded-2xl border border-surface-200 shadow-soft text-center py-16 px-6">
                  <Bookmark className="w-10 h-10 text-ink-faint mx-auto mb-3" />
                  <h3 className="font-semibold text-ink mb-1">No saved businesses yet</h3>
                  <p className="text-sm text-ink-muted mb-4">
                    Complete a conversation with a business and they'll appear here automatically.
                  </p>
                  <Link href="/explore"
                    className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">
                    Browse Suppliers
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {savedIds.map(id => (
                    <Link key={id} href={freshSupplierHref(id)} prefetch={false}
                      className="flex items-center gap-3 bg-white border border-surface-200 rounded-2xl p-4 hover:border-brand-300 hover:shadow-soft transition-all group">
                      <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                        <Heart className="w-5 h-5 text-brand-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ink group-hover:text-brand-600 transition-colors truncate">
                          {savedNames[id] ?? "Loading…"}
                        </p>
                        <p className="text-xs text-ink-faint">Click to view full profile</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══ SETTINGS ══ */}
          {tab === "settings" && (
            <div className="space-y-6 max-w-lg">
              <h2 className="font-display text-2xl text-ink">Settings</h2>

              {/* Profile */}
              <div className="bg-white rounded-2xl border border-surface-200 shadow-soft p-5 space-y-4">
                <h3 className="font-semibold text-ink text-sm">Profile</h3>
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-brand-600 flex items-center justify-center text-white font-bold text-xl border-2 border-surface-200">
                      {avatarUrl
                        ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                        : displayName[0]?.toUpperCase()
                      }
                    </div>
                    <button onClick={() => fileRef.current?.click()} disabled={avatarUploading}
                      className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center text-white shadow hover:bg-brand-700 transition-colors disabled:opacity-50">
                      {avatarUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                    </button>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink">Profile Photo</p>
                    <button onClick={() => fileRef.current?.click()} disabled={avatarUploading}
                      className="text-xs text-brand-600 hover:underline mt-0.5 disabled:opacity-50">
                      {avatarUploading ? "Uploading…" : "Change photo"}
                    </button>
                    <p className="text-xs text-ink-faint mt-0.5">JPG or PNG, max 5 MB</p>
                  </div>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
                    className="hidden" onChange={handleAvatarChange} />
                </div>
                <InputRow label="Full Name"        value={sName}  onChange={setSName}  icon={UserIcon} autoComplete="name" />
                <InputRow label="Email"            value={sEmail} onChange={setSEmail} icon={Mail}     type="email" autoComplete="email" />
                <InputRow label="Phone (optional)" value={sPhone} onChange={setSPhone} icon={Phone}
                  inputMode="tel" autoComplete="tel" placeholder="+855 12 000 000" />
                <button onClick={handleSaveProfile} disabled={sSaving}
                  className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">
                  {sSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {sSaving ? "Saving…" : "Save Profile"}
                </button>
              </div>

              {/* Password */}
              <div className="bg-white rounded-2xl border border-surface-200 shadow-soft p-5 space-y-4">
                <h3 className="font-semibold text-ink text-sm">Change Password</h3>
                {[
                  { label: "Current Password", val: curPw,  set: setCurPw  },
                  { label: "New Password",      val: newPw,  set: setNewPw  },
                  { label: "Confirm Password",  val: confPw, set: setConfPw },
                ].map(f => (
                  <div key={f.label}>
                    <label className="block text-xs font-semibold text-ink mb-1.5">{f.label}</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
                      <input type={showPw ? "text" : "password"} value={f.val}
                        onChange={e => f.set(e.target.value)} autoComplete="new-password"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      <button type="button" onClick={() => setShowPw(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink">
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}
                <button onClick={handleChangePw} disabled={pwSaving || pwSuccess || !curPw || !newPw || !confPw}
                  className="flex items-center gap-2 bg-surface-100 hover:bg-surface-200 disabled:opacity-50 text-ink font-semibold px-5 py-2.5 rounded-xl text-sm border border-surface-200 transition-colors">
                  {pwSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {pwSaving ? "Changing…" : pwSuccess ? "Changed ✓" : "Change Password"}
                </button>
              </div>

              {/* Danger zone */}
              <div className="bg-white rounded-2xl border border-red-100 shadow-soft p-5">
                <h3 className="font-semibold text-red-700 text-sm mb-1">Danger Zone</h3>
                <p className="text-xs text-ink-muted mb-3">
                  Permanently delete your account and all your data.
                </p>
                <button onClick={handleDeleteAccount} disabled={deleting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium border border-red-200 transition-colors disabled:opacity-50">
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {deleting ? "Deleting…" : "Delete Account"}
                </button>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-16 min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
      </div>
    }>
      <DashboardInner />
    </Suspense>
  );
}
