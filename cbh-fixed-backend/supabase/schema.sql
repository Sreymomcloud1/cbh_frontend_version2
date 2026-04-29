-- ============================================================
-- CBH v2 — Supabase PostgreSQL Schema
-- SAFE TO RUN MULTIPLE TIMES — uses IF NOT EXISTS / OR REPLACE
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Extensions ────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ── Enums (safe: only create if missing) ──────────────────────────────────
do $$ begin
  create type user_role as enum ('buyer', 'business', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type business_tier as enum ('Startup', 'SME', 'Company');
exception when duplicate_object then null; end $$;

do $$ begin
  create type business_category as enum ('Food','Ingredients','Packaging','Rentals','Event Services','Others');
exception when duplicate_object then null; end $$;

do $$ begin
  create type eco_level as enum ('Basic', 'Medium', 'High');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_purpose as enum ('buy', 'collaborate', 'invest');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_status as enum ('pending', 'replied', 'in-progress', 'completed', 'declined');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_status as enum ('pending', 'replied', 'in-progress', 'completed');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  name            text        not null,
  email           text        not null unique,
  phone           text,                          -- optional phone number
  avatar_url      text,                          -- profile picture stored in Supabase Storage
  role            user_role   not null default 'buyer',
  is_verified     boolean     not null default false,
  reward_points   int         not null default 0 check (reward_points >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Add missing columns safely for existing schemas
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists avatar_url text;

-- Auto-create profile after Supabase Auth signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'buyer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────
-- BUSINESSES
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists businesses (
  id                        uuid primary key default uuid_generate_v4(),
  owner_id                  uuid        not null references profiles(id) on delete cascade,
  name                      text        not null,
  tagline                   text        not null default '',
  description               text        not null default '',
  category                  business_category not null,
  sub_categories            text[]      not null default '{}',
  tier                      business_tier not null default 'Startup',
  location_city             text        not null,
  location_detail           text        not null default '',
  map_url                   text,
  logo_url                  text,
  gallery_urls              text[]      not null default '{}',
  eco_score_overall         int         not null default 0 check (eco_score_overall between 0 and 100),
  eco_level                 eco_level   not null default 'Basic',
  eco_breakdown             jsonb       not null default '{"packaging":0,"sourcing":0,"energy":0,"waste":0,"delivery":0,"practices":0}',
  eco_description           text,                -- unique sustainability narrative (why eco-friendly + what earns the score)
  discount_percent          int check (discount_percent between 0 and 100),
  bulk_support              boolean     not null default false,
  bulk_capacity             text,
  is_verified               boolean     not null default false,
  tags                      text[]      not null default '{}',
  services                  text[]      not null default '{}',
  contact_email             text        not null,
  contact_phone             text        not null,
  website_url               text,
  facebook_url              text,
  telegram_url              text,
  tax_id                    text,
  rating                    numeric(3,2) not null default 0 check (rating between 0 and 5),
  review_count              int         not null default 0,
  open_for_collaboration    boolean     not null default false,
  collaboration_types       text[]      not null default '{}',
  collaboration_description text,
  open_for_investment       boolean     not null default false,
  investment_amount         text,
  investment_description    text,
  founded_year              int check (founded_year between 1900 and 2100),
  is_active                 boolean     not null default true,
  notify_by_email           boolean     not null default true,
  notify_by_phone           boolean     not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- Add new columns safely for existing tables
alter table businesses add column if not exists eco_description text;
alter table businesses add column if not exists tax_id text;
alter table businesses add column if not exists notify_by_email boolean not null default true;
alter table businesses add column if not exists notify_by_phone boolean not null default false;

create unique index if not exists businesses_owner_active_idx on businesses(owner_id) where is_active = true;
create index if not exists businesses_category_idx      on businesses(category);
create index if not exists businesses_tier_idx          on businesses(tier);
create index if not exists businesses_location_idx      on businesses(location_city);
create index if not exists businesses_eco_score_idx     on businesses(eco_score_overall desc);
create index if not exists businesses_active_idx        on businesses(is_active);
create index if not exists businesses_collab_idx        on businesses(open_for_collaboration) where open_for_collaboration = true;
create index if not exists businesses_invest_idx        on businesses(open_for_investment) where open_for_investment = true;

-- FIX: Use a generated immutable column for full-text search to avoid IMMUTABLE error
-- Drop the old non-immutable functional index if it exists
drop index if exists businesses_search_idx;

-- Create a IMMUTABLE-safe search index using a stored generated column approach
-- We store the tsvector in the table itself for reliability
alter table businesses add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('english',
      coalesce(name,'') || ' ' ||
      coalesce(description,'') || ' ' ||
      coalesce(tagline,'') || ' ' ||
      array_to_string(services, ' ') || ' ' ||
      array_to_string(tags, ' ')
    )
  ) stored;

create index if not exists businesses_search_idx on businesses using gin(search_vector);

-- ─────────────────────────────────────────────────────────────────────────
-- REVIEWS
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists reviews (
  id          uuid primary key default uuid_generate_v4(),
  business_id uuid        not null references businesses(id) on delete cascade,
  reviewer_id uuid        not null references profiles(id)   on delete cascade,
  request_id  uuid        not null,                           -- must have completed request
  rating      int         not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now(),
  unique(business_id, reviewer_id)                            -- one review per user per business
);

create index if not exists reviews_business_idx on reviews(business_id);
create index if not exists reviews_reviewer_idx on reviews(reviewer_id);

-- Auto-update business rating when a review is added/updated/deleted
create or replace function update_business_rating()
returns trigger language plpgsql as $$
declare
  v_bid uuid;
begin
  v_bid := coalesce(new.business_id, old.business_id);
  update businesses
  set
    rating       = coalesce((select avg(rating) from reviews where business_id = v_bid), 0),
    review_count = (select count(*) from reviews where business_id = v_bid),
    updated_at   = now()
  where id = v_bid;
  return coalesce(new, old);
end;
$$;

drop trigger if exists on_review_change on reviews;
create trigger on_review_change
  after insert or update or delete on reviews
  for each row execute function update_business_rating();

-- ─────────────────────────────────────────────────────────────────────────
-- REQUESTS
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists requests (
  id              uuid primary key default uuid_generate_v4(),
  buyer_id        uuid           not null references profiles(id)    on delete cascade,
  business_id     uuid                    references businesses(id)  on delete set null,
  purpose         request_purpose not null,
  product         text           not null,
  quantity        text,
  required_date   date           not null,
  location        text           not null,
  notes           text,
  -- Smart-quote fields (collected from the AI-powered quote assistant)
  event_type      text,          -- e.g. "Wedding", "Corporate Event", "Birthday"
  guest_count     text,          -- e.g. "50-100 guests"
  budget_range    text,          -- e.g. "$500-$1000"
  urgency         text,          -- e.g. "Flexible", "Within 1 week"
  status          request_status not null default 'pending',
  conversation_id uuid,
  created_at      timestamptz    not null default now(),
  updated_at      timestamptz    not null default now()
);

-- Add smart-quote fields safely
alter table requests add column if not exists event_type text;
alter table requests add column if not exists guest_count text;
alter table requests add column if not exists budget_range text;
alter table requests add column if not exists urgency text;

create index if not exists requests_buyer_idx    on requests(buyer_id);
create index if not exists requests_business_idx on requests(business_id);
create index if not exists requests_status_idx   on requests(status);
create index if not exists requests_purpose_idx  on requests(purpose);
create index if not exists requests_created_idx  on requests(created_at desc);

-- ─────────────────────────────────────────────────────────────────────────
-- CONVERSATIONS
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists conversations (
  id          uuid primary key default uuid_generate_v4(),
  request_id  uuid         not null references requests(id)    on delete cascade,
  business_id uuid         not null references businesses(id)  on delete cascade,
  buyer_id    uuid         not null references profiles(id)    on delete cascade,
  status      message_status not null default 'pending',
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

create unique index if not exists conversations_request_idx on conversations(request_id);
create index if not exists conversations_buyer_idx          on conversations(buyer_id);
create index if not exists conversations_business_idx       on conversations(business_id);
create index if not exists conversations_status_idx         on conversations(status);
create index if not exists conversations_updated_idx        on conversations(updated_at desc);

-- ─────────────────────────────────────────────────────────────────────────
-- MESSAGES
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid        not null references conversations(id) on delete cascade,
  sender_id       uuid        not null references profiles(id)      on delete cascade,
  content         text        not null check (length(content) between 1 and 2000),
  is_read         boolean     not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_idx on messages(conversation_id);
create index if not exists messages_sender_idx       on messages(sender_id);
create index if not exists messages_unread_idx       on messages(conversation_id, is_read) where is_read = false;
create index if not exists messages_created_idx      on messages(created_at asc);

create or replace function update_conversation_timestamp()
returns trigger language plpgsql as $$
begin
  update conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists on_message_insert on messages;
create trigger on_message_insert
  after insert on messages
  for each row execute function update_conversation_timestamp();

-- ─────────────────────────────────────────────────────────────────────────
-- PLATFORM FEEDBACK (Contact form → admin dashboard, not email-only)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists feedback_submissions (
  id         uuid primary key default uuid_generate_v4(),
  sender_id  uuid        not null references profiles(id) on delete cascade,
  name       text        not null,
  email      text        not null,
  topic      text        not null,
  subject    text        not null default '',
  message    text        not null check (length(message) between 1 and 2000),
  rating     int         check (rating is null or (rating between 1 and 5)),
  created_at timestamptz not null default now()
);

create index if not exists feedback_submissions_created_idx on feedback_submissions(created_at desc);
create index if not exists feedback_submissions_sender_idx  on feedback_submissions(sender_id);

-- ─────────────────────────────────────────────────────────────────────────
-- SAVED BUSINESSES
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists saved_businesses (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid        not null references profiles(id)   on delete cascade,
  business_id uuid        not null references businesses(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique(user_id, business_id)
);

create index if not exists saved_businesses_user_idx on saved_businesses(user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- REWARDS
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists rewards (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid        not null references profiles(id) on delete cascade,
  action       text        not null,
  points       int         not null check (points > 0),
  reference_id uuid,
  created_at   timestamptz not null default now()
);

create index if not exists rewards_user_idx on rewards(user_id);

create or replace function increment_points(user_id uuid, amount int)
returns int language sql as $$
  update profiles
  set reward_points = reward_points + amount, updated_at = now()
  where id = user_id
  returning reward_points;
$$;

-- ── updated_at triggers ────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at      on profiles;
drop trigger if exists businesses_updated_at    on businesses;
drop trigger if exists requests_updated_at      on requests;
drop trigger if exists conversations_updated_at on conversations;

create trigger profiles_updated_at      before update on profiles      for each row execute function set_updated_at();
create trigger businesses_updated_at    before update on businesses    for each row execute function set_updated_at();
create trigger requests_updated_at      before update on requests      for each row execute function set_updated_at();
create trigger conversations_updated_at before update on conversations for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- STORAGE BUCKETS (run once — safe with if not exists logic via DO block)
-- ─────────────────────────────────────────────────────────────────────────
-- NOTE: Run the following in the Supabase Dashboard > Storage to create buckets,
-- OR use the SQL below if storage schema is available:
-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict do nothing;
-- insert into storage.buckets (id, name, public) values ('business-assets', 'business-assets', true) on conflict do nothing;
