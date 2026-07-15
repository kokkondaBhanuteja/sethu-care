package httpapi

import (
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

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
	signer       *auth.Signer
	log          *slog.Logger
}

func NewPhotoHandler(verifier *verification.Service, cloudinary *media.Cloudinary, signer *auth.Signer, log *slog.Logger) *PhotoHandler {
	return &PhotoHandler{verification: verifier, cloudinary: cloudinary, signer: signer, log: log}
}

func (handler *PhotoHandler) Register(mux *http.ServeMux) {
	// The assigned technician mints an upload signature, then records the uploaded result.
	mux.Handle("POST /bookings/{id}/photos/signature",
		handler.signer.RequireAuth(auth.RequireRole(identity.RoleTechnician, http.HandlerFunc(handler.sign))))
	mux.Handle("POST /bookings/{id}/photos",
		handler.signer.RequireAuth(auth.RequireRole(identity.RoleTechnician, http.HandlerFunc(handler.record))))
	// The booking's customer, its technician, or an admin may view the evidence.
	mux.Handle("GET /bookings/{id}/photos",
		handler.signer.RequireAuth(http.HandlerFunc(handler.list)))
}

type signatureResponse struct {
	CloudName string `json:"cloud_name"`
	APIKey    string `json:"api_key"`
	Timestamp int64  `json:"timestamp"`
	Folder    string `json:"folder"`
	Signature string `json:"signature"`
}

// sign mints the parameters the client needs for a Cloudinary signed upload, scoped to a folder
// for this booking. Only the assigned technician may request one.
func (handler *PhotoHandler) sign(writer http.ResponseWriter, request *http.Request) {
	bookingID, err := pathUUID(request, "id")
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}
	caller, ok := auth.UserFrom(request.Context())
	if !ok {
		writeError(writer, handler.log, &badRequestError{msg: "authentication required"})
		return
	}
	if !handler.cloudinary.Configured() {
		writeJSON(writer, http.StatusServiceUnavailable, map[string]string{"error": "photo uploads are not configured"})
		return
	}

	parties, err := handler.verification.BookingParties(request.Context(), bookingID)
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}
	if parties.TechnicianID == nil || *parties.TechnicianID != caller.ID {
		writeError(writer, handler.log, &forbiddenError{msg: "only the assigned technician may upload photos for this booking"})
		return
	}

	timestamp := time.Now().Unix()
	folder := "sethu-care/bookings/" + bookingID.String()
	signature := handler.cloudinary.Sign(map[string]string{
		"folder":    folder,
		"timestamp": strconv.FormatInt(timestamp, 10),
	})
	writeJSON(writer, http.StatusOK, signatureResponse{
		CloudName: handler.cloudinary.CloudName(),
		APIKey:    handler.cloudinary.APIKey(),
		Timestamp: timestamp,
		Folder:    folder,
		Signature: signature,
	})
}

type recordRequest struct {
	Kind      string `json:"kind"`
	PublicID  string `json:"public_id"`
	Version   string `json:"version"`
	Signature string `json:"signature"`
	SecureURL string `json:"secure_url"`
}

// record stores an uploaded photo AFTER verifying it really came from a Cloudinary upload to our
// account — the returned signature must check out, and the URL must be one of ours and name the
// signed public_id. This is what stops a technician from pasting an arbitrary URL.
func (handler *PhotoHandler) record(writer http.ResponseWriter, request *http.Request) {
	bookingID, err := pathUUID(request, "id")
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}
	caller, ok := auth.UserFrom(request.Context())
	if !ok {
		writeError(writer, handler.log, &badRequestError{msg: "authentication required"})
		return
	}
	var req recordRequest
	if err := decodeJSON(writer, request, &req); err != nil {
		writeError(writer, handler.log, err)
		return
	}

	kind, err := verification.ParseWorkPhotoKind(req.Kind)
	if err != nil {
		writeError(writer, handler.log, &badRequestError{msg: "kind must be BEFORE or AFTER"})
		return
	}
	if !handler.cloudinary.VerifyUpload(req.PublicID, req.Version, req.Signature) {
		writeError(writer, handler.log, &badRequestError{msg: "could not verify the upload signature"})
		return
	}
	// The signature covers public_id/version, not the whole URL — so also require the URL to be
	// one of ours and to name the signed public_id, closing the gap between the two.
	expectedHost := "https://res.cloudinary.com/" + handler.cloudinary.CloudName() + "/"
	if !strings.HasPrefix(req.SecureURL, expectedHost) || !strings.Contains(req.SecureURL, req.PublicID) {
		writeError(writer, handler.log, &badRequestError{msg: "secure_url does not match the signed upload"})
		return
	}

	if err := handler.verification.SaveWorkPhoto(request.Context(), bookingID, caller.ID, kind, req.SecureURL); err != nil {
		writeError(writer, handler.log, err)
		return
	}
	writeJSON(writer, http.StatusCreated, map[string]any{"status": "recorded", "kind": kind.String()})
}

type photoResponse struct {
	ID        string `json:"id"`
	Kind      string `json:"kind"`
	URL       string `json:"url"`
	CreatedAt string `json:"created_at"`
}

func (handler *PhotoHandler) list(writer http.ResponseWriter, request *http.Request) {
	bookingID, err := pathUUID(request, "id")
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}
	caller, ok := auth.UserFrom(request.Context())
	if !ok {
		writeError(writer, handler.log, &badRequestError{msg: "authentication required"})
		return
	}

	parties, err := handler.verification.BookingParties(request.Context(), bookingID)
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}
	if !mayViewBooking(caller, parties) {
		writeError(writer, handler.log, &forbiddenError{msg: "these photos are not yours to view"})
		return
	}

	photos, err := handler.verification.ListWorkPhotos(request.Context(), bookingID)
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}
	payload := make([]photoResponse, len(photos))
	for index, photo := range photos {
		payload[index] = photoResponse{
			ID:        photo.ID.String(),
			Kind:      photo.Kind.String(),
			URL:       photo.URL,
			CreatedAt: photo.CreatedAt.Format(time.RFC3339),
		}
	}
	writeJSON(writer, http.StatusOK, map[string]any{"photos": payload})
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
