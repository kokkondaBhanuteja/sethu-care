// Dynamic Expo config: extends app.json and injects the Razorpay PUBLIC key id (rzp_test_… / rzp_live_…)
// from the repo-root .env into `extra`, so the app can read it via expo-constants. Only the public
// Key ID is exposed — the Razorpay Key SECRET and WEBHOOK SECRET are never read or bundled (they
// belong to the backend).
const path = require("path");

// The shared env lives at the repo root (SETHU-CARE/.env), above the mobile workspace.
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const appJson = require("./app.json");

// Public key id only — matches the .env var names (never the *_SECRET / *_WEBHOOK_SECRET vars).
const razorpayKeyId =
  process.env.EXPO_RAZORPAY_KEY_ID ||
  process.env.EXPO_NEXT_PUBLIC_RAZORPAY_KEY_ID ||
  process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ||
  "";

module.exports = {
  ...appJson.expo,
  extra: {
    ...(appJson.expo.extra ?? {}),
    razorpayKeyId,
  },
};
