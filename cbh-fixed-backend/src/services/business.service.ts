import type { SupabaseClient } from "@supabase/supabase-js";
import type { Business, EcoBreakdown } from "@/types/database";
import type {
  CreateBusinessInput,
  UpdateBusinessInput,
  UpdateEcoScoreInput,
  ListBusinessesInput,
} from "@/validators/business.validators";
import { NotFoundError, ForbiddenError, ConflictError, BadRequestError } from "@/lib/errors";

const LIST_SELECT = `
  id, name, tagline, category, sub_categories, tier,
  location_city, location_detail, logo_url, gallery_urls,
  eco_score_overall, eco_level, discount_percent,
  bulk_support, bulk_capacity, is_verified, tags,
  rating, review_count, contact_email, contact_phone,
  open_for_collaboration, collaboration_types,
  open_for_investment, is_active, created_at
` as const;

export class BusinessService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private db: SupabaseClient<any>) {}

  async listBusinesses(filters: ListBusinessesInput) {
  // 1. Set hard defaults for pagination to prevent NaN calculations
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 50;
  
  const { 
    search, category, tier, location, min_eco_score,
    bulk_support, open_for_collaboration, open_for_investment 
  } = filters;

  // 2. Initialize query
  let query = this.db
    .from("businesses")
    .select(LIST_SELECT, { count: "exact" });

  // 3. Status Filter
  // IMPORTANT: Ensure your DB column 'is_active' is actually 'true' and not NULL.
  // If you want to show everything regardless of status for debugging, comment this line.
  query = query.eq("is_active", true);

  // 4. Dynamic Filters
  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,tagline.ilike.%${search}%`);
  }
  if (category) {
    query = query.eq("category", category);
  }
  if (tier) {
    query = query.eq("tier", tier);
  }
  if (location) {
    query = query.ilike("location_city", `%${location}%`);
  }
  if (min_eco_score !== undefined && min_eco_score !== null) {
    query = query.gte("eco_score_overall", min_eco_score);
  }
  if (bulk_support) {
    query = query.eq("bulk_support", true);
  }
  if (open_for_collaboration) {
    query = query.eq("open_for_collaboration", true);
  }
  if (open_for_investment) {
    query = query.eq("open_for_investment", true);
  }

  // 5. Sorting
  query = query.order("eco_score_overall", { ascending: false });

  // 6. Safe Pagination Range
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  // 7. Execution
  const { data, error, count } = await query;
  
  if (error) {
    console.error("Supabase Query Error:", error.message);
    throw error;
  }

  const total = count ?? 0;

  return {
    businesses: (data ?? []) as Business[],
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit) || 1,
    },
  };
}

  async getBusinessById(id: string): Promise<Business> {
    const { data, error } = await this.db
      .from("businesses")
      .select("*")
      .eq("id", id)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError("Business");
    return data as Business;
  }

  async getMyBusiness(ownerId: string): Promise<Business | null> {
    const { data, error } = await this.db
      .from("businesses")
      .select("*")
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as Business | null;
  }

  async createBusiness(ownerId: string, input: CreateBusinessInput): Promise<Business> {
    const existing = await this.getMyBusiness(ownerId);
    if (existing) throw new ConflictError("You already have a registered business");

    // If owner has pending_business = true, start inactive until admin approves
    const { data: profile } = await this.db
      .from("profiles")
      .select("pending_business, role")
      .eq("id", ownerId)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = profile as any;
    const needsApproval = p?.pending_business === true && p?.role !== "business";

    const { data, error } = await this.db
      .from("businesses")
      .insert({
        ...input,
        owner_id:          ownerId,
        eco_score_overall: 0,
        eco_level:         "Basic",
        eco_breakdown:     { packaging: 0, sourcing: 0, energy: 0, waste: 0, delivery: 0, practices: 0 },
        rating:            0,
        review_count:      0,
        is_active:         !needsApproval,
      })
      .select()
      .single();
    if (error) throw error;
    return data as Business;
  }

  /** Allowed for any verification status (pending / approved / rejected / revoked)—owners maintain their draft listing. */
  async updateBusiness(id: string, ownerId: string, input: UpdateBusinessInput): Promise<Business> {
    await this.assertOwner(id, ownerId);
    const { data, error } = await this.db
      .from("businesses")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new NotFoundError("Business");
    return data as Business;
  }

  /** Allowed regardless of verification status so owners can improve their eco score before resubmitting. */
  async updateEcoScore(id: string, ownerId: string, input: UpdateEcoScoreInput): Promise<Business> {
    await this.assertOwner(id, ownerId);
    const { breakdown } = input;
    const overall = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
    const eco_level = overall >= 71 ? "High" : overall >= 41 ? "Medium" : "Basic";

    const { data, error } = await this.db
      .from("businesses")
      .update({
        eco_breakdown:     breakdown as unknown as EcoBreakdown,
        eco_score_overall: overall,
        eco_level,
        updated_at:        new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new NotFoundError("Business");
    return data as Business;
  }

  async resubmitForVerification(ownerId: string): Promise<Business> {
    const biz = await this.getMyBusiness(ownerId);
    if (!biz) throw new NotFoundError("Business");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vs = String((biz as any).verification_status ?? "").toLowerCase();
    if (vs !== "rejected" && vs !== "revoked") {
      throw new BadRequestError(
        "You can only resubmit after an admin has rejected or unpublished your listing.",
      );
    }

    const now = new Date().toISOString();
    const { data, error } = await this.db
      .from("businesses")
      .update({
        verification_status: "pending",
        rejection_reason:    null,
        is_verified:         false,
        is_active:           false,
        verified_at:           null,
        verified_by:           null,
        rejected_at:           null,
        rejected_by:           null,
        updated_at:           now,
      })
      .eq("id", biz.id)
      .eq("owner_id", ownerId)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new NotFoundError("Business");
    return data as Business;
  }

  async deleteBusiness(id: string, ownerId: string): Promise<void> {
    await this.assertOwner(id, ownerId);
    const { error } = await this.db
      .from("businesses")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }

  private async assertOwner(businessId: string, ownerId: string): Promise<void> {
    const { data, error } = await this.db
      .from("businesses")
      .select("owner_id")
      .eq("id", businessId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError("Business");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((data as any).owner_id !== ownerId) throw new ForbiddenError("You do not own this business");
  }
}
