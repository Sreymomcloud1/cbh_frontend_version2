import type { SupabaseClient } from "@supabase/supabase-js";
import type { SendMessageInput, UpdateConversationStatusInput } from "@/validators/message.validators";
import { NotFoundError, ForbiddenError } from "@/lib/errors";
import { notifyBusiness, notifyBuyer } from "@/lib/email";
import { env } from "@/config/env";

export class MessageService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private db: SupabaseClient<any>) {}

  // ── List conversations for current user ───────────────────────────────────
  async getMyConversations(userId: string, status?: string) {
    const CONV_SELECT = `
      id, status, created_at, updated_at,
      request:requests ( id, purpose, product ),
      business:businesses ( id, name, logo_url ),
      buyer:profiles!buyer_id ( id, name, avatar_url ),
      messages ( id, content, sender_id, is_read, created_at )
    `;

    // Conversations where user is the buyer
    const { data: buyerConvs, error: buyerErr } = await this.db
      .from("conversations")
      .select(CONV_SELECT)
      .eq("buyer_id", userId)
      .order("updated_at", { ascending: false });
    if (buyerErr) throw buyerErr;

    // Conversations where user owns the business
    const { data: ownerBiz } = await this.db
      .from("businesses")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let bizConvs: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((ownerBiz as any)?.id) {
      const { data, error: bizErr } = await this.db
        .from("conversations")
        .select(CONV_SELECT)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .eq("business_id", (ownerBiz as any).id)
        .order("updated_at", { ascending: false });
      if (bizErr) throw bizErr;
      bizConvs = data ?? [];
    }

    const seen = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let merged: any[] = [...(buyerConvs ?? []), ...bizConvs]
      .filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; })
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    if (status) merged = merged.filter(c => c.status === status);
    return merged;
  }

  // ── Full conversation + all messages ─────────────────────────────────────
  async getConversation(conversationId: string, userId: string) {
    const { data: conv, error } = await this.db
      .from("conversations")
      .select(`
        id, status, created_at, updated_at,
        request:requests ( id, purpose, product, quantity, location, notes, required_date, status ),
        business:businesses ( id, name, logo_url, contact_email, contact_phone, facebook_url, telegram_url ),
        buyer:profiles!buyer_id ( id, name, avatar_url )
      `)
      .eq("id", conversationId)
      .maybeSingle();
    if (error) throw error;
    if (!conv) throw new NotFoundError("Conversation");

    await this.assertParticipant(conversationId, userId);

    const { data: messages, error: msgErr } = await this.db
      .from("messages")
      .select(`id, content, is_read, created_at, sender:profiles!sender_id ( id, name, avatar_url )`)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (msgErr) throw msgErr;

    // Mark messages from others as read
    await this.db
      .from("messages")
      .update({ is_read: true })
      .eq("conversation_id", conversationId)
      .neq("sender_id", userId)
      .eq("is_read", false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { ...(conv as any), messages: messages ?? [] };
  }

  // ── Send a message ─────────────────────────────────────────────────────────
  async sendMessage(conversationId: string, senderId: string, input: SendMessageInput) {
    await this.assertParticipant(conversationId, senderId);

    const { data: message, error } = await this.db
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: senderId, content: input.content })
      .select(`id, content, is_read, created_at, sender:profiles!sender_id ( id, name, avatar_url )`)
      .single();
    if (error) throw error;
    if (!message) throw new Error("Failed to insert message");

    // Determine if sender is the business owner
    const { data: conv } = await this.db
      .from("conversations")
      .select("business_id, buyer_id")
      .eq("id", conversationId)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bizId   = (conv as any)?.business_id as string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buyerId = (conv as any)?.buyer_id    as string | undefined;

    const { data: biz } = await this.db
      .from("businesses")
      .select("owner_id")
      .eq("id", bizId ?? "")
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isBusinessSender = (biz as any)?.owner_id === senderId;

    // Update conversation timestamp; set status to "replied" only when business responds
    await this.db
      .from("conversations")
      .update({ updated_at: new Date().toISOString(), ...(isBusinessSender ? { status: "replied" } : {}) })
      .eq("id", conversationId)
      .neq("status", "completed");

    // Send email notifications asynchronously — never block the response
    this.sendEmailNotifications(conversationId, senderId, isBusinessSender, buyerId ?? "", bizId ?? "", input.content)
      .catch(e => console.warn("Email notification failed:", e.message));

    return message;
  }

  // ── Email notifications ───────────────────────────────────────────────────
  private async sendEmailNotifications(
    conversationId: string,
    senderId: string,
    isBusinessSender: boolean,
    buyerId: string,
    bizId: string,
    content: string,
  ) {
    const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    if (isBusinessSender) {
      // Business replied → notify buyer
      const { data: bizInfo } = await this.db
        .from("businesses")
        .select("name, contact_email, notify_by_email")
        .eq("id", bizId)
        .maybeSingle();
      const { data: buyerInfo } = await this.db
        .from("profiles")
        .select("email, name")
        .eq("id", buyerId)
        .maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const biz   = bizInfo   as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const buyer = buyerInfo as any;
      if (!buyer?.email) return;

      const { data: reqInfo } = await this.db
        .from("conversations")
        .select("request:requests ( product )")
        .eq("id", conversationId)
        .maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const product = (reqInfo as any)?.request?.product ?? "your request";

      await notifyBuyer({
        buyerEmail:     buyer.email,
        buyerName:      buyer.name ?? "Buyer",
        businessName:   biz?.name ?? "A business",
        businessEmail:  biz?.contact_email ?? "",
        messageContent: content,
        product,
        conversationId,
        siteUrl,
      });
    } else {
      // Buyer sent message → notify business
      const { data: bizInfo } = await this.db
        .from("businesses")
        .select("name, contact_email, notify_by_email")
        .eq("id", bizId)
        .maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const biz = bizInfo as any;
      if (!biz?.notify_by_email || !biz?.contact_email) return;

      const { data: buyerInfo } = await this.db
        .from("profiles")
        .select("name, email, phone")
        .eq("id", senderId)
        .maybeSingle();
      const { data: reqInfo } = await this.db
        .from("conversations")
        .select("request:requests ( product, purpose )")
        .eq("id", conversationId)
        .maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const buyer = buyerInfo as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const req   = (reqInfo as any)?.request;

      await notifyBusiness({
        businessEmail:  biz.contact_email,
        businessName:   biz.name,
        buyerName:      buyer?.name  ?? "A user",
        buyerEmail:     buyer?.email ?? "",
        buyerPhone:     buyer?.phone ?? undefined,
        messageContent: content,
        product:        req?.product ?? "",
        purpose:        req?.purpose ?? "buy",
        conversationId,
        siteUrl,
      });
    }
  }

  // ── Unread count ──────────────────────────────────────────────────────────
  async getUnreadCount(userId: string): Promise<number> {
    const convs = await this.getMyConversations(userId);
    let unread = 0;
    for (const conv of convs) {
      const msgs = conv.messages ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (msgs.some((m: any) => !m.is_read && m.sender_id !== userId)) unread++;
    }
    return unread;
  }

  // ── Update conversation status ────────────────────────────────────────────
async updateConversationStatus(conversationId: string, userId: string, input: UpdateConversationStatusInput) {
    await this.assertParticipant(conversationId, userId);
    const { data, error } = await this.db
      .from("conversations")
      .update({ status: input.status, updated_at: new Date().toISOString() })
      .eq("id", conversationId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // ── Guard: only participants can read/write ───────────────────────────────
  private async assertParticipant(conversationId: string, userId: string) {
    const { data: conv } = await this.db
      .from("conversations")
      .select("buyer_id, business_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv) throw new NotFoundError("Conversation");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { buyer_id, business_id } = conv as any;

    const isBuyer = buyer_id === userId;
    if (isBuyer) return;

    // Check if user owns the business
    const { data: biz } = await this.db
      .from("businesses")
      .select("owner_id")
      .eq("id", business_id)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((biz as any)?.owner_id !== userId) throw new ForbiddenError("Not a participant");
  }
}
