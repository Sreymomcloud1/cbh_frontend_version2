"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Loader2, Star } from "lucide-react";
import MessagingInbox from "@/components/messaging/MessagingInbox";
import { createReview } from "@/lib/api";
import { cn } from "@/lib/utils";

function ReviewModal({
  businessId,
  businessName,
  onDone,
  onSkip,
}: {
  businessId: string;
  businessName: string;
  onDone: () => void;
  onSkip: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      await createReview(businessId, {
        rating,
        comment: comment.trim() || undefined,
      });
      setDone(true);
      setTimeout(onDone, 1200);
    } catch {
      onDone();
    } finally {
      setSubmitting(false);
    }
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
            <div className="flex gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  className={cn(
                    "text-3xl transition-transform hover:scale-110 focus:outline-none",
                    n <= rating ? "opacity-100" : "opacity-25"
                  )}
                >
                  <Star className="w-7 h-7 fill-yellow-400 text-yellow-400" />
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional comment…"
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={onSkip}
                className="flex-1 py-2 rounded-xl border border-surface-200 text-ink-muted text-sm hover:bg-surface-50 transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleSubmit}
                disabled={rating === 0 || submitting}
                className="flex-1 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
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

export default function MessagesPage() {
  const [reviewModal, setReviewModal] = useState<{ bizId: string; bizName: string } | null>(null);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <h1 className="font-display text-3xl text-ink mb-1">Messages</h1>
        <p className="text-sm text-ink-muted">All your conversations with suppliers in one place.</p>
      </div>
      <MessagingInbox
        role="buyer"
        onConversationCompleted={(_convId, bizId, bizName) => {
          if (!bizId) return;
          setReviewModal({ bizId, bizName });
        }}
      />
      {reviewModal && (
        <ReviewModal
          businessId={reviewModal.bizId}
          businessName={reviewModal.bizName}
          onDone={() => setReviewModal(null)}
          onSkip={() => setReviewModal(null)}
        />
      )}
    </div>
  );
}
