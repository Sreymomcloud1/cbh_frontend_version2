"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { resolveDashboardPath } from "@/lib/auth-routing";
import { Loader2, Lock, Eye, EyeOff, CheckCircle, Leaf } from "lucide-react";

function ResetContent() {
  const router = useRouter();
  const [ready,   setReady]   = useState(false);
  const [newPw,   setNewPw]   = useState("");
  const [confPw,  setConfPw]  = useState("");
  const [showPw,  setShowPw]  = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    let mounted = true;
    const safeSetReady = (value: boolean) => { if (mounted) setReady(value); };
    const safeSetError = (value: string) => { if (mounted) setError(value); };

    const bootstrap = async () => {
      try {
        const query = new URLSearchParams(window.location.search);
        const code = query.get("code");
        if (code) {
          await supabase.auth.exchangeCodeForSession(code).catch(() => null);
        }

        const { data: { session } } = await supabase.auth.getSession();
        const hash = window.location.hash || "";
        const likelyRecoveryLink = hash.includes("type=recovery") || hash.includes("access_token");
        if (session || likelyRecoveryLink) {
          safeSetReady(true);
          return;
        }
      } catch {
        // continue to error fallback
      }

      safeSetError("Reset link is invalid or expired. Please request a new reset email.");
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (!!session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED"))) {
        safeSetReady(true);
      }
    });

    bootstrap();
    const timeout = setTimeout(() => {
      if (!ready) safeSetError("Reset link is invalid or expired. Please request a new reset email.");
    }, 7000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    setError("");
    if (newPw.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (newPw !== confPw)  { setError("Passwords do not match."); return; }
    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password: newPw });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setDone(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, pending_business")
        .eq("id", session.user.id)
        .maybeSingle();
      const destination = resolveDashboardPath(
        profile as { role?: string; pending_business?: boolean } | null,
        (session.user.user_metadata?.intended_role as "buyer" | "business" | undefined) ?? null
      );
      setTimeout(() => router.replace(destination), 1500);
    } else {
      setTimeout(() => router.replace("/auth/login"), 1500);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-surface-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-600 mb-4">
            <Leaf className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-display text-2xl text-ink">Set New Password</h1>
          <p className="text-sm text-ink-muted mt-1">Enter and confirm your new password.</p>
        </div>
        <div className="bg-white rounded-2xl border border-surface-200 shadow-soft p-6 space-y-4">
          {done ? (
            <div className="text-center py-4">
              <CheckCircle className="w-10 h-10 text-brand-600 mx-auto mb-3" />
              <p className="font-semibold text-ink">Password updated!</p>
              <p className="text-sm text-ink-muted mt-1">Redirecting…</p>
            </div>
          ) : !ready ? (
            <div className="text-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-brand-600 mx-auto mb-2" />
              <p className="text-sm text-ink-muted">Verifying reset link…</p>
              {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
              {error && (
                <button
                  onClick={() => router.replace("/auth/forgot-password")}
                  className="mt-3 text-sm text-brand-600 hover:underline"
                >
                  Request a new reset link
                </button>
              )}
            </div>
          ) : (
            <>
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}
              {[
                { label: "New Password",     val: newPw,  set: setNewPw  },
                { label: "Confirm Password", val: confPw, set: setConfPw },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-xs font-semibold text-ink mb-1.5">{f.label}</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
                    <input type={showPw ? "text" : "password"} value={f.val}
                      onChange={e => f.set(e.target.value)} autoComplete="new-password"
                      placeholder="Min. 8 characters"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    <button type="button" onClick={() => setShowPw(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={handleSubmit} disabled={saving || !newPw || !confPw}
                className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? "Saving…" : "Set New Password"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-600" /></div>}>
      <ResetContent />
    </Suspense>
  );
}