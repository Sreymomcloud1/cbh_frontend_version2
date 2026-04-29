import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";
import type { UpdateProfileInput } from "@/validators/profile.validators";
import { NotFoundError } from "@/lib/errors";

export class ProfileService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private db: SupabaseClient<any>) {}

  async getProfile(userId: string): Promise<Profile> {
    const { data, error } = await this.db
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError("Profile");
    return data as Profile;
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<Profile> {
    const { data, error } = await this.db
      .from("profiles")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new NotFoundError("Profile");
    return data as Profile;
  }

  async getSavedBusinesses(userId: string) {
    const { data, error } = await this.db
      .from("saved_businesses")
      .select(`
        id,
        created_at,
        business:businesses (
          id, name, tagline, category, tier, location_city, location_detail,
          logo_url, eco_score_overall, eco_level, discount_percent,
          bulk_support, is_verified, tags, rating, review_count,
          open_for_collaboration, open_for_investment
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async saveOrUnsaveBusiness(userId: string, businessId: string): Promise<{ saved: boolean }> {
    const { data: existing, error: checkErr } = await this.db
      .from("saved_businesses")
      .select("id")
      .eq("user_id", userId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (checkErr) throw checkErr;

    if (existing) {
      const { error } = await this.db
        .from("saved_businesses")
        .delete()
        .eq("user_id", userId)
        .eq("business_id", businessId);
      if (error) throw error;
      return { saved: false };
    }

    const { error } = await this.db
      .from("saved_businesses")
      .insert({ user_id: userId, business_id: businessId });
    if (error) throw error;
    return { saved: true };
  }

  async getRewards(userId: string) {
    const [profileRes, rewardsRes] = await Promise.all([
      this.db.from("profiles").select("reward_points").eq("id", userId).maybeSingle(),
      this.db.from("rewards").select("*").eq("user_id", userId)
        .order("created_at", { ascending: false }).limit(20),
    ]);
    if (profileRes.error) throw profileRes.error;
    if (rewardsRes.error) throw rewardsRes.error;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile = profileRes.data as any;
    return {
      total_points: profile?.reward_points ?? 0,
      history:      rewardsRes.data ?? [],
    };
  }

  async getNotifications(userId: string) {
    const { data, error } = await this.db
      .from("notifications")
      .select("id, title, body, type, reference_id, is_read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    const unread = (data ?? []).filter((n) => !n.is_read).length;
    return { items: data ?? [], unread };
  }

  async markNotificationRead(userId: string, notificationId: string) {
    const { data, error } = await this.db
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("user_id", userId)
      .select("id, is_read")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError("Notification");
    return data;
  }

  async markAllNotificationsRead(userId: string) {
    const { error } = await this.db
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (error) throw error;
    return { updated: true };
  }
}
