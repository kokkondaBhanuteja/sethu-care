// Semantic tokens — role-based aliases over the primitives. Components consume ONLY these, so a
// rebrand or a dark-mode tweak is a change here, never in a component.
//
// The design (DESIGN.md) specifies the LIGHT palette exactly; dark mode is described qualitatively
// ("charcoal depth, glass"). The dark theme below is a provisional mapping over the same primitive
// ramp (using the inverse-* tokens) — good enough to build against, to be tightened once dark
// values are finalised. Both themes expose the SAME keys, which is what lets the app switch freely.

import { color } from "./primitives";

export interface SemanticColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceSunken: string;
  textPrimary: string;
  textMuted: string;
  textInverse: string;
  actionPrimary: string;
  onActionPrimary: string;
  actionSecondary: string;
  onActionSecondary: string;
  border: string;
  borderStrong: string;
  statusSuccess: string;
  statusWarning: string;
  statusError: string;
  statusInfo: string;
  overlay: string;
}

export const lightColors: SemanticColors = {
  background: color.background,
  surface: color.surfaceContainerLowest,
  surfaceElevated: color.surfaceContainer,
  surfaceSunken: color.surfaceContainerHigh,
  textPrimary: color.onSurface,
  textMuted: color.onSurfaceVariant,
  textInverse: color.inverseOnSurface,
  actionPrimary: color.primary,
  onActionPrimary: color.onPrimary,
  actionSecondary: color.secondary,
  onActionSecondary: color.onSecondary,
  border: color.outlineVariant,
  borderStrong: color.outline,
  statusSuccess: "#128a3e",
  statusWarning: "#b7791f",
  statusError: color.error,
  statusInfo: color.primary,
  overlay: "rgba(21, 28, 39, 0.5)",
};

export const darkColors: SemanticColors = {
  background: "#0f141c",
  surface: color.inverseSurface,
  surfaceElevated: "#333b48",
  surfaceSunken: "#0b0f14",
  textPrimary: color.inverseOnSurface,
  textMuted: "#c7c4d8",
  textInverse: color.onSurface,
  actionPrimary: color.primaryFixedDim,
  onActionPrimary: color.onPrimaryFixed,
  actionSecondary: color.secondaryFixedDim,
  onActionSecondary: color.onSecondaryFixed,
  border: "#464555",
  borderStrong: color.outline,
  statusSuccess: "#7ee2a8",
  statusWarning: "#f6c453",
  statusError: "#ffb4ab",
  statusInfo: color.primaryFixedDim,
  overlay: "rgba(0, 0, 0, 0.6)",
};

export type ThemeName = "light" | "dark";

export const themes: Record<ThemeName, SemanticColors> = {
  light: lightColors,
  dark: darkColors,
};
