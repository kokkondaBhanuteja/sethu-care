// App runtime config — the backend base URL.

// ┌─────────────────────────────────────────────────────────────────────────────────────────┐
// │ TEMPORARY — ngrok tunnel for on-device testing. DELETE this constant (and the fallback    │
// │ below) when pointing at a real deployed backend. The phone can't reach the Mac's           │
// │ localhost, so `make run` (:8090) is tunnelled through ngrok to this public HTTPS URL.       │
// │ NOTE: this URL is ephemeral — it changes each time the ngrok tunnel restarts.              │
// └─────────────────────────────────────────────────────────────────────────────────────────┘
const NGROK_TUNNEL_URL = "https://climatologically-grindable-wilhelmina.ngrok-free.dev";

// Prefer an explicit build-time env override; otherwise use the ngrok tunnel above.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? NGROK_TUNNEL_URL;

// Razorpay public Key ID (test mode: rzp_test_…). Read from the env so the key isn't hard-coded —
// set EXPO_PUBLIC_RAZORPAY_KEY_ID in the app's .env. This is the PUBLIC key only; the secret stays
// on the backend (order creation + signature verification are server-side).
export const RAZORPAY_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? "";
