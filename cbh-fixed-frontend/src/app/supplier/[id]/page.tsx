import { notFound } from "next/navigation";
import { mockSuppliers } from "@/data/mockData";
import SupplierDetails from "@/components/supplier/SupplierDetails";
import type { Metadata } from "next";
import type { Supplier } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ id: string }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformBusiness(b: any): Supplier {
  return {
    id: b.id,
    name: b.name,
    tagline: b.tagline ?? "",
    description: b.description ?? "",
    category: b.category,
    subCategories: b.sub_categories ?? [],
    tier: b.tier,
    location: b.location_city ?? "",
    locationDetail: b.location_detail ?? "",
    mapUrl: b.map_url ?? undefined,
    logo: b.logo_url ?? "",
    gallery: b.gallery_urls ?? [],
    ecoScore: {
      overall: b.eco_score_overall ?? 0,
      level: b.eco_level ?? "Basic",
      breakdown:
        b.eco_breakdown ?? {
          packaging: 0,
          sourcing: 0,
          energy: 0,
          waste: 0,
          delivery: 0,
          practices: 0,
        },
    },
    ecoDescription: b.eco_description ?? undefined,
    taxId: b.tax_id ?? undefined,
    discountPercent: b.discount_percent ?? undefined,
    bulkSupport: b.bulk_support ?? false,
    bulkCapacity: b.bulk_capacity ?? undefined,
    verified: b.is_verified ?? false,
    tags: b.tags ?? [],
    services: b.services ?? [],
    contactEmail: b.contact_email ?? "",
    contactPhone: b.contact_phone ?? "",
    website: b.website_url ?? undefined,
    facebookUrl: b.facebook_url ?? undefined,
    telegramUrl: b.telegram_url ?? undefined,
    rating: b.rating ?? 0,
    reviewCount: b.review_count ?? 0,
    isActive: b.is_active ?? true,
    notifyByEmail: b.notify_by_email ?? true,
    notifyByPhone: b.notify_by_phone ?? false,
    phone: b.contact_phone ?? "",
    foundedYear: typeof b.founded_year === "number" ? b.founded_year : undefined,
    collaboration: {
      enabled: b.open_for_collaboration ?? false,
      lookingFor: b.collaboration_types ?? [],
      description: b.collaboration_description ?? undefined,
    },
    investment: {
      enabled: b.open_for_investment ?? false,
      amount: b.investment_amount ?? undefined,
      description: b.investment_description ?? undefined,
    },
  };
}

async function getSupplier(id: string): Promise<Supplier | null> {
  // Check mock data first (handles sup-001, sup-002, etc.)
  const mock = mockSuppliers.find(s => s.id === id);
  if (mock) return mock;

  // Otherwise fetch from real API (handles UUIDs)
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"}/businesses/${id}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ? transformBusiness(json.data) : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supplier = await getSupplier(id);
  if (!supplier) return { title: "Supplier Not Found" };
  return { title: `${supplier.name} — CBH`, description: supplier.tagline };
}

export default async function SupplierPage({ params }: Props) {
  const { id } = await params;
  const supplier = await getSupplier(id);
  if (!supplier) notFound();
  return <SupplierDetails supplier={supplier} />;
}