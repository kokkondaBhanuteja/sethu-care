package httpapi

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
)

// badRequestError is a 400 raised by the transport layer itself — bad JSON, a non-uuid path,
// an unknown action. Domain errors are mapped separately, below.
type badRequestError struct{ msg string }

func (e *badRequestError) Error() string { return e.msg }

// writeError is the ONE place domain errors become HTTP status codes. Centralising it means
// a new error type is mapped once, here, rather than in every handler — and no handler can
// accidentally leak an internal error's text to the client.
//
// GO LESSON — errors.As walks the wrapped-error chain, so this works even though the service
// wraps its errors with fmt.Errorf("...: %w", err) on the way up.
func writeError(w http.ResponseWriter, log *slog.Logger, err error) {
	status, message := classify(err)

	// 5xx means WE broke. Log the real error server-side, but never send its text to the
	// client — it can leak SQL, table names, internal structure.
	if status >= 500 {
		log.Error("request failed", "err", err)
		message = "internal error"
	}

	writeJSON(w, status, map[string]string{"error": message})
}

func classify(err error) (int, string) {
	var conflict *booking.ConflictError
	var illegal *booking.IllegalTransitionError
	var badReq *badRequestError

	switch {
	case errors.Is(err, booking.ErrBookingNotFound),
		errors.Is(err, booking.ErrVariantNotFound):
		return http.StatusNotFound, err.Error()

	case errors.As(err, &conflict):
		// Someone moved the booking between the read and the write. Retriable.
		return http.StatusConflict, err.Error()

	case errors.As(err, &illegal):
		// The action is not legal from the booking's current state. The request was
		// well-formed but cannot be applied — 422, not 400.
		return http.StatusUnprocessableEntity, err.Error()

	case errors.Is(err, booking.ErrVariantInactive):
		return http.StatusUnprocessableEntity, err.Error()

	case errors.Is(err, booking.ErrInvalidQuantity),
		errors.As(err, &badReq):
		return http.StatusBadRequest, err.Error()

	default:
		return http.StatusInternalServerError, err.Error()
	}
}
