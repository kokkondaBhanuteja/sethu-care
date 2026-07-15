-- name: InsertLedgerEntry :exec
-- One append-only row. The database CHECK enforces the attach rules (REVENUE -> order,
-- CASH_CUSTODY -> booking + technician + method=CASH), so a malformed entry is rejected here,
-- not discovered later.
INSERT INTO ledger_entries (kind, amount_paise, order_id, booking_id, customer_id, technician_id, method, memo)
VALUES (@kind, @amount_paise, @order_id, @booking_id, @customer_id, @technician_id, @method, @memo);

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
