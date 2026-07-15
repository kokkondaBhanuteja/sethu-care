package httpapi

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/kokkondaBhanuteja/sethu-care/internal/address"
	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
	"github.com/kokkondaBhanuteja/sethu-care/internal/catalog"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ledger"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ops"
	"github.com/kokkondaBhanuteja/sethu-care/internal/reviews"
	"github.com/kokkondaBhanuteja/sethu-care/internal/verification"
)

// badRequestError is a 400 raised by the transport layer itself — bad JSON, a non-uuid path,
// an unknown action. Domain errors are mapped separately, below.
type badRequestError struct{ msg string }

func (badRequest *badRequestError) Error() string { return badRequest.msg }

// forbiddenError is a 403 raised by the transport layer for an authorization rule that depends
// on the request's own data (e.g. this caller is neither the booking's customer nor its
// assigned technician), as opposed to a role gate the middleware already enforces.
type forbiddenError struct{ msg string }

func (forbidden *forbiddenError) Error() string { return forbidden.msg }

// writeError is the ONE place domain errors become HTTP status codes. Centralising it means
// a new error type is mapped once, here, rather than in every handler — and no handler can
// accidentally leak an internal error's text to the client.
//
// GO LESSON — errors.As walks the wrapped-error chain, so this works even though the service
// wraps its errors with fmt.Errorf("...: %w", err) on the way up.
func writeError(writer http.ResponseWriter, log *slog.Logger, err error) {
	status, message := classify(err)

	// 5xx means WE broke. Log the real error server-side, but never send its text to the
	// client — it can leak SQL, table names, internal structure.
	if status >= 500 {
		log.Error("request failed", "err", err)
		message = "internal error"
	}

	writeJSON(writer, status, map[string]string{"error": message})
}

func classify(err error) (int, string) {
	// Identity/auth errors first, via their own mapper, so that package's errors stay with it.
	if status, msg, ok := classifyAuth(err); ok {
		return status, msg
	}

	var conflict *booking.ConflictError
	var illegal *booking.IllegalTransitionError
	var forbidden *booking.ForbiddenError
	var transportForbidden *forbiddenError
	var badReq *badRequestError

	switch {
	case errors.As(err, &forbidden),
		errors.As(err, &transportForbidden),
		errors.Is(err, reviews.ErrNotYourBooking),
		errors.Is(err, ledger.ErrNotYourCustody),
		errors.Is(err, verification.ErrNotAssignedTechnician):
		// The caller is authenticated but not allowed to perform this action on this booking.
		return http.StatusForbidden, err.Error()

	case errors.Is(err, ledger.ErrAlreadyDeposited):
		return http.StatusConflict, err.Error()

	case errors.Is(err, ledger.ErrNoCustody):
		return http.StatusUnprocessableEntity, err.Error()

	case errors.Is(err, ledger.ErrPaymentNotFound):
		return http.StatusNotFound, err.Error()

	case errors.Is(err, reviews.ErrAlreadyReviewed):
		return http.StatusConflict, err.Error()

	case errors.Is(err, reviews.ErrNotReviewable):
		return http.StatusUnprocessableEntity, err.Error()

	case errors.Is(err, reviews.ErrInvalidRating):
		return http.StatusBadRequest, err.Error()

	case errors.Is(err, booking.ErrBookingNotFound),
		errors.Is(err, booking.ErrVariantNotFound),
		errors.Is(err, catalog.ErrServiceNotFound),
		errors.Is(err, catalog.ErrCategoryNotFound),
		errors.Is(err, ops.ErrTechnicianNotFound),
		errors.Is(err, reviews.ErrBookingNotFound),
		errors.Is(err, verification.ErrBookingNotFound):
		return http.StatusNotFound, err.Error()

	case errors.Is(err, address.ErrInvalidCoordinates),
		errors.Is(err, address.ErrInvalidAddress):
		return http.StatusBadRequest, err.Error()

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
