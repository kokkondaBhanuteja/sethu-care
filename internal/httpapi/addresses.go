package httpapi

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/kokkondaBhanuteja/sethu-care/internal/address"
)

// AddressHandler serves a customer's own addresses. Every operation is authenticated, and the
// owner is always the token holder — a customer can only see and create their own.
type AddressHandler struct {
	addresses *address.Service
	log       *slog.Logger
}

func NewAddressHandler(addressService *address.Service, log *slog.Logger) *AddressHandler {
	return &AddressHandler{addresses: addressService, log: log}
}

func (handler *AddressHandler) RegisterHuma(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "createAddress", Method: http.MethodPost, Path: "/addresses",
		Summary: "Create an address", Tags: []string{"Addresses"}, DefaultStatus: http.StatusCreated,
		Security: bearerSecurity(),
	}, handler.create)
	huma.Register(api, huma.Operation{
		OperationID: "listAddresses", Method: http.MethodGet, Path: "/addresses",
		Summary: "List my addresses", Tags: []string{"Addresses"},
		Security: bearerSecurity(),
	}, handler.list)
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

func toAddress(addr address.Address) addressResponse {
	return addressResponse{
		ID: addr.ID.String(), Label: addr.Label, Line1: addr.Line1, Line2: addr.Line2, City: addr.City,
		Pincode: addr.Pincode, Lat: addr.Lat, Lng: addr.Lng, IsDefault: addr.IsDefault,
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

type createAddressInput struct {
	Body createAddressRequest
}

type addressOutput struct {
	Body addressResponse
}

func (handler *AddressHandler) create(ctx context.Context, input *createAddressInput) (*addressOutput, error) {
	caller, ok := userFromContext(ctx)
	if !ok {
		return nil, toHumaError(handler.log, &badRequestError{msg: "authentication required"})
	}
	if input.Body.Line1 == "" || input.Body.City == "" {
		return nil, toHumaError(handler.log, &badRequestError{msg: "line1 and city are required"})
	}
	addr, err := handler.addresses.Create(ctx, address.NewAddress{
		UserID:    caller.ID, // the owner is the caller, never a body field
		Label:     input.Body.Label,
		Line1:     input.Body.Line1,
		Line2:     input.Body.Line2,
		City:      input.Body.City,
		Pincode:   input.Body.Pincode,
		Lat:       input.Body.Lat,
		Lng:       input.Body.Lng,
		IsDefault: input.Body.IsDefault,
	})
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	return &addressOutput{Body: toAddress(addr)}, nil
}

type listAddressesOutput struct {
	Body struct {
		Addresses []addressResponse `json:"addresses"`
	}
}

func (handler *AddressHandler) list(ctx context.Context, _ *struct{}) (*listAddressesOutput, error) {
	caller, ok := userFromContext(ctx)
	if !ok {
		return nil, toHumaError(handler.log, &badRequestError{msg: "authentication required"})
	}
	addrs, err := handler.addresses.List(ctx, caller.ID)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	out := &listAddressesOutput{}
	out.Body.Addresses = make([]addressResponse, len(addrs))
	for index, addr := range addrs {
		out.Body.Addresses[index] = toAddress(addr)
	}
	return out, nil
}
