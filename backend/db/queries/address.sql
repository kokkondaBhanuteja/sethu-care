-- name: CreateAddress :one
-- The point comes in as lat/lng (the customer app has device GPS); we build the geography
-- here. RETURNING only scalar columns keeps sqlc away from the geography type.
INSERT INTO addresses (user_id, label, line1, line2, city, pincode, geog, is_default)
VALUES (
  @user_id, @label, @line1, @line2, @city, @pincode,
  ST_SetSRID(ST_MakePoint(@lng::float8, @lat::float8), 4326)::geography,
  @is_default
)
RETURNING id, label, line1, line2, city, pincode, is_default;

-- name: ListAddressesByUser :many
-- ST_Y/ST_X pull latitude/longitude back out as plain floats, so sqlc never sees the
-- geography type in the result.
SELECT
  id, label, line1, line2, city, pincode, is_default,
  ST_Y(geog::geometry)::float8 AS lat,
  ST_X(geog::geometry)::float8 AS lng
FROM addresses
WHERE user_id = $1
ORDER BY is_default DESC, created_at DESC;

-- name: CountAddressesByUser :one
SELECT count(*) FROM addresses WHERE user_id = $1;

-- name: ClearDefaultAddresses :exec
-- Unset the current default before setting a new one, so the partial unique index
-- addresses_one_default_per_user_idx is never violated mid-transaction.
UPDATE addresses SET is_default = false, updated_at = now()
 WHERE user_id = $1 AND is_default;
