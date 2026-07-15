// The customer app's Tailwind config: NativeWind's preset + the shared Indigo Velvet token
// preset, so `bg-primary` / `text-on-surface` / `px-mobile-margin` resolve to the design tokens.
const tokensPreset = require("@sethu/tokens/tailwind-preset");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset"), tokensPreset],
};
