import {
  ArrowLeft,
  ArrowsClockwise,
  Bell,
  Briefcase,
  CalendarBlank,
  Camera,
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  Clock,
  CreditCard,
  Drop,
  Gear,
  Globe,
  House,
  Lightning,
  MagnifyingGlass,
  MapPin,
  NavigationArrow,
  Package,
  PencilSimple,
  Phone,
  Plus,
  QrCode,
  ShieldCheck,
  SignOut,
  Snowflake,
  Star,
  Tag,
  Trash,
  User,
  Wallet,
  Warning,
  WifiHigh,
  WifiSlash,
  Wind,
  Wrench,
  X,
  type Icon as PhosphorIcon,
  type IconWeight,
} from "phosphor-react-native";
import { Platform } from "react-native";
import { SymbolView } from "expo-symbols";
import type { SFSymbol } from "sf-symbols-typescript";
import { color } from "@sethu/tokens";

// The design-system icon set: a curated, named map over Phosphor (which renders via react-native-svg,
// so it works on iOS, Android and web). Screens reference icons by semantic name, not by importing
// Phosphor directly — so the set stays consistent and swappable.
const ICONS = {
  home: House,
  bookings: CalendarBlank,
  account: User,
  service: Wrench,
  earnings: Wallet,
  location: MapPin,
  phone: Phone,
  navigate: NavigationArrow,
  camera: Camera,
  star: Star,
  check: Check,
  close: X,
  chevronRight: CaretRight,
  back: CaretLeft,
  backArrow: ArrowLeft,
  search: MagnifyingGlass,
  settings: Gear,
  logout: SignOut,
  delete: Trash,
  bell: Bell,
  plus: Plus,
  payment: CreditCard,
  package: Package,
  clock: Clock,
  online: WifiHigh,
  offline: WifiSlash,
  alert: Warning,
  refresh: ArrowsClockwise,
  checkCircle: CheckCircle,
  qr: QrCode,
  shield: ShieldCheck,
  tag: Tag,
  drop: Drop,
  lightning: Lightning,
  snowflake: Snowflake,
  wind: Wind,
  globe: Globe,
  briefcase: Briefcase,
  pencil: PencilSimple,
} satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof ICONS;

// SF Symbol name per icon, so iOS renders the native symbol set (with a Phosphor fallback if a
// symbol is unavailable). Android keeps Phosphor. Names verified against the SF Symbols catalog.
const SF_SYMBOLS: Record<IconName, string> = {
  home: "house.fill",
  bookings: "calendar",
  account: "person.crop.circle",
  service: "wrench.and.screwdriver.fill",
  earnings: "indianrupeesign.circle",
  location: "mappin.and.ellipse",
  phone: "phone.fill",
  navigate: "paperplane.fill",
  camera: "camera.fill",
  star: "star.fill",
  check: "checkmark",
  close: "xmark",
  chevronRight: "chevron.right",
  back: "chevron.left",
  backArrow: "arrow.left",
  search: "magnifyingglass",
  settings: "gearshape.fill",
  logout: "rectangle.portrait.and.arrow.right",
  delete: "trash.fill",
  bell: "bell.fill",
  plus: "plus",
  payment: "creditcard.fill",
  package: "shippingbox.fill",
  clock: "clock.fill",
  online: "wifi",
  offline: "wifi.slash",
  alert: "exclamationmark.triangle.fill",
  refresh: "arrow.clockwise",
  checkCircle: "checkmark.circle.fill",
  qr: "qrcode",
  shield: "checkmark.shield.fill",
  tag: "tag.fill",
  drop: "drop.fill",
  lightning: "bolt.fill",
  snowflake: "snowflake",
  wind: "wind",
  globe: "globe",
  briefcase: "briefcase.fill",
  pencil: "pencil",
};

const TONE_COLOR = {
  default: color.onSurface,
  muted: color.onSurfaceVariant,
  primary: color.primary,
  secondary: color.secondary,
  inverse: color.onPrimary,
  error: color.error,
  success: color.tertiary,
} as const;

export type IconTone = keyof typeof TONE_COLOR;

export interface IconProps {
  name: IconName;
  size?: number;
  tone?: IconTone;
  color?: string;
  /** Phosphor stroke weight. Defaults to "regular"; pass "bold"/"fill"/"duotone" for emphasis. */
  weight?: IconWeight;
  /** Back-compat: a heavier stroke maps to the "bold" weight. */
  strokeWidth?: number;
}

export function Icon({
  name,
  size = 22,
  tone = "default",
  color: colorOverride,
  weight,
  strokeWidth,
}: IconProps) {
  const Glyph = ICONS[name];
  const resolvedWeight: IconWeight =
    weight ?? (strokeWidth != null && strokeWidth >= 2.3 ? "bold" : "regular");
  const resolvedColor = colorOverride ?? TONE_COLOR[tone];
  const glyph = <Glyph size={size} color={resolvedColor} weight={resolvedWeight} />;

  // iOS renders the native SF Symbol (falling back to the Phosphor glyph if unavailable); every other
  // platform uses Phosphor. Same API, so screens don't change.
  if (Platform.OS === "ios") {
    return (
      <SymbolView
        name={SF_SYMBOLS[name] as SFSymbol}
        size={size}
        tintColor={resolvedColor}
        weight={resolvedWeight === "bold" || resolvedWeight === "fill" ? "bold" : "regular"}
        resizeMode="scaleAspectFit"
        fallback={glyph}
      />
    );
  }
  return glyph;
}
