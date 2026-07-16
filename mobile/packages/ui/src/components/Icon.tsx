import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  House,
  LogOut,
  MapPin,
  Navigation,
  Package,
  Phone,
  Plus,
  QrCode,
  RotateCw,
  Search,
  Settings,
  Star,
  Trash2,
  User,
  Wallet,
  Wifi,
  WifiOff,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { color } from "@sethu/tokens";

// The design-system icon set: a curated, named map over lucide (which renders via react-native-svg,
// so it works on iOS, Android and web). Screens reference icons by semantic name, not by importing
// lucide directly — so the set stays consistent and swappable.
const ICONS = {
  home: House,
  bookings: Calendar,
  account: User,
  service: Wrench,
  earnings: Wallet,
  location: MapPin,
  phone: Phone,
  navigate: Navigation,
  camera: Camera,
  star: Star,
  check: Check,
  close: X,
  chevronRight: ChevronRight,
  search: Search,
  settings: Settings,
  logout: LogOut,
  delete: Trash2,
  bell: Bell,
  plus: Plus,
  payment: CreditCard,
  package: Package,
  clock: Clock,
  back: ArrowLeft,
  online: Wifi,
  offline: WifiOff,
  alert: AlertTriangle,
  refresh: RotateCw,
  checkCircle: CheckCircle2,
  qr: QrCode,
} satisfies Record<string, LucideIcon>;

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
  strokeWidth?: number;
}

export function Icon({
  name,
  size = 22,
  tone = "default",
  color: colorOverride,
  strokeWidth = 2,
}: IconProps) {
  const Glyph = ICONS[name];
  return <Glyph size={size} color={colorOverride ?? TONE_COLOR[tone]} strokeWidth={strokeWidth} />;
}
