-- name: UpsertPendingPayment :one
-- Create the UPI collection for a booking, or return the existing one. The ON CONFLICT no-op
-- update (booking_id is UNIQUE) makes this idempotent: a redelivered booking.completed event
-- does not create a second collection, and RETURNING still yields the row either way.
INSERT INTO payments (booking_id, order_id, amount_paise, reference)
VALUES (@booking_id, @order_id, @amount_paise, @reference)
ON CONFLICT (booking_id) DO UPDATE SET amount_paise = payments.amount_paise
RETURNING id, booking_id, order_id, amount_paise, reference, status, provider_ref, created_at, captured_at;

-- name: GetPaymentByBooking :one
-- The collection for a booking, joined to the booking's parties so the caller can authorize a
-- read (the owning customer or the assigned technician may see the QR).
SELECT
  p.id, p.booking_id, p.order_id, p.amount_paise, p.reference, p.status,
  p.provider_ref, p.payment_link_url, p.created_at, p.captured_at,
  b.customer_id, b.technician_id
FROM payments p
JOIN bookings b ON b.id = p.booking_id
WHERE p.booking_id = $1;

-- name: SetPaymentLink :exec
-- Persist the provider's hosted payment-link URL for a collection (created lazily on first fetch).
UPDATE payments SET payment_link_url = @payment_link_url WHERE reference = @reference;

-- name: GetPaymentByReference :one
SELECT id, booking_id, order_id, amount_paise, reference, status, provider_ref, created_at, captured_at
FROM payments
WHERE reference = $1;

-- name: MarkPaymentCaptured :exec
-- Move a collection PENDING -> CAPTURED. The WHERE status = 'PENDING' makes a double capture a
-- no-op at the row level; the caller pairs this with the REVENUE insert in one transaction.
UPDATE payments
   SET status = 'CAPTURED', provider_ref = @provider_ref, captured_at = now()
 WHERE reference = @reference AND status = 'PENDING';

-- name: ListPendingPayments :many
-- Every UPI collection still awaiting capture, oldest first — the ops payments queue. In production
-- the PSP webhook captures these; the console lets an admin confirm one by hand in P1.
SELECT reference, booking_id, amount_paise, status, created_at
FROM payments
WHERE status = 'PENDING'
ORDER BY created_at;
