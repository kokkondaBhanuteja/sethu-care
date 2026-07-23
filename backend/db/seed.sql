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

COMMIT;

-- ── Admin console dev sign-in ────────────────────────────────────────────────
-- The Demo Admin the console's designed dev login uses: ops@setucare.in / password123
-- (bcrypt below), linked to the +919000000008 ADMIN user. Pair with
-- SETHU_DEMO_PHONE=+919000000008 and SETHU_DEMO_OTP=123456 in the environment so the
-- second factor accepts the static demo code in dev (identity.WithDemoAccount).
-- Idempotent, like everything above.
BEGIN;

INSERT INTO users (phone, name, role)
VALUES ('+919000000008', 'Demo Admin', 'ADMIN')
ON CONFLICT (phone) DO UPDATE
  SET name = 'Demo Admin',
      role = 'ADMIN';

INSERT INTO admin_accounts (user_id, email, password_hash, display_name)
SELECT id, 'ops@setucare.in', '$2a$10$pebuZ9l1HMt3R2veiCRx4OSsbST2J4WIHF84YjJsdxhwN7faGXgXu', 'Demo Admin'
  FROM users
 WHERE phone = '+919000000008'
ON CONFLICT (email) DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      display_name = EXCLUDED.display_name,
      is_disabled = false,
      failed_login_attempts = 0,
      locked_until = NULL;

COMMIT;
