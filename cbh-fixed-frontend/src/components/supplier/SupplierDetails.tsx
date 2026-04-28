"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MapPin, CheckCircle, Leaf, Package, Mail, Globe, Star,
  ChevronLeft, ExternalLink, Facebook, Send, Handshake, TrendingUp, ArrowLeft,
} from "lucide-react";
import type { Supplier, RequestPurpose } from "@/types";
import Button from "@/components/ui/Button";
import { ecoScoreBg, ecoScoreLabel, cn } from "@/lib/utils";
import RequestForm from "@/components/request/RequestForm";
import { supabase } from "@/lib/supabase";
import { getSavedBusinesses, toggleSaveBusiness } from "@/lib/api";
import { notifyBusinessDataChanged } from "@/lib/data-events";
import { Bookmark } from "lucide-react";

interface Review {
  id: string;
  rating: number;
  comment?: string;
  created_at: string;
  reviewer: { id: string; name: string; avatar_url?: string };
}

interface ReviewFormState { rating: number; comment: string; }

export default function SupplierDetails({ supplier }: { supplier: Supplier }) {
  const router = useRouter();
  const [activeImage, setActiveImage] = useState(0);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestPurpose, setRequestPurpose] = useState<RequestPurpose>("buy");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewForm, setReviewForm] = useState<ReviewFormState>({ rating: 0, comment: "" });
  const [canReview, setCanReview] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savingBiz, setSavingBiz] = useState(false);

  const isCompany = supplier.tier === "Company";
  const allowedPurposes: RequestPurpose[] = isCompany
    ? ["buy"]
    : supplier.collaboration.enabled && supplier.investment.enabled
      ? ["buy", "collaborate", "invest"]
      : supplier.collaboration.enabled ? ["buy", "collaborate"]
      : supplier.investment.enabled   ? ["buy", "invest"]
      : ["buy"];

  useEffect(() => {
    const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

    // Load reviews (public)
    fetch(`${BASE}/reviews/${supplier.id}`)
      .then(r => r.json())
      .then(j => setReviews(j.data ?? []))
      .catch(() => {});

    // Check auth and whether this user can review
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setIsLoggedIn(false); return; }
      setIsLoggedIn(true);
      setCurrentUserId(session.user.id);
      getSavedBusinesses()
        .then(rows => {
          const isSaved = rows.some(row =>
            (row as { business?: { id?: string } | null }).business?.id === supplier.id
          );
          setSaved(isSaved);
        })
        .catch(() => {});

      fetch(`${BASE}/requests?status=completed`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(r => r.json())
        .then(j => {
          const completed = (j.data?.requests ?? []) as Array<{ supplierId?: string; business_id?: string }>;
          const alreadyReviewed = reviews.some(r => r.reviewer.id === session.user.id);
          setCanReview(
            completed.some(r => (r.supplierId ?? r.business_id) === supplier.id) && !alreadyReviewed
          );
        })
        .catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplier.id]);

  // Handle "Request a Quote" button — show alert then redirect if not logged in
  const handleRequestClick = (purpose: RequestPurpose) => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        alert(
          "You need to sign in to send a request.\n\nYou'll be redirected to the login page. After signing in, come back to this supplier to send your request."
        );
        router.push(`/auth/login?redirect=/supplier/${supplier.id}`);
        return;
      }
      setRequestPurpose(purpose);
      setShowRequestForm(true);
    });
  };

  const handleReviewSubmit = async () => {
    if (reviewForm.rating === 0) { setReviewError("Please select a star rating."); return; }
    setReviewSubmitting(true); setReviewError("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setReviewError("Please sign in to leave a review."); setReviewSubmitting(false); return; }
    const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
    const res = await fetch(`${BASE}/reviews/${supplier.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(reviewForm),
    });
    const json = await res.json();
    if (!res.ok) { setReviewError(json?.error?.message ?? "Failed to submit review."); setReviewSubmitting(false); return; }
    setReviewSuccess(true); setCanReview(false);
    setReviews(prev => [{ ...json.data, reviewer: { id: session.user.id, name: session.user.user_metadata?.name ?? "You" } }, ...prev]);
    setReviewSubmitting(false);
  };

  const ecoNarrative = (supplier as unknown as Record<string, unknown>).ecoDescription as string | undefined;
  const ecoScore = supplier.ecoScore.overall;

  if (showRequestForm) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <button onClick={() => setShowRequestForm(false)}
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to {supplier.name}
        </button>
        <div className="mb-8">
          <h1 className="font-display text-3xl text-ink mb-2">Send a Request</h1>
          <p className="text-ink-muted">You are requesting from <strong>{supplier.name}</strong></p>
        </div>
        <RequestForm
          defaultSupplierId={supplier.id}
          defaultSupplierName={supplier.name}
          defaultPurpose={requestPurpose}
          supplierServices={supplier.services}
          allowedPurposes={allowedPurposes}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <Link href="/explore" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to explore
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          {/* Gallery */}
          <div className="space-y-3">
            <div className="rounded-2xl overflow-hidden h-72 sm:h-96 bg-surface-100">
              <img src={supplier.gallery[activeImage] || supplier.logo} alt={supplier.name} className="w-full h-full object-cover" />
            </div>
            {supplier.gallery.length > 1 && (
              <div className="flex gap-2">
                {supplier.gallery.map((img, i) => (
                  <button key={i} onClick={() => setActiveImage(i)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${activeImage === i ? "border-brand-500" : "border-transparent opacity-60 hover:opacity-100"}`}>
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
          

          {/* Header */}
          <div className="flex items-start gap-4">
            <img src={supplier.logo} alt={supplier.name} className="w-14 h-14 rounded-2xl border border-surface-200 object-cover shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-2xl text-ink">{supplier.name}</h1>
                {supplier.verified && (
                  <span className="flex items-center gap-1 text-xs font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                    <CheckCircle className="w-3 h-3" /> Verified
                  </span>
                )}
                <span className="text-xs text-ink-faint bg-surface-100 px-2 py-0.5 rounded-full">{supplier.tier}</span>
                <button
  onClick={async () => {
    if (!isLoggedIn) {
      router.push("/auth/login");
      return;
    }

    setSavingBiz(true);
    try {
      const result = await toggleSaveBusiness(supplier.id);
      setSaved(result.saved);
      notifyBusinessDataChanged({ id: supplier.id, action: "updated" });
    } finally {
      setSavingBiz(false);
    }
  }}
  disabled={savingBiz}
  className={cn(
    "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors",
    saved
      ? "bg-brand-50 border-brand-300 text-brand-600"
      : "bg-white border-surface-200 text-ink-muted hover:border-brand-300"
  )}
>
  <Bookmark className={cn("w-3.5 h-3.5", saved && "fill-brand-600")} />
  {savingBiz ? "Saving..." : saved ? "Saved" : "Save"}
</button>

              </div>
              <p className="text-ink-muted mt-1">{supplier.tagline}</p>
              <div className="flex items-center flex-wrap gap-3 mt-2 text-sm">
                <span className="flex items-center gap-1 text-ink-faint">
                  <MapPin className="w-3.5 h-3.5" />
                  {supplier.locationDetail || supplier.location}
                  {supplier.mapUrl && (
                    <a href={supplier.mapUrl} target="_blank" rel="noopener noreferrer"
                      className="text-brand-600 hover:underline ml-1 flex items-center gap-0.5 text-xs">
                      View map <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </span>
                <span className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium text-ink">{Number(supplier.rating).toFixed(1)}</span>
                  <span className="text-ink-faint">({supplier.reviewCount} reviews)</span>
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <h2 className="font-semibold text-ink mb-2">About</h2>
            <p className="text-sm text-ink-muted leading-relaxed">{supplier.description}</p>
          </div>

          {/* Services */}
          <div>
            <h2 className="font-semibold text-ink mb-3">Services & Products</h2>
            <div className="flex flex-wrap gap-2">
              {supplier.services.map((svc) => (
                <span key={svc} className="px-3 py-1.5 bg-surface-100 text-ink text-sm rounded-xl">{svc}</span>
              ))}
            </div>
          </div>

          {/* Eco Score — show total score + unique narrative only, no breakdown grid */}
          <div className="bg-white rounded-2xl border border-surface-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={cn("px-3 py-1.5 rounded-xl text-sm font-semibold flex items-center gap-1.5", ecoScoreBg(ecoScore))}>
                <Leaf className="w-4 h-4" />
                Eco Score: {ecoScore}/100 — {ecoScoreLabel(ecoScore).label}
              </div>
            </div>
            {/* Unique narrative — why this business is eco-friendly and how they earned their score */}
            <p className="text-sm text-ink-muted leading-relaxed">
              {ecoNarrative
                ? ecoNarrative
                : ecoScore >= 71
                  ? `${supplier.name} earned their high eco score through a combination of sustainable packaging choices, locally-sourced ingredients that reduce food miles, and energy-efficient operations. Their commitment to minimal waste and responsible disposal practices makes them one of the more environmentally responsible suppliers on the platform.`
                  : ecoScore >= 41
                    ? `${supplier.name} has taken meaningful steps toward sustainability, including using recycled packaging materials and partnering with local suppliers where possible. While there is still room to grow, they are actively improving their environmental footprint.`
                    : `${supplier.name} is beginning their sustainability journey. They are currently working on reducing single-use packaging and exploring local sourcing options to lower their environmental impact over time.`}
            </p>
          </div>

          {/* Collaboration & Investment — NOT for Company tier */}
          {!isCompany && (supplier.collaboration.enabled || supplier.investment.enabled) && (
            <div className="space-y-3">
              {supplier.collaboration.enabled && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Handshake className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold text-blue-800 text-sm">Open for Collaboration</span>
                  </div>
                  <p className="text-xs text-blue-700">{supplier.collaboration.description || `${supplier.name} is looking for ${supplier.collaboration.lookingFor.join(", ")} partners.`}</p>
                </div>
              )}
              {supplier.investment.enabled && (
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-purple-600" />
                    <span className="font-semibold text-purple-800 text-sm">Open for Investment{supplier.investment.amount ? ` · ${supplier.investment.amount}` : ""}</span>
                  </div>
                  <p className="text-xs text-purple-700">{supplier.investment.description || "Seeking investment partners."}</p>
                </div>
              )}
            </div>
          )}

          {/* Reviews */}
          <div>
            <h2 className="font-semibold text-ink mb-4">
              Reviews {reviews.length > 0 ? `(${reviews.length})` : ""}
            </h2>

            {/* Review form — only for eligible buyers with a completed request */}
            {canReview && !reviewSuccess && (
              <div className="bg-surface-50 rounded-2xl border border-surface-200 p-4 mb-4">
                <p className="text-sm font-semibold text-ink mb-3">Leave a Review</p>
                <div className="flex gap-1 mb-3">
                  {[1,2,3,4,5].map((star) => (
                    <button key={star} onClick={() => setReviewForm(p => ({ ...p, rating: star }))}>
                      <Star className={cn("w-7 h-7 transition-colors", star <= reviewForm.rating ? "fill-yellow-400 text-yellow-400" : "text-surface-300")} />
                    </button>
                  ))}
                </div>
                <textarea value={reviewForm.comment} onChange={(e) => setReviewForm(p => ({ ...p, comment: e.target.value }))}
                  placeholder="Share your experience..." rows={3}
                  className="w-full rounded-xl border border-surface-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 mb-3" />
                {reviewError && <p className="text-xs text-red-500 mb-2">{reviewError}</p>}
                <Button variant="primary" size="sm" loading={reviewSubmitting} onClick={handleReviewSubmit}>Submit Review</Button>
              </div>
            )}

            {reviewSuccess && <p className="text-sm text-brand-600 mb-4">✅ Review submitted — thank you!</p>}

            {reviews.length === 0 ? (
              <div className="bg-surface-50 rounded-2xl border border-surface-200 p-6 text-center">
                {/* Empty stars to signal this is a reviewable product */}
                <div className="flex justify-center gap-1 mb-3">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} className="w-6 h-6 text-surface-300" />
                  ))}
                </div>
                <p className="text-sm font-medium text-ink mb-1">No reviews yet</p>
                {!isLoggedIn ? (
                  <p className="text-sm text-ink-muted">
                    <Link href="/auth/login" className="text-brand-600 hover:underline font-medium">Sign in</Link> and complete a purchase to be the first to review.
                  </p>
                ) : canReview ? (
                  <p className="text-sm text-ink-muted">You can review this supplier — use the form above!</p>
                ) : (
                  <p className="text-sm text-ink-muted">Only buyers who have completed a purchase from this supplier can leave a review.</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((r) => (
                  <div key={r.id} className="bg-white rounded-2xl border border-surface-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold">
                        {r.reviewer.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink">{r.reviewer.name}</p>
                        <div className="flex">
                          {[1,2,3,4,5].map(s => <Star key={s} className={cn("w-3.5 h-3.5", s <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-surface-200")} />)}
                        </div>
                      </div>
                    </div>
                    {r.comment && <p className="text-sm text-ink-muted">{r.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Request buttons */}
          <div className="bg-white rounded-2xl border border-surface-200 shadow-soft p-5 space-y-3">
            <Button variant="primary" size="lg" className="w-full gap-2" onClick={() => handleRequestClick("buy")}>
              <Package className="w-4 h-4" /> Request a Quote
            </Button>
            {!isCompany && supplier.collaboration.enabled && (
              <Button variant="outline" size="md" className="w-full gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={() => handleRequestClick("collaborate")}>
                <Handshake className="w-4 h-4" /> Collaborate
              </Button>
            )}
            {!isCompany && supplier.investment.enabled && (
              <Button variant="outline" size="md" className="w-full gap-2 border-purple-300 text-purple-700 hover:bg-purple-50"
                onClick={() => handleRequestClick("invest")}>
                <TrendingUp className="w-4 h-4" /> Invest
              </Button>
            )}
          </div>

          {/* Contact — email opens pre-composed mailto */}
          <div className="bg-white rounded-2xl border border-surface-200 p-5 space-y-3">
            <h3 className="font-semibold text-ink text-sm">Contact</h3>
            {/* mailto link pre-fills the To field and includes a helpful subject */}
            <a
              href={`mailto:${supplier.contactEmail}?subject=Enquiry from CBH — ${encodeURIComponent(supplier.name)}&body=Hi ${encodeURIComponent(supplier.name)},%0A%0AI found your listing on CBH and would like to get in touch.%0A%0A`}
              className="flex items-center gap-2 text-sm text-ink-muted hover:text-brand-600 transition-colors"
            >
              <Mail className="w-4 h-4 shrink-0 text-brand-500" /> {supplier.contactEmail}
            </a>
            {supplier.telegramUrl && (
              <a href={supplier.telegramUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-ink-muted hover:text-brand-600 transition-colors">
                <Send className="w-4 h-4 shrink-0 text-brand-500" /> Chat on Telegram
              </a>
            )}
            {supplier.website && (
              <a href={supplier.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-brand-600 hover:underline">
                <Globe className="w-4 h-4 shrink-0" /> Website
              </a>
            )}
            {supplier.facebookUrl && (
              <a href={supplier.facebookUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-ink-muted hover:text-brand-600 transition-colors">
                <Facebook className="w-4 h-4 shrink-0" /> Facebook
              </a>
            )}
          </div>

          {/* Details */}
          <div className="bg-white rounded-2xl border border-surface-200 p-5 space-y-2 text-sm">
            <h3 className="font-semibold text-ink text-sm mb-3">Details</h3>
            {supplier.bulkSupport && (
              <div className="flex items-center gap-2 text-ink-muted">
                <Package className="w-4 h-4 text-brand-500 shrink-0" />
                Bulk: {supplier.bulkCapacity || "Available"}
              </div>
            )}
            {supplier.discountPercent && (
              <div className="text-brand-600 font-medium">{supplier.discountPercent}% discount available</div>
            )}
            {supplier.foundedYear && <div className="text-ink-faint">Est. {supplier.foundedYear}</div>}
           {(supplier as any).taxId && (
  <div className="text-ink-faint text-xs">
    Tax ID: {(supplier as any).taxId}
  </div>
)}
            {supplier.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {supplier.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 bg-surface-100 text-ink-faint rounded-full text-xs">#{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
