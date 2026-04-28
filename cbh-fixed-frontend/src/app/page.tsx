"use client";
import { useState, useEffect } from "react";
import Hero from "@/components/home/Hero";
import Categories from "@/components/home/Categories";
import HowItWorks from "@/components/home/HowItWorks";
import FoundersSection from "@/components/founders/FoundersSection";
import LoadingScreen from "@/components/loading/LoadingScreen";
import { mockSuppliers } from "@/data/mockData";
import SupplierCard from "@/components/supplier/SupplierCard";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { Clock, ShieldCheck, BarChart2, Package, Leaf, Target, Globe } from "lucide-react";
import type { Supplier } from "@/types";

const whyCards = [
  { icon: Clock,       title: "Save Time",          description: "Find and compare multiple suppliers in one place instead of searching everywhere.",        color: "bg-blue-50 text-blue-600"   },
  { icon: ShieldCheck, title: "Verified Suppliers",  description: "Every listed supplier is reviewed and verified before appearing on the platform.",        color: "bg-brand-50 text-brand-600" },
  { icon: BarChart2,   title: "Easy Comparison",     description: "Compare pricing, eco scores, and terms side by side to make informed decisions.",          color: "bg-purple-50 text-purple-600"},
  { icon: Package,     title: "Bulk Order Support",  description: "Many suppliers offer special rates and dedicated support for bulk orders.",                color: "bg-orange-50 text-orange-600"},
];

const values = [
  { icon: Leaf,   label: "Eco-First",    desc: "We prioritize suppliers with strong sustainability practices."                     },
  { icon: Target, label: "Local Focus",  desc: "Supporting local economies by connecting buyers with nearby businesses."           },
  { icon: Globe,  label: "Transparency", desc: "Clear eco scores, pricing, and supplier profiles — no surprises."                 },
];

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
    collaboration: { enabled: b.open_for_collaboration ?? false, lookingFor: b.collaboration_types ?? [] },
    investment: { enabled: b.open_for_investment ?? false },
  };
}

export default function HomePage() {
  const [loading,  setLoading]  = useState(true);
  // Start with 3 mock suppliers so the section is never empty
  const [featured, setFeatured] = useState<Supplier[]>(mockSuppliers.slice(0, 3));

  // Fetch real featured businesses from API, merge with mock as fallback
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"}/businesses?limit=6`
        );
        if (!res.ok) return;
        const json = await res.json();
        const real: Supplier[] = (json.data?.businesses ?? []).map(transformBusiness);
        if (real.length > 0) {
          // Real businesses first, fill remainder with mock if fewer than 3
          const realNames = new Set(real.map(r => r.name.toLowerCase()));
          const mockFill  = mockSuppliers.filter(m => !realNames.has(m.name.toLowerCase()));
          setFeatured([...real, ...mockFill].slice(0, 3));
        }
      } catch {
        // keep mock data on failure — already set as default
      }
    };
    load();
  }, []);

  return (
    <>
      {loading && <LoadingScreen onDone={() => setLoading(false)} />}
      <Hero />
      <Categories />

      {/* Why CBH */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl sm:text-4xl text-ink mb-3">Why Use CBH?</h2>
            <p className="text-ink-muted max-w-md mx-auto">Built for buyers who care about quality, sustainability, and efficiency.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {whyCards.map(card => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="bg-white rounded-2xl border border-surface-200 shadow-soft p-5 hover:shadow-card transition-shadow">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${card.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-ink mb-1.5">{card.title}</h3>
                  <p className="text-sm text-ink-muted leading-relaxed">{card.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Featured Suppliers — real businesses + mock fallback */}
      <section className="py-16 sm:py-20 bg-surface-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl text-ink mb-1">Featured Suppliers</h2>
              <p className="text-ink-muted">Top-rated, verified suppliers on the platform.</p>
            </div>
            <Link href="/explore" className="hidden sm:block">
              <Button variant="outline" size="sm">View all</Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {featured.map(s => <SupplierCard key={s.id} supplier={s} />)}
          </div>
        </div>
      </section>

      <HowItWorks />

      {/* Mission + Values */}
      <section id="about" className="py-16 sm:py-24 bg-surface-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-sm font-semibold text-brand-600 uppercase tracking-widest">Our Mission</span>
              <h2 className="font-display text-3xl sm:text-4xl text-ink mt-2 mb-4">Empowering Local Businesses Through Better Connections</h2>
              <p className="text-ink-muted leading-relaxed mb-4">CBH was built to close the gap between buyers with real needs and local suppliers with real solutions. We believe sustainable sourcing shouldn&apos;t be complicated — it should be accessible, transparent, and fast.</p>
              <p className="text-ink-muted leading-relaxed">Every supplier on our platform is reviewed for quality and sustainability. We surface eco scores, verified badges, and transparent pricing so you can make decisions you feel good about.</p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {values.map(v => {
                const Icon = v.icon;
                return (
                  <div key={v.label} className="flex gap-4 items-start bg-white rounded-2xl p-5 border border-surface-200 shadow-soft">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-brand-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-ink mb-1">{v.label}</h3>
                      <p className="text-sm text-ink-muted">{v.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <FoundersSection />

      {/* CTA Banner */}
      <section id="contact" className="py-16 sm:py-20 bg-brand-600">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="font-display text-3xl sm:text-4xl text-white mb-4">Ready to Find Your Ideal Supplier?</h2>
          <p className="text-brand-100 mb-8 max-w-xl mx-auto">Join buyers already using CBH to discover local suppliers, compare options, and request quotes in minutes.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/auth/signup">
              <Button size="lg" className="bg-white text-brand-700 hover:bg-brand-50 border-0">Create Free Account</Button>
            </Link>
            <Link href="/explore">
              <Button size="lg" className="bg-brand-700 text-white hover:bg-brand-800 border-0">Explore Suppliers</Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}