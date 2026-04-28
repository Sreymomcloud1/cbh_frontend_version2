"use client";
import { useState, useMemo, useEffect, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X, Handshake, TrendingUp } from "lucide-react";
import SupplierCard from "@/components/supplier/SupplierCard";
import { SkeletonCard } from "@/components/ui/Card";
import { listBusinesses } from "@/lib/api";
import type { FilterState, Supplier } from "@/types";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { onBusinessDataChanged } from "@/lib/data-events";

// Static category + location data (UI chrome only — not business data)
const CATEGORIES = [
  { name: "Food",          icon: "🍽️" },
  { name: "Ingredients",   icon: "🌿" },
  { name: "Packaging",     icon: "📦" },
  { name: "Rentals",       icon: "🪑" },
  { name: "Event Services",icon: "⚡" },
  { name: "Others",        icon: "🔧" },
];

const LOCATIONS = ["Phnom Penh", "Siem Reap", "Kampot", "Battambang", "Sihanoukville", "Kampong Cham"];

function ExploreContent() {
  const searchParams = useSearchParams();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    search:               searchParams.get("search") || "",
    category:             (searchParams.get("category") as FilterState["category"]) || "",
    location:             "",
    minEcoScore:          0,
    bulkSupport:          false,
    tier:                 (searchParams.get("tier") as FilterState["tier"]) || "",
    openForCollaboration: false,
    openForInvestment:    false,
  });

  const [fetchError, setFetchError] = useState("");

  const loadBusinesses = useCallback(() => {
    setLoading(true);
    setFetchError("");
    listBusinesses({ limit: 50 })
      .then(({ suppliers: data }) => {
        setSuppliers(data);
        if (data.length === 0) setFetchError("none");
      })
      .catch((err: Error) => {
        console.error("Explore fetch error:", err.message);
        setFetchError(err.message);
        setSuppliers([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadBusinesses();
  }, [loadBusinesses]);

  useEffect(() => {
    const unsubscribe = onBusinessDataChanged(loadBusinesses);
    const onFocus = () => loadBusinesses();
    window.addEventListener("focus", onFocus);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, [loadBusinesses]);

  // 1. Add this useEffect to sync URL changes to state
  useEffect(() => {
    const search = searchParams.get("search") || "";
    const category = (searchParams.get("category") as FilterState["category"]) || "";
    const tier = (searchParams.get("tier") as FilterState["tier"]) || "";

    setFilters(prev => ({
      ...prev,
      search,
      category,
      tier,
    }));
  }, [searchParams]); // This triggers whenever the URL parameters change

  const set = <K extends keyof FilterState>(key: K, val: FilterState[K]) =>
    setFilters(p => ({ ...p, [key]: val }));

  const activeCount = [
    filters.category, filters.location, filters.minEcoScore > 0,
    filters.bulkSupport, filters.tier, filters.openForCollaboration, filters.openForInvestment,
  ].filter(Boolean).length;

  const results = useMemo(() => suppliers.filter(s => {
    const q = filters.search.toLowerCase();
    if (q &&
      !s.name.toLowerCase().includes(q) &&
      !s.description.toLowerCase().includes(q) &&
      !s.tags.some(t => t.toLowerCase().includes(q)) &&
      !s.services.some(sv => sv.toLowerCase().includes(q)) &&
      !(s.subCategories ?? []).some(sc => sc.toLowerCase().includes(q))
    ) return false;
    if (filters.category && s.category !== filters.category) return false;
    if (filters.location && s.location !== filters.location)  return false;
    if (filters.minEcoScore > 0 && s.ecoScore.overall < filters.minEcoScore) return false;
    if (filters.bulkSupport && !s.bulkSupport) return false;
    if (filters.tier && s.tier !== filters.tier) return false;
    if (filters.openForCollaboration && !s.collaboration.enabled) return false;
    if (filters.openForInvestment && !s.investment.enabled) return false;
    return true;
  }), [filters, suppliers]);

  const clearFilters = () => setFilters({
    search: "", category: "", location: "", minEcoScore: 0,
    bulkSupport: false, tier: "", openForCollaboration: false, openForInvestment: false,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl text-ink mb-2">Explore Suppliers</h1>
        <p className="text-ink-muted">Find verified local suppliers. Try "eco catering" or "bulk packaging".</p>
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
          <input type="text"
            placeholder='Search e.g. "Breakfast for 200 people", "eco packaging"…'
            value={filters.search}
            onChange={e => set("search", e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          {filters.search && (
            <button onClick={() => set("search", "")} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Button variant="outline" size="md" onClick={() => setFiltersOpen(p => !p)} className="gap-2 shrink-0">
          <SlidersHorizontal className="w-4 h-4" /> Filters
          {activeCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center">{activeCount}</span>
          )}
        </Button>
      </div>

      {/* Category chips */}
      <div className="flex gap-2 flex-wrap mb-6">
        {CATEGORIES.map(c => (
          <button key={c.name}
            onClick={() => set("category", filters.category === c.name ? "" : c.name as FilterState["category"])}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
              filters.category === c.name ? "bg-brand-600 text-white border-brand-600" : "bg-white text-ink-muted border-surface-200 hover:border-brand-300")}>
            <span>{c.icon}</span>{c.name}
          </button>
        ))}
        <button onClick={() => set("openForCollaboration", !filters.openForCollaboration)}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
            filters.openForCollaboration ? "bg-blue-600 text-white border-blue-600" : "bg-white text-ink-muted border-surface-200 hover:border-blue-300")}>
          <Handshake className="w-3.5 h-3.5" /> Collaboration
        </button>
        <button onClick={() => set("openForInvestment", !filters.openForInvestment)}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
            filters.openForInvestment ? "bg-purple-600 text-white border-purple-600" : "bg-white text-ink-muted border-surface-200 hover:border-purple-300")}>
          <TrendingUp className="w-3.5 h-3.5" /> Investment
        </button>
      </div>

      {/* Advanced filters */}
      {filtersOpen && (
        <div className="bg-white rounded-2xl border border-surface-200 shadow-soft p-5 mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
          <div>
            <p className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-2">Tier</p>
            {(["", "Startup", "SME", "Company"] as const).map(t => (
              <button key={t} onClick={() => set("tier", t)}
                className={cn("w-full text-left text-sm px-2.5 py-1.5 rounded-lg transition-colors",
                  filters.tier === t ? "bg-brand-50 text-brand-700 font-medium" : "text-ink-muted hover:bg-surface-50")}>
                {t || "All"}
              </button>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-2">Location</p>
            {["", ...LOCATIONS].map(loc => (
              <button key={loc} onClick={() => set("location", loc)}
                className={cn("w-full text-left text-sm px-2.5 py-1.5 rounded-lg transition-colors",
                  filters.location === loc ? "bg-brand-50 text-brand-700 font-medium" : "text-ink-muted hover:bg-surface-50")}>
                {loc || "All"}
              </button>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-2">
              Min Eco: <span className="text-brand-600">{filters.minEcoScore || "Any"}</span>
            </p>
            <input type="range" min={0} max={100} step={10} value={filters.minEcoScore}
              onChange={e => set("minEcoScore", Number(e.target.value))} className="w-full accent-brand-600" />
            <div className="flex justify-between text-xs text-ink-faint mt-1"><span>0</span><span>100</span></div>
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-2">Options</p>
            <label className="flex items-center gap-2 cursor-pointer py-1.5">
              <input type="checkbox" checked={filters.bulkSupport} onChange={e => set("bulkSupport", e.target.checked)} className="accent-brand-600 w-4 h-4" />
              <span className="text-sm text-ink">Bulk support</span>
            </label>
          </div>
          <div className="flex flex-col justify-end">
            {activeCount > 0 && (
              <button onClick={clearFilters} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600">
                <X className="w-3.5 h-3.5" /> Clear all
              </button>
            )}
          </div>
        </div>
      )}

      <p className="text-sm text-ink-faint mb-5">
        {loading ? "Loading suppliers…" : `${results.length} supplier${results.length !== 1 ? "s" : ""} found`}
      </p>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">🔍</p>
          <h3 className="font-semibold text-ink mb-1">No suppliers found</h3>
          {fetchError && fetchError !== "none" ? (
            <p className="text-sm text-red-500 mb-4 max-w-sm mx-auto">
              Could not reach the server. Make sure the backend is running at{" "}
              <code className="bg-surface-100 px-1 rounded">{process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"}</code>
            </p>
          ) : (
            <p className="text-sm text-ink-muted mb-4">
              {activeCount > 0 ? "Try adjusting your filters." : "No approved businesses yet. Check back soon."}
            </p>
          )}
          {activeCount > 0 && <Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {results.map(s => <SupplierCard key={s.id} supplier={s} />)}
        </div>
      )}
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    }>
      <ExploreContent />
    </Suspense>
  );
}
