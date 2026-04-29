"use client";
import { useEffect, useMemo, useState } from "react";
import { cn, ecoLevel, ecoScoreBg } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { Leaf, RefreshCw } from "lucide-react";
import { updateEcoScore } from "@/lib/api";
import type { Supplier } from "@/types";

interface Section {
  id: string;
  label: string;
  icon: string;
  maxPoints: number;
  questions: { id: string; text: string; points: number }[];
}

const sections: Section[] = [
  {
    id: "packaging",
    label: "Packaging & Materials",
    icon: "📦",
    maxPoints: 20,
    questions: [
      { id: "p1", text: "We use biodegradable or compostable packaging", points: 8 },
      { id: "p2", text: "We have eliminated single-use plastics", points: 7 },
      { id: "p3", text: "We offer minimal/recycled packaging options", points: 5 },
    ],
  },
  {
    id: "sourcing",
    label: "Sourcing & Products",
    icon: "🌿",
    maxPoints: 20,
    questions: [
      { id: "s1", text: "We source 50%+ ingredients/materials locally", points: 8 },
      { id: "s2", text: "We use certified organic or sustainable products", points: 7 },
      { id: "s3", text: "We avoid products with harmful chemicals", points: 5 },
    ],
  },
  {
    id: "energy",
    label: "Energy Usage",
    icon: "⚡",
    maxPoints: 15,
    questions: [
      { id: "e1", text: "We use renewable energy (solar, etc.)", points: 7 },
      { id: "e2", text: "We have energy-saving equipment/practices", points: 5 },
      { id: "e3", text: "We offset our carbon emissions", points: 3 },
    ],
  },
  {
    id: "waste",
    label: "Waste Management",
    icon: "♻️",
    maxPoints: 20,
    questions: [
      { id: "w1", text: "We have a composting/recycling program", points: 8 },
      { id: "w2", text: "We minimise food/product waste actively", points: 7 },
      { id: "w3", text: "We track and report waste metrics", points: 5 },
    ],
  },
  {
    id: "delivery",
    label: "Delivery & Logistics",
    icon: "🚚",
    maxPoints: 15,
    questions: [
      { id: "d1", text: "We use electric or low-emission vehicles", points: 7 },
      { id: "d2", text: "We optimise delivery routes to cut emissions", points: 5 },
      { id: "d3", text: "We offer local pickup to reduce delivery", points: 3 },
    ],
  },
  {
    id: "practices",
    label: "Business Practices",
    icon: "🤝",
    maxPoints: 10,
    questions: [
      { id: "pr1", text: "We have a published sustainability policy", points: 5 },
      { id: "pr2", text: "We train staff on eco-friendly practices", points: 5 },
    ],
  },
];

/** Find one subset of questions whose points sum exactly to target (deterministic fallback for ambiguous sums). */
function idsForSectionTotal(
  questions: { id: string; points: number }[],
  target: number,
): Set<string> {
  const found = new Set<string>();
  if (questions.length === 0 || target < 0) return found;

  let bestMask: number | null = null;
  const n = questions.length;
  for (let mask = 0; mask < 1 << n; mask++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) sum += questions[i].points;
    }
    if (sum !== target) continue;
    if (bestMask === null || mask < bestMask) bestMask = mask;
  }
  if (bestMask === null) return found;
  for (let i = 0; i < n; i++) {
    if (bestMask & (1 << i)) found.add(questions[i].id);
  }
  return found;
}

function hydrateChecked(initialBreakdown?: Record<string, number>): Set<string> {
  const out = new Set<string>();
  if (!initialBreakdown) return out;
  for (const sec of sections) {
    const t = Math.round(Number(initialBreakdown[sec.id] ?? 0));
    idsForSectionTotal(sec.questions, t).forEach((id) => out.add(id));
  }
  return out;
}

export default function EcoScoreQuestionnaire({
  businessId,
  initialBreakdown,
  onSaved,
}: {
  businessId?: string;
  initialBreakdown?: Record<string, number>;
  onSaved?: (supplier: Supplier) => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(() => hydrateChecked(initialBreakdown));
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setChecked(hydrateChecked(initialBreakdown));
  }, [
    initialBreakdown?.packaging,
    initialBreakdown?.sourcing,
    initialBreakdown?.energy,
    initialBreakdown?.waste,
    initialBreakdown?.delivery,
    initialBreakdown?.practices,
  ]);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const breakdown = useMemo(
    () =>
      sections.reduce<Record<string, number>>((acc, sec) => {
        acc[sec.id] = sec.questions.filter((q) => checked.has(q.id)).reduce((sum, q) => sum + q.points, 0);
        return acc;
      }, {}),
    [checked],
  );

  const handleSave = async () => {
    setSaveError(null);
    if (!businessId) {
      setSaveError("Missing business.");
      return;
    }
    setSaving(true);
    setSubmitted(false);
    try {
      const updated = await updateEcoScore(businessId, {
        packaging: breakdown.packaging ?? 0,
        sourcing: breakdown.sourcing ?? 0,
        energy: breakdown.energy ?? 0,
        waste: breakdown.waste ?? 0,
        delivery: breakdown.delivery ?? 0,
        practices: breakdown.practices ?? 0,
      });
      onSaved?.(updated);
      setSubmitted(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not save eco score.";
      setSaveError(msg);
      setSubmitted(false);
    } finally {
      setSaving(false);
    }
  };

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const level = ecoLevel(total);

  const levelConfig = {
    High: { label: "High Eco", color: "text-brand-600", bg: "bg-brand-50 border-brand-200", bar: "bg-brand-500" },
    Medium: { label: "Medium Eco", color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200", bar: "bg-yellow-500" },
    Basic: { label: "Basic Eco", color: "text-red-500", bg: "bg-red-50 border-red-200", bar: "bg-red-400" },
  };
  const lc = levelConfig[level];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Questions */}
      <div className="lg:col-span-2 space-y-6">
        {sections.map((sec) => (
          <div key={sec.id} className="bg-white rounded-2xl border border-surface-200 shadow-soft p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">{sec.icon}</span>
              <div className="flex-1">
                <h3 className="font-semibold text-ink text-sm">{sec.label}</h3>
                <p className="text-xs text-ink-faint">Max {sec.maxPoints} pts</p>
              </div>
              <span className={cn("text-sm font-bold px-2 py-0.5 rounded-full", ecoScoreBg(breakdown[sec.id] / sec.maxPoints * 100))}>
                {breakdown[sec.id]}/{sec.maxPoints}
              </span>
            </div>
            <div className="space-y-2">
              {sec.questions.map((q) => (
                <label key={q.id} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-surface-50 transition-colors group">
                  <input
                    type="checkbox"
                    checked={checked.has(q.id)}
                    onChange={() => toggle(q.id)}
                    className="accent-brand-600 w-4 h-4 shrink-0"
                  />
                  <span className="text-sm text-ink flex-1">{q.text}</span>
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full shrink-0", checked.has(q.id) ? "bg-brand-100 text-brand-700" : "bg-surface-100 text-ink-faint")}>
                    +{q.points} pts
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}

        <div className="flex gap-3">
          <Button variant="primary" size="lg" onClick={handleSave} loading={saving}>
            Save Eco Score
          </Button>
          <Button variant="outline" size="lg" onClick={() => { setChecked(new Set()); setSubmitted(false); setSaveError(null); }} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Reset
          </Button>
        </div>
        {saveError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800">
            {saveError}
          </div>
        )}
        {submitted && !saveError && (
          <div className="bg-brand-50 border border-brand-200 rounded-xl px-4 py-3 text-sm text-brand-700 font-medium">
            ✅ Eco score saved! Your score of {total}/100 is now visible on your profile.
          </div>
        )}
      </div>

      {/* Score panel */}
      <div className="space-y-4">
        <div className={cn("rounded-2xl border p-5 space-y-4", lc.bg)}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-soft">
              <Leaf className={cn("w-6 h-6", lc.color)} />
            </div>
            <div>
              <p className="text-xs text-ink-faint">Your Eco Score</p>
              <p className={cn("text-3xl font-display", lc.color)}>{total} <span className="text-base font-body text-ink-faint">/ 100</span></p>
              <p className={cn("text-sm font-semibold", lc.color)}>{lc.label}</p>
            </div>
          </div>

          <div className="h-2 bg-white rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all duration-500", lc.bar)} style={{ width: `${total}%` }} />
          </div>

          <div className="text-xs text-ink-faint space-y-1">
            <div className="flex justify-between"><span>0–40</span><span className="text-red-500">Basic</span></div>
            <div className="flex justify-between"><span>41–70</span><span className="text-yellow-600">Medium</span></div>
            <div className="flex justify-between"><span>71–100</span><span className="text-brand-600">High</span></div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="bg-white rounded-2xl border border-surface-200 shadow-soft p-4 space-y-3">
          <h3 className="text-sm font-semibold text-ink">Score Breakdown</h3>
          {sections.map((sec) => (
            <div key={sec.id}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-ink-muted">{sec.icon} {sec.label}</span>
                <span className="font-medium text-ink">{breakdown[sec.id]}/{sec.maxPoints}</span>
              </div>
              <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-400 rounded-full transition-all duration-300"
                  style={{ width: `${sec.maxPoints > 0 ? (breakdown[sec.id] / sec.maxPoints) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
