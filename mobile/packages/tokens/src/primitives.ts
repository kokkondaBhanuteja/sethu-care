// Primitive tokens — the raw "Indigo Velvet" values, lifted verbatim from the design
// (stitch_swiftfix_premium_services/indigo_velvet/DESIGN.md and the screen Tailwind configs).
// These carry NO meaning on their own; the semantic layer (semantic.ts) assigns them roles.
// This file is the single source of truth for both the RN apps (via NativeWind) and the admin web.

/** Material-3-style colour ramp. Names are the design's own (surface tiers, on-* pairs, fixed). */
export const color = {
  primary: "#3525cd",
  onPrimary: "#ffffff",
  primaryContainer: "#4f46e5",
  onPrimaryContainer: "#dad7ff",
  primaryFixed: "#e2dfff",
  primaryFixedDim: "#c3c0ff",
  onPrimaryFixed: "#0f0069",
  onPrimaryFixedVariant: "#3323cc",
  inversePrimary: "#c3c0ff",
  surfaceTint: "#4d44e3",

  secondary: "#712ae2",
  onSecondary: "#ffffff",
  secondaryContainer: "#8a4cfc",
  onSecondaryContainer: "#fffbff",
  secondaryFixed: "#eaddff",
  secondaryFixedDim: "#d2bbff",
  onSecondaryFixed: "#25005a",
  onSecondaryFixedVariant: "#5a00c6",

  tertiary: "#684000",
  onTertiary: "#ffffff",
  tertiaryContainer: "#885500",
  onTertiaryContainer: "#ffd4a4",
  tertiaryFixed: "#ffddb8",
  tertiaryFixedDim: "#ffb95f",
  onTertiaryFixed: "#2a1700",
  onTertiaryFixedVariant: "#653e00",

  error: "#ba1a1a",
  onError: "#ffffff",
  errorContainer: "#ffdad6",
  onErrorContainer: "#93000a",

  background: "#f9f9ff",
  onBackground: "#151c27",

  surface: "#f9f9ff",
  surfaceDim: "#d3daea",
  surfaceBright: "#f9f9ff",
  surfaceContainerLowest: "#ffffff",
  surfaceContainerLow: "#f0f3ff",
  surfaceContainer: "#e7eefe",
  surfaceContainerHigh: "#e2e8f8",
  surfaceContainerHighest: "#dce2f3",
  onSurface: "#151c27",
  onSurfaceVariant: "#464555",
  surfaceVariant: "#dce2f3",
  inverseSurface: "#2a313d",
  inverseOnSurface: "#ebf1ff",

  outline: "#777587",
  outlineVariant: "#c7c4d8",
} as const;

/** 8px grid. `base` is the unit; the named steps match the design's spacing scale. */
export const space = {
  base: 4,
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
  gutter: 24,
  mobileMargin: 20,
  containerMax: 1280,
} as const;

/** Corner radii (px). "Large radius geometry" — cards 24, buttons fully rounded. */
export const radius = {
  none: 0,
  sm: 4,
  DEFAULT: 4,
  md: 8,
  lg: 8,
  xl: 12,
  card: 24,
  full: 9999,
} as const;

export const fontFamily = {
  display: "Plus Jakarta Sans",
  heading: "Plus Jakarta Sans",
  body: "Inter",
} as const;

/** Type scale: [fontSize px, { lineHeight, fontWeight, letterSpacing? }]. */
export const typography = {
  displayLg: {
    fontSize: 48,
    lineHeight: 1.1,
    fontWeight: "800",
    letterSpacing: -0.02,
    family: fontFamily.display,
  },
  displayLgMobile: {
    fontSize: 36,
    lineHeight: 1.2,
    fontWeight: "800",
    letterSpacing: -0.02,
    family: fontFamily.display,
  },
  headlineMd: {
    fontSize: 30,
    lineHeight: 1.3,
    fontWeight: "700",
    letterSpacing: -0.01,
    family: fontFamily.heading,
  },
  headlineSm: {
    fontSize: 24,
    lineHeight: 1.4,
    fontWeight: "700",
    letterSpacing: 0,
    family: fontFamily.heading,
  },
  bodyLg: {
    fontSize: 18,
    lineHeight: 1.6,
    fontWeight: "400",
    letterSpacing: 0,
    family: fontFamily.body,
  },
  bodyMd: {
    fontSize: 16,
    lineHeight: 1.5,
    fontWeight: "400",
    letterSpacing: 0,
    family: fontFamily.body,
  },
  labelMd: {
    fontSize: 14,
    lineHeight: 1.2,
    fontWeight: "600",
    letterSpacing: 0.05,
    family: fontFamily.body,
  },
  labelSm: {
    fontSize: 12,
    lineHeight: 1.2,
    fontWeight: "500",
    letterSpacing: 0,
    family: fontFamily.body,
  },
} as const;

export type ColorToken = keyof typeof color;
export type SpaceToken = keyof typeof space;
export type RadiusToken = keyof typeof radius;
export type TypographyToken = keyof typeof typography;
