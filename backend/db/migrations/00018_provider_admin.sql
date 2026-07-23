-- Provider administration: the admin console's supply-side writes.
--
-- Two aggregates, both owned by internal/providerops:
--
--  * provider_admin_states — one row per technician holding the ADMIN-imposed standing
--    (active / suspended / blocked). Kept separate from `technicians` (identity's aggregate)
--    because a suspension is an admin decision ABOUT a technician, not a fact of the
--    technician's own profile — and it carries its own optimistic-concurrency version, which
--    the console echoes on every provider mutation. Absence of a row means ACTIVE at
--    version 0. History lives in audit_logs (every standing change writes an entry in the
--    same transaction), so this table holds only the CURRENT standing.
--
--  * provider_applications (+ categories + documents) — the onboarding pipeline the console
--    reviews. Approval provisions a real TECHNICIAN identity; rejection is terminal.
--
-- Enum casing: standing values are UPPER_SNAKE per repo convention; the application/document
-- vocabularies are stored EXACTLY as the frozen admin API contract spells them (lowercase
-- statuses, UPPER document codes) so no mapping layer can drift from the wire. All of them
-- are pinned by internal/schema/drift_test.go against the Go constants in providerops.

-- +goose Up

CREATE TABLE provider_admin_states (
    technician_id UUID PRIMARY KEY REFERENCES technicians (user_id) ON DELETE CASCADE,

    standing TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (standing IN ('ACTIVE', 'SUSPENDED', 'BLOCKED')),

    -- Why the CURRENT standing was imposed. Lowercase: these are the frozen admin-contract
    -- codes, stored verbatim. Nullable — an ACTIVE (restored) row keeps no reason, and a
    -- force-offline records its reason in audit_logs only (it changes availability, not
    -- standing).
    reason_code TEXT
        CHECK (reason_code IN ('safety_complaint', 'repeated_cancellations', 'poor_quality',
                               'fraud_suspected', 'document_expired', 'unprofessional',
                               'no_show_pattern', 'policy_violation', 'other')),
    note TEXT NOT NULL DEFAULT '',

    -- A suspension always has an end; a block never does.
    suspended_until TIMESTAMPTZ,
    CONSTRAINT provider_admin_states_suspension_has_an_end
        CHECK (standing <> 'SUSPENDED' OR suspended_until IS NOT NULL),
    CONSTRAINT provider_admin_states_blocks_are_permanent
        CHECK (standing <> 'BLOCKED' OR suspended_until IS NULL),

    decided_by UUID REFERENCES users (id) ON DELETE RESTRICT,
    decided_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- The optimistic-concurrency token the console echoes back (starts at 1 on first write;
    -- a technician with no row is version 0).
    version    BIGINT      NOT NULL DEFAULT 1
);

-- The assignment engine's exclusion read: "does an active restriction stand against this
-- technician right now?" (ops.sql ListCandidateTechnicians).
CREATE INDEX provider_admin_states_restricted_idx ON provider_admin_states (technician_id)
    WHERE standing <> 'ACTIVE';

CREATE TABLE provider_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    applicant_name TEXT NOT NULL,
    phone          TEXT NOT NULL,
    email          TEXT NOT NULL DEFAULT '',
    address        TEXT NOT NULL DEFAULT '',
    -- The zone the applicant would serve; becomes technicians.city on approval.
    zone           TEXT NOT NULL,

    -- Stored verbatim from the frozen admin contract (lowercase on purpose).
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'awaiting_docs', 'approved', 'rejected')),

    -- How many documents this application must file before approval; the platform default
    -- is seeded by the intake flow. Present documents are counted from the documents table.
    documents_required INT NOT NULL DEFAULT 5 CHECK (documents_required >= 0),

    background_cleared_at TIMESTAMPTZ,
    applied_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- The decision, when one has been made. Terminal: no row ever leaves approved/rejected.
    decided_at           TIMESTAMPTZ,
    decided_by           UUID REFERENCES users (id) ON DELETE RESTRICT,
    decision_reason_code TEXT
        CHECK (decision_reason_code IN ('incomplete_documentation', 'failed_background_check',
                                        'insufficient_experience', 'outside_service_area',
                                        'duplicate_application', 'authenticity_concern',
                                        'capacity_full', 'other')),
    decision_note TEXT NOT NULL DEFAULT '',
    CONSTRAINT provider_applications_decided_iff_terminal
        CHECK ((status IN ('approved', 'rejected')) = (decided_at IS NOT NULL)),

    -- The TECHNICIAN identity an approval created.
    approved_technician_id UUID REFERENCES users (id) ON DELETE RESTRICT,

    -- The most recent request-documents action, echoed by the console.
    documents_requested_at   TIMESTAMPTZ,
    documents_request_note   TEXT NOT NULL DEFAULT '',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version    BIGINT      NOT NULL DEFAULT 0
);

-- The queue reads oldest-undecided-first (48h SLA).
CREATE INDEX provider_applications_undecided_idx ON provider_applications (applied_at)
    WHERE status IN ('pending', 'awaiting_docs');

-- What the applicant claims they can do (name + years), shown on the review screen.
CREATE TABLE provider_application_categories (
    application_id UUID NOT NULL REFERENCES provider_applications (id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    years_claimed  INT  NOT NULL DEFAULT 0 CHECK (years_claimed >= 0),
    PRIMARY KEY (application_id, name)
);

-- The application's document checklist. A row with validation 'missing' is a document the
-- platform expects but the applicant has not filed (request-documents inserts these).
CREATE TABLE provider_application_documents (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES provider_applications (id) ON DELETE CASCADE,

    -- The fixed platform vocabulary, as the frozen contract's CODES.
    document_type TEXT NOT NULL
        CHECK (document_type IN ('AADHAAR', 'AADHAAR_CARD', 'PAN', 'DRIVING_LICENCE',
                                 'SKILL_CERTIFICATE', 'ELECTRICAL_CERTIFICATE',
                                 'POLICE_VERIFICATION', 'BANK_PASSBOOK', 'BANK_DETAILS')),
    validation TEXT NOT NULL DEFAULT 'missing'
        CHECK (validation IN ('validated', 'failed', 'missing')),

    uploaded_at  TIMESTAMPTZ,
    expires_at   TIMESTAMPTZ,
    detail       TEXT   NOT NULL DEFAULT '',
    ocr_read     TEXT   NOT NULL DEFAULT '',
    ocr_expected TEXT   NOT NULL DEFAULT '',
    size_bytes   BIGINT NOT NULL DEFAULT 0,
    url          TEXT   NOT NULL DEFAULT '',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One row per document type per application; request-documents upserts against this.
    UNIQUE (application_id, document_type)
);

-- +goose Down
DROP TABLE IF EXISTS provider_application_documents;
DROP TABLE IF EXISTS provider_application_categories;
DROP TABLE IF EXISTS provider_applications;
DROP TABLE IF EXISTS provider_admin_states;
