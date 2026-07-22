package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

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
	return nil, notImplemented("adminBootstrap")
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

func (handler *AdminHandler) login(_ context.Context, _ *adminLoginInput) (*adminLoginOutput, error) {
	return nil, notImplemented("adminLogin")
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

func (handler *AdminHandler) verifyOTP(_ context.Context, _ *adminVerifyOtpInput) (*adminSessionOutput, error) {
	return nil, notImplemented("adminVerifyOtp")
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

func (handler *AdminHandler) resendOTP(_ context.Context, _ *adminResendOtpInput) (*otpChallengeOutput, error) {
	return nil, notImplemented("adminResendOtp")
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

func (handler *AdminHandler) listDevices(_ context.Context, _ *struct{}) (*authTrustedDeviceListOutput, error) {
	return nil, notImplemented("adminListDevices")
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

func (handler *AdminHandler) revokeDevice(_ context.Context, _ *adminRevokeDeviceInput) (*revokeDeviceOutput, error) {
	return nil, notImplemented("adminRevokeDevice")
}

// ------------------------------------------------------------ session control

type adminLogoutInput struct {
	AdminIdempotency
}

func (handler *AdminHandler) logout(_ context.Context, _ *adminLogoutInput) (*struct{}, error) {
	return nil, notImplemented("adminLogout")
}

func (handler *AdminHandler) refreshSession(_ context.Context, _ *struct{}) (*adminSessionOutput, error) {
	return nil, notImplemented("adminRefreshSession")
}

// adminUnlockRequest re-verifies a locked session (the idle timeout) without a fresh 2FA round.
type adminUnlockRequest struct {
	Password string `json:"password" required:"true"`
}

type adminUnlockInput struct {
	Body adminUnlockRequest
}

func (handler *AdminHandler) unlock(_ context.Context, _ *adminUnlockInput) (*struct{}, error) {
	return nil, notImplemented("adminUnlock")
}
