// ─── Shared enums (match backend database.ts exactly) ────────────────────────

export type BusinessCategory =
  | "Food"
  | "Ingredients"
  | "Packaging"
  | "Rentals"
  | "Event Services"
  | "Others";

export type BusinessTier = "Startup" | "SME" | "Company";
export type RequestPurpose = "buy" | "collaborate" | "invest";
export type RequestStatus = "pending" | "replied" | "in-progress" | "completed" | "declined";
export type MessageStatus = "pending" | "replied" | "in-progress" | "completed";
export type UserRole = "buyer" | "business" | "admin";
export type EcoLevel = "Basic" | "Medium" | "High";
export type CollaborationType = "supplier" | "partner" | "marketing";

// Keep frontend alias for legacy component props
export type SupplierCategory = BusinessCategory;
export type SupplierTier = BusinessTier;

// ─── Eco score ────────────────────────────────────────────────────────────────

export interface EcoBreakdown {
  packaging: number;
  sourcing: number;
  energy: number;
  waste: number;
  delivery: number;
  practices: number;
}

export interface EcoScore {
  overall: number;
  level: EcoLevel;
  breakdown: EcoBreakdown;
}

// ─── Supplier / Business ─────────────────────────────────────────────────────
// CamelCase shape used by UI components; transformed from API responses.

export interface CollaborationSettings {
  enabled: boolean;
  lookingFor: CollaborationType[];
  description?: string;
}

export interface InvestmentSettings {
  enabled: boolean;
  amount?: string;
  description?: string;
}

export interface Supplier {
  id: string;
  name: string;
  tagline: string;
  description: string;

  category: BusinessCategory;
  subCategories?: string[];

  tier: BusinessTier;

  location: string;
  locationDetail?: string;
  mapUrl?: string;

  logo: string;
  gallery: string[];

  ecoScore: EcoScore;

  discountPercent?: number;
  bulkSupport: boolean;
  bulkCapacity?: string;

  verified: boolean;

  tags: string[];
  services: string[];

  contactEmail: string;
  contactPhone: string;

  website?: string;
  facebookUrl?: string;
  telegramUrl?: string;

  rating: number;
  reviewCount: number;

  foundedYear?: number;

  // ─────────────────────────────────────────────
  // ✅ ADD THESE (fixes your TypeScript error)
  // ─────────────────────────────────────────────

  /** Mirrors backend `verification_status` */
  verificationStatus?: "pending" | "verified" | "rejected" | "revoked" | "approved";
  /** Admin rejection/revocation note when applicable */
  rejectionReason?: string | null;
  isActive: boolean;

  notifyByEmail: boolean;
  notifyByPhone: boolean;

  phone: string;

  collaboration: CollaborationSettings;
  investment: InvestmentSettings;

  /** Backend `eco_description` — bespoke eco narrative for listings */
  ecoDescription?: string | null;
  /** Optional business identifier for display on profile */
  taxId?: string | null;
}

// ─── Messages & Conversations ─────────────────────────────────────────────────

export interface Message {
  id: string;
  senderId: string;               // maps to sender_id
  senderName: string;
  senderRole: UserRole;
  content: string;
  timestamp: string;              // maps to created_at
  read: boolean;                  // maps to is_read
}

export interface Conversation {
  id: string;
  requestId: string;              // maps to request_id
  supplierId: string;             // maps to business_id
  supplierName: string;           // joined from businesses.name
  supplierLogo?: string;          // joined from businesses.logo_url
  buyerId: string;                // maps to buyer_id
  buyerName: string;              // joined from profiles.name
  purpose: RequestPurpose;        // joined from requests.purpose
  product: string;                // joined from requests.product
  status: MessageStatus;
  messages: Message[];
  createdAt: string;              // maps to created_at
  updatedAt: string;              // maps to updated_at
}

// ─── Quote Requests ───────────────────────────────────────────────────────────

export interface QuoteRequest {
  id: string;
  supplierId?: string;            // maps to business_id
  supplierName?: string;          // joined from businesses.name
  buyerName?: string;             // joined from profiles.name (business view)
  buyerEmail?: string;            // joined from profiles.email (business view)
  purpose: RequestPurpose;
  product: string;
  quantity: string;               // maps to quantity (nullable → "" in UI)
  date: string;                   // maps to required_date
  location: string;
  notes?: string;
  status: RequestStatus;
  createdAt: string;              // maps to created_at
  conversationId?: string;        // maps to conversation_id
}

// ─── User / Profile ───────────────────────────────────────────────────────────

export interface Badge {
  id: string;
  label: string;
  icon: string;
  description: string;
  earned: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  avatar?: string;                // maps to avatar_url
  isVerified: boolean;            // maps to is_verified
  savedSuppliers: string[];       // from saved_businesses table
  requests: QuoteRequest[];
  rewardPoints: number;           // maps to reward_points
  badges: Badge[];
  conversations: string[];
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export interface Founder {
  id: string;
  name: string;
  role: string;
  message: string;
  imageUrl?: string;
  facebookUrl?: string;
  linkedinUrl?: string;
  telegramUrl?: string;
  email?: string;
  phone?: string;
}

export interface FilterState {
  search: string;
  category: BusinessCategory | "";
  location: string;
  minEcoScore: number;
  bulkSupport: boolean;
  tier: BusinessTier | "";
  openForCollaboration: boolean;
  openForInvestment: boolean;
}

export interface FeedbackMessage {
  name: string;
  email: string;
  topic: string;
  subject: string;
  message: string;
  rating: number;
}

// ─── API payload shapes (match backend validator schemas exactly) ──────────────

export interface CreateRequestPayload {
  business_id?: string | null;
  purpose: RequestPurpose;
  product: string;
  quantity?: string | null;
  required_date: string;          // YYYY-MM-DD
  location: string;
  notes?: string | null;
}

export interface CreateBusinessPayload {
  name: string;
  tagline: string;
  description: string;
  category: BusinessCategory;
  sub_categories: string[];
  tier: BusinessTier;
  location_city: string;
  location_detail: string;
  map_url?: string | null;
  logo_url?: string | null;
  gallery_urls: string[];
  discount_percent?: number | null;
  bulk_support: boolean;
  bulk_capacity?: string | null;
  tags: string[];
  services: string[];
  contact_email: string;
  contact_phone: string;
  website_url?: string | null;
  facebook_url?: string | null;
  telegram_url?: string | null;
  open_for_collaboration: boolean;
  collaboration_types: CollaborationType[];
  collaboration_description?: string | null;
  open_for_investment: boolean;
  investment_amount?: string | null;
  investment_description?: string | null;
  founded_year?: number | null;
}

export interface SendMessagePayload {
  content: string;
}

export interface UpdateRequestStatusPayload {
  status: Exclude<RequestStatus, "pending">;
}

export interface UpdateConversationStatusPayload {
  status: MessageStatus;
}
