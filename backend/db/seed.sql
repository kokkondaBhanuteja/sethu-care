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
