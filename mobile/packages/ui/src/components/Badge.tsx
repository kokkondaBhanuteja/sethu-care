import { View } from "react-native";
import { tv, type VariantProps } from "tailwind-variants";

import { Text } from "./Text";

// A small, solid-colour badge for offers / tags (e.g. "30% OFF", "VERIFIED"), overlaid on cards and
// images. Solid fills only — no gradients.
const badge = tv({
  base: "self-start rounded-md px-2 py-0.5",
  variants: {
    tone: {
      offer: "bg-primary",
      accent: "bg-secondary",
      neutral: "bg-surface-container-high",
      onImage: "bg-inverse-surface",
    },
  },
  defaultVariants: { tone: "offer" },
});

export type BadgeTone = NonNullable<VariantProps<typeof badge>["tone"]>;

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

export function Badge({ label, tone = "offer" }: BadgeProps) {
  return (
    <View className={badge({ tone })}>
      <Text variant="caption" tone={tone === "neutral" ? "default" : "inverse"}>
        {label}
      </Text>
    </View>
  );
}
