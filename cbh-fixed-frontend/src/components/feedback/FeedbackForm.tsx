"use client";
import { useState, useEffect } from "react";
import { CheckCircle, Star, Lock } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";
import { getProfile } from "@/lib/api";
import { onProfileUpdated } from "@/lib/data-events";
import Link from "next/link";

const topics = ["General", "Supplier Issue", "Request Problem", "Suggestion", "Partnership", "Other"];
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const SESSION_TIMEOUT_MS = 5000;

export default function FeedbackForm() {
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", topic: "", subject: "", message: "", rating: 0 });
  const [hoverRating, setHoverRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);

  const set = (key: string, value: string | number) => setForm((p) => ({ ...p, [key]: value }));

  // Keep feedback identity synced with profile/account data
  useEffect(() => {
    let mounted = true;
    const safeSet = (fn: () => void) => { if (mounted) fn(); };

    const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
      Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          setTimeout(() => reject(new Error("Session check timed out")), timeoutMs);
        }),
      ]);

    const init = async () => {
      try {
        const { data: { session } } = await withTimeout(
          supabase.auth.getSession(),
          SESSION_TIMEOUT_MS
        );
        if (!session) {
          safeSet(() => {
            setIsLoggedIn(false);
            setToken(null);
          });
          return;
        }

        safeSet(() => {
          setIsLoggedIn(true);
          setToken(session.access_token);
        });

        try {
          const profile = await getProfile();
          safeSet(() => {
            setForm((p) => ({
              ...p,
              name: profile.name || session.user.user_metadata?.name || "",
              email: profile.email || session.user.email || "",
            }));
          });
        } catch {
          safeSet(() => {
            setForm((p) => ({
              ...p,
              name: session.user.user_metadata?.name || p.name || "",
              email: session.user.email || p.email || "",
            }));
          });
        }
      } catch {
        safeSet(() => {
          setIsLoggedIn(false);
          setToken(null);
        });
      } finally {
        safeSet(() => setSessionChecked(true));
      }
    };

    init();

    return () => { mounted = false; };
  }, []);

  useEffect(() => onProfileUpdated((detail) => {
    if (!detail?.name && !detail?.avatarUrl) return;
    setForm((p) => ({
      ...p,
      name: detail.name ?? p.name,
    }));
  }), []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionChecked(true);
      if (!session?.user) {
        setIsLoggedIn(false);
        setToken(null);
        return;
      }
      setIsLoggedIn(true);
      setToken(session.access_token);
      setForm((p) => ({
        ...p,
        email: session.user.email || p.email || "",
      }));
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.topic || !form.message) {
      setError("Please fill in your name, email, topic, and message.");
      return;
    }
    if (!token) {
      setError("You must be signed in to send feedback.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Failed to send");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!sessionChecked) {
    return <div className="text-center py-12 text-sm text-ink-muted">Loading…</div>;
  }

  // Not logged in — show a friendly gate
  if (!isLoggedIn) {
    return (
      <div className="max-w-md mx-auto text-center py-12 px-4">
        <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-7 h-7 text-brand-600" />
        </div>
        <h3 className="font-display text-xl text-ink mb-2">Sign In to Send Feedback</h3>
        <p className="text-sm text-ink-muted mb-6">
          We ask you to sign in before sending feedback so we can follow up with you properly and prevent spam.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/auth/login?redirect=/feedback">
            <Button variant="primary" size="md">Sign In</Button>
          </Link>
          <Link href="/auth/signup">
            <Button variant="outline" size="md">Create Account</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="text-center py-12">
        <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-7 h-7 text-brand-600" />
        </div>
        <h3 className="font-display text-xl text-ink mb-2">Message Sent!</h3>
        <p className="text-sm text-ink-muted mb-4">Thank you for your feedback. We&apos;ll reply to <strong>{form.email}</strong> within 24 hours.</p>
        <Button variant="secondary" size="sm" onClick={() => { setSubmitted(false); setForm(p => ({ ...p, topic: "", subject: "", message: "", rating: 0 })); }}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      <div className="grid grid-cols-2 gap-4">
        {/* Name and email are pre-filled and locked since we're authenticated */}
        <Input label="Your Name" placeholder="Full name" value={form.name} onChange={(e) => set("name", e.target.value)} />
        <Input label="Email" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => set("email", e.target.value)} hint="Pre-filled from your account" />
      </div>

      <div>
        <p className="text-sm font-medium text-ink mb-2">Topic</p>
        <div className="flex flex-wrap gap-2">
          {topics.map((t) => (
            <button key={t} onClick={() => set("topic", t)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${form.topic === t ? "bg-brand-600 text-white" : "bg-surface-100 text-ink-muted hover:bg-surface-200"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <Input label="Subject" placeholder="Brief summary of your message" value={form.subject} onChange={(e) => set("subject", e.target.value)} />

      <div>
        <label className="text-sm font-medium text-ink block mb-1.5">Message</label>
        <textarea value={form.message} onChange={(e) => set("message", e.target.value)}
          placeholder="Share your feedback, question, or suggestion..."
          rows={4} className="w-full rounded-xl border border-surface-200 px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
      </div>

      <div>
        <p className="text-sm font-medium text-ink mb-2">Rate your experience with CBH (optional)</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)} onClick={() => set("rating", star)} className="transition-transform hover:scale-110">
              <Star className={`w-7 h-7 transition-colors ${star <= (hoverRating || form.rating) ? "fill-yellow-400 text-yellow-400" : "text-surface-200"}`} />
            </button>
          ))}
          {form.rating > 0 && <span className="ml-2 text-sm text-ink-muted self-center">{["", "Poor", "Fair", "Good", "Very Good", "Excellent"][form.rating]}</span>}
        </div>
      </div>

      <Button variant="primary" size="lg" className="w-full" loading={loading} onClick={handleSubmit}
        disabled={!form.name || !form.email || !form.topic || !form.message}>
        Send Message
      </Button>
    </div>
  );
}
