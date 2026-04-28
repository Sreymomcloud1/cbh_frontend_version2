"use client";
import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Search, ArrowRight, Sparkles, SlidersHorizontal } from "lucide-react";
import RequestForm from "@/components/request/RequestForm";
import type { RequestPurpose, Supplier } from "@/types";
import { mockSuppliers, categories as mockCategories } from "@/data/mockData";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformBusiness(b: any): Supplier {
  return {
    id: b.id, name: b.name, tagline: b.tagline ?? "", description: b.description ?? "",
    category: b.category, subCategories: b.sub_categories ?? [], tier: b.tier,
    location: b.location_city, locationDetail: b.location_detail ?? "",
    logo: b.logo_url ?? "", gallery: b.gallery_urls ?? [],
    ecoScore: { overall: b.eco_score_overall ?? 0, level: b.eco_level ?? "Basic", breakdown: b.eco_breakdown ?? {} },
    discountPercent: b.discount_percent ?? null,
    bulkSupport: b.bulk_support ?? false, bulkCapacity: b.bulk_capacity ?? null,
    verified: b.is_verified ?? false, tags: b.tags ?? [], services: b.services ?? [],
    contactEmail: b.contact_email ?? "", contactPhone: b.contact_phone ?? "",
    rating: b.rating ?? 0, reviewCount: b.review_count ?? 0,
    isActive: b.is_active ?? true,
    notifyByEmail: b.notify_by_email ?? true,
    notifyByPhone: b.notify_by_phone ?? false,
    phone: b.contact_phone ?? "",
    collaboration: { enabled: b.open_for_collaboration ?? false, lookingFor: b.collaboration_types ?? [] },
    investment: { enabled: b.open_for_investment ?? false },
  };
}

async function fetchAllSuppliers(): Promise<Supplier[]> {
  try {
    const res = await fetch(`${API_URL}/businesses?limit=50`);
    if (!res.ok) return [];
    const json = await res.json();
    const real: Supplier[] = (json.data?.businesses ?? []).map(transformBusiness);
    if (real.length === 0) return mockSuppliers;
    // Merge: real businesses first, then mock ones not sharing a name
    const realNames = new Set(real.map(r => r.name.toLowerCase()));
    const mockFill  = mockSuppliers.filter(m => !realNames.has(m.name.toLowerCase()));
    return [...real, ...mockFill];
  } catch {
    return mockSuppliers;
  }
}

// ── Smart search ─────────────────────────────────────────────────────────────

interface SmartResult extends Supplier {
  matchScore: number;
  matchReasons: string[];
}

async function smartSearch(query: string): Promise<SmartResult[]> {
  try {
    const res = await fetch(`${API_URL}/search/smart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, limit: 8 }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (json.data ?? []).map((b: any): SmartResult => ({
      ...transformBusiness(b),
      matchScore: b.matchScore ?? 0,
      matchReasons: b.matchReasons ?? [],
    }));
  } catch {
    // Fallback: search mock data locally
    const q = query.toLowerCase();
    return mockSuppliers
      .filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.services.some(sv => sv.toLowerCase().includes(q)) ||
        s.tags.some(t => t.toLowerCase().includes(q))
      )
      .map(s => ({ ...s, matchScore: 50, matchReasons: ["Matches your search"] }));
  }
}

const EXAMPLES = [
  "Catering for a wedding with 200 guests",
  "Eco-friendly packaging for a café",
  "Bulk rice and spices for a restaurant",
  "Equipment rental for a corporate event",
];

export default function RequestPageContent() {
  const params = useSearchParams();
  const preSupplier = params.get("supplier") ?? undefined;
  const preName     = params.get("name")     ?? undefined;
  const prePurpose  = (params.get("purpose") ?? undefined) as RequestPurpose | undefined;

  const [step,             setStep]             = useState<"search" | "form">(preSupplier ? "form" : "search");
  const [searchMode,       setSearchMode]       = useState<"smart" | "browse">("smart");
  const [suppliers,        setSuppliers]        = useState<Supplier[]>(mockSuppliers);
  const [search,           setSearch]           = useState("");
  const [smartQuery,       setSmartQuery]       = useState("");
  const [smartResults,     setSmartResults]     = useState<SmartResult[]>([]);
  const [smartLoading,     setSmartLoading]     = useState(false);
  const [smartSearched,    setSmartSearched]    = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Load all suppliers (real + mock) on mount
  useEffect(() => {
    fetchAllSuppliers().then(setSuppliers);
  }, []);

  // Debounced smart search
  useEffect(() => {
    if (smartQuery.trim().length < 3) {
      setSmartResults([]);
      setSmartSearched(false);
      return;
    }
    const t = setTimeout(async () => {
      setSmartLoading(true);
      const results = await smartSearch(smartQuery);
      setSmartResults(results);
      setSmartSearched(true);
      setSmartLoading(false);
    }, 400);
    return () => clearTimeout(t);
  }, [smartQuery]);

  const allCategories = useMemo(() =>
    [...new Set([...mockCategories.map(c => c.name), ...suppliers.map(s => s.category)])],
  [suppliers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return suppliers.filter(s => {
      if (selectedCategory && s.category !== selectedCategory) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) ||
        s.services.some(sv => sv.toLowerCase().includes(q)) ||
        s.tags.some(t => t.toLowerCase().includes(q)) ||
        s.description.toLowerCase().includes(q);
    });
  }, [suppliers, search, selectedCategory]);

  const selectSupplier = (s: Supplier) => {
    setSelectedSupplier(s);
    setStep("form");
  };

  // ── Form step ──────────────────────────────────────────────────────────────

  if (step === "form") {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <button onClick={() => setStep("search")}
            className="text-sm text-ink-muted hover:text-ink mb-4 flex items-center gap-1.5 transition-colors">
            ← Back to supplier search
          </button>
          <h1 className="font-display text-3xl sm:text-4xl text-ink mb-2">Send a Request</h1>
          {selectedSupplier && (
            <p className="text-ink-muted">Sending to <strong>{selectedSupplier.name}</strong></p>
          )}
        </div>
        <RequestForm
          defaultSupplierId={selectedSupplier?.id ?? preSupplier}
          defaultSupplierName={selectedSupplier?.name ?? preName}
          defaultPurpose={prePurpose ?? "buy"}
          supplierServices={selectedSupplier?.services ?? []}
          allowedPurposes={selectedSupplier?.tier === "Company" ? ["buy"] : undefined}
        />
      </div>
    );
  }

  // ── Search step ────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl text-ink mb-2">Request a Quote</h1>
        <p className="text-ink-muted">Find the right supplier or describe what you need and we'll match you.</p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setSearchMode("smart")}
          className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-colors",
            searchMode === "smart"
              ? "bg-brand-600 text-white border-brand-600"
              : "bg-white text-ink-muted border-surface-200 hover:border-brand-300")}>
          <Sparkles className="w-3.5 h-3.5" /> Smart Match
        </button>
        <button onClick={() => setSearchMode("browse")}
          className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-colors",
            searchMode === "browse"
              ? "bg-brand-600 text-white border-brand-600"
              : "bg-white text-ink-muted border-surface-200 hover:border-brand-300")}>
          <SlidersHorizontal className="w-3.5 h-3.5" /> Browse All
        </button>
      </div>

      {/* General request option */}
      <div className="mb-5">
        <button onClick={() => { setSelectedSupplier(null); setStep("form"); }}
          className="w-full bg-surface-50 hover:bg-surface-100 border border-surface-200 hover:border-brand-300 rounded-2xl p-4 text-left transition-colors flex items-center justify-between group">
          <div>
            <p className="font-semibold text-ink">Send a general open request</p>
            <p className="text-sm text-ink-muted">Any available approved supplier can respond</p>
          </div>
          <ArrowRight className="w-5 h-5 text-ink-faint group-hover:text-brand-600 transition-colors" />
        </button>
      </div>

      {/* ── SMART SEARCH ── */}
      {searchMode === "smart" && (
        <div className="bg-white rounded-2xl border border-surface-200 shadow-soft p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-brand-500" />
            <p className="font-semibold text-ink text-sm">Describe what you need</p>
          </div>
          <p className="text-xs text-ink-muted">Write in plain language — we'll find the best matching suppliers.</p>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
            <input type="text" value={smartQuery} onChange={e => setSmartQuery(e.target.value)}
              placeholder='e.g. "Catering for 200 guests at a wedding"'
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            {smartLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
            )}
          </div>

          {/* Example chips */}
          {!smartSearched && smartQuery.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map(ex => (
                <button key={ex} onClick={() => setSmartQuery(ex)}
                  className="text-xs px-3 py-1.5 rounded-full bg-surface-50 hover:bg-brand-50 hover:text-brand-700 border border-surface-200 hover:border-brand-200 text-ink-muted transition-colors">
                  {ex}
                </button>
              ))}
            </div>
          )}

          {/* No results */}
          {smartSearched && smartResults.length === 0 && !smartLoading && (
            <div className="text-center py-6">
              <p className="text-sm text-ink-muted">No matches found. Try different words or{" "}
                <button className="text-brand-600 hover:underline" onClick={() => setSearchMode("browse")}>browse all suppliers</button>.
              </p>
            </div>
          )}

          {/* Smart results */}
          {smartResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-ink-faint">{smartResults.length} supplier{smartResults.length !== 1 ? "s" : ""} matched</p>
              {smartResults.map(s => (
                <button key={s.id} onClick={() => selectSupplier(s)}
                  className="w-full bg-white border border-surface-200 hover:border-brand-400 rounded-2xl p-4 text-left transition-all hover:shadow-soft group">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-surface-100 shrink-0 overflow-hidden">
                      {s.logo
                        ? <img src={s.logo} alt={s.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center font-bold text-brand-600">{s.name[0]}</div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-ink">{s.name}</span>
                        {s.verified && <span className="text-[10px] px-1.5 py-0.5 bg-brand-50 text-brand-700 rounded-full border border-brand-200">Verified</span>}
                      </div>
                      <p className="text-xs text-ink-muted mt-0.5">{s.category} · {s.location} · Eco {s.ecoScore.overall}/100</p>
                      {s.matchReasons.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {s.matchReasons.map(r => (
                            <span key={r} className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full">{r}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {s.matchScore > 0 && (
                      <span className="text-xs px-2 py-1 bg-brand-50 text-brand-700 rounded-lg border border-brand-100 shrink-0">
                        {Math.min(s.matchScore, 99)}% match
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BROWSE ALL (same as explore) ── */}
      {searchMode === "browse" && (
        <div className="space-y-4">
          {/* Search + category filters — identical to explore */}
          <div className="bg-white rounded-2xl border border-surface-200 shadow-soft p-5 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
              <input type="text" placeholder='Search e.g. "breakfast for 250 people", "eco packaging"…'
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setSelectedCategory("")}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                  selectedCategory === "" ? "bg-brand-600 text-white border-brand-600" : "bg-white text-ink-muted border-surface-200 hover:border-brand-300")}>
                All
              </button>
              {allCategories.map(c => (
                <button key={c} onClick={() => setSelectedCategory(selectedCategory === c ? "" : c)}
                  className={cn("px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                    selectedCategory === c ? "bg-brand-600 text-white border-brand-600" : "bg-white text-ink-muted border-surface-200 hover:border-brand-300")}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <p className="text-sm text-ink-muted">
            {filtered.length === 0
              ? "No suppliers match your search."
              : `${filtered.length} supplier${filtered.length !== 1 ? "s" : ""} — click to request`}
          </p>

          <div className="space-y-3">
            {filtered.map(s => (
              <button key={s.id} onClick={() => selectSupplier(s)}
                className="w-full bg-white border border-surface-200 hover:border-brand-300 rounded-2xl p-4 text-left transition-all hover:shadow-soft flex items-center gap-4 group">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface-100 shrink-0">
                  {s.logo
                    ? <img src={s.logo} alt={s.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-lg font-bold text-brand-600">{s.name[0]}</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-ink">{s.name}</p>
                    {s.verified && <span className="text-[10px] px-1.5 py-0.5 bg-brand-50 text-brand-700 rounded-full border border-brand-200">✓</span>}
                  </div>
                  <p className="text-xs text-ink-faint">{s.category} · {s.location} · Eco {s.ecoScore.overall}/100</p>
                  {s.services.length > 0 && (
                    <p className="text-xs text-ink-muted mt-0.5 truncate">{s.services.slice(0, 4).join(", ")}</p>
                  )}
                </div>
                <ArrowRight className="w-4 h-4 text-ink-faint group-hover:text-brand-600 transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
