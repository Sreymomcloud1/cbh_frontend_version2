import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

export default function Card({ children, className, hover = false, padding = "md" }: CardProps) {
  const paddings = {
    none: "",
    sm: "p-4",
    md: "p-5",
    lg: "p-6",
  };

  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-surface-200 shadow-soft",
        hover && "transition-all duration-200 hover:shadow-card hover:-translate-y-0.5 cursor-pointer",
        paddings[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("bg-white rounded-2xl border border-surface-200 overflow-hidden", className)}>
      <div className="shimmer h-48 w-full" />
      <div className="p-5 space-y-3">
        <div className="shimmer h-5 w-2/3 rounded-lg" />
        <div className="shimmer h-4 w-full rounded-lg" />
        <div className="shimmer h-4 w-4/5 rounded-lg" />
        <div className="flex gap-2 pt-1">
          <div className="shimmer h-6 w-16 rounded-full" />
          <div className="shimmer h-6 w-16 rounded-full" />
        </div>
        <div className="shimmer h-9 w-full rounded-xl mt-2" />
      </div>
    </div>
  );
}
