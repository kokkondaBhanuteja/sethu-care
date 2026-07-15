// Package reviews owns customer reviews of a completed job. A review publishes
// review.submitted, which Identity consumes to update the technician's rating (ROADMAP §8) —
// so feedback flows back into the dispatch ranking without reviews touching the technician.
package reviews

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/kokkondaBhanuteja/sethu-care/internal/storage"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrBookingNotFound = errors.New("reviews: booking not found")
	// ErrNotYourBooking — a customer may only review their own booking (a 403).
	ErrNotYourBooking = errors.New("reviews: not your booking")
	// ErrNotReviewable — the booking is not COMPLETED, so there is nothing to review yet (422).
	ErrNotReviewable = errors.New("reviews: booking is not completed")
	// ErrAlreadyReviewed — one review per booking (409).
	ErrAlreadyReviewed = errors.New("reviews: booking has already been reviewed")
	// ErrInvalidRating — rating must be 1..5 (400).
	ErrInvalidRating = errors.New("reviews: rating must be between 1 and 5")
)

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

// Submit records a customer's review of a completed booking and publishes review.submitted in
// the SAME transaction — the review and its event land together or not at all.
func (service *Service) Submit(ctx context.Context, bookingID, customerID uuid.UUID, rating int32, comment string) error {
	if rating < 1 || rating > 5 {
		return ErrInvalidRating
	}

	return storage.InTx(ctx, service.pool, func(tx pgx.Tx) error {
		queries := sqlcgen.New(tx)

		booking, err := queries.GetBooking(ctx, bookingID)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrBookingNotFound
		}
		if err != nil {
			return fmt.Errorf("reading booking: %w", err)
		}
		if booking.CustomerID != customerID {
			return ErrNotYourBooking
		}
		if booking.State != "COMPLETED" {
			return ErrNotReviewable
		}
		if booking.TechnicianID == nil {
			// A completed booking always has a technician; this would be corrupt data.
			return ErrNotReviewable
		}

		reviewID, err := queries.InsertReview(ctx, sqlcgen.InsertReviewParams{
			BookingID:    bookingID,
			CustomerID:   customerID,
			TechnicianID: *booking.TechnicianID,
			Rating:       rating,
			Comment:      comment,
		})
		if storage.IsSQLState(err, storage.SQLStateUniqueViolation) {
			return ErrAlreadyReviewed
		}
		if err != nil {
			return fmt.Errorf("inserting review: %w", err)
		}

		payload, err := json.Marshal(submittedEvent{
			ReviewID:     reviewID,
			BookingID:    bookingID,
			TechnicianID: *booking.TechnicianID,
			Rating:       rating,
		})
		if err != nil {
			return fmt.Errorf("marshalling review.submitted: %w", err)
		}
		if err := queries.InsertOutboxEvent(ctx, sqlcgen.InsertOutboxEventParams{
			AggregateType: "review",
			AggregateID:   reviewID,
			EventType:     "review.submitted",
			Payload:       payload,
		}); err != nil {
			return fmt.Errorf("writing review.submitted: %w", err)
		}
		return nil
	})
}

type submittedEvent struct {
	ReviewID     uuid.UUID `json:"review_id"`
	BookingID    uuid.UUID `json:"booking_id"`
	TechnicianID uuid.UUID `json:"technician_id"`
	Rating       int32     `json:"rating"`
}
