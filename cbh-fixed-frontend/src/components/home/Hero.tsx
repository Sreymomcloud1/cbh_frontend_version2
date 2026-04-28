"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles, Send, X, Store, MapPin, Leaf } from "lucide-react";
import { heroBanners } from "@/data/mockData";
import { cn } from "@/lib/utils";

// Suggested quick-start prompts shown in the chatbot
const QUICK_PROMPTS = [
  "I need catering for 200 people at a wedding in Phnom Penh",
  "Looking for eco-friendly packaging suppliers for my restaurant",
  "Need bulk ingredients for a corporate event next month",
  "Event rental equipment for an outdoor festival",
];

interface SuggestedSupplier {
  id: string;
  name: string;
  category: string;
  location: string;
  ecoScore: number;
  services: string[];
  logo: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  suppliers?: SuggestedSupplier[];
}

export default function Hero() {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const go = (idx: number) => {
    if (transitioning) return;
    setTransitioning(true);
    setTimeout(() => { setCurrent(idx); setTransitioning(false); }, 300);
  };

  useEffect(() => {
    const t = setInterval(() => go((current + 1) % heroBanners.length), 4500);
    return () => clearInterval(t);
  }, [current]);

  useEffect(() => {
    if (showChat) setTimeout(() => inputRef.current?.focus(), 100);
  }, [showChat]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const openChat = (prefill?: string) => {
    setShowChat(true);
    if (prefill) setInput(prefill);
  };

  const sendMessage = async (text?: string) => {
    const query = (text ?? input).trim();
    if (!query || loading) return;
    setInput("");

    const userMsg: ChatMessage = { role: "user", content: query };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // Fetch suppliers to give the AI real data to suggest from
      const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
      const suppliersRes = await fetch(`${BASE}/businesses?limit=50`);
      const suppliersJson = await suppliersRes.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const suppliers: SuggestedSupplier[] = (suppliersJson.data?.businesses ?? []).map((b: any) => ({
        id: b.id,
        name: b.name,
        category: b.category,
        location: b.location_city,
        ecoScore: b.eco_score_overall ?? 0,
        services: b.services ?? [],
        logo: b.logo_url ?? "",
      }));

      const supplierContext = suppliers.length > 0
        ? `Available suppliers on CBH: ${JSON.stringify(suppliers.slice(0, 20))}`
        : "No suppliers currently listed on the platform.";

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are CBH's smart supplier matching assistant for Cambodia. Your job is to understand what a buyer needs and suggest the best matching suppliers from CBH's platform.

${supplierContext}

Rules:
1. Be warm, helpful, and conversational.
2. If suppliers match, suggest up to 3 by name and explain WHY they match (what services, location, eco score).
3. Return your reply as JSON with this exact shape:
   {"message": "your friendly reply text here", "suggested_ids": ["id1", "id2"]}
   where suggested_ids is a list of matching supplier IDs from the data above (or empty array if none match).
4. If no suppliers match yet, encourage the user and say the platform is growing.
5. Keep your message under 100 words — friendly and specific.
6. ONLY return valid JSON, no extra text.`,
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: query },
          ],
        }),
      });

      const aiData = await response.json();
      const rawText = aiData.content?.[0]?.text ?? "{}";

      let parsed: { message: string; suggested_ids?: string[] } = { message: "" };
      try {
        parsed = JSON.parse(rawText.replace(/```json|```/g, "").trim());
      } catch {
        parsed = { message: rawText, suggested_ids: [] };
      }

      const suggestedSuppliers = suppliers.filter(s => (parsed.suggested_ids ?? []).includes(s.id));

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: parsed.message || "I found some options that might help you!",
        suppliers: suggestedSuppliers.length > 0 ? suggestedSuppliers : undefined,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I had trouble searching right now. You can still browse suppliers in Explore, or fill in the Request a Quote form directly.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative overflow-hidden bg-ink min-h-[88vh] flex items-center">
      {/* Background slider */}
      <div className="absolute inset-0">
        {heroBanners.map((banner, i) => (
          <div key={i} className={cn("absolute inset-0 transition-opacity duration-700", current === i ? "opacity-100" : "opacity-0")}>
            <img src={banner.image} alt={banner.label} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/60 to-transparent" />
          </div>
        ))}
      </div>

      <button onClick={() => go((current - 1 + heroBanners.length) % heroBanners.length)}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button onClick={() => go((current + 1) % heroBanners.length)}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
        <ChevronRight className="w-5 h-5" />
      </button>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {heroBanners.map((_, i) => (
          <button key={i} onClick={() => go(i)}
            className={cn("rounded-full transition-all", current === i ? "w-6 h-2 bg-white" : "w-2 h-2 bg-white/40 hover:bg-white/60")} />
        ))}
      </div>

      {/* Hero content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-20 w-full">
        <div className="max-w-2xl">
          <div className={cn("inline-flex items-center gap-2 bg-white/10 text-white rounded-full px-4 py-1.5 text-sm font-medium mb-6 transition-opacity duration-300", transitioning ? "opacity-0" : "opacity-100")}>
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
            {heroBanners[current].label}
          </div>

          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white leading-tight mb-5 animate-fade-in">
            Find the Right Local Supplier for Your{" "}
            <span className="text-brand-400">Event, Business,</span>{" "}
            or Project
          </h1>

          <p className="text-lg text-white/70 leading-relaxed max-w-xl mb-8">
            Compare verified suppliers, check eco scores, and send requests in minutes. Connect with trusted local businesses in Cambodia.
          </p>

          <div className="flex flex-wrap gap-3 mb-10">
            <Link href="/explore">
              <Button size="lg" className="bg-white/10 hover:bg-white/20 text-white border border-white/20 gap-2">
                Explore Suppliers
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>

            
          </div>

  
        </div>
      </div>

      {/* ── AI Chat Panel ─────────────────────────────────────────────────── */}
      {showChat && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={() => setShowChat(false)} />

          <div className="relative w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-lift flex flex-col max-h-[92vh] sm:max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-200">
              <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink text-sm">CBH Smart Quote Assistant</p>
                <p className="text-xs text-ink-muted">Tell me what you need — I'll find the right suppliers for you</p>
              </div>
              <button onClick={() => setShowChat(false)} className="w-8 h-8 rounded-full hover:bg-surface-100 flex items-center justify-center transition-colors">
                <X className="w-4 h-4 text-ink-muted" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
              {messages.length === 0 && (
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4 text-brand-600" />
                    </div>
                    <div className="bg-surface-50 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-ink max-w-xs sm:max-w-md">
                      Hi! Tell me what you&apos;re looking for — what product or service, when you need it, how many people, and your budget if you have one. I&apos;ll suggest the best suppliers from our platform. 🌿
                    </div>
                  </div>
                  {/* Quick prompt chips inside the chat */}
                  <div className="pl-10 flex flex-wrap gap-2">
                    {QUICK_PROMPTS.map(p => (
                      <button key={p} onClick={() => sendMessage(p)}
                        className="text-xs bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100 px-3 py-1.5 rounded-full transition-colors text-left">
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "")}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4 text-brand-600" />
                    </div>
                  )}
                  <div className={cn("flex flex-col gap-2 max-w-xs sm:max-w-md", msg.role === "user" ? "items-end" : "items-start")}>
                    <div className={cn(
                      "px-4 py-3 rounded-2xl text-sm",
                      msg.role === "user"
                        ? "bg-brand-600 text-white rounded-tr-sm"
                        : "bg-surface-50 text-ink rounded-tl-sm"
                    )}>
                      {msg.content}
                    </div>

                    {/* Suggested supplier cards */}
                    {msg.suppliers && msg.suppliers.length > 0 && (
                      <div className="space-y-2 w-full">
                        {msg.suppliers.map(s => (
                          <div key={s.id} className="bg-white border border-surface-200 rounded-2xl p-3 flex items-center gap-3 hover:border-brand-300 transition-colors">
                            <div className="w-10 h-10 rounded-xl bg-surface-100 overflow-hidden shrink-0">
                              {s.logo
                                ? <img src={s.logo} alt={s.name} className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center text-brand-600 font-bold">{s.name[0]}</div>
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-ink truncate">{s.name}</p>
                              <div className="flex items-center gap-2 text-xs text-ink-faint">
                                <span className="flex items-center gap-0.5"><Store className="w-3 h-3" /> {s.category}</span>
                                <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {s.location}</span>
                                <span className="flex items-center gap-0.5 text-brand-600"><Leaf className="w-3 h-3" /> {s.ecoScore}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => { setShowChat(false); router.push(`/supplier/${s.id}`); }}
                              className="text-xs text-brand-600 font-medium hover:underline shrink-0"
                            >
                              View →
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => { setShowChat(false); router.push(`/request`); }}
                          className="w-full text-xs text-center text-brand-600 hover:underline py-1"
                        >
                          Send a formal quote request to one of these →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-brand-600" />
                  </div>
                  <div className="bg-surface-50 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-surface-200 bg-white rounded-b-3xl">
              <div className="flex gap-2 items-end">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="e.g. I need food catering for 100 guests next month…"
                  className="flex-1 rounded-xl border border-surface-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  className="w-10 h-10 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 flex items-center justify-center text-white transition-colors shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-ink-faint mt-2 text-center">
                Demo mode — suggestions are based on real suppliers listed on CBH
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
