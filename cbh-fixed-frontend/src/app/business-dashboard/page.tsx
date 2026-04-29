"use client";
import { Suspense, useState, useEffect, useCallback, useRef, type ReactNode, type ElementType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { notifyBusinessDataChanged, onBusinessDataChanged } from "@/lib/data-events";
import { logoutAndRefresh } from "@/lib/logout";
import {
  LayoutDashboard, MessageCircle, Settings,
  CheckCircle, Clock, ShoppingCart, Handshake, TrendingUp,
  Loader2, AlertCircle, Camera, Mail, Phone, Globe,
  Facebook, Send, Lock, Eye, EyeOff, X, Leaf, Star, MapPin, Trash2,
} from "lucide-react";
import {
  getMyBusiness, 
  listBusinessRequests, 
  updateBusiness, 
  listMyConversations,
  updateRequestStatus,
  deleteAccount,
  resubmitBusinessForReview,
  uploadBusinessLogo,
} from "@/lib/api";
import { businessVerificationBadge } from "@/lib/business-verification-display";
import { cn, formatDate, statusBadge, purposeColor, ecoScoreBg } from "@/lib/utils";
import { verifyCurrentPasswordAndSetNew } from "@/lib/auth-change-password";
import MessagingInbox from "@/components/messaging/MessagingInbox";
import EcoScoreQuestionnaire from "@/components/eco/EcoScoreQuestionnaire";
import { BusinessMedia } from "@/components/ui/BusinessMedia";
import type { Supplier, QuoteRequest } from "@/types";

type Tab = "overview" | "messages" | "settings";

const nav: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview",  label: "Overview", icon: LayoutDashboard },
  { id: "messages",  label: "Messages", icon: MessageCircle },
  { id: "settings",  label: "Settings", icon: Settings },
];

function Toast({ msg, ok, onDone }: { msg: string; ok: boolean; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
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

function SupplierCard({ biz }: { biz: Supplier }) {
  return (
    <div className="bg-white rounded-2xl border border-surface-200 shadow-soft overflow-hidden max-w-xs">
      <div className="h-44 bg-surface-100 relative overflow-hidden">
        <BusinessMedia
          fit="cover"
          src={biz.gallery?.[0] || biz.logo}
          alt={biz.name}
          name={biz.name}
          className="h-full w-full"
        />
        <div className="absolute top-3 right-3">
          <span className={cn("text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1", ecoScoreBg(biz.ecoScore.overall))}>
            <Leaf className="w-3 h-3" /> {biz.ecoScore.overall}
          </span>
        </div>
        <div className="absolute bottom-3 left-3 w-9 h-9 rounded-xl bg-white border border-surface-200 overflow-hidden shadow-soft">
          <BusinessMedia
            fit="avatar"
            src={biz.logo}
            alt=""
            name={biz.name}
            className="h-full w-full rounded-xl bg-white"
            avatarTextClassName="text-sm"
          />
        </div>
      </div>
      <div className="p-4 space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-ink text-sm">{biz.name}</p>
          {biz.verified && <CheckCircle className="w-3.5 h-3.5 text-brand-500" />}
        </div>
        <p className="text-xs text-ink-faint line-clamp-2">{biz.tagline}</p>
        <div className="flex items-center gap-1 text-xs text-ink-faint">
          <MapPin className="w-3 h-3" />{biz.locationDetail || biz.location}
          <span>·</span>{biz.tier}
        </div>
        {biz.rating > 0 && (
          <div className="flex items-center gap-1 text-xs">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span className="font-medium text-ink">{biz.rating.toFixed(1)}</span>
            <span className="text-ink-faint">({biz.reviewCount})</span>
          </div>
        )}
      </div>
    </div>
  );
}

function BizProfileToggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-ink">{label}</span>
      <button type="button" onClick={() => onChange(!checked)}
        className={cn("w-11 h-6 rounded-full relative transition-colors", checked ? "bg-brand-600" : "bg-surface-200")}>
        <div className={cn("w-5 h-5 rounded-full bg-white absolute top-0.5 shadow transition-transform", checked ? "translate-x-5" : "translate-x-0.5")} />
      </button>
    </div>
  );
}

function BizProfileField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-ink mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function BizProfileTextInput({ value, onChange, placeholder, type = "text", icon: Icon }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; icon?: ElementType;
}) {
  return (
    <div className="relative">
      {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={cn("w-full py-2.5 rounded-xl border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500",
          Icon ? "pl-10 pr-4" : "px-3")} />
    </div>
  );
}

function BusinessDashboardInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const initTab      = (searchParams.get("tab") as Tab) ?? "overview";
  const initConv     = searchParams.get("conv") ?? undefined;

  const [tab,      setTab]      = useState<Tab>(initTab);
  const [biz,      setBiz]      = useState<Supplier | null>(null);
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [resubmitReviewLoading, setResubmitReviewLoading] = useState(false);

  // Edit state
  const [eName,    setEName]    = useState("");
  const [eTagline, setETagline] = useState("");
  const [eDesc,    setEDesc]    = useState("");
  const [ePhone,   setEPhone]   = useState("");
  const [eEmail,   setEEmail]   = useState("");
  const [eWeb,     setEWeb]     = useState("");
  const [eFB,      setEFB]      = useState("");
  const [eTG,      setETG]      = useState("");
  const [eCollab,  setECollab]  = useState(false);
  const [eInvest,  setEInvest]  = useState(false);
  const [eNotify,  setENotify]  = useState(true);
  const [logoUrl,  setLogoUrl]  = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const logoUploadingRef = useRef(false);
  const [eSaving,  setESaving]  = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  /** Helps owners find edits after rejection/unpublish—same tooling as pending/approved listings */
  const expandProfileBannerOnceRef = useRef(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const [curPw,    setCurPw]    = useState("");
  const [newPw,    setNewPw]    = useState("");
  const [confPw,   setConfPw]   = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const logoRef = useRef<HTMLInputElement>(null);
  const showToast = (msg: string, ok: boolean) => setToast({ msg, ok });

  const handleResubmitForReview = async () => {
    if (!biz || resubmitReviewLoading) return;
    setResubmitReviewLoading(true);
    try {
      const updated = await resubmitBusinessForReview();
      setBiz(updated);
      notifyBusinessDataChanged({ id: updated.id, action: "updated" });
      showToast("Submitted for review. An admin will reassess your listing.", true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not submit for review.", false);
    } finally {
      setResubmitReviewLoading(false);
    }
  };

  useEffect(() => {
    logoUploadingRef.current = logoUploading;
  }, [logoUploading]);

  const fetchUnread = useCallback(async () => {
    try {
      const convs = await listMyConversations();
      const count = convs.filter((c: any) => {
        const lastMsg = c.messages?.[c.messages.length - 1];
        return lastMsg && !lastMsg.read && lastMsg.senderRole !== "business";
      }).length;
      setUnreadCount(count);
    } catch (err) {
      console.error("Unread count fetch error:", err);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const business = await getMyBusiness();
      if (!business) {
        router.push("/business/register");
        return;
      }
      setBiz(business);

      let reqs: QuoteRequest[] = [];
      try {
        const listed = await listBusinessRequests(business.id, { limit: 50 });
        reqs = listed.requests ?? [];
      } catch {
        reqs = [];
      }
      setRequests(reqs);

      setEName(business.name);
      setETagline(business.tagline ?? "");
      setEDesc(business.description ?? "");
      setEPhone(business.contactPhone ?? "");
      setEEmail(business.contactEmail ?? "");
      setEWeb(business.website ?? "");
      setEFB(business.facebookUrl ?? "");
      setETG(business.telegramUrl ?? "");
      setLogoUrl(business.logo ?? "");
      setECollab(business.collaboration?.enabled ?? false);
      setEInvest(business.investment?.enabled ?? false);
      setENotify(business.notifyByEmail !== false);
      
      await fetchUnread();
    } catch (err) {
      router.push("/auth/login");
    } finally {
      setLoading(false);
    }
  }, [router, fetchUnread]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const unsubscribe = onBusinessDataChanged(load);
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (logoUploadingRef.current) return;
      load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  useEffect(() => {
    if (tab === "messages") {
      setUnreadCount(0);
    } else {
      fetchUnread();
    }
  }, [tab, fetchUnread]);

  useEffect(() => {
    if (!biz || expandProfileBannerOnceRef.current) return;
    const status = String(biz.verificationStatus ?? "");
    if (status !== "rejected" && status !== "revoked") return;
    expandProfileBannerOnceRef.current = true;
    setShowProfile(true);
  }, [biz]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !biz) return;
    const input = e.target;
    setLogoUrl(URL.createObjectURL(file));
    setLogoUploading(true);
    logoUploadingRef.current = true;
    try {
      const url = await uploadBusinessLogo(file, biz.id);
      const displayUrl = `${url.split("?")[0]}?t=${Date.now()}`;
      setLogoUrl(displayUrl);
      setBiz(prev => (prev ? { ...prev, logo: displayUrl } : prev));
      notifyBusinessDataChanged({ id: biz.id, action: "updated" });
      showToast("Logo updated.", true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Logo upload failed.", false);
    } finally {
      setLogoUploading(false);
      logoUploadingRef.current = false;
      input.value = "";
    }
  };

  const handleMarkComplete = async (id: string) => {
    try {
      setCompletingId(id);
      await updateRequestStatus(id, { status: "completed" });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: "completed" } : r));
      showToast("Marked as completed.", true);
    } catch (err) {
      showToast("Failed to update status.", false);
    } finally {
      setCompletingId(null);
    }
  };

  const handleSave = async () => {
    if (!biz) return;
    setESaving(true);
    try {
      const updated = await updateBusiness(biz.id, {
        name: eName, tagline: eTagline, description: eDesc,
        contact_phone: ePhone, contact_email: eEmail,
        website_url: eWeb || null, facebook_url: eFB || null, telegram_url: eTG || null,
        open_for_collaboration: eCollab, open_for_investment: eInvest, notify_by_email: eNotify,
      } as any);
      setBiz(updated);
      notifyBusinessDataChanged({ id: updated.id, action: "updated" });
      showToast("Profile saved.", true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Save failed.", false);
    } finally {
      setESaving(false);
    }
  };

  const handleChangePw = async () => {
    const cur = curPw.trim();
    const neu = newPw.trim();
    const conf = confPw.trim();
    if (!cur) { showToast("Enter current password.", false); return; }
    if (!neu) { showToast("Enter a new password.", false); return; }
    if (neu === cur) { showToast("New password must be different.", false); return; }
    if (neu.length < 8) { showToast("Password must be at least 8 characters.", false); return; }
    if (neu !== conf) { showToast("Passwords do not match.", false); return; }
    setPwSaving(true);
    try {
      await verifyCurrentPasswordAndSetNew(cur, neu);
      showToast("Password changed successfully.", true);
      setCurPw(""); setNewPw(""); setConfPw("");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed.", false);
    } finally {
      setPwSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm.trim().toUpperCase() !== "DELETE") {
      showToast('Type "DELETE" to confirm account deletion.', false);
      return;
    }
    if (!deletePw.trim()) {
      showToast("Enter your password to confirm deletion.", false);
      return;
    }
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) throw new Error("Not authenticated.");
      const { error: siErr } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: deletePw,
      });
      if (siErr) throw new Error("Incorrect password. Account not deleted.");

      await deleteAccount();
      await logoutAndRefresh("/");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed. Contact support.", false);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!biz) return null;

  const verBadge = businessVerificationBadge(biz);
  const vs = String(biz.verificationStatus ?? "pending");
  const isApproved = biz.verified || vs === "verified" || vs === "approved";

  const buyReqs    = requests.filter(r => r.purpose === "buy").length;
  const collabReqs = requests.filter(r => r.purpose === "collaborate").length;
  const investReqs = requests.filter(r => r.purpose === "invest").length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {toast && <Toast msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />}

      <div
        className={cn(
          "mb-6 rounded-2xl border p-4 sm:p-5 flex gap-3 sm:gap-4",
          isApproved && "border-brand-200 bg-brand-50/80",
          vs === "pending" && "border-amber-200 bg-amber-50/90",
          vs === "rejected" && "border-red-200 bg-red-50/90",
          vs === "revoked" && "border-stone-300 bg-stone-50"
        )}
      >
        <div className="shrink-0 mt-0.5">
          {isApproved ? (
            <CheckCircle className="w-5 h-5 text-brand-600" />
          ) : vs === "pending" ? (
            <Clock className="w-5 h-5 text-amber-600" />
          ) : (
            <AlertCircle className={cn("w-5 h-5", vs === "rejected" ? "text-red-600" : "text-stone-600")} />
          )}
        </div>
        <div className="min-w-0 text-sm">
          {isApproved && (
            <>
              <p className="font-semibold text-ink mb-1">Business account approved</p>
              <p className="text-ink-muted leading-relaxed">
                Your business is verified and visible in Explore Suppliers. Keep your profile updated to attract more buyers.
              </p>
            </>
          )}
          {vs === "pending" && (
            <>
              <p className="font-semibold text-ink mb-1">Pending admin approval</p>
              <p className="text-ink-muted leading-relaxed">
                Your listing is under review. You can use your dashboard, edit your profile and eco score, and reply to messages;
                once an admin approves your business, it will appear in Explore Suppliers.
              </p>
            </>
          )}
          {vs === "rejected" && (
            <>
              <p className="font-semibold text-ink mb-1">Registration not approved</p>
              <p className="text-ink-muted leading-relaxed">
                Your listing is not shown publicly—the same edits as while pending apply: use Overview below to update your logo, description, eco score, and contact info, then submit for admin review when ready.
              </p>
              {biz.rejectionReason ? (
                <p className="mt-2 text-ink text-xs rounded-lg bg-white/80 border border-red-100 px-3 py-2">
                  <span className="font-medium text-ink">Reason: </span>
                  {biz.rejectionReason}
                </p>
              ) : null}
            </>
          )}
          {vs === "revoked" && (
            <>
              <p className="font-semibold text-ink mb-1">Listing unpublished</p>
              <p className="text-ink-muted leading-relaxed">
                Your listing is not shown in Explore right now—you can still edit your profile and eco score on this dashboard (same as when pending approval), then use “Submit for admin review” when you want reconsideration.
              </p>
              {biz.rejectionReason ? (
                <p className="mt-2 text-ink text-xs rounded-lg bg-white/80 border border-stone-200 px-3 py-2">
                  <span className="font-medium text-ink">Note: </span>
                  {biz.rejectionReason}
                </p>
              ) : null}
            </>
          )}
          {(vs === "rejected" || vs === "revoked") && (
            <button
              type="button"
              onClick={handleResubmitForReview}
              disabled={resubmitReviewLoading}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {resubmitReviewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {resubmitReviewLoading ? "Submitting…" : "Submit for admin review"}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-8">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-52 shrink-0">
          <div className="flex items-center gap-3 mb-6 px-3">
            <div className="w-10 h-10 rounded-xl bg-surface-100 overflow-hidden shrink-0 border border-surface-200">
              <BusinessMedia fit="avatar" src={logoUrl} alt="" name={eName} className="h-full w-full rounded-xl" avatarTextClassName="text-sm" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-ink text-sm truncate">{eName}</p>
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border", verBadge.className)}>
                {verBadge.label}
              </span>
            </div>
          </div>
          <nav className="space-y-0.5">
            {nav.map(item => {
              const Icon = item.icon;
              const isMsg = item.id === "messages";
              return (
                <button key={item.id} onClick={() => setTab(item.id)}
                  className={cn("w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                    tab === item.id ? "bg-brand-50 text-brand-700" : "text-ink-muted hover:bg-surface-50 hover:text-ink")}>
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </div>
                  {isMsg && unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Mobile tabs */}
        <div className="md:hidden w-full">
          <div className="flex gap-1 pb-2 mb-6 overflow-x-auto scrollbar-none">
            {nav.map(item => {
              const Icon = item.icon;
              const isMsg = item.id === "messages";
              return (
                <button key={item.id} onClick={() => setTab(item.id)}
                  className={cn("relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors shrink-0",
                    tab === item.id ? "bg-brand-600 text-white" : "bg-surface-100 text-ink-muted")}>
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                  {isMsg && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full text-[8px] flex items-center justify-center text-white font-bold">
                      {unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <main className="flex-1 min-w-0">
          {tab === "overview" && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl text-ink mb-1">Business Overview</h1>
                <p className="text-sm text-ink-muted">Your activity and profile at a glance.</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Buy Requests",   count: buyReqs,    icon: ShoppingCart, color: "bg-brand-50 text-brand-600" },
                  { label: "Collaborations", count: collabReqs, icon: Handshake,    color: "bg-blue-50 text-blue-600" },
                  { label: "Investments",    count: investReqs, icon: TrendingUp,   color: "bg-purple-50 text-purple-600" },
                ].map(s => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="bg-white rounded-2xl border border-surface-200 shadow-soft p-4 text-center">
                      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2", s.color)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <p className="text-2xl font-display text-ink">{s.count}</p>
                      <p className="text-xs text-ink-faint">{s.label}</p>
                    </div>
                  );
                })}
              </div>

              <div className="bg-white rounded-2xl border border-surface-200 shadow-soft p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-ink">Recent Activity</h3>
                  <button onClick={() => setTab("messages")} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" /> Open Messages
                  </button>
                </div>
                {requests.length === 0 ? (
                  <p className="text-sm text-ink-muted text-center py-6">
                    No requests yet. Make sure your profile is complete so buyers can find you.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {requests.slice(0, 5).map(req => (
                      <div key={req.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-50 gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{req.product}</p>
                          <p className="text-xs text-ink-faint">
                            {req.buyerName ?? "Buyer"}{req.buyerEmail ? ` • ${req.buyerEmail}` : ""} • {formatDate(req.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", purposeColor(req.purpose))}>
                            {req.purpose}
                          </span>
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", statusBadge(req.status))}>
                            {req.status}
                          </span>
                          {req.conversationId && (
                            <button onClick={() => {
                              setTab("messages");
                              router.push(`?tab=messages&conv=${req.conversationId}`);
                            }}
                              className="text-xs text-brand-600 hover:underline flex items-center gap-0.5">
                              <MessageCircle className="w-3 h-3" /> Reply
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-surface-200 shadow-soft overflow-hidden">
                <button type="button" onClick={() => setShowProfile(p => !p)}
                  className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-ink hover:bg-surface-50 transition-colors">
                  <span>Edit Business Profile</span>
                  <span className="text-ink-faint">{showProfile ? "▲" : "▼"}</span>
                </button>
                {showProfile && (
                  <div className="px-5 pb-5 space-y-4 border-t border-surface-100">
                    <div className="flex items-center gap-4 pt-4">
                      <div className="relative shrink-0">
                        <div className="w-16 h-16 rounded-2xl bg-surface-100 overflow-hidden border border-surface-200">
                          <BusinessMedia
                            fit="avatar"
                            src={logoUrl}
                            alt=""
                            name={eName}
                            className="h-full w-full rounded-2xl"
                            avatarTextClassName="text-2xl"
                          />
                        </div>
                        <button onClick={() => logoRef.current?.click()} disabled={logoUploading}
                          className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center text-white shadow hover:bg-brand-700 transition-colors disabled:opacity-50">
                          {logoUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                        </button>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink">Business Logo</p>
                        <button onClick={() => logoRef.current?.click()} className="text-xs text-brand-600 hover:underline mt-0.5">Change logo</button>
                      </div>
                      <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </div>

                    <BizProfileField label="Business Name"><BizProfileTextInput value={eName} onChange={setEName} /></BizProfileField>
                    <BizProfileField label="Tagline"><BizProfileTextInput value={eTagline} onChange={setETagline} placeholder="Short description" /></BizProfileField>
                    <BizProfileField label="Description">
                      <textarea value={eDesc} onChange={e => setEDesc(e.target.value)} rows={4}
                        className="w-full px-3 py-2.5 rounded-xl border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
                    </BizProfileField>
                    <BizProfileField label="Contact Email"><BizProfileTextInput value={eEmail} onChange={setEEmail} type="email" icon={Mail} /></BizProfileField>
                    <BizProfileField label="Phone"><BizProfileTextInput value={ePhone} onChange={setEPhone} type="tel" icon={Phone} placeholder="+855 12 000 000" /></BizProfileField>
                    <BizProfileField label="Website"><BizProfileTextInput value={eWeb} onChange={setEWeb} icon={Globe} placeholder="https://yourbusiness.com" /></BizProfileField>
                    <BizProfileField label="Facebook"><BizProfileTextInput value={eFB} onChange={setEFB} icon={Facebook} placeholder="https://facebook.com/yourpage" /></BizProfileField>
                    <BizProfileField label="Telegram"><BizProfileTextInput value={eTG} onChange={setETG} icon={Send} placeholder="https://t.me/yourusername" /></BizProfileField>
                    <div className="space-y-2 pt-1">
                      <BizProfileToggle checked={eCollab} onChange={setECollab} label="Open for Collaboration" />
                      <BizProfileToggle checked={eInvest} onChange={setEInvest} label="Open for Investment" />
                      <BizProfileToggle checked={eNotify} onChange={setENotify} label="Email notifications for new messages" />
                    </div>
                    <button type="button" onClick={handleSave} disabled={eSaving}
                      className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors">
                      {eSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                      {eSaving ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs text-ink-faint mb-3 flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" /> How buyers see your listing in Explore Suppliers
                </p>
                <SupplierCard biz={biz} />
              </div>

              <div className="bg-white rounded-2xl border border-surface-200 shadow-soft p-5">
                <h3 className="font-semibold text-ink mb-1">Eco Score</h3>
                <p className="text-xs text-ink-muted mb-4">Improve your sustainability score to rank higher in search results.</p>
                <EcoScoreQuestionnaire
                  businessId={biz.id}
                  initialBreakdown={{
                    packaging: biz.ecoScore.breakdown.packaging ?? 0,
                    sourcing:  biz.ecoScore.breakdown.sourcing  ?? 0,
                    energy:    biz.ecoScore.breakdown.energy    ?? 0,
                    waste:     biz.ecoScore.breakdown.waste     ?? 0,
                    delivery:  biz.ecoScore.breakdown.delivery  ?? 0,
                    practices: biz.ecoScore.breakdown.practices ?? 0,
                  }}
                  onSaved={(updated) => {
                    setBiz(updated);
                    notifyBusinessDataChanged({ id: updated.id, action: "updated" });
                  }}
                />
              </div>
            </div>
          )}

          {tab === "messages" && (
            <div className="space-y-4">
              <h2 className="font-display text-2xl text-ink">Messages</h2>
              <div className="bg-white rounded-2xl border border-surface-200 shadow-soft overflow-hidden" style={{ height: "72vh" }}>
                <MessagingInbox role="business" initialConvId={initConv} />
              </div>
            </div>
          )}

          {tab === "settings" && (
            <div className="space-y-6 max-w-lg">
              <h2 className="font-display text-2xl text-ink">Account Settings</h2>
              <div className="bg-white rounded-2xl border border-surface-200 shadow-soft p-5 space-y-4">
                <h3 className="font-semibold text-ink text-sm">Change Password</h3>
                {[
                  { label: "Current Password", val: curPw,  set: setCurPw },
                  { label: "New Password",      val: newPw,  set: setNewPw },
                  { label: "Confirm Password",  val: confPw, set: setConfPw },
                ].map(f => (
                  <div key={f.label}>
                    <label className="block text-xs font-semibold text-ink mb-1.5">{f.label}</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
                      <input type={showPw ? "text" : "password"} value={f.val} onChange={e => f.set(e.target.value)}
                        autoComplete={f.label === "Current Password" ? "current-password" : "new-password"}
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      <button type="button" onClick={() => setShowPw(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink">
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={handleChangePw} disabled={pwSaving || !curPw.trim() || !newPw.trim() || !confPw.trim()}
                  className="flex items-center gap-2 bg-surface-100 hover:bg-surface-200 disabled:opacity-50 text-ink font-semibold px-5 py-2.5 rounded-xl text-sm border border-surface-200 transition-colors">
                  {pwSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {pwSaving ? "Changing…" : "Change Password"}
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-red-100 shadow-soft p-5 space-y-4">
                <h3 className="font-semibold text-red-700 text-sm">Delete Account</h3>
                <p className="text-xs text-ink-muted">
                  Permanently delete your business account and all associated data. This action cannot be undone.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">Current Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
                    <input
                      type="password"
                      value={deletePw}
                      onChange={(e) => setDeletePw(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                      placeholder="Enter password to confirm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">Type DELETE to confirm</label>
                  <input
                    type="text"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    placeholder="DELETE"
                  />
                </div>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting || !deletePw || deleteConfirm.trim().toUpperCase() !== "DELETE"}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium border border-red-200 transition-colors disabled:opacity-50"
                >
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

export default function BusinessDashboardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-600" /></div>}>
      <BusinessDashboardInner />
    </Suspense>
  );
}