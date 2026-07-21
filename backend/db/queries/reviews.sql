-- name: InsertReview :one
-- One review per booking (the UNIQUE index on booking_id enforces it; a second attempt is a
-- 23505 the service turns into "already reviewed").
INSERT INTO reviews (booking_id, customer_id, technician_id, rating, comment)
VALUES (@booking_id, @customer_id, @technician_id, @rating, @comment)
RETURNING id;
