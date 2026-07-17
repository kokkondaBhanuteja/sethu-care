// App runtime config — the backend base URL.
//
// For testing on a real device, the phone can't reach the Mac's localhost, so we tunnel the local
// backend (`make run` on :8090) through ngrok and point the app at the public HTTPS URL below.
// Override at build time with EXPO_PUBLIC_API_URL; otherwise this hard-coded tunnel is used.
//
// NOTE: this ngrok URL is ephemeral — it changes each time the tunnel restarts. Re-run ngrok and
// update this value (or set EXPO_PUBLIC_API_URL) for a fresh session.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://climatologically-grindable-wilhelmina.ngrok-free.dev";
