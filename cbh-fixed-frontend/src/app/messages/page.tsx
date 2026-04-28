"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import MessagingInbox from "@/components/messaging/MessagingInbox";

export default function MessagesPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <h1 className="font-display text-3xl text-ink mb-1">Messages</h1>
        <p className="text-sm text-ink-muted">All your conversations with suppliers in one place.</p>
      </div>
      <MessagingInbox role="buyer" />
    </div>
  );
}
