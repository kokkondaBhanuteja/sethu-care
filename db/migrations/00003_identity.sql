-- Identity: who can log in, and which of them are our salaried technicians.

-- +goose Up

CREATE TABLE users (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone      TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL,
    role       TEXT NOT NULL CHECK (role IN ('CUSTOMER', 'TECHNICIAN', 'ADMIN')),
    is_active  BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version    BIGINT      NOT NULL DEFAULT 0,

    -- Lets `technicians` prove, via a foreign key, that its user really IS a TECHNICIAN.
    -- Without this a row in `technicians` could point at a CUSTOMER and nothing would object.
    CONSTRAINT users_id_role_key UNIQUE (id, role)
);

CREATE INDEX users_role_idx ON users (role) WHERE is_active;

-- The employee record. Technicians are SALARIED (ROADMAP §1): no commission, no payout,
-- no settlement. Money never flows company → technician per job.
CREATE TABLE technicians (
    user_id UUID PRIMARY KEY,

    -- Redundant on purpose. Pinned to 'TECHNICIAN' and joined into the composite FK below,
    -- it makes "a technicians row whose user is a CUSTOMER" IMPOSSIBLE rather than merely
    -- discouraged. It also blocks demoting a user out of TECHNICIAN while this row exists.
    role TEXT NOT NULL DEFAULT 'TECHNICIAN' CHECK (role = 'TECHNICIAN'),

    city TEXT NOT NULL,

    -- THE CAPACITY MODEL — ROADMAP §5.1. Distance alone is not availability.
    shift_start_minute    INT     NOT NULL DEFAULT 540  CHECK (shift_start_minute BETWEEN 0 AND 1440), -- 09:00
    shift_end_minute      INT     NOT NULL DEFAULT 1080 CHECK (shift_end_minute   BETWEEN 0 AND 1440), -- 18:00
    on_leave              BOOLEAN NOT NULL DEFAULT false,
    is_online             BOOLEAN NOT NULL DEFAULT false,
    service_radius_metres INT     NOT NULL DEFAULT 10000 CHECK (service_radius_metres > 0),
    max_concurrent_jobs   INT     NOT NULL DEFAULT 1     CHECK (max_concurrent_jobs >= 1),

    -- Populated by P2's offer engine. Declared now so the seam exists (ROADMAP §5.4):
    -- a salaried technician earns the same whether they take the 8pm job across town or
    -- ignore it, so ignoring must stop being free and anonymous. It is counted, and it is
    -- visible to their manager.
    acceptance_rate NUMERIC(5,4) NOT NULL DEFAULT 1.0000 CHECK (acceptance_rate BETWEEN 0 AND 1),
    rating          NUMERIC(3,2) NOT NULL DEFAULT 5.00   CHECK (rating BETWEEN 0 AND 5),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version    BIGINT      NOT NULL DEFAULT 0,

    CONSTRAINT technicians_shift_ends_after_it_starts CHECK (shift_end_minute > shift_start_minute),
    CONSTRAINT technicians_user_must_be_a_technician
        FOREIGN KEY (user_id, role) REFERENCES users (id, role) ON DELETE RESTRICT
);

CREATE INDEX technicians_dispatchable_idx ON technicians (city)
    WHERE is_online AND NOT on_leave;

-- +goose Down
DROP TABLE IF EXISTS technicians;
DROP TABLE IF EXISTS users;
