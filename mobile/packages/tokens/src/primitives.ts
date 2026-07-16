// Primitive tokens — the raw "Teal Harbour" values: a teal primary + blue secondary on white
// surfaces with near-black text, tuned for WCAG AA contrast at all ages. These carry NO meaning on
// their own; the semantic layer (semantic.ts) assigns them roles. Keep these in sync with
// tailwind-preset.js (the same values, as utility classes).

/** Material-3-style colour ramp. Names are the M3 roles (surface tiers, on-* pairs, fixed). */
export const color = {
  primary: "#0f766e",
  onPrimary: "#ffffff",
  primaryContainer: "#ccfbf1",
  onPrimaryContainer: "#115e59",
  primaryFixed: "#99f6e4",
  primaryFixedDim: "#5eead4",
  onPrimaryFixed: "#042f2e",
  onPrimaryFixedVariant: "#115e59",
  inversePrimary: "#5eead4",
  surfaceTint: "#0f766e",

  secondary: "#1d4ed8",
  onSecondary: "#ffffff",
  secondaryContainer: "#dbeafe",
  onSecondaryContainer: "#1e40af",
  secondaryFixed: "#bfdbfe",
  secondaryFixedDim: "#93c5fd",
  onSecondaryFixed: "#172554",
  onSecondaryFixedVariant: "#1e40af",

  tertiary: "#15803d",
  onTertiary: "#ffffff",
  tertiaryContainer: "#dcfce7",
  onTertiaryContainer: "#166534",
  tertiaryFixed: "#bbf7d0",
  tertiaryFixedDim: "#86efac",
  onTertiaryFixed: "#052e16",
  onTertiaryFixedVariant: "#166534",

  error: "#dc2626",
  onError: "#ffffff",
  errorContainer: "#fee2e2",
  onErrorContainer: "#991b1b",

  background: "#ffffff",
  onBackground: "#0f172a",

  surface: "#ffffff",
  surfaceDim: "#e2e8f0",
  surfaceBright: "#ffffff",
  surfaceContainerLowest: "#ffffff",
  surfaceContainerLow: "#f8fafc",
  surfaceContainer: "#f1f5f9",
  surfaceContainerHigh: "#e2e8f0",
  surfaceContainerHighest: "#cbd5e1",
  onSurface: "#0f172a",
  onSurfaceVariant: "#475569",
  surfaceVariant: "#e2e8f0",
  inverseSurface: "#1e293b",
  inverseOnSurface: "#f1f5f9",

  outline: "#94a3b8",
  outlineVariant: "#e2e8f0",
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
