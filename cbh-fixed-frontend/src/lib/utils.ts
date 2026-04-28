import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function ecoScoreLabel(score: number): { label: string; color: string } {
  if (score >= 71) return { label: "High", color: "text-brand-600" };
  if (score >= 41) return { label: "Medium", color: "text-yellow-600" };
  return { label: "Basic", color: "text-red-500" };
}

export function ecoScoreBg(score: number): string {
  if (score >= 71) return "bg-brand-100 text-brand-700";
  if (score >= 41) return "bg-yellow-50 text-yellow-700";
  return "bg-red-50 text-red-700";
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function statusBadge(status: string): string {
  switch (status) {
    case "completed": return "bg-brand-100 text-brand-700";
    case "in-progress": return "bg-blue-100 text-blue-700";
    case "replied": return "bg-purple-100 text-purple-700";
    case "pending": return "bg-yellow-100 text-yellow-700";
    case "declined": return "bg-red-100 text-red-700";
    default: return "bg-surface-100 text-ink-muted";
  }
}

export function purposeColor(purpose: string): string {
  switch (purpose) {
    case "buy": return "bg-brand-50 text-brand-700";
    case "collaborate": return "bg-blue-50 text-blue-700";
    case "invest": return "bg-purple-50 text-purple-700";
    default: return "bg-surface-100 text-ink-muted";
  }
}

export function calculateEcoScore(breakdown: Record<string, number>): number {
  return Object.values(breakdown).reduce((a, b) => a + b, 0);
}

export function ecoLevel(score: number): "Basic" | "Medium" | "High" {
  if (score >= 71) return "High";
  if (score >= 41) return "Medium";
  return "Basic";
}
