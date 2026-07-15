import { View } from "react-native";
import { tv, type VariantProps } from "tailwind-variants";

import { Text } from "./Text";

// A small, high-contrast status pill (booking/job state). Colour is paired with a label — never
// colour alone — so it stays accessible.
const pill = tv({
  base: "self-start rounded-full px-sm py-1",
  variants: {
    tone: {
      neutral: "bg-surface-container-high",
      info: "bg-primary/10",
      active: "bg-primary/10",
      success: "bg-tertiary-container",
      danger: "bg-error-container",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export type StatusTone = NonNullable<VariantProps<typeof pill>["tone"]>;

export interface StatusPillProps {
  label: string;
  tone?: StatusTone;
}

export function StatusPill({ label, tone = "neutral" }: StatusPillProps) {
  return (
    <View className={pill({ tone })}>
      <Text variant="caption" tone={tone === "danger" ? "error" : "default"}>
        {label}
      </Text>
    </View>
  );
}
