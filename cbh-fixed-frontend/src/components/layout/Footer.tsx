"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Leaf, Mail, Phone, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabase";

const footerLinks = {
  Platform: [
    { label: "Explore Suppliers", href: "/explore" },
    { label: "Request a Quote", href: "/request" },
    { label: "How It Works", href: "/#how-it-works" },
    { label: "Register Business", href: "/business/register", key: "registerBusiness" },
  ],
  Company: [
    { label: "About Us", href: "/#about" },
    { label: "Meet the Founders", href: "/founders" },
    { label: "Feedback", href: "/feedback" },
    { label: "Business Dashboard", href: "/business-dashboard" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "Cookie Policy", href: "#" },
  ],
};

export default function Footer() {
  const [dashboardLink, setDashboardLink] = useState<{ label: string; href: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || !mounted) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();
      const role = (profile as { role?: string } | null)?.role ?? "buyer";
      if (!mounted) return;
      if (role === "business") setDashboardLink({ label: "Business Dashboard", href: "/business-dashboard" });
      else if (role === "admin") setDashboardLink({ label: "Admin Dashboard", href: "/admin" });
    };
    loadRole();
    return () => { mounted = false; };
  }, []);

  const platformLinks = useMemo(
    () => footerLinks.Platform.map((link) => {
      if ((link as { key?: string }).key !== "registerBusiness" || !dashboardLink) return link;
      return dashboardLink;
    }),
    [dashboardLink]
  );

  const sections = {
    ...footerLinks,
    Platform: platformLinks,
  };

  return (
    <footer className="bg-ink text-white mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
          <div className="md:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center"><Leaf className="w-4 h-4 text-white" /></div>
              <span className="font-display text-xl">CBH</span>
            </Link>
            <p className="text-sm text-white/60 leading-relaxed max-w-xs">Cambodia's trusted B2B marketplace — fast, easy, and eco-friendly.</p>
            <div className="space-y-2 text-sm text-white/60">
              <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-brand-400 shrink-0" />Phnom Penh, Cambodia</div>
              <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-brand-400 shrink-0" />hello@cbh.kh</div>
              <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-brand-400 shrink-0" />+855 12 000 000</div>
            </div>
          </div>
          {Object.entries(sections).map(([section, links]) => (
            <div key={section}>
              <h3 className="text-sm font-semibold mb-4 text-white/80">{section}</h3>
              <ul className="space-y-2">
                {links.map(link => (
                  <li key={link.label}><Link href={link.href} className="text-sm text-white/50 hover:text-white transition-colors">{link.label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-white/40">
          <p>© {new Date().getFullYear()} CBH. All rights reserved.</p>
          <div className="flex items-center gap-1"><span>Built with</span><Leaf className="w-3.5 h-3.5 text-brand-400" /><span>for local businesses</span></div>
        </div>
      </div>
    </footer>
  );
}
