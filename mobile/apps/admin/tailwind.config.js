// The admin web dashboard shares the SAME Indigo Velvet tokens as the RN apps — the framework-
// agnostic preset works in web Tailwind just as it does in NativeWind. (shadcn/ui components layer
// on top in a later phase.)
const tokensPreset = require("@sethu/tokens/tailwind-preset");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [tokensPreset],
};
