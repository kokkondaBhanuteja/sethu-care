package httpapi

import (
	"log/slog"
	"net/http"

	"github.com/kokkondaBhanuteja/sethu-care/internal/address"
	"github.com/kokkondaBhanuteja/sethu-care/internal/auth"
)

// AddressHandler serves a customer's own addresses. Every route is authenticated, and the
// owner is always the token holder — a customer can only see and create their own.
type AddressHandler struct {
	addresses *address.Service
	signer    *auth.Signer
	log       *slog.Logger
}

func NewAddressHandler(a *address.Service, signer *auth.Signer, log *slog.Logger) *AddressHandler {
	return &AddressHandler{addresses: a, signer: signer, log: log}
}

func (handler *AddressHandler) Register(mux *http.ServeMux) {
	mux.Handle("POST /addresses", handler.signer.RequireAuth(http.HandlerFunc(handler.create)))
	mux.Handle("GET /addresses", handler.signer.RequireAuth(http.HandlerFunc(handler.list)))
}

type addressResponse struct {
	ID        string  `json:"id"`
	Label     string  `json:"label"`
	Line1     string  `json:"line1"`
	Line2     string  `json:"line2,omitempty"`
	City      string  `json:"city"`
	Pincode   string  `json:"pincode"`
	Lat       float64 `json:"lat"`
	Lng       float64 `json:"lng"`
	IsDefault bool    `json:"is_default"`
}

func toAddress(a address.Address) addressResponse {
	return addressResponse{
		ID: a.ID.String(), Label: a.Label, Line1: a.Line1, Line2: a.Line2, City: a.City,
		Pincode: a.Pincode, Lat: a.Lat, Lng: a.Lng, IsDefault: a.IsDefault,
	}
}

type createAddressRequest struct {
	Label     string  `json:"label"`
	Line1     string  `json:"line1"`
	Line2     string  `json:"line2"`
	City      string  `json:"city"`
	Pincode   string  `json:"pincode"`
	Lat       float64 `json:"lat"`
	Lng       float64 `json:"lng"`
	IsDefault bool    `json:"is_default"`
}

func (handler *AddressHandler) create(w http.ResponseWriter, r *http.Request) {
	caller, ok := auth.UserFrom(r.Context())
	if !ok {
		writeError(w, handler.log, &badRequestError{msg: "authentication required"})
		return
	}

	var req createAddressRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, handler.log, err)
		return
	}
	if req.Line1 == "" || req.City == "" {
		writeError(w, handler.log, &badRequestError{msg: "line1 and city are required"})
		return
	}

	addr, err := handler.addresses.Create(r.Context(), address.NewAddress{
		UserID:    caller.ID, // the owner is the caller, never a body field
		Label:     req.Label,
		Line1:     req.Line1,
		Line2:     req.Line2,
		City:      req.City,
		Pincode:   req.Pincode,
		Lat:       req.Lat,
		Lng:       req.Lng,
		IsDefault: req.IsDefault,
	})
	if err != nil {
		writeError(w, handler.log, err)
		return
	}
	writeJSON(w, http.StatusCreated, toAddress(addr))
}

func (handler *AddressHandler) list(w http.ResponseWriter, r *http.Request) {
	caller, ok := auth.UserFrom(r.Context())
	if !ok {
		writeError(w, handler.log, &badRequestError{msg: "authentication required"})
		return
	}
	addrs, err := handler.addresses.List(r.Context(), caller.ID)
	if err != nil {
		writeError(w, handler.log, err)
		return
	}
	out := make([]addressResponse, len(addrs))
	for i, a := range addrs {
		out[i] = toAddress(a)
	}
	writeJSON(w, http.StatusOK, map[string]any{"addresses": out})
}
