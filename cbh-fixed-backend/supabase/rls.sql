-- ============================================================
-- CBH v2 — Row Level Security Policies
-- SAFE TO RUN MULTIPLE TIMES — drops existing policies first
-- IMPORTANT: Run schema.sql FIRST, then this file.
-- ============================================================

-- ── PROFILES ──────────────────────────────────────────────────────────────
alter table profiles enable row level security;
drop policy if exists "profiles: public read"   on profiles;
drop policy if exists "profiles: owner update"  on profiles;

create policy "profiles: public read"
  on profiles for select using (true);

create policy "profiles: owner update"
  on profiles for update using (auth.uid() = id);

-- ── BUSINESSES ────────────────────────────────────────────────────────────
alter table businesses enable row level security;
drop policy if exists "businesses: public read"          on businesses;
drop policy if exists "businesses: owner read own"       on businesses;
drop policy if exists "businesses: authenticated create" on businesses;
drop policy if exists "businesses: owner update"         on businesses;
drop policy if exists "businesses: owner delete"         on businesses;

create policy "businesses: public read"
  on businesses for select using (is_active = true);

create policy "businesses: owner read own"
  on businesses for select using (auth.uid() = owner_id);

create policy "businesses: authenticated create"
  on businesses for insert with check (auth.uid() = owner_id);

create policy "businesses: owner update"
  on businesses for update using (auth.uid() = owner_id);

create policy "businesses: owner delete"
  on businesses for delete using (auth.uid() = owner_id);

-- ── REVIEWS ───────────────────────────────────────────────────────────────
-- NOTE: reviews table must exist (run schema.sql first)
alter table reviews enable row level security;
drop policy if exists "reviews: public read"             on reviews;
drop policy if exists "reviews: completed buyers insert" on reviews;
drop policy if exists "reviews: reviewer update"         on reviews;
drop policy if exists "reviews: reviewer delete"         on reviews;

-- Anyone can read reviews
create policy "reviews: public read"
  on reviews for select using (true);

-- Only buyers who have a COMPLETED request with that business can submit a review
create policy "reviews: completed buyers insert"
  on reviews for insert with check (
    auth.uid() = reviewer_id
    and exists (
      select 1 from requests r
      where r.buyer_id    = auth.uid()
        and r.business_id = reviews.business_id
        and r.status      = 'completed'
    )
  );

create policy "reviews: reviewer update"
  on reviews for update using (auth.uid() = reviewer_id);

create policy "reviews: reviewer delete"
  on reviews for delete using (auth.uid() = reviewer_id);

-- ── REQUESTS ──────────────────────────────────────────────────────────────
alter table requests enable row level security;
drop policy if exists "requests: buyer read own"         on requests;
drop policy if exists "requests: business read incoming" on requests;
drop policy if exists "requests: authenticated create"   on requests;
drop policy if exists "requests: participants update"    on requests;

create policy "requests: buyer read own"
  on requests for select using (auth.uid() = buyer_id);

create policy "requests: business read incoming"
  on requests for select using (
    exists (
      select 1 from businesses
      where businesses.id = requests.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "requests: authenticated create"
  on requests for insert with check (auth.uid() = buyer_id);

create policy "requests: participants update"
  on requests for update using (
    auth.uid() = buyer_id
    or exists (
      select 1 from businesses
      where businesses.id = requests.business_id
        and businesses.owner_id = auth.uid()
    )
  );

-- ── CONVERSATIONS ──────────────────────────────────────────────────────────
alter table conversations enable row level security;
drop policy if exists "conversations: participants read"   on conversations;
drop policy if exists "conversations: service create"      on conversations;
drop policy if exists "conversations: participants update" on conversations;

create policy "conversations: participants read"
  on conversations for select using (
    auth.uid() = buyer_id
    or exists (
      select 1 from businesses
      where businesses.id = conversations.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "conversations: service create"
  on conversations for insert with check (auth.uid() = buyer_id);

create policy "conversations: participants update"
  on conversations for update using (
    auth.uid() = buyer_id
    or exists (
      select 1 from businesses
      where businesses.id = conversations.business_id
        and businesses.owner_id = auth.uid()
    )
  );

-- ── MESSAGES ──────────────────────────────────────────────────────────────
alter table messages enable row level security;
drop policy if exists "messages: participants read"        on messages;
drop policy if exists "messages: participants insert"      on messages;
drop policy if exists "messages: participants update read" on messages;

create policy "messages: participants read"
  on messages for select using (
    exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and (
          c.buyer_id = auth.uid()
          or exists (
            select 1 from businesses b
            where b.id = c.business_id and b.owner_id = auth.uid()
          )
        )
    )
  );

create policy "messages: participants insert"
  on messages for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and (
          c.buyer_id = auth.uid()
          or exists (
            select 1 from businesses b
            where b.id = c.business_id and b.owner_id = auth.uid()
          )
        )
    )
  );

create policy "messages: participants update read"
  on messages for update using (
    exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and (
          c.buyer_id = auth.uid()
          or exists (
            select 1 from businesses b
            where b.id = c.business_id and b.owner_id = auth.uid()
          )
        )
    )
  );

-- ── SAVED BUSINESSES ──────────────────────────────────────────────────────
alter table saved_businesses enable row level security;
drop policy if exists "saved_businesses: owner read"   on saved_businesses;
drop policy if exists "saved_businesses: owner insert" on saved_businesses;
drop policy if exists "saved_businesses: owner delete" on saved_businesses;

create policy "saved_businesses: owner read"   on saved_businesses for select using (auth.uid() = user_id);
create policy "saved_businesses: owner insert" on saved_businesses for insert with check (auth.uid() = user_id);
create policy "saved_businesses: owner delete" on saved_businesses for delete using (auth.uid() = user_id);

-- ── REWARDS ───────────────────────────────────────────────────────────────
alter table rewards enable row level security;
drop policy if exists "rewards: owner read" on rewards;

create policy "rewards: owner read"
  on rewards for select using (auth.uid() = user_id);

-- ── STORAGE RLS (run after creating buckets in Supabase Dashboard) ─────────
-- Avatars bucket: users can upload/update their own avatar
-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict do nothing;
-- create policy "avatars: public read" on storage.objects for select using (bucket_id = 'avatars');
-- create policy "avatars: owner upload" on storage.objects for insert with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
-- create policy "avatars: owner update" on storage.objects for update using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
-- create policy "avatars: owner delete" on storage.objects for delete using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
