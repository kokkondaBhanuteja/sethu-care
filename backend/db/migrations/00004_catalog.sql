-- Catalog: the HSOS service tree. Adding a service is an INSERT, never a deploy.

-- +goose Up

CREATE TABLE categories (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    slug       TEXT NOT NULL UNIQUE,
    sort_order INT  NOT NULL DEFAULT 0,
    is_active  BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version    BIGINT      NOT NULL DEFAULT 0
);

-- ===========================================================================
-- SKILL IS A FIRST-CLASS ENTITY. This is a CORRECTION, and it matters.
--
-- The original design had `technicians.skills TEXT[]` and
-- `services.required_skills TEXT[]` — two free-form string arrays that must match each
-- other for ROADMAP §5.1's very FIRST eligibility check ("holds the skill the service
-- requires") to work, with ZERO referential integrity between them.
--
-- The failure is silent and total. Ops creates a service requiring 'AC_REPAIR'. The
-- technicians were onboarded with 'AC-REPAIR'. The eligibility query matches nothing.
-- ZERO eligible technicians — every AC booking escalates to the human queue, forever.
-- No exception, no failed test, no error in any log: just a dispatch engine quietly
-- returning an empty list. A TEXT[] will accept any string you put in it, so nothing in
-- the database can reject the typo.
--
-- With real foreign keys, that typo is IMPOSSIBLE at INSERT time. And adding a skill is
-- still just an INSERT, so the HSOS "no deploy" promise holds.
-- ===========================================================================
CREATE TABLE skills (
    id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The stable identifier. The regex enforces the convention at the database level, so
    -- 'AC-REPAIR', 'ac_repair' and 'AC Repair' are all rejected outright — the exact
    -- near-misses that caused the bug this table exists to prevent.
    code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z][A-Z0-9_]*$'),

    -- The display name. Renaming this can NEVER break matching, because matching is on the
    -- id. That is the second thing the array version got wrong.
    name      TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version    BIGINT      NOT NULL DEFAULT 0
);

CREATE TABLE services (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',

    -- ROADMAP §4.5: assignment mode is a property of the SERVICE, not of the system.
    -- Repairs are auto-dispatched; delivery/installation is assigned by a human, because
    -- delivering a refrigerator involves stock, a vehicle and a staircase.
    -- Changing it is an UPDATE, not a deploy.
    assignment_mode   TEXT NOT NULL DEFAULT 'AUTO' CHECK (assignment_mode IN ('AUTO', 'MANUAL')),
    estimated_minutes INT  NOT NULL DEFAULT 60 CHECK (estimated_minutes > 0),
    is_active         BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version    BIGINT      NOT NULL DEFAULT 0
);

CREATE INDEX services_category_idx ON services (category_id) WHERE is_active;

-- What a service NEEDS.
CREATE TABLE service_required_skills (
    service_id UUID NOT NULL REFERENCES services (id) ON DELETE CASCADE,
    skill_id   UUID NOT NULL REFERENCES skills (id)   ON DELETE RESTRICT,
    PRIMARY KEY (service_id, skill_id)
);

-- What a technician HAS. The dispatch eligibility query joins these two through `skills`,
-- and a skill that does not exist cannot appear in either.
CREATE TABLE technician_skills (
    technician_id UUID NOT NULL REFERENCES technicians (user_id) ON DELETE CASCADE,
    skill_id      UUID NOT NULL REFERENCES skills (id)           ON DELETE RESTRICT,
    PRIMARY KEY (technician_id, skill_id)
);

CREATE INDEX technician_skills_by_skill_idx ON technician_skills (skill_id);

CREATE TABLE service_variants (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services (id) ON DELETE CASCADE,
    name       TEXT NOT NULL,

    -- Money is ALWAYS paise, ALWAYS BIGINT, never NUMERIC and never a float.
    -- sqlc maps every *_paise column to our money.Money type, so the type safety survives
    -- the round trip through the database instead of collapsing to a bare int64.
    base_price_paise BIGINT NOT NULL CHECK (base_price_paise >= 0),
    is_active        BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version    BIGINT      NOT NULL DEFAULT 0,

    CONSTRAINT service_variants_name_unique_per_service UNIQUE (service_id, name)
);

-- Dynamic questions asked at booking time. Adding one is an INSERT, not a deploy.
CREATE TABLE question_defs (
    id          UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id  UUID NOT NULL REFERENCES services (id) ON DELETE CASCADE,
    prompt      TEXT NOT NULL,
    kind        TEXT NOT NULL CHECK (kind IN ('TEXT', 'SINGLE_CHOICE', 'PHOTO')),
    options     TEXT[] NOT NULL DEFAULT '{}',
    is_required BOOLEAN NOT NULL DEFAULT false,
    sort_order  INT     NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version    BIGINT      NOT NULL DEFAULT 0,

    -- A SINGLE_CHOICE question with no options is a dead end in the booking flow that
    -- nobody notices until a customer hits it. Refuse it at write time.
    CONSTRAINT question_defs_single_choice_needs_options
        CHECK (kind <> 'SINGLE_CHOICE' OR cardinality(options) > 0)
);

CREATE INDEX question_defs_service_idx ON question_defs (service_id, sort_order);

-- +goose Down
DROP TABLE IF EXISTS question_defs;
DROP TABLE IF EXISTS service_variants;
DROP TABLE IF EXISTS technician_skills;
DROP TABLE IF EXISTS service_required_skills;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS skills;
DROP TABLE IF EXISTS categories;
