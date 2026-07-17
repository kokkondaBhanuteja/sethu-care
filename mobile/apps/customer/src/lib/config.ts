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
