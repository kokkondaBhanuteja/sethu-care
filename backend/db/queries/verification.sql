-- name: InsertJobOtpChallenge :one
-- A START or COMPLETION OTP, bound to a booking (the CHECK requires booking_id for these
-- purposes). The code goes to the customer's phone; the technician reads it back from them.
INSERT INTO otp_challenges (purpose, booking_id, phone, code_hash, expires_at, max_attempts)
VALUES (@purpose, @booking_id, @phone, @code_hash, @expires_at, @max_attempts)
RETURNING id;

-- name: GetLiveJobOtpChallenge :one
-- The live challenge for this booking and purpose: not consumed, not expired.
SELECT id, code_hash, attempts, max_attempts
  FROM otp_challenges
 WHERE booking_id = $1
   AND purpose = $2
   AND consumed_at IS NULL
   AND expires_at > now()
 ORDER BY created_at DESC
 LIMIT 1;

-- name: GetBookingCustomerPhone :one
SELECT u.phone
  FROM bookings b
  JOIN users u ON u.id = b.customer_id
 WHERE b.id = $1;
