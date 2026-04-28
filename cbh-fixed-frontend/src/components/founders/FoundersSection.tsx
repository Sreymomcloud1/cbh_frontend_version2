"use client";
import { Facebook, Linkedin, Mail, Send, Upload } from "lucide-react";
import { mockFounders } from "@/data/mockData";
import type { Founder } from "@/types";

function FounderCard({ founder }: { founder: Founder }) {
  return (
    <div className="bg-white rounded-3xl border border-surface-200 shadow-soft overflow-hidden group hover:shadow-card transition-shadow">
      {/* Image */}
      <div className="h-72 bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center relative overflow-hidden">
        {founder.imageUrl ? (
          <img src={founder.imageUrl} alt={founder.name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-3 text-brand-300">
            <div className="w-24 h-24 rounded-full border-4 border-brand-200 flex items-center justify-center bg-white">
              <span className="text-4xl font-display text-brand-400">{founder.name[0]}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-brand-400">
              <Upload className="w-3.5 h-3.5" />
              <span>Photo placeholder</span>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="font-display text-xl text-ink mb-0.5">{founder.name}</h3>
        <p className="text-sm text-brand-600 font-medium mb-4">{founder.role}</p>
        <blockquote className="text-sm text-ink-muted leading-relaxed italic border-l-2 border-brand-200 pl-4 mb-6">
          &ldquo;{founder.message}&rdquo;
        </blockquote>

        {/* Contact links */}
        <div className="flex flex-wrap gap-3">
          {founder.facebookUrl && (
            <a href={founder.facebookUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-brand-600 transition-colors bg-surface-50 px-3 py-1.5 rounded-full">
              <Facebook className="w-3.5 h-3.5" /> Facebook
            </a>
          )}
          {founder.linkedinUrl && (
            <a href={founder.linkedinUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-brand-600 transition-colors bg-surface-50 px-3 py-1.5 rounded-full">
              <Linkedin className="w-3.5 h-3.5" /> LinkedIn
            </a>
          )}
         {/* Telegram — replaces phone/call */}
{(founder as any).telegramUrl && (
  <a href={String((founder as any).telegramUrl)} target="_blank" rel="noopener noreferrer"
    className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-brand-600 transition-colors bg-surface-50 px-3 py-1.5 rounded-full">
    <Send className="w-3.5 h-3.5" /> Telegram
  </a>
)}
          {founder.email && (
            <a href={`mailto:${founder.email}`}
              className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-brand-600 transition-colors bg-surface-50 px-3 py-1.5 rounded-full">
              <Mail className="w-3.5 h-3.5" /> Email
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FoundersSection() {
  return (
    <section className="py-16 sm:py-24 bg-surface-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <span className="text-sm font-semibold text-brand-600 uppercase tracking-widest">Our Team</span>
          <h2 className="font-display text-3xl sm:text-4xl text-ink mt-2 mb-3">Meet the Founders</h2>
          <p className="text-ink-muted max-w-md mx-auto">
            Two passionate Cambodians building the future of local sourcing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {mockFounders.map((founder) => (
            <FounderCard key={founder.id} founder={founder} />
          ))}
        </div>
      </div>
    </section>
  );
}
