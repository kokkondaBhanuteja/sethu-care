package httpapi

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/kokkondaBhanuteja/sethu-care/internal/adminaccount"
	"github.com/kokkondaBhanuteja/sethu-care/internal/auth"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
)

// Admin console sign-in (§5–§6 of docs/admin-api-contract.md). The four operations that open a
// session — bootstrap, login, the second factor and its resend — cannot require a bearer token:
// they are how one is obtained. Everything after them is ADMIN-only.

func (handler *AdminHandler) registerAdminAuth(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "adminBootstrap", Method: http.MethodGet, Path: "/admin/auth/bootstrap",
		Summary: "Resolve the splash screen's routing decision", Tags: []string{"Admin Auth"},
		Responses: adminResponses(api),
	}, handler.bootstrap)

	huma.Register(api, huma.Operation{
		OperationID: "adminLogin", Method: http.MethodPost, Path: "/admin/auth/login",
		Summary: "Sign in with email and password", Tags: []string{"Admin Auth"},
		Responses: adminResponses(api,
			adminResponse{"401", "Wrong credentials", invalidCredentialsError{}},
			adminResponse{"403", "Account disabled", accountDisabledError{}},
			adminResponse{"423", "Account locked", accountLockedError{}},
		),
	}, handler.login)

	huma.Register(api, huma.Operation{
		OperationID: "adminVerifyOtp", Method: http.MethodPost, Path: "/admin/auth/2fa",
		Summary: "Verify the second factor and open a session", Tags: []string{"Admin Auth"},
		Responses: adminResponses(api,
			adminResponse{"400", "Wrong code", invalidOtpError{}},
			adminResponse{"409", "Trust slots full", deviceLimitError{}},
			adminResponse{"410", "Expired code", otpExpiredError{}},
			adminResponse{"423", "Attempts exhausted", accountLockedError{}},
		),
	}, handler.verifyOTP)

	huma.Register(api, huma.Operation{
		OperationID: "adminResendOtp", Method: http.MethodPost, Path: "/admin/auth/2fa/resend",
		Summary: "Issue a fresh second-factor challenge", Tags: []string{"Admin Auth"},
		Responses: adminResponses(api,
			adminResponse{"200", "OK — only the latest code is valid", otpChallenge{}},
			adminResponse{"429", "Rate limited — 3 per 10 minutes", rateLimitedError{}},
		),
	}, handler.resendOTP)

	huma.Register(api, huma.Operation{
		OperationID: "adminListDevices", Method: http.MethodGet, Path: "/admin/auth/devices",
		Summary: "List this account's trusted devices", Tags: []string{"Admin Auth"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api),
	}, handler.listDevices)

	huma.Register(api, huma.Operation{
		OperationID: "adminRevokeDevice", Method: http.MethodDelete, Path: "/admin/auth/devices/{id}",
		Summary: "Revoke a trusted device", Tags: []string{"Admin Auth"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api,
			adminResponse{"404", "Not Found", adminError{}},
		),
	}, handler.revokeDevice)

	huma.Register(api, huma.Operation{
		OperationID: "adminLogout", Method: http.MethodPost, Path: "/admin/auth/logout",
		Summary: "Invalidate the session server-side", Tags: []string{"Admin Auth"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api),
	}, handler.logout)

	huma.Register(api, huma.Operation{
		OperationID: "adminRefreshSession", Method: http.MethodPost, Path: "/admin/auth/refresh",
		Summary: "Refresh the session token", Tags: []string{"Admin Auth"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api),
	}, handler.refreshSession)

	huma.Register(api, huma.Operation{
		OperationID: "adminUnlock", Method: http.MethodPost, Path: "/admin/auth/unlock",
		Summary: "Re-verify a locked session with the password", Tags: []string{"Admin Auth"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api,
			adminResponse{"401", "Wrong password", adminError{}},
		),
	}, handler.unlock)
}

// ---------------------------------------------------------------- bootstrap

// adminBootstrap is the splash screen's routing decision. It is callable with or without a token,
// because deciding WHERE to send the operator is what happens before there is a session.
type adminBootstrap struct {
	HasSession         bool `json:"hasSession" required:"true"`
	IsBiometricEnabled bool `json:"isBiometricEnabled" required:"true" doc:"A stored session plus biometric opt-in routes through /unlock."`
	IsVersionSupported bool `json:"isVersionSupported" required:"true" doc:"False routes to the blocking forced-update screen — an unsupported build misreports live state."`
}

type adminBootstrapOutput struct {
	Body adminBootstrap
}

func (handler *AdminHandler) bootstrap(_ context.Context, _ *struct{}) (*adminBootstrapOutput, error) {
	// The declared input carries no Authorization parameter, so the server cannot inspect
	// a stored session here — and the console's splash derives hasSession (and the
	// biometric opt-in) from its own on-device store anyway. isVersionSupported stays true
	// until a minimum-version policy exists server-side to enforce; these are the honest
	// static answers, not placeholders for missing wiring.
	return &adminBootstrapOutput{Body: adminBootstrap{
		HasSession:         false,
		IsBiometricEnabled: false,
		IsVersionSupported: true,
	}}, nil
}

// -------------------------------------------------------------------- login

// adminLoginStatus is `authenticated` only on an already-trusted device, which skips the second
// factor.
type adminLoginStatus string

const (
	adminLoginStatusOTPRequired   adminLoginStatus = "otp_required"
	adminLoginStatusAuthenticated adminLoginStatus = "authenticated"
)

// Schema names the status vocabulary in the generated document.
func (adminLoginStatus) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "AdminLoginStatus",
		"`authenticated` only on an already-trusted device, which skips the second factor.",
		string(adminLoginStatusOTPRequired), string(adminLoginStatusAuthenticated))
}

type adminLoginRequest struct {
	DeviceID   string `json:"deviceId" required:"true"`
	DeviceName string `json:"deviceName" required:"true"`
	Email      string `json:"email" required:"true"`
	Password   string `json:"password" required:"true"`
}

// adminSessionUser is the signed-in account as @sethu/core's SessionUser stores it.
type adminSessionUser struct {
	Email string `json:"email" required:"true"`
	ID    string `json:"id" required:"true"`
	Name  string `json:"name" required:"true"`
	Role  string `json:"role" required:"true" doc:"Always ADMIN for this console. Provisioning happens in the web dashboard."`
}

// adminSession is a completed sign-in.
type adminSession struct {
	Permissions []string         `json:"permissions" required:"true" doc:"Action ids this account may perform. null means full access, which is the v1 single-role behaviour."`
	Token       string           `json:"token" required:"true"`
	User        adminSessionUser `json:"user" required:"true"`
}

// otpChallenge is the pending second factor, carried from /login to /admin/auth/2fa.
type otpChallenge struct {
	AttemptsRemaining int32  `json:"attemptsRemaining" required:"true"`
	ChallengeID       string `json:"challengeId" required:"true"`
	ExpiresInSeconds  int32  `json:"expiresInSeconds" required:"true"`
	MaskedMobile      string `json:"maskedMobile" required:"true" doc:"Already masked by the server; the console never receives a full number."`
	ResendInSeconds   int32  `json:"resendInSeconds" required:"true"`
}

// adminLoginResult is login's success shapes. Its designed FAILURES are the 401/403/423
// responses, which carry their own bodies.
type adminLoginResult struct {
	Challenge nullable[otpChallenge] `json:"challenge" doc:"Present when status is otp_required."`
	Session   nullable[adminSession] `json:"session" doc:"Present when status is authenticated."`
	Status    adminLoginStatus       `json:"status" required:"true"`
}

// accountDisabledError is terminal — there is no in-app recovery, ever.
type accountDisabledError struct {
	Error string `json:"error" required:"true" doc:"Always ACCOUNT_DISABLED."`
}

// accountLockedError follows five failed attempts.
type accountLockedError struct {
	Error      string `json:"error" required:"true" doc:"Always ACCOUNT_LOCKED."`
	RetryAfter int32  `json:"retryAfter" required:"true" doc:"Seconds. The UI counts it down live."`
}

// invalidCredentialsError never says which field was wrong — no account enumeration.
type invalidCredentialsError struct {
	Error string `json:"error" required:"true" doc:"Always INVALID_CREDENTIALS."`
}

type adminLoginInput struct {
	Body adminLoginRequest
}

type adminLoginOutput struct {
	Body adminLoginResult
}

func (handler *AdminHandler) login(ctx context.Context, input *adminLoginInput) (*adminLoginOutput, error) {
	request := input.Body
	if request.Email == "" || request.Password == "" || request.DeviceID == "" {
		return nil, toHumaError(handler.log, &badRequestError{msg: "email, password and deviceId are required"})
	}
	result, err := handler.accounts.Login(ctx, request.Email, request.Password, request.DeviceID, request.DeviceName)
	if err != nil {
		return nil, handler.adminAuthError(err)
	}

	if result.Authenticated {
		session, err := handler.adminSessionOf(result.Account)
		if err != nil {
			return nil, toHumaError(handler.log, err)
		}
		return &adminLoginOutput{Body: adminLoginResult{
			Status:  adminLoginStatusAuthenticated,
			Session: nullable[adminSession]{Value: &session},
		}}, nil
	}

	if err := handler.deliverAdminOTP(ctx, result.Phone, result.Code); err != nil {
		return nil, err
	}
	challenge := challengeDTO(result.Challenge)
	return &adminLoginOutput{Body: adminLoginResult{
		Status:    adminLoginStatusOTPRequired,
		Challenge: nullable[otpChallenge]{Value: &challenge},
	}}, nil
}

// -------------------------------------------------------------- second factor

type adminVerifyOtpRequest struct {
	ChallengeID string `json:"challengeId" required:"true"`
	Code        string `json:"code" required:"true"`
	DeviceID    string `json:"deviceId" required:"true"`
	TrustDevice bool   `json:"trustDevice" required:"true"`
}

// invalidOtpError shows the remaining attempts before the lockout, not after.
type invalidOtpError struct {
	AttemptsRemaining int32  `json:"attemptsRemaining" required:"true" doc:"Shown before the lockout, not after."`
	Error             string `json:"error" required:"true" doc:"Always INVALID_OTP."`
}

// otpExpiredError — only the latest code is ever valid.
type otpExpiredError struct {
	Error string `json:"error" required:"true" doc:"Always OTP_EXPIRED."`
}

// deviceLimitError carries the occupied trust slots so the operator can pick one to evict. The
// cap is three.
type deviceLimitError struct {
	Devices []authTrustedDevice `json:"devices" required:"true" nullable:"false" doc:"The occupied trust slots, so the operator can pick one to evict."`
	Error   string              `json:"error" required:"true" doc:"Always DEVICE_LIMIT_REACHED."`
}

type adminVerifyOtpInput struct {
	Body adminVerifyOtpRequest
}

type adminSessionOutput struct {
	Body adminSession
}

func (handler *AdminHandler) verifyOTP(ctx context.Context, input *adminVerifyOtpInput) (*adminSessionOutput, error) {
	challengeID, err := uuid.Parse(input.Body.ChallengeID)
	if err != nil {
		// An unparseable challenge id is a challenge the server never minted — the same
		// designed answer as an expired one: only the latest real challenge is valid.
		return nil, handler.adminAuthError(adminaccount.ErrChallengeExpired)
	}
	account, err := handler.accounts.VerifyOTP(ctx, challengeID, input.Body.Code, input.Body.DeviceID, input.Body.TrustDevice)
	if err != nil {
		return nil, handler.adminAuthError(err)
	}
	session, err := handler.adminSessionOf(account)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	return &adminSessionOutput{Body: session}, nil
}

// adminResendOtpRequest is rate limited to 3 per 10 minutes; a 429 carries the reset instant.
type adminResendOtpRequest struct {
	ChallengeID string `json:"challengeId" required:"true"`
}

type adminResendOtpInput struct {
	Body adminResendOtpRequest
}

type otpChallengeOutput struct {
	Body otpChallenge
}

func (handler *AdminHandler) resendOTP(ctx context.Context, input *adminResendOtpInput) (*otpChallengeOutput, error) {
	challengeID, err := uuid.Parse(input.Body.ChallengeID)
	if err != nil {
		return nil, handler.adminAuthError(adminaccount.ErrChallengeExpired)
	}
	challenge, code, phone, err := handler.accounts.ResendOTP(ctx, challengeID)
	if err != nil {
		return nil, handler.adminAuthError(err)
	}
	if err := handler.deliverAdminOTP(ctx, phone, code); err != nil {
		return nil, err
	}
	return &otpChallengeOutput{Body: challengeDTO(challenge)}, nil
}

// ------------------------------------------------------------ trusted devices

// deviceType drives the device-row glyph.
type deviceType string

const (
	deviceTypePhone   deviceType = "phone"
	deviceTypeTablet  deviceType = "tablet"
	deviceTypeDesktop deviceType = "desktop"
)

// Schema names the device-type vocabulary in the generated document.
func (deviceType) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "DeviceType", "Drives the device-row glyph.",
		string(deviceTypePhone), string(deviceTypeTablet), string(deviceTypeDesktop))
}

// authTrustedDevice is a trusted device as the sign-in flows show it (device-limit picker,
// security screen). Distinct from trustedDevice, which is the settings screen's row.
type authTrustedDevice struct {
	ID         string     `json:"id" required:"true"`
	LastUsedAt time.Time  `json:"lastUsedAt" required:"true"`
	Location   string     `json:"location" required:"true" doc:"City-level only."`
	Name       string     `json:"name" required:"true"`
	Type       deviceType `json:"type" required:"true"`
}

type authTrustedDeviceList struct {
	Items []authTrustedDevice `json:"items" required:"true" nullable:"false"`
}

type authTrustedDeviceListOutput struct {
	Body authTrustedDeviceList
}

func (handler *AdminHandler) listDevices(ctx context.Context, _ *struct{}) (*authTrustedDeviceListOutput, error) {
	caller, ok := userFromContext(ctx)
	if !ok {
		return nil, toHumaError(handler.log, &badRequestError{msg: "authentication required"})
	}
	devices, err := handler.accounts.TrustedDevices(ctx, caller.ID)
	if errors.Is(err, adminaccount.ErrAccountNotFound) {
		// An ADMIN token whose user predates admin_accounts: no slots, honestly empty.
		devices = nil
	} else if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	return &authTrustedDeviceListOutput{Body: authTrustedDeviceList{Items: authDevicesDTO(devices)}}, nil
}

// revokeDeviceResult — device.revoke is high risk, step-up required, no reason code, no undo.
type revokeDeviceResult struct {
	DeviceID           string `json:"deviceId" required:"true"`
	SessionInvalidated bool   `json:"sessionInvalidated" required:"true" doc:"True when the revoked device is the caller's own; the console then signs out and destroys every cache."`
}

type adminRevokeDeviceInput struct {
	ID string `path:"id" doc:"Device id"`
	AdminIdempotency
}

type revokeDeviceOutput struct {
	Body revokeDeviceResult
}

func (handler *AdminHandler) revokeDevice(ctx context.Context, input *adminRevokeDeviceInput) (*revokeDeviceOutput, error) {
	caller, ok := userFromContext(ctx)
	if !ok {
		return nil, toHumaError(handler.log, &badRequestError{msg: "authentication required"})
	}
	deviceID, err := uuid.Parse(input.ID)
	if err != nil {
		return nil, adminFailure(http.StatusNotFound, adminError{Code: "NOT_FOUND", Message: "device not found"})
	}
	// Replaying the same Idempotency-Key (an already-revoked device) returns the first
	// result rather than a 404 — the revoke happened, once.
	result, err := handler.accounts.RevokeDevice(ctx, caller.ID, deviceID)
	if errors.Is(err, adminaccount.ErrDeviceNotFound) || errors.Is(err, adminaccount.ErrAccountNotFound) {
		return nil, adminFailure(http.StatusNotFound, adminError{Code: "NOT_FOUND", Message: "device not found"})
	}
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	return &revokeDeviceOutput{Body: revokeDeviceResult{
		DeviceID:           result.DeviceID.String(),
		SessionInvalidated: result.SessionInvalidated,
	}}, nil
}

// ------------------------------------------------------------ session control

type adminLogoutInput struct {
	AdminIdempotency
}

func (handler *AdminHandler) logout(ctx context.Context, _ *adminLogoutInput) (*struct{}, error) {
	caller, ok := userFromContext(ctx)
	if !ok {
		return nil, toHumaError(handler.log, &badRequestError{msg: "authentication required"})
	}
	// Session bookkeeping is closed server-side; the bearer itself is a stateless JWT that
	// expires on its TTL (an honest, documented gap until tokens are device-bound). The
	// console additionally destroys every cache, per spec §5.6.
	if err := handler.accounts.Logout(ctx, caller.ID); err != nil {
		return nil, toHumaError(handler.log, err)
	}
	return &struct{}{}, nil
}

func (handler *AdminHandler) refreshSession(ctx context.Context, _ *struct{}) (*adminSessionOutput, error) {
	caller, ok := userFromContext(ctx)
	if !ok {
		return nil, toHumaError(handler.log, &badRequestError{msg: "authentication required"})
	}
	account, err := handler.accounts.SessionAccount(ctx, caller.ID)
	if errors.Is(err, adminaccount.ErrAccountNotFound) {
		// A valid ADMIN bearer whose user predates admin_accounts still refreshes; the
		// identity fields it cannot know are honest empties.
		account = adminaccount.Account{UserID: caller.ID}
	} else if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	session, err := handler.adminSessionOf(account)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	return &adminSessionOutput{Body: session}, nil
}

// adminUnlockRequest re-verifies a locked session (the idle timeout) without a fresh 2FA round.
type adminUnlockRequest struct {
	Password string `json:"password" required:"true"`
}

type adminUnlockInput struct {
	Body adminUnlockRequest
}

func (handler *AdminHandler) unlock(ctx context.Context, input *adminUnlockInput) (*struct{}, error) {
	caller, ok := userFromContext(ctx)
	if !ok {
		return nil, toHumaError(handler.log, &badRequestError{msg: "authentication required"})
	}
	if err := handler.accounts.Unlock(ctx, caller.ID, input.Body.Password); err != nil {
		if errors.Is(err, adminaccount.ErrInvalidCredentials) {
			return nil, adminFailure(http.StatusUnauthorized, adminError{Code: "INVALID_PASSWORD", Message: "password is incorrect"})
		}
		return nil, toHumaError(handler.log, err)
	}
	return &struct{}{}, nil
}

// ------------------------------------------------------------------- mapping

// adminAuthError translates the account service's errors into the contract's DESIGNED
// failure bodies; anything undesigned falls through to the shared classify() path.
func (handler *AdminHandler) adminAuthError(err error) error {
	var locked *adminaccount.LockedError
	var invalidOtp *adminaccount.InvalidOtpError
	var deviceLimit *adminaccount.DeviceLimitError
	var resendLimited *adminaccount.ResendLimitedError

	switch {
	case errors.Is(err, adminaccount.ErrInvalidCredentials):
		return adminFailure(http.StatusUnauthorized, invalidCredentialsError{Error: "INVALID_CREDENTIALS"})
	case errors.Is(err, adminaccount.ErrAccountDisabled):
		return adminFailure(http.StatusForbidden, accountDisabledError{Error: "ACCOUNT_DISABLED"})
	case errors.As(err, &locked):
		return adminFailure(http.StatusLocked, accountLockedError{
			Error:      "ACCOUNT_LOCKED",
			RetryAfter: int32((locked.RetryAfter + time.Second - 1) / time.Second),
		})
	case errors.Is(err, adminaccount.ErrOtpAttemptsExhausted):
		// The challenge is burned; the operator restarts from login now, so there is no
		// countdown to serve.
		return adminFailure(http.StatusLocked, accountLockedError{Error: "ACCOUNT_LOCKED", RetryAfter: 0})
	case errors.Is(err, adminaccount.ErrChallengeExpired):
		return adminFailure(http.StatusGone, otpExpiredError{Error: "OTP_EXPIRED"})
	case errors.As(err, &invalidOtp):
		return adminFailure(http.StatusBadRequest, invalidOtpError{
			Error:             "INVALID_OTP",
			AttemptsRemaining: invalidOtp.AttemptsRemaining,
		})
	case errors.As(err, &deviceLimit):
		return adminFailure(http.StatusConflict, deviceLimitError{
			Error:   "DEVICE_LIMIT_REACHED",
			Devices: authDevicesDTO(deviceLimit.Devices),
		})
	case errors.As(err, &resendLimited):
		return adminFailure(http.StatusTooManyRequests, rateLimitedError{
			Code:    "RATE_LIMITED",
			Message: "too many codes requested",
			ResetAt: resendLimited.ResetAt,
		})
	default:
		return toHumaError(handler.log, err)
	}
}

// adminSessionOf mints the bearer through the one existing Signer — RoleAdmin, nothing
// bespoke — and shapes the session the console stores. Permissions is nil on purpose: a
// JSON null means full access, the v1 single-role behaviour (an empty array would lock the
// console).
func (handler *AdminHandler) adminSessionOf(account adminaccount.Account) (adminSession, error) {
	token, err := handler.signer.Issue(auth.AuthedUser{ID: account.UserID, Role: identity.RoleAdmin})
	if err != nil {
		return adminSession{}, err
	}
	return adminSession{
		Token:       token,
		Permissions: nil,
		User: adminSessionUser{
			ID:    account.UserID.String(),
			Email: account.Email,
			Name:  account.DisplayName,
			Role:  identity.RoleAdmin.String(),
		},
	}, nil
}

// deliverAdminOTP mirrors AuthHandler's delivery discipline: SMS in production (fatal if
// it fails — the operator cannot get the code any other way), skipped for the reserved
// demo number, and log-echoed in dev. The code NEVER rides an HTTP response. An empty code
// means the engine's resend guard kept the previously delivered one live — nothing to send.
func (handler *AdminHandler) deliverAdminOTP(ctx context.Context, phone, code string) error {
	if code == "" {
		return nil
	}
	if handler.otpSender != nil && !handler.accounts.IsDemoPhone(phone) {
		if err := handler.otpSender.SendOTP(ctx, phone, code); err != nil {
			handler.log.Error("sending admin login otp", "err", err)
			if !handler.devEchoOTP {
				return huma.Error502BadGateway("could not send the verification code; please try again")
			}
		}
	}
	if handler.devEchoOTP {
		handler.log.Info("DEV admin otp issued", "phone", phone, "code", code)
	}
	return nil
}

func challengeDTO(challenge adminaccount.Challenge) otpChallenge {
	return otpChallenge{
		ChallengeID:       challenge.ID.String(),
		MaskedMobile:      challenge.MaskedMobile,
		ExpiresInSeconds:  challenge.ExpiresInSeconds,
		ResendInSeconds:   challenge.ResendInSeconds,
		AttemptsRemaining: challenge.AttemptsRemaining,
	}
}

func authDevicesDTO(devices []adminaccount.Device) []authTrustedDevice {
	items := make([]authTrustedDevice, 0, len(devices))
	for _, device := range devices {
		items = append(items, authTrustedDevice{
			ID:         device.ID.String(),
			Name:       device.Name,
			Type:       wireDeviceType(device.Type),
			LastUsedAt: device.LastUsedAt,
			Location:   device.Location,
		})
	}
	return items
}

// wireDeviceType maps the stored UPPER_SNAKE vocabulary to the contract's lowercase one.
func wireDeviceType(domainType adminaccount.DeviceType) deviceType {
	switch domainType {
	case adminaccount.DevicePhone:
		return deviceTypePhone
	case adminaccount.DeviceTablet:
		return deviceTypeTablet
	case adminaccount.DeviceDesktop:
		return deviceTypeDesktop
	}
	return deviceTypeDesktop
}
