-- name: CreateCategory :one
INSERT INTO categories (name, slug, sort_order)
VALUES (@name, @slug, @sort_order)
RETURNING id, name, slug, sort_order, is_active;

-- name: ListActiveCategories :many
SELECT id, name, slug, sort_order
  FROM categories
 WHERE is_active
 ORDER BY sort_order, name;

-- name: CreateService :one
INSERT INTO services (category_id, name, slug, description, assignment_mode, estimated_minutes)
VALUES (@category_id, @name, @slug, @description, @assignment_mode, @estimated_minutes)
RETURNING id, category_id, name, slug, description, assignment_mode, estimated_minutes, is_active;

-- name: GetService :one
SELECT id, category_id, name, slug, description, assignment_mode, estimated_minutes, is_active
  FROM services
 WHERE id = $1;

-- name: ListActiveServices :many
SELECT id, category_id, name, slug, description, assignment_mode, estimated_minutes
  FROM services
 WHERE is_active
 ORDER BY name;

-- name: CreateVariant :one
INSERT INTO service_variants (service_id, name, base_price_paise)
VALUES (@service_id, @name, @base_price_paise)
RETURNING id, service_id, name, base_price_paise, is_active;

-- name: ListActiveVariants :many
-- Every active variant of an active service, so the browse endpoint can group them by
-- service in Go with a single query rather than one per service.
SELECT v.id, v.service_id, v.name, v.base_price_paise
  FROM service_variants v
  JOIN services s ON s.id = v.service_id
 WHERE v.is_active AND s.is_active
 ORDER BY v.base_price_paise;

-- name: ListVariantsByService :many
SELECT id, service_id, name, base_price_paise
  FROM service_variants
 WHERE service_id = $1 AND is_active
 ORDER BY base_price_paise;

-- name: ListQuestionsByService :many
SELECT id, prompt, kind, options, is_required, sort_order
  FROM question_defs
 WHERE service_id = $1
 ORDER BY sort_order;
