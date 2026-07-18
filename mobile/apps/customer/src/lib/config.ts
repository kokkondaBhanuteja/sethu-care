// App runtime config — the backend base URL.
import Constants from "expo-constants";

// ┌─────────────────────────────────────────────────────────────────────────────────────────┐
// │ TEMPORARY — ngrok tunnel for on-device testing. DELETE this constant (and the fallback    │
// │ below) when pointing at a real deployed backend. The phone can't reach the Mac's           │
// │ localhost, so `make run` (:8090) is tunnelled through ngrok to this public HTTPS URL.       │
// │ NOTE: this URL is ephemeral — it changes each time the ngrok tunnel restarts.              │
// └─────────────────────────────────────────────────────────────────────────────────────────┘
const NGROK_TUNNEL_URL = "https://climatologically-grindable-wilhelmina.ngrok-free.dev";

// Prefer an explicit build-time env override; otherwise use the ngrok tunnel above.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? NGROK_TUNNEL_URL;

// Razorpay public Key ID (test mode: rzp_test_…). Injected into `extra.razorpayKeyId` by app.config.js
// from the repo-root .env at build time; falls back to an EXPO_PUBLIC_ env var if set. PUBLIC key only
// — the secret stays on the backend (order creation + signature verification are server-side).
const extra = Constants.expoConfig?.extra as { razorpayKeyId?: string } | undefined;
export const RAZORPAY_KEY_ID =
  extra?.razorpayKeyId ||
  process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ||
  process.env.EXPO_PUBLIC_RAZORPAY_KEY ||
  "";
