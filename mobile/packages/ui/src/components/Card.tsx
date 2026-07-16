import { View, type ViewProps } from "react-native";
import { tv, type VariantProps } from "tailwind-variants";

// A surface container. `elevated` adds a soft shadow for cards that float above the page; `flat`
// keeps just a hairline border. Padding is on by default and can be turned off for edge-to-edge
// content (e.g. a table or an image).
const card = tv({
  base: "rounded-card bg-surface-container-lowest border border-outline-variant",
  variants: {
    elevated: {
      true: "shadow-md shadow-inverse-surface/10",
      false: "",
    },
    padded: {
      true: "p-lg",
      false: "",
    },
  },
  defaultVariants: { elevated: true, padded: true },
});

export type CardProps = ViewProps & VariantProps<typeof card>;

export function Card({ elevated, padded, className, children, ...rest }: CardProps) {
  return (
    <View className={card({ elevated, padded, className })} {...rest}>
      {children}
    </View>
  );
}
