package httpapi

import (
	"context"
	"log/slog"
	"net/url"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/kokkondaBhanuteja/sethu-care/internal/auth"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ledger"
)

// PaymentHandler serves the UPI collection surfaces: the customer (or the assigned technician)
// fetches the booking-specific QR to pay/show, and the payment provider — an admin, standing in
// for the PSP webhook in P1 — confirms the money landed.
type PaymentHandler struct {
	ledger   *ledger.Service
	upiVPA   string
	upiPayee string
	log      *slog.Logger
}

func NewPaymentHandler(ledgerService *ledger.Service, upiVPA, upiPayee string, log *slog.Logger) *PaymentHandler {
	return &PaymentHandler{ledger: ledgerService, upiVPA: upiVPA, upiPayee: upiPayee, log: log}
}

func (handler *PaymentHandler) RegisterHuma(api huma.API) {
	// The QR is for the booking's customer to pay, or the assigned technician to show. The
	// ownership check is in the handler because it depends on the booking's parties.
	huma.Register(api, huma.Operation{
		OperationID: "getPayment", Method: "GET", Path: "/bookings/{id}/payment",
		Summary: "Get a booking's UPI collection", Tags: []string{"Payments"},
		Security: bearerSecurity(),
	}, handler.get)
	// Capturing a payment (the money-landed callback) is the provider's job. In P1 that is an
	// admin; in production it is the PSP webhook, authenticated the same way.
	huma.Register(api, huma.Operation{
		OperationID: "capturePayment", Method: "POST", Path: "/payments/{reference}/capture",
		Summary: "Confirm a UPI payment landed", Tags: []string{"Payments"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
	}, handler.capture)
	// The admin console's payments queue: every collection still awaiting capture.
	huma.Register(api, huma.Operation{
		OperationID: "pendingPayments", Method: "GET", Path: "/ops/payments",
		Summary: "List UPI collections awaiting capture", Tags: []string{"Payments"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
	}, handler.pending)
}

type pendingPaymentResponse struct {
	Reference string `json:"reference"`
	BookingID string `json:"booking_id"`
	Amount    string `json:"amount"`
	Status    string `json:"status"`
	CreatedAt string `json:"created_at"`
}

type pendingPaymentsOutput struct {
	Body struct {
		Payments []pendingPaymentResponse `json:"payments"`
	}
}

func (handler *PaymentHandler) pending(ctx context.Context, _ *struct{}) (*pendingPaymentsOutput, error) {
	payments, err := handler.ledger.PendingPayments(ctx)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	out := &pendingPaymentsOutput{}
	out.Body.Payments = make([]pendingPaymentResponse, len(payments))
	for index, payment := range payments {
		out.Body.Payments[index] = pendingPaymentResponse{
			Reference: payment.Reference,
			BookingID: payment.BookingID.String(),
			Amount:    payment.AmountPaise.Rupees(),
			Status:    payment.Status.String(),
			CreatedAt: payment.CreatedAt.Format(time.RFC3339),
		}
	}
	return out, nil
}

type paymentResponse struct {
	BookingID string `json:"booking_id"`
	Reference string `json:"reference"`
	Amount    string `json:"amount"`
	Status    string `json:"status"`
	UPILink   string `json:"upi_link,omitempty"`
}

type getPaymentInput struct {
	ID string `path:"id" format:"uuid" doc:"Booking id"`
}

type getPaymentOutput struct {
	Body paymentResponse
}

func (handler *PaymentHandler) get(ctx context.Context, input *getPaymentInput) (*getPaymentOutput, error) {
	bookingID, err := parseUUID(input.ID, "id")
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	caller, ok := userFromContext(ctx)
	if !ok {
		return nil, toHumaError(handler.log, &badRequestError{msg: "authentication required"})
	}
	collection, err := handler.ledger.CollectionForBooking(ctx, bookingID)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	if !handler.mayView(caller, collection) {
		return nil, toHumaError(handler.log, &forbiddenError{msg: "this payment is not yours to view"})
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
	return &getPaymentOutput{Body: response}, nil
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

type captureInput struct {
	Reference string `path:"reference" doc:"The payment reference (UPI tr)"`
	// Body is optional: a bare capture may carry no body at all (the provider_ref is optional).
	Body *captureRequest
}

type captureOutput struct {
	Body struct {
		Status string `json:"status"`
	}
}

func (handler *PaymentHandler) capture(ctx context.Context, input *captureInput) (*captureOutput, error) {
	if input.Reference == "" {
		return nil, toHumaError(handler.log, &badRequestError{msg: "payment reference is required"})
	}
	var providerRef *string
	if input.Body != nil && input.Body.ProviderRef != "" {
		providerRef = &input.Body.ProviderRef
	}
	if err := handler.ledger.CaptureUPIPayment(ctx, input.Reference, providerRef); err != nil {
		return nil, toHumaError(handler.log, err)
	}
	out := &captureOutput{}
	out.Body.Status = "captured"
	return out, nil
}
