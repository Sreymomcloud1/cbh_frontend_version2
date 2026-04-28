"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Leaf } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { createBusiness } from "@/lib/api";
import type { BusinessCategory, BusinessTier, CollaborationType, CreateBusinessPayload } from "@/types";

type Step = 1 | 2 | 3 | 4;

const categoryOptions: BusinessCategory[] = ["Food", "Ingredients", "Packaging", "Rentals", "Event Services", "Others"];
const tierOptions: BusinessTier[] = ["Startup", "SME", "Company"];
const locationOptions = ["Phnom Penh", "Siem Reap", "Kampot", "Battambang", "Sihanoukville", "Kampong Cham"];
const collabTypeOptions: { value: CollaborationType; label: string }[] = [
  { value: "supplier", label: "Supplier" },
  { value: "partner", label: "Partner" },
  { value: "marketing", label: "Marketing" },
];

interface FormState {
  name: string;
  tagline: string;
  contactEmail: string;
  contactPhone: string;
  category: BusinessCategory | "";
  tier: BusinessTier | "";
  locationCity: string;
  locationDetail: string;
  description: string;
  ecoDescription: string;
  taxId: string;
  services: string[];
  bulkSupport: boolean;
  bulkCapacity: string;
  discountPercent: string;
  openForCollaboration: boolean;
  collaborationTypes: CollaborationType[];
  collaborationDescription: string;
  openForInvestment: boolean;
  investmentAmount: string;
  investmentDescription: string;
  foundedYear: string;
  websiteUrl: string;
  facebookUrl: string;
  telegramUrl: string;
  tags: string;
}

export default function BusinessRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>({
    name: "", tagline: "", contactEmail: "", contactPhone: "",
    category: "", tier: "", locationCity: "", locationDetail: "",
    description: "", ecoDescription: "", taxId: "", services: [""],
    bulkSupport: false, bulkCapacity: "", discountPercent: "",
    openForCollaboration: false, collaborationTypes: [], collaborationDescription: "",
    openForInvestment: false, investmentAmount: "", investmentDescription: "",
    foundedYear: "", websiteUrl: "", facebookUrl: "", telegramUrl: "", tags: "",
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [apiError, setApiError] = useState("");

  const set = (k: keyof FormState, v: unknown) => setForm((p) => ({ ...p, [k]: v }));
  const addService = () => set("services", [...form.services, ""]);
  const updateService = (i: number, v: string) => {
    const s = [...form.services]; s[i] = v; set("services", s);
  };
  const removeService = (i: number) => set("services", form.services.filter((_, idx) => idx !== i));
  const toggleCollabType = (t: CollaborationType) => {
    const cur = form.collaborationTypes;
    set("collaborationTypes", cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]);
  };

  const handleSubmit = async () => {
    setApiError("");
    setLoading(true);
    try {
      // Validate required fields before hitting the API
      if (!form.name.trim())         { setApiError("Business name is required.");    setLoading(false); return; }
      if (!form.category)            { setApiError("Please select a category.");     setLoading(false); return; }
      if (!form.tier)                { setApiError("Please select a tier.");         setLoading(false); return; }
      if (!form.locationCity)        { setApiError("Please select a city.");         setLoading(false); return; }
      if (!form.contactEmail.trim()) { setApiError("Contact email is required.");    setLoading(false); return; }

      const payload: CreateBusinessPayload = {
        name:                      form.name.trim(),
        tagline:                   form.tagline.trim(),
        description:               form.description.trim(),
        category:                  form.category as BusinessCategory,
        sub_categories:            [],
        tier:                      form.tier as BusinessTier,
        location_city:             form.locationCity,
        location_detail:           form.locationDetail.trim(),
        map_url:                   null,
        logo_url:                  null,
        gallery_urls:              [],
        discount_percent:          form.discountPercent ? Number(form.discountPercent) : null,
        bulk_support:              form.bulkSupport,
        bulk_capacity:             form.bulkCapacity || null,
        tags:                      form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        services:                  form.services.filter(Boolean),
        contact_email:             form.contactEmail.trim(),
        contact_phone:             form.contactPhone.trim(),
        website_url:               form.websiteUrl || null,
        facebook_url:              form.facebookUrl || null,
        telegram_url:              form.telegramUrl || null,
        open_for_collaboration:    form.openForCollaboration,
        collaboration_types:       form.collaborationTypes,
        collaboration_description: form.collaborationDescription || null,
        open_for_investment:       form.openForInvestment,
        investment_amount:         form.investmentAmount || null,
        investment_description:    form.investmentDescription || null,
        founded_year:              form.foundedYear ? Number(form.foundedYear) : null,
      } as CreateBusinessPayload;

      await createBusiness(payload);
      setSubmitted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to register business.";
      // Give a friendlier message for auth errors
      if (msg.toLowerCase().includes("not authenticated") || msg.includes("401")) {
        setApiError("Session expired — please refresh the page and try again.");
      } else {
        setApiError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { n: 1, label: "Identity" },
    { n: 2, label: "Profile" },
    { n: 3, label: "Settings" },
    { n: 4, label: "Review" },
  ];

  if (submitted) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-8 h-8 text-brand-600" />
        </div>
        <h2 className="font-display text-2xl text-ink mb-2">Registration Submitted!</h2>
        <p className="text-sm text-ink-muted mb-6">
          Your business profile is under review. We&apos;ll notify you at{" "}
          <strong>{form.contactEmail}</strong> within 48 hours once approved.
        </p>
        <Button variant="primary" onClick={() => router.push("/business-dashboard")}>
          Go to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-ink mb-2">Register Your Business</h1>
        <p className="text-ink-muted text-sm">Get your business listed on CBH and connect with buyers.</p>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center gap-2 flex-1">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors",
              step > s.n ? "bg-brand-600 text-white" : step === s.n ? "bg-brand-600 text-white" : "bg-surface-200 text-ink-faint"
            )}>
              {step > s.n ? "✓" : s.n}
            </div>
            <span className={cn("text-xs font-medium hidden sm:block", step >= s.n ? "text-ink" : "text-ink-faint")}>{s.label}</span>
            {i < steps.length - 1 && (
              <div className={cn("h-px flex-1 transition-colors", step > s.n ? "bg-brand-400" : "bg-surface-200")} />
            )}
          </div>
        ))}
      </div>

      {apiError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{apiError}</div>
      )}

      <div className="bg-white rounded-2xl border border-surface-200 shadow-soft p-6 space-y-5">

        {/* STEP 1 — Identity */}
        {step === 1 && (
          <>
            <h2 className="font-semibold text-ink">Business Identity</h2>
            <Input label="Business Name" placeholder="e.g. GreenLeaf Catering" value={form.name} onChange={(e) => set("name", e.target.value)} />
            <Input label="Tagline" placeholder="e.g. Farm-to-table catering for every occasion" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} />
            <Input label="Contact Email" type="email" placeholder="hello@yourbusiness.com" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
            <Input label="Contact Phone" placeholder="+855 12 345 678" value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} />
            <div>
              <label className="text-sm font-medium text-ink block mb-1.5">Category</label>
              <select value={form.category} onChange={(e) => set("category", e.target.value as BusinessCategory)}
                className="w-full rounded-xl border border-surface-200 px-3 py-2.5 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Select category...</option>
                {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-ink block mb-1.5">Business Tier</label>
              <div className="grid grid-cols-3 gap-3">
                {tierOptions.map((t) => (
                  <button key={t} onClick={() => set("tier", t)}
                    className={cn("p-3 rounded-xl border-2 text-sm font-medium transition-colors", form.tier === t ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 hover:border-surface-300")}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium text-ink block mb-1.5">City</label>
                <select value={form.locationCity} onChange={(e) => set("locationCity", e.target.value)}
                  className="w-full rounded-xl border border-surface-200 px-3 py-2.5 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Select city...</option>
                  {locationOptions.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <Input label="District / Detail" placeholder="e.g. Toul Kork" value={form.locationDetail} onChange={(e) => set("locationDetail", e.target.value)} />
              </div>
            </div>
          </>
        )}

        {/* STEP 2 — Profile */}
        {step === 2 && (
          <>
            <h2 className="font-semibold text-ink">Business Profile</h2>
            <div>
              <label className="text-sm font-medium text-ink block mb-1.5">Description</label>
              <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
                placeholder="Describe your business, what you offer, and what makes you unique (min. 20 characters)..."
                rows={4}
                className="w-full rounded-xl border border-surface-200 px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-ink block mb-1.5">Services</label>
              <div className="space-y-2">
                {form.services.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={s} onChange={(e) => updateService(i, e.target.value)}
                      placeholder={`Service ${i + 1}`}
                      className="flex-1 rounded-xl border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    {form.services.length > 1 && (
                      <button onClick={() => removeService(i)} className="text-ink-faint hover:text-red-500 px-2">✕</button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={addService} className="mt-2 text-sm text-brand-600 hover:underline">+ Add service</button>
            </div>
            <Input label="Tags (comma-separated)" placeholder="organic, bulk, eco-friendly, local" value={form.tags} onChange={(e) => set("tags", e.target.value)} />
            <Input label="Founded Year" type="number" placeholder="e.g. 2021" value={form.foundedYear} onChange={(e) => set("foundedYear", e.target.value)} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input label="Website" placeholder="https://..." value={form.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} />
              <Input label="Facebook" placeholder="https://facebook.com/..." value={form.facebookUrl} onChange={(e) => set("facebookUrl", e.target.value)} />
              <Input label="Telegram" placeholder="https://t.me/..." value={form.telegramUrl} onChange={(e) => set("telegramUrl", e.target.value)} />
            </div>
          </>
        )}

        {/* STEP 3 — Settings */}
        {step === 3 && (
          <>
            <h2 className="font-semibold text-ink">Business Settings</h2>

            {/* Bulk */}
            <div className={cn("rounded-2xl border-2 p-4 transition-colors", form.bulkSupport ? "border-brand-400 bg-brand-50" : "border-surface-200")}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-ink text-sm">Bulk Order Support</p>
                  <p className="text-xs text-ink-muted">Can you fulfil large-volume orders?</p>
                </div>
                <div onClick={() => set("bulkSupport", !form.bulkSupport)}
                  className={cn("w-12 h-6 rounded-full relative cursor-pointer transition-colors", form.bulkSupport ? "bg-brand-500" : "bg-surface-200")}>
                  <div className={cn("w-5 h-5 rounded-full bg-white absolute top-0.5 shadow transition-transform", form.bulkSupport ? "translate-x-6" : "translate-x-0.5")} />
                </div>
              </div>
              {form.bulkSupport && (
                <Input label="Bulk Capacity" placeholder="e.g. Up to 500 meals/day" value={form.bulkCapacity} onChange={(e) => set("bulkCapacity", e.target.value)} />
              )}
            </div>

            <Input label="Discount Offered (%)" type="number" placeholder="e.g. 10" value={form.discountPercent} onChange={(e) => set("discountPercent", e.target.value)} />

            {/* Collaboration */}
            <div className={cn("rounded-2xl border-2 p-4 transition-colors", form.openForCollaboration ? "border-blue-400 bg-blue-50" : "border-surface-200")}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-ink text-sm">Open for Collaboration</p>
                  <p className="text-xs text-ink-muted">Allow buyers to send collaboration requests</p>
                </div>
                <div onClick={() => set("openForCollaboration", !form.openForCollaboration)}
                  className={cn("w-12 h-6 rounded-full relative cursor-pointer transition-colors", form.openForCollaboration ? "bg-blue-500" : "bg-surface-200")}>
                  <div className={cn("w-5 h-5 rounded-full bg-white absolute top-0.5 shadow transition-transform", form.openForCollaboration ? "translate-x-6" : "translate-x-0.5")} />
                </div>
              </div>
              {form.openForCollaboration && (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-ink mb-2">Looking for:</p>
                    <div className="flex gap-2 flex-wrap">
                      {collabTypeOptions.map(({ value, label }) => (
                        <button key={value} onClick={() => toggleCollabType(value)}
                          className={cn("px-3 py-1.5 rounded-full text-sm font-medium transition-colors border", form.collaborationTypes.includes(value) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-ink-muted border-surface-200 hover:border-blue-300")}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-ink block mb-1">Description (optional)</label>
                    <textarea value={form.collaborationDescription} onChange={(e) => set("collaborationDescription", e.target.value)}
                      placeholder="What kind of collaboration are you looking for?" rows={2}
                      className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
                  </div>
                </div>
              )}
            </div>

            {/* Investment */}
            <div className={cn("rounded-2xl border-2 p-4 transition-colors", form.openForInvestment ? "border-purple-400 bg-purple-50" : "border-surface-200")}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-ink text-sm">Open for Investment</p>
                  <p className="text-xs text-ink-muted">Allow investors to send inquiries</p>
                </div>
                <div onClick={() => set("openForInvestment", !form.openForInvestment)}
                  className={cn("w-12 h-6 rounded-full relative cursor-pointer transition-colors", form.openForInvestment ? "bg-purple-500" : "bg-surface-200")}>
                  <div className={cn("w-5 h-5 rounded-full bg-white absolute top-0.5 shadow transition-transform", form.openForInvestment ? "translate-x-6" : "translate-x-0.5")} />
                </div>
              </div>
              {form.openForInvestment && (
                <div className="space-y-3">
                  <Input label="Investment Range" placeholder="e.g. $10,000–$50,000" value={form.investmentAmount} onChange={(e) => set("investmentAmount", e.target.value)} />
                  <div>
                    <label className="text-xs font-medium text-ink block mb-1">What will funds be used for?</label>
                    <textarea value={form.investmentDescription} onChange={(e) => set("investmentDescription", e.target.value)}
                      rows={2}
                      className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* STEP 4 — Review */}
        {step === 4 && (
          <>
            <h2 className="font-semibold text-ink">Review & Submit</h2>
            <div className="space-y-3 text-sm">
              {[
                ["Business Name", form.name],
                ["Tagline", form.tagline],
                ["Category", form.category],
                ["Tier", form.tier],
                ["City", form.locationCity],
                ["District", form.locationDetail],
                ["Contact Email", form.contactEmail],
                ["Contact Phone", form.contactPhone],
                ["Services", form.services.filter(Boolean).join(", ")],
                ["Bulk Support", form.bulkSupport ? `Yes — ${form.bulkCapacity}` : "No"],
                ["Collaboration", form.openForCollaboration ? `Yes (${form.collaborationTypes.join(", ")})` : "No"],
                ["Investment", form.openForInvestment ? `Yes — ${form.investmentAmount}` : "No"],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-3 p-3 rounded-xl bg-surface-50">
                  <span className="text-ink-faint w-36 shrink-0">{label}</span>
                  <span className="text-ink font-medium">{value || "—"}</span>
                </div>
              ))}
            </div>
            <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 flex items-start gap-2 text-sm text-brand-700">
              <Leaf className="w-4 h-4 mt-0.5 shrink-0" />
              <span>After registration, complete your <strong>Eco Score</strong> questionnaire in your dashboard to improve your listing ranking.</span>
            </div>
          </>
        )}

        {/* Navigation */}
        <div className="flex gap-3 pt-2">
          {step > 1 && (
            <Button variant="outline" size="md" className="flex-1" onClick={() => setStep((s) => (s - 1) as Step)}>
              Back
            </Button>
          )}
          {step < 4 ? (
            <Button variant="primary" size="md" className="flex-1" onClick={() => setStep((s) => (s + 1) as Step)}>
              Continue
            </Button>
          ) : (
            <Button variant="primary" size="md" className="flex-1" loading={loading} onClick={handleSubmit}>
              Submit Registration
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
