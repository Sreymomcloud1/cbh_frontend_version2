/**
 * Supabase database types for CBH Platform.
 *
 * Structured to match the format that `npx supabase gen types typescript` produces.
 * Each table has Row / Insert / Update fully inlined — this is required for the
 * Supabase JS client to correctly type .insert(), .update(), .upsert() calls.
 * Using external interface references (e.g. Insert: BusinessInsert) causes TypeScript
 * to resolve the Insert/Update slots as `never` under strict compiler settings.
 */

// ─── Shared enums ───────────────────────────────────────────────────────────

export type UserRole         = "buyer" | "business" | "admin";
export type BusinessTier     = "Startup" | "SME" | "Company";
export type BusinessCategory = "Food" | "Ingredients" | "Packaging" | "Rentals" | "Event Services" | "Others";
export type RequestPurpose   = "buy" | "collaborate" | "invest";
export type RequestStatus    = "pending" | "replied" | "in-progress" | "completed" | "declined";
export type MessageStatus    = "pending" | "replied" | "in-progress" | "completed";
export type EcoLevel         = "Basic" | "Medium" | "High";

export interface EcoBreakdown {
  packaging: number;
  sourcing:  number;
  energy:    number;
  waste:     number;
  delivery:  number;
  practices: number;
}

// ─── Row shapes ─────────────────────────────────────────────────────────────

export interface Profile {
  id:            string;
  name:          string;
  email:         string;
  role:          UserRole;
  avatar_url:    string | null;
  phone:         string | null;
  is_verified:   boolean;
  reward_points: number;
  created_at:    string;
  updated_at:    string;
}

export interface Business {
  id:                        string;
  owner_id:                  string;
  name:                      string;
  tagline:                   string;
  description:               string;
  category:                  BusinessCategory;
  sub_categories:            string[];
  tier:                      BusinessTier;
  location_city:             string;
  location_detail:           string;
  map_url:                   string | null;
  logo_url:                  string | null;
  gallery_urls:              string[];
  eco_score_overall:         number;
  eco_level:                 EcoLevel;
  eco_breakdown:             EcoBreakdown;
  discount_percent:          number | null;
  bulk_support:              boolean;
  bulk_capacity:             string | null;
  is_verified:               boolean;
  tags:                      string[];
  services:                  string[];
  contact_email:             string;
  contact_phone:             string;
  website_url:               string | null;
  facebook_url:              string | null;
  telegram_url:              string | null;
  rating:                    number;
  review_count:              number;
  open_for_collaboration:    boolean;
  collaboration_types:       string[];
  collaboration_description: string | null;
  open_for_investment:       boolean;
  investment_amount:         string | null;
  investment_description:    string | null;
  founded_year:              number | null;
  is_active:                 boolean;
  eco_description:           string | null;
  tax_id:                    string | null;
  notify_by_email:           boolean;
  notify_by_phone:           boolean;
  created_at:                string;
  updated_at:                string;
}

export interface Request {
  id:              string;
  buyer_id:        string;
  business_id:     string | null;
  purpose:         RequestPurpose;
  product:         string;
  quantity:        string | null;
  required_date:   string;
  location:        string;
  notes:           string | null;
  event_type:      string | null;
  guest_count:     string | null;
  budget_range:    string | null;
  urgency:         string | null;
  status:          RequestStatus;
  conversation_id: string | null;
  created_at:      string;
  updated_at:      string;
}

export interface Conversation {
  id:          string;
  request_id:  string;
  business_id: string;
  buyer_id:    string;
  status:      MessageStatus;
  created_at:  string;
  updated_at:  string;
}

export interface Message {
  id:              string;
  conversation_id: string;
  sender_id:       string;
  content:         string;
  is_read:         boolean;
  created_at:      string;
}

export interface SavedBusiness {
  id:          string;
  user_id:     string;
  business_id: string;
  created_at:  string;
}

export interface Reward {
  id:           string;
  user_id:      string;
  action:       string;
  points:       number;
  reference_id: string | null;
  created_at:   string;
}

export interface Review {
  id:          string;
  business_id: string;
  reviewer_id: string;
  request_id:  string;
  rating:      number;
  comment:     string | null;
  created_at:  string;
}

// ─── Database type — Supabase-style, fully inlined Insert/Update ─────────────
//
// WHY INLINE: The Supabase JS v2 client resolves Insert/Update generics at the
// table-slot level. External type aliases (e.g. Insert: BusinessInsert) can
// collapse to `never` under strict TypeScript, breaking every .insert()/.update()
// call with "Argument of type X is not assignable to parameter of type 'never'".
// Inlining matches exactly what `npx supabase gen types typescript` outputs.

export interface Database {
  public: {
    Tables: {

      // ── profiles ──────────────────────────────────────────────────────────
      profiles: {
        Row: Profile;
        Insert: {
          id:             string;
          name:           string;
          email:          string;
          role?:          UserRole;
          avatar_url?:    string | null;
          phone?:         string | null;
          is_verified?:   boolean;
          reward_points?: number;
          created_at?:    string;
          updated_at?:    string;
        };
        Update: {
          id?:            string;
          name?:          string;
          email?:         string;
          role?:          UserRole;
          avatar_url?:    string | null;
          phone?:         string | null;
          is_verified?:   boolean;
          reward_points?: number;
          updated_at?:    string;
        };
      };

      // ── businesses ────────────────────────────────────────────────────────
      businesses: {
        Row: Business;
        Insert: {
          id?:                        string;
          owner_id:                   string;
          name:                       string;
          tagline?:                   string;
          description?:               string;
          category:                   BusinessCategory;
          sub_categories?:            string[];
          tier?:                      BusinessTier;
          location_city:              string;
          location_detail?:           string;
          map_url?:                   string | null;
          logo_url?:                  string | null;
          gallery_urls?:              string[];
          eco_score_overall?:         number;
          eco_level?:                 EcoLevel;
          eco_breakdown?:             EcoBreakdown;
          discount_percent?:          number | null;
          bulk_support?:              boolean;
          bulk_capacity?:             string | null;
          is_verified?:               boolean;
          tags?:                      string[];
          services?:                  string[];
          contact_email?:             string;
          contact_phone?:             string;
          website_url?:               string | null;
          facebook_url?:              string | null;
          telegram_url?:              string | null;
          rating?:                    number;
          review_count?:              number;
          open_for_collaboration?:    boolean;
          collaboration_types?:       string[];
          collaboration_description?: string | null;
          open_for_investment?:       boolean;
          investment_amount?:         string | null;
          investment_description?:    string | null;
          founded_year?:              number | null;
          is_active?:                 boolean;
          eco_description?:           string | null;
          tax_id?:                    string | null;
          notify_by_email?:           boolean;
          notify_by_phone?:           boolean;
          created_at?:                string;
          updated_at?:                string;
        };
        Update: {
          id?:                        string;
          owner_id?:                  string;
          name?:                      string;
          tagline?:                   string;
          description?:               string;
          category?:                  BusinessCategory;
          sub_categories?:            string[];
          tier?:                      BusinessTier;
          location_city?:             string;
          location_detail?:           string;
          map_url?:                   string | null;
          logo_url?:                  string | null;
          gallery_urls?:              string[];
          eco_score_overall?:         number;
          eco_level?:                 EcoLevel;
          eco_breakdown?:             EcoBreakdown;
          discount_percent?:          number | null;
          bulk_support?:              boolean;
          bulk_capacity?:             string | null;
          is_verified?:               boolean;
          tags?:                      string[];
          services?:                  string[];
          contact_email?:             string;
          contact_phone?:             string;
          website_url?:               string | null;
          facebook_url?:              string | null;
          telegram_url?:              string | null;
          rating?:                    number;
          review_count?:              number;
          open_for_collaboration?:    boolean;
          collaboration_types?:       string[];
          collaboration_description?: string | null;
          open_for_investment?:       boolean;
          investment_amount?:         string | null;
          investment_description?:    string | null;
          founded_year?:              number | null;
          is_active?:                 boolean;
          eco_description?:           string | null;
          tax_id?:                    string | null;
          notify_by_email?:           boolean;
          notify_by_phone?:           boolean;
          updated_at?:                string;
        };
      };

      // ── requests ──────────────────────────────────────────────────────────
      requests: {
        Row: Request;
        Insert: {
          id?:              string;
          buyer_id:         string;
          business_id?:     string | null;
          purpose:          RequestPurpose;
          product:          string;
          quantity?:        string | null;
          required_date:    string;
          location:         string;
          notes?:           string | null;
          event_type?:      string | null;
          guest_count?:     string | null;
          budget_range?:    string | null;
          urgency?:         string | null;
          status?:          RequestStatus;
          conversation_id?: string | null;
          created_at?:      string;
          updated_at?:      string;
        };
        Update: {
          id?:              string;
          buyer_id?:        string;
          business_id?:     string | null;
          purpose?:         RequestPurpose;
          product?:         string;
          quantity?:        string | null;
          required_date?:   string;
          location?:        string;
          notes?:           string | null;
          event_type?:      string | null;
          guest_count?:     string | null;
          budget_range?:    string | null;
          urgency?:         string | null;
          status?:          RequestStatus;
          conversation_id?: string | null;
          updated_at?:      string;
        };
      };

      // ── conversations ─────────────────────────────────────────────────────
      conversations: {
        Row: Conversation;
        Insert: {
          id?:         string;
          request_id:  string;
          business_id: string;
          buyer_id:    string;
          status?:     MessageStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?:          string;
          request_id?:  string;
          business_id?: string;
          buyer_id?:    string;
          status?:      MessageStatus;
          updated_at?:  string;
        };
      };

      // ── messages ──────────────────────────────────────────────────────────
      messages: {
        Row: Message;
        Insert: {
          id?:             string;
          conversation_id: string;
          sender_id:       string;
          content:         string;
          is_read?:        boolean;
          created_at?:     string;
        };
        Update: {
          id?:              string;
          conversation_id?: string;
          sender_id?:       string;
          content?:         string;
          is_read?:         boolean;
        };
      };

      // ── saved_businesses ──────────────────────────────────────────────────
      saved_businesses: {
        Row: SavedBusiness;
        Insert: {
          id?:         string;
          user_id:     string;
          business_id: string;
          created_at?: string;
        };
        Update: never;
      };

      // ── rewards ───────────────────────────────────────────────────────────
      rewards: {
        Row: Reward;
        Insert: {
          id?:           string;
          user_id:       string;
          action:        string;
          points:        number;
          reference_id?: string | null;
          created_at?:   string;
        };
        Update: {
          id?:           string;
          user_id?:      string;
          action?:       string;
          points?:       number;
          reference_id?: string | null;
        };
      };

      // ── reviews ───────────────────────────────────────────────────────────
      reviews: {
        Row: Review;
        Insert: {
          id?:         string;
          business_id: string;
          reviewer_id: string;
          request_id:  string;
          rating:      number;
          comment?:    string | null;
          created_at?: string;
        };
        Update: {
          rating?:  number;
          comment?: string | null;
        };
      };

    };

    Functions: {
      increment_points: {
        Args:    { user_id: string; amount: number };
        Returns: number;
      };
    };
  };
}

// ─── Convenience aliases (derived from Database, so they stay in sync) ───────

export type ProfileInsert       = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProfileUpdate       = Database["public"]["Tables"]["profiles"]["Update"];
export type BusinessInsert      = Database["public"]["Tables"]["businesses"]["Insert"];
export type BusinessUpdate      = Database["public"]["Tables"]["businesses"]["Update"];
export type RequestInsert       = Database["public"]["Tables"]["requests"]["Insert"];
export type RequestUpdate       = Database["public"]["Tables"]["requests"]["Update"];
export type ConversationInsert  = Database["public"]["Tables"]["conversations"]["Insert"];
export type ConversationUpdate  = Database["public"]["Tables"]["conversations"]["Update"];
export type MessageInsert       = Database["public"]["Tables"]["messages"]["Insert"];
export type MessageUpdate       = Database["public"]["Tables"]["messages"]["Update"];
export type SavedBusinessInsert = Database["public"]["Tables"]["saved_businesses"]["Insert"];
export type RewardInsert        = Database["public"]["Tables"]["rewards"]["Insert"];
export type ReviewInsert        = Database["public"]["Tables"]["reviews"]["Insert"];
