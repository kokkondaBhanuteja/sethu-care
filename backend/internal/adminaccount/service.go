// Package adminaccount owns the ops console's sign-in surface: admin accounts (email +
// bcrypt password + lockout), the trusted devices those accounts sign in from, the
// second-factor challenge ENVELOPES, per-account console settings, and diagnostics uploads.
//
// It deliberately does NOT own a second OTP system. Codes are issued and verified by the
// existing engine in internal/identity (bcrypt-hashed rows in otp_challenges, crypto/rand
// codes, attempt caps, the App-Review demo bypass). What lives here is only the envelope
// that binds the console's challengeId to an account and a device, plus the console's own
// stricter attempt budget (3 per code).
package adminaccount

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/kokkondaBhanuteja/sethu-care/internal/audit"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"
)

// The security envelope, per docs/Admin-Mobile-App.md §5.2/§5.3/§5.8: five failed
// passwords lock the account for fifteen minutes; a code gets three guesses; resends are
// capped at three per ten minutes; a trusted device is remembered for thirty days, and an
// account holds at most three trust slots.
const (
	maxLoginAttempts     = 5
	lockoutSeconds       = 15 * 60
	challengeTTL         = 5 * time.Minute
	challengeMaxAttempts = 3
	resendGuardSeconds   = 30
	resendLimit          = 3
	resendWindow         = 10 * time.Minute
	deviceTrustTTL       = 30 * 24 * time.Hour

	// MaxTrustedDevices is the trust-slot cap the 409 DEVICE_LIMIT_REACHED enforces.
	MaxTrustedDevices = 3

	securityEventLimit = 20
)

// The audit-log vocabulary this package records under entity_type "admin_account". The
// /ops/audit list filters to its own closed action set, so these stay out of that screen;
// the security screen reads them back as its recent-events feed.
const (
	entityAdminAccount = "admin_account"

	auditActionSignedIn      = "ADMIN_SIGNED_IN"
	auditActionSignInFailed  = "ADMIN_SIGN_IN_FAILED"
	auditActionDeviceTrusted = "ADMIN_DEVICE_TRUSTED"
	auditActionDeviceRevoked = "ADMIN_DEVICE_REVOKED"
	auditActionSignedOut     = "ADMIN_SIGNED_OUT"
	// auditActionPasswordChanged has no writer yet — password changes happen in the web
	// dashboard — but the security screen already knows how to render it.
	auditActionPasswordChanged = "ADMIN_PASSWORD_CHANGED"
)

// timingDummyHash is a bcrypt hash of a random throwaway value. An unknown email runs a
// compare against it so "no such account" costs the same as "wrong password" — no timing
// oracle for account enumeration.
const timingDummyHash = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"

var (
	// ErrInvalidCredentials never says whether the email or the password was wrong.
	ErrInvalidCredentials = errors.New("adminaccount: invalid email or password")
	// ErrAccountDisabled is terminal in-app; only the web dashboard re-enables.
	ErrAccountDisabled = errors.New("adminaccount: account disabled")
	// ErrChallengeExpired — unknown, consumed, or expired challenge. One error for all
	// three: only the latest code is ever valid.
	ErrChallengeExpired = errors.New("adminaccount: code expired; request a new one")
	// ErrOtpAttemptsExhausted burns the challenge; the operator restarts from login.
	ErrOtpAttemptsExhausted = errors.New("adminaccount: too many attempts; sign in again")
	// ErrDeviceNotFound — the device id names no device on this account.
	ErrDeviceNotFound = errors.New("adminaccount: device not found")
	// ErrAccountNotFound — the bearer token's user has no admin account row.
	ErrAccountNotFound = errors.New("adminaccount: no admin account for this user")
)

// LockedError is the contract's 423: the account is locked and retryAfter counts down.
type LockedError struct{ RetryAfter time.Duration }

func (locked *LockedError) Error() string {
	return fmt.Sprintf("adminaccount: account locked; retry in %s", locked.RetryAfter)
}

// InvalidOtpError is the contract's 400 INVALID_OTP with the remaining budget.
type InvalidOtpError struct{ AttemptsRemaining int32 }

func (invalid *InvalidOtpError) Error() string {
	return fmt.Sprintf("adminaccount: wrong code; %d attempts remaining", invalid.AttemptsRemaining)
}

// DeviceLimitError is the contract's 409 DEVICE_LIMIT_REACHED, carrying the occupied trust
// slots so the operator can pick one to evict.
type DeviceLimitError struct{ Devices []Device }

func (limit *DeviceLimitError) Error() string {
	return fmt.Sprintf("adminaccount: trusted-device limit of %d reached", MaxTrustedDevices)
}

// ResendLimitedError is the contract's 429 on the resend endpoint, carrying the instant
// the window reopens.
type ResendLimitedError struct{ ResetAt time.Time }

func (limited *ResendLimitedError) Error() string {
	return "adminaccount: too many codes requested; wait for the window to reopen"
}

// Account is the signed-in admin as the console's session stores it.
type Account struct {
	ID                uuid.UUID
	UserID            uuid.UUID
	Email             string
	DisplayName       string
	Phone             string
	PasswordChangedAt time.Time
	JoinedAt          time.Time
}

// MaskedPhone masks at the source (spec §5.6): the console never receives a full number.
// Empty stays empty — an unprovisioned profile has no number to hint at.
func (account Account) MaskedPhone() string {
	if account.Phone == "" {
		return ""
	}
	return maskPhone(account.Phone)
}

// Challenge is the pending second factor as the console carries it between /login and /2fa.
type Challenge struct {
	ID                uuid.UUID
	MaskedMobile      string
	ExpiresInSeconds  int32
	ResendInSeconds   int32
	AttemptsRemaining int32
}

// LoginResult is the first factor's outcome: either a completed session (already-trusted
// device) or a pending challenge. Code is the plaintext second-factor code for the
// transport layer to deliver by SMS — empty when the engine's resend guard declined to
// mint a fresh one (the previously delivered code is still live).
type LoginResult struct {
	Authenticated bool
	Account       Account
	Challenge     Challenge
	Code          string
	Phone         string
}

// Device is one device row: a trust slot, or a session-only sign-in on the security screen.
type Device struct {
	ID         uuid.UUID
	DeviceID   string
	Name       string
	Type       DeviceType
	Location   string
	LastUsedAt time.Time
	SignedIn   bool
	IsCurrent  bool
}

// RevokeResult reports a revocation. SessionInvalidated is true when the device had an
// open session — tokens are not device-bound, so "the caller's own device" is a heuristic
// (see TouchCurrentAdminDevice in the queries) and the console errs on signing out.
type RevokeResult struct {
	DeviceID           uuid.UUID
	SessionInvalidated bool
}

// accountRecord is the one shape the three account lookups share. Its fields mirror the
// generated row structs exactly (same names, types, and order), so each sqlcgen row
// converts to it directly — one internal currency instead of three.
type accountRecord struct {
	ID                  uuid.UUID
	UserID              uuid.UUID
	Email               string
	PasswordHash        string
	DisplayName         string
	IsDisabled          bool
	FailedLoginAttempts int32
	LockedUntil         pgtype.Timestamptz
	PasswordChangedAt   pgtype.Timestamptz
	CreatedAt           pgtype.Timestamptz
	Phone               string
	UserName            string
}

// Service owns the admin console's account aggregate. The identity service is the OTP
// engine it rides for the second factor.
type Service struct {
	pool     *pgxpool.Pool
	identity *identity.Service
	now      func() time.Time
}

// Option configures the Service at construction.
type Option func(*Service)

// WithClock injects a deterministic clock for tests.
func WithClock(now func() time.Time) Option {
	return func(service *Service) { service.now = now }
}

// NewService builds the admin account service. The identity service is required — it is
// the second factor's engine.
func NewService(pool *pgxpool.Pool, identityService *identity.Service, opts ...Option) *Service {
	service := &Service{pool: pool, identity: identityService, now: time.Now}
	for _, opt := range opts {
		opt(service)
	}
	return service
}

// IsDemoPhone exposes the identity demo-account check so the transport layer can skip
// sending a real SMS to the reserved review/dev number.
func (service *Service) IsDemoPhone(phone string) bool {
	return service.identity.IsDemoPhone(phone)
}

// Login verifies the first factor. Order matters and is deliberate: lock check before the
// password compare (a locked account accepts no more guesses), the disabled check only
// after a CORRECT password (a disabled account must not be discoverable by guessing).
func (service *Service) Login(ctx context.Context, email, password, deviceID, deviceName string) (LoginResult, error) {
	queries := sqlcgen.New(service.pool)
	emailRow, err := queries.GetAdminAccountByEmail(ctx, strings.ToLower(strings.TrimSpace(email)))
	if errors.Is(err, pgx.ErrNoRows) {
		// Equalize timing with the wrong-password path — no account-enumeration oracle.
		_ = bcrypt.CompareHashAndPassword([]byte(timingDummyHash), []byte(password)) //nolint:errcheck // deliberate timing equalization; the mismatch is the point
		return LoginResult{}, ErrInvalidCredentials
	}
	if err != nil {
		return LoginResult{}, fmt.Errorf("looking up admin account: %w", err)
	}
	accountRow := accountRecord(emailRow)

	now := service.now()
	if accountRow.LockedUntil.Valid && accountRow.LockedUntil.Time.After(now) {
		return LoginResult{}, &LockedError{RetryAfter: accountRow.LockedUntil.Time.Sub(now)}
	}

	if bcrypt.CompareHashAndPassword([]byte(accountRow.PasswordHash), []byte(password)) != nil {
		return LoginResult{}, service.recordLoginFailure(ctx, accountRow, deviceName)
	}

	if accountRow.IsDisabled {
		return LoginResult{}, ErrAccountDisabled
	}

	if accountRow.FailedLoginAttempts > 0 || accountRow.LockedUntil.Valid {
		if err := queries.ResetAdminLoginFailures(ctx, accountRow.ID); err != nil {
			return LoginResult{}, fmt.Errorf("resetting login failures: %w", err)
		}
	}

	account := accountOf(accountRow)

	// An already-trusted device skips the second factor and opens its session directly.
	if _, err := queries.GetTrustedAdminDevice(ctx, sqlcgen.GetTrustedAdminDeviceParams{
		AdminAccountID: accountRow.ID,
		DeviceID:       deviceID,
	}); err == nil {
		if err := service.openSession(ctx, accountRow, deviceID, deviceName, false); err != nil {
			return LoginResult{}, err
		}
		return LoginResult{Authenticated: true, Account: account}, nil
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return LoginResult{}, fmt.Errorf("checking device trust: %w", err)
	}

	// Second factor: the identity engine mints and delivers the code; we mint the envelope.
	// Inside the engine's 30s resend guard we keep the previously issued (still live) code
	// and simply hand out a fresh envelope with no new SMS.
	code, err := service.identity.RequestOTP(ctx, accountRow.Phone)
	if errors.Is(err, identity.ErrOtpRateLimited) {
		code = ""
	} else if err != nil {
		return LoginResult{}, fmt.Errorf("issuing second-factor code: %w", err)
	}

	challenge, err := service.mintChallenge(ctx, accountRow, deviceID, deviceName)
	if err != nil {
		return LoginResult{}, err
	}
	return LoginResult{Challenge: challenge, Code: code, Phone: accountRow.Phone}, nil
}

// VerifyOTP checks the second factor against the identity engine and, on success, opens
// the session and (when asked) grants the device a trust slot.
func (service *Service) VerifyOTP(ctx context.Context, challengeID uuid.UUID, code, deviceID string, trustDevice bool) (Account, error) {
	queries := sqlcgen.New(service.pool)
	challenge, err := queries.GetLiveAdminChallenge(ctx, challengeID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Account{}, ErrChallengeExpired
	}
	if err != nil {
		return Account{}, fmt.Errorf("reading challenge: %w", err)
	}

	accountByIDRow, err := queries.GetAdminAccountByID(ctx, challenge.AdminAccountID)
	if err != nil {
		return Account{}, fmt.Errorf("reading challenge account: %w", err)
	}
	accountRow := accountRecord(accountByIDRow)
	if accountRow.IsDisabled {
		return Account{}, ErrAccountDisabled
	}

	targetDeviceID := deviceID
	if targetDeviceID == "" {
		targetDeviceID = challenge.DeviceID
	}

	// The trust-slot check runs BEFORE the code is spent, deliberately: verifying consumes
	// the single-use code, so a 409 after verification would leave the operator unable to
	// retry the same code after revoking a slot — the exact flow the device-limit picker
	// is designed around. The challengeId already proves the first factor, and the slots
	// disclosed are the account's own.
	if trustDevice {
		occupied, err := queries.ListActiveAdminDevices(ctx, accountRow.ID)
		if err != nil {
			return Account{}, fmt.Errorf("listing trust slots: %w", err)
		}
		alreadyTrusted := false
		for _, slot := range occupied {
			if slot.DeviceID == targetDeviceID {
				alreadyTrusted = true
				break
			}
		}
		if !alreadyTrusted && len(occupied) >= MaxTrustedDevices {
			return Account{}, &DeviceLimitError{Devices: devicesOf(occupied)}
		}
	}

	verifiedUser, verifyErr := service.identity.VerifyOTP(ctx, accountRow.Phone, code)
	if verifyErr != nil {
		if errors.Is(verifyErr, identity.ErrOtpInvalid) || errors.Is(verifyErr, identity.ErrOtpTooManyAttempts) {
			return Account{}, service.recordOtpFailure(ctx, challengeID, verifyErr)
		}
		return Account{}, fmt.Errorf("verifying second factor: %w", verifyErr)
	}
	if verifiedUser.ID != accountRow.UserID {
		return Account{}, fmt.Errorf("adminaccount: verified user %s is not the challenge's account holder", verifiedUser.ID)
	}

	err = storage.InTx(ctx, service.pool, func(tx pgx.Tx) error {
		txQueries := sqlcgen.New(tx)
		if err := txQueries.ConsumeAdminChallenge(ctx, challengeID); err != nil {
			return fmt.Errorf("consuming challenge: %w", err)
		}
		deviceRow, err := txQueries.UpsertAdminDevice(ctx, sqlcgen.UpsertAdminDeviceParams{
			AdminAccountID: accountRow.ID,
			DeviceID:       targetDeviceID,
			Name:           challenge.DeviceName,
			DeviceType:     string(deriveDeviceType(challenge.DeviceName)),
			GrantTrust:     trustDevice,
			TrustedUntil:   pgTimestamp(service.now().Add(deviceTrustTTL)),
		})
		if err != nil {
			return fmt.Errorf("registering device: %w", err)
		}
		if err := service.recordEvent(ctx, tx, accountRow, auditActionSignedIn, challenge.DeviceName, targetDeviceID); err != nil {
			return err
		}
		if trustDevice && deviceRow.IsTrusted {
			if err := service.recordEvent(ctx, tx, accountRow, auditActionDeviceTrusted, challenge.DeviceName, targetDeviceID); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return Account{}, err
	}
	return accountOf(accountRow), nil
}

// ResendOTP mints a fresh code (superseding the previous one — only the latest is valid)
// under the 3-per-10-minutes budget. An expired envelope may resend; a consumed one may not.
func (service *Service) ResendOTP(ctx context.Context, challengeID uuid.UUID) (Challenge, string, string, error) {
	queries := sqlcgen.New(service.pool)
	previous, err := queries.GetAdminChallengeForResend(ctx, challengeID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Challenge{}, "", "", ErrChallengeExpired
	}
	if err != nil {
		return Challenge{}, "", "", fmt.Errorf("reading challenge: %w", err)
	}

	recent, err := queries.CountRecentAdminChallenges(ctx, sqlcgen.CountRecentAdminChallengesParams{
		AdminAccountID: previous.AdminAccountID,
		WithinSeconds:  int32(resendWindow / time.Second),
	})
	if err != nil {
		return Challenge{}, "", "", fmt.Errorf("counting recent challenges: %w", err)
	}
	if recent.Issued >= resendLimit {
		resetAt := service.now().Add(resendWindow)
		if recent.OldestAt.Valid {
			resetAt = recent.OldestAt.Time.Add(resendWindow)
		}
		return Challenge{}, "", "", &ResendLimitedError{ResetAt: resetAt}
	}

	accountByIDRow, err := queries.GetAdminAccountByID(ctx, previous.AdminAccountID)
	if err != nil {
		return Challenge{}, "", "", fmt.Errorf("reading challenge account: %w", err)
	}
	accountRow := accountRecord(accountByIDRow)
	if accountRow.IsDisabled {
		return Challenge{}, "", "", ErrAccountDisabled
	}

	code, err := service.identity.RequestOTP(ctx, accountRow.Phone)
	if errors.Is(err, identity.ErrOtpRateLimited) {
		// The engine's 30s guard is stricter than our 10-minute budget here; surface it as
		// the same declared 429 with the shorter reset.
		return Challenge{}, "", "", &ResendLimitedError{ResetAt: service.now().Add(resendGuardSeconds * time.Second)}
	}
	if err != nil {
		return Challenge{}, "", "", fmt.Errorf("issuing second-factor code: %w", err)
	}

	if err := queries.ConsumeAdminChallenge(ctx, challengeID); err != nil {
		return Challenge{}, "", "", fmt.Errorf("superseding challenge: %w", err)
	}
	challenge, err := service.mintChallenge(ctx, accountRow, previous.DeviceID, previous.DeviceName)
	if err != nil {
		return Challenge{}, "", "", err
	}
	return challenge, code, accountRow.Phone, nil
}

// TrustedDevices lists the occupied trust slots, most recently used first.
func (service *Service) TrustedDevices(ctx context.Context, userID uuid.UUID) ([]Device, error) {
	accountRow, err := service.accountByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	rows, err := sqlcgen.New(service.pool).ListActiveAdminDevices(ctx, accountRow.ID)
	if err != nil {
		return nil, fmt.Errorf("listing trusted devices: %w", err)
	}
	return devicesOf(rows), nil
}

// RevokeDevice frees a trust slot and closes the device's session. Replaying a revoke is
// idempotent: an already-revoked device returns the same result rather than acting again.
func (service *Service) RevokeDevice(ctx context.Context, userID, deviceRowID uuid.UUID) (RevokeResult, error) {
	accountRow, err := service.accountByUserID(ctx, userID)
	if err != nil {
		return RevokeResult{}, err
	}
	deviceRow, err := sqlcgen.New(service.pool).GetAdminDeviceByID(ctx, sqlcgen.GetAdminDeviceByIDParams{
		ID:             deviceRowID,
		AdminAccountID: accountRow.ID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return RevokeResult{}, ErrDeviceNotFound
	}
	if err != nil {
		return RevokeResult{}, fmt.Errorf("reading device: %w", err)
	}
	if deviceRow.RevokedAt.Valid {
		return RevokeResult{DeviceID: deviceRow.ID, SessionInvalidated: false}, nil
	}

	err = storage.InTx(ctx, service.pool, func(tx pgx.Tx) error {
		if err := sqlcgen.New(tx).RevokeAdminDevice(ctx, sqlcgen.RevokeAdminDeviceParams{
			ID:             deviceRowID,
			AdminAccountID: accountRow.ID,
		}); err != nil {
			return fmt.Errorf("revoking device: %w", err)
		}
		return service.recordEvent(ctx, tx, accountRow, auditActionDeviceRevoked, deviceRow.Name, deviceRow.DeviceID)
	})
	if err != nil {
		return RevokeResult{}, err
	}
	return RevokeResult{DeviceID: deviceRow.ID, SessionInvalidated: deviceRow.SignedIn}, nil
}

// Logout closes the caller's session bookkeeping. The JWT itself is stateless and expires
// on its TTL — an honest, documented gap until tokens are device-bound.
func (service *Service) Logout(ctx context.Context, userID uuid.UUID) error {
	accountRow, err := service.accountByUserID(ctx, userID)
	if errors.Is(err, ErrAccountNotFound) {
		return nil // nothing to sign out; logout is idempotent
	}
	if err != nil {
		return err
	}
	return storage.InTx(ctx, service.pool, func(tx pgx.Tx) error {
		if _, err := sqlcgen.New(tx).SignOutCurrentAdminDevice(ctx, accountRow.ID); err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("closing session: %w", err)
		}
		return service.recordEvent(ctx, tx, accountRow, auditActionSignedOut, "", "")
	})
}

// SessionAccount resolves the bearer token's account for refresh, touching the heuristic
// current device's last-used instant on the way.
func (service *Service) SessionAccount(ctx context.Context, userID uuid.UUID) (Account, error) {
	accountRow, err := service.accountByUserID(ctx, userID)
	if err != nil {
		return Account{}, err
	}
	if _, err := sqlcgen.New(service.pool).TouchCurrentAdminDevice(ctx, accountRow.ID); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return Account{}, fmt.Errorf("touching current device: %w", err)
	}
	return accountOf(accountRow), nil
}

// Unlock re-verifies a locked session's password (the idle timeout's step-up). A correct
// password also clears the lockout counters — the operator has just proven themselves. A
// wrong one counts toward the lockout exactly like a login failure, so the unlock prompt
// cannot be used as a free brute-force surface.
func (service *Service) Unlock(ctx context.Context, userID uuid.UUID, password string) error {
	accountRow, err := service.accountByUserID(ctx, userID)
	if errors.Is(err, ErrAccountNotFound) {
		_ = bcrypt.CompareHashAndPassword([]byte(timingDummyHash), []byte(password)) //nolint:errcheck // deliberate timing equalization; the mismatch is the point
		return ErrInvalidCredentials
	}
	if err != nil {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(accountRow.PasswordHash), []byte(password)) != nil {
		failure := service.recordLoginFailure(ctx, accountRow, "")
		var locked *LockedError
		if errors.As(failure, &locked) {
			// The unlock contract declares only the 401; the lock shows at the next login.
			return ErrInvalidCredentials
		}
		return failure
	}
	if err := sqlcgen.New(service.pool).ResetAdminLoginFailures(ctx, accountRow.ID); err != nil {
		return fmt.Errorf("resetting login failures: %w", err)
	}
	return nil
}

// ---------------------------------------------------------------------- internals

func (service *Service) accountByUserID(ctx context.Context, userID uuid.UUID) (accountRecord, error) {
	accountRow, err := sqlcgen.New(service.pool).GetAdminAccountByUserID(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return accountRecord{}, ErrAccountNotFound
	}
	if err != nil {
		return accountRecord{}, fmt.Errorf("looking up admin account: %w", err)
	}
	return accountRecord(accountRow), nil
}

// recordLoginFailure counts a failed password attempt and audits it; the returned error is
// the one the caller should surface (423 once the failure locks, 401 otherwise).
func (service *Service) recordLoginFailure(ctx context.Context, accountRow accountRecord, deviceName string) error {
	failureErr := error(ErrInvalidCredentials)
	err := storage.InTx(ctx, service.pool, func(tx pgx.Tx) error {
		row, err := sqlcgen.New(tx).RecordAdminLoginFailure(ctx, sqlcgen.RecordAdminLoginFailureParams{
			MaxAttempts: maxLoginAttempts,
			LockSeconds: lockoutSeconds,
			ID:          accountRow.ID,
		})
		if err != nil {
			return fmt.Errorf("recording login failure: %w", err)
		}
		if err := service.recordEvent(ctx, tx, accountRow, auditActionSignInFailed, deviceName, ""); err != nil {
			return err
		}
		if row.LockedUntil.Valid && row.LockedUntil.Time.After(service.now()) {
			failureErr = &LockedError{RetryAfter: row.LockedUntil.Time.Sub(service.now())}
		}
		return nil
	})
	if err != nil {
		return err
	}
	return failureErr
}

// recordOtpFailure spends one unit of the console's 3-guess budget; exhausting it (or the
// engine burning its own 5-guess cap) burns the envelope.
func (service *Service) recordOtpFailure(ctx context.Context, challengeID uuid.UUID, verifyErr error) error {
	attemptRow, err := sqlcgen.New(service.pool).IncrementAdminChallengeAttempts(ctx, challengeID)
	if err != nil {
		return fmt.Errorf("recording code attempt: %w", err)
	}
	remaining := attemptRow.MaxAttempts - attemptRow.Attempts
	if remaining <= 0 || errors.Is(verifyErr, identity.ErrOtpTooManyAttempts) {
		if err := sqlcgen.New(service.pool).ConsumeAdminChallenge(ctx, challengeID); err != nil {
			return fmt.Errorf("burning exhausted challenge: %w", err)
		}
		return ErrOtpAttemptsExhausted
	}
	return &InvalidOtpError{AttemptsRemaining: remaining}
}

func (service *Service) mintChallenge(ctx context.Context, accountRow accountRecord, deviceID, deviceName string) (Challenge, error) {
	challengeID, err := sqlcgen.New(service.pool).InsertAdminChallenge(ctx, sqlcgen.InsertAdminChallengeParams{
		AdminAccountID: accountRow.ID,
		DeviceID:       deviceID,
		DeviceName:     deviceName,
		MaxAttempts:    challengeMaxAttempts,
		ExpiresAt:      pgTimestamp(service.now().Add(challengeTTL)),
	})
	if err != nil {
		return Challenge{}, fmt.Errorf("storing challenge: %w", err)
	}
	return Challenge{
		ID:                challengeID,
		MaskedMobile:      maskPhone(accountRow.Phone),
		ExpiresInSeconds:  int32(challengeTTL / time.Second),
		ResendInSeconds:   resendGuardSeconds,
		AttemptsRemaining: challengeMaxAttempts,
	}, nil
}

// openSession is the trusted-device fast path: refresh the device row and audit the
// sign-in, atomically.
func (service *Service) openSession(ctx context.Context, accountRow accountRecord, deviceID, deviceName string, grantTrust bool) error {
	return storage.InTx(ctx, service.pool, func(tx pgx.Tx) error {
		if _, err := sqlcgen.New(tx).UpsertAdminDevice(ctx, sqlcgen.UpsertAdminDeviceParams{
			AdminAccountID: accountRow.ID,
			DeviceID:       deviceID,
			Name:           deviceName,
			DeviceType:     string(deriveDeviceType(deviceName)),
			GrantTrust:     grantTrust,
			TrustedUntil:   pgTimestamp(service.now().Add(deviceTrustTTL)),
		}); err != nil {
			return fmt.Errorf("refreshing device: %w", err)
		}
		return service.recordEvent(ctx, tx, accountRow, auditActionSignedIn, deviceName, deviceID)
	})
}

// recordEvent writes one security event to the audit log, inside the caller's transaction.
// Payloads name the device, never a password or a code.
func (service *Service) recordEvent(ctx context.Context, tx pgx.Tx, accountRow accountRecord, action, deviceName, deviceID string) error {
	actorID := accountRow.UserID
	payload := map[string]string{}
	if deviceName != "" {
		payload["deviceName"] = deviceName
	}
	if deviceID != "" {
		payload["deviceId"] = deviceID
	}
	if err := audit.Record(ctx, tx, audit.Entry{
		ActorUserID: &actorID,
		Action:      action,
		EntityType:  entityAdminAccount,
		EntityID:    accountRow.ID,
		After:       payload,
	}); err != nil {
		return fmt.Errorf("auditing %s: %w", action, err)
	}
	return nil
}

// ---------------------------------------------------------------------- mapping

func accountOf(row accountRecord) Account {
	return Account{
		ID:                row.ID,
		UserID:            row.UserID,
		Email:             row.Email,
		DisplayName:       row.DisplayName,
		Phone:             row.Phone,
		PasswordChangedAt: timeOf(row.PasswordChangedAt),
		JoinedAt:          timeOf(row.CreatedAt),
	}
}

func devicesOf(rows []sqlcgen.ListActiveAdminDevicesRow) []Device {
	devices := make([]Device, 0, len(rows))
	for _, row := range rows {
		deviceType, err := ParseDeviceType(row.DeviceType)
		if err != nil {
			deviceType = DeviceDesktop // a CHECK-guarded column cannot hold junk; belt and braces
		}
		devices = append(devices, Device{
			ID:         row.ID,
			DeviceID:   row.DeviceID,
			Name:       row.Name,
			Type:       deviceType,
			Location:   row.Location,
			LastUsedAt: timeOf(row.LastUsedAt),
			SignedIn:   row.SignedIn,
		})
	}
	return devices
}

// deriveDeviceType guesses the glyph from the client-supplied device name ("iPhone 14",
// "Pixel 8", "MacBook Pro"). A heuristic on purpose: the client never declares a type.
func deriveDeviceType(deviceName string) DeviceType {
	lowered := strings.ToLower(deviceName)
	switch {
	case strings.Contains(lowered, "ipad") || strings.Contains(lowered, "tab"):
		return DeviceTablet
	case strings.Contains(lowered, "iphone") || strings.Contains(lowered, "phone") ||
		strings.Contains(lowered, "pixel") || strings.Contains(lowered, "galaxy") ||
		strings.Contains(lowered, "android"):
		return DevicePhone
	default:
		return DeviceDesktop
	}
}

// maskPhone masks at the source, per spec §5.6: the console never receives a full number.
// "+919876543210" renders as "+91 •••••43210".
func maskPhone(phone string) string {
	const visibleDigits = 5
	if len(phone) <= visibleDigits {
		return "•••••"
	}
	visible := phone[len(phone)-visibleDigits:]
	if strings.HasPrefix(phone, "+91") {
		return "+91 •••••" + visible
	}
	return "•••••" + visible
}

func pgTimestamp(at time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: at, Valid: true}
}

func timeOf(stamp pgtype.Timestamptz) time.Time {
	if !stamp.Valid {
		return time.Time{}
	}
	return stamp.Time
}
