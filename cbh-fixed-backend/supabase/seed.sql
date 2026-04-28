-- ============================================================
-- CBH — Seed 6 Demo Businesses
-- These bypass the normal registration flow intentionally.
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================
-- BEFORE RUNNING:
-- 1. Create your admin account normally via the website signup
-- 2. Find your admin user ID:
--    SELECT id, email FROM auth.users WHERE email = 'your-admin@email.com';
-- 3. Replace 'PASTE_YOUR_ADMIN_UUID_HERE' below with that UUID
-- ============================================================

DO $$
DECLARE
  demo_owner_id uuid := '856f3176-d8eb-4cec-870b-17f450629726';
BEGIN

  -- Safety check
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = demo_owner_id) THEN
    RAISE EXCEPTION 'User ID not found. Check that you replaced the UUID correctly.';
  END IF;

  -- ── 1. GreenLeaf Catering ────────────────────────────────────────────────
  INSERT INTO businesses (
    owner_id, name, tagline, description,
    category, tier, location_city, location_detail,
    logo_url, gallery_urls,
    eco_score_overall, eco_level, eco_breakdown,
    discount_percent, bulk_support, bulk_capacity,
    is_verified, is_active, verification_status,
    tags, services,
    contact_email, contact_phone,
    facebook_url, telegram_url, website_url,
    rating, review_count,
    open_for_collaboration, collaboration_types,
    open_for_investment, investment_amount,
    notify_by_email, founded_year
  ) VALUES (
    demo_owner_id,
    'GreenLeaf Catering',
    'Farm-to-table catering for every occasion',
    'GreenLeaf Catering sources 90% of ingredients from local organic farms within 50 km. We specialize in corporate lunches, event catering, and bulk meal prep for businesses. Our chefs craft menus that are nutritious and memorable.',
    'Food', 'SME', 'Phnom Penh', 'Toul Kork, Phnom Penh',
    'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=400&fit=crop',
    ARRAY[
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1555244162-803834f70033?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=500&fit=crop'
    ],
    88, 'High',
    '{"packaging":18,"sourcing":18,"energy":14,"waste":16,"delivery":12,"practices":10}'::jsonb,
    12, true, 'Up to 500 meals/day',
    true, true, 'verified',
    ARRAY['organic','bulk','verified','local','eco-friendly'],
    ARRAY['Corporate Catering','Event Buffets','Meal Prep','Custom Menus','Breakfast Boxes'],
    'hello@greenleaf.kh', '+855 12 345 678',
    'https://facebook.com/greenleafkh', 'https://t.me/greenleafkh', 'https://greenleaf.kh',
    4.8, 124,
    true, ARRAY['supplier','marketing']::text[],
    false, null,
    true, 2021
  );

  -- ── 2. EcoPack Solutions ─────────────────────────────────────────────────
  INSERT INTO businesses (
    owner_id, name, tagline, description,
    category, tier, location_city, location_detail,
    logo_url, gallery_urls,
    eco_score_overall, eco_level, eco_breakdown,
    discount_percent, bulk_support, bulk_capacity,
    is_verified, is_active, verification_status,
    tags, services,
    contact_email, contact_phone,
    facebook_url, telegram_url, website_url,
    rating, review_count,
    open_for_collaboration, collaboration_types,
    open_for_investment, investment_amount,
    notify_by_email, founded_year
  ) VALUES (
    demo_owner_id,
    'EcoPack Solutions',
    'Sustainable packaging for forward-thinking brands',
    'EcoPack designs and manufactures biodegradable and compostable packaging solutions. From food containers to shipping boxes, every product is certified plastic-free.',
    'Packaging', 'Startup', 'Siem Reap', 'Svay Dangkum, Siem Reap',
    'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&h=400&fit=crop',
    ARRAY[
      'https://images.unsplash.com/photo-1602928321679-560bb453f190?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&h=500&fit=crop'
    ],
    95, 'High',
    '{"packaging":20,"sourcing":18,"energy":16,"waste":18,"delivery":13,"practices":10}'::jsonb,
    8, true, '10,000+ units/week',
    true, true, 'verified',
    ARRAY['plastic-free','bulk','certified','eco'],
    ARRAY['Custom Boxes','Food Containers','Bags & Wraps','Label Printing'],
    'orders@ecopack.kh', '+855 23 456 789',
    'https://facebook.com/ecopackkh', null, null,
    4.6, 87,
    true, ARRAY['partner']::text[],
    true, '$20,000–$50,000',
    true, 2022
  );

  -- ── 3. Mekong Fresh Ingredients ──────────────────────────────────────────
  INSERT INTO businesses (
    owner_id, name, tagline, description,
    category, tier, location_city, location_detail,
    logo_url, gallery_urls,
    eco_score_overall, eco_level, eco_breakdown,
    bulk_support, bulk_capacity,
    is_verified, is_active, verification_status,
    tags, services,
    contact_email, contact_phone,
    telegram_url,
    rating, review_count,
    open_for_collaboration, collaboration_types,
    open_for_investment,
    notify_by_email, founded_year
  ) VALUES (
    demo_owner_id,
    'Mekong Fresh Ingredients',
    'Premium local produce delivered to your door',
    'Direct sourcing from Mekong Delta farms — vegetables, herbs, spices, and grains. We offer weekly subscription boxes for restaurants and one-time bulk orders for events.',
    'Ingredients', 'Company', 'Phnom Penh', 'Chbar Ampov, Phnom Penh',
    'https://images.unsplash.com/photo-1506484381205-f7945653044d?w=400&h=400&fit=crop',
    ARRAY[
      'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&h=500&fit=crop'
    ],
    82, 'High',
    '{"packaging":14,"sourcing":18,"energy":12,"waste":15,"delivery":13,"practices":10}'::jsonb,
    true, 'Unlimited — farm direct',
    true, true, 'verified',
    ARRAY['fresh','local','bulk','same-day'],
    ARRAY['Weekly Subscriptions','Bulk Orders','Custom Sourcing','Same-Day Delivery'],
    'supply@mekongfresh.kh', '+855 34 567 890',
    'https://t.me/mekongfresh',
    4.7, 203,
    false, ARRAY[]::text[],
    false,
    true, 2019
  );

  -- ── 4. EventNest Rentals ─────────────────────────────────────────────────
  INSERT INTO businesses (
    owner_id, name, tagline, description,
    category, tier, location_city, location_detail,
    logo_url, gallery_urls,
    eco_score_overall, eco_level, eco_breakdown,
    discount_percent, bulk_support,
    is_verified, is_active, verification_status,
    tags, services,
    contact_email, contact_phone,
    rating, review_count,
    open_for_collaboration, collaboration_types,
    open_for_investment, investment_amount,
    notify_by_email, founded_year
  ) VALUES (
    demo_owner_id,
    'EventNest Rentals',
    'Everything you need, delivered and set up',
    'Tables, chairs, tents, AV equipment, and more. EventNest is the go-to rental company for corporate events, weddings, and outdoor festivals.',
    'Rentals', 'SME', 'Phnom Penh', 'BKK1, Phnom Penh',
    'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=400&h=400&fit=crop',
    ARRAY[
      'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800&h=500&fit=crop'
    ],
    72, 'High',
    '{"packaging":10,"sourcing":12,"energy":12,"waste":14,"delivery":14,"practices":10}'::jsonb,
    15, true,
    false, true, 'verified',
    ARRAY['events','setup','AV','bulk'],
    ARRAY['Furniture Rental','Tent & Canopy','AV Equipment','Full Setup Service'],
    'rent@eventnest.kh', '+855 45 678 901',
    4.4, 61,
    true, ARRAY['marketing','partner']::text[],
    true, '$10,000–$30,000',
    true, 2020
  );

  -- ── 5. PureSpice Collective ──────────────────────────────────────────────
  INSERT INTO businesses (
    owner_id, name, tagline, description,
    category, tier, location_city, location_detail,
    logo_url, gallery_urls,
    eco_score_overall, eco_level, eco_breakdown,
    discount_percent, bulk_support, bulk_capacity,
    is_verified, is_active, verification_status,
    tags, services,
    contact_email, contact_phone,
    telegram_url,
    rating, review_count,
    open_for_collaboration, collaboration_types,
    open_for_investment, investment_amount,
    notify_by_email, founded_year
  ) VALUES (
    demo_owner_id,
    'PureSpice Collective',
    'Artisanal spice blends from Cambodian highlands',
    'Hand-harvested spices from Kampot and Mondulkiri. PureSpice offers premium Kampot pepper, turmeric, lemongrass, and custom spice blends for restaurants, retailers, and food brands.',
    'Ingredients', 'Startup', 'Kampot', 'Kampot Town, Kampot Province',
    'https://images.unsplash.com/photo-1532336414038-cf19250c5757?w=400&h=400&fit=crop',
    ARRAY[
      'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1578020190125-f4f7c18bc9cb?w=800&h=500&fit=crop'
    ],
    91, 'High',
    '{"packaging":18,"sourcing":19,"energy":14,"waste":16,"delivery":14,"practices":10}'::jsonb,
    10, true, '500kg+/month',
    true, true, 'verified',
    ARRAY['artisanal','kampot','wholesale','eco'],
    ARRAY['Bulk Spice Supply','Custom Blends','Retail Packaging','B2B Wholesale'],
    'spice@purespice.kh', '+855 67 890 123',
    'https://t.me/purespice',
    4.9, 38,
    false, ARRAY[]::text[],
    true, '$5,000–$15,000',
    true, 2022
  );

  -- ── 6. DigitalBoost Agency ───────────────────────────────────────────────
  INSERT INTO businesses (
    owner_id, name, tagline, description,
    category, tier, location_city, location_detail,
    logo_url, gallery_urls,
    eco_score_overall, eco_level, eco_breakdown,
    bulk_support,
    is_verified, is_active, verification_status,
    tags, services,
    contact_email, contact_phone,
    facebook_url,
    rating, review_count,
    open_for_collaboration, collaboration_types,
    open_for_investment,
    notify_by_email, founded_year
  ) VALUES (
    demo_owner_id,
    'DigitalBoost Agency',
    'Growth marketing for local businesses',
    'DigitalBoost offers SEO, social media management, content creation, and performance advertising for SMEs and startups.',
    'Event Services', 'Startup', 'Phnom Penh', 'Daun Penh, Phnom Penh',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=400&fit=crop',
    ARRAY[
      'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=800&h=500&fit=crop'
    ],
    65, 'Medium',
    '{"packaging":8,"sourcing":10,"energy":12,"waste":12,"delivery":13,"practices":10}'::jsonb,
    false,
    true, true, 'verified',
    ARRAY['digital','marketing','SEO','verified'],
    ARRAY['SEO & SEM','Social Media','Content Creation','Paid Ads'],
    'hi@digitalboost.kh', '+855 56 789 012',
    'https://facebook.com/digitalboostkh',
    4.5, 45,
    true, ARRAY['marketing','partner']::text[],
    false,
    true, 2023
  );

  RAISE NOTICE '✅ 6 demo businesses inserted and verified successfully.';
END $$;

-- Confirm
SELECT name, category, tier, location_city, is_verified, is_active, verification_status
FROM businesses
ORDER BY created_at DESC
LIMIT 10;
