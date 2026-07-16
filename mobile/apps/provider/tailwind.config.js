// The provider app's Tailwind config: NativeWind's preset + the shared Teal Harbour token preset,
// so `bg-primary` / `text-on-surface` / `px-mobile-margin` resolve to the design tokens. The content
// globs MUST include the shared @sethu/ui package — otherwise classes used only inside the UI kit
// (e.g. `text-inverse-on-surface`) are never generated and silently render unstyled.
const tokensPreset = require("@sethu/tokens/tailwind-preset");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "../../packages/ui/src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset"), tokensPreset],
};
