import Link from "next/link";

const categories = [
  {
    name: "Food",
    icon: "🍽️",
    description: "Catering, meals & food products",
    href: "/explore?category=Food",
    color: "bg-orange-50 hover:bg-orange-100",
    iconBg: "bg-orange-100",
  },
  {
    name: "Ingredients",
    icon: "🌿",
    description: "Fresh produce, spices & raw materials",
    href: "/explore?category=Ingredients",
    color: "bg-brand-50 hover:bg-brand-100",
    iconBg: "bg-brand-100",
  },
  {
    name: "Packaging",
    icon: "📦",
    description: "Eco-friendly packaging solutions",
    href: "/explore?category=Packaging",
    color: "bg-blue-50 hover:bg-blue-100",
    iconBg: "bg-blue-100",
  },
  {
    name: "Rentals",
    icon: "🪑",
    description: "Event furniture & equipment",
    href: "/explore?category=Rentals",
    color: "bg-purple-50 hover:bg-purple-100",
    iconBg: "bg-purple-100",
  },
  {
    name: "Services",
    icon: "⚡",
    description: "Marketing, logistics & consulting",
    href: "/explore?category=Services",
    color: "bg-yellow-50 hover:bg-yellow-100",
    iconBg: "bg-yellow-100",
  },
];

export default function Categories() {
  return (
    <section className="py-16 sm:py-20 bg-surface-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl sm:text-4xl text-ink mb-3">
            Browse by Category
          </h2>
          <p className="text-ink-muted max-w-md mx-auto">
            Find the exact type of supplier you need for your business or event.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {categories.map((cat, i) => (
            <Link
              key={cat.name}
              href={cat.href}
              className={`group rounded-2xl p-5 flex flex-col items-center text-center gap-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-card ${cat.color}`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${cat.iconBg} group-hover:scale-110 transition-transform duration-200`}>
                {cat.icon}
              </div>
              <div>
                <p className="font-semibold text-ink text-sm">{cat.name}</p>
                <p className="text-xs text-ink-faint mt-0.5 leading-snug">{cat.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
