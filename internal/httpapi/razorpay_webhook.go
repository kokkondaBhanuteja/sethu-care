package httpapi

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"

	"github.com/kokkondaBhanuteja/sethu-care/internal/ledger"
	"github.com/kokkondaBhanuteja/sethu-care/internal/razorpay"
)

// RazorpayWebhookHandler receives Razorpay's payment webhooks. It is a RAW handler (not a huma
// operation): it needs the exact request bytes to verify the HMAC signature, and it carries no
// bearer token — the signature IS the authentication. On a paid payment link it captures the
// matching collection (idempotently), which books REVENUE.
type RazorpayWebhookHandler struct {
	razorpay *razorpay.Client
	ledger   *ledger.Service
	log      *slog.Logger
}

func NewRazorpayWebhookHandler(razorpayClient *razorpay.Client, ledgerService *ledger.Service, log *slog.Logger) *RazorpayWebhookHandler {
	return &RazorpayWebhookHandler{razorpay: razorpayClient, ledger: ledgerService, log: log}
}

type razorpayWebhookEvent struct {
	Event   string `json:"event"`
	Payload struct {
		PaymentLink struct {
			Entity struct {
				ReferenceID string `json:"reference_id"`
			} `json:"entity"`
		} `json:"payment_link"`
		Payment struct {
			Entity struct {
				ID string `json:"id"`
			} `json:"entity"`
		} `json:"payment"`
	} `json:"payload"`
}

func (handler *RazorpayWebhookHandler) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	body, err := io.ReadAll(io.LimitReader(request.Body, 1<<20))
	if err != nil {
		writer.WriteHeader(http.StatusBadRequest)
		return
	}
	if handler.razorpay == nil || !handler.razorpay.VerifyWebhook(body, request.Header.Get("X-Razorpay-Signature")) {
		writer.WriteHeader(http.StatusUnauthorized)
		return
	}

	var event razorpayWebhookEvent
	if err := json.Unmarshal(body, &event); err != nil {
		writer.WriteHeader(http.StatusBadRequest)
		return
	}

	// A paid payment link is our capture signal: reference_id is the payment reference we set when
	// creating the link, and the payment entity id is the provider ref we record. Capture is
	// idempotent, so a Razorpay retry (on a 5xx) is safe.
	if event.Event == "payment_link.paid" {
		reference := event.Payload.PaymentLink.Entity.ReferenceID
		providerRef := event.Payload.Payment.Entity.ID
		if reference != "" {
			if err := handler.ledger.CaptureUPIPayment(request.Context(), reference, &providerRef); err != nil {
				handler.log.Error("capturing razorpay payment", "reference", reference, "err", err)
				writer.WriteHeader(http.StatusInternalServerError)
				return
			}
			handler.log.Info("razorpay payment captured", "reference", reference)
		}
	}
	writer.WriteHeader(http.StatusOK)
}
