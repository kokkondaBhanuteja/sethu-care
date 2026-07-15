-- name: InsertWorkPhoto :exec
-- Record one uploaded work photo (the URL of a file already on the CDN). The bytes are on
-- Cloudinary; this row is the durable pointer and its provenance (who, which booking, when).
INSERT INTO work_photos (booking_id, uploaded_by, kind, url)
VALUES (@booking_id, @uploaded_by, @kind, @url);

-- name: ListWorkPhotosForBooking :many
-- Every photo for a booking, oldest first, BEFORE grouped ahead of AFTER.
SELECT id, booking_id, uploaded_by, kind, url, created_at
FROM work_photos
WHERE booking_id = $1
ORDER BY kind, created_at;
