package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/kokkondaBhanuteja/sethu-care/internal/auth"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/media"
	"github.com/kokkondaBhanuteja/sethu-care/internal/verification"
)

// PhotoHandler serves work-photo evidence via Cloudinary signed direct uploads. The technician's
// app asks us to sign an upload, uploads the file straight to Cloudinary, then hands us back the
// signed result to store — the bytes never pass through this server.
type PhotoHandler struct {
	verification *verification.Service
	cloudinary   *media.Cloudinary
	log          *slog.Logger
}

func NewPhotoHandler(verifier *verification.Service, cloudinary *media.Cloudinary, log *slog.Logger) *PhotoHandler {
	return &PhotoHandler{verification: verifier, cloudinary: cloudinary, log: log}
}

func (handler *PhotoHandler) RegisterHuma(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "signPhotoUpload", Method: http.MethodPost, Path: "/bookings/{id}/photos/signature",
		Summary: "Sign a work-photo upload", Tags: []string{"Photos"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleTechnician),
	}, handler.sign)
	huma.Register(api, huma.Operation{
		OperationID: "recordPhoto", Method: http.MethodPost, Path: "/bookings/{id}/photos",
		Summary: "Record an uploaded work photo", Tags: []string{"Photos"}, DefaultStatus: http.StatusCreated,
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleTechnician),
	}, handler.record)
	huma.Register(api, huma.Operation{
		OperationID: "listPhotos", Method: http.MethodGet, Path: "/bookings/{id}/photos",
		Summary: "List a booking's work photos", Tags: []string{"Photos"},
		Security: bearerSecurity(),
	}, handler.list)
}

type signatureResponse struct {
	CloudName string `json:"cloud_name"`
	APIKey    string `json:"api_key"`
	Timestamp int64  `json:"timestamp"`
	Folder    string `json:"folder"`
	Signature string `json:"signature"`
}

type signPhotoInput struct {
	ID string `path:"id" format:"uuid" doc:"Booking id"`
}

type signPhotoOutput struct {
	Body signatureResponse
}

// sign mints the parameters the client needs for a Cloudinary signed upload, scoped to a folder
// for this booking. Only the assigned technician may request one.
func (handler *PhotoHandler) sign(ctx context.Context, input *signPhotoInput) (*signPhotoOutput, error) {
	bookingID, err := parseUUID(input.ID, "id")
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	caller, ok := userFromContext(ctx)
	if !ok {
		return nil, toHumaError(handler.log, &badRequestError{msg: "authentication required"})
	}
	if !handler.cloudinary.Configured() {
		return nil, huma.Error503ServiceUnavailable("photo uploads are not configured")
	}
	parties, err := handler.verification.BookingParties(ctx, bookingID)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	if parties.TechnicianID == nil || *parties.TechnicianID != caller.ID {
		return nil, toHumaError(handler.log, &forbiddenError{msg: "only the assigned technician may upload photos for this booking"})
	}

	timestamp := time.Now().Unix()
	folder := "sethu-care/bookings/" + bookingID.String()
	signature := handler.cloudinary.Sign(map[string]string{
		"folder":    folder,
		"timestamp": strconv.FormatInt(timestamp, 10),
	})
	return &signPhotoOutput{Body: signatureResponse{
		CloudName: handler.cloudinary.CloudName(),
		APIKey:    handler.cloudinary.APIKey(),
		Timestamp: timestamp,
		Folder:    folder,
		Signature: signature,
	}}, nil
}

type recordRequest struct {
	Kind      string `json:"kind"`
	PublicID  string `json:"public_id"`
	Version   string `json:"version"`
	Signature string `json:"signature"`
	SecureURL string `json:"secure_url"`
}

type recordPhotoInput struct {
	ID   string `path:"id" format:"uuid" doc:"Booking id"`
	Body recordRequest
}

type recordPhotoOutput struct {
	Body struct {
		Status string `json:"status"`
		Kind   string `json:"kind"`
	}
}

// record stores an uploaded photo AFTER verifying it really came from a Cloudinary upload to our
// account — the returned signature must check out, and the URL must be one of ours and name the
// signed public_id. This is what stops a technician from pasting an arbitrary URL.
func (handler *PhotoHandler) record(ctx context.Context, input *recordPhotoInput) (*recordPhotoOutput, error) {
	bookingID, err := parseUUID(input.ID, "id")
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	caller, ok := userFromContext(ctx)
	if !ok {
		return nil, toHumaError(handler.log, &badRequestError{msg: "authentication required"})
	}
	kind, err := verification.ParseWorkPhotoKind(input.Body.Kind)
	if err != nil {
		return nil, toHumaError(handler.log, &badRequestError{msg: "kind must be BEFORE or AFTER"})
	}
	if !handler.cloudinary.VerifyUpload(input.Body.PublicID, input.Body.Version, input.Body.Signature) {
		return nil, toHumaError(handler.log, &badRequestError{msg: "could not verify the upload signature"})
	}
	// The signature covers public_id/version, not the whole URL — so also require the URL to be
	// one of ours and to name the signed public_id, closing the gap between the two.
	expectedHost := "https://res.cloudinary.com/" + handler.cloudinary.CloudName() + "/"
	if !strings.HasPrefix(input.Body.SecureURL, expectedHost) || !strings.Contains(input.Body.SecureURL, input.Body.PublicID) {
		return nil, toHumaError(handler.log, &badRequestError{msg: "secure_url does not match the signed upload"})
	}
	if err := handler.verification.SaveWorkPhoto(ctx, bookingID, caller.ID, kind, input.Body.SecureURL); err != nil {
		return nil, toHumaError(handler.log, err)
	}
	out := &recordPhotoOutput{}
	out.Body.Status = "recorded"
	out.Body.Kind = kind.String()
	return out, nil
}

type photoResponse struct {
	ID        string `json:"id"`
	Kind      string `json:"kind"`
	URL       string `json:"url"`
	CreatedAt string `json:"created_at"`
}

type listPhotosInput struct {
	ID string `path:"id" format:"uuid" doc:"Booking id"`
}

type listPhotosOutput struct {
	Body struct {
		Photos []photoResponse `json:"photos"`
	}
}

func (handler *PhotoHandler) list(ctx context.Context, input *listPhotosInput) (*listPhotosOutput, error) {
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
		return nil, toHumaError(handler.log, &forbiddenError{msg: "these photos are not yours to view"})
	}
	photos, err := handler.verification.ListWorkPhotos(ctx, bookingID)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	out := &listPhotosOutput{}
	out.Body.Photos = make([]photoResponse, len(photos))
	for index, photo := range photos {
		out.Body.Photos[index] = photoResponse{
			ID:        photo.ID.String(),
			Kind:      photo.Kind.String(),
			URL:       photo.URL,
			CreatedAt: photo.CreatedAt.Format(time.RFC3339),
		}
	}
	return out, nil
}

// mayViewBooking allows the booking's own customer, its assigned technician, or an admin.
func mayViewBooking(caller auth.AuthedUser, parties verification.Parties) bool {
	switch caller.Role {
	case identity.RoleAdmin:
		return true
	case identity.RoleCustomer:
		return caller.ID == parties.CustomerID
	case identity.RoleTechnician:
		return parties.TechnicianID != nil && caller.ID == *parties.TechnicianID
	default:
		return false
	}
}
