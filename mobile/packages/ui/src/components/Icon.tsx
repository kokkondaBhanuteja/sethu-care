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
  return <Glyph size={size} color={colorOverride ?? TONE_COLOR[tone]} weight={resolvedWeight} />;
}
