"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown, Leaf, LayoutDashboard, LogOut, Bell, Loader2, MessageCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getMyBusiness, getUnreadCount, listMyConversations } from "@/lib/api";
import { onProfileUpdated, onBusinessDataChanged } from "@/lib/data-events";
import { logoutAndRefresh } from "@/lib/logout";
import Button from "@/components/ui/Button";
import { BusinessMedia } from "@/components/ui/BusinessMedia";
import { businessVerificationBadge } from "@/lib/business-verification-display";
import type { Supplier, Conversation } from "@/types";
import { cn, formatTime, purposeColor, statusBadge } from "@/lib/utils";

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
  businessStatusLabel?: string;
  businessStatusClassName?: string;
}

function messagesInboxBasePath(role: string): string {
  return role === "business" ? "/business-dashboard" : "/dashboard";
}

function unreadMessagesFromOthers(conv: Conversation, userId: string): number {
  return (conv.messages ?? []).filter((m) => !m.read && m.senderId !== userId).length;
}

function counterpartName(conv: Conversation, role: string): string {
  return role === "business" ? (conv.buyerName || "Buyer") : (conv.supplierName || "Supplier");
}

function lastPreview(conv: Conversation): { text: string; at: string | null } {
  const msgs = conv.messages ?? [];
  if (!msgs.length) return { text: "No messages yet", at: null };
  const lm = msgs[msgs.length - 1];
  return {
    text: lm.content?.trim() || "Message",
    at: lm.timestamp || null,
  };
}

export default function Navbar() {
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0); // chats with unread (matches API)
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifConversations, setNotifConversations] = useState<Conversation[]>([]);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null); // Ref for interval cleanup

  const buildAuthUser = useCallback(async (userId: string, email: string): Promise<AuthUser> => {
    const { data } = await supabase
      .from("profiles")
      .select("name, role, avatar_url, pending_business")
      .eq("id", userId)
      .single();

    const p = (data ?? {}) as { name?: string; role?: string; avatar_url?: string | null; pending_business?: boolean };
    let name = p?.name ?? email.split("@")[0] ?? "User";
    const profileAvatarUrl = p?.avatar_url ? `${p.avatar_url.split("?")[0]}?t=${Date.now()}` : null;

    const shouldLoadBusinessStatus = p?.role === "business" || p?.pending_business === true;
    const myBusiness: Supplier | null = shouldLoadBusinessStatus
      ? await getMyBusiness().catch(() => null)
      : null;

    /** Match business-dashboard sidebar: listing name + logo, not buyer profile */
    let navAvatarUrl: string | null = profileAvatarUrl;
    if (myBusiness && (p?.role === "business" || p?.pending_business)) {
      name = myBusiness.name || name;
      navAvatarUrl = myBusiness.logo ? `${myBusiness.logo.split("?")[0]}?t=${Date.now()}` : null;
    }

    const initials = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

    const verFromBiz = myBusiness ? businessVerificationBadge(myBusiness) : null;

    return {
      id: userId,
      name,
      initials,
      role: p?.role ?? "buyer",
      avatarUrl: navAvatarUrl,
      businessStatusLabel: verFromBiz?.label,
      businessStatusClassName: verFromBiz?.className,
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

  // Listen for profile updates — re-fetch so business users keep business name/logo from listing
  useEffect(() => {
    const unsubscribe = onProfileUpdated((detail) => {
      if (detail?.name || detail?.avatarUrl) {
        void (async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user) return;
          try {
            setAuthUser(await buildAuthUser(session.user.id, session.user.email ?? ""));
          } catch {
            /* silent */
          }
        })();
        return;
      }

      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session?.user) {
          try {
            const u = await buildAuthUser(session.user.id, session.user.email ?? "");
            setAuthUser(u);
          } catch {
            /* silent */
          }
        }
      });
    });

    return unsubscribe;
  }, [buildAuthUser]);

  /** Logo / verification changes → refresh nav (badge + stale getMyBusiness) */
  useEffect(() => {
    const unsub = onBusinessDataChanged(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      try {
        const u = await buildAuthUser(session.user.id, session.user.email ?? "");
        setAuthUser(u);
      } catch {
        /* ignore */
      }
    });
    return unsub;
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
        setNotificationsOpen(false);
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
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotificationsOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => { setNotificationsOpen(false); }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    if (!notificationsOpen || !authUser) {
      if (!notificationsOpen) setNotifConversations([]);
      return undefined;
    }
    setNotifLoading(true);
    fetchUnreadCount();
    listMyConversations()
      .then((convs) => {
        if (cancelled) return;
        const uid = authUser.id;
        const filtered = convs
          .filter((c) => unreadMessagesFromOthers(c, uid) > 0)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 25);
        setNotifConversations(filtered);
      })
      .catch(() => { if (!cancelled) setNotifConversations([]); })
      .finally(() => { if (!cancelled) setNotifLoading(false); });
    return () => { cancelled = true; };
  }, [notificationsOpen, authUser, fetchUnreadCount]);

  const handleLogout = async () => {
    setUserMenuOpen(false);
    setNotificationsOpen(false);
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

  const NavbarIdentityAvatar = ({ size = "sm" }: { size?: "sm" | "md" }) => {
    if (!authUser) return null;
    const dim = size === "md" ? "w-9 h-9" : "w-7 h-7";
    const txt = size === "md" ? "text-sm" : "text-xs";
    return (
      <div className={cn("rounded-full overflow-hidden shrink-0 border border-surface-200/90 bg-white", dim)}>
        <BusinessMedia
          fit="avatar"
          src={authUser.avatarUrl}
          alt=""
          name={authUser.name}
          className="h-full w-full rounded-full bg-surface-100"
          avatarTextClassName={txt}
        />
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

        {/* Right: bell (all breakpoints when logged in), profile (md+), auth buttons, mobile menu */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {authReady && authUser && (
            <div ref={notifRef} className="relative">
              <button
                type="button"
                aria-label="Message notifications"
                aria-expanded={notificationsOpen}
                title="Messages"
                className="relative p-2 rounded-lg hover:bg-surface-50 text-ink-muted"
                onClick={() => {
                  setUserMenuOpen(false);
                  setDropdownOpen(false);
                  setNotificationsOpen((p) => !p);
                }}
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[1rem] h-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] leading-4 flex items-center justify-center font-bold border-2 border-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div
                  className={cn(
                    "absolute top-full mt-2 w-[min(calc(100vw-2rem),20rem)] sm:w-80 bg-white rounded-2xl border border-surface-200 shadow-lift animate-slide-down z-[70]",
                    "flex flex-col max-h-[min(440px,calc(100vh-5.5rem))] right-0",
                  )}
                >
                  <div className="px-4 py-3 border-b border-surface-100 shrink-0 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">Notifications</span>
                    <Link
                      href={`${messagesInboxBasePath(authUser.role)}?tab=messages`}
                      className="text-xs font-medium text-brand-600 hover:underline whitespace-nowrap"
                      onClick={() => setNotificationsOpen(false)}
                    >
                      View inbox
                    </Link>
                  </div>
                  <div className="overflow-y-auto flex-1 py-2">
                    {notifLoading ? (
                      <div className="flex flex-col items-center justify-center py-10 text-ink-muted gap-2">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <span className="text-xs">Loading…</span>
                      </div>
                    ) : notifConversations.length === 0 ? (
                      <div className="flex flex-col items-center text-center px-6 py-10 text-ink-muted">
                        <MessageCircle className="w-10 h-10 mb-2 opacity-40" aria-hidden />
                        <p className="text-sm font-medium text-ink">No new messages</p>
                        <p className="text-xs mt-1 text-ink-faint">
                          Conversations where someone replies to you appear here.
                        </p>
                      </div>
                    ) : (
                      <ul className="divide-y divide-surface-100">
                        {notifConversations.map((conv) => {
                          const n = unreadMessagesFromOthers(conv, authUser.id);
                          const lm = lastPreview(conv);
                          const href = `${messagesInboxBasePath(authUser.role)}?tab=messages&conv=${encodeURIComponent(conv.id)}`;
                          const label = counterpartName(conv, authUser.role);
                          return (
                            <li key={conv.id}>
                              <Link
                                href={href}
                                className="flex gap-3 px-4 py-3 hover:bg-surface-50 transition-colors"
                                onClick={() => {
                                  setNotificationsOpen(false);
                                  void fetchUnreadCount();
                                }}
                              >
                                <div className="w-9 h-9 rounded-xl bg-brand-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                                  {label[0]?.toUpperCase() ?? "?"}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-2 mb-0.5">
                                    <span className="text-sm font-semibold text-ink truncate">{label}</span>
                                    {lm.at && (
                                      <span className="text-[10px] text-ink-faint shrink-0">{formatTime(lm.at)}</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-ink-muted line-clamp-2">{lm.text}</p>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize", purposeColor(conv.purpose))}>
                                      {conv.purpose}
                                    </span>
                                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize", statusBadge(conv.status))}>
                                      {conv.status}
                                    </span>
                                    {n > 0 && (
                                      <span className="ml-auto min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                                        {n > 9 ? "9+" : n}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="hidden md:flex items-center gap-2">
            {!authReady ? (
              <div className="w-7 h-7 rounded-full bg-surface-100 animate-pulse" />
            ) : authUser ? (
              <div ref={userMenuRef} className="relative flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    setNotificationsOpen(false);
                    setUserMenuOpen((p) => !p);
                  }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-surface-50 transition-colors max-w-[min(100vw,20rem)]"
                >
                  <NavbarIdentityAvatar />
                  <span className="text-sm font-medium text-ink truncate min-w-0">{authUser.name}</span>
                  {authUser.businessStatusLabel && authUser.businessStatusClassName && (
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium", authUser.businessStatusClassName)}>
                      {authUser.businessStatusLabel}
                    </span>
                  )}
                  <ChevronDown className={cn("w-3.5 h-3.5 text-ink-faint transition-transform shrink-0", userMenuOpen && "rotate-180")} />
                </button>

                {userMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 w-52 bg-white rounded-2xl border border-surface-200 shadow-lift p-2 animate-slide-down z-[60]">
                    <Link
                      href={profileHref}
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 border-b border-surface-100 mb-1 rounded-xl hover:bg-surface-50 transition-colors"
                    >
                      <NavbarIdentityAvatar size="md" />
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
                        type="button"
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

          <button
            type="button"
            className="md:hidden p-2 rounded-lg hover:bg-surface-50 text-ink"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((p) => !p)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
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
                    <NavbarIdentityAvatar size="md" />
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
                    className="block px-3 py-2 text-sm text-ink-muted rounded-xl hover:bg-surface-50"
                    onClick={() => setMobileOpen(false)}>
                    Dashboard
                  </Link>
                  <Link href={`${messagesInboxBasePath(authUser.role)}?tab=messages`}
                    className="block px-3 py-2 text-sm text-ink-muted rounded-xl hover:bg-surface-50"
                    onClick={() => setMobileOpen(false)}>
                    Messages {unreadCount > 0 ? ` · ${unreadCount} new` : ""}
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