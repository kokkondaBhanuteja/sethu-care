import {
  Ban,
  BellRing,
  CheckCircle2,
  CircleSlash,
  FileCheck2,
  FileX2,
  Gift,
  IndianRupee,
  PowerOff,
  RotateCcw,
  Send,
  ShieldOff,
  StickyNote,
  UserCheck,
  UserX,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Pill } from "../../components/ui/Pill";
import { ACTION_LABEL_KEYS, ACTION_PILL_TONES } from "./audit.constants";
import type { AuditAction } from "./audit.types";

/** Glyphs transcribed from the artifacts — the mobile rows draw one inside every action pill. */
const ACTION_ICONS: Readonly<Record<AuditAction, LucideIcon>> = {
  BOOKING_ASSIGN: UserCheck,
  BOOKING_REDISPATCH: Send,
  BOOKING_CANCEL: XCircle,
  BOOKING_MANUAL_COMPLETE: CheckCircle2,
  PAYMENT_REFUND: IndianRupee,
  PAYMENT_REFUND_REVERSE: RotateCcw,
  PAYMENT_GOODWILL: Gift,
  PROVIDER_SUSPEND: CircleSlash,
  PROVIDER_BLOCK: Ban,
  PROVIDER_FORCE_OFFLINE: PowerOff,
  APPLICATION_APPROVE: FileCheck2,
  APPLICATION_REJECT: FileX2,
  CUSTOMER_BLOCK: UserX,
  DEVICE_REVOKE: ShieldOff,
  ALERT_ACKNOWLEDGE: BellRing,
  NOTE_ADD: StickyNote,
};

export interface AuditActionPillProps {
  action: AuditAction;
  /** The list rows draw the glyph; the dense desktop table does not (BOX 48 vs BOX 75). */
  withIcon?: boolean;
}

export function AuditActionPill({ action, withIcon = false }: AuditActionPillProps) {
  const { t } = useTranslation("adminAudit");

  return (
    <Pill tone={ACTION_PILL_TONES[action]} icon={withIcon ? ACTION_ICONS[action] : undefined}>
      {t(ACTION_LABEL_KEYS[action])}
    </Pill>
  );
}
