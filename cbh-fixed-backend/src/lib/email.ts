import nodemailer from "nodemailer";
import { env } from "@/config/env";

function createTransporter() {
  if (!env.SMTP_USER || !env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: env.SMTP_HOST ?? "smtp.gmail.com",
    port: env.SMTP_PORT ?? 587,
    secure: (env.SMTP_PORT ?? 587) === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
}

const FROM = env.SMTP_FROM ?? `"CBH Platform" <${env.SMTP_USER}>`;
const SITE = env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// ── Shared button HTML ────────────────────────────────────────────────────────
function ctaButton(url: string, label: string) {
  return `<a href="${url}" style="display:inline-block;background:#16a34a;color:#fff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;margin-top:8px">${label} →</a>`;
}

function emailWrap(body: string) {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:580px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
      <div style="background:#16a34a;padding:28px 32px">
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800">CBH</h1>
        <p style="color:#bbf7d0;margin:4px 0 0;font-size:13px">Connect Businesses Hub</p>
      </div>
      <div style="padding:28px 32px">${body}</div>
      <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
        <p style="color:#9ca3af;font-size:12px;margin:0">CBH · Cambodia Business Hub · <a href="${SITE}" style="color:#16a34a">Visit site</a></p>
      </div>
    </div>
  `;
}

// ── Feedback ──────────────────────────────────────────────────────────────────
export interface FeedbackEmailData {
  name: string; email: string; topic: string; subject: string; message: string; rating?: number;
}

export async function sendFeedbackEmail(data: FeedbackEmailData) {
  const t = createTransporter();
  const to = env.CONTACT_EMAIL ?? env.SMTP_USER;
  if (!t || !to) { console.warn("SMTP not configured — feedback not emailed"); return; }
  await t.sendMail({
    from: FROM, to, replyTo: data.email,
    subject: `[CBH Feedback] ${data.topic}: ${data.subject || "(no subject)"}`,
    html: emailWrap(`
      <h2 style="margin:0 0 16px;color:#111">New Feedback</h2>
      <p><strong>From:</strong> ${data.name} &lt;${data.email}&gt;</p>
      <p><strong>Topic:</strong> ${data.topic}</p>
      <p><strong>Rating:</strong> ${"⭐".repeat(data.rating ?? 0) || "—"}</p>
      <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin-top:12px;white-space:pre-wrap">${data.message}</div>
    `),
  });
}

// ── Message to business (user → business) ────────────────────────────────────
export interface ToBusinessNotification {
  businessEmail: string;
  businessName: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  messageContent: string;
  product: string;
  purpose: string;
  conversationId: string;   // used to build deep link
  siteUrl: string;          // used to build deep link
}

export async function notifyBusiness(data: ToBusinessNotification) {
  const t = createTransporter();
  if (!t) { console.warn("SMTP not configured — business notification skipped"); return; }
  // Deep link: login page with ?redirect=/messages
  const link = `${SITE}/auth/login?redirect=/business-dashboard%3Ftab%3Dmessages%26conv%3D${data.conversationId}`;
  await t.sendMail({
    from: FROM,
    to: data.businessEmail,
    subject: `New ${data.purpose} request from ${data.buyerName} — CBH`,
    html: emailWrap(`
      <h2 style="margin:0 0 6px;color:#111">You have a new message 💬</h2>
      <p style="color:#6b7280;margin:0 0 20px">Someone sent you a <strong>${data.purpose}</strong> request on CBH.</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin-bottom:20px">
        <p style="margin:0 0 4px;font-size:13px;color:#15803d;font-weight:600">Message preview</p>
        <p style="margin:0;color:#111;font-size:15px">"${data.messageContent}"</p>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
        <tr><td style="padding:6px 0;color:#6b7280;width:100px">Product</td><td style="padding:6px 0;font-weight:600">${data.product}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">From</td><td style="padding:6px 0">${data.buyerName}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Email</td><td style="padding:6px 0">${data.buyerEmail}</td></tr>
        ${data.buyerPhone ? `<tr><td style="padding:6px 0;color:#6b7280">Phone</td><td style="padding:6px 0">${data.buyerPhone}</td></tr>` : ""}
      </table>
      ${ctaButton(link, "Reply on CBH")}
      <p style="font-size:12px;color:#9ca3af;margin-top:16px">Log in to your business dashboard to reply. The link above takes you directly to this conversation.</p>
    `),
  });
}

// ── Reply to buyer (business → user) ─────────────────────────────────────────
export interface ToBuyerNotification {
  buyerEmail: string;
  buyerName: string;
  businessName: string;
  businessEmail: string;
  messageContent: string;
  product: string;
  conversationId: string;
  siteUrl: string;          // used to build deep link
}

export async function notifyBuyer(data: ToBuyerNotification) {
  const t = createTransporter();
  if (!t) { console.warn("SMTP not configured — buyer notification skipped"); return; }
  const link = `${SITE}/auth/login?redirect=/dashboard%3Ftab%3Dmessages%26conv%3D${data.conversationId}`;
  await t.sendMail({
    from: FROM,
    to: data.buyerEmail,
    subject: `${data.businessName} replied to your request — CBH`,
    html: emailWrap(`
      <h2 style="margin:0 0 6px;color:#111">${data.businessName} replied 💬</h2>
      <p style="color:#6b7280;margin:0 0 20px">You have a new reply on your <strong>${data.product}</strong> request.</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin-bottom:20px">
        <p style="margin:0 0 4px;font-size:13px;color:#15803d;font-weight:600">Message from ${data.businessName}</p>
        <p style="margin:0;color:#111;font-size:15px">"${data.messageContent}"</p>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
        <tr><td style="padding:6px 0;color:#6b7280;width:120px">Business</td><td style="padding:6px 0;font-weight:600">${data.businessName}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Contact</td><td style="padding:6px 0">${data.businessEmail}</td></tr>
      </table>
      ${ctaButton(link, "View Conversation")}
      <p style="font-size:12px;color:#9ca3af;margin-top:16px">Log in to reply. The link above takes you directly to this conversation.</p>
    `),
  });
}

export interface BusinessVerificationDecisionData {
  businessName: string;
  ownerEmail: string;
  ownerName?: string;
  action: "verify" | "reject" | "revoke";
  reason?: string;
}

export async function notifyBusinessVerificationDecision(data: BusinessVerificationDecisionData) {
  const t = createTransporter();
  if (!t) {
    console.warn("SMTP not configured — verification decision email skipped");
    return;
  }

  const ownerLabel = data.ownerName?.trim() || "Business owner";
  const dashboardLink = `${SITE}/auth/login?redirect=/business-dashboard`;
  const titleByAction: Record<BusinessVerificationDecisionData["action"], string> = {
    verify: "Your business has been verified",
    reject: "Your business registration was rejected",
    revoke: "Your business verification was revoked",
  };

  const reasonBlock = data.reason
    ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px;margin:16px 0">
         <p style="margin:0 0 6px;color:#b91c1c;font-weight:700;font-size:13px">Reason from admin</p>
         <p style="margin:0;color:#111;font-size:14px;white-space:pre-wrap">${data.reason}</p>
       </div>`
    : "";

  await t.sendMail({
    from: FROM,
    to: data.ownerEmail,
    subject: `${titleByAction[data.action]} — CBH`,
    html: emailWrap(`
      <h2 style="margin:0 0 8px;color:#111">${titleByAction[data.action]}</h2>
      <p style="color:#6b7280;margin:0 0 16px">Hi ${ownerLabel},</p>
      <p style="color:#111;margin:0 0 8px">
        The status for <strong>${data.businessName}</strong> is now:
        <strong style="text-transform:capitalize">${data.action === "verify" ? "Verified" : data.action === "reject" ? "Rejected" : "Revoked"}</strong>.
      </p>
      ${reasonBlock}
      ${ctaButton(dashboardLink, "Open Business Dashboard")}
    `),
  });
}

export interface WelcomeEmailData {
  toEmail: string; name: string; role: "buyer" | "business"; loginUrl: string;
}
export async function sendWelcomeEmail(data: WelcomeEmailData) {
  const t = createTransporter();
  if (!t) return;
  await t.sendMail({
    from: FROM, to: data.toEmail,
    subject: `Welcome to CBH, ${data.name}! 🌱`,
    html: emailWrap(`
      <h2 style="margin:0 0 8px;color:#111">Welcome, ${data.name}! 🌱</h2>
      <p style="color:#6b7280">Your ${data.role} account on CBH is ready.</p>
      ${ctaButton(data.loginUrl, "Go to Dashboard")}
    `),
  });
}

// Keep old name for backward compatibility
export const sendMessageNotification = notifyBusiness as unknown as (d: { businessEmail: string; businessName: string; senderName: string; senderEmail: string; senderPhone?: string; messageContent: string; product: string; purpose: string; loginUrl: string; }) => Promise<void>;
