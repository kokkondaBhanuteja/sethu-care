-- Dev seed data: the full demo catalog so the customer app has something to browse.
-- Idempotent + non-destructive (upserts): safe to re-run even when bookings already reference
-- services/variants. Slugs match the app's clay-icon / photo registry (features/catalog/images.ts).
BEGIN;

INSERT INTO categories (name, slug, sort_order)
VALUES ('Home Services', 'home-services', 1)
ON CONFLICT (slug) DO NOTHING;

-- All 15 services under one category. estimated_minutes in minutes.
INSERT INTO services (category_id, name, slug, description, assignment_mode, estimated_minutes)
SELECT c.id, v.name, v.slug, v.description, 'MANUAL', v.mins
FROM categories c
CROSS JOIN (
  VALUES
    ('AC Repair & Service', 'ac-repair',       'Cooling issues, gas refill, and deep clean.', 60),
    ('Electrical',          'electrical',      'Wiring, switches, fans, and fixtures.',        45),
    ('Plumbing',            'plumbing',        'Leaks, blockages, taps, and fittings.',        45),
    ('Air Cooler Service',  'air-cooler',      'Cooling pads, pump, and deep cleaning.',       45),
    ('Ceiling Fan',         'ceiling-fan',     'Install, repair, and regulator fixes.',        30),
    ('Kitchen Chimney',     'chimney',         'Deep clean, filter, and suction fixes.',       60),
    ('Gas Stove',           'gas-stove',       'Burner, ignition, and leak checks.',           45),
    ('Geyser / Water Heater','geyser',         'Heating element, thermostat, and leaks.',      60),
    ('Handyman',            'handyman',        'Mounting, fixes, and odd jobs.',               60),
    ('Inverter & Battery',  'inverter',        'Backup, wiring, and battery checks.',          60),
    ('Microwave Oven',      'microwave',       'Heating, turntable, and door fixes.',          45),
    ('Refrigerator Repair', 'refrigerator',    'Cooling, gas refill, and compressor.',         60),
    ('TV Installation',     'tv-install',      'Wall-mount, setup, and calibration.',          45),
    ('Washing Machine',     'washing-machine', 'Drainage, spin, and drum issues.',             60),
    ('Water Purifier (RO)', 'water-purifier',  'Filter, membrane, and RO service.',            45)
) AS v(name, slug, description, mins)
WHERE c.slug = 'home-services'
ON CONFLICT (slug) DO UPDATE
  SET category_id = EXCLUDED.category_id,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      estimated_minutes = EXCLUDED.estimated_minutes,
      is_active = TRUE;

-- One or two variants per service, priced in paise.
INSERT INTO service_variants (service_id, name, base_price_paise)
SELECT s.id, x.vname, x.price
FROM services s
JOIN (
  VALUES
    ('ac-repair',       'Standard Service', 59900),
    ('ac-repair',       'Deep Clean',       99900),
    ('electrical',      'Standard Visit',   49900),
    ('plumbing',        'Standard Visit',   49900),
    ('air-cooler',      'Standard Service', 39900),
    ('ceiling-fan',     'Install / Repair', 29900),
    ('chimney',         'Deep Clean',       69900),
    ('gas-stove',       'Standard Service', 39900),
    ('geyser',          'Standard Service', 49900),
    ('handyman',        'Hourly Visit',     39900),
    ('inverter',        'Standard Service', 49900),
    ('microwave',       'Standard Service', 39900),
    ('refrigerator',    'Standard Service', 59900),
    ('tv-install',      'Wall Mount',       49900),
    ('washing-machine', 'Standard Service', 59900),
    ('water-purifier',  'Standard Service', 39900)
) AS x(slug, vname, price) ON s.slug = x.slug
ON CONFLICT (service_id, name) DO UPDATE
  SET base_price_paise = EXCLUDED.base_price_paise;

-- Drop the old demo category if nothing references it anymore.
DELETE FROM categories
WHERE slug = 'appliance-repair'
  AND NOT EXISTS (SELECT 1 FROM services WHERE category_id = categories.id);

-- ---------------------------------------------------------------------------
-- ADMIN CONSOLE PHASE-2 FIXTURES (additive, idempotent — fixed UUIDs, ON CONFLICT guards).
-- One escalated booking with its live CRITICAL alert, and two technicians with fresh map
-- positions, so a dev database shows the alert feed, the dashboard band and the live map
-- with real rows. Safe to re-run: nothing inserts twice, and an alert a dev already
-- acknowledged stays acknowledged.

INSERT INTO users (id, phone, name, role) VALUES
  ('a1000000-0000-4000-8000-000000000001', '+911100000001', 'Deepa Demo',      'CUSTOMER'),
  ('a1000000-0000-4000-8000-000000000002', '+911100000002', 'Ravi Fieldtech',  'TECHNICIAN'),
  ('a1000000-0000-4000-8000-000000000003', '+911100000003', 'Sana Fieldtech',  'TECHNICIAN')
ON CONFLICT DO NOTHING;

-- Technician rows with a position refreshed to now() on every seed run, so the live map's
-- freshness window always admits them.
INSERT INTO technicians (user_id, city, is_online, last_lat, last_lng, last_location_at) VALUES
  ('a1000000-0000-4000-8000-000000000002', 'Bengaluru', true, 12.9716, 77.5946, now()),
  ('a1000000-0000-4000-8000-000000000003', 'Bengaluru', true, 12.9352, 77.6245, now())
ON CONFLICT (user_id) DO UPDATE
  SET last_lat = EXCLUDED.last_lat,
      last_lng = EXCLUDED.last_lng,
      last_location_at = now(),
      is_online = true;

INSERT INTO addresses (id, user_id, line1, city, pincode, geog)
VALUES ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
        '14 Demo Lane', 'Bengaluru', '560001', ST_MakePoint(77.6033, 12.9762)::geography)
ON CONFLICT DO NOTHING;

INSERT INTO orders (id, customer_id, status, total_paise)
VALUES ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'PENDING', 59900)
ON CONFLICT DO NOTHING;

INSERT INTO bookings (id, order_id, customer_id, address_id, state, quoted_total_paise)
VALUES ('a4000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001',
        'a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001',
        'ESCALATED', 59900)
ON CONFLICT DO NOTHING;

INSERT INTO booking_items (id, booking_id, service_id, variant_id, quantity, line_total_paise)
SELECT 'a5000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001',
       sv.service_id, sv.id, 1, 59900
FROM service_variants sv
JOIN services s ON s.id = sv.service_id
WHERE s.slug = 'ac-repair' AND sv.name = 'Standard Service'
ON CONFLICT DO NOTHING;

-- The escalation trail the alert detail's history and trigger read (append-only table;
-- fixed ids keep the re-run a no-op).
INSERT INTO booking_events (id, booking_id, from_state, action, to_state) VALUES
  ('a6000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001', 'DRAFT',     'CONFIRM',  'CONFIRMED'),
  ('a6000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000001', 'CONFIRMED', 'SEARCH',   'SEARCHING'),
  ('a6000000-0000-4000-8000-000000000003', 'a4000000-0000-4000-8000-000000000001', 'SEARCHING', 'ESCALATE', 'ESCALATED')
ON CONFLICT DO NOTHING;

-- The live critical alert the engine would have produced for that escalation.
INSERT INTO alerts (id, kind, severity, subject_kind, subject_id, source_event_id, requires_acknowledgement)
VALUES ('a7000000-0000-4000-8000-000000000001', 'BOOKING_ESCALATED', 'CRITICAL',
        'BOOKING', 'a4000000-0000-4000-8000-000000000001',
        'a6000000-0000-4000-8000-000000000003', true)
ON CONFLICT DO NOTHING;

COMMIT;

-- =============================================================================
-- ADMIN RESCUE CONSOLE DEV DATA (phase 2 — booking actions). ADDITIVE + IDEMPOTENT:
-- fixed UUIDs, every insert guarded, safe to re-run. One ESCALATED booking (with its
-- CONFIRM → SEARCH → ESCALATE event trail) and one online, located technician, so the
-- console's assign / redispatch / cancel screens have a live subject to rescue.
BEGIN;

INSERT INTO users (id, phone, name, role)
VALUES
  ('aa000000-0000-4000-8000-000000000001', '+919000000101', 'Rescue Admin',    'ADMIN'),
  ('cc000000-0000-4000-8000-000000000001', '+919000000102', 'Meera Customer',  'CUSTOMER'),
  ('7e000000-0000-4000-8000-000000000001', '+919000000103', 'Arjun Technician','TECHNICIAN')
ON CONFLICT (id) DO NOTHING;

INSERT INTO technicians (user_id, city, is_online, last_lat, last_lng, last_location_at)
VALUES ('7e000000-0000-4000-8000-000000000001', 'Bengaluru', true, 12.9750, 77.5950, now())
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO addresses (id, user_id, line1, city, pincode, geog)
VALUES ('ad000000-0000-4000-8000-000000000001', 'cc000000-0000-4000-8000-000000000001',
        '14 Residency Rd', 'Bengaluru', '560025', ST_MakePoint(77.5993, 12.9718)::geography)
ON CONFLICT (id) DO NOTHING;

INSERT INTO orders (id, customer_id, total_paise)
VALUES ('0d000000-0000-4000-8000-000000000001', 'cc000000-0000-4000-8000-000000000001', 59900)
ON CONFLICT (id) DO NOTHING;

-- The escalated booking the console rescues. State written directly ONLY in this dev
-- seed; the application always moves state through the machine.
INSERT INTO bookings (id, order_id, customer_id, address_id, state, quoted_total_paise, duration_minutes, version)
SELECT 'b0000000-0000-4000-8000-000000000001', '0d000000-0000-4000-8000-000000000001',
       'cc000000-0000-4000-8000-000000000001', 'ad000000-0000-4000-8000-000000000001',
       'ESCALATED', 59900, 60, 3
WHERE NOT EXISTS (SELECT 1 FROM bookings WHERE id = 'b0000000-0000-4000-8000-000000000001');

INSERT INTO booking_items (id, booking_id, service_id, variant_id, quantity, line_total_paise)
SELECT 'b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
       v.service_id, v.id, 1, 59900
FROM service_variants v
JOIN services s ON s.id = v.service_id
WHERE s.slug = 'ac-repair' AND v.name = 'Standard Service'
  AND NOT EXISTS (SELECT 1 FROM booking_items WHERE booking_id = 'b0000000-0000-4000-8000-000000000001');

-- The event trail behind the escalation, so the timeline, undo windows and attention
-- queue read real history.
INSERT INTO booking_events (id, booking_id, from_state, action, to_state, actor_user_id, created_at)
SELECT * FROM (VALUES
  ('be000000-0000-4000-8000-000000000001'::uuid, 'b0000000-0000-4000-8000-000000000001'::uuid,
   'DRAFT', 'CONFIRM', 'CONFIRMED', 'cc000000-0000-4000-8000-000000000001'::uuid, now() - interval '45 minutes'),
  ('be000000-0000-4000-8000-000000000002'::uuid, 'b0000000-0000-4000-8000-000000000001'::uuid,
   'CONFIRMED', 'SEARCH', 'SEARCHING', NULL::uuid, now() - interval '44 minutes'),
  ('be000000-0000-4000-8000-000000000003'::uuid, 'b0000000-0000-4000-8000-000000000001'::uuid,
   'SEARCHING', 'ESCALATE', 'ESCALATED', NULL::uuid, now() - interval '30 minutes')
) AS seed(id, booking_id, from_state, action, to_state, actor_user_id, created_at)
WHERE NOT EXISTS (SELECT 1 FROM booking_events WHERE booking_id = 'b0000000-0000-4000-8000-000000000001');

COMMIT;

-- ===========================================================================
-- PROVIDER ADMIN SEED (admin console dev data) — added with migration 00018.
-- A small Hyderabad roster with availability + locations, and three provider
-- applications in the console's designed states (approvable / blocked /
-- awaiting documents). Idempotent: fixed UUIDs + ON CONFLICT DO NOTHING.
-- ===========================================================================
BEGIN;

INSERT INTO users (id, phone, name, role) VALUES
  ('a1000000-0000-4000-8000-000000000001', '+919000100001', 'Ravi Chandra',  'TECHNICIAN'),
  ('a1000000-0000-4000-8000-000000000002', '+919000100002', 'Sunil Goud',    'TECHNICIAN'),
  ('a1000000-0000-4000-8000-000000000003', '+919000100003', 'Imran Shaik',   'TECHNICIAN'),
  ('a1000000-0000-4000-8000-000000000004', '+919000100004', 'Lakshmi Devi',  'TECHNICIAN'),
  ('a1000000-0000-4000-8000-000000000005', '+919000100005', 'Venkat Rao',    'TECHNICIAN')
ON CONFLICT DO NOTHING;

-- Zones are technicians.city. Round-the-clock shifts so the dev roster is dispatchable
-- whenever you happen to be looking at it. Two online with fresh locations, one online
-- but stale (the roster shows it offline), two offline.
INSERT INTO technicians (user_id, city, is_online, shift_start_minute, shift_end_minute,
                         max_concurrent_jobs, last_lat, last_lng, last_location_at) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'Kompally',     true,  0, 1440, 2, 17.5453, 78.4855, now()),
  ('a1000000-0000-4000-8000-000000000002', 'Madhapur',     true,  0, 1440, 2, 17.4483, 78.3915, now()),
  ('a1000000-0000-4000-8000-000000000003', 'Gachibowli',   true,  0, 1440, 2, 17.4401, 78.3489, now() - interval '45 minutes'),
  ('a1000000-0000-4000-8000-000000000004', 'Kukatpally',   false, 0, 1440, 2, NULL, NULL, NULL),
  ('a1000000-0000-4000-8000-000000000005', 'Secunderabad', false, 0, 1440, 2, NULL, NULL, NULL)
ON CONFLICT (user_id) DO NOTHING;

-- The stale row must READ stale: age its update timestamp past the freshness window.
UPDATE technicians SET updated_at = now() - interval '45 minutes'
WHERE user_id = 'a1000000-0000-4000-8000-000000000003'
  AND last_location_at < now() - interval '30 minutes';

INSERT INTO skills (id, code, name) VALUES
  ('a2000000-0000-4000-8000-000000000001', 'AC_REPAIR',  'AC Repair'),
  ('a2000000-0000-4000-8000-000000000002', 'ELECTRICAL', 'Electrical'),
  ('a2000000-0000-4000-8000-000000000003', 'PLUMBING',   'Plumbing')
ON CONFLICT DO NOTHING;

INSERT INTO technician_skills (technician_id, skill_id) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002'),
  ('a1000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002'),
  ('a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003'),
  ('a1000000-0000-4000-8000-000000000004', 'a2000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000005', 'a2000000-0000-4000-8000-000000000003')
ON CONFLICT DO NOTHING;

-- Applications: one approvable, one blocked on police verification, one awaiting documents.
INSERT INTO provider_applications
  (id, applicant_name, phone, email, address, zone, status, documents_required,
   background_cleared_at, applied_at, documents_requested_at, documents_request_note) VALUES
  ('a3000000-0000-4000-8000-000000000001', 'Anand Joshi', '+919000200001', 'anand@example.in',
   '12 Kompally Main Rd', 'Kompally', 'pending', 3, now() - interval '1 day', now() - interval '30 hours', NULL, ''),
  ('a3000000-0000-4000-8000-000000000002', 'Bhavna Rao', '+919000200002', 'bhavna@example.in',
   '4 Ayyappa Society', 'Madhapur', 'pending', 3, NULL, now() - interval '3 days', NULL, ''),
  ('a3000000-0000-4000-8000-000000000003', 'Chetan Naik', '+919000200003', 'chetan@example.in',
   '77 KPHB Phase 2', 'Kukatpally', 'awaiting_docs', 4, NULL, now() - interval '6 days',
   now() - interval '2 days', 'Please re-upload a readable bank passbook photo.')
ON CONFLICT DO NOTHING;

INSERT INTO provider_application_categories (application_id, name, years_claimed) VALUES
  ('a3000000-0000-4000-8000-000000000001', 'AC Repair', 5),
  ('a3000000-0000-4000-8000-000000000001', 'Electrical', 2),
  ('a3000000-0000-4000-8000-000000000002', 'Plumbing', 3),
  ('a3000000-0000-4000-8000-000000000003', 'Electrical', 6)
ON CONFLICT DO NOTHING;

INSERT INTO provider_application_documents
  (application_id, document_type, validation, uploaded_at, expires_at, detail, ocr_read, ocr_expected) VALUES
  -- Anand: everything filed and valid — the Approve button is live.
  ('a3000000-0000-4000-8000-000000000001', 'AADHAAR',             'validated', now() - interval '30 hours', now() + interval '3 years', '', '', ''),
  ('a3000000-0000-4000-8000-000000000001', 'PAN',                 'validated', now() - interval '30 hours', NULL, '', 'ABCDE1234F', 'ABCDE1234F'),
  ('a3000000-0000-4000-8000-000000000001', 'POLICE_VERIFICATION', 'validated', now() - interval '28 hours', now() + interval '1 year', '', '', ''),
  -- Bhavna: police verification never filed — approval is blocked, server-side.
  ('a3000000-0000-4000-8000-000000000002', 'AADHAAR',             'validated', now() - interval '3 days', now() + interval '2 years', '', '', ''),
  ('a3000000-0000-4000-8000-000000000002', 'PAN',                 'failed',    now() - interval '3 days', NULL, '', 'BXYZQ0000Z', 'BXYZK0001Z'),
  ('a3000000-0000-4000-8000-000000000002', 'POLICE_VERIFICATION', 'missing',   NULL, NULL, '', '', ''),
  -- Chetan: passbook was requested and is still missing.
  ('a3000000-0000-4000-8000-000000000003', 'AADHAAR',             'validated', now() - interval '6 days', now() + interval '4 years', '', '', ''),
  ('a3000000-0000-4000-8000-000000000003', 'ELECTRICAL_CERTIFICATE', 'validated', now() - interval '6 days', now() + interval '2 years', 'Cert IE-2231', '', ''),
  ('a3000000-0000-4000-8000-000000000003', 'POLICE_VERIFICATION', 'validated', now() - interval '5 days', now() + interval '1 year', '', '', ''),
  ('a3000000-0000-4000-8000-000000000003', 'BANK_PASSBOOK',       'missing',   NULL, NULL, '', '', '')
ON CONFLICT DO NOTHING;

COMMIT;
