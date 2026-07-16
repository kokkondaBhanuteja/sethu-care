import { forwardRef } from "react";
import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { tv, type VariantProps } from "tailwind-variants";

// The typographic scale from the design, as a variant-driven Text. `variant` picks the size/weight
// (display, headline, body, label…); `tone` picks the semantic colour. Everything maps to the
// shared tokens via NativeWind classes.
const text = tv({
  base: "font-body",
  variants: {
    variant: {
      displayLg: "font-display text-display-lg-mobile",
      headline: "font-heading text-headline-md",
      headlineSm: "font-heading text-headline-sm",
      bodyLg: "font-body text-body-lg",
      body: "font-body text-body-md",
      label: "font-semibold text-label-md",
      caption: "font-medium text-label-sm",
    },
    tone: {
      default: "text-on-surface",
      muted: "text-on-surface-variant",
      primary: "text-primary",
      inverse: "text-inverse-on-surface",
      error: "text-error",
    },
  },
  defaultVariants: { variant: "body", tone: "default" },
});

export type TextProps = RNTextProps & VariantProps<typeof text>;

export const Text = forwardRef<RNText, TextProps>(function Text(
  { variant, tone, className, ...rest },
  ref,
) {
  return <RNText ref={ref} className={text({ variant, tone, className })} {...rest} />;
});
