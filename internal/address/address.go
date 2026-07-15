// Package address owns customer addresses, including the PostGIS point that dispatch will
// later measure distance against.
package address

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/storage"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"
)

// ErrInvalidCoordinates rejects points outside the valid lat/lng range before they reach the
// database.
var ErrInvalidCoordinates = errors.New("address: latitude must be [-90,90] and longitude [-180,180]")

// Address is a saved location for a customer.
type Address struct {
	ID        uuid.UUID
	Label     string
	Line1     string
	Line2     string
	City      string
	Pincode   string
	Lat       float64
	Lng       float64
	IsDefault bool
}

type Service struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

// NewAddress is a request to save an address. Lat/Lng come from the customer app's device
// GPS; text-to-coordinates geocoding is a later slice (ROADMAP's Geocoder port).
type NewAddress struct {
	UserID    uuid.UUID
	Label     string
	Line1     string
	Line2     string
	City      string
	Pincode   string
	Lat       float64
	Lng       float64
	IsDefault bool
}

// Create saves an address. The FIRST address a customer saves becomes their default
// automatically; otherwise IsDefault is honoured. Setting a new default clears the old one in
// the SAME transaction, so the partial unique index (one default per user) is never violated.
func (service *Service) Create(ctx context.Context, in NewAddress) (Address, error) {
	if in.Lat < -90 || in.Lat > 90 || in.Lng < -180 || in.Lng > 180 {
		return Address{}, ErrInvalidCoordinates
	}

	var out Address
	err := storage.InTx(ctx, service.pool, func(tx pgx.Tx) error {
		q := sqlcgen.New(tx)

		count, err := q.CountAddressesByUser(ctx, in.UserID)
		if err != nil {
			return fmt.Errorf("counting addresses: %w", err)
		}
		makeDefault := in.IsDefault || count == 0

		if makeDefault {
			if err := q.ClearDefaultAddresses(ctx, in.UserID); err != nil {
				return fmt.Errorf("clearing default: %w", err)
			}
		}

		row, err := q.CreateAddress(ctx, sqlcgen.CreateAddressParams{
			UserID:    in.UserID,
			Label:     in.Label,
			Line1:     in.Line1,
			Line2:     in.Line2,
			City:      in.City,
			Pincode:   in.Pincode,
			Lng:       in.Lng,
			Lat:       in.Lat,
			IsDefault: makeDefault,
		})
		if storage.IsSQLState(err, storage.SQLStateCheckViolation) {
			return fmt.Errorf("%w: pincode must be a valid 6-digit Indian PIN", ErrInvalidAddress)
		}
		if err != nil {
			return fmt.Errorf("inserting address: %w", err)
		}

		out = Address{
			ID: row.ID, Label: row.Label, Line1: row.Line1, Line2: row.Line2,
			City: row.City, Pincode: row.Pincode, Lat: in.Lat, Lng: in.Lng, IsDefault: row.IsDefault,
		}
		return nil
	})
	if err != nil {
		return Address{}, err
	}
	return out, nil
}

// ErrInvalidAddress is a validation failure the database caught (e.g. the pincode CHECK).
var ErrInvalidAddress = errors.New("address: invalid")

// List returns a customer's addresses, default first.
func (service *Service) List(ctx context.Context, userID uuid.UUID) ([]Address, error) {
	rows, err := sqlcgen.New(service.pool).ListAddressesByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("listing addresses: %w", err)
	}
	out := make([]Address, len(rows))
	for i, r := range rows {
		out[i] = Address{
			ID: r.ID, Label: r.Label, Line1: r.Line1, Line2: r.Line2,
			City: r.City, Pincode: r.Pincode, Lat: r.Lat, Lng: r.Lng, IsDefault: r.IsDefault,
		}
	}
	return out, nil
}
