-- The payment provider's hosted payment-link URL (Razorpay) for a collection. Stored so the
-- customer opens the SAME link on every fetch, rather than the backend creating a new link each
-- time. Empty until a link is created (or when no provider is configured and we fall back to a
-- upi:// intent).

-- +goose Up
ALTER TABLE payments ADD COLUMN payment_link_url TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE payments DROP COLUMN payment_link_url;
