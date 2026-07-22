-- name: InsertLedgerEntry :exec
-- One append-only row. The database CHECK enforces the attach rules (REVENUE -> order,
-- CASH_CUSTODY -> booking + technician + method=CASH), so a malformed entry is rejected here,
-- not discovered later.
INSERT INTO ledger_entries (kind, amount_paise, order_id, booking_id, customer_id, technician_id, method, memo)
VALUES (@kind, @amount_paise, @order_id, @booking_id, @customer_id, @technician_id, @method, @memo);

-- name: GetBookingCashCustody :one
-- The cash a technician is holding for a booking (the CASH_CUSTODY row), so a deposit can
-- match its amount and be attributed to the right technician.
SELECT amount_paise, technician_id, created_at
  FROM ledger_entries
 WHERE booking_id = $1 AND kind = 'CASH_CUSTODY'
 LIMIT 1;

-- name: DepositExistsForBooking :one
SELECT EXISTS (
  SELECT 1 FROM ledger_entries WHERE booking_id = $1 AND kind = 'CASH_DEPOSIT'
) AS exists;

-- name: ListCashReconciliation :many
-- The admin reconciliation view: every technician who still owes a deposit, oldest first.
SELECT
  position.technician_id, u.name,
  position.collected_paise, position.deposited_paise, position.outstanding_paise,
  position.oldest_collection_at::timestamptz AS oldest_collection_at
FROM technician_cash_position position
JOIN users u ON u.id = position.technician_id
WHERE position.outstanding_paise > 0
ORDER BY position.oldest_collection_at;

-- name: GetTechnicianCashPosition :one
-- One technician's own cash standing, for the provider app's cash-held summary. Returns no row
-- when they have never collected cash — the caller reads that as an all-zero position.
SELECT
  position.collected_paise, position.deposited_paise, position.outstanding_paise
FROM technician_cash_position position
WHERE position.technician_id = @technician_id;

-- name: CreditExistsForOrder :one
-- Idempotency guard for the failed-booking credit consumer.
SELECT EXISTS (
  SELECT 1 FROM ledger_entries WHERE order_id = $1 AND kind = 'CREDIT_ISSUED'
) AS exists;

-- name: CompletionLedgerExists :one
-- Idempotency guard for the booking.completed consumer: has this booking already been billed?
-- REVENUE attaches to the order; CASH_CUSTODY to the booking. In P1 an order has one booking,
-- so either presence means "already recorded".
SELECT EXISTS (
  SELECT 1 FROM ledger_entries
   WHERE (order_id = @order_id AND kind = 'REVENUE')
      OR (booking_id = @booking_id AND kind = 'CASH_CUSTODY')
) AS exists;

-- name: GetRevenueEntryForOrder :one
-- The REVENUE row for an order — the money-moved record behind the console's payment panel.
-- In P1 an order has exactly one booking, so one REVENUE row is the whole story.
SELECT amount_paise, method, created_at
FROM ledger_entries
WHERE order_id = $1 AND kind = 'REVENUE'
ORDER BY created_at
LIMIT 1;
