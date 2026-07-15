-- Dev seed data: a small catalog so the customer app has something to browse.
-- Re-runnable: clears and reinserts the demo catalog. NOT for production.
BEGIN;

DELETE FROM service_variants;
DELETE FROM services;
DELETE FROM categories;

WITH cat AS (
  INSERT INTO categories (name, slug, sort_order)
  VALUES ('Appliance Repair', 'appliance-repair', 1)
  RETURNING id
),
ac AS (
  INSERT INTO services (category_id, name, slug, description, assignment_mode, estimated_minutes)
  SELECT id, 'AC Repair & Service', 'ac-repair', 'Cooling issues, gas refill, and deep clean.', 'MANUAL', 60 FROM cat
  RETURNING id
),
plumb AS (
  INSERT INTO services (category_id, name, slug, description, assignment_mode, estimated_minutes)
  SELECT id, 'Plumbing', 'plumbing', 'Leaks, blockages, taps, and fittings.', 'MANUAL', 45 FROM cat
  RETURNING id
),
electric AS (
  INSERT INTO services (category_id, name, slug, description, assignment_mode, estimated_minutes)
  SELECT id, 'Electrical', 'electrical', 'Wiring, switches, fans, and fixtures.', 'MANUAL', 45 FROM cat
  RETURNING id
)
INSERT INTO service_variants (service_id, name, base_price_paise)
SELECT id, 'Standard Service', 59900 FROM ac
UNION ALL SELECT id, 'Deep Clean', 99900 FROM ac
UNION ALL SELECT id, 'Standard Visit', 49900 FROM plumb
UNION ALL SELECT id, 'Standard Visit', 49900 FROM electric;

COMMIT;
