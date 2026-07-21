-- Account deletion (App Store Guideline 5.1.1(v)). We cannot hard-delete a user: the append-only
-- ledger and booking_events reference them (ON DELETE RESTRICT) and are retained for audit. So
-- deletion ANONYMISES in place — the PII is scrubbed and the account is marked deleted.

-- +goose Up
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;

-- +goose Down
ALTER TABLE users DROP COLUMN deleted_at;
