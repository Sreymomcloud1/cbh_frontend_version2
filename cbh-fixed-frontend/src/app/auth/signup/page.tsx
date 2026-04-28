"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, User, Leaf, CheckCircle, Building2, Phone, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type Role = "buyer" | "business";
type Step = "role" | "form" | "verify";

const isValidEmail = (email: string) => {
  return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email.trim());
};
const isValidKhmerPhone = (phone: string) => {
  if (!phone) return true; // optional field
  return /^(?:\+855|0)(?:1\d|6\d|7\d|8\d|9\d)\d{7}$/.test(phone.replace(/\s+/g, ""));
};

const isStrongPassword = (password: string) => {
  return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/.test(password);
};

const roles = [
  { value: "buyer" as Role, label: "Sign up as Buyer", description: "Find and order from local suppliers", icon: "🛒", color: "border-brand-500 bg-brand-50" },
  { value: "business" as Role, label: "Sign up as Business", description: "List your business and receive orders", icon: "🏢", color: "border-blue-500 bg-blue-50" },
];

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("role");
  const [role, setRole] = useState<Role>("buyer");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [resendCooldown, setResendCooldown] = useState(0);

  // ADDED: Auto-redirect if user is already logged in or becomes logged in (e.g. via email link)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.push("/dashboard");
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name || !form.email || !form.password) {
  setError("Please fill in all required fields.");
  return;
}

if (!isValidEmail(form.email)) {
  setError("Please enter a valid email address.");
  return;
}

if (!isValidKhmerPhone(form.phone)) {
  setError("Please enter a valid Khmer phone number (e.g. 012345678 or +85512345678).");
  return;
}

if (!isStrongPassword(form.password)) {
  setError("Password must be at least 8 characters and include at least 1 letter and 1 number.");
  return;
}

    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            name: form.name,
            role: "buyer",
            intended_role: role,
            phone: form.phone || null,
          },
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/verify`,
        },
      });

      if (signUpError) {
        if (signUpError.message.toLowerCase().includes("already registered") ||
            signUpError.message.toLowerCase().includes("already exists")) {
          setError("This email is already registered. Please sign in instead.");
        } else {
          setError(signUpError.message);
        }
        return;
      }

      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setError("This email is already registered. Please sign in instead.");
        return;
      }

      setStep("verify");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (step === "verify") {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-surface-50">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8 text-brand-600" />
          </div>
          <h2 className="font-display text-2xl text-ink mb-2">Check your email</h2>
          <p className="text-sm text-ink-muted mb-2">
            We sent a verification link to <strong>{form.email}</strong>
          </p>
          <p className="text-xs text-ink-faint mb-6">Click the link to activate your account. After verification, the dashboard will open automatically.</p>
          <div className="bg-surface-100 rounded-2xl p-4 text-sm text-ink-muted mb-6 text-left space-y-1">
            <p className="font-medium text-ink text-xs uppercase tracking-wider mb-2">What happens next</p>
            <p>1. Check your inbox (and spam folder)</p>
            <p>2. Click the verification link</p>
            <p>3. You will be automatically redirected to your dashboard</p>
          </div>
          <Link href="/auth/login">
            <Button variant="outline" size="sm" className="w-full mb-3">Go to Login manually</Button>
          </Link>
          <button
            onClick={async () => {
              if (resendCooldown > 0 || resendStatus === "sending") return;
              setResendStatus("sending");
              try {
                const res = await fetch(`${API_URL}/auth/resend-verification`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: form.email, type: "signup" }),
                });
                if (!res.ok) throw new Error("Failed");
                setResendStatus("sent");
                setResendCooldown(60);
                const countdown = setInterval(() => {
                  setResendCooldown(c => { if (c <= 1) { clearInterval(countdown); return 0; } return c - 1; });
                }, 1000);
              } catch { setResendStatus("error"); }
            }}
            disabled={resendStatus === "sending" || resendCooldown > 0}
            className="w-full text-sm text-brand-600 hover:text-brand-700 disabled:opacity-50 flex items-center justify-center gap-1 py-1"
          >
            {resendStatus === "sending" ? (
              <><Loader2 className="w-3 h-3 animate-spin" /> Sending...</>
            ) : resendCooldown > 0 ? (
              `Resend in ${resendCooldown}s`
            ) : (
              <><RefreshCw className="w-3 h-3" /> Didn&apos;t receive it? Resend email</>
            )}
          </button>
        </div>
      </div>
    );
  }

  if (step === "role") {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-surface-50">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-600 mb-4"><Leaf className="w-6 h-6 text-white" /></div>
            <h1 className="font-display text-2xl text-ink">Join CBH</h1>
            <p className="text-sm text-ink-muted mt-1">How would you like to use the platform?</p>
          </div>
          <div className="grid grid-cols-1 gap-4 mb-6">
            {roles.map((r) => (
              <button key={r.value} onClick={() => setRole(r.value)}
                className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left ${role === r.value ? r.color : "border-surface-200 bg-white hover:border-surface-300"}`}>
                <span className="text-3xl">{r.icon}</span>
                <div><p className="font-semibold text-ink">{r.label}</p><p className="text-sm text-ink-muted">{r.description}</p></div>
              </button>
            ))}
          </div>
          <Button variant="primary" size="lg" className="w-full" onClick={() => setStep("form")}>
            Continue as {role === "buyer" ? "Buyer" : "Business"}
          </Button>
          <p className="text-center text-sm text-ink-muted mt-4">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-brand-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-surface-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-600 mb-4"><Leaf className="w-6 h-6 text-white" /></div>
          <div className="inline-flex items-center gap-2 bg-surface-100 rounded-full px-3 py-1 text-xs font-medium text-ink-muted mb-3">
            {role === "buyer" ? "🛒 Buyer" : "🏢 Business"} account
            <button onClick={() => setStep("role")} className="text-brand-600 hover:underline ml-1">Change</button>
          </div>
          <h1 className="font-display text-2xl text-ink">Create your account</h1>
        </div>

        <div className="bg-white rounded-2xl border border-surface-200 shadow-soft p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Full name" type="text" placeholder="Your name" value={form.name} onChange={(e) => set("name", e.target.value)} leftIcon={<User className="w-4 h-4" />} autoComplete="name" />
            <Input label="Email" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => set("email", e.target.value)} leftIcon={<Mail className="w-4 h-4" />} autoComplete="email" />
            <Input label="Phone (optional)" type="tel" placeholder="+855 12 000 000" value={form.phone} onChange={(e) => set("phone", e.target.value)} leftIcon={<Phone className="w-4 h-4" />} hint="Khmer or international number" />
            <Input label="Password" type="password" placeholder="Min. 8 characters" value={form.password} onChange={(e) => set("password", e.target.value)} leftIcon={<Lock className="w-4 h-4" />} hint="At least 8 characters" autoComplete="new-password" />
            {role === "business" && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                <Building2 className="w-4 h-4 inline mr-1" /> After verifying your email, complete your business profile from the dashboard.
              </div>
            )}
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>Create account</Button>
          </form>
          <p className="text-xs text-center text-ink-faint">
            By creating an account you agree to our <a href="#" className="text-brand-600 hover:underline">Terms</a> and <a href="#" className="text-brand-600 hover:underline">Privacy Policy</a>.
          </p>
        </div>
        <p className="text-center text-sm text-ink-muted mt-5">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-brand-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}