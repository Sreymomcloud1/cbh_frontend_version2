"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin, CheckCircle, Leaf, Package, Handshake, TrendingUp } from "lucide-react";
import type { Supplier } from "@/types";
import Button from "@/components/ui/Button";
import { BusinessMedia } from "@/components/ui/BusinessMedia";
import { ecoScoreBg, cn } from "@/lib/utils";
import { freshSupplierHref } from "@/lib/data-events";

interface SupplierCardProps {
  supplier: Supplier;
}

export default function SupplierCard({ supplier }: SupplierCardProps) {
  const router = useRouter();

  return (
    <div className="bg-white rounded-2xl border border-surface-200 shadow-soft hover:shadow-card hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group flex flex-col">
      {/* Image */}
      <div className="relative h-44 overflow-hidden bg-surface-100">
        <BusinessMedia
          fit="cover"
          src={supplier.gallery[0] || supplier.logo}
          alt={supplier.name}
          name={supplier.name}
          className="h-full w-full"
          imgClassName="group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
          {supplier.discountPercent && (
            <span className="bg-brand-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">{supplier.discountPercent}% off</span>
          )}
          {supplier.investment.enabled && (
            <span className="bg-purple-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
              <TrendingUp className="w-2.5 h-2.5" /> Invest
            </span>
          )}
          {supplier.collaboration.enabled && (
            <span className="bg-blue-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
              <Handshake className="w-2.5 h-2.5" /> Collab
            </span>
          )}
        </div>
        <div className="absolute top-3 right-3">
          <span className={`text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1 ${ecoScoreBg(supplier.ecoScore.overall)}`}>
            <Leaf className="w-3 h-3" /> {supplier.ecoScore.overall}
          </span>
        </div>
        <div className="absolute bottom-3 left-3 w-9 h-9 rounded-xl border-2 border-white shadow-soft overflow-hidden bg-white">
          <BusinessMedia
            fit="avatar"
            src={supplier.logo}
            alt={`${supplier.name} logo`}
            name={supplier.name}
            className="h-full w-full rounded-xl bg-white"
            avatarTextClassName="text-sm"
          />
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 gap-2.5">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-ink text-sm leading-snug line-clamp-1">{supplier.name}</h3>
            {supplier.verified && <CheckCircle className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />}
          </div>
          <p className="text-xs text-ink-faint mt-0.5 line-clamp-2">{supplier.tagline}</p>
        </div>

        <div className="flex items-center gap-2 text-xs text-ink-faint flex-wrap">
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{supplier.locationDetail || supplier.location}</span>
          <span className="text-surface-200">·</span>
          <span>{supplier.tier}</span>
          {supplier.bulkSupport && (
            <><span className="text-surface-200">·</span><span className="flex items-center gap-1 text-brand-600 font-medium"><Package className="w-3 h-3" /> Bulk</span></>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {supplier.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="bg-surface-100 text-ink-muted text-xs px-2 py-0.5 rounded-full">{tag}</span>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-yellow-500 font-semibold">{"★".repeat(Math.round(supplier.rating))}</span>
          <span className="text-ink font-medium">{supplier.rating.toFixed(1)}</span>
          <span className="text-ink-faint">({supplier.reviewCount})</span>
        </div>

        <div className="flex gap-2 mt-auto pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 w-full text-xs"
            onClick={() => router.push(freshSupplierHref(supplier.id))}
          >
            View
          </Button>
          <Link href={`/request?supplier=${supplier.id}&name=${encodeURIComponent(supplier.name)}`} className="flex-1">
            <Button variant="primary" size="sm" className="w-full text-xs">Request Quote</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
