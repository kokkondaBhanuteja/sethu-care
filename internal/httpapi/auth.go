package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"regexp"

	"github.com/kokkondaBhanuteja/sethu-care/internal/auth"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
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

func NewAuthHandler(id *identity.Service, signer *auth.Signer, log *slog.Logger, devEcho bool) *AuthHandler {
	return &AuthHandler{identity: id, signer: signer, log: log, devEcho: devEcho}
}

func (h *AuthHandler) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /auth/otp", h.requestOTP)
	mux.HandleFunc("POST /auth/verify", h.verifyOTP)
}

type otpRequest struct {
	Phone string `json:"phone"`
}

type otpResponse struct {
	Sent bool `json:"sent"`
	// DevCode is populated ONLY when devEcho is on. omitempty keeps it out of prod responses.
	DevCode string `json:"dev_code,omitempty"`
}

func (h *AuthHandler) requestOTP(w http.ResponseWriter, r *http.Request) {
	var req otpRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, h.log, err)
		return
	}
	if !e164ish.MatchString(req.Phone) {
		writeError(w, h.log, &badRequestError{msg: "phone must be E.164, e.g. +919000000001"})
		return
	}

	code, err := h.identity.RequestOTP(r.Context(), req.Phone)
	if err != nil {
		writeError(w, h.log, err)
		return
	}

	// In dev, make the code reachable without an SMS provider. Never in production.
	resp := otpResponse{Sent: true}
	if h.devEcho {
		h.log.Info("DEV otp issued", "phone", req.Phone, "code", code)
		resp.DevCode = code
	}
	writeJSON(w, http.StatusOK, resp)
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

func (h *AuthHandler) verifyOTP(w http.ResponseWriter, r *http.Request) {
	var req verifyRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, h.log, err)
		return
	}

	user, err := h.identity.VerifyOTP(r.Context(), req.Phone, req.Code)
	if err != nil {
		writeError(w, h.log, err)
		return
	}

	token, err := h.signer.Issue(auth.AuthedUser{ID: user.ID, Role: user.Role})
	if err != nil {
		writeError(w, h.log, err)
		return
	}

	writeJSON(w, http.StatusOK, verifyResponse{Token: token, Role: user.Role.String(), Name: user.Name})
}

// classifyAuth maps identity/auth errors to status codes. It is called from the shared
// writeError via classifyExtra so all error mapping stays in one path.
func classifyAuth(err error) (int, string, bool) {
	switch {
	case errors.Is(err, identity.ErrOtpRateLimited):
		return http.StatusTooManyRequests, err.Error(), true
	case errors.Is(err, identity.ErrOtpInvalid),
		errors.Is(err, identity.ErrOtpTooManyAttempts):
		return http.StatusUnauthorized, err.Error(), true
	default:
		return 0, "", false
	}
}
