-- Dual OTP verification (Product.md), plus the photos that prove work was done.

-- +goose Up

CREATE TABLE otp_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- ===================================================================
    -- `purpose` IS A SECURITY FIX, not bookkeeping.
    --
    -- The original schema had otp_challenges with only (phone, code_hash, expires_at) —
    -- NO column distinguishing a Start OTP from a Completion OTP. Dual-OTP is a headline
    -- feature of this product: the Start OTP proves the technician actually reached the
    -- customer, and the Completion OTP proves the work was genuinely finished BEFORE
    -- payment.
    --
    -- Without this column those two are the same object. A technician could take the OTP
    -- the customer read out on arrival and immediately replay it to mark the job complete
    -- — collecting payment for work never done, with the system's own verification
    -- vouching for it. The feature would have been decorative.
    -- ===================================================================
    purpose TEXT NOT NULL CHECK (purpose IN ('LOGIN', 'START', 'COMPLETION')),

    booking_id UUID REFERENCES bookings (id) ON DELETE CASCADE,
    phone      TEXT NOT NULL,

    -- NEVER the plaintext code. Hashed, so a database dump is not a list of live OTPs.
    code_hash TEXT NOT NULL,

    attempts     INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts INT NOT NULL DEFAULT 5 CHECK (max_attempts > 0),

    consumed_at TIMESTAMPTZ,
    expires_at  TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version    BIGINT      NOT NULL DEFAULT 0,

    -- A job OTP without a job is meaningless; a login OTP bound to a booking is a bug.
    -- This is what stops a START challenge being quietly reused as a COMPLETION one.
    CONSTRAINT otp_challenges_purpose_matches_booking CHECK (
        (purpose = 'LOGIN' AND booking_id IS NULL)
        OR (purpose IN ('START', 'COMPLETION') AND booking_id IS NOT NULL)
    ),

    CONSTRAINT otp_challenges_attempts_within_cap CHECK (attempts <= max_attempts)
);

-- The verification hot path: "the live challenge for this phone and this purpose".
CREATE INDEX otp_challenges_live_idx
    ON otp_challenges (phone, purpose, expires_at DESC)
    WHERE consumed_at IS NULL;

CREATE INDEX otp_challenges_booking_idx
    ON otp_challenges (booking_id, purpose)
    WHERE booking_id IS NOT NULL;

-- Evidence. Photographs of the appliance before and after — the thing that settles a
-- dispute when a customer says the work was never done.
CREATE TABLE work_photos (
    id          UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id  UUID NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES users (id)    ON DELETE RESTRICT,

    kind TEXT NOT NULL CHECK (kind IN ('BEFORE', 'AFTER')),
    url  TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX work_photos_booking_idx ON work_photos (booking_id, kind);

-- +goose Down
DROP TABLE IF EXISTS work_photos;
DROP TABLE IF EXISTS otp_challenges;
