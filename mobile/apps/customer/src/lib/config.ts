// App runtime config — the backend base URL.
import Constants from "expo-constants";
import { Platform } from "react-native";

// The LOCAL dev backend, reachable when the app runs on the emulator/simulator on the same machine
// as `make run` (:8090). The Android emulator reaches the host's loopback via 10.0.2.2; the iOS
// simulator via localhost. On a physical device these are unreachable — resolution falls back to ngrok.
const LOCAL_API_URL = Platform.OS === "android" ? "http://10.0.2.2:8090" : "http://localhost:8090";

// ┌─────────────────────────────────────────────────────────────────────────────────────────┐
// │ TEMPORARY — ngrok tunnel for on-device testing OFF the dev network. Replace with the real  │
// │ deployed backend for production. Ephemeral — this URL changes each time the tunnel restarts.│
// └─────────────────────────────────────────────────────────────────────────────────────────┘
const NGROK_TUNNEL_URL = "https://climatologically-grindable-wilhelmina.ngrok-free.dev";

// The synchronous default used before the probe below runs: an explicit build-time override wins;
// otherwise we START on the LOCAL backend (the preferred one).
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? LOCAL_API_URL;

// resolveApiBaseUrl picks the backend at startup, in priority order:
//   1. EXPO_PUBLIC_API_URL — an explicit build-time override always wins.
//   2. LOCAL — preferred: used when its /health answers quickly (emulator/simulator + `make run`).
//   3. ngrok — the fallback when local is unreachable (a physical device, or the server is down).
export async function resolveApiBaseUrl(): Promise<string> {
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override) return override;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const response = await fetch(`${LOCAL_API_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (response.ok) return LOCAL_API_URL;
  } catch {
    // Local backend unreachable — fall through to the ngrok tunnel.
  }
  return NGROK_TUNNEL_URL;
}

// Razorpay public Key ID (test mode: rzp_test_…). Injected into `extra.razorpayKeyId` by app.config.js
// from the repo-root .env at build time; falls back to an EXPO_PUBLIC_ env var if set. PUBLIC key only
// — the secret stays on the backend (order creation + signature verification are server-side).
const extra = Constants.expoConfig?.extra as { razorpayKeyId?: string } | undefined;
export const RAZORPAY_KEY_ID =
  extra?.razorpayKeyId ||
  process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ||
  process.env.EXPO_PUBLIC_RAZORPAY_KEY ||
  "";
