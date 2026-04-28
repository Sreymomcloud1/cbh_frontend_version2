import type { SupabaseClient } from "@supabase/supabase-js";

export interface SmartSearchResult {
  id: string;
  name: string;
  tagline: string;
  category: string;
  location_city: string;
  logo_url: string | null;
  eco_score_overall: number;
  eco_level: string;
  services: string[];
  tags: string[];
  rating: number;
  is_verified: boolean;
  matchScore: number;
  matchReasons: string[];
}

// Maps common words in queries to categories
const CATEGORY_KEYWORDS: Record<string, string> = {
  food: "Food", catering: "Food", meal: "Food", lunch: "Food",
  dinner: "Food", breakfast: "Food", snack: "Food", beverage: "Food",
  ingredient: "Ingredients", spice: "Ingredients", sauce: "Ingredients",
  packaging: "Packaging", box: "Packaging", wrap: "Packaging", bag: "Packaging",
  rental: "Rentals", rent: "Rentals", equipment: "Rentals", table: "Rentals",
  chair: "Rentals", tent: "Rentals",
  event: "Event Services", wedding: "Event Services", party: "Event Services",
  birthday: "Event Services", corporate: "Event Services",
};

function extractKeywords(query: string): {
  terms: string[];
  category: string | null;
  isLargeOrder: boolean;
} {
  const lower = query.toLowerCase();
  const words = lower.split(/\s+/);

  // Detect category from keywords
  let category: string | null = null;
  for (const word of words) {
    if (CATEGORY_KEYWORDS[word]) {
      category = CATEGORY_KEYWORDS[word];
      break;
    }
  }

  // Detect large order signals
  const isLargeOrder =
    /\b(bulk|wholesale|large|many|lot|hundred|thousand|\d{3,})\b/.test(lower);

  // Extract meaningful search terms (skip stopwords)
  const stopwords = new Set(["i","a","an","the","for","of","to","in","and","or","with","need","want","looking","help","my","our","some","any","that","this","can","get","us","me","we"]);
  const terms = words.filter((w) => w.length > 2 && !stopwords.has(w));

  return { terms, category, isLargeOrder };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scoreResult(business: any, terms: string[], isLargeOrder: boolean): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const haystack = [
    business.name,
    business.tagline,
    business.description,
    ...(business.services ?? []),
    ...(business.tags ?? []),
  ].join(" ").toLowerCase();

  // Term matching
  let termHits = 0;
  for (const term of terms) {
    if (haystack.includes(term)) termHits++;
  }
  if (termHits > 0) {
    score += termHits * 20;
    reasons.push(`Matches ${termHits} keyword${termHits > 1 ? "s" : ""} in your query`);
  }

  // Eco score bonus
  if (business.eco_score_overall >= 70) {
    score += 15;
    reasons.push(`High eco score (${business.eco_score_overall}/100)`);
  } else if (business.eco_score_overall >= 40) {
    score += 8;
  }

  // Verified bonus
  if (business.is_verified) {
    score += 10;
    reasons.push("Verified supplier");
  }

  // Bulk support bonus
  if (isLargeOrder && business.bulk_support) {
    score += 20;
    reasons.push("Supports bulk orders");
  }

  // Rating bonus
  if (business.rating >= 4.5) {
    score += 10;
    reasons.push(`Highly rated (${business.rating.toFixed(1)}★)`);
  } else if (business.rating >= 3.5) {
    score += 5;
  }

  return { score, reasons };
}

export class SmartSearchService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private db: SupabaseClient<any>) {}

  async search(query: string, limit = 8): Promise<SmartSearchResult[]> {
    if (!query || query.trim().length < 2) return [];

    const { terms, category, isLargeOrder } = extractKeywords(query);

    // Build the Supabase query
    let dbQuery = this.db
      .from("businesses")
      .select(`
        id, name, tagline, description, category,
        location_city, logo_url, eco_score_overall, eco_level,
        services, tags, rating, review_count, is_verified,
        bulk_support, is_active
      `)
      .eq("is_active", true)
      .limit(50); // fetch 50, score in memory, return top N

    // Category filter (strong signal)
    if (category) {
      dbQuery = dbQuery.eq("category", category);
    } else if (terms.length > 0) {
      // Full-text ilike search across name, tagline
      const searchTerm = terms.slice(0, 3).join(" ");
      dbQuery = dbQuery.or(
        `name.ilike.%${searchTerm}%,tagline.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`
      );
    }

    const { data, error } = await dbQuery;
    if (error) throw error;
    if (!data || data.length === 0) {
      // Fallback: no filters, just return top eco-scored
      const { data: fallback } = await this.db
        .from("businesses")
        .select("id, name, tagline, description, category, location_city, logo_url, eco_score_overall, eco_level, services, tags, rating, review_count, is_verified, bulk_support, is_active")
        .eq("is_active", true)
        .order("eco_score_overall", { ascending: false })
        .limit(limit);
      return (fallback ?? []).map((b) => ({
        ...b,
        matchScore: 0,
        matchReasons: ["Top eco-rated supplier"],
      })) as SmartSearchResult[];
    }

    // Score all results in memory
    const scored = data
      .map((b) => {
        const { score, reasons } = scoreResult(b, terms, isLargeOrder);
        return {
          ...b,
          matchScore: score,
          matchReasons: reasons.length > 0 ? reasons : ["Available supplier"],
        } as SmartSearchResult;
      })
      .filter((b) => b.matchScore > 0 || data.length <= 5)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);

    return scored;
  }
}