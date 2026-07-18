// The admin web dashboard shares the SAME Blue Harbour tokens as the RN apps — the framework-
// agnostic preset works in web Tailwind just as it does in NativeWind. On web the token font
// families resolve to the Inter web font (loaded via next/font as --font-inter); per-weight is
// applied by the font-* utilities in globals.css.
const tokensPreset = require("@sethu/tokens/tailwind-preset");

const inter = ["var(--font-inter)", "system-ui", "sans-serif"];

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [tokensPreset],
  theme: {
    extend: {
      fontFamily: {
        display: inter,
        heading: inter,
        semibold: inter,
        medium: inter,
        body: inter,
        sans: inter,
      },
    },
  },
};
