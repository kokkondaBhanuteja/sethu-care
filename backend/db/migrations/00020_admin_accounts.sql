-- Admin console accounts: who may sign in to the ops console, the devices they have
-- trusted, their per-account settings, and their diagnostics uploads.
--
-- The console's sign-in is email + password + a second factor. The second factor RIDES the
-- existing OTP engine (identity's otp_challenges — bcrypt-hashed codes, attempt caps); the
-- admin_challenges table here is only the ENVELOPE that binds a challenge id to an account
-- and a device. It stores no code and generates none.

-- +goose Up

CREATE TABLE admin_accounts (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,

    -- Redundant on purpose, exactly like technicians.role: pinned to 'ADMIN' and joined into
    -- the composite FK below, it makes "an admin account whose user is a CUSTOMER" IMPOSSIBLE
    -- rather than merely discouraged. It also blocks demoting the user while this row exists.
    role TEXT NOT NULL DEFAULT 'ADMIN' CHECK (role = 'ADMIN'),

    -- Stored lowercased; the service lowercases before lookup, and the CHECK keeps a seed
    -- script or a psql session from sneaking in a mixed-case duplicate.
    email         TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
    password_hash TEXT NOT NULL, -- bcrypt, never plaintext
    display_name  TEXT NOT NULL,

    -- ACCOUNT_DISABLED is terminal in-app; only the web dashboard flips it back.
    is_disabled BOOLEAN NOT NULL DEFAULT false,

    -- The lockout counters behind the contract's 423: five failed passwords lock the
    -- account for fifteen minutes. Cleared on a successful password verification.
    failed_login_attempts INT NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
    locked_until          TIMESTAMPTZ,

    password_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version    BIGINT      NOT NULL DEFAULT 0,

    CONSTRAINT admin_accounts_user_must_be_admin
        FOREIGN KEY (user_id, role) REFERENCES users (id, role) ON DELETE RESTRICT
);

-- A device the account has signed in from. trusted_until IS NULL means the device signed in
-- but declined trust (it still counts as a session, not as a trust slot). Revoking sets
-- revoked_at and clears the trust; the same device may later re-earn trust through a fresh
-- second factor, which clears revoked_at again.
CREATE TABLE admin_devices (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_account_id UUID NOT NULL REFERENCES admin_accounts (id) ON DELETE CASCADE,

    -- Client-generated identity (spec §5.6: generated once, never derived from IMEI).
    device_id TEXT NOT NULL,
    name      TEXT NOT NULL,

    device_type TEXT NOT NULL CHECK (device_type IN ('PHONE', 'TABLET', 'DESKTOP')),

    -- City-level only, per the contract. There is no geo-IP lookup yet, so this stays ''
    -- until one exists — an honest blank, never a fabricated city.
    location TEXT NOT NULL DEFAULT '',

    trusted_until TIMESTAMPTZ,
    signed_in     BOOLEAN NOT NULL DEFAULT false,
    last_used_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at    TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT admin_devices_one_row_per_device UNIQUE (admin_account_id, device_id)
);

CREATE INDEX admin_devices_active_idx ON admin_devices (admin_account_id, last_used_at DESC)
    WHERE revoked_at IS NULL;

-- The second-factor envelope. The CODE lives in otp_challenges (identity's engine) — this
-- row only binds the challengeId the console carries to the account and device that asked,
-- and counts the console's own attempt budget (3 per code, stricter than the engine's 5).
CREATE TABLE admin_challenges (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_account_id UUID NOT NULL REFERENCES admin_accounts (id) ON DELETE CASCADE,

    device_id   TEXT NOT NULL,
    device_name TEXT NOT NULL,

    attempts     INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts INT NOT NULL DEFAULT 3 CHECK (max_attempts > 0),

    expires_at  TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Resend rate limiting (3 / 10 min) counts rows here per account.
CREATE INDEX admin_challenges_recent_idx ON admin_challenges (admin_account_id, created_at DESC);

-- Per-account console settings: profile preferences, notification channels, security flags.
-- One row per account, created lazily on first write; a missing row reads as the defaults
-- declared here.
CREATE TABLE admin_settings (
    admin_account_id UUID PRIMARY KEY REFERENCES admin_accounts (id) ON DELETE CASCADE,

    -- Profile preferences.
    appearance            TEXT    NOT NULL DEFAULT 'SYSTEM' CHECK (appearance IN ('LIGHT', 'DARK', 'SYSTEM')),
    haptics               BOOLEAN NOT NULL DEFAULT true,
    default_landing_route TEXT    NOT NULL DEFAULT '/live',

    -- The CONFIGURABLE notification tier only. The four critical channels are not
    -- preferences and deliberately have no columns here — they cannot be silenced.
    channel_sla_at_risk          BOOLEAN NOT NULL DEFAULT true,
    channel_provider_no_show     BOOLEAN NOT NULL DEFAULT true,
    channel_zone_supply_critical BOOLEAN NOT NULL DEFAULT true,
    channel_payment_failure      BOOLEAN NOT NULL DEFAULT true,
    channel_new_applications     BOOLEAN NOT NULL DEFAULT true,
    channel_auto_suspensions     BOOLEAN NOT NULL DEFAULT true,
    channel_document_expiring    BOOLEAN NOT NULL DEFAULT true,
    channel_daily_summary        BOOLEAN NOT NULL DEFAULT true,

    critical_sound TEXT NOT NULL DEFAULT 'default',

    -- Wall-clock HH:mm in IST — not instants, so TEXT with a format CHECK, not TIMESTAMPTZ.
    digest_time      TEXT NOT NULL DEFAULT '08:00' CHECK (digest_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    quiet_hours_from TEXT NOT NULL DEFAULT '22:00' CHECK (quiet_hours_from ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    quiet_hours_to   TEXT NOT NULL DEFAULT '07:00' CHECK (quiet_hours_to ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),

    quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
    vibrate             BOOLEAN NOT NULL DEFAULT true,
    biometric_unlock    BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version    BIGINT      NOT NULL DEFAULT 0
);

-- Diagnostics uploads for support. The unique key IS the idempotency guard: replaying the
-- same Idempotency-Key returns the first receipt instead of storing the payload twice.
CREATE TABLE admin_diagnostics (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_account_id UUID NOT NULL REFERENCES admin_accounts (id) ON DELETE CASCADE,
    idempotency_key  TEXT NOT NULL,

    app_version  TEXT NOT NULL,
    device_model TEXT NOT NULL,
    os_version   TEXT NOT NULL,
    ota_bundle   TEXT NOT NULL DEFAULT '',

    logs           JSONB NOT NULL,
    network_events JSONB NOT NULL,

    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT admin_diagnostics_idempotent UNIQUE (admin_account_id, idempotency_key)
);

-- +goose Down
DROP TABLE IF EXISTS admin_diagnostics;
DROP TABLE IF EXISTS admin_settings;
DROP TABLE IF EXISTS admin_challenges;
DROP TABLE IF EXISTS admin_devices;
DROP TABLE IF EXISTS admin_accounts;
