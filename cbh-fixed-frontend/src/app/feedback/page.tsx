import FeedbackForm from "@/components/feedback/FeedbackForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Contact & Feedback — CBH" };

export default function FeedbackPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="text-center mb-10">
        <h1 className="font-display text-3xl sm:text-4xl text-ink mb-3">Send Us a Message</h1>
        <p className="text-ink-muted max-w-md mx-auto">Have feedback, a question, or want to partner with us? We read every message and aim to reply within 24 hours.</p>
      </div>
      <div className="bg-white rounded-3xl border border-surface-200 shadow-soft p-8">
        <FeedbackForm />
      </div>
    </div>
  );
}
