// Web design tokens — the premium-ERP redesign language (approved Figma references: soft canvas,
// white rounded cards, icon chips, tinted status pills, airy tables). This is the SINGLE SOURCE for
// every visual value on the web surfaces: generate-css.ts turns this object into the Tailwind v4
// `@theme` file that @sethu/ui-web ships and every app imports. Change a value here → regenerate →
// every surface updates. No component ever hardcodes a colour, radius, shadow, or type size.

import { color as brand } from "./primitives.ts";

/** A tinted tone: pale background + saturated foreground + a border between them. The reference's
 *  status-pill / feature-card anatomy ("Paid Via Card", "Due in 3 days", the Get Started cards). */
export interface Tone {
  bg: string;
  fg: string;
  border: string;
}

export const webColor = {
  // Canvas & surfaces
  canvas: "#f6f7f9", // the soft gray page background every white card sits on
  surface: "#ffffff",
  inset: "#f1f3f5", // input wells, table header fills, hover fills
  insetHover: "#eceef0",

  // Ink
  ink: brand.onSurface, // #0f172a — headings, table values
  inkInverse: "#f4f6f7", // light-on-dark body text (the landing's dark canvas)
  muted: "#5a646e", // labels, secondary copy
  faint: "#8b959f", // hints, disabled, timestamps

  // Borders
  border: "#e6e8eb",
  borderStrong: "#d2d6db",

  // Brand (SETHU blue stays the identity; the reference's green is not our brand)
  primary: brand.primary,
  primaryHover: "#1741b8",
  onPrimary: brand.onPrimary,
  secondary: brand.secondary, // brand teal — sparing accents, never competes with primary
  onSecondary: brand.onSecondary,
  link: brand.primary, // the table's "View / View & Edit" action colour

  // Focus ring
  ring: "#93c5fd",
} as const;

/** Status + severity tones. Success/warning/danger also carry the reference's due-date countdown
 *  semantics: paid=success, due-soon=warning, overdue/critical=danger. */
export const webTone = {
  success: { bg: "#e7f6ee", fg: "#0e8a4a", border: "#c4ebd4" },
  warning: { bg: "#fdf4e3", fg: "#b76a00", border: "#f4dfb3" },
  danger: { bg: "#fdecea", fg: "#c4291c", border: "#f6cbc5" },
  info: { bg: "#e8f1ff", fg: "#1d4ed8", border: "#c8dcfa" },
  neutral: { bg: "#f1f3f5", fg: "#5a646e", border: "#e0e3e7" },
  // Feature-card tints (the Get Started cards): softer than status tones, decorative.
  tintAmber: { bg: "#fdf6e5", fg: "#b76a00", border: "#f7e8c3" },
  tintGreen: { bg: "#e6f8ef", fg: "#0e8a4a", border: "#c9efdb" },
  tintPurple: { bg: "#f1edfd", fg: "#6d28d9", border: "#e0d7f8" },
  tintBlue: { bg: "#e8f1ff", fg: "#1d4ed8", border: "#d0e1fb" },
} as const satisfies Record<string, Tone>;

/** Corner radii (rem). Cards are the signature 1rem; controls sit a step below. */
export const webRadius = {
  sm: "0.375rem", // 6px — pills' inner elements, small chips
  md: "0.625rem", // 10px — buttons, inputs
  lg: "0.875rem", // 14px — panels, table wrappers
  card: "1rem", // 16px — the card silhouette
  full: "9999px",
} as const;

/** Elevation. Soft and barely-there at rest; one step up for overlays. */
export const webShadow = {
  card: "0 1px 2px rgb(16 24 40 / 0.04), 0 1px 3px rgb(16 24 40 / 0.06)",
  lifted: "0 4px 12px rgb(16 24 40 / 0.08), 0 2px 4px rgb(16 24 40 / 0.04)",
  overlay: "0 12px 32px rgb(16 24 40 / 0.14), 0 4px 8px rgb(16 24 40 / 0.06)",
} as const;

/** Type additions beyond Tailwind's default scale: the KPI number and the table header caption.
 *  [size, lineHeight] pairs, rem. */
export const webText = {
  kpi: ["2rem", "2.5rem"],
  kpiSm: ["1.5rem", "2rem"],
  tableHead: ["0.6875rem", "1rem"], // 11px UPPERCASE tracking-wide header row
} as const;

/** Vivid accent family — the reference's icon chips, chart series and celebratory moments.
 *  Solid fills carrying white glyphs (Figma #8's green/red/blue chips); use sparingly, one per
 *  card, never for body text. */
export const webAccent = {
  green: "#22c55e",
  red: "#f43f5e",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  amber: "#f59e0b",
  teal: "#14b8a6",
} as const;

export type WebAccentToken = keyof typeof webAccent;
export type WebColorToken = keyof typeof webColor;
export type WebToneToken = keyof typeof webTone;
