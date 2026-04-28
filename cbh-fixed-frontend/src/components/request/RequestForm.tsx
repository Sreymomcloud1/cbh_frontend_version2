"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ChevronDown } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import type { RequestPurpose, CreateRequestPayload } from "@/types";

type Purpose = RequestPurpose;
interface FormData {
  purpose: Purpose; product: string; quantity: string;
  customQuantity: string; date: string; location: string; notes: string; agreed: boolean;
}

const purposes = [
  { value: "buy" as Purpose, label: "Buy", description: "Purchase products or services", icon: "🛒", color: "border-brand-500 bg-brand-50 text-brand-700" },
  { value: "collaborate" as Purpose, label: "Collaborate", description: "Partner or co-create together", icon: "🤝", color: "border-blue-500 bg-blue-50 text-blue-700" },
  { value: "invest" as Purpose, label: "Invest", description: "Explore investment opportunities", icon: "📈", color: "border-purple-500 bg-purple-50 text-purple-700" },
];
const quantityOptions = ["10–50 units", "50–200 units", "200–500 units", "500–1000 units", "1000+ units", "Custom"];
const locationOptions = ["Phnom Penh", "Siem Reap", "Kampot", "Battambang", "Sihanoukville", "Kampong Cham", "Other"];

export default function RequestForm({
  defaultSupplierId,
  defaultSupplierName,
  defaultPurpose,
  supplierServices = [],
  allowedPurposes,
}: {
  defaultSupplierId?: string;
  defaultSupplierName?: string;
  defaultPurpose?: Purpose;
  supplierServices?: string[];
  allowedPurposes?: Purpose[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({
    purpose: defaultPurpose || "buy", product: "", quantity: "",
    customQuantity: "", date: "", location: "", notes: "", agreed: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [apiError, setApiError] = useState("");

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const availablePurposes = allowedPurposes
    ? purposes.filter((p) => allowedPurposes.includes(p.value))
    : purposes;

  const validate = () => {
    const e: typeof errors = {};
    if (!form.product.trim()) e.product = "Please describe the product or service.";
    if (form.purpose === "buy") {
      if (!form.quantity) e.quantity = "Please select a quantity.";
      if (form.quantity === "Custom" && !form.customQuantity.trim()) e.customQuantity = "Enter a custom quantity.";
    }
    if (!form.date) e.date = "Please select a date.";
    if (!form.location) e.location = "Please select a location.";
    if (!form.agreed) e.agreed = "You must agree to proceed.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setApiError("");

    try {
      // Check auth first — redirect to login if not signed in
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert(
          "You need to sign in to send a request.\n\nYou will be redirected to the login page. After signing in, come back to submit your request."
        );
        router.push("/auth/login?redirect=/request");
        return;
      }

      const effectiveQty = form.purpose === "buy"
        ? form.quantity === "Custom" ? form.customQuantity : form.quantity
        : null;

      const payload: CreateRequestPayload = {
        // Only include business_id if it's a valid UUID — avoid sending empty string
        business_id: defaultSupplierId && defaultSupplierId.trim() !== "" ? defaultSupplierId : null,
        purpose: form.purpose,
        product: form.product,
        quantity: effectiveQty || null,
        required_date: form.date,
        location: form.location,
        notes: form.notes || null,
      };

      const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
      const res = await fetch(`${BASE_URL}/requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Failed to submit request");

      setSubmitted(true);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to submit request.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-brand-600" />
        </div>
        <h2 className="font-display text-2xl text-ink mb-2">Request Sent!</h2>
        <p className="text-ink-muted mb-2 max-w-sm mx-auto">
          Your {form.purpose} request has been submitted. The supplier will respond within 24 hours.
        </p>
        <p className="text-sm text-ink-faint mb-6">You earned <span className="text-brand-600 font-semibold">+5 points</span> 🎉</p>
        <div className="flex gap-3 justify-center">
          <Button variant="secondary" onClick={() => setSubmitted(false)}>Submit another</Button>
          <Button variant="primary" onClick={() => router.push("/messages")}>View Messages</Button>
        </div>
      </div>
    );
  }

  const effectiveQty = form.quantity === "Custom" ? form.customQuantity : form.quantity;
  const activePurpose = availablePurposes.find((p) => p.value === form.purpose) ?? availablePurposes[0];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="md:col-span-2 space-y-6">
        {defaultSupplierName && (
          <div className="bg-brand-50 border border-brand-200 rounded-xl px-4 py-3 text-sm text-brand-700 font-medium">
            Sending request to: <strong>{defaultSupplierName}</strong>
          </div>
        )}
        {apiError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{apiError}</div>}

        {/* Purpose */}
        <div>
          <p className="text-sm font-medium text-ink mb-3">Purpose</p>
          <div className={cn("grid gap-3", availablePurposes.length === 1 ? "grid-cols-1" : "grid-cols-3")}>
            {availablePurposes.map((p) => (
              <button key={p.value} onClick={() => set("purpose", p.value)}
                className={cn("flex flex-col items-center text-center p-3 rounded-xl border-2 transition-all",
                  form.purpose === p.value ? p.color : "border-surface-200 hover:border-surface-300 bg-white")}>
                <span className="text-2xl mb-1">{p.icon}</span>
                <span className="text-sm font-semibold">{p.label}</span>
                <span className="text-xs opacity-70 mt-0.5 leading-snug">{p.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Product — show supplier services as quick-select if available */}
        {supplierServices.length > 0 ? (
          <div>
            <label className="text-sm font-medium text-ink block mb-2">Select a service / product</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {supplierServices.map((svc) => (
                <button key={svc} onClick={() => set("product", svc)}
                  className={cn("px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                    form.product === svc ? "bg-brand-600 text-white border-brand-600" : "bg-white text-ink-muted border-surface-200 hover:border-brand-300")}>
                  {svc}
                </button>
              ))}
            </div>
            <Input label="Or describe your need" placeholder="Add custom details..." value={form.product}
              onChange={(e) => set("product", e.target.value)} error={errors.product} />
          </div>
        ) : (
          <Input label={form.purpose === "buy" ? "Product / Service" : form.purpose === "collaborate" ? "Collaboration Topic" : "Investment Interest"}
            placeholder={form.purpose === "buy" ? "e.g. Corporate lunch catering for 50 people" : form.purpose === "collaborate" ? "e.g. Joint marketing campaign" : "e.g. Expand production capacity"}
            value={form.product} onChange={(e) => set("product", e.target.value)} error={errors.product} />
        )}

        {/* Quantity */}
        {form.purpose === "buy" && (
          <>
            <div>
              <label className="text-sm font-medium text-ink block mb-1.5">Quantity</label>
              <div className="relative">
                <select value={form.quantity} onChange={(e) => set("quantity", e.target.value)}
                  className={cn("w-full rounded-xl border px-3 py-2.5 text-sm text-ink appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-brand-500",
                    errors.quantity ? "border-red-400" : "border-surface-200")}>
                  <option value="">Select quantity range...</option>
                  {quantityOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint pointer-events-none" />
              </div>
              {errors.quantity && <p className="text-xs text-red-500 mt-1">{errors.quantity}</p>}
            </div>
            {form.quantity === "Custom" && (
              <Input label="Custom Quantity" placeholder="e.g. 750 units" value={form.customQuantity}
                onChange={(e) => set("customQuantity", e.target.value)} error={errors.customQuantity} />
            )}
          </>
        )}

        <Input label={form.purpose === "buy" ? "Required By" : "Proposed Date"} type="date"
          value={form.date} onChange={(e) => set("date", e.target.value)} error={errors.date}
          min={new Date().toISOString().split("T")[0]} />

        <div>
          <label className="text-sm font-medium text-ink block mb-1.5">Location</label>
          <div className="relative">
            <select value={form.location} onChange={(e) => set("location", e.target.value)}
              className={cn("w-full rounded-xl border px-3 py-2.5 text-sm text-ink appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-brand-500",
                errors.location ? "border-red-400" : "border-surface-200")}>
              <option value="">Select location...</option>
              {locationOptions.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint pointer-events-none" />
          </div>
          {errors.location && <p className="text-xs text-red-500 mt-1">{errors.location}</p>}
        </div>

        <div>
          <label className="text-sm font-medium text-ink block mb-1.5">Additional Notes <span className="text-ink-faint font-normal">(optional)</span></label>
          <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)}
            placeholder="Special requirements, dietary restrictions, delivery notes..."
            rows={3} className="w-full rounded-xl border border-surface-200 px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
        </div>

        <div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={form.agreed} onChange={(e) => set("agreed", e.target.checked)} className="mt-0.5 accent-brand-600" />
            <span className="text-sm text-ink-muted">
              I confirm the information above is accurate and agree to CBH&apos;s <a href="#" className="text-brand-600 underline">Terms of Service</a>.
            </span>
          </label>
          {errors.agreed && <p className="text-xs text-red-500 mt-1">{errors.agreed}</p>}
        </div>

        <Button variant="primary" size="lg" className="w-full" loading={loading} onClick={handleSubmit}>
          Submit {activePurpose?.label} Request
        </Button>
        <p className="text-xs text-center text-ink-faint">You&apos;ll earn +5 points when your request is sent 🌱</p>
      </div>

      {/* Preview */}
      <div className="md:col-span-1">
        <div className="sticky top-24 bg-surface-50 rounded-2xl border border-surface-200 p-4 space-y-3">
          <h3 className="font-semibold text-ink text-sm">Request Preview</h3>
          {activePurpose && (
            <div className={cn("flex items-center gap-2 p-2 rounded-xl text-sm font-medium", activePurpose.color)}>
              <span>{activePurpose.icon}</span> {activePurpose.label} Request
            </div>
          )}
          <div className="space-y-2.5 text-sm">
            {[
              ["Topic", form.product || "—"],
              ...(form.purpose === "buy" ? [["Quantity", effectiveQty || "—"]] : []),
              ["Date", form.date || "—"],
              ["Location", form.location || "—"],
              ...(defaultSupplierName ? [["Supplier", defaultSupplierName]] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col">
                <span className="text-xs text-ink-faint">{label}</span>
                <span className="text-ink font-medium truncate">{value || "—"}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-surface-200 pt-3 text-xs text-ink-faint space-y-1">
            <p>✅ Free to submit</p>
            <p>💬 Creates a conversation thread</p>
            <p>🌱 Earn +5 points</p>
          </div>
        </div>
      </div>
    </div>
  );
}
