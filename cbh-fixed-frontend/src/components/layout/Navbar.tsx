"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown, Leaf, LayoutDashboard, LogOut, Bell } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getMyBusiness, getUnreadCount } from "@/lib/api";
import { onProfileUpdated } from "@/lib/data-events";
import { logoutAndRefresh } from "@/lib/logout";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const exploreLinks = [
  { label: "Startups", href: "/explore?tier=Startup", desc: "Early-stage local businesses", icon: "🚀" },
  { label: "SMEs", href: "/explore?tier=SME", desc: "Small & medium enterprises", icon: "🏪" },
  { label: "Companies", href: "/explore?tier=Company", desc: "Established organizations", icon: "🏢" },
];

const navLinks = [
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Founders", href: "/founders" },
  { label: "Contact", href: "/feedback" },
];

interface AuthUser {
  id: string;
  name: string;
  initials: string;
  role: string;
  avatarUrl: string | null;
  businessStatusLabel?: "Pending" | "Approved" | "Revoked" | "Rejected";
  businessStatusClassName?: string;
}

export default function Navbar() {
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0); // Step 1: Unread count state

  const dropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null); // Ref for interval cleanup

  const buildAuthUser = useCallback(async (userId: string, email: string): Promise<AuthUser> => {
    const { data } = await supabase
      .from("profiles")
      .select("name, role, avatar_url, pending_business")
      .eq("id", userId)
      .single();
    
    const p = (data ?? {}) as { name?: string; role?: string; avatar_url?: string | null; pending_business?: boolean };
    const name = p?.name ?? email.split("@")[0] ?? "User";
    const initials = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
    const shouldLoadBusinessStatus = p?.role === "business" || p?.pending_business === true;
    const myBusiness = shouldLoadBusinessStatus ? await getMyBusiness().catch(() => null) : null;
    const verification = String(myBusiness?.verificationStatus ?? "pending");
    const isApproved = Boolean(myBusiness && (myBusiness.verified || verification === "verified" || verification === "approved"));
    const businessStatusLabel =
      !myBusiness ? undefined :
      isApproved ? "Approved" :
      verification === "revoked" ? "Revoked" :
      verification === "rejected" ? "Rejected" :
      "Pending";
    const businessStatusClassName =
      !myBusiness ? undefined :
      isApproved ? "bg-brand-50 text-brand-700 border-brand-200" :
      verification === "revoked" ? "bg-stone-100 text-stone-700 border-stone-200" :
      verification === "rejected" ? "bg-red-50 text-red-700 border-red-200" :
      "bg-amber-50 text-amber-800 border-amber-200";

    return {
      id: userId,
      name,
      initials,
      role: p?.role ?? "buyer",
      avatarUrl: p?.avatar_url ? `${p.avatar_url}?t=${Date.now()}` : null,
      businessStatusLabel,
      businessStatusClassName,
    };
  }, []);

  // Step 3 logic wrapped in a reusable function
  const fetchUnreadCount = useCallback(async () => {
    try {
      const count = await getUnreadCount();
      setUnreadCount(count ?? 0);
    } catch (err) {
      // Ignore expected throttling noise while polling.
      const message = err instanceof Error ? err.message.toLowerCase() : "";
      if (!message.includes("too many requests")) {
        console.error("Failed to fetch unread count", err);
      }
    }
  }, []);

  // Listen for profile updates
  useEffect(() => {
    const unsubscribe = onProfileUpdated((detail) => {
      if (detail?.name || detail?.avatarUrl) {
        setAuthUser(prev => prev ? {
          ...prev,
          name: detail.name ?? prev.name,
          avatarUrl: detail.avatarUrl ?? prev.avatarUrl,
          initials: detail.name 
            ? detail.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
            : prev.initials
        } : null);
        return;
      }

      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session?.user) {
          try {
            const u = await buildAuthUser(session.user.id, session.user.email ?? "");
            setAuthUser(u);
          } catch { /* silent */ }
        }
      });
    });

    return unsubscribe;
  }, [buildAuthUser]);

  // Auth & Polling logic
  useEffect(() => {
    const startPolling = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      fetchUnreadCount();
      pollRef.current = setInterval(() => fetchUnreadCount(), 30000);
    };

    const stopPolling = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      setUnreadCount(0);
    };

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        try {
          const u = await buildAuthUser(session.user.id, session.user.email ?? "");
          setAuthUser(u);
          startPolling();
        } catch { setAuthUser(null); }
      }
      setAuthReady(true);
    });

    // Auth State Change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        setAuthUser(null);
        stopPolling(); // Step 4: Clear interval and reset count
        setAuthReady(true);
        return;
      }
      
      try {
        const u = await buildAuthUser(session.user.id, session.user.email ?? "");
        setAuthUser(u);
        startPolling();
      } catch {
        setAuthUser(null);
      }
      setAuthReady(true);
    });

    return () => {
      subscription.unsubscribe();
      stopPolling();
    };
  }, [buildAuthUser, fetchUnreadCount]);

  // UI Handlers
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const handleLogout = async () => {
    setUserMenuOpen(false);
    setAuthUser(null);
    setUnreadCount(0);
    await logoutAndRefresh("/");
  };

  const dashboardHref =
    authUser?.role === "admin" ? "/admin" :
    authUser?.role === "business" ? "/business-dashboard" : "/dashboard";
  const profileHref =
    authUser?.role === "admin" ? "/admin" :
    authUser?.role === "business" ? "/business-dashboard?tab=settings" : "/dashboard?tab=settings";

  const AvatarCircle = ({ size = "sm" }: { size?: "sm" | "md" }) => {
    const dim = size === "md" ? "w-9 h-9 text-sm" : "w-7 h-7 text-xs";
    return (
      <div className={cn("rounded-full bg-brand-600 flex items-center justify-center text-white font-bold overflow-hidden shrink-0", dim)}>
        <img src={authUser?.avatarUrl || "/default-avatar.svg"} alt="Profile" className="w-full h-full object-cover" />
      </div>
    );
  };

  return (
    <header className={cn(
      "sticky top-0 z-50 w-full transition-all duration-300",
      scrolled ? "bg-white/90 backdrop-blur-md border-b border-surface-200 shadow-soft" : "bg-white border-b border-surface-200"
    )}>
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group shrink-0">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center group-hover:bg-brand-700 transition-colors">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <span className="font-display text-xl text-ink">CBH</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
          <div ref={dropdownRef} className="relative">
            <button onClick={() => setDropdownOpen(p => !p)}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink rounded-lg hover:bg-surface-50 transition-colors">
              Explore <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", dropdownOpen && "rotate-180")} />
            </button>
            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl border border-surface-200 shadow-lift p-2 animate-slide-down">
                {exploreLinks.map(link => (
                  <Link key={link.href} href={link.href} onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-50 transition-colors">
                    <span className="text-lg">{link.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-ink">{link.label}</p>
                      <p className="text-xs text-ink-faint">{link.desc}</p>
                    </div>
                  </Link>
                ))}
                <div className="border-t border-surface-100 mt-1 pt-1">
                  <Link href="/explore" onClick={() => setDropdownOpen(false)}
                    className="block px-3 py-2 text-xs text-brand-600 hover:underline font-medium">
                    View all suppliers →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {navLinks.map(link => (
            <Link key={link.href} href={link.href}
              className="px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink rounded-lg hover:bg-surface-50 transition-colors">
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right: auth */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {!authReady ? (
            <div className="w-7 h-7 rounded-full bg-surface-100 animate-pulse" />
          ) : authUser ? (
            <div ref={userMenuRef} className="relative flex items-center gap-1">
              
              {/* Step 5: Bell with Notification Badge */}
              <div className="relative">
                <button className="p-2 rounded-lg hover:bg-surface-50 text-ink-muted">
                  <Bell className="w-4 h-4" />
                </button>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold border-2 border-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>

              <button onClick={() => setUserMenuOpen(p => !p)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-surface-50 transition-colors">
                <AvatarCircle />
                <span className="text-sm font-medium text-ink">{authUser.name.split(" ")[0]}</span>
                {authUser.businessStatusLabel && authUser.businessStatusClassName && (
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium", authUser.businessStatusClassName)}>
                    {authUser.businessStatusLabel}
                  </span>
                )}
                <ChevronDown className={cn("w-3.5 h-3.5 text-ink-faint transition-transform", userMenuOpen && "rotate-180")} />
              </button>

              {userMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-52 bg-white rounded-2xl border border-surface-200 shadow-lift p-2 animate-slide-down">
                  <Link
                    href={profileHref}
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 border-b border-surface-100 mb-1 rounded-xl hover:bg-surface-50 transition-colors"
                  >
                    <AvatarCircle size="md" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-ink truncate">{authUser.name}</p>
                      <p className="text-[10px] text-ink-faint capitalize">{authUser.role}</p>
                      {authUser.businessStatusLabel && authUser.businessStatusClassName && (
                        <span className={cn("mt-1 inline-flex text-[10px] px-1.5 py-0.5 rounded-full border font-medium", authUser.businessStatusClassName)}>
                          {authUser.businessStatusLabel}
                        </span>
                      )}
                    </div>
                  </Link>
                  <Link href={dashboardHref} onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-50 text-sm text-ink transition-colors">
                    <LayoutDashboard className="w-4 h-4 text-ink-faint" /> Dashboard
                  </Link>
                  <div className="border-t border-surface-100 mt-1 pt-1">
                    <button onClick={handleLogout}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 text-sm text-red-600 transition-colors w-full text-left">
                      <LogOut className="w-4 h-4" /> Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/auth/login"><Button variant="ghost" size="sm">Log in</Button></Link>
              <Link href="/auth/signup"><Button variant="primary" size="sm">Get started</Button></Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden p-2 rounded-lg hover:bg-surface-50 text-ink"
          onClick={() => setMobileOpen(p => !p)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-surface-200 bg-white animate-slide-down">
          <div className="max-w-7xl mx-auto px-4 py-3 space-y-1">
            {navLinks.map(link => (
              <Link key={link.href} href={link.href}
                className="block px-3 py-2.5 text-sm font-medium text-ink rounded-xl hover:bg-surface-50">
                {link.label}
              </Link>
            ))}
            <div className="px-3 pt-1 pb-0.5">
              <p className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-1">Explore</p>
              {exploreLinks.map(link => (
                <Link key={link.href} href={link.href}
                  className="block px-3 py-2 text-sm text-ink-muted rounded-xl hover:bg-surface-50">
                  {link.icon} {link.label}
                </Link>
              ))}
            </div>
            {authReady && (
              authUser ? (
                <div className="space-y-1 pt-2 pb-1 border-t border-surface-100">
                  <Link href={profileHref} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-surface-50">
                    <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                      <img src={authUser.avatarUrl || "/default-avatar.svg"} alt="Profile" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink">{authUser.name}</p>
                      <p className="text-xs text-ink-faint capitalize">{authUser.role}</p>
                      {authUser.businessStatusLabel && authUser.businessStatusClassName && (
                        <span className={cn("mt-1 inline-flex text-[10px] px-1.5 py-0.5 rounded-full border font-medium", authUser.businessStatusClassName)}>
                          {authUser.businessStatusLabel}
                        </span>
                      )}
                    </div>
                  </Link>
                  <Link href={dashboardHref}
                    className="block px-3 py-2 text-sm text-ink-muted rounded-xl hover:bg-surface-50">
                    Dashboard
                  </Link>
                  <button onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-sm text-red-500 rounded-xl hover:bg-red-50 transition-colors">
                    Log out
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 pt-2 pb-1 border-t border-surface-100">
                  <Link href="/auth/login" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">Log in</Button>
                  </Link>
                  <Link href="/auth/signup" className="flex-1">
                    <Button variant="primary" size="sm" className="w-full">Get started</Button>
                  </Link>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </header>
  );
}