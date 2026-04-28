"use client";
import { useState, useEffect, useRef } from "react";
import { Sparkles, Loader2, Search } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export interface SmartResult {
  id: string;
  name: string;
  tagline: string;
  category: string;
  location_city: string;
  logo_url: string | null;
  eco_score_overall: number;
  eco_level: string;
  services: string[];
  rating: number;
  is_verified: boolean;
  matchScore: number;
  matchReasons: string[];
}

interface Props {
  onSelect: (result: SmartResult) => void;
}

const EXAMPLES = [
  "I need catering for a wedding with 200 guests",
  "Looking for eco-friendly packaging for my bakery",
  "Bulk ingredients for a restaurant kitchen",
  "Event equipment rental for a corporate party",
];

export default function SmartSearchBar({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SmartResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      setSearched(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const runSearch = async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/search/smart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q, limit: 8 }),
      });
      const json = await res.json();
      setResults(json.data ?? []);
      setSearched(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Heading */}
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-5 h-5 text-brand-500" />
        <h2 className="font-semibold text-ink text-base">Smart supplier match</h2>
      </div>
      <p className="text-sm text-ink-muted">
        Describe what you need in plain language and we'll recommend the best matching suppliers.
      </p>

      {/* Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. I need bulk food packaging for my café..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-500 animate-spin" />
        )}
      </div>

      {/* Example chips */}
      {!searched && query.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setQuery(ex)}
              className="text-xs px-3 py-1.5 rounded-full bg-surface-100 hover:bg-brand-50 hover:text-brand-700 border border-surface-200 hover:border-brand-300 text-ink-muted transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {searched && results.length === 0 && !loading && (
        <p className="text-sm text-ink-muted text-center py-4">
          No matching suppliers found. Try different words or{" "}
          <button
            className="text-brand-600 hover:underline"
            onClick={() => { setQuery(""); setSearched(false); }}
          >
            browse all suppliers
          </button>.
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-ink-faint">
            {results.length} supplier{results.length !== 1 ? "s" : ""} matched — click to send a request
          </p>
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => onSelect(r)}
              className="w-full bg-white border border-surface-200 hover:border-brand-400 rounded-2xl p-4 text-left transition-all hover:shadow-soft group"
            >
              <div className="flex items-start gap-3">
                {/* Logo */}
                <div className="w-10 h-10 rounded-xl bg-surface-100 shrink-0 overflow-hidden">
                  {r.logo_url
                    ? <img src={r.logo_url} alt={r.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center font-bold text-brand-600">{r.name[0]}</div>
                  }
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-ink">{r.name}</span>
                    {r.is_verified && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-brand-50 text-brand-700 rounded-full border border-brand-200">Verified</span>
                    )}
                  </div>
                  <p className="text-xs text-ink-muted mt-0.5">{r.category} · {r.location_city} · Eco {r.eco_score_overall}/100</p>

                  {/* Match reasons */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {r.matchReasons.map((reason) => (
                      <span key={reason} className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full">
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Score pill */}
                {r.matchScore > 0 && (
                  <span className="text-xs px-2 py-1 bg-brand-50 text-brand-700 rounded-lg border border-brand-100 shrink-0">
                    {Math.min(r.matchScore, 99)}% match
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}