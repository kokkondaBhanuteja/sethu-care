-- Addresses (PostGIS) and the appliances we sell and then service under warranty.

-- +goose Up

CREATE TABLE addresses (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,

    label   TEXT NOT NULL DEFAULT '',
    line1   TEXT NOT NULL,
    line2   TEXT NOT NULL DEFAULT '',
    city    TEXT NOT NULL,
    pincode TEXT NOT NULL CHECK (pincode ~ '^[1-9][0-9]{5}$'),

    -- GEOGRAPHY, not GEOMETRY. Geography does distance on a sphere and returns METRES;
    -- geometry would return degrees, and "within 5000 degrees" is not a dispatch radius.
    -- This is the column ST_DWithin runs against in P2.
    geog GEOGRAPHY(POINT, 4326) NOT NULL,

    is_default BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version    BIGINT      NOT NULL DEFAULT 0
);

-- The spatial index. Without it, ST_DWithin is a full table scan and dispatch dies as
-- soon as the technician table stops being tiny.
CREATE INDEX addresses_geog_idx ON addresses USING GIST (geog);

-- A partial unique index: at most ONE default address per user. Enforcing this in
-- application code means two concurrent requests can both set a default.
CREATE UNIQUE INDEX addresses_one_default_per_user_idx ON addresses (user_id) WHERE is_default;

CREATE TABLE product_models (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
    brand       TEXT NOT NULL,
    model       TEXT NOT NULL,

    warranty_months INT NOT NULL DEFAULT 12 CHECK (warranty_months >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version    BIGINT      NOT NULL DEFAULT 0,

    CONSTRAINT product_models_brand_model_unique UNIQUE (brand, model)
);

-- A physical appliance with a serial number, owned by a customer.
--
-- A booking may reference a product_unit — that is how Pricing knows the job is under
-- warranty and therefore FREE (the quote resolves to zero and there is no payment step
-- at all, ROADMAP §6).
CREATE TABLE product_units (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_model_id UUID NOT NULL REFERENCES product_models (id) ON DELETE RESTRICT,
    serial_number    TEXT NOT NULL UNIQUE,

    owner_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    sold_at       TIMESTAMPTZ,

    -- Denormalised from sold_at + warranty_months at the point of sale, deliberately.
    -- Recomputing it later would silently change a customer's warranty when someone edits
    -- the product model — the entitlement is a fact about the SALE, not about the model.
    warranty_expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version    BIGINT      NOT NULL DEFAULT 0,

    CONSTRAINT product_units_sold_units_have_an_owner
        CHECK ((sold_at IS NULL AND owner_user_id IS NULL) OR (sold_at IS NOT NULL AND owner_user_id IS NOT NULL))
);

CREATE INDEX product_units_owner_idx ON product_units (owner_user_id) WHERE owner_user_id IS NOT NULL;

-- +goose Down
DROP TABLE IF EXISTS product_units;
DROP TABLE IF EXISTS product_models;
DROP TABLE IF EXISTS addresses;
