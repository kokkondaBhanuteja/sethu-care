# internal/razorpay — CLAUDE.md

## Purpose
ADAPTER. A thin outbound client for the two Razorpay operations we need: creating a hosted payment link for a collection, and verifying the signature on Razorpay's webhook. A leaf — imports nothing from the domain. No SDK: two HTTP calls and an HMAC.

## Responsibilities
- Report whether payment credentials are configured.
- Create a hosted payment link and return its short URL.
- Verify the HMAC-SHA256 signature on an inbound webhook.

## Owns
none.

## Allowed Dependencies
stdlib (`net/http`, `crypto/hmac`, `crypto/sha256`, `encoding/json`, `encoding/hex`, ...) only.

## Forbidden Dependencies
- No domain module, no `storage`, no `httpapi`. Injected into the payment handler as a `*Client`.

## Contains
- `Client` (holds `keyID`, `keySecret`, `webhookSecret`, an `*http.Client` with a 15s timeout).
- `New(keyID, keySecret, webhookSecret)`.
- `Configured()` — key id + secret present (else callers fall back to a `upi://` intent).
- `CreatePaymentLink(ctx, amountPaise, reference, description) → (url, err)` — POSTs to `api.razorpay.com/v1/payment_links` (basic auth); `amountPaise` passes straight through (Razorpay works in paise); our `reference` becomes Razorpay's `reference_id` so the webhook can map the paid link back.
- `VerifyWebhook(body []byte, signature string) bool` — HMAC-SHA256 of the RAW body under the webhook secret, hex-encoded, compared in constant time (`hmac.Equal`) to `X-Razorpay-Signature`. This is what authenticates the webhook (it carries no bearer token).

## Examples
```go
client := razorpay.New(cfg.RazorpayKeyID, cfg.RazorpayKeySecret, cfg.RazorpayWebhookSecret)
if client.Configured() {
    url, err := client.CreatePaymentLink(ctx, total.Paise(), reference, "SETHU-CARE service")
}
// In the raw webhook handler (httpapi/razorpay_webhook.go):
if !client.VerifyWebhook(rawBody, request.Header.Get("X-Razorpay-Signature")) { return 401 }
```

## Best Practices
- Verify the signature over the EXACT raw request bytes, before parsing — read the raw body in the transport handler.
- Pass amounts in paise via `money.Money.Paise()`; never convert to rupees for the API.
- Fall back to the UPI intent when `Configured() == false` rather than erroring.

## Common Mistakes
- Verifying against a re-serialized/parsed body instead of the raw bytes (signature will never match).
- Leaking key material — the client holds it; callers only get URLs and a bool.
- Assuming a returned non-2xx or empty `short_url` succeeded — `CreatePaymentLink` treats both as errors.
