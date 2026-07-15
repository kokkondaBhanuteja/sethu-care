-- name: GetBookingState :one
-- The read half of a transition. state is TEXT (no CHECK — the state machine is its
-- sole authority, ROADMAP §7a); Go's ParseState guards it on the way in.
SELECT state, version
  FROM bookings
 WHERE id = $1;

-- name: ApplyBookingTransition :execrows
-- THE COMPARE-AND-SWAP. This is the whole concurrency guarantee in one statement.
-- version in the WHERE clause is what makes two admins racing the same ASSIGN safe:
-- the second one matches zero rows, and :execrows returns 0, which the service turns
-- into a conflict (409). Never a lost update, never two technicians at one address.
UPDATE bookings
   SET state         = @to_state,
       technician_id = COALESCE(sqlc.narg('technician_id'), technician_id),
       version       = version + 1,
       updated_at    = now()
 WHERE id = @id AND version = @expected_version;

-- name: InsertBookingEvent :exec
-- APPEND-ONLY. Written in the SAME transaction as the transition, so the log can never
-- disagree with the booking's current state.
INSERT INTO booking_events (booking_id, from_state, action, to_state, actor_user_id, meta)
VALUES (@booking_id, @from_state, @action, @to_state, sqlc.narg('actor_user_id'), @meta);

-- name: CreateOrder :one
INSERT INTO orders (customer_id, total_paise)
VALUES (@customer_id, @total_paise)
RETURNING id;

-- name: CreateBooking :one
INSERT INTO bookings (order_id, customer_id, address_id, quoted_total_paise)
VALUES (@order_id, @customer_id, @address_id, @quoted_total_paise)
RETURNING id, state, version;

-- name: CreateBookingItem :exec
INSERT INTO booking_items (booking_id, service_id, variant_id, quantity, line_total_paise)
VALUES (@booking_id, @service_id, @variant_id, @quantity, @line_total_paise);

-- name: GetServiceVariant :one
-- Used at creation time: the price comes from the variant (never from the client), and
-- service_id is derived from it so the booking_item can never reference a variant that
-- belongs to a different service.
SELECT id, service_id, base_price_paise, is_active
  FROM service_variants
 WHERE id = $1;

-- name: GetBooking :one
SELECT id, order_id, customer_id, address_id, technician_id, state, quoted_total_paise, version
  FROM bookings
 WHERE id = $1;

-- name: ListCustomerBookings :many
-- A customer's own bookings, newest first — their history across every state.
SELECT
  b.id, b.state, b.scheduled_for, b.quoted_total_paise, b.created_at,
  s.name AS service_name,
  a.city
FROM bookings b
JOIN booking_items bi ON bi.booking_id = b.id
JOIN services s       ON s.id = bi.service_id
JOIN addresses a      ON a.id = b.address_id
WHERE b.customer_id = $1
ORDER BY b.created_at DESC;

-- name: ListTechnicianJobs :many
-- A technician's active jobs, with the customer contact and address they need on site.
-- Active = anything from ASSIGNED through AWAITING_COMPLETION; finished/cancelled jobs drop
-- off the list. Soonest scheduled first.
SELECT
  b.id, b.state, b.scheduled_for, b.quoted_total_paise,
  u.name  AS customer_name,
  u.phone AS customer_phone,
  s.name  AS service_name,
  a.line1, a.city, a.pincode,
  ST_Y(a.geog::geometry)::float8 AS lat,
  ST_X(a.geog::geometry)::float8 AS lng
FROM bookings b
JOIN users u          ON u.id = b.customer_id
JOIN booking_items bi ON bi.booking_id = b.id
JOIN services s       ON s.id = bi.service_id
JOIN addresses a      ON a.id = b.address_id
WHERE b.technician_id = $1
  AND b.state IN ('ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'AWAITING_COMPLETION')
ORDER BY b.scheduled_for NULLS LAST, b.created_at;
