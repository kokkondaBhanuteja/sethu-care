package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/verification"
)

// LocationHandler serves live technician tracking: a technician pings their location while
// travelling, and the booking's customer reads it to watch them approach on the map.
type LocationHandler struct {
	identity     *identity.Service
	verification *verification.Service
	log          *slog.Logger
}

func NewLocationHandler(identityService *identity.Service, verifier *verification.Service, log *slog.Logger) *LocationHandler {
	return &LocationHandler{identity: identityService, verification: verifier, log: log}
}

func (handler *LocationHandler) RegisterHuma(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "updateLocation", Method: http.MethodPost, Path: "/me/location",
		Summary: "Update my current location", Tags: []string{"Location"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleTechnician),
	}, handler.update)
	huma.Register(api, huma.Operation{
		OperationID: "technicianLocation", Method: http.MethodGet, Path: "/bookings/{id}/technician-location",
		Summary: "Get the assigned technician's live location", Tags: []string{"Location"},
		Security: bearerSecurity(),
	}, handler.forBooking)
}

type locationRequest struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

type updateLocationInput struct {
	Body locationRequest
}

type updateLocationOutput struct {
	Body struct {
		Status string `json:"status"`
	}
}

// update records the caller technician's live location. The technician is the authenticated caller,
// so one cannot post another's location.
func (handler *LocationHandler) update(ctx context.Context, input *updateLocationInput) (*updateLocationOutput, error) {
	caller, ok := userFromContext(ctx)
	if !ok {
		return nil, toHumaError(handler.log, &badRequestError{msg: "authentication required"})
	}
	if err := handler.identity.UpdateTechnicianLocation(ctx, caller.ID, input.Body.Lat, input.Body.Lng); err != nil {
		return nil, toHumaError(handler.log, err)
	}
	out := &updateLocationOutput{}
	out.Body.Status = "updated"
	return out, nil
}

type technicianLocationResponse struct {
	Available bool    `json:"available"`
	Lat       float64 `json:"lat,omitempty"`
	Lng       float64 `json:"lng,omitempty"`
	UpdatedAt string  `json:"updated_at,omitempty"`
}

type technicianLocationOutput struct {
	Body technicianLocationResponse
}

// forBooking returns the assigned technician's live location for a booking. Visible to the booking's
// own customer, its assigned technician, or an admin (the same rule as the work photos).
func (handler *LocationHandler) forBooking(ctx context.Context, input *bookingIDInput) (*technicianLocationOutput, error) {
	bookingID, err := parseUUID(input.ID, "id")
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	caller, ok := userFromContext(ctx)
	if !ok {
		return nil, toHumaError(handler.log, &badRequestError{msg: "authentication required"})
	}
	parties, err := handler.verification.BookingParties(ctx, bookingID)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	if !mayViewBooking(caller, parties) {
		return nil, toHumaError(handler.log, &forbiddenError{msg: "this booking is not yours to view"})
	}

	location, err := handler.identity.TechnicianLocationForBooking(ctx, bookingID)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	response := technicianLocationResponse{Available: location.Found}
	if location.Found {
		response.Lat = location.Lat
		response.Lng = location.Lng
		response.UpdatedAt = location.At.Format(time.RFC3339)
	}
	return &technicianLocationOutput{Body: response}, nil
}
