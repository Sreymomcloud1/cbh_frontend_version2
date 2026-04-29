"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Send, CheckCheck, Clock, ArrowLeft, CheckCircle } from "lucide-react";
import Link from "next/link";
import {
  listMyConversations, getConversation, sendMessage, updateConversationStatus,
} from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Conversation, Message } from "@/types";
import { cn, formatTime, formatDate, statusBadge, purposeColor } from "@/lib/utils";

interface Props {
  role?: "buyer" | "business";
  initialConvId?: string;
  // Called when buyer marks conversation complete — triggers review modal in parent
  onConversationCompleted?: (convId: string, bizId: string, bizName: string) => void;
}

const STATUS_TABS = ["all", "pending", "replied", "in-progress", "completed"] as const;

export default function MessagingInbox({ role = "buyer", initialConvId, onConversationCompleted }: Props) {
  const [conversations,  setConversations]  = useState<Conversation[]>([]);
  const [activeConv,     setActiveConv]     = useState<Conversation | null>(null);
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [newMessage,     setNewMessage]     = useState("");
  const [statusFilter,   setStatusFilter]   = useState<string>("all");
  const [sending,        setSending]        = useState(false);
  const [completing,     setCompleting]     = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [loadingMsgs,    setLoadingMsgs]    = useState(false);
  const [userId,         setUserId]         = useState<string | null>(null);
  const [mobileView,     setMobileView]     = useState<"list" | "chat">("list");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // Get current user ID once
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
  }, []);

  // Load all conversations
  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMyConversations();
      setConversations(data);
      return data;
    } catch {
      setConversations([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations().then(convs => {
      if (initialConvId && convs.length > 0) {
        const found = convs.find(c => c.id === initialConvId);
        if (found) selectConv(found);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConvId]);

  // Keep conversation list fresh for unread/status updates
  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations().then((convs) => {
        if (!activeConv) return;
        const latest = convs.find(c => c.id === activeConv.id);
        if (latest) setActiveConv(prev => prev ? { ...prev, ...latest } : latest);
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [loadConversations, activeConv]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filtered = conversations.filter(c =>
    statusFilter === "all" || c.status === statusFilter
  );

  // Open a conversation — fetch full history
  const selectConv = useCallback(async (conv: Conversation) => {
    setActiveConv(conv);
    setMobileView("chat");
    setLoadingMsgs(true);
    try {
      const full = await getConversation(conv.id);
      const normalizedMessages = (full.messages ?? []).map((m) =>
        m.senderId !== userId ? { ...m, read: true } : m
      );
      const normalizedConv = { ...full, messages: normalizedMessages };
      setMessages(normalizedMessages);
      setActiveConv(normalizedConv);
      setConversations(prev => prev.map(c => c.id === normalizedConv.id ? normalizedConv : c));
    } catch {
      setMessages(conv.messages ?? []);
    } finally {
      setLoadingMsgs(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, []);

  // "Me" detection
  const isMe = useCallback((msg: Message) =>
    userId ? msg.senderId === userId : msg.senderRole === role,
  [userId, role]);

  // Send a message
  const handleSend = async () => {
    const content = newMessage.trim();
    if (!content || !activeConv || sending) return;
    setNewMessage("");
    setSending(true);

    const optimistic: Message = {
      id:         `opt-${Date.now()}`,
      senderId:   userId ?? "me",
      senderName: "You",
      senderRole: role,
      content,
      timestamp:  new Date().toISOString(),
      read:       false,
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      await sendMessage(activeConv.id, { content });
      const data = await listMyConversations();
      setConversations(data);
      const full = await getConversation(activeConv.id);
      setMessages(full.messages ?? []);
      setActiveConv(full);
    } catch {
      // keep optimistic message visible
    } finally {
      setSending(false);
    }
  };

  // Mark conversation as complete
  const handleComplete = async () => {
    if (!activeConv) return;
    if (!window.confirm("Mark this conversation as completed?")) return;
    setCompleting(true);
    try {
      await updateConversationStatus(activeConv.id, { status: "completed" });
      // Update local state immediately
      const updated = { ...activeConv, status: "completed" as const };
      setActiveConv(updated);
      setConversations(prev => prev.map(c => c.id === activeConv.id ? updated : c));

      // Notify parent (dashboard) to show review modal + save business
      if (onConversationCompleted) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bizId   = (activeConv as any).business?.id ?? (activeConv as any).supplierId ?? "";
        const bizName = activeConv.supplierName ?? "this business";
        onConversationCompleted(activeConv.id, bizId, bizName);
      }
    } catch {
      // silent
    } finally {
      setCompleting(false);
    }
  };

  const handleContinueCompletedChat = async () => {
    if (!activeConv) return;
    try {
      await updateConversationStatus(activeConv.id, { status: "in-progress" });
      const full = await getConversation(activeConv.id);
      setActiveConv(full);
      setMessages(full.messages ?? []);
      const data = await listMyConversations();
      setConversations(data);
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch {
      // silent
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const displayName = (conv: Conversation) =>
    role === "business" ? conv.buyerName : conv.supplierName;

  const lastMsg = (conv: Conversation) =>
    conv.messages?.[conv.messages.length - 1];

  const unreadCountFor = (conv: Conversation) => {
    const msgs = conv.messages ?? [];
    return msgs.filter((msg) => !msg.read && msg.senderId !== userId).length;
  };

  return (
    <div className="flex h-full select-none">

      {/* ── Conversation list ── */}
      <div className={cn(
        "flex flex-col border-r border-surface-200",
        "w-full md:w-72 shrink-0",
        mobileView === "chat" ? "hidden md:flex" : "flex"
      )}>
        {/* Status filter tabs */}
        <div className="p-3 border-b border-surface-100">
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {STATUS_TABS.map(t => (
              <button key={t} onClick={() => setStatusFilter(t)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors capitalize shrink-0",
                  statusFilter === t ? "bg-brand-600 text-white" : "text-ink-muted hover:bg-surface-50"
                )}>
                {t === "all" ? "All" : t}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 shimmer rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <p className="text-2xl mb-2">💬</p>
              <p className="text-sm font-medium text-ink">No conversations yet</p>
              <p className="text-xs text-ink-faint mt-1">
                {role === "buyer"
                  ? "Send a request to a supplier to start chatting."
                  : "Conversations with buyers will appear here."}
              </p>
            </div>
          ) : filtered.map(conv => {
            const lm     = lastMsg(conv);
            const isActive = activeConv?.id === conv.id;
            const unreadCount = unreadCountFor(conv);
            const unread   = unreadCount > 0;
            return (
              <button key={conv.id} onClick={() => selectConv(conv)}
                className={cn(
                  "w-full p-4 border-b border-surface-100 text-left transition-colors",
                  isActive ? "bg-brand-50 border-brand-100" : "hover:bg-surface-50"
                )}>
                <div className="flex items-start gap-3">
                  {/* Avatar letter */}
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0",
                    isActive ? "bg-brand-600" : "bg-surface-300 text-ink"
                  )}>
                    {(displayName(conv) || "?")[0]?.toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className={cn("text-xs truncate", unread ? "font-bold text-ink" : "font-medium text-ink")}>
                        {displayName(conv)}
                      </p>
                      {lm && <span className="text-[10px] text-ink-faint shrink-0">{formatTime(lm.timestamp)}</span>}
                    </div>
                    <p className={cn("text-xs truncate mb-1", unread ? "text-ink font-medium" : "text-ink-faint")}>
                      {lm?.content ?? "No messages yet"}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {conv.purpose && (
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize", purposeColor(conv.purpose))}>
                          {conv.purpose}
                        </span>
                      )}
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize", statusBadge(conv.status))}>
                        {conv.status}
                      </span>
                      {/* Unread badge */}
                      {unread && (
                        <span className="ml-auto min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold shrink-0">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Chat panel ── */}
      {activeConv ? (
        <div className={cn(
          "flex-1 flex flex-col min-w-0",
          mobileView === "list" ? "hidden md:flex" : "flex"
        )}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-surface-200 flex items-center gap-3 shrink-0">
            <button onClick={() => setMobileView("list")} className="md:hidden p-1 text-ink-faint hover:text-ink">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {(displayName(activeConv) || "?")[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-ink text-sm truncate">{displayName(activeConv)}</p>
              <p className="text-xs text-ink-faint truncate">
                {activeConv.product}
                {activeConv.purpose && (
                  <span className={cn("ml-1 capitalize font-medium", purposeColor(activeConv.purpose))}>
                    · {activeConv.purpose}
                  </span>
                )}
              </p>
            </div>

            {/* Status badge */}
            <span className={cn("text-xs px-2 py-1 rounded-full font-medium capitalize shrink-0", statusBadge(activeConv.status))}>
              {activeConv.status}
            </span>

            {/* Complete button — only for buyer, only if not already completed */}
            {role === "buyer" && activeConv.status !== "completed" && (
              <button
                onClick={handleComplete}
                disabled={completing}
                title="Mark as completed"
                className="flex items-center gap-1.5 text-xs border border-green-200 text-green-700 hover:bg-green-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 shrink-0">
                {completing
                  ? <div className="w-3 h-3 border-2 border-green-300 border-t-green-700 rounded-full animate-spin" />
                  : <CheckCircle className="w-3.5 h-3.5" />
                }
                Complete
              </button>
            )}

            {/* Completed indicator */}
            {activeConv.status === "completed" && (
              <div className="flex items-center gap-2 shrink-0">
                <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                  <CheckCircle className="w-3.5 h-3.5" /> Done
                </span>
                <button
                  onClick={handleContinueCompletedChat}
                  className="text-xs px-2 py-1 rounded-lg border border-surface-200 text-ink hover:bg-surface-50"
                >
                  Continue old
                </button>
                {role === "buyer" && (
                  <Link
                    href={`/request?business=${activeConv.supplierId ?? ""}`}
                    className="text-xs px-2 py-1 rounded-lg border border-brand-200 text-brand-700 hover:bg-brand-50"
                  >
                    New interaction
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Request info banner */}
          {activeConv.product && (
            <div className="mx-4 mt-3 px-3 py-2 bg-surface-50 rounded-xl border border-surface-100 text-xs text-ink-muted flex flex-wrap gap-3 shrink-0">
              <span><strong className="text-ink">Product:</strong> {activeConv.product}</span>
              <span><strong className="text-ink">Purpose:</strong> {activeConv.purpose}</span>
              <span><strong className="text-ink">Started:</strong> {formatDate(activeConv.createdAt)}</span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingMsgs ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-5 h-5 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-ink-muted">No messages yet. Start the conversation below.</p>
              </div>
            ) : messages.map(msg => {
              const mine = isMe(msg);
              return (
                <div key={msg.id} className={cn("flex gap-2", mine ? "flex-row-reverse" : "flex-row")}>
                  <div className={cn(
                    "w-7 h-7 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 self-end",
                    mine ? "bg-brand-600" : "bg-surface-300 text-ink"
                  )}>
                    {(msg.senderName || "?")[0]?.toUpperCase()}
                  </div>
                  <div className={cn("max-w-[70%] lg:max-w-sm flex flex-col gap-0.5", mine ? "items-end" : "items-start")}>
                    {!mine && <p className="text-[10px] text-ink-faint px-1">{msg.senderName}</p>}
                    <div className={cn(
                      "px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed",
                      mine ? "bg-brand-600 text-white rounded-tr-sm" : "bg-surface-100 text-ink rounded-tl-sm"
                    )}>
                      {msg.content}
                    </div>
                    <div className={cn("flex items-center gap-1 text-[10px] text-ink-faint", mine && "flex-row-reverse")}>
                      <span>{formatTime(msg.timestamp)}</span>
                      {mine && (
                        msg.read
                          ? <CheckCheck className="w-3 h-3 text-brand-500" />
                          : <Clock className="w-3 h-3" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input — disabled when completed */}
          <div className="p-4 border-t border-surface-200 flex gap-2 shrink-0">
            {activeConv.status === "completed" ? (
              <div className="flex-1 flex items-center justify-center py-2.5 bg-surface-50 rounded-xl border border-surface-200 text-sm text-ink-faint">
                This conversation is completed
              </div>
            ) : (
              <>
                <input
                  ref={inputRef}
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message…"
                  className="flex-1 rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim() || sending}
                  className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white rounded-xl transition-colors">
                  {sending
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <Send className="w-4 h-4" />
                  }
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className={cn(
          "flex-1 items-center justify-center flex-col gap-3",
          mobileView === "list" ? "hidden md:flex" : "flex"
        )}>
          <p className="text-2xl">💬</p>
          <p className="text-sm text-ink-muted font-medium">Select a conversation</p>
          <p className="text-xs text-ink-faint">Choose from the list to start messaging.</p>
        </div>
      )}
    </div>
  );
}
