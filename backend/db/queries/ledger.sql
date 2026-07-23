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

-- ---------------------------------------------------------------------------
-- Admin refunds (internal/ledger, driven by the rescue console).

-- name: InsertAdminCredit :one
-- An admin-decided refund/goodwill credit. CREDIT_ISSUED attaches to the ORDER (the CHECK
-- requires it). The id is minted by the CALLER so the refund receipt — stored in the same
-- transaction as its idempotent-replay record — can name the credit before it exists.
INSERT INTO ledger_entries (id, kind, amount_paise, order_id, customer_id, memo)
VALUES (@id, 'CREDIT_ISSUED', @amount_paise, @order_id, @customer_id, @memo)
RETURNING created_at;

-- name: InsertCreditReversal :one
-- The offsetting row an undo writes: a CREDIT_REDEEMED pointing at the credit it takes
-- back. The ledger is append-only — this is how a refund is "reversed".
INSERT INTO ledger_entries (kind, amount_paise, order_id, customer_id, memo, reverses_entry_id)
VALUES ('CREDIT_REDEEMED', @amount_paise, @order_id, @customer_id, @memo, @reverses_entry_id)
RETURNING id;

-- name: AdminCreditTotalsForOrder :one
-- What has already been credited (and taken back) against an order — the refund screen's
-- alreadyRefunded figure, over the whole credit history.
SELECT
  COALESCE(SUM(amount_paise) FILTER (WHERE kind = 'CREDIT_ISSUED'), 0)::bigint   AS issued_paise,
  COALESCE(SUM(amount_paise) FILTER (WHERE kind = 'CREDIT_REDEEMED'), 0)::bigint AS redeemed_paise
FROM ledger_entries
WHERE order_id = $1;

-- name: AdminLatestUnreversedCreditForOrder :one
-- The credit an undo-cancel must offset: the newest CREDIT_ISSUED on the order that no
-- reversal row points at yet.
SELECT credit.id, credit.amount_paise, credit.customer_id
FROM ledger_entries credit
WHERE credit.order_id = $1
  AND credit.kind = 'CREDIT_ISSUED'
  AND NOT EXISTS (
    SELECT 1 FROM ledger_entries reversal WHERE reversal.reverses_entry_id = credit.id
  )
ORDER BY credit.created_at DESC, credit.id DESC
LIMIT 1;
