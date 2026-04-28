"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, Leaf } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { resolveDashboardPath, resolveSafeRedirect } from "@/lib/auth-routing";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");

  const redirectParam = searchParams.get("redirect");
  const safeRedirect = resolveSafeRedirect(redirectParam);

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError("");
  setHint("");

  if (!email || !password) {
    setError("Please fill in all fields.");
    return;
  }

  setLoading(true);

  // ✅ STEP 1: Check if email exists in DB
  const { data: existingUser, error: checkError } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (checkError) {
    setLoading(false);
    setError("Error checking account. Please try again.");
    return;
  }

  if (!existingUser) {
    setLoading(false);
    setError("This email is not registered.");
    setHint("Please sign up before logging in.");
    return;
  }

  // ✅ STEP 2: Proceed with login
  const { data, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !data?.session) {
    setLoading(false);
    const msg = authError?.message ?? "";

    if (msg.includes("Email not confirmed")) {
      setError("Your email is not yet verified.");
      setHint("Check your inbox for the verification link.");
    } else {
      setError("Incorrect password.");
      setHint("Try again or reset your password.");
    }
    return;
  }

  const user = data.user;

  if (!user) {
    setLoading(false);
    setError("User not found after login.");
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, pending_business")
    .eq("id", user.id)
    .single();

  setLoading(false);

  if (profileError) {
    setError("Failed to load user profile.");
    return;
  }

  const destination = resolveDashboardPath(
    profile as { role?: string; pending_business?: boolean } | null,
    (user.user_metadata?.intended_role as "buyer" | "business" | undefined) ?? null
  );

  router.refresh();

  if (safeRedirect) {
    router.push(safeRedirect);
  } else {
    router.push(destination);
  }
};

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-surface-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-600 mb-4">
            <Leaf className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-display text-2xl text-ink">Welcome back</h1>
          <p className="text-sm text-ink-muted mt-1">Sign in to your CBH account</p>
        </div>

        <div className="bg-white rounded-2xl border border-surface-200 shadow-soft p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-red-700 text-sm font-medium">{error}</p>
              {hint && <p className="text-red-600 text-xs mt-1">{hint}</p>}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              autoComplete="email"
            />
            <div className="relative">
              <Input
                label="Password"
                type={showPw ? "text" : "password"}
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((p) => !p)}
                className="absolute right-3 top-8 text-ink-faint hover:text-ink"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex justify-end mt-2">
              <button
                type="button"
                className="text-xs text-brand-600 hover:underline"
                onClick={async () => {
                  if (!email) {
                    setError("Enter your email first, then click Forgot password.");
                    return;
                  }

                  const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/auth/reset-password`,
                  });

                  if (error) {
                    setError(error.message);
                  } else {
                    setError("");
                    setHint(`Password reset email sent to ${email}. Check your inbox.`);
                  }
                }}
              >
                Forgot password?
              </button>
            </div>

            <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
              Sign in
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-ink-muted mt-5">
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" className="text-brand-600 font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-surface-50">
          <div className="w-full max-w-sm text-center text-sm text-ink-muted">Loading sign in...</div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}