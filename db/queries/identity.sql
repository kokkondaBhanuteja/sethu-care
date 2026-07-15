-- name: GetUserByPhone :one
SELECT id, phone, name, role, is_active
  FROM users
 WHERE phone = $1;

-- name: CreateUser :one
INSERT INTO users (phone, name, role)
VALUES (@phone, @name, @role)
RETURNING id, phone, name, role, is_active;

-- name: InsertOtpChallenge :one
-- purpose is LOGIN here, so booking_id stays NULL — the CHECK
-- otp_challenges_purpose_matches_booking enforces exactly that.
INSERT INTO otp_challenges (purpose, phone, code_hash, expires_at, max_attempts)
VALUES (@purpose, @phone, @code_hash, @expires_at, @max_attempts)
RETURNING id;

-- name: GetLiveOtpChallenge :one
-- The most recent challenge for this phone and purpose that is still usable: not consumed,
-- not expired. Uses the partial index otp_challenges_live_idx.
SELECT id, code_hash, attempts, max_attempts
  FROM otp_challenges
 WHERE phone = $1
   AND purpose = $2
   AND consumed_at IS NULL
   AND expires_at > now()
 ORDER BY created_at DESC
 LIMIT 1;

-- name: IncrementOtpAttempts :exec
UPDATE otp_challenges
   SET attempts = attempts + 1, updated_at = now()
 WHERE id = $1;

-- name: ConsumeOtpChallenge :exec
UPDATE otp_challenges
   SET consumed_at = now(), updated_at = now()
 WHERE id = $1;

-- name: RecomputeTechnicianRating :exec
-- Recompute a technician's rating as the average of all their reviews. Idempotent — the
-- review.submitted consumer can run it as often as the event is delivered.
UPDATE technicians
   SET rating = COALESCE((SELECT AVG(rating)::numeric(3, 2) FROM reviews WHERE technician_id = $1), 5.00),
       updated_at = now()
 WHERE user_id = $1;

-- name: CountRecentOtpChallenges :one
-- Rate-limit guard: how many challenges were issued for this phone in the last N seconds.
SELECT count(*)
  FROM otp_challenges
 WHERE phone = $1
   AND purpose = $2
   AND created_at > now() - make_interval(secs => @within_seconds);
