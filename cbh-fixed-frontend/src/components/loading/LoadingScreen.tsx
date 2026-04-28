"use client";
import { useEffect, useState } from "react";
import { Leaf } from "lucide-react";

export default function LoadingScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        const next = p + Math.random() * 22;
        if (next >= 100) {
          clearInterval(interval);
          setTimeout(onDone, 300);
          return 100;
        }
        return next;
      });
    }, 200);
    return () => clearInterval(interval);
  }, [onDone]);

  return (
    <div className="fixed inset-0 bg-white z-[999] flex flex-col items-center justify-center gap-6 animate-fade-in">
      <div className="relative">
        <div className="w-20 h-20 rounded-3xl bg-brand-600 flex items-center justify-center shadow-lift">
          <Leaf className="w-10 h-10 text-white animate-pulse" />
        </div>
        <div className="absolute -inset-3 rounded-[34px] border-2 border-brand-200 animate-spin-slow opacity-50" />
      </div>
      <div className="text-center">
        <p className="font-display text-2xl text-ink mb-1">CBH</p>
        <p className="text-sm text-ink-faint">Find trusted local suppliers</p>
      </div>
      <div className="w-48 h-1.5 bg-surface-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-500 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    </div>
  );
}
