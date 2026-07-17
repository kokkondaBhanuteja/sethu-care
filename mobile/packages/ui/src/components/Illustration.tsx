import { View } from "react-native";
import { Image } from "expo-image";

import { Icon, type IconName } from "./Icon";

// The illustration registry for the app's empty/success/onboarding moments. Art direction is the
// soft-3D "clay" system documented in docs/image-generation-prompts.md — generate a transparent PNG to
// that spec, drop it in packages/ui/assets/illustrations/, and uncomment its line in ASSETS below.
// Until an asset exists, a soft icon stands in, so screens can reference illustrations today and the
// artwork can arrive incrementally.
export type IllustrationName =
  "welcome" | "emptyBookings" | "emptyJobs" | "noResults" | "paymentSuccess" | "jobComplete";

// Map a name to its bundled asset once the PNG lands. Kept empty on purpose — a require() of a
// missing file fails the bundle, so entries are added only as art is delivered.
const ASSETS: Partial<Record<IllustrationName, number>> = {
  // welcome: require("../../assets/illustrations/welcome.png"),
  // emptyBookings: require("../../assets/illustrations/empty-bookings.png"),
  // emptyJobs: require("../../assets/illustrations/empty-jobs.png"),
  // noResults: require("../../assets/illustrations/no-results.png"),
  // paymentSuccess: require("../../assets/illustrations/payment-success.png"),
  // jobComplete: require("../../assets/illustrations/job-complete.png"),
};

// The stand-in glyph per slot until the real art is registered.
const FALLBACK_ICON: Record<IllustrationName, IconName> = {
  welcome: "home",
  emptyBookings: "bookings",
  emptyJobs: "package",
  noResults: "search",
  paymentSuccess: "checkCircle",
  jobComplete: "checkCircle",
};

export interface IllustrationProps {
  name: IllustrationName;
  size?: number;
}

export function Illustration({ name, size = 160 }: IllustrationProps) {
  const asset = ASSETS[name];
  if (asset != null) {
    return (
      <Image
        source={asset}
        style={{ width: size, height: size }}
        contentFit="contain"
        transition={200}
      />
    );
  }
  return (
    <View
      style={{ width: size, height: size }}
      className="items-center justify-center rounded-full bg-surface-container"
    >
      <Icon name={FALLBACK_ICON[name]} size={Math.round(size * 0.4)} tone="primary" />
    </View>
  );
}
