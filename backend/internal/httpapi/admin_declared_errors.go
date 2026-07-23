package httpapi

import (
	"encoding/json"
	"fmt"
)

// adminDeclaredError carries one of the admin contract's DESIGNED failure bodies — the
// responses the console renders a dedicated screen for (INVALID_CREDENTIALS,
// ACCOUNT_LOCKED, DEVICE_LIMIT_REACHED, …). huma serializes a returned StatusError value
// itself, so implementing MarshalJSON as "exactly the declared body" makes the wire shape
// match the contract byte for byte. Everything that is NOT a designed failure keeps going
// through classify()/toHumaError like the rest of the transport layer.
type adminDeclaredError struct {
	status int
	body   any
}

// adminFailure wraps a declared failure body with its declared status.
func adminFailure(status int, body any) error {
	return &adminDeclaredError{status: status, body: body}
}

// Error satisfies the error interface; the body carries the real signal.
func (declared *adminDeclaredError) Error() string {
	return fmt.Sprintf("admin contract failure (%d)", declared.status)
}

// GetStatus makes this a huma.StatusError, so huma uses the declared status.
func (declared *adminDeclaredError) GetStatus() int { return declared.status }

// MarshalJSON writes the declared body — not this wrapper — as the response.
func (declared *adminDeclaredError) MarshalJSON() ([]byte, error) {
	return json.Marshal(declared.body)
}
