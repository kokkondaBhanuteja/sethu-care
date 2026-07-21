// Package razorpay is a thin client for the two Razorpay operations we need: creating a hosted
// payment link for a collection, and verifying the signature on Razorpay's webhook. It is a LEAF —
// it imports nothing from the domain, so the payment handler can be handed a *Client without any
// inward dependency. No SDK: two HTTP calls and an HMAC, like the Cloudinary and MSG91 clients.
package razorpay

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

const paymentLinksURL = "https://api.razorpay.com/v1/payment_links"

// Client talks to Razorpay with the key id/secret (basic auth) and verifies webhooks with the
// webhook secret. Zero credentials = not configured; the caller falls back to a upi:// intent.
type Client struct {
	keyID         string
	keySecret     string
	webhookSecret string
	http          *http.Client
}

func New(keyID, keySecret, webhookSecret string) *Client {
	return &Client{
		keyID:         keyID,
		keySecret:     keySecret,
		webhookSecret: webhookSecret,
		http:          &http.Client{Timeout: 15 * time.Second},
	}
}

// Configured reports whether a payment link can be created. When false, callers use the UPI intent.
func (client *Client) Configured() bool {
	return client.keyID != "" && client.keySecret != ""
}

type createLinkRequest struct {
	Amount         int64  `json:"amount"`
	Currency       string `json:"currency"`
	ReferenceID    string `json:"reference_id"`
	Description    string `json:"description"`
	ReminderEnable bool   `json:"reminder_enable"`
}

type createLinkResponse struct {
	ShortURL string `json:"short_url"`
	ID       string `json:"id"`
	Error    struct {
		Description string `json:"description"`
	} `json:"error"`
}

// CreatePaymentLink opens a hosted Razorpay payment link for a collection and returns its short URL.
// amountPaise is passed straight through — Razorpay also works in paise. reference is our payment
// reference, set as Razorpay's reference_id so the webhook can map the paid link back to us.
func (client *Client) CreatePaymentLink(ctx context.Context, amountPaise int64, reference, description string) (url string, err error) {
	payload, err := json.Marshal(createLinkRequest{
		Amount:         amountPaise,
		Currency:       "INR",
		ReferenceID:    reference,
		Description:    description,
		ReminderEnable: true,
	})
	if err != nil {
		return "", fmt.Errorf("encoding razorpay request: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, paymentLinksURL, bytes.NewReader(payload))
	if err != nil {
		return "", fmt.Errorf("building razorpay request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.SetBasicAuth(client.keyID, client.keySecret)

	response, err := client.http.Do(request)
	if err != nil {
		return "", fmt.Errorf("calling razorpay: %w", err)
	}
	defer func() {
		if closeErr := response.Body.Close(); closeErr != nil && err == nil {
			err = fmt.Errorf("closing razorpay response: %w", closeErr)
		}
	}()

	var result createLinkResponse
	if decodeErr := json.NewDecoder(response.Body).Decode(&result); decodeErr != nil {
		return "", fmt.Errorf("decoding razorpay response: %w", decodeErr)
	}
	if response.StatusCode >= http.StatusMultipleChoices || result.ShortURL == "" {
		return "", fmt.Errorf("razorpay: %s (status %d)", result.Error.Description, response.StatusCode)
	}
	return result.ShortURL, nil
}

// VerifyWebhook checks Razorpay's webhook signature: HMAC-SHA256 of the raw body under the webhook
// secret, hex-encoded, compared in constant time to the X-Razorpay-Signature header. This is what
// authenticates the webhook — it carries no bearer token.
func (client *Client) VerifyWebhook(body []byte, signature string) bool {
	if client.webhookSecret == "" || signature == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(client.webhookSecret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}
