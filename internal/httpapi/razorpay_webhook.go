package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"

	"github.com/kokkondaBhanuteja/sethu-care/internal/gateway"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ledger"
	"github.com/kokkondaBhanuteja/sethu-care/internal/razorpay"
)

// RazorpayWebhookHandler receives Razorpay's payment webhooks. It is a RAW handler (not a huma
// operation): it needs the exact request bytes to verify the HMAC signature, and it carries no
// bearer token — the signature IS the authentication. Every verified event is recorded in the
// idempotent inbox (payment_gateway_events) before it is applied, so retries dedupe and a webhook
// that beats its payment row can be parked and replayed. A paid payment link captures the matching
// collection (idempotently), which books REVENUE.
type RazorpayWebhookHandler struct {
	razorpay *razorpay.Client
	ledger   *ledger.Service
	events   *gateway.Store
	log      *slog.Logger
}

func NewRazorpayWebhookHandler(razorpayClient *razorpay.Client, ledgerService *ledger.Service, events *gateway.Store, log *slog.Logger) *RazorpayWebhookHandler {
	return &RazorpayWebhookHandler{razorpay: razorpayClient, ledger: ledgerService, events: events, log: log}
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

	reference := event.Payload.PaymentLink.Entity.ReferenceID
	providerRef := event.Payload.Payment.Entity.ID
	ctx := request.Context()

	// The dedupe key is the provider's own event id; fall back to a deterministic composite.
	gatewayEventID := request.Header.Get("X-Razorpay-Event-Id")
	if gatewayEventID == "" {
		gatewayEventID = event.Event + "|" + providerRef
	}

	// INBOX: short-circuit an already-applied delivery, then durably record this one (raw body and
	// all) as RECEIVED. The record is idempotent — a concurrent/duplicate delivery is a no-op.
	if handler.events != nil {
		processed, err := handler.events.AlreadyProcessed(ctx, gatewayEventID)
		if err != nil {
			handler.log.Error("reading gateway event", "id", gatewayEventID, "err", err)
			writer.WriteHeader(http.StatusInternalServerError)
			return
		}
		if processed {
			writer.WriteHeader(http.StatusOK)
			return
		}
		if err := handler.events.Record(ctx, gateway.Event{
			EventType:      event.Event,
			GatewayEventID: gatewayEventID,
			Reference:      reference,
			ProviderRef:    providerRef,
			Payload:        body,
		}); err != nil {
			handler.log.Error("recording gateway event", "id", gatewayEventID, "err", err)
			writer.WriteHeader(http.StatusInternalServerError)
			return
		}
	}

	// A paid payment link is our capture signal. Capture is idempotent, so a Razorpay retry is safe.
	if event.Event == "payment_link.paid" && reference != "" {
		if err := handler.ledger.CaptureUPIPayment(ctx, reference, &providerRef); err != nil {
			// The webhook beat the payment row (a real race under load): leave the event PARKED
			// (RECEIVED) and 200-ack so Razorpay doesn't retry-storm; the replay sweep retries it.
			if errors.Is(err, ledger.ErrPaymentNotFound) {
				handler.log.Warn("gateway event parked: payment not found yet", "reference", reference, "id", gatewayEventID)
				writer.WriteHeader(http.StatusOK)
				return
			}
			handler.log.Error("capturing razorpay payment", "reference", reference, "err", err)
			writer.WriteHeader(http.StatusInternalServerError)
			return
		}
		handler.log.Info("razorpay payment captured", "reference", reference)
	}

	// Applied (or a non-capture event we merely recorded): mark it PROCESSED so retries dedupe.
	if handler.events != nil {
		if err := handler.events.MarkProcessed(ctx, gatewayEventID); err != nil {
			// Non-fatal: capture already committed and the record/sweep are idempotent.
			handler.log.Error("marking gateway event processed", "id", gatewayEventID, "err", err)
		}
	}
	writer.WriteHeader(http.StatusOK)
}
