import { Search, FileText, BarChart2, CheckCircle } from "lucide-react";
import Link from "next/link";
import Button from "@/components/ui/Button";

const steps = [
  {
    step: "01",
    icon: Search,
    title: "Search",
    description:
      "Browse suppliers by category, location, eco score, or bulk support. Find exactly who you need.",
    color: "text-brand-600 bg-brand-50",
  },
  {
    step: "02",
    icon: FileText,
    title: "Request",
    description:
      "Submit a quote request with your product, quantity, date, and location. Takes under 2 minutes.",
    color: "text-blue-600 bg-blue-50",
  },
  {
    step: "03",
    icon: BarChart2,
    title: "Compare",
    description:
      "Review quotes side by side. Compare pricing, eco scores, availability, and delivery terms.",
    color: "text-purple-600 bg-purple-50",
  },
  {
    step: "04",
    icon: CheckCircle,
    title: "Choose",
    description:
      "Select the best supplier for your needs and confirm the order. We'll handle the rest.",
    color: "text-orange-600 bg-orange-50",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-16 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <span className="text-sm font-semibold text-brand-600 uppercase tracking-widest">
            Simple Process
          </span>
          <h2 className="font-display text-3xl sm:text-4xl text-ink mt-2 mb-3">
            How CBH Works
          </h2>
          <p className="text-ink-muted max-w-lg mx-auto">
            From discovery to confirmed order in four straightforward steps.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connector line (desktop) */}
          <div className="hidden lg:block absolute top-[52px] left-[calc(12.5%+32px)] right-[calc(12.5%+32px)] h-px bg-surface-200 z-0" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.step} className="flex flex-col items-center text-center">
                  <div className="relative mb-5">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${step.color} shadow-soft`}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-ink text-white text-xs font-bold flex items-center justify-center font-mono">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="font-display text-xl text-ink mb-2">{step.title}</h3>
                  <p className="text-sm text-ink-muted leading-relaxed">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-center mt-14">
          <Link href="/explore">
            <Button size="lg" variant="primary">Start exploring suppliers</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
