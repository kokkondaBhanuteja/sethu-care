import { ArrowRight, BellRing, Clock, MessageCircle, TriangleAlert } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { Sheet } from "../../components/ui/Sheet";
import { formatTime } from "../../lib/format";
import type { BookingActionSubject, ProviderCandidate } from "./booking-actions.types";

export interface AssignConfirmSheetProps {
  candidate: ProviderCandidate | null;
  booking: BookingActionSubject;
  isSubmitting: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

/**
 * The only confirmation in the assign flow, so it earns its interruption by restating the PAIRING —
 * this technician, this customer, this area — rather than asking "Are you sure?", which tests
 * nothing. If the wrong card was tapped, the wrong name is the first thing on the sheet.
 */
export function AssignConfirmSheet({
  candidate,
  booking,
  isSubmitting,
  onConfirm,
  onDismiss,
}: AssignConfirmSheetProps) {
  const { t } = useTranslation("adminBookingActions");
  const { t: tShell } = useTranslation("adminShell");
  if (!candidate) return null;

  const title = t("assign.confirmTitle", { name: candidate.name });

  return (
    <Sheet isOpen title={title} hideTitle onDismiss={onDismiss}>
      <div className="flex flex-col gap-s3">
        <h2 className="text-section text-text-1">{title}</h2>

        <Card tone="surface" density="tight" className="flex items-center gap-s3">
          <Avatar name={candidate.name} size="lg" />
          <span className="flex-1 truncate text-emph text-text-1">{candidate.name}</span>
          <Icon glyph={ArrowRight} className="text-text-3" />
          <span className="flex-1 text-right">
            <span className="block truncate text-emph text-text-1">{booking.customerName}</span>
            <span className="block text-caption text-text-2">{booking.zone}</span>
          </span>
        </Card>

        <ul className="flex flex-col">
          <ConsequenceRow
            icon={Clock}
            label={t("assign.consequenceEta", { value: candidate.etaMinutes })}
          />
          <ConsequenceRow icon={MessageCircle} label={t("assign.consequenceCustomer")} />
          <ConsequenceRow icon={BellRing} label={t("assign.consequenceProvider")} />
        </ul>

        {/* The warning sits directly above the buttons: a caution read on the way in is a caption;
            one read with a thumb already travelling toward the button is a decision. */}
        {candidate.availability === "onJob" && candidate.freeAtIso ? (
          <Card tone="warning" className="flex items-start gap-s2">
            <Icon glyph={TriangleAlert} className="text-warning" />
            <span className="text-label text-warning">
              {t("assign.busyWarning", {
                name: candidate.name,
                time: formatTime(candidate.freeAtIso),
              })}
            </span>
          </Card>
        ) : null}

        <div className="flex flex-col gap-s1">
          {/* Deliberately NOT recoloured as destructive: this is a legitimate override ops makes
              several times a day, and dressing it up in red teaches the colour to be ignored. */}
          <Button
            variant="primary"
            size="primary"
            block
            isLoading={isSubmitting}
            onClick={onConfirm}
          >
            {t("assign.assign")}
          </Button>
          <Button variant="text" size="secondary" block onClick={onDismiss}>
            {tShell("actions.cancel")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function ConsequenceRow({
  icon,
  label,
}: {
  icon: React.ComponentProps<typeof Icon>["glyph"];
  label: string;
}) {
  return (
    <li className="flex h-row-40 items-center gap-s2">
      <Icon glyph={icon} className="text-text-2" />
      <span className="text-label text-text-1">{label}</span>
    </li>
  );
}
