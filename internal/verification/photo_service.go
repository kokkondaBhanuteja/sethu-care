package verification

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"
)

var (
	// ErrBookingNotFound — the booking a photo is being attached to (or read for) does not exist.
	ErrBookingNotFound = errors.New("verification: booking not found")
	// ErrNotAssignedTechnician — only the technician assigned to a booking may upload its photos.
	ErrNotAssignedTechnician = errors.New("verification: only the assigned technician may upload photos for this booking")
)

// Parties are the users attached to a booking, for authorizing who may see its photos.
type Parties struct {
	CustomerID   uuid.UUID
	TechnicianID *uuid.UUID
}

// BookingParties returns the customer and (if assigned) technician on a booking.
func (service *Service) BookingParties(ctx context.Context, bookingID uuid.UUID) (Parties, error) {
	booking, err := sqlcgen.New(service.pool).GetBooking(ctx, bookingID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Parties{}, ErrBookingNotFound
	}
	if err != nil {
		return Parties{}, fmt.Errorf("reading booking: %w", err)
	}
	return Parties{CustomerID: booking.CustomerID, TechnicianID: booking.TechnicianID}, nil
}

// SaveWorkPhoto records a work photo (already uploaded to the CDN) against a booking. Only the
// booking's ASSIGNED technician may add photos — they are that technician's evidence of the job.
func (service *Service) SaveWorkPhoto(ctx context.Context, bookingID, uploaderID uuid.UUID, kind WorkPhotoKind, url string) error {
	if !kind.Valid() {
		return fmt.Errorf("verification: invalid work photo kind %q", kind)
	}
	queries := sqlcgen.New(service.pool)

	booking, err := queries.GetBooking(ctx, bookingID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrBookingNotFound
	}
	if err != nil {
		return fmt.Errorf("reading booking: %w", err)
	}
	if booking.TechnicianID == nil || *booking.TechnicianID != uploaderID {
		return ErrNotAssignedTechnician
	}

	if err := queries.InsertWorkPhoto(ctx, sqlcgen.InsertWorkPhotoParams{
		BookingID:  bookingID,
		UploadedBy: uploaderID,
		Kind:       string(kind),
		Url:        url,
	}); err != nil {
		return fmt.Errorf("recording work photo: %w", err)
	}
	return nil
}

// WorkPhoto is one stored photo, for the list view.
type WorkPhoto struct {
	ID        uuid.UUID
	Kind      WorkPhotoKind
	URL       string
	CreatedAt time.Time
}

// ListWorkPhotos returns every photo attached to a booking (BEFORE then AFTER, oldest first).
func (service *Service) ListWorkPhotos(ctx context.Context, bookingID uuid.UUID) ([]WorkPhoto, error) {
	rows, err := sqlcgen.New(service.pool).ListWorkPhotosForBooking(ctx, bookingID)
	if err != nil {
		return nil, fmt.Errorf("listing work photos: %w", err)
	}
	photos := make([]WorkPhoto, len(rows))
	for index, row := range rows {
		photos[index] = WorkPhoto{
			ID:        row.ID,
			Kind:      WorkPhotoKind(row.Kind),
			URL:       row.Url,
			CreatedAt: row.CreatedAt.Time,
		}
	}
	return photos, nil
}
