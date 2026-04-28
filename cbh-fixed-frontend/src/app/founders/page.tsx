import FoundersSection from "@/components/founders/FoundersSection";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Meet the Founders — CBH", description: "The team behind CBH — building Cambodia's buyer-first supplier discovery platform." };

export default function FoundersPage() {
  return (
    <div>
      <div className="bg-ink py-16 sm:py-20 text-center">
        <p className="text-sm font-semibold text-brand-400 uppercase tracking-widest mb-3">Our Story</p>
        <h1 className="font-display text-4xl sm:text-5xl text-white mb-4">Meet the Founders</h1>
        <p className="text-white/60 max-w-lg mx-auto">Two Cambodians on a mission to connect buyers with the best local suppliers — transparently, sustainably, and efficiently.</p>
      </div>
      <FoundersSection />
    </div>
  );
}
