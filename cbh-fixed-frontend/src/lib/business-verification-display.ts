import type { Supplier } from "@/types";

/** Navbar + business dashboard sidebar: same badge copy and styling */
export function businessVerificationBadge(biz: Supplier): { label: string; className: string } {
  const v = String(biz.verificationStatus ?? "pending");
  if (biz.verified || v === "verified" || v === "approved") {
    return { label: "Verified", className: "bg-brand-50 text-brand-600 border-brand-200" };
  }
  if (v === "pending") {
    return { label: "Pending review", className: "bg-amber-50 text-amber-800 border-amber-200" };
  }
  if (v === "rejected") {
    return { label: "Not approved", className: "bg-red-50 text-red-700 border-red-200" };
  }
  if (v === "revoked") {
    return { label: "Unpublished", className: "bg-stone-100 text-stone-700 border-stone-200" };
  }
  return { label: "Pending review", className: "bg-amber-50 text-amber-800 border-amber-200" };
}
