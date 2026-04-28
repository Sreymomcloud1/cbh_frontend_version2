"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, Leaf, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { resolveDashboardPath } from "@/lib/auth-routing";
import Button from "@/components/ui/Button";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [resendEmail, setResendEmail] = useState("");
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [destination, setDestination] = useState("/dashboard");

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => {
    let redirected = false;
    let errorTimer: ReturnType<typeof setTimeout> | null = null;

    const processSession = async (session: { user: { id: string; user_metadata?: { intended_role?: string } } } | null) => {
      if (!session || redirected) return;
      let nextDestination = "/dashboard";
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, pending_business")
          .eq("id", session.user.id)
          .maybeSingle();
        nextDestination = resolveDashboardPath(
          profile as { role?: string; pending_business?: boolean } | null,
          (session.user.user_metadata?.intended_role as "buyer" | "business" | undefined) ?? null
        );
      } catch {
        nextDestination = resolveDashboardPath(
          null,
          (session.user.user_metadata?.intended_role as "buyer" | "business" | undefined) ?? null
        );
      }

      setDestination(nextDestination);
      setStatus("success");
      redirected = true;
      setTimeout(() => router.replace(nextDestination), 1200);
    };

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange(async (event, session) => {
        if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") && session) {
          await processSession(session as { user: { id: string; user_metadata?: { intended_role?: string } } });
        }
      });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        await processSession(session as { user: { id: string; user_metadata?: { intended_role?: string } } });
      } else {
        const code = searchParams.get("code");
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && data.session) {
            await processSession(data.session as unknown as { user: { id: string; user_metadata?: { intended_role?: string } } });
            return;
          }
        }
        const emailFromUrl = searchParams.get("email") ?? "";
        if (emailFromUrl) setResendEmail(emailFromUrl);

        errorTimer = setTimeout(() => {
          setStatus(prev => prev === "loading" ? "error" : prev);
        }, 5000);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (errorTimer) clearTimeout(errorTimer);
    };
  }, [router, searchParams]);

  const handleResend = async () => {
    if (!resendEmail || resendCooldown > 0) return;
    setResendStatus("sending");

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/resend-verification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: resendEmail, type: "signup" }),
        }
      );

      if (!res.ok) throw new Error("Failed");

      setResendStatus("sent");
      setResendCooldown(60);
    } catch {
      setResendStatus("error");
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 bg-surface-50">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-600 mb-6">
          <Leaf className="w-6 h-6 text-white" />
        </div>

        {status === "loading" && (
          <>
            <Loader2 className="w-10 h-10 text-brand-500 animate-spin mx-auto mb-4" />
            <h2 className="font-display text-xl text-ink mb-2">
              Verifying your email...
            </h2>
            <p className="text-sm text-ink-muted">Please wait a moment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-brand-600" />
            </div>
            <h2 className="font-display text-2xl text-ink mb-2">
              Email Verified!
            </h2>
            <p className="text-sm text-ink-muted mb-6">
              Your account is active. Redirecting to your dashboard...
            </p>
            <Link href={destination}>
              <Button variant="primary" size="lg" className="w-full">
                Go to Dashboard
              </Button>
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="font-display text-2xl text-ink mb-2">
              Verification Failed
            </h2>
            <p className="text-sm text-ink-muted mb-6">
              The link may be invalid or expired. Enter your email to get a new one.
            </p>

            <div className="bg-white border border-surface-200 rounded-2xl p-4 mb-4 text-left">
              <label className="block text-xs font-medium text-ink mb-1">
                Your email address
              </label>
              <input
                type="email"
                value={resendEmail}
                onChange={e => setResendEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-surface-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />

              <Button
                variant="primary"
                size="sm"
                className="w-full"
                onClick={handleResend}
                disabled={!resendEmail || resendStatus === "sending" || resendCooldown > 0}
              >
                {resendStatus === "sending" ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Sending...
                  </span>
                ) : resendCooldown > 0 ? (
                  `Resend in ${resendCooldown}s`
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4" /> Resend Verification Email
                  </span>
                )}
              </Button>

              {resendStatus === "sent" && (
                <p className="text-xs text-brand-600 mt-2 text-center">
                  ✓ Sent! Check your inbox (and spam folder).
                </p>
              )}

              {resendStatus === "error" && (
                <p className="text-xs text-red-500 mt-2 text-center">
                  Failed to send. Please try again.
                </p>
              )}
            </div>

            <Link href="/auth/signup">
              <Button variant="ghost" size="sm" className="w-full">
                Create a new account instead
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}