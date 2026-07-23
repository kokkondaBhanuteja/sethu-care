-- The admin console's account context: accounts, trusted devices, second-factor envelopes,
-- settings, and diagnostics. Owned by internal/adminaccount — its service is the only writer
-- of these tables.

-- name: GetAdminAccountByEmail :one
-- The login lookup. Email is stored lowercased; callers lowercase before querying.
SELECT accounts.id, accounts.user_id, accounts.email, accounts.password_hash,
       accounts.display_name, accounts.is_disabled, accounts.failed_login_attempts,
       accounts.locked_until, accounts.password_changed_at, accounts.created_at,
       users.phone, users.name AS user_name
  FROM admin_accounts accounts
  JOIN users ON users.id = accounts.user_id
 WHERE accounts.email = $1;

-- name: GetAdminAccountByUserID :one
-- The token-holder lookup: every operation behind the bearer middleware knows only the
-- users.id the token names.
SELECT accounts.id, accounts.user_id, accounts.email, accounts.password_hash,
       accounts.display_name, accounts.is_disabled, accounts.failed_login_attempts,
       accounts.locked_until, accounts.password_changed_at, accounts.created_at,
       users.phone, users.name AS user_name
  FROM admin_accounts accounts
  JOIN users ON users.id = accounts.user_id
 WHERE accounts.user_id = $1;

-- name: GetAdminAccountByID :one
-- The challenge-holder lookup during the second factor, before any session exists.
SELECT accounts.id, accounts.user_id, accounts.email, accounts.password_hash,
       accounts.display_name, accounts.is_disabled, accounts.failed_login_attempts,
       accounts.locked_until, accounts.password_changed_at, accounts.created_at,
       users.phone, users.name AS user_name
  FROM admin_accounts accounts
  JOIN users ON users.id = accounts.user_id
 WHERE accounts.id = $1;

-- name: RecordAdminLoginFailure :one
-- One statement so the count and the lock decision cannot race: the caller passes the
-- attempt cap and the lock duration, and reads back whether this failure locked the account.
UPDATE admin_accounts
   SET failed_login_attempts = failed_login_attempts + 1,
       locked_until = CASE
           WHEN failed_login_attempts + 1 >= @max_attempts::int
               THEN now() + make_interval(secs => @lock_seconds::int)
           ELSE locked_until
       END,
       updated_at = now()
 WHERE id = @id
RETURNING failed_login_attempts, locked_until;

-- name: ResetAdminLoginFailures :exec
-- A successful password verification clears the counter and any lock.
UPDATE admin_accounts
   SET failed_login_attempts = 0, locked_until = NULL, updated_at = now()
 WHERE id = $1;

-- name: GetTrustedAdminDevice :one
-- The trusted-device fast path at login: a live trust for this exact device skips the
-- second factor.
SELECT id, device_id, name, device_type, location, trusted_until, signed_in, last_used_at
  FROM admin_devices
 WHERE admin_account_id = $1
   AND device_id = $2
   AND revoked_at IS NULL
   AND trusted_until IS NOT NULL
   AND trusted_until > now();

-- name: ListActiveAdminDevices :many
-- The trust slots: every unrevoked device with a live trust, most recently used first.
SELECT id, device_id, name, device_type, location, trusted_until, signed_in, last_used_at
  FROM admin_devices
 WHERE admin_account_id = $1
   AND revoked_at IS NULL
   AND trusted_until IS NOT NULL
   AND trusted_until > now()
 ORDER BY last_used_at DESC;

-- name: CountSignedInAdminDevices :one
-- activeSessions on the security screen. Session bookkeeping, not token revocation — the
-- JWTs themselves are stateless.
SELECT count(*)
  FROM admin_devices
 WHERE admin_account_id = $1
   AND revoked_at IS NULL
   AND signed_in;

-- name: GetAdminDeviceByID :one
SELECT id, device_id, name, device_type, location, trusted_until, signed_in, last_used_at,
       revoked_at
  FROM admin_devices
 WHERE id = $1
   AND admin_account_id = $2;

-- name: UpsertAdminDevice :one
-- A sign-in from a device: refreshes name/last-used, opens its session, clears any old
-- revocation (a revoked device that passes a fresh second factor has re-earned its place),
-- and grants trust only when asked — never silently dropping an existing trust.
INSERT INTO admin_devices (admin_account_id, device_id, name, device_type, trusted_until, signed_in, last_used_at)
VALUES (@admin_account_id, @device_id, @name, @device_type,
        CASE WHEN @grant_trust::boolean THEN @trusted_until::timestamptz ELSE NULL END,
        true, now())
ON CONFLICT (admin_account_id, device_id) DO UPDATE
   SET name = EXCLUDED.name,
       device_type = EXCLUDED.device_type,
       trusted_until = CASE WHEN @grant_trust::boolean THEN @trusted_until::timestamptz
                            ELSE admin_devices.trusted_until END,
       signed_in = true,
       last_used_at = now(),
       revoked_at = NULL,
       updated_at = now()
RETURNING id, (trusted_until IS NOT NULL)::boolean AS is_trusted;

-- name: RevokeAdminDevice :exec
UPDATE admin_devices
   SET revoked_at = now(), trusted_until = NULL, signed_in = false, updated_at = now()
 WHERE id = @id
   AND admin_account_id = @admin_account_id
   AND revoked_at IS NULL;

-- name: TouchCurrentAdminDevice :one
-- Best-effort "current device" bookkeeping: tokens are not device-bound (the JWT carries
-- only user id + role), so the caller's device is taken to be the account's most recently
-- used open session. Used by refresh to keep last_used_at honest.
UPDATE admin_devices
   SET last_used_at = now(), updated_at = now()
 WHERE id = (SELECT candidate.id
               FROM admin_devices candidate
              WHERE candidate.admin_account_id = $1
                AND candidate.revoked_at IS NULL
                AND candidate.signed_in
              ORDER BY candidate.last_used_at DESC
              LIMIT 1)
RETURNING id;

-- name: SignOutCurrentAdminDevice :one
-- Logout closes the heuristic current session (see TouchCurrentAdminDevice on why it is a
-- heuristic).
UPDATE admin_devices
   SET signed_in = false, updated_at = now()
 WHERE id = (SELECT candidate.id
               FROM admin_devices candidate
              WHERE candidate.admin_account_id = $1
                AND candidate.revoked_at IS NULL
                AND candidate.signed_in
              ORDER BY candidate.last_used_at DESC
              LIMIT 1)
RETURNING id;

-- name: InsertAdminChallenge :one
-- The second-factor envelope. No code here — the code is identity's, in otp_challenges.
INSERT INTO admin_challenges (admin_account_id, device_id, device_name, max_attempts, expires_at)
VALUES (@admin_account_id, @device_id, @device_name, @max_attempts, @expires_at)
RETURNING id;

-- name: GetLiveAdminChallenge :one
SELECT id, admin_account_id, device_id, device_name, attempts, max_attempts, expires_at
  FROM admin_challenges
 WHERE id = $1
   AND consumed_at IS NULL
   AND expires_at > now();

-- name: GetAdminChallengeForResend :one
-- Resend accepts an EXPIRED envelope (the expired screen's primary action is Resend) but
-- never a consumed one — a completed sign-in cannot mint fresh codes.
SELECT id, admin_account_id, device_id, device_name, attempts, max_attempts, expires_at
  FROM admin_challenges
 WHERE id = $1
   AND consumed_at IS NULL;

-- name: IncrementAdminChallengeAttempts :one
UPDATE admin_challenges
   SET attempts = attempts + 1
 WHERE id = $1
RETURNING attempts, max_attempts;

-- name: ConsumeAdminChallenge :exec
UPDATE admin_challenges
   SET consumed_at = now()
 WHERE id = $1;

-- name: CountRecentAdminChallenges :one
-- The resend budget: 3 fresh challenges per 10 minutes per account. min(created_at) lets
-- the caller compute when the window reopens for the 429's resetAt.
SELECT count(*) AS issued, min(created_at)::timestamptz AS oldest_at
  FROM admin_challenges
 WHERE admin_account_id = $1
   AND created_at > now() - make_interval(secs => @within_seconds::int);

-- name: GetAdminSettings :one
SELECT admin_account_id, appearance, haptics, default_landing_route,
       channel_sla_at_risk, channel_provider_no_show, channel_zone_supply_critical,
       channel_payment_failure, channel_new_applications, channel_auto_suspensions,
       channel_document_expiring, channel_daily_summary,
       critical_sound, digest_time, quiet_hours_from, quiet_hours_to, quiet_hours_enabled,
       vibrate, biometric_unlock
  FROM admin_settings
 WHERE admin_account_id = $1;

-- name: UpsertAdminPreferences :exec
-- The profile screen's preferences. Only these columns; notification columns keep their
-- stored values (or their declared defaults on first write).
INSERT INTO admin_settings (admin_account_id, appearance, haptics, default_landing_route)
VALUES (@admin_account_id, @appearance, @haptics, @default_landing_route)
ON CONFLICT (admin_account_id) DO UPDATE
   SET appearance = EXCLUDED.appearance,
       haptics = EXCLUDED.haptics,
       default_landing_route = EXCLUDED.default_landing_route,
       updated_at = now(),
       version = admin_settings.version + 1;

-- name: UpsertAdminNotificationSettings :exec
INSERT INTO admin_settings (admin_account_id,
       channel_sla_at_risk, channel_provider_no_show, channel_zone_supply_critical,
       channel_payment_failure, channel_new_applications, channel_auto_suspensions,
       channel_document_expiring, channel_daily_summary,
       critical_sound, digest_time, quiet_hours_from, quiet_hours_to, quiet_hours_enabled, vibrate)
VALUES (@admin_account_id,
       @channel_sla_at_risk, @channel_provider_no_show, @channel_zone_supply_critical,
       @channel_payment_failure, @channel_new_applications, @channel_auto_suspensions,
       @channel_document_expiring, @channel_daily_summary,
       @critical_sound, @digest_time, @quiet_hours_from, @quiet_hours_to, @quiet_hours_enabled, @vibrate)
ON CONFLICT (admin_account_id) DO UPDATE
   SET channel_sla_at_risk = EXCLUDED.channel_sla_at_risk,
       channel_provider_no_show = EXCLUDED.channel_provider_no_show,
       channel_zone_supply_critical = EXCLUDED.channel_zone_supply_critical,
       channel_payment_failure = EXCLUDED.channel_payment_failure,
       channel_new_applications = EXCLUDED.channel_new_applications,
       channel_auto_suspensions = EXCLUDED.channel_auto_suspensions,
       channel_document_expiring = EXCLUDED.channel_document_expiring,
       channel_daily_summary = EXCLUDED.channel_daily_summary,
       critical_sound = EXCLUDED.critical_sound,
       digest_time = EXCLUDED.digest_time,
       quiet_hours_from = EXCLUDED.quiet_hours_from,
       quiet_hours_to = EXCLUDED.quiet_hours_to,
       quiet_hours_enabled = EXCLUDED.quiet_hours_enabled,
       vibrate = EXCLUDED.vibrate,
       updated_at = now(),
       version = admin_settings.version + 1;

-- name: SetAdminBiometricUnlock :exec
INSERT INTO admin_settings (admin_account_id, biometric_unlock)
VALUES (@admin_account_id, @biometric_unlock)
ON CONFLICT (admin_account_id) DO UPDATE
   SET biometric_unlock = EXCLUDED.biometric_unlock,
       updated_at = now(),
       version = admin_settings.version + 1;

-- name: ListAdminSecurityDevices :many
-- The security screen's device rows: every unrevoked device (trusted or session-only),
-- most recently used first.
SELECT id, device_id, name, device_type, location, trusted_until, signed_in, last_used_at
  FROM admin_devices
 WHERE admin_account_id = $1
   AND revoked_at IS NULL
 ORDER BY last_used_at DESC;

-- name: ListAdminSecurityEvents :many
-- The recent security events, read back from the audit log the login flows write. The
-- device name rides in the audit payload; NULL device means the event named none.
SELECT id, action, created_at, after
  FROM audit_logs
 WHERE entity_type = 'admin_account'
   AND entity_id = $1
   AND action = ANY (@actions::text[])
 ORDER BY created_at DESC
 LIMIT @row_limit;

-- name: CountAdminActivity :one
-- The profile scoreboard's honest half: total audited actions by this operator, and how
-- many were booking assigns (the rescue action). The rest of the scoreboard has no engine
-- yet and stays zero.
SELECT count(*) AS actions,
       count(*) FILTER (WHERE action = 'ASSIGN') AS bookings_rescued
  FROM audit_logs
 WHERE actor_user_id = $1;

-- name: GetAdminDiagnosticsByKey :one
-- The idempotent replay read: the same Idempotency-Key returns the first receipt.
SELECT id, submitted_at
  FROM admin_diagnostics
 WHERE admin_account_id = $1
   AND idempotency_key = $2;

-- name: InsertAdminDiagnostics :one
INSERT INTO admin_diagnostics (admin_account_id, idempotency_key, app_version, device_model,
                               os_version, ota_bundle, logs, network_events)
VALUES (@admin_account_id, @idempotency_key, @app_version, @device_model,
        @os_version, @ota_bundle, @logs, @network_events)
RETURNING id, submitted_at;
