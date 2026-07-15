package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"regexp"

	"github.com/danielgtaylor/huma/v2"

	"github.com/kokkondaBhanuteja/sethu-care/internal/auth"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/verification"
)

// e164ish is a pragmatic phone check: a leading + and 8–15 digits. Full validation belongs
// to the SMS provider; this just rejects obvious junk before we store a challenge.
var e164ish = regexp.MustCompile(`^\+[1-9][0-9]{7,14}$`)

// AuthHandler serves OTP login. devEcho, when true, returns the OTP code in the response and
// logs it — a dev convenience, since there is no SMS provider yet. It MUST be false in
// production, or every login code is handed straight to the caller.
type AuthHandler struct {
	identity *identity.Service
	signer   *auth.Signer
	log      *slog.Logger
	devEcho  bool
}

func NewAuthHandler(identityService *identity.Service, signer *auth.Signer, log *slog.Logger, devEcho bool) *AuthHandler {
	return &AuthHandler{identity: identityService, signer: signer, log: log, devEcho: devEcho}
}

func (handler *AuthHandler) RegisterHuma(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "requestOTP", Method: http.MethodPost, Path: "/auth/otp",
		Summary: "Request a login OTP", Tags: []string{"Auth"},
	}, handler.requestOTP)
	huma.Register(api, huma.Operation{
		OperationID: "verifyOTP", Method: http.MethodPost, Path: "/auth/verify",
		Summary: "Verify a login OTP and receive a token", Tags: []string{"Auth"},
	}, handler.verifyOTP)
	huma.Register(api, huma.Operation{
		OperationID: "deleteAccount", Method: http.MethodDelete, Path: "/me",
		Summary: "Delete my account", Tags: []string{"Auth"}, DefaultStatus: http.StatusNoContent,
		Security: bearerSecurity(),
	}, handler.deleteAccount)
}

// deleteAccountOutput has no body — a 204 No Content on success.
type deleteAccountOutput struct{}

func (handler *AuthHandler) deleteAccount(ctx context.Context, _ *struct{}) (*deleteAccountOutput, error) {
	caller, ok := userFromContext(ctx)
	if !ok {
		return nil, toHumaError(handler.log, &badRequestError{msg: "authentication required"})
	}
	if err := handler.identity.DeleteAccount(ctx, caller.ID); err != nil {
		return nil, toHumaError(handler.log, err)
	}
	return &deleteAccountOutput{}, nil
}

type otpRequest struct {
	Phone string `json:"phone"`
}

type otpResponse struct {
	Sent bool `json:"sent"`
	// DevCode is populated ONLY when devEcho is on. omitempty keeps it out of prod responses.
	DevCode string `json:"dev_code,omitempty"`
}

type requestOTPInput struct {
	Body otpRequest
}

type requestOTPOutput struct {
	Body otpResponse
}

func (handler *AuthHandler) requestOTP(ctx context.Context, input *requestOTPInput) (*requestOTPOutput, error) {
	if !e164ish.MatchString(input.Body.Phone) {
		return nil, toHumaError(handler.log, &badRequestError{msg: "phone must be E.164, e.g. +919000000001"})
	}
	code, err := handler.identity.RequestOTP(ctx, input.Body.Phone)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	// In dev, make the code reachable without an SMS provider. Never in production.
	out := &requestOTPOutput{Body: otpResponse{Sent: true}}
	if handler.devEcho {
		handler.log.Info("DEV otp issued", "phone", input.Body.Phone, "code", code)
		out.Body.DevCode = code
	}
	return out, nil
}

type verifyRequest struct {
	Phone string `json:"phone"`
	Code  string `json:"code"`
}

type verifyResponse struct {
	Token string `json:"token"`
	Role  string `json:"role"`
	Name  string `json:"name"`
}

type verifyOTPInput struct {
	Body verifyRequest
}

type verifyOTPOutput struct {
	Body verifyResponse
}

func (handler *AuthHandler) verifyOTP(ctx context.Context, input *verifyOTPInput) (*verifyOTPOutput, error) {
	user, err := handler.identity.VerifyOTP(ctx, input.Body.Phone, input.Body.Code)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	token, err := handler.signer.Issue(auth.AuthedUser{ID: user.ID, Role: user.Role})
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	return &verifyOTPOutput{Body: verifyResponse{Token: token, Role: user.Role.String(), Name: user.Name}}, nil
}

// classifyAuth maps identity/auth errors to status codes. It is called from the shared
// classify() so all error mapping stays in one path.
func classifyAuth(err error) (int, string, bool) {
	switch {
	case errors.Is(err, identity.ErrOtpRateLimited):
		return http.StatusTooManyRequests, err.Error(), true
	case errors.Is(err, identity.ErrOtpInvalid),
		errors.Is(err, identity.ErrOtpTooManyAttempts),
		errors.Is(err, verification.ErrOtpInvalid),
		errors.Is(err, verification.ErrOtpTooManyAttempts):
		// A bad or exhausted OTP — for login OR for a job's start/completion.
		return http.StatusUnauthorized, err.Error(), true
	default:
		return 0, "", false
	}
}
