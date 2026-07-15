package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/url"

	"github.com/kokkondaBhanuteja/sethu-care/internal/auth"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ledger"
)

// PaymentHandler serves the UPI collection surfaces: the customer (or the assigned technician)
// fetches the booking-specific QR to pay/show, and the payment provider — an admin, standing in
// for the PSP webhook in P1 — confirms the money landed.
type PaymentHandler struct {
	ledger   *ledger.Service
	signer   *auth.Signer
	upiVPA   string
	upiPayee string
	log      *slog.Logger
}

func NewPaymentHandler(ledgerService *ledger.Service, signer *auth.Signer, upiVPA, upiPayee string, log *slog.Logger) *PaymentHandler {
	return &PaymentHandler{ledger: ledgerService, signer: signer, upiVPA: upiVPA, upiPayee: upiPayee, log: log}
}

func (handler *PaymentHandler) Register(mux *http.ServeMux) {
	// The QR is for the booking's customer to pay, or the assigned technician to show. The
	// ownership check is in the handler because it depends on the booking's parties.
	mux.Handle("GET /bookings/{id}/payment",
		handler.signer.RequireAuth(http.HandlerFunc(handler.get)))
	// Capturing a payment (the money-landed callback) is the provider's job. In P1 that is an
	// admin; in production it is the PSP webhook, authenticated the same way.
	mux.Handle("POST /payments/{reference}/capture",
		handler.signer.RequireAuth(auth.RequireRole(identity.RoleAdmin, http.HandlerFunc(handler.capture))))
}

type paymentResponse struct {
	BookingID string `json:"booking_id"`
	Reference string `json:"reference"`
	Amount    string `json:"amount"`
	Status    string `json:"status"`
	UPILink   string `json:"upi_link,omitempty"`
}

func (handler *PaymentHandler) get(writer http.ResponseWriter, request *http.Request) {
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

	collection, err := handler.ledger.CollectionForBooking(request.Context(), bookingID)
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}
	if !handler.mayView(caller, collection) {
		writeError(writer, handler.log, &forbiddenError{msg: "this payment is not yours to view"})
		return
	}

	response := paymentResponse{
		BookingID: collection.BookingID.String(),
		Reference: collection.Reference,
		Amount:    collection.Amount.Rupees(),
		Status:    collection.Status.String(),
	}
	// The deep link is only meaningful while there is still money to collect.
	if collection.Status == ledger.PaymentPending {
		response.UPILink = handler.upiLink(collection)
	}
	writeJSON(writer, http.StatusOK, response)
}

// mayView allows the booking's own customer, its assigned technician, or an admin to see the
// collection. Anyone else is refused.
func (handler *PaymentHandler) mayView(caller auth.AuthedUser, collection ledger.Collection) bool {
	switch caller.Role {
	case identity.RoleAdmin:
		return true
	case identity.RoleCustomer:
		return caller.ID == collection.CustomerID
	case identity.RoleTechnician:
		return collection.TechnicianID != nil && caller.ID == *collection.TechnicianID
	default:
		return false
	}
}

// upiLink builds the UPI intent the customer's app opens (or a QR encodes): pay <amount> to the
// company VPA, tagged with our transaction reference so the capture callback maps back.
func (handler *PaymentHandler) upiLink(collection ledger.Collection) string {
	query := url.Values{}
	query.Set("pa", handler.upiVPA)
	query.Set("pn", handler.upiPayee)
	query.Set("am", collection.Amount.Rupees())
	query.Set("cu", "INR")
	query.Set("tn", "SETHU-CARE service payment")
	query.Set("tr", collection.Reference)
	return "upi://pay?" + query.Encode()
}

type captureRequest struct {
	ProviderRef string `json:"provider_ref,omitempty"`
}

func (handler *PaymentHandler) capture(writer http.ResponseWriter, request *http.Request) {
	reference := request.PathValue("reference")
	if reference == "" {
		writeError(writer, handler.log, &badRequestError{msg: "payment reference is required"})
		return
	}
	// The provider_ref is optional and a bare capture may carry no body at all — tolerate an
	// empty body (EOF) but still reject a malformed one.
	var req captureRequest
	if err := json.NewDecoder(request.Body).Decode(&req); err != nil && !errors.Is(err, io.EOF) {
		writeError(writer, handler.log, &badRequestError{msg: "invalid request body: " + err.Error()})
		return
	}
	var providerRef *string
	if req.ProviderRef != "" {
		providerRef = &req.ProviderRef
	}
	if err := handler.ledger.CaptureUPIPayment(request.Context(), reference, providerRef); err != nil {
		writeError(writer, handler.log, err)
		return
	}
	writeJSON(writer, http.StatusOK, map[string]any{"status": "captured"})
}
