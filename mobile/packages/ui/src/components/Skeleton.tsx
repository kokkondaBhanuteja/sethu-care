import { View } from "react-native";
import { tv } from "tailwind-variants";

// A placeholder block shown while content loads. Size it with className (e.g. `h-24 w-full`).
// Hidden from assistive tech — a loading placeholder is noise to a screen reader.
const skeleton = tv({ base: "rounded-md bg-surface-container-high" });

export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={skeleton({ className })}
    />
  );
}
